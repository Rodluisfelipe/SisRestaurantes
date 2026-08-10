/**
 * Pasar una nota de voz a texto.
 *
 * Es el hueco más grande que tenía el agente: en Colombia mucha gente pide por
 * audio, y hasta ahora el agente los ignoraba en silencio —el cliente hablaba
 * y no le contestaba nadie.
 *
 * Usa Groq, el mismo proveedor y la misma clave que ya interpreta los pedidos.
 * No suma un vendedor, ni una factura, ni una credencial más que cuidar.
 */
const logger = require('../../utils/logger');

const URL_GROQ = 'https://api.groq.com/openai/v1/audio/transcriptions';

/* `turbo` y no el grande: transcribe igual de bien español de a diario y tarda
   una fracción. Un cliente esperando respuesta nota la diferencia. */
const MODELO = process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3-turbo';

/* Meta acepta notas de voz de hasta 16 MB, pero una de más de dos minutos ya
   no es un pedido: es un cliente contando algo que necesita una persona. */
const LIMITE_BYTES = 8 * 1024 * 1024;

/** La extensión importa: Groq decide el decodificador por el nombre. */
const EXTENSIONES = {
  'audio/ogg': 'ogg',
  'audio/opus': 'opus',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'm4a',
  'audio/amr': 'amr',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
};

function nombreDeArchivo(mimeType) {
  const base = String(mimeType || '').toLowerCase().split(';')[0];
  return `nota.${EXTENSIONES[base] || 'ogg'}`;
}

/**
 * Devuelve el texto de la nota de voz, o null si no se pudo.
 *
 * Nunca lanza: que falle una transcripción no puede tumbar el webhook ni
 * impedir que el audio quede guardado en la bandeja. Si no se pudo, el chat
 * sigue ahí para que lo escuche una persona.
 */
async function transcribir({ buffer, mimeType }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    logger.warn('[WhatsApp] No hay GROQ_API_KEY: la nota de voz queda sin transcribir');
    return null;
  }
  if (!buffer?.length) return null;
  if (buffer.length > LIMITE_BYTES) {
    logger.warn('[WhatsApp] Nota de voz demasiado larga para transcribir', { bytes: buffer.length });
    return null;
  }

  try {
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: mimeType || 'audio/ogg' }), nombreDeArchivo(mimeType));
    form.append('model', MODELO);
    // Fijar el idioma evita que confunda un audio corto con portugués.
    form.append('language', 'es');
    form.append('response_format', 'text');

    const res = await fetch(URL_GROQ, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const detalle = await res.text().catch(() => '');
      logger.warn('[WhatsApp] Groq rechazó la nota de voz', { status: res.status, detalle: detalle.slice(0, 200) });
      return null;
    }

    const texto = (await res.text()).trim();
    return texto || null;
  } catch (e) {
    logger.warn('[WhatsApp] Falló la transcripción', { error: e.message });
    return null;
  }
}

module.exports = { transcribir, MODELO, LIMITE_BYTES };
