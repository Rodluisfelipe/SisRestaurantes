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

/**
 * Las mismas preguntas, dichas de varias formas.
 *
 * Repetir la frase exacta en cada turno es lo que hace que suene a máquina:
 * una persona no pregunta dos veces con las mismas palabras. Se elige por el
 * número de mensajes de la conversación, así que no hay azar —dos veces el
 * mismo estado dan la misma respuesta— pero a lo largo del chat va variando.
 */
const FORMAS = {
  productos: [
    '¿Qué te gustaría pedir?',
    '¿Qué te provoca hoy?',
    'Cuéntame qué quieres y te lo armo.',
  ],
  tipo: [
    '¿Es a domicilio, para recoger, o para comer acá?',
    '¿Te lo llevamos o lo recoges?',
    '¿Para domicilio o para recoger?',
  ],
  direccion: [
    '¿A qué dirección te lo llevamos?',
    'Pásame la dirección y lo mandamos.',
    '¿Dónde te lo dejamos?',
  ],
  nombre: [
    '¿A nombre de quién lo dejo?',
    'Y por último, ¿cómo te llamas?',
    '¿Tu nombre, para el pedido?',
  ],
};

function preguntar(campo, turno) {
  const opciones = FORMAS[campo] || [PREGUNTA[campo]];
  return opciones[turno % opciones.length];
}

/** Buenos días / buenas tardes / buenas noches, en hora de Colombia. */
function franjaDelDia() {
  const { COL_OFFSET_MS } = require('../../utils/timezone');
  // Colombia es UTC−5: se RESTA, igual que hace `startOfDayCOL`.
  const hora = new Date(Date.now() - COL_OFFSET_MS).getUTCHours();
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/**
 * El primer mensaje, que es donde se decide si esto parece un negocio o un
 * contestador.
 *
 * Tres cosas que antes no hacía: saludar según la hora, tratar distinto a
 * quien ya ha comprado —a un cliente de siempre, un "bienvenido" lo trata como
 * si nunca hubiera venido— y no repetir la misma frase a todo el mundo.
 */
function saludar({ sesion, negocio, pidioMenu, turno }) {
  if (pidioMenu) {
    return ['Claro, acá está la carta', 'De una, mira lo que tenemos', 'Claro que sí, acá te la dejo'][turno % 3];
  }

  const nombre = String(sesion.customerName || '').trim().split(' ')[0];
  const franja = franjaDelDia();

  if (nombre) {
    return [
      `¡${franja}, ${nombre}! Qué bueno verte de nuevo por ${negocio} 😊`,
      `¡Hola ${nombre}! ${franja}. Acá estamos en ${negocio}, mira lo que tenemos hoy`,
      `¡${nombre}! ${franja}, bienvenido otra vez a ${negocio}`,
    ][turno % 3];
  }

  return [
    `¡${franja}! Bienvenido a ${negocio} 😊 Acá está nuestra carta`,
    `¡${franja}! Soy de ${negocio}, con gusto te ayudo. Mira lo que tenemos`,
    `¡${franja}! Gracias por escribirnos a ${negocio}. Esta es la carta`,
  ][turno % 3];
}

/**
 * Acusar recibo de lo que el cliente acaba de decir.
 *
 * Es lo que más se echaba en falta: el cliente pedía una hamburguesa y le
 * llegaba una pregunta seca, sin señal de que se hubiera entendido. Un "listo,
 * una hamburguesa 👍" antes de la siguiente pregunta cambia por completo cómo
 * se siente la conversación, y no toca ninguna cifra —lo arma el código con lo
 * que de verdad entró al pedido.
 */
function acusar({ agregados, fijados }, turno) {
  const partes = [];

  if (agregados?.length) {
    const lista = agregados.length === 1
      ? agregados[0]
      : `${agregados.slice(0, -1).join(', ')} y ${agregados[agregados.length - 1]}`;
    partes.push(['Listo', 'Perfecto', 'De una'][turno % 3] + `, ${lista} 👍`);
  }

  /* Confirmar el dato que acaban de dar evita el "¿me habrá entendido la
     dirección?" que termina en que la escriben otra vez. */
  if (fijados?.direccion) partes.push(`Anoto: ${fijados.direccion}.`);
  else if (fijados?.tipo === 'delivery') partes.push('A domicilio entonces.');
  else if (fijados?.tipo === 'takeaway') partes.push('Para recoger, listo.');
  else if (fijados?.tipo === 'inSite') partes.push('Para comer acá, listo.');

  if (fijados?.nombre) partes.push(`Gracias, ${fijados.nombre}.`);

  return partes.join(' ');
}

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

/* Con qué se pide de verdad hablar con alguien. Sin una de estas palabras, que
   el modelo diga que el cliente quiere un humano no basta. */
/* Sin `\b` al final: las raíces cortas ("encargad") tienen que poder casar con
   la palabra entera ("encargado"), y un límite de palabra ahí lo impide. */
const PIDE_PERSONA = /\b(persona|humano|asesor|agente|encargad|due[ñn]|alguien|operador|atiend|hablar con|con un[ao]? )/i;

/* Saludos. No son una consulta ni una petición: son el principio. */
const SALUDO = /^\s*(hola+|holi|buenas?|buen[oa]s? (dias|días|tardes|noches)|hey|ola|q hubo|quiubo|qué más|que mas|saludos)\s*[!.¡]*\s*$/i;

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
  /* Lo que de verdad entró: sirve para acusar recibo con el nombre real del
     producto —el del catálogo— y no con lo que el cliente escribió. */
  const agregados = [];
  const fijados = {};

  for (const p of dicho.productos) {
    if (esRepeticion(sesion, p, textoDelCliente)) continue;
    const r = await acciones.agregar(sesion, catalogo, {
      producto: p.nombre, cantidad: p.cantidad, nota: p.nota,
    });
    if (r.ok) {
      const ult = sesion.items[sesion.items.length - 1];
      if (ult) agregados.push(`${ult.quantity > 1 ? `${ult.quantity}x ` : ''}${ult.name}`);
      continue;
    }

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

  if (dicho.tipo && TIPOS[dicho.tipo] && sesion.orderType !== TIPOS[dicho.tipo]) {
    sesion.orderType = TIPOS[dicho.tipo];
    fijados.tipo = sesion.orderType;
  }
  if (dicho.nombre && sesion.customerName !== dicho.nombre) {
    sesion.customerName = dicho.nombre.slice(0, 80);
    fijados.nombre = sesion.customerName;
  }
  if (dicho.direccion && sesion.address !== dicho.direccion) {
    sesion.address = dicho.direccion.slice(0, 300);
    fijados.direccion = sesion.address;
  }

  return { avisos, agregados, fijados };
}

/**
 * Decide el turno completo.
 *
 * @returns {Promise<{respuesta: string|null, traspasar?: string, crear?: boolean}>}
 */
async function resolver({ sesion, catalogo, dicho, enlace, negocio, estadoPedido, texto }) {
  const mensaje = String(texto || '');

  /* ── Se comprueba lo que el modelo afirma ──
     Un "Hola" se leyó como "quiero hablar con una persona" y la conversación
     quedó bloqueada media hora: el cliente escribió cuatro veces más sin
     recibir nada. Sacar al agente de la conversación es la decisión más cara
     que puede tomar, así que tiene que estar respaldada por el texto. */
  const pidePersona = PIDE_PERSONA.test(mensaje);
  const pareceConsulta = /\?|\bcuant|\bcuál|\bcual|\bcomo|\bcómo|\bdonde|\bdónde|\bcuando|\bcuándo|\bpor qu|\bqué hora|\bque hora|\bhorario|\bqueja|\breclamo/i.test(mensaje);
  const soloSaludo = SALUDO.test(mensaje.trim()) && mensaje.trim().length <= 25;

  if (dicho.quiereHumano && pidePersona) {
    return { respuesta: 'Claro, ya te ayuda alguien del equipo. 👤', traspasar: 'lo pidió el cliente' };
  }
  /* Una consulta que el agente no puede resolver sí se pasa, pero solo si el
     mensaje de verdad parece una pregunta y no un saludo. */
  if (dicho.otraPregunta && pareceConsulta && !soloSaludo) {
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

  const { avisos, agregados, fijados } = await aplicar(sesion, catalogo, dicho, texto);
  const falta = acciones.queFalta(sesion);
  const tienePedido = !!sesion.items?.length;

  /* El turno de la conversación: hace que las frases varíen a lo largo del chat
     sin ser aleatorias. Con azar, dos clientes en el mismo punto recibirían
     mensajes distintos y no habría forma de reproducir un fallo. */
  const turno = Number(sesion.mensajes || 0);

  /* El menú se manda cuando de verdad ayuda: al empezar, o si lo pide. NO se
     manda si ya está dictando su pedido, que es lo que hacía que la
     conversación no avanzara nunca. */
  const pidioMenu = dicho.quiereMenu;
  const arrancando = !tienePedido && !dicho.productos.length && dicho.confirma === null;

  if (enlace && (pidioMenu || (arrancando && !sesion.menuEnviadoAt))) {
    sesion.menuEnviadoAt = new Date();
    return {
      respuesta: `${saludar({ sesion, negocio, pidioMenu, turno })}\n\n🍔 ${enlace}\n\n`
        + 'O si prefieres, dime qué quieres y yo te lo armo por acá.',
    };
  }

  /* Un saludo sin carta que mandar tampoco puede recibir una pregunta pelada:
     sin enlace, el cliente escribía "Hola" y le llegaba "¿Qué te gustaría
     pedir?" sin un buenas siquiera. */
  if (soloSaludo && !tienePedido) {
    return { respuesta: `${saludar({ sesion, negocio, pidioMenu: false, turno })}\n\n${preguntar('productos', turno)}` };
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
  const acuse = acusar({ agregados, fijados }, turno);
  const cambio = !!(agregados.length || Object.keys(fijados).length);

  /* Los avisos van en su propio renglón: "No tenemos X" pegado a la siguiente
     pregunta se leía como una sola frase atropellada. */
  const partes = [];
  if (acuse) partes.push(acuse);
  if (avisos.length) partes.push(avisos.join(' '));

  let pidiendoConfirmacion = false;
  if (falta.length) {
    partes.push(preguntar(falta[0], turno));
  } else if (tienePedido) {
    pidiendoConfirmacion = true;
    partes.push('¿Confirmo el pedido? Responde *sí* para cerrarlo.');
  } else {
    partes.push(preguntar('productos', turno));
  }

  /* El resumen se manda cuando el pedido CAMBIÓ y siempre al pedir confirmación.
     Antes iba en cada mensaje y la conversación parecía una tira de recibos;
     pero quitarlo del todo traería de vuelta el fallo que lo puso ahí —un
     cliente confirmando un total que nunca vio—, así que en el momento de
     confirmar es obligatorio. */
  const cuerpo = partes.filter(Boolean).join('\n');
  const mostrarResumen = tienePedido && (cambio || pidiendoConfirmacion);
  return { respuesta: mostrarResumen ? `${cuerpo}\n\n${resumen(sesion)}` : cuerpo };
}

module.exports = { resolver, aplicar, resumen, PREGUNTA, TIPOS };
