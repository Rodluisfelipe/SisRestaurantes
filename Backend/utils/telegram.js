const axios = require('axios');
const logger = require('./logger');

/**
 * El bot de Telegram de Menuby. Necesita en el entorno:
 *   TELEGRAM_BOT_TOKEN     el token que da @BotFather
 *   TELEGRAM_BOT_USERNAME  el usuario del bot, sin @ (para el link t.me/...)
 */

function configurado() {
  return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME);
}

function usuarioBot() {
  return process.env.TELEGRAM_BOT_USERNAME || '';
}

function url(metodo) {
  return `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${metodo}`;
}

async function enviar(chatId, texto) {
  if (!configurado()) return false;
  try {
    await axios.post(url('sendMessage'), { chat_id: chatId, text: texto, parse_mode: 'HTML', disable_web_page_preview: true }, { timeout: 8000 });
    return true;
  } catch (err) {
    logger.warn('Telegram: no se pudo enviar', { chatId, error: err.response?.data?.description || err.message });
    return false;
  }
}

/** Mensajes que le han llegado al bot (se usa para vincular chats). */
async function actualizaciones(offset) {
  const { data } = await axios.get(url('getUpdates'), {
    params: { allowed_updates: JSON.stringify(['message', 'channel_post']), ...(offset ? { offset } : {}) },
    timeout: 10000,
  });
  return data?.result || [];
}

module.exports = { configurado, usuarioBot, enviar, actualizaciones };
