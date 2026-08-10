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
  return '👋 *Soy el asistente de tu negocio.* Pregúntame:\n\n'
    + '• *¿Cuánto vendimos hoy?* — también ayer, esta semana o este mes\n'
    + '• *¿Cómo va el negocio?* — el resumen completo\n'
    + '• *¿Hay pedidos pendientes?*\n'
    + '• *¿Cuánto hay en caja?*\n'
    + '• *¿Qué es lo más vendido?*\n'
    + '• *¿Qué se está acabando?* — inventario bajo\n\n'
    + '_Por ahora solo consulto. Para cerrar caja o cambiar algo, hay que entrar al panel._';
}

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

  const regla = REGLAS.find((r) => r.prueba(t));
  if (!regla) {
    /* No se adivina. Antes de contestar cualquier cosa a quien pregunta por
       dinero, es mejor decir qué sí se sabe responder. */
    return `No entendí "${String(texto).slice(0, 60)}".\n\n${ayuda()}`;
  }

  try {
    return await regla.responde(account.businessId, t);
  } catch (e) {
    logger.error('[WhatsApp] Falló una consulta administrativa', {
      error: e.message, consulta: regla.id, businessId: String(account.businessId),
    });
    return 'No pude consultar eso ahora mismo. Intenta en un momento.';
  }
}

module.exports = { atender, autorizado, ayuda, plano, REGLAS };
