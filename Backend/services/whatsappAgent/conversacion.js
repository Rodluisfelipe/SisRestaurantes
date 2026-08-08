/**
 * Quién lleva la conversación: el código.
 *
 * Recibe lo que el modelo entendió y decide qué hacer y qué contestar. No hay
 * ni una llamada al modelo acá dentro, así que se puede probar entera sin red
 * y siempre se comporta igual ante la misma entrada.
 *
 * Esto existe porque dejar que el modelo llevara el hilo produjo, una tras
 * otra: pedidos con el producto equivocado, totales que el cliente nunca vio,
 * conversaciones que se repetían a sí mismas y clientes a los que se les
 * mandaba el menú una y otra vez mientras ya estaban dictando su pedido. Un
 * modelo es bueno entendiendo lenguaje y malo llevando la cuenta de en qué
 * punto va una conversación.
 *
 * El orden en que se resuelve un turno también es a propósito:
 *   1. Primero se GUARDA todo lo que el cliente dijo.
 *   2. Después se decide qué falta.
 * Al revés, un mensaje con el dato que faltaba se contestaba pidiendo ese mismo
 * dato.
 */
const acciones = require('./acciones');

const pesos = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');

/* Lo que se pregunta por cada dato que falte. Texto fijo: acá no se gana nada
   con que un modelo lo redacte distinto cada vez, y sí se pierde control. */
const PREGUNTA = {
  productos: '¿Qué te gustaría pedir?',
  tipo: '¿Es a domicilio, para recoger, o para comer acá?',
  direccion: '¿A qué dirección te lo llevamos?',
  nombre: '¿A nombre de quién lo dejo?',
};

const TIPOS = { domicilio: 'delivery', recoger: 'takeaway', mesa: 'inSite' };

/** El pedido tal como lo ve el cliente. Lo escribe el código, siempre. */
function resumen(sesion) {
  if (!sesion.items?.length) return '';
  const lineas = sesion.items
    .map((i) => `• ${i.quantity}x ${i.name}${i.note ? ` (${i.note})` : ''} — ${pesos(i.price * i.quantity)}`)
    .join('\n');
  const envio = sesion.orderType === 'delivery' ? '\n_El domicilio te lo confirmamos aparte._' : '';
  return `${lineas}\n*Total: ${pesos(sesion.total())}*${envio}`;
}

/* Palabras con las que un cliente pide algo MÁS. Sin alguna de estas, repetir
   un producto que ya está en el pedido es hablar de él, no pedir otro.
   Las cifras sueltas NO cuentan: "Cra 6 # 3 139" es una dirección, no tres
   hamburguesas. Quedarse corto es recuperable —el cliente ve su pedido en cada
   mensaje y lo dice— mientras que pasarse le cobra comida que no pidió. */
const PIDE_MAS = /\b(otra?|otro|mas|más|tambien|también|agrega|agregame|agrégame|añade|anade|suma|sumale|adicional|adiciona)\b/i;

/**
 * ¿El cliente está pidiendo esto de nuevo, o solo lo está mencionando?
 *
 * El modelo llegó a reportar la hamburguesa pedida tres mensajes atrás cada vez
 * que el cliente contestaba otra cosa —"a domicilio", su dirección—, y el
 * pedido se multiplicaba solo: 1, 2, 3 hamburguesas sin que nadie las pidiera.
 *
 * Esta comprobación no depende de que el modelo obedezca: si el producto YA
 * está en el pedido y el mensaje no trae ninguna palabra de "quiero más", se
 * ignora.
 */
function esRepeticion(sesion, producto, textoDelCliente) {
  const yaEsta = (sesion.items || []).some(
    (i) => acciones.llano(i.name) === acciones.llano(producto.nombre)
      || acciones.llano(i.name).includes(acciones.llano(producto.nombre)),
  );
  if (!yaEsta) return false;
  return !PIDE_MAS.test(String(textoDelCliente || ''));
}

/**
 * Aplica al pedido todo lo que el cliente dijo en este mensaje.
 * Devuelve los avisos que haya que darle (lo que no se pudo hacer y por qué).
 */
async function aplicar(sesion, catalogo, dicho, textoDelCliente) {
  const avisos = [];

  for (const p of dicho.productos) {
    if (esRepeticion(sesion, p, textoDelCliente)) continue;
    const r = await acciones.agregar(sesion, catalogo, {
      producto: p.nombre, cantidad: p.cantidad, nota: p.nota,
    });
    if (r.ok) continue;

    if (r.motivo === 'no_existe') avisos.push(`No tenemos "${p.nombre}".`);
    else if (r.motivo === 'ambiguo') avisos.push(`¿Cuál de estos querías? ${r.opciones.join(', ')}`);
    else if (r.motivo === 'sin_stock') {
      avisos.push(r.disponible > 0
        ? `De ${r.producto} solo me quedan ${r.disponible}.`
        : `Se nos acabó ${r.producto}.`);
    }
  }

  for (const nombre of dicho.quitar) {
    acciones.quitar(sesion, catalogo, { producto: nombre });
  }

  if (dicho.tipo && TIPOS[dicho.tipo]) sesion.orderType = TIPOS[dicho.tipo];
  if (dicho.nombre) sesion.customerName = dicho.nombre.slice(0, 80);
  if (dicho.direccion) sesion.address = dicho.direccion.slice(0, 300);

  return avisos;
}

/**
 * Decide el turno completo.
 *
 * @returns {Promise<{respuesta: string|null, traspasar?: string, crear?: boolean}>}
 */
async function resolver({ sesion, catalogo, dicho, enlace, negocio, estadoPedido, texto }) {
  // ── Cosas que sacan al agente de la conversación ──
  if (dicho.quiereHumano) {
    return { respuesta: 'Claro, ya te ayuda alguien del equipo. 👤', traspasar: 'lo pidió el cliente' };
  }
  if (dicho.otraPregunta) {
    return {
      respuesta: 'Déjame consultarlo con alguien del equipo, te responden en un momento. 👤',
      traspasar: `preguntó: ${dicho.otraPregunta}`.slice(0, 200),
    };
  }

  // ── Consultas que no tocan el pedido ──
  if (dicho.preguntaEstado) {
    const r = await estadoPedido();
    return {
      respuesta: r?.ok
        ? `Tu pedido *#${r.orderNumber}*: ${r.texto}`
        : 'No encuentro pedidos a tu nombre. ¿Lo hiciste con otro número?',
    };
  }

  const avisos = await aplicar(sesion, catalogo, dicho, texto);
  const falta = acciones.queFalta(sesion);
  const tienePedido = !!sesion.items?.length;

  /* El menú se manda cuando de verdad ayuda: al empezar, o si lo pide. NO se
     manda si ya está dictando su pedido, que es lo que hacía que la
     conversación no avanzara nunca. */
  const pidioMenu = dicho.quiereMenu;
  const arrancando = !tienePedido && !dicho.productos.length && dicho.confirma === null;

  if (enlace && (pidioMenu || (arrancando && !sesion.menuEnviadoAt))) {
    sesion.menuEnviadoAt = new Date();
    return {
      respuesta: `${pidioMenu ? 'Claro, acá está' : `¡Hola! Bienvenido a ${negocio}. Mira la carta y arma tu pedido acá`}:\n\n🍔 ${enlace}\n\nO si prefieres, dime qué quieres y te lo armo por acá.`,
    };
  }

  if (dicho.preguntaCarta) {
    return { respuesta: null, mostrarCarta: true };
  }

  // ── Confirmar ──
  /* Solo se cierra si el cliente dijo que sí Y no falta nada. Antes el modelo
     confirmaba por su cuenta y el cliente aceptaba un total que nunca vio. */
  if (dicho.confirma === true && !falta.length) {
    return { crear: true };
  }

  // ── Pedir lo que falte, de a uno ──
  const partes = [...avisos];

  if (falta.length) {
    partes.push(PREGUNTA[falta[0]]);
  } else if (tienePedido) {
    partes.push('¿Confirmo el pedido? Responde *sí* para cerrarlo.');
  } else {
    partes.push(PREGUNTA.productos);
  }

  /* El pedido va SIEMPRE que exista, no solo cuando cambia: es lo que delata
     al instante si algo no se agregó como el cliente creía. */
  const cuerpo = partes.join(' ');
  return { respuesta: tienePedido ? `${cuerpo}\n\n${resumen(sesion)}` : cuerpo };
}

module.exports = { resolver, aplicar, resumen, PREGUNTA, TIPOS };
