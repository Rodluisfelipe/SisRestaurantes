/**
 * Que la conversación se sienta como hablar con alguien.
 *
 * Lo que delata a un bot no es lo que dice: es cómo se comporta. Tres cosas,
 * por orden de cuánto cantan:
 *
 *   1. Contesta en menos de un segundo. Nadie lee, piensa y escribe tan
 *      rápido. Una respuesta instantánea a "quiero una hamburguesa" es la
 *      señal más clara de que no hay nadie del otro lado.
 *   2. Manda un solo bloque con todo. Una persona escribe corto y seguido:
 *      primero acusa recibo, después pregunta.
 *   3. Escribe como un recibo. Viñetas, negritas y "Total:" en cada mensaje.
 *
 * Acá se arreglan las dos primeras. La tercera vive en `conversacion.js`.
 */

/* Cuánto tarda una persona en escribir. Unos 25 caracteres por segundo es
   rápido pero creíble para alguien que atiende y escribe a diario. */
const CARACTERES_POR_SEGUNDO = 25;

/* Antes de escribir hay que leer y pensar. Sin esta pausa, el "escribiendo…"
   aparece en el mismo instante en que el cliente suelta el mensaje. */
const PAUSA_MINIMA_MS = 900;

/* Y un tope: un cliente esperando cuatro segundos ya se pregunta si lo
   dejaron colgado. Vale más parecer rápido que parecer perfecto. */
const PAUSA_MAXIMA_MS = 4000;

function esperaPara(texto) {
  const largo = String(texto || '').length;
  const ms = PAUSA_MINIMA_MS + (largo / CARACTERES_POR_SEGUNDO) * 1000;
  return Math.min(Math.round(ms), PAUSA_MAXIMA_MS);
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Parte la respuesta en los mensajes que mandaría una persona.
 *
 * El acuse de recibo va aparte de la pregunta —"Listo, 1x Hamburguesa 👍" y
 * luego "¿Te lo llevamos o lo recoges?"— porque así es como se escribe en
 * WhatsApp. El resumen del pedido se queda pegado a la pregunta: separarlo
 * dejaría la cifra suelta, sin contexto de qué se está confirmando.
 */
function partir(respuesta) {
  const texto = String(respuesta || '').trim();
  if (!texto) return [];

  /* Un solo renglón, o algo con enlace o con el resumen del pedido, va entero:
     trocear una carta o un total lo vuelve ilegible. */
  const tieneResumen = texto.includes('*Total:');
  const tieneEnlace = texto.includes('http');
  const renglones = texto.split('\n');
  if (renglones.length < 2 || tieneEnlace) return [texto];

  const primero = renglones[0].trim();
  const resto = renglones.slice(1).join('\n').trim();

  /* Solo se parte si el primer renglón se sostiene solo: un acuse corto y sin
     signo de pregunta. Si el mensaje empieza preguntando, partirlo dejaría la
     pregunta huérfana del resto. */
  const esAcuse = primero.length > 0 && primero.length <= 70 && !primero.includes('?');
  if (!esAcuse || !resto) return [texto];

  // Con resumen, el resto (pregunta + pedido) se manda junto.
  return tieneResumen ? [primero, resto] : [primero, resto];
}

/**
 * Manda la respuesta como la mandaría una persona: con una pausa antes, y en
 * varios mensajes si corresponde.
 *
 * `escribiendo` vuelve a mostrar los tres puntitos antes de cada trozo: Meta
 * los quita al llegar un mensaje, así que sin esto el segundo aparecería de
 * la nada.
 */
async function enviarComoPersona({ respuesta, enviar, escribiendo }) {
  const trozos = partir(respuesta);
  if (!trozos.length) return;

  for (let i = 0; i < trozos.length; i++) {
    if (i > 0 && escribiendo) await escribiendo().catch(() => {});
    await dormir(esperaPara(trozos[i]));
    await enviar(trozos[i]);
  }
}

module.exports = {
  enviarComoPersona, partir, esperaPara,
  CARACTERES_POR_SEGUNDO, PAUSA_MINIMA_MS, PAUSA_MAXIMA_MS,
};
