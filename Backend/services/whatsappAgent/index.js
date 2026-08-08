/**
 * El agente que atiende por WhatsApp.
 *
 * Reparto de trabajo, y no es negociable:
 *   - El modelo ENTIENDE lo que quiso decir el cliente y REDACTA la respuesta.
 *   - El código busca los productos, mira el stock, suma y crea el pedido.
 *
 * El modelo nunca elige un precio ni arma un total. Cada vez que el pedido
 * cambia, se le añade a la respuesta un resumen calculado por nosotros, así que
 * aunque el modelo escriba una cifra equivocada, la que ve el cliente al final
 * es la de la base. Sin esa separación vuelven los pedidos con el total mal,
 * pero ahora sin nadie revisándolos.
 *
 * Cuando duda, no improvisa: pasa la conversación a una persona.
 */
const logger = require('../../utils/logger');
const Product = require('../../Models/Product');
const WhatsAppAgentSession = require('../../Models/WhatsAppAgentSession');
const WhatsAppMessage = require('../../Models/WhatsAppMessage');
const acciones = require('./acciones');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODELOS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

const MAX_HISTORIAL = 12;      // mensajes de contexto
const MAX_PRODUCTOS = 60;      // tope de catálogo en el prompt

/* Cuánto se le da al negocio para atender un traspaso antes de que el agente
   retome. Media hora: suficiente para que alguien vea el chat, y poco para que
   un cliente no se quede toda la tarde sin respuesta. */
const ESPERA_HUMANO_MS = 30 * 60 * 1000;

const pesos = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');

/* ── Catálogo ── */

async function cargarCatalogo(businessId) {
  const productos = await Product.find({ businessId })
    .select('name price stock trackStock description')
    .limit(300)
    .lean();

  // Lo agotado no se ofrece: prometer algo que no hay es peor que no venderlo.
  return productos.filter((p) => !p.trackStock || (Number(p.stock) || 0) > 0);
}

function catalogoParaPrompt(catalogo) {
  return catalogo
    .slice(0, MAX_PRODUCTOS)
    .map((p) => `- ${p.name}: ${pesos(p.price)}`)
    .join('\n');
}

/* ── Prompt ── */

function instrucciones({ negocio, catalogo, sesion, reglas }) {
  const carrito = sesion.items?.length
    ? sesion.items.map((i) => `${i.quantity}x ${i.name} (${pesos(i.price * i.quantity)})`).join(', ')
    : 'vacío';

  const falta = acciones.queFalta(sesion);

  return `Atiendes el WhatsApp de "${negocio}". Eres breve, cálido y colombiano. Tuteas.

CARTA (lo único que existe; si piden algo que no está acá, dilo con naturalidad):
${catalogoParaPrompt(catalogo)}

PEDIDO ACTUAL: ${carrito}
TIPO: ${sesion.orderType || 'sin definir'}
NOMBRE: ${sesion.customerName || 'sin definir'}
DIRECCIÓN: ${sesion.address || 'sin definir'}
FALTA POR SABER: ${falta.length ? falta.join(', ') : 'nada, ya se puede confirmar'}

${reglas ? `INDICACIONES DEL NEGOCIO:\n${reglas}\n` : ''}
REGLAS QUE NO PUEDES ROMPER:
1. NUNCA escribas precios ni totales. El sistema los añade solo.
2. Si mencionas un producto que el cliente quiere, USA la acción "agregar" en ESE MISMO turno. Nunca digas que agregaste algo sin ejecutar la acción: el cliente se queda creyendo que lo pediste y termina recibiendo otra cosa.
3. Puedes hacer UNA sola acción por turno. Si el cliente dice varias cosas a la vez, agrega el producto primero y pregunta el resto después.
4. NUNCA inventes productos, ingredientes ni tiempos de entrega.
5. Pregunta UNA cosa a la vez, solo lo que aparece en FALTA POR SABER.
6. Si el cliente pide algo que no está en la carta, dilo y ofrece lo más parecido.
7. Si te preguntan algo que no sabes (horarios, promociones, reclamos, un pedido anterior), usa "pasar_a_humano" y dile claramente que alguien del equipo le responde en un momento.
8. Para domicilios NO prometas el valor del envío: el negocio lo confirma.
9. Cuando FALTA POR SABER diga que no falta nada, NO confirmes por tu cuenta: el sistema le muestra el pedido y le pregunta. Usa "confirmar_pedido" solo cuando el cliente ya respondió que sí a ese resumen.
10. Si el cliente da una indicación sobre un plato ("sin cebolla", "bien cocida"), pásala en "nota" al agregarlo.

Respondes SOLO con este JSON, sin texto alrededor:
{"mensaje":"lo que le dices al cliente","accion":{"tipo":"...","...":"..."}}

Acciones posibles:
{"tipo":"ninguna"}                                        conversar sin cambiar el pedido
{"tipo":"agregar","producto":"nombre","cantidad":2,"nota":"sin cebolla"}
{"tipo":"quitar","producto":"nombre"}                     sacar del pedido
{"tipo":"fijar_tipo","tipo_pedido":"domicilio|recoger|mesa"}
{"tipo":"fijar_datos","nombre":"...","direccion":"...","notas":"..."}
{"tipo":"confirmar_pedido"}                               SOLO si el cliente ya dijo que sí al resumen
{"tipo":"pasar_a_humano","motivo":"por qué"}`;
}

/* ── Llamada al modelo ── */

async function pensar(mensajes) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('Falta GROQ_API_KEY');

  let ultimoError;
  for (const model of MODELOS) {
    try {
      const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: mensajes,
          max_tokens: 700,
          temperature: 0.5,
          response_format: { type: 'json_object' },
        }),
      });

      if (res.status === 429 || res.status === 400 || res.status === 404) {
        ultimoError = new Error(`Groq ${res.status}`);
        continue;
      }
      if (!res.ok) throw new Error(`Groq ${res.status}`);

      const data = await res.json();
      const bruto = (data.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      return JSON.parse(bruto);
    } catch (e) {
      ultimoError = e;
    }
  }
  throw ultimoError || new Error('No se pudo consultar el modelo');
}

/* ── Resumen que SIEMPRE lo escribe el código ── */

function resumen(sesion) {
  if (!sesion.items?.length) return '';
  const lineas = sesion.items
    .map((i) => `• ${i.quantity}x ${i.name}${i.note ? ` (${i.note})` : ''} — ${pesos(i.price * i.quantity)}`)
    .join('\n');
  const envio = sesion.orderType === 'delivery'
    ? '\n_El domicilio te lo confirmamos aparte._'
    : '';

  /* Cuando ya no falta nada, se pregunta explícitamente. Antes el modelo decía
     "te confirmo el total" sin mostrarlo y el cliente contestaba "sí" a una
     cifra que nunca vio. */
  const listo = !acciones.queFalta(sesion).length
    ? '\n\n¿Confirmo el pedido? Responde *sí* para cerrarlo.'
    : '';

  return `\n\n${lineas}\n*Total: ${pesos(sesion.total())}*${envio}${listo}`;
}

/* ── Turno completo ── */

/**
 * Procesa un mensaje entrante y devuelve el texto a responder.
 * Devuelve null si el agente no debe contestar (conversación con una persona).
 */
async function atender({ account, negocio, texto, contactPhone, reglas, crearOrden }) {
  const businessId = account.businessId;

  let sesion = await WhatsAppAgentSession.findOne({ businessId, contactPhone });
  if (!sesion) {
    sesion = new WhatsAppAgentSession({ businessId, contactPhone, items: [] });
  }

  /* Si hay una persona atendiendo, el agente no se mete. Pero el traspaso
     caduca: antes, una vez pasada a un humano la conversación quedaba muda
     para siempre, así que si nadie del negocio contestaba el cliente se
     quedaba esperando sin respuesta ni explicación.
     Se considera que alguien la tomó de verdad solo si el negocio escribió
     DESPUÉS del traspaso. Si no escribió nadie y pasó el plazo, el agente
     retoma: contestar algo es mejor que el silencio. */
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

  const mensajes = [
    { role: 'system', content: instrucciones({ negocio, catalogo, sesion, reglas }) },
    ...historial.reverse()
      .filter((m) => m.text)
      .map((m) => ({ role: m.direction === 'in' ? 'user' : 'assistant', content: m.text })),
    { role: 'user', content: texto },
  ];

  let decision;
  try {
    decision = await pensar(mensajes);
  } catch (e) {
    logger.error('[Agente] No se pudo consultar el modelo', { error: e.message });
    sesion.estado = 'con_humano';
    sesion.traspasadoEn = new Date();
    sesion.motivoTraspaso = `fallo del modelo: ${e.message}`;
    await sesion.save();
    return null;   // mejor no responder que responder cualquier cosa
  }

  let respuesta = String(decision?.mensaje || '').trim();
  const accion = decision?.accion || { tipo: 'ninguna' };

  try {
    switch (accion.tipo) {
      case 'agregar': {
        const r = await acciones.agregar(sesion, catalogo, {
          producto: accion.producto,
          cantidad: accion.cantidad,
          nota: accion.nota,
        });
        /* Cuando no se pudo agregar, manda el texto del código y no el del
           modelo: el modelo ya escribió su mensaje creyendo que sí se agregó, y
           dejarlo pasar es como el cliente terminó con una hamburguesa
           sencilla habiendo pedido una doble. */
        if (!r.ok) {
          if (r.motivo === 'no_existe') {
            respuesta = `No tenemos "${r.pedido}". ¿Quieres ver qué sí tenemos?`;
          } else if (r.motivo === 'ambiguo') {
            respuesta = `¿Cuál de estos querías? ${r.opciones.join(', ')}`;
          } else if (r.motivo === 'sin_stock') {
            respuesta = r.disponible > 0
              ? `De ${r.producto} solo me quedan ${r.disponible}. ¿Te sirven?`
              : `Se nos acabó ${r.producto}. ¿Te ofrezco otra cosa?`;
          }
        }
        break;
      }

      case 'quitar':
        acciones.quitar(sesion, catalogo, { producto: accion.producto });
        break;

      case 'fijar_tipo':
        acciones.fijarTipo(sesion, { tipo: accion.tipo_pedido });
        break;

      case 'fijar_datos':
        acciones.fijarDatos(sesion, {
          nombre: accion.nombre, direccion: accion.direccion, notas: accion.notas,
        });
        break;

      case 'confirmar_pedido': {
        const r = await acciones.crearPedido(sesion, businessId, { crearOrden });
        if (r.ok) {
          respuesta = `¡Listo! Tu pedido quedó con el número *#${r.pedido.orderNumber}*.`
            + (sesion.orderType === 'delivery'
              ? ' Ya te confirmamos el valor del domicilio y el tiempo.'
              : ' Te avisamos apenas esté listo.');
        } else if (r.motivo === 'incompleto') {
          respuesta = 'Antes de confirmar me falta un dato.';
        } else if (r.motivo === 'sin_stock') {
          respuesta = `Se nos acabó ${r.producto} mientras hablábamos. ¿Lo quito del pedido?`;
        } else {
          /* Si no se pudo crear por algo que no sabemos manejar, no se le
             inventa una explicación al cliente: lo toma una persona. */
          sesion.estado = 'con_humano';
          sesion.traspasadoEn = new Date();
          sesion.motivoTraspaso = `no se pudo crear el pedido: ${r.motivo}`;
        }
        break;
      }

      case 'pasar_a_humano':
        sesion.estado = 'con_humano';
        sesion.traspasadoEn = new Date();
        sesion.motivoTraspaso = String(accion.motivo || 'el agente no supo resolver').slice(0, 200);
        if (!respuesta) respuesta = 'Dame un segundo que te ayuda alguien del equipo.';
        break;

      default:
        break;
    }
  } catch (e) {
    logger.error('[Agente] Falló la acción', { tipo: accion.tipo, error: e.message });
    sesion.estado = 'con_humano';
    sesion.traspasadoEn = new Date();
    sesion.motivoTraspaso = `error ejecutando ${accion.tipo}: ${e.message}`;
    respuesta = 'Dame un segundo que te ayuda alguien del equipo.';
  }

  /* El resumen SIEMPRE lo escribe el código, y ahora se muestra en CADA turno
     mientras haya pedido, no solo cuando cambia.
     El motivo: el modelo llegó a decir "te agrego una doble hamburguesa" sin
     ejecutar la acción, y como no se mostraba nada, el cliente siguió la
     conversación creyendo que estaba pedida. Con el pedido siempre a la vista,
     una promesa que no se cumplió se nota en el mismo mensaje. */
  const yaSeCerro = accion.tipo === 'confirmar_pedido' && sesion.estado === 'cerrada';
  if (sesion.items?.length && !yaSeCerro && sesion.estado !== 'con_humano') {
    respuesta += resumen(sesion);
  }

  sesion.ultimaActividad = new Date();
  await sesion.save();

  return respuesta || null;
}

module.exports = { atender, cargarCatalogo, resumen, pesos };
