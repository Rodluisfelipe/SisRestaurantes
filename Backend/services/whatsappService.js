const axios = require('axios');
const logger = require('../utils/logger');

const BASE_URL = process.env.EVOLUTION_API_URL || '';
const API_KEY = process.env.EVOLUTION_API_KEY || '';
const INSTANCE = process.env.EVOLUTION_INSTANCE || 'menuby';

// --- Phone normalization (Colombian-first) ---
function normalizePhone(raw) {
  if (!raw) return null;
  let phone = String(raw).replace(/[\s\-\(\)\+]/g, '');
  // Colombian mobile starting with 3 → add country code
  if (/^3\d{9}$/.test(phone)) phone = '57' + phone;
  // Already has country code but starts with 0
  if (phone.startsWith('0')) phone = '57' + phone.slice(1);
  if (phone.length < 10) return null;
  return phone;
}

// --- Rate-limited queue (max 20 msg/min, 1-3s delay between sends) ---
const queue = [];
let processing = false;

function enqueue(number, text) {
  if (!BASE_URL || !API_KEY) return; // disabled if not configured
  const phone = normalizePhone(number);
  if (!phone) return;
  queue.push({ phone, text });
  if (!processing) _processQueue();
}

async function _processQueue() {
  processing = true;
  let count = 0;
  let windowStart = Date.now();

  while (queue.length > 0) {
    if (count >= 20) {
      const wait = 60000 - (Date.now() - windowStart);
      if (wait > 0) await _sleep(wait + 200);
      count = 0;
      windowStart = Date.now();
    }

    const { phone, text } = queue.shift();
    try {
      await axios.post(
        `${BASE_URL}/message/sendText/${INSTANCE}`,
        { number: phone, text, delay: 0 },
        { headers: { apikey: API_KEY }, timeout: 12000 }
      );
    } catch (err) {
      logger.warn('[WhatsApp] Send failed', { phone: phone.slice(0, -4) + '****', error: err.message });
    }

    await _sleep(1000 + Math.random() * 2000);
    count++;
  }

  processing = false;
}

function _sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// --- Order status messages ---
const STATUS_MAP = {
  confirmed:  { emoji: '✅', msg: 'Tu pedido fue *confirmado* y comenzaremos a prepararlo pronto.' },
  preparing:  { emoji: '👨‍🍳', msg: 'Estamos *preparando* tu pedido. ¡Ya casi está listo!' },
  ready:      { emoji: '🛎️', msg: 'Tu pedido está *listo*. Puedes pasar a recogerlo.' },
  inProgress: { emoji: '🚴', msg: 'Tu pedido está *en camino*. ¡Pronto llegará!' },
  delivered:  { emoji: '🎉', msg: '¡Tu pedido fue *entregado*! Gracias por elegirnos.' },
  completed:  { emoji: '✅', msg: '¡Tu pedido fue completado! Gracias por tu visita.' },
  cancelled:  { emoji: '❌', msg: 'Tu pedido fue *cancelado*. Si tienes preguntas, contáctanos.' }
};

function sendOrderStatusNotification(order, status, businessName) {
  const entry = STATUS_MAP[status];
  if (!entry) return;

  const name = (order.customerName || 'Cliente').split(' ')[0];
  const biz  = businessName || 'el restaurante';
  const total = (order.finalAmount || order.totalAmount || 0).toLocaleString('es-CO');

  const text = [
    `${entry.emoji} *${biz}*`,
    '',
    `Hola ${name}, ${entry.msg}`,
    '',
    `📦 Pedido #${order.orderNumber}`,
    `💰 Total: $${total}`,
    '',
    `_Notificación de MenuBy_`
  ].join('\n');

  enqueue(order.phone, text);
}

// --- Booking reminder ---
function sendBookingReminder(booking, businessName, windowKey) {
  const phone = booking.phone || booking.customerPhone;
  if (!phone) return;

  const name = (booking.customerName || 'Cliente').split(' ')[0];
  const biz  = businessName || 'el restaurante';
  const d    = new Date(booking.bookingDate);
  const dateStr = d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeStr = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
  const service = booking.items?.map(i => i.name).join(', ') || 'tu cita';
  const timeNote = windowKey === '1h' ? '⏰ ¡Falta solo 1 hora!' : '⏰ ¡Mañana a esta hora!';

  const text = [
    `🗓️ *${biz}* — Recordatorio de reserva`,
    '',
    `Hola ${name}, te recordamos tu cita:`,
    `📅 *${service}*`,
    `🕐 ${dateStr} a las ${timeStr}`,
    timeNote,
    '',
    `Si necesitas cancelar, por favor contáctanos con anticipación.`,
    '',
    `_Notificación de MenuBy_`
  ].join('\n');

  enqueue(phone, text);
}

// --- Supplier order notification (to buyer: order created) ---
function sendSupplierOrderConfirmation(order) {
  // Notify buyer that their B2B order was received and is pending approval
  // buyer phone not stored in SupplierOrder yet — extend when supplier phone added to BusinessConfig
  // For now, this is a no-op placeholder
}

module.exports = { sendOrderStatusNotification, sendBookingReminder, sendSupplierOrderConfirmation };
