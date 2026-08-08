/**
 * El agente que atiende por WhatsApp.
 *
 * Quién hace qué, y esto es lo que sostiene todo lo demás:
 *   - El modelo SOLO entiende lo que dijo el cliente (interpretar.js).
 *   - El código decide qué hacer y qué contestar (conversacion.js).
 *   - El código busca los productos, mira el stock, suma y crea el pedido.
 *
 * La primera versión dejaba que el modelo llevara el hilo de la conversación, y
 * salió una cadena de fallos de la misma familia: pedidos con el producto
 * equivocado, totales que el cliente nunca vio, conversaciones que se repetían
 * a sí mismas, y clientes a los que se les mandaba el menú una y otra vez
 * mientras ya estaban dictando su pedido. Cada uno se parcheó con una regla
 * nueva en el prompt, y cada regla nueva rompió otra cosa.
 *
 * Un modelo es bueno entendiendo lenguaje y malo llevando la cuenta de en qué
 * punto va una conversación; el código es exactamente al revés. Este archivo
 * solo orquesta: sesión, cupo, traspaso a una persona y guardado.
 */
const logger = require('../../utils/logger');
const Product = require('../../Models/Product');
// Se importa aunque no se use directo: sin registrarlo, populate('category') falla.
require('../../Models/Category');
const WhatsAppAgentSession = require('../../Models/WhatsAppAgentSession');
const WhatsAppMessage = require('../../Models/WhatsAppMessage');
const acciones = require('./acciones');
const cupo = require('./cupo');
const { interpretar } = require('./interpretar');
const { resolver, resumen } = require('./conversacion');

const MAX_HISTORIAL = 10;   // mensajes de contexto para entender el actual
const MAX_CATEGORIAS = 12;  // tope de categorías al mostrar la carta

/* Cuánto se le da al negocio para atender un traspaso antes de que el agente
   retome. Media hora: suficiente para que alguien vea el chat, y poco para que
   un cliente no se quede toda la tarde sin respuesta. */
const ESPERA_HUMANO_MS = 30 * 60 * 1000;

/* Cuántos turnos seguidos puede repetir lo mismo antes de pasar a una persona.
   Con el flujo en manos del código esto no debería dispararse nunca, y por eso
   mismo vale como alarma. */
const MAX_TURNOS_SIN_AVANZAR = 3;

const pesos = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');

/* ── Catálogo ── */

async function cargarCatalogo(businessId) {
  /* `active: false` es lo que el negocio apagó a propósito. Sin este filtro el
     agente ofrecía productos retirados de la carta —incluido uno llamado
     "Prueba"— como si estuvieran a la venta. */
  const productos = await Product.find({ businessId, active: { $ne: false } })
    .select('name price stock trackStock category displayOrder')
    .populate('category', 'name')
    .sort({ displayOrder: 1 })
    .limit(300)
    .lean();

  // Lo agotado no se ofrece: prometer algo que no hay es peor que no venderlo.
  return productos.filter((p) => !p.trackStock || (Number(p.stock) || 0) > 0);
}

/** Agrupa por categoría, respetando el orden que puso el negocio. */
function porCategoria(catalogo) {
  const grupos = new Map();
  for (const p of catalogo) {
    const nombre = p.category?.name || 'Otros';
    if (!grupos.has(nombre)) grupos.set(nombre, []);
    grupos.get(nombre).push(p);
  }
  return grupos;
}

/**
 * La carta que ve el cliente, escrita por el código.
 *
 * El modelo la redactaba de memoria y salía un chorizo corrido, sin precios y
 * con productos que ya no estaban a la venta.
 */
function cartaParaCliente(catalogo, filtro) {
  const q = acciones.llano(filtro || '');
  const grupos = porCategoria(catalogo);

  // Si preguntan por una categoría concreta, se muestra solo esa.
  if (q) {
    const coincide = [...grupos].filter(([cat]) => acciones.llano(cat).includes(q) || q.includes(acciones.llano(cat)));
    if (coincide.length) {
      return coincide
        .map(([cat, ps]) => `*${cat}*\n${ps.map((p) => `• ${p.name} — ${pesos(p.price)}`).join('\n')}`)
        .join('\n\n');
    }
  }

  const partes = [];
  for (const [cat, ps] of grupos) {
    /* Se muestran unos pocos por categoría: una carta entera por WhatsApp no
       se lee, y el cliente puede pedir una categoría concreta. */
    const muestra = ps.slice(0, 6);
    const resto = ps.length - muestra.length;
    partes.push(
      `*${cat}*\n${muestra.map((p) => `• ${p.name} — ${pesos(p.price)}`).join('\n')}`
      + (resto > 0 ? `\n_y ${resto} más_` : ''),
    );
  }
  return partes.slice(0, MAX_CATEGORIAS).join('\n\n');
}

/**
 * El enlace al menú del negocio, marcado como venido de WhatsApp.
 *
 * Mandar el link cuesta un mensaje; armar el pedido conversando cuesta diez o
 * quince. Pero se manda solo cuando ayuda —al empezar, o si lo piden—, nunca a
 * quien ya está dictando su pedido: eso hacía que la conversación no avanzara.
 */
function enlaceMenu(slug) {
  if (!slug) return null;
  const base = process.env.FRONTEND_URL || 'https://menuby.tech';
  return `${base.replace(/\/$/, '')}/${slug}?source=whatsapp`;
}

/* ── Turno completo ── */

/**
 * Procesa un mensaje entrante y devuelve el texto a responder.
 * Devuelve null si el agente no debe contestar.
 */
async function atender({ account, negocio, slug, texto, contactPhone, reglas, crearOrden }) {
  const businessId = account.businessId;
  const enlace = enlaceMenu(slug);

  let sesion = await WhatsAppAgentSession.findOne({ businessId, contactPhone });
  const esConversacionNueva = !sesion;
  if (!sesion) {
    sesion = new WhatsAppAgentSession({ businessId, contactPhone, items: [] });
  }

  /* El cupo se mira ANTES de gastar nada. Una conversación ya empezada se
     termina aunque el cupo se acabe en mitad: cortarle a alguien a media frase
     es peor que atender una de más. Solo se frenan las nuevas. */
  if (esConversacionNueva && !cupo.tieneCupo(account)) {
    const e = new Error('Se agotó el cupo de conversaciones del agente');
    e.code = 'SIN_CUPO';
    throw e;
  }

  /* Si hay una persona atendiendo, el agente no se mete. Pero el traspaso
     caduca: si nadie del negocio contesta, el cliente se quedaría esperando
     para siempre. Se considera atendido de verdad solo si el negocio escribió
     DESPUÉS del traspaso. */
  if (sesion.estado === 'con_humano') {
    const desde = sesion.traspasadoEn || sesion.ultimaActividad;
    const respondioAlguien = await WhatsAppMessage.exists({
      businessId, contactPhone, direction: 'out', sentAt: { $gt: desde },
    });
    const vencido = Date.now() - new Date(desde).getTime() > ESPERA_HUMANO_MS;

    if (respondioAlguien || !vencido) return null;

    logger.info('[Agente] Nadie atendió el traspaso, el agente retoma', {
      businessId: String(businessId), contactPhone, motivo: sesion.motivoTraspaso,
    });
    sesion.estado = 'activa';
    sesion.motivoTraspaso = '';
    sesion.traspasadoEn = null;
  }

  /* Tras cerrar un pedido, si el cliente vuelve a escribir se empieza de cero:
     seguir con el carrito viejo haría que "quiero otra" agregara sobre un
     pedido ya creado. */
  if (sesion.estado === 'cerrada') {
    sesion.items = [];
    sesion.orderType = null;
    sesion.address = '';
    sesion.notes = '';
    sesion.orderId = null;
    sesion.orderNumber = '';
    sesion.menuEnviadoAt = null;
    sesion.estado = 'activa';
  }

  const catalogo = await cargarCatalogo(businessId);
  if (!catalogo.length) {
    sesion.estado = 'con_humano';
    sesion.traspasadoEn = new Date();
    sesion.motivoTraspaso = 'el negocio no tiene productos disponibles';
    await sesion.save();
    return null;
  }

  const historial = await WhatsAppMessage
    .find({ businessId, contactPhone })
    .sort({ sentAt: -1 })
    .limit(MAX_HISTORIAL)
    .select('direction text')
    .lean();

  const contexto = historial.reverse()
    .filter((m) => m.text)
    .map((m) => ({ role: m.direction === 'in' ? 'user' : 'assistant', content: m.text }));

  // ── Paso 1: el modelo entiende. Nada más. ──
  /* Se le muestra lo que ya está en el pedido para que no lo vuelva a reportar
     como si el cliente lo estuviera pidiendo otra vez. */
  const pedidoActual = sesion.items?.length
    ? sesion.items.map((i) => `${i.quantity}x ${i.name}${i.note ? ` (${i.note})` : ''}`).join(', ')
    : '';

  const dicho = await interpretar({ texto, historial: contexto, catalogo, pedidoActual });
  if (!dicho) {
    // Sin entender el mensaje no se improvisa: lo toma una persona.
    sesion.estado = 'con_humano';
    sesion.traspasadoEn = new Date();
    sesion.motivoTraspaso = 'no se pudo interpretar el mensaje';
    await sesion.save();
    return null;
  }

  // ── Paso 2: el código decide ──
  let respuesta = null;
  try {
    const paso = await resolver({
      sesion,
      catalogo,
      dicho,
      enlace,
      negocio,
      reglas,
      // El texto crudo: con él se distingue "pide otra" de "está hablando de la que ya pidió".
      texto,
      estadoPedido: () => acciones.estadoDelPedido({
        businessId,
        contactPhone,
        Order: require('../../Models/Order'),
        CompletedOrder: require('../../Models/CompletedOrder'),
        variantes: require('../../utils/phoneVariants').variantesDeTelefono,
      }),
    });

    if (paso.traspasar) {
      sesion.estado = 'con_humano';
      sesion.traspasadoEn = new Date();
      sesion.motivoTraspaso = paso.traspasar;
    }

    if (paso.mostrarCarta) {
      respuesta = cartaParaCliente(catalogo);
    } else if (paso.crear) {
      const r = await acciones.crearPedido(sesion, businessId, { crearOrden });
      if (r.ok) {
        respuesta = `¡Listo! Tu pedido quedó con el número *#${r.pedido.orderNumber}*.`
          + (sesion.orderType === 'delivery'
            ? ' Ya te confirmamos el valor del domicilio y el tiempo.'
            : ' Te avisamos apenas esté listo.');
      } else if (r.motivo === 'sin_stock') {
        respuesta = `Se nos acabó ${r.producto} mientras hablábamos. ¿Lo quito del pedido?`;
      } else {
        sesion.estado = 'con_humano';
        sesion.traspasadoEn = new Date();
        sesion.motivoTraspaso = `no se pudo crear el pedido: ${r.motivo}`;
        respuesta = 'Se me complicó cerrar el pedido. Ya te ayuda alguien del equipo. 👤';
      }
    } else {
      respuesta = paso.respuesta;
    }
  } catch (e) {
    logger.error('[Agente] Falló el turno', { error: e.message });
    sesion.estado = 'con_humano';
    sesion.traspasadoEn = new Date();
    sesion.motivoTraspaso = `error: ${e.message}`;
    respuesta = 'Dame un segundo que te ayuda alguien del equipo. 👤';
  }

  /* Red de seguridad. Con el flujo en manos del código no debería hacer falta,
     y justo por eso sirve de alarma: si el agente repite lo mismo tres veces,
     algo se rompió y es mejor que lo tome una persona. */
  const repetida = respuesta && respuesta === sesion.ultimaRespuesta;
  sesion.turnosSinAvanzar = repetida ? (sesion.turnosSinAvanzar || 0) + 1 : 0;
  sesion.ultimaRespuesta = respuesta || '';

  if (sesion.turnosSinAvanzar >= MAX_TURNOS_SIN_AVANZAR && sesion.estado === 'activa') {
    logger.warn('[Agente] Conversación atascada, la toma una persona', {
      businessId: String(businessId), contactPhone, turnos: sesion.turnosSinAvanzar,
    });
    sesion.estado = 'con_humano';
    sesion.traspasadoEn = new Date();
    sesion.motivoTraspaso = 'el agente se quedó repitiendo la misma respuesta';
    respuesta = 'Perdona, me estoy enredando. Ya te ayuda alguien del equipo. 👤';
  }

  sesion.ultimaActividad = new Date();
  await sesion.save();

  /* Se cuenta después de atender, no antes: si el modelo falló y no se
     respondió nada, no se le descuenta al negocio una conversación que nunca
     ocurrió. */
  if (esConversacionNueva) cupo.contarConversacion(account);
  cupo.contarMensaje(account);
  await account.save();

  return respuesta || null;
}

module.exports = { atender, cargarCatalogo, cartaParaCliente, enlaceMenu, resumen, pesos };
