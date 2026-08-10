/**
 * El asistente administrativo: el dueño le pregunta a su propio WhatsApp.
 *
 * Se interpreta con reglas y no con un modelo, a propósito. Son ocho preguntas
 * fijas, las reglas aciertan siempre, no cuestan nada y no inventan. Un modelo
 * acá solo añadiría latencia, factura y la posibilidad de que un día conteste
 * una cifra que no salió de la base de datos —que en algo financiero es peor
 * que no contestar.
 *
 * Todas las consultas son de solo lectura. El teléfono es un solo factor de
 * identidad, y con un solo factor no se cierran cajas.
 */
const logger = require('../../utils/logger');
const consultas = require('./consultas');

/* Se quitan tildes y signos: "cuánto vendimos?" y "cuanto vendimos" son la
   misma pregunta, y nadie escribe con tilde en WhatsApp. */
const plano = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[¿?¡!.,;:]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function periodoDe(t) {
  if (/\bayer\b/.test(t)) return 'ayer';
  if (/\bsemana\b|\bsemanal\b|\b7 dias\b/.test(t)) return 'semana';
  if (/\bmes\b|\bmensual\b/.test(t)) return 'mes';
  return 'hoy';
}

/* El orden importa: la primera que coincide gana. Las más específicas van
   antes, porque "cuanto se vendio de hamburguesas" no es la consulta de
   ventas sino la de más vendido. */
const REGLAS = [
  {
    /* Antes que nada: "pedido 746" es un número concreto y no la lista de
       pendientes, que también coincidiría con la palabra "pedido". */
    id: 'pedido',
    prueba: (t) => /\b(pedido|orden|factura)\s*#?\s*\d{1,7}\b/.test(t),
    responde: (id, t) => {
      const n = t.match(/\b(?:pedido|orden|factura)\s*#?\s*(\d{1,7})\b/)[1];
      return consultas.pedido(id, n);
    },
  },
  {
    /* "Quedan 20 hamburguesas" o "llegaron 50 panes": una cifra pegada a un
       producto es un ajuste de inventario, no una pregunta. */
    id: 'stock_ajuste',
    prueba: (t) => /\b(quedan|hay|deja|dejame|pon|ponle|ponme|llegaron|llegue|entraron|sumale|suma|agrega|agregale)\b.*\b\d{1,5}\b|\b\d{1,5}\b.*\b(unidades|und|uds)\b/.test(t),
    escribe: true,
    operacion: 'stock',
  },
  {
    /* Va antes de "agotar": "se acabó el pan" es una orden de cambiar el menú,
       no la consulta de inventario, y la de inventario coincidiría también. */
    id: 'agotar',
    prueba: (t) => /\bse (me )?acabo\b|\bse acabaron\b|\bagota(r|me)?\b|\bquita(r|me)?\b|\bdesactiva(r|me)?\b|\bno hay mas\b|\bsin existencias\b/.test(t),
    escribe: true,
    operacion: 'agotar',
  },
  {
    id: 'activar',
    prueba: (t) => /\bactiva(r|me)?\b|\bvuelve a\b|\bhabilita(r)?\b|\bya hay\b|\bllego mas\b|\bpon(er|le|lo)? de nuevo\b/.test(t),
    escribe: true,
    operacion: 'activar',
  },
  {
    id: 'ayuda',
    prueba: (t) => /\bayuda\b|\bque puedes\b|\bcomandos\b|\bopciones\b|^menu$/.test(t),
    responde: () => ayuda(),
  },
  {
    id: 'stock',
    /* "acaband" cubre "se está acabando", que es como se pregunta de verdad;
       "por acabar" solo cubría la forma de manual. */
    prueba: (t) => /\bstock\b|\binventario\b|\bagotad|acaband|\bpor acabar|\bse acab|\bexistencias\b|\bquedan\b/.test(t),
    responde: (id) => consultas.stockBajo(id),
  },
  {
    id: 'caja',
    prueba: (t) => /\bcaja\b|\befectivo\b|\bcuanto hay\b/.test(t),
    responde: (id) => consultas.caja(id),
  },
  {
    id: 'mas_vendido',
    prueba: (t) => /\bmas vendido\b|\bmas se vende\b|\bmejor producto\b|\btop\b|\bque se vende\b/.test(t),
    responde: (id, t) => consultas.masVendido(id, periodoDe(t)),
  },
  {
    id: 'pendientes',
    prueba: (t) => /\bpendiente|\bsin entregar\b|\ben preparacion\b|\bdomicilios?\b|\bpedidos? (de )?(hoy|activos?|abiertos?)\b/.test(t),
    responde: (id) => consultas.pedidosPendientes(id),
  },
  {
    id: 'clientes',
    prueba: (t) => /\bclientes?\b|\bcompradores\b|\bquien(es)? (mas )?(compra|gasta)/.test(t),
    responde: (id, t) => consultas.clientes(id, periodoDe(t)),
  },
  {
    /* Antes que el resumen: "cómo vamos vs la semana pasada" coincide con los
       dos, y lo que se está pidiendo es la comparación. */
    id: 'comparar',
    prueba: (t) => /\bcompara|\bvs\b|\bversus\b|\bfrente a\b|\bmejor que\b|\bpeor que\b|\bque (la semana|el mes|ayer)\b/.test(t),
    responde: (id, t) => consultas.comparar(id, periodoDe(t)),
  },
  {
    id: 'resumen',
    prueba: (t) => /\bcomo va\b|\bresumen\b|\bcomo vamos\b|\bcomo esta el negocio\b|\breporte\b/.test(t),
    responde: (id) => consultas.resumen(id),
  },
  {
    id: 'ventas',
    prueba: (t) => /\bventa|\bvendimos\b|\bvendido\b|\bfactura|\bingreso|\bcuanto llevamos\b/.test(t),
    responde: (id, t) => consultas.ventas(id, periodoDe(t)),
  },
];

function ayuda() {
  return '👋 *Soy el asistente de tu negocio.*\n\n'
    + '*Consultar*\n'
    + '• ¿Cuánto vendimos hoy? — también ayer, esta semana o este mes\n'
    + '• ¿Cómo va el negocio? — resumen con comparación\n'
    + '• ¿Cómo vamos vs la semana pasada?\n'
    + '• ¿Hay pedidos pendientes?\n'
    + '• Pedido 746 — un pedido concreto\n'
    + '• ¿Cuánto hay en caja?\n'
    + '• ¿Qué es lo más vendido?\n'
    + '• ¿Qué se está acabando?\n'
    + '• Clientes — cuántos nuevos y los que más gastan\n\n'
    + '*Cambiar el menú*\n'
    + '• Se acabó la hamburguesa doble — la quita del menú\n'
    + '• Activa la hamburguesa doble — la vuelve a poner\n'
    + '• Quedan 20 hamburguesas — deja el inventario en esa cifra\n'
    + '• Llegaron 50 panes — se los suma a lo que había\n'
    + '• Sirve igual para los extras: "se acabó el queso"\n\n'
    + '_Todo cambio te lo confirmo antes de hacerlo. La caja y los precios solo se tocan desde el panel._';
}

/* Lo que cuenta como un sí y como un no. Nada más: ante la duda con algo que
   cambia el menú, se vuelve a preguntar en vez de interpretar. */
const ES_SI = /^(si|sí|s|dale|hazlo|confirmo|correcto|ok|oka|listo|eso|exacto|claro)\b/;
const ES_NO = /^(no|nel|cancela|cancelar|dejalo|olvidalo|mejor no)\b/;

/**
 * ¿Este número es de alguien autorizado a preguntar?
 *
 * Se comparan solo los dígitos y por el final: el mismo teléfono se guarda como
 * "3138178003" en el panel y llega como "573138178003" desde WhatsApp, y una
 * comparación exacta no encontraría nunca a nadie.
 */
function autorizado(account, contactPhone) {
  const numeros = account?.consultas?.numeros || [];
  if (!numeros.length) return null;

  const entrante = String(contactPhone || '').replace(/\D/g, '');
  if (entrante.length < 10) return null;

  return numeros.find((n) => {
    const guardado = String(n.telefono || '').replace(/\D/g, '');
    if (guardado.length < 10) return false;
    // Los últimos 10 dígitos: quita indicativos de país por ambos lados.
    return guardado.slice(-10) === entrante.slice(-10);
  }) || null;
}

/**
 * Atiende la pregunta, si viene de un número autorizado.
 *
 * Devuelve el texto a enviar, o null si este mensaje no es para el asistente
 * —y entonces sigue el camino normal de cliente.
 */
async function atender({ account, contactPhone, texto }) {
  const persona = autorizado(account, contactPhone);
  if (!persona) return null;

  const t = plano(texto);
  if (!t) return null;

  const acciones = require('./acciones');
  const pendientes = require('./pendientes');

  /* ¿Está contestando a un "¿confirmas?" anterior? Eso manda sobre cualquier
     otra regla: un "sí" suelto no significa nada por sí mismo. */
  const pendiente = await pendientes.leer(account.businessId, contactPhone);
  if (pendiente) {
    if (ES_SI.test(t)) {
      await pendientes.borrar(account.businessId, contactPhone);
      return acciones.aplicar({ businessId: account.businessId, persona, accion: pendiente });
    }
    if (ES_NO.test(t)) {
      await pendientes.borrar(account.businessId, contactPhone);
      return 'Listo, no cambié nada.';
    }
    /* Ni sí ni no: se descarta lo pendiente y se atiende lo nuevo. Dejarlo
       vivo haría que un "sí" de otra conversación, diez minutos después,
       agotara un producto que ya nadie recordaba. */
    await pendientes.borrar(account.businessId, contactPhone);
  }

  const regla = REGLAS.find((r) => r.prueba(t));
  if (!regla) {
    /* No se adivina. Antes de contestar cualquier cosa a quien pregunta por
       dinero, es mejor decir qué sí se sabe responder. */
    return `No entendí "${String(texto).slice(0, 60)}".\n\n${ayuda()}`;
  }

  try {
    if (regla.escribe) return await proponerCambio({ account, persona, contactPhone, texto, t, regla });
    return await regla.responde(account.businessId, t);
  } catch (e) {
    logger.error('[WhatsApp] Falló una consulta administrativa', {
      error: e.message, consulta: regla.id, businessId: String(account.businessId),
    });
    return 'No pude hacer eso ahora mismo. Intenta en un momento.';
  }
}

/**
 * Propone el cambio y espera un sí.
 *
 * Nunca aplica nada en el mismo mensaje. Con un solo factor de identidad, la
 * confirmación es la segunda barrera: obliga a leer qué va a pasar antes de
 * que pase, y a que quien escribe vea si el producto que entendimos es el que
 * tenía en la cabeza.
 */
async function proponerCambio({ account, persona, contactPhone, texto, t, regla }) {
  const acciones = require('./acciones');
  const pendientes = require('./pendientes');

  /* En un ajuste de inventario, el número es la cantidad y hay que sacarlo
     antes de buscar: "quedan 20 hamburguesas" busca "hamburguesas", no
     "20 hamburguesas". */
  const esStock = regla.operacion === 'stock';
  const cifra = esStock ? Number((t.match(/\b(\d{1,5})\b/) || [])[1]) : null;
  /* "Llegaron 50" suma a lo que había; "quedan 50" lo deja en esa cifra. Son
     dos cosas distintas y confundirlas descuadra el inventario. */
  const sumar = esStock && /\b(llegaron|llegue|entraron|sumale|suma|agrega|agregale|mas)\b/.test(t);

  if (esStock && !Number.isFinite(cifra)) {
    return '¿Cuántas unidades? Por ejemplo: "quedan 20 hamburguesas".';
  }

  /* Se le quitan las palabras de la orden para quedarse con el nombre: de
     "se acabó la hamburguesa doble" queda "hamburguesa doble". */
  const nombre = t
    .replace(/\b\d{1,5}\b/g, ' ')
    .replace(/\b(se|me|ya|no|hay|mas|de|la|el|los|las|un|una|por favor|porfa)\b/g, ' ')
    .replace(/\b(acabo|acabaron|agotar|agotame|agota|quitar|quitame|quita|desactivar|desactiva|activar|activame|activa|habilitar|habilita|vuelve|a|poner|ponle|ponlo|pon|ponme|llego|llegaron|llegue|entraron|quedan|deja|dejame|sumale|suma|agrega|agregale|unidades|und|uds|existencias|sin)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!nombre) {
    if (esStock) return '¿De qué producto? Por ejemplo: "quedan 20 hamburguesas".';
    return regla.operacion === 'agotar'
      ? '¿Qué se acabó? Dime el nombre, por ejemplo: "se acabó la hamburguesa doble".'
      : '¿Qué activo? Dime el nombre, por ejemplo: "activa la hamburguesa doble".';
  }

  const hallazgo = await acciones.encontrar(account.businessId, nombre);

  if (hallazgo.ninguno) {
    return `No encontré nada que se llame "${nombre}" en tu menú ni en tus extras.`;
  }
  if (hallazgo.ambiguo) {
    const lista = hallazgo.ambiguo.map((p) => `• ${p.name}`).join('\n');
    return `¿Cuál de estos?\n${lista}\n\nEscríbeme el nombre completo.`;
  }

  const item = hallazgo.item;

  if (esStock) {
    if (hallazgo.tipo !== 'producto') {
      return 'El inventario se lleva por producto, no por extras.';
    }
    await pendientes.guardar(account.businessId, contactPhone, {
      operacion: 'stock',
      itemId: String(item._id),
      nombre: item.name,
      cantidad: cifra,
      sumar,
    });

    const aviso = item.trackStock
      ? ''
      : '\n\n_Le voy a activar el control de inventario: se agotará solo al llegar a cero._';
    return sumar
      ? `¿Le sumo *${cifra}* unidades a *${item.name}*?${aviso}\n\nResponde *sí* para confirmar.`
      : `¿Dejo *${item.name}* en *${cifra}* unidades?${aviso}\n\nResponde *sí* para confirmar.`;
  }

  const activar = regla.operacion === 'activar';
  const queEs = hallazgo.tipo === 'producto' ? 'producto' : 'extra';

  // Si ya está como se pide, se dice y no se pregunta nada.
  if (!!item.active === activar) {
    return activar
      ? `*${item.name}* ya está disponible.`
      : `*${item.name}* ya estaba fuera del menú.`;
  }

  await pendientes.guardar(account.businessId, contactPhone, {
    tipo: hallazgo.tipo,
    operacion: regla.operacion,
    itemId: String(item._id),
    grupoId: item.grupoId ? String(item.grupoId) : null,
    nombre: item.name,
  });

  return activar
    ? `¿Activo el ${queEs} *${item.name}*?\n\nResponde *sí* para confirmar.`
    : `¿Quito el ${queEs} *${item.name}* del menú?\n`
      + `Los clientes dejarán de verlo hasta que lo actives.\n\nResponde *sí* para confirmar.`;
}

module.exports = { atender, autorizado, ayuda, plano, REGLAS, ES_SI, ES_NO };
