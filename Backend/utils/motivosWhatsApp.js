/**
 * Traduce a español los motivos por los que Meta no entrega un mensaje.
 *
 * Vive aparte de la ruta a propósito: requerir `Routes/whatsappInbox` arranca
 * Express y sus middlewares, así que una prueba que lo importe se queda
 * colgada. Acá es una función pura y se comprueba en dos líneas.
 */

/* El 131051 está verificado en producción: es lo que llega al recibir un
   sticker animado. La tabla de tipos soportados de Meta sí los incluye, pero
   esa tabla es de lo que se puede ENVIAR; al recibir, la Cloud API no los
   entrega y no manda ningún identificador de archivo. */
const MOTIVOS_DE_META = {
  131051: 'WhatsApp no entrega este tipo de mensaje. Pasa con los stickers animados.',
  131052: 'El archivo pesa más de 100 MB y WhatsApp no lo entrega.',
};

function motivoDeMeta(error) {
  if (!error) return '';
  const propio = MOTIVOS_DE_META[Number(error.code)];
  if (propio) return propio;
  // Lo de Meta viene en inglés, pero es mejor que nada: dice algo.
  return String(error.error_data?.details || error.title || '').slice(0, 300);
}

module.exports = { motivoDeMeta, MOTIVOS_DE_META };
