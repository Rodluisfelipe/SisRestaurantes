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

/**
 * Autoriza a nuestra app a recibir los eventos de esa cuenta de WhatsApp.
 *
 * Es el paso invisible que rompe la conexión si falta: se puede tener el webhook
 * verificado, `messages` suscrito y el token correcto, y aun así no llegar nada,
 * porque la WABA además tiene que autorizar a la app. En la consola de Meta no
 * aparece en la pantalla de webhooks, así que descubrirlo a mano es cuestión de
 * suerte. Lo hace el Embedded Signup por dentro; conectando a mano hay que
 * pedirlo explícitamente.
 */
async function subscribeAppToWaba({ wabaId, accessToken }) {
  if (!wabaId) return { skipped: true, reason: 'sin wabaId' };
  await graph(`${wabaId}/subscribed_apps`, { token: accessToken });
  return { subscribed: true };
}

/* ─────────────────────────────────────────────
 *  PLANTILLAS
 *
 *  Son la única forma de escribirle a alguien fuera de la ventana de 24 horas:
 *  avisarle que su pedido salió, recordarle un carrito, una promoción. Meta las
 *  revisa una por una antes de aprobarlas.
 *
 *  Vive acá y no en Routes/whatsappTemplates.js: aquellas son el texto del
 *  enlace wa.me del menú, que no tiene nada que ver con esto.
 * ───────────────────────────────────────────── */

/** Las plantillas de la cuenta, con su estado de aprobación. */
async function listarPlantillas({ wabaId, accessToken }) {
  const data = await graph(
    `${wabaId}/message_templates?fields=name,status,category,language,components,rejected_reason&limit=100`,
    { token: accessToken, method: 'GET' },
  );
  return (data?.data || []).map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,             // APPROVED | PENDING | REJECTED
    category: p.category,
    language: p.language,
    motivoRechazo: p.rejected_reason || '',
    cuerpo: (p.components || []).find((c) => c.type === 'BODY')?.text || '',
  }));
}

/**
 * Crea una plantilla y la manda a revisión de Meta.
 *
 * `nombre` solo admite minúsculas, números y guion bajo — Meta rechaza
 * cualquier otra cosa, y el error que devuelve no lo explica.
 *
 * Las variables van como {{1}}, {{2}}… y hay que darle un ejemplo de cada una:
 * sin ejemplos la rechaza sin decir por qué.
 */
async function crearPlantilla({ wabaId, accessToken, nombre, categoria, idioma, cuerpo, ejemplos }) {
  const limpio = String(nombre || '').toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 60);
  if (!limpio) {
    const e = new Error('La plantilla necesita un nombre'); e.code = 'SIN_NOMBRE'; throw e;
  }

  const body = { type: 'BODY', text: String(cuerpo || '').trim() };
  if (Array.isArray(ejemplos) && ejemplos.length) {
    body.example = { body_text: [ejemplos.map((v) => String(v).slice(0, 60))] };
  }

  const data = await graph(`${wabaId}/message_templates`, {
    token: accessToken,
    body: {
      name: limpio,
      category: categoria || 'UTILITY',   // UTILITY | MARKETING | AUTHENTICATION
      language: idioma || 'es',
      components: [body],
    },
  });

  return { id: data?.id, name: limpio, status: data?.status || 'PENDING' };
}

async function borrarPlantilla({ wabaId, accessToken, nombre }) {
  await graph(`${wabaId}/message_templates?name=${encodeURIComponent(nombre)}`, {
    token: accessToken, method: 'DELETE',
  });
  return { ok: true };
}

/**
 * Envía una plantilla ya aprobada. Es lo que permite escribir fuera de la
 * ventana de 24 horas.
 */
async function enviarPlantilla({ account, to, nombre, idioma, variables }) {
  const phone = normalizePhone(to);
  if (!phone) {
    const e = new Error('Número de destino inválido'); e.code = 'BAD_PHONE'; throw e;
  }

  const componentes = Array.isArray(variables) && variables.length
    ? [{ type: 'body', parameters: variables.map((v) => ({ type: 'text', text: String(v) })) }]
    : undefined;

  const data = await graph(`${account.phoneNumberId}/messages`, {
    token: account.getAccessToken(),
    body: {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: nombre,
        language: { code: idioma || 'es' },
        ...(componentes ? { components: componentes } : {}),
      },
    },
  });

  const wamid = data?.messages?.[0]?.id;
  if (!wamid) throw new Error('Meta no devolvió el identificador del mensaje');

  /* Queda en la bandeja como cualquier otro mensaje: si no, el negocio ve una
     conversación donde él escribió algo que no aparece por ningún lado. */
  return WhatsAppMessage.create({
    businessId: account.businessId,
    accountId: account._id,
    wamid,
    direction: 'out',
    contactPhone: phone,
    type: 'text',
    text: `[plantilla: ${nombre}]${variables?.length ? ` ${variables.join(' · ')}` : ''}`,
    status: 'sent',
    sentAt: new Date(),
  });
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
  subscribeAppToWaba,
  listarPlantillas,
  crearPlantilla,
  borrarPlantilla,
  enviarPlantilla,
  markAsRead,
  SERVICE_WINDOW_MS,
  GRAPH_BASE
};
