/**
 * whatsappCloud — habla con la Cloud API oficial de Meta.
 *
 * Convive con services/whatsappService.js (Baileys) sin reemplazarlo: aquel
 * manda campañas desde el número de MenuBy, donde el riesgo es nuestro. Este
 * atiende el número propio de cada negocio, donde un baneo le costaría el
 * negocio al cliente y por eso solo se usa la vía oficial.
 *
 * La regla que condiciona todo: la VENTANA DE ATENCIÓN de 24 horas. Se puede
 * escribir libremente a alguien solo dentro de las 24 horas siguientes a su
 * último mensaje. Fuera de eso Meta únicamente acepta plantillas aprobadas.
 * No es una restricción que se pueda parchear después: define qué puede hacer
 * la bandeja en cada momento.
 */
const logger = require('../utils/logger');
const WhatsAppMessage = require('../Models/WhatsAppMessage');

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Teléfono a formato de Meta: solo dígitos, con indicativo. */
function normalizePhone(raw) {
  if (!raw) return null;
  let phone = String(raw).replace(/[\s\-()+ ]/g, '');
  if (/^3\d{9}$/.test(phone)) phone = '57' + phone;      // celular colombiano sin indicativo
  else if (phone.startsWith('0')) phone = '57' + phone.slice(1);
  return phone.length >= 10 ? phone : null;
}

/**
 * ¿Se le puede escribir texto libre a este contacto?
 * Solo si escribió él dentro de las últimas 24 horas.
 */
async function isWithinServiceWindow(businessId, contactPhone) {
  const ultimo = await WhatsAppMessage.findOne({
    businessId, contactPhone, direction: 'in'
  }).sort({ sentAt: -1 }).select('sentAt').lean();

  if (!ultimo) return false;
  return Date.now() - new Date(ultimo.sentAt).getTime() < SERVICE_WINDOW_MS;
}

async function graph(path, { token, method = 'POST', body } = {}) {
  const res = await fetch(`${GRAPH_BASE}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Error de Meta (${res.status})`);
    err.status = res.status;
    err.metaCode = data?.error?.code;
    err.metaType = data?.error?.type;
    throw err;
  }
  return data;
}

/**
 * Envía un texto y deja el registro en la bandeja.
 *
 * Guarda el mensaje DESPUÉS de que Meta confirma, usando el wamid que devuelve:
 * así el id de la fila es el mismo con el que después llegan los webhooks de
 * entregado/leído, y no hay forma de que quede un mensaje "enviado" que en
 * realidad nunca salió.
 */
async function sendText({ account, to, text, sentBy }) {
  const phone = normalizePhone(to);
  if (!phone) {
    const e = new Error('Número de destino inválido'); e.code = 'BAD_PHONE'; throw e;
  }
  const cuerpo = String(text || '').trim();
  if (!cuerpo) {
    const e = new Error('El mensaje va vacío'); e.code = 'EMPTY'; throw e;
  }

  if (!(await isWithinServiceWindow(account.businessId, phone))) {
    const e = new Error(
      'Pasaron más de 24 horas desde el último mensaje del cliente. '
      + 'Meta solo permite retomar la conversación con una plantilla aprobada.'
    );
    e.code = 'OUTSIDE_WINDOW';
    throw e;
  }

  const data = await graph(`${account.phoneNumberId}/messages`, {
    token: account.getAccessToken(),
    body: {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'text',
      text: { preview_url: false, body: cuerpo }
    }
  });

  const wamid = data?.messages?.[0]?.id;
  if (!wamid) throw new Error('Meta no devolvió el identificador del mensaje');

  const guardado = await WhatsAppMessage.create({
    businessId: account.businessId,
    accountId: account._id,
    wamid,
    direction: 'out',
    contactPhone: phone,
    type: 'text',
    text: cuerpo,
    status: 'sent',
    sentBy: sentBy || null,
    sentAt: new Date()
  });

  return guardado;
}

/**
 * Comprueba que las credenciales sirven, preguntándole a Meta por el número.
 * Se usa al conectar: mejor fallar en el formulario que descubrirlo cuando un
 * cliente escriba y nadie pueda responderle.
 */
async function verifyCredentials({ phoneNumberId, accessToken }) {
  const data = await graph(`${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`, {
    token: accessToken,
    method: 'GET'
  });
  return {
    displayNumber: data?.display_phone_number || '',
    verifiedName: data?.verified_name || '',
    qualityRating: data?.quality_rating || ''
  };
}

/** Marca como leído en el celular del cliente (los dos chulos azules). */
async function markAsRead({ account, wamid }) {
  try {
    await graph(`${account.phoneNumberId}/messages`, {
      token: account.getAccessToken(),
      body: { messaging_product: 'whatsapp', status: 'read', message_id: wamid }
    });
  } catch (e) {
    // Cosmético: si falla, el mensaje ya está guardado y la bandeja funciona.
    logger.warn('No se pudo marcar como leído en WhatsApp', { error: e.message });
  }
}

module.exports = {
  normalizePhone,
  isWithinServiceWindow,
  sendText,
  verifyCredentials,
  markAsRead,
  SERVICE_WINDOW_MS,
  GRAPH_BASE
};
