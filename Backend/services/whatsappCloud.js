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

  /* Se avisa a los paneles abiertos. Importa sobre todo cuando contesta el
     agente: nadie tocó nada en el panel, así que sin este aviso su respuesta
     no aparecía hasta el siguiente refresco. Un fallo del socket no puede
     tumbar un envío que Meta ya aceptó, de ahí el try. */
  try {
    require('./socketService').emitToBusiness(String(account.businessId), 'whatsapp:mensaje', {
      contactPhone: phone,
      direction: 'out',
    });
  } catch { /* el refresco periódico queda de red de seguridad */ }

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
 *  REGISTRO INTEGRADO (Embedded Signup)
 *
 *  Es lo que convierte "cada negocio con su número" en algo vendible. Hoy el
 *  restaurante tendría que crear una cuenta de Meta Business, una WABA, dar de
 *  alta su número, verificarlo y generar un token con dos permisos concretos.
 *  Eso no lo hace un dueño de restaurante: lo termina haciendo uno por cada
 *  cliente, y ahí el negocio deja de escalar.
 *
 *  Con esto, el cliente abre un enlace, entra con su Facebook, y vuelve
 *  conectado.
 * ───────────────────────────────────────────── */

/**
 * Canjea el código que devuelve Meta por un token de acceso del cliente.
 */
async function canjearCodigo(code) {
  const appId = process.env.WHATSAPP_APP_ID;
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appId || !appSecret) throw new Error('Faltan WHATSAPP_APP_ID o WHATSAPP_APP_SECRET');

  const url = `${GRAPH_BASE}/oauth/access_token`
    + `?client_id=${encodeURIComponent(appId)}`
    + `&client_secret=${encodeURIComponent(appSecret)}`
    + `&code=${encodeURIComponent(code)}`;

  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    throw new Error(data?.error?.message || 'Meta no devolvió el token');
  }
  return data.access_token;
}

/**
 * Averigua a qué cuenta de WhatsApp dio acceso el cliente.
 *
 * El token no dice de quién es: hay que preguntarle a Meta qué permisos
 * concedió y sobre qué cuentas. Eso viene en `granular_scopes`.
 */
async function cuentaDelToken(accessToken) {
  const appId = process.env.WHATSAPP_APP_ID;
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  const res = await fetch(
    `${GRAPH_BASE}/debug_token?input_token=${encodeURIComponent(accessToken)}`
    + `&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`,
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || 'No se pudo leer el token');

  const scopes = data?.data?.granular_scopes || [];
  const gestion = scopes.find((s) => s.scope === 'whatsapp_business_management');
  const wabaId = gestion?.target_ids?.[0];
  if (!wabaId) {
    throw new Error('El cliente no autorizó ninguna cuenta de WhatsApp Business');
  }

  // De la cuenta salen sus números; se toma el primero, que es el caso normal.
  const numeros = await graph(`${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`, {
    token: accessToken, method: 'GET',
  });
  const numero = numeros?.data?.[0];
  if (!numero?.id) throw new Error('La cuenta autorizada no tiene ningún número');

  return {
    wabaId,
    phoneNumberId: numero.id,
    displayNumber: numero.display_phone_number || '',
    verifiedName: numero.verified_name || '',
  };
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

/* ── Archivos: fotos, audios, documentos ── */

/**
 * Los tipos que Meta acepta y que sabemos pintar en la bandeja.
 *
 * El WebP va en `sticker` y no en `image` a propósito: Meta solo admite JPEG y
 * PNG como imagen, y un WebP mandado como imagen lo rechaza. Como sticker sí
 * lo acepta —es justo el formato que usa para ellos.
 */
const TIPOS_ARCHIVO = {
  image: ['image/jpeg', 'image/png'],
  sticker: ['image/webp'],
  video: ['video/mp4', 'video/3gpp'],
  audio: ['audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/amr', 'audio/ogg'],
  document: null,   // cualquiera
};

/* El pie de foto solo existe en estos tres. En audio y en sticker, Meta
   rechaza el mensaje entero si se manda el campo. */
const ADMITEN_PIE = ['image', 'video', 'document'];

function tipoDeArchivo(mimeType) {
  const m = String(mimeType || '').toLowerCase().split(';')[0];
  for (const [tipo, permitidos] of Object.entries(TIPOS_ARCHIVO)) {
    if (permitidos && permitidos.includes(m)) return tipo;
  }
  return 'document';
}

/**
 * Baja un archivo que mandó un cliente.
 *
 * Son dos viajes, no uno: Meta primero da una URL temporal y esa URL además
 * exige el token, así que el navegador no puede pedirla directamente. Por eso
 * pasa por el servidor.
 */
async function obtenerMedio(account, mediaId) {
  const token = account.getAccessToken();
  const meta = await graph(String(mediaId), { token, method: 'GET' });
  if (!meta?.url) {
    const e = new Error('Meta no devolvió la dirección del archivo'); e.code = 'SIN_URL'; throw e;
  }

  const res = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const e = new Error(`No se pudo bajar el archivo (${res.status})`); e.status = res.status; throw e;
  }
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    mimeType: meta.mime_type || 'application/octet-stream',
    fileName: meta.file_name || '',
    size: Number(meta.file_size) || 0,
  };
}

/**
 * Sube un archivo a Meta y devuelve su identificador.
 *
 * Este endpoint NO acepta JSON: va como formulario, así que no puede usar el
 * ayudante `graph`.
 */
async function subirMedio(account, { buffer, mimeType, fileName }) {
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', mimeType);
  form.append('file', new Blob([buffer], { type: mimeType }), fileName || 'archivo');

  const res = await fetch(`${GRAPH_BASE}/${account.phoneNumberId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${account.getAccessToken()}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.id) {
    const e = new Error(data?.error?.message || `Meta rechazó el archivo (${res.status})`);
    e.status = res.status;
    throw e;
  }
  return data.id;
}

/**
 * Manda un archivo al cliente y lo deja registrado en la bandeja.
 *
 * Misma regla que el texto: se guarda DESPUÉS de que Meta confirma, con el
 * wamid que devuelve, para que no quede un "enviado" que nunca salió.
 */
async function sendMedia({ account, to, buffer, mimeType, fileName, caption, sentBy }) {
  const phone = normalizePhone(to);
  if (!phone) {
    const e = new Error('Número de destino inválido'); e.code = 'BAD_PHONE'; throw e;
  }
  if (!buffer?.length) {
    const e = new Error('El archivo va vacío'); e.code = 'EMPTY'; throw e;
  }

  if (!(await isWithinServiceWindow(account.businessId, phone))) {
    const e = new Error(
      'Pasaron más de 24 horas desde el último mensaje del cliente. '
      + 'Meta solo permite retomar la conversación con una plantilla aprobada.'
    );
    e.code = 'OUTSIDE_WINDOW';
    throw e;
  }

  const tipo = tipoDeArchivo(mimeType);
  const mediaId = await subirMedio(account, { buffer, mimeType, fileName });
  const pie = String(caption || '').trim().slice(0, 1024);

  const contenido = { id: mediaId };
  if (pie && ADMITEN_PIE.includes(tipo)) contenido.caption = pie;
  if (tipo === 'document' && fileName) contenido.filename = fileName;

  const data = await graph(`${account.phoneNumberId}/messages`, {
    token: account.getAccessToken(),
    body: {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: tipo,
      [tipo]: contenido,
    },
  });

  const wamid = data?.messages?.[0]?.id;
  if (!wamid) throw new Error('Meta no devolvió el identificador del mensaje');

  const guardado = await WhatsAppMessage.create({
    businessId: account.businessId,
    accountId: account._id,
    wamid,
    direction: 'out',
    contactPhone: phone,
    type: tipo,
    // Solo se guarda como pie lo que de verdad viajó como pie.
    text: ADMITEN_PIE.includes(tipo) ? pie : '',
    mediaId,
    mediaMimeType: mimeType,
    status: 'sent',
    sentBy: sentBy || null,
    sentAt: new Date(),
  });

  /* Si el tipo no admite pie pero había texto escrito, se manda aparte en vez
     de tirarlo. Perder en silencio lo que alguien escribió es peor que mandar
     dos mensajes — y es lo mismo que hace WhatsApp con un sticker y un
     comentario. */
  if (pie && !ADMITEN_PIE.includes(tipo)) {
    await sendText({ account, to: phone, text: pie, sentBy }).catch(() => {});
  }

  try {
    require('./socketService').emitToBusiness(String(account.businessId), 'whatsapp:mensaje', {
      contactPhone: phone,
      direction: 'out',
    });
  } catch { /* el refresco periódico queda de red de seguridad */ }

  return guardado;
}

module.exports = {
  normalizePhone,
  isWithinServiceWindow,
  sendText,
  obtenerMedio,
  sendMedia,
  tipoDeArchivo,
  verifyCredentials,
  subscribeAppToWaba,
  canjearCodigo,
  cuentaDelToken,
  listarPlantillas,
  crearPlantilla,
  borrarPlantilla,
  enviarPlantilla,
  markAsRead,
  SERVICE_WINDOW_MS,
  GRAPH_BASE
};
