const path = require('path');
const logger = require('../utils/logger');

// Session files persist in the uploads volume (already mounted on server)
const SESSION_DIR = path.join(__dirname, '../../uploads/whatsapp-session');

let sock = null;
let qrCode = null;       // raw QR string from Baileys
let state = 'disabled';  // 'disabled' | 'connecting' | 'qr' | 'open' | 'closed'

// Rate-limited send queue (max 20 msg/min, random 1-3s delay)
const queue = [];
let processing = false;

// ─── Phone normalization ───────────────────────────────────────
function normalizeJid(raw) {
  if (!raw) return null;
  let phone = String(raw).replace(/[\s\-\(\)\+]/g, '');
  if (/^3\d{9}$/.test(phone)) phone = '57' + phone;   // Colombian mobile without CC
  if (phone.startsWith('0')) phone = '57' + phone.slice(1);
  if (phone.length < 10) return null;
  return phone + '@s.whatsapp.net';
}

// ─── Init ─────────────────────────────────────────────────────
async function initWhatsApp() {
  if (process.env.WHATSAPP_ENABLED !== 'true') return;

  try {
    const fs = require('fs');
    if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

    const {
      default: makeWASocket,
      useMultiFileAuthState,
      DisconnectReason,
      fetchLatestBaileysVersion,
      makeCacheableSignalKeyStore,
    } = require('@whiskeysockets/baileys');
    const { Boom } = require('@hapi/boom');
    const P = require('pino')({ level: 'silent' });

    const { state: authState, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version } = await fetchLatestBaileysVersion();

    state = 'connecting';

    sock = makeWASocket({
      version,
      auth: {
        creds: authState.creds,
        keys: makeCacheableSignalKeyStore(authState.keys, P),
      },
      printQRInTerminal: false,
      logger: P,
      generateHighQualityLinkPreview: false,
      browser: ['MenuBy', 'Chrome', '112.0'],
    });

    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        qrCode = qr;
        state = 'qr';
        logger.info('[WhatsApp] QR listo — escanear desde SuperAdmin > WhatsApp');
      }
      if (connection === 'close') {
        qrCode = null;
        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
        if (reason === DisconnectReason.loggedOut) {
          state = 'closed';
          logger.warn('[WhatsApp] Sesión cerrada. Borrar /uploads/whatsapp-session y reiniciar.');
        } else {
          state = 'connecting';
          logger.info('[WhatsApp] Reconectando en 5s...');
          setTimeout(initWhatsApp, 5000);
        }
      }
      if (connection === 'open') {
        qrCode = null;
        state = 'open';
        logger.info('[WhatsApp] Conectado correctamente');
        if (queue.length > 0 && !processing) _processQueue();
      }
    });

    sock.ev.on('creds.update', saveCreds);

  } catch (err) {
    state = 'closed';
    logger.error('[WhatsApp] Error al iniciar Baileys:', err.message);
    setTimeout(initWhatsApp, 30000);
  }
}

// ─── Queue processor ──────────────────────────────────────────
function enqueue(rawPhone, text) {
  if (process.env.WHATSAPP_ENABLED !== 'true') return;
  const jid = normalizeJid(rawPhone);
  if (!jid) return;
  queue.push({ jid, text });
  if (!processing && state === 'open') _processQueue();
}

async function _processQueue() {
  processing = true;
  let count = 0;
  let windowStart = Date.now();

  while (queue.length > 0) {
    if (state !== 'open') break;

    if (count >= 20) {
      const wait = 60000 - (Date.now() - windowStart);
      if (wait > 0) await _sleep(wait + 200);
      count = 0;
      windowStart = Date.now();
    }

    const { jid, text } = queue.shift();
    try {
      await sock.sendMessage(jid, { text });
    } catch (err) {
      logger.warn('[WhatsApp] Envío fallido', { jid: jid.slice(0, 8) + '***', err: err.message });
    }

    await _sleep(1000 + Math.random() * 2000);
    count++;
  }

  processing = false;
}

function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Status / QR for SuperAdmin ───────────────────────────────
function getStatus() { return state; }
function getRawQR() { return qrCode; }

// ─── Message templates ────────────────────────────────────────
const STATUS_MAP = {
  confirmed:  { emoji: '✅', msg: 'Tu pedido fue *confirmado* y comenzaremos a prepararlo pronto.' },
  preparing:  { emoji: '👨‍🍳', msg: 'Estamos *preparando* tu pedido. ¡Ya casi está listo!' },
  ready:      { emoji: '🛎️', msg: 'Tu pedido está *listo*. Puedes pasar a recogerlo.' },
  inProgress: { emoji: '🚴', msg: 'Tu pedido está *en camino*. ¡Pronto llegará!' },
  delivered:  { emoji: '🎉', msg: '¡Tu pedido fue *entregado*! Gracias por elegirnos.' },
  completed:  { emoji: '✅', msg: '¡Tu pedido fue completado! Gracias por tu visita.' },
  cancelled:  { emoji: '❌', msg: 'Tu pedido fue *cancelado*. Si tienes preguntas, contáctanos.' },
};

function sendOrderStatusNotification(order, status, businessName) {
  const entry = STATUS_MAP[status];
  if (!entry || !order.phone) return;

  const name  = (order.customerName || 'Cliente').split(' ')[0];
  const biz   = businessName || 'el restaurante';
  const total = (order.finalAmount || order.totalAmount || 0).toLocaleString('es-CO');

  const text = [
    `${entry.emoji} *${biz}*`,
    '',
    `Hola ${name}, ${entry.msg}`,
    '',
    `📦 Pedido #${order.orderNumber}`,
    `💰 Total: $${total}`,
    '',
    `_Notificación de MenuBy_`,
  ].join('\n');

  enqueue(order.phone, text);
}

function sendBookingReminder(booking, businessName, windowKey) {
  const phone = booking.phone || booking.customerPhone;
  if (!phone) return;

  const name    = (booking.customerName || 'Cliente').split(' ')[0];
  const biz     = businessName || 'el restaurante';
  const d       = new Date(booking.bookingDate);
  const dateStr = d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeStr = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
  const service = booking.items?.map(i => i.name).join(', ') || 'tu cita';

  const text = [
    `🗓️ *${biz}* — Recordatorio`,
    '',
    `Hola ${name}, te recordamos tu cita:`,
    `📅 *${service}*`,
    `🕐 ${dateStr} a las ${timeStr}`,
    windowKey === '1h' ? '⏰ ¡Falta solo 1 hora!' : '⏰ ¡Mañana a esta hora!',
    '',
    `Si necesitas cancelar, por favor contáctanos con anticipación.`,
    '',
    `_Notificación de MenuBy_`,
  ].join('\n');

  enqueue(phone, text);
}

module.exports = {
  initWhatsApp,
  sendOrderStatusNotification,
  sendBookingReminder,
  getStatus,
  getRawQR,
};
