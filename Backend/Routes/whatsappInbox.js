/**
 * Bandeja de WhatsApp — webhook de Meta + API del panel.
 *
 * Meta manda TODOS los webhooks de la app a esta única URL, de todos los
 * negocios. Lo que separa a uno de otro es `metadata.phone_number_id`, que se
 * busca en WhatsAppAccount para resolver el businessId. Ese es el enrutador
 * multi-tenant completo: sin él, los chats de un restaurante aparecerían en el
 * panel de otro.
 */
const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');
const WhatsAppAccount = require('../Models/WhatsAppAccount');
const WhatsAppMessage = require('../Models/WhatsAppMessage');
const whatsappCloud = require('../services/whatsappCloud');
const { businessHasFeature } = require('../utils/subscriptionHelper');
const { isConfigured } = require('../utils/secretBox');

const FEATURE = 'whatsappInbox';

/* ─────────────────────────────────────────────
 *  WEBHOOK (público — lo llama Meta, no nuestro frontend)
 * ───────────────────────────────────────────── */

/**
 * Verificación inicial: Meta hace un GET con un token que definimos nosotros.
 */
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    logger.info('[WhatsApp] Webhook verificado por Meta');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

/**
 * Comprueba que el webhook viene de Meta y no de cualquiera.
 *
 * La firma se calcula sobre el cuerpo CRUDO: si se usara el JSON ya parseado y
 * vuelto a serializar, cualquier diferencia de orden o espacios daría un HMAC
 * distinto y todo fallaría. server.js guarda el buffer en `req.rawBody` solo
 * para esta ruta.
 *
 * Sin esto, cualquiera podría inyectar mensajes en el panel de cualquier
 * negocio con un simple POST.
 */
function firmaValida(req) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) return false;

  const recibida = req.get('X-Hub-Signature-256') || '';
  if (!recibida.startsWith('sha256=') || !req.rawBody) return false;

  const esperada = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(req.rawBody)
    .digest('hex');

  const a = Buffer.from(recibida);
  const b = Buffer.from(esperada);
  // Comparación en tiempo constante: `===` filtraría el secreto por tiempos.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.post('/webhook', asyncHandler(async (req, res) => {
  if (!firmaValida(req)) {
    logger.warn('[WhatsApp] Webhook con firma inválida — descartado');
    return res.sendStatus(403);
  }

  /* Se responde 200 de una vez y se procesa después. Meta reintenta si tardamos,
     y cada reintento sería trabajo repetido; la deduplicación por wamid nos
     cubre igual, pero es mejor no provocarla. */
  res.sendStatus(200);

  try {
    for (const entry of req.body?.entry || []) {
      for (const change of entry.changes || []) {
        await procesarCambio(change.value || {});
      }
    }
  } catch (e) {
    logger.error('[WhatsApp] Error procesando webhook', { error: e.message });
  }
}));

/* Todo lo que venga del payload se convierte a texto antes de usarlo en una
   consulta. Esta ruta se salta el saneador de Mongo (ver server.js), así que un
   objeto donde se espera una cadena podría convertirse en un operador y hacer
   que la búsqueda coincida con documentos que no son. */
const aTexto = (v) => (v === null || v === undefined ? '' : String(v));

async function procesarCambio(value) {
  const phoneNumberId = aTexto(value?.metadata?.phone_number_id);
  if (!phoneNumberId) return;

  // El enrutador: de un número de Meta al negocio dueño.
  const account = await WhatsAppAccount.findOne({ phoneNumberId });
  if (!account) {
    logger.warn('[WhatsApp] Llegó un mensaje de un número que nadie reclamó', { phoneNumberId });
    return;
  }

  const nombres = {};
  for (const c of value.contacts || []) {
    if (c?.wa_id) nombres[aTexto(c.wa_id)] = aTexto(c?.profile?.name);
  }

  // ── Mensajes entrantes ──
  for (const msg of value.messages || []) {
    await guardarEntrante(account, msg, nombres[aTexto(msg.from)] || '');
  }

  // ── Acuses de entrega de lo que mandamos ──
  for (const st of value.statuses || []) {
    const permitidos = ['sent', 'delivered', 'read', 'failed'];
    if (!permitidos.includes(st.status)) continue;
    await WhatsAppMessage.updateOne(
      { wamid: aTexto(st.id) },
      {
        $set: {
          status: st.status,
          errorMessage: st.errors?.[0]?.title || ''
        }
      }
    );
  }
}

const TIPOS_CON_MEDIO = ['image', 'audio', 'video', 'document', 'sticker'];

/**
 * Traduce un mensaje de Meta a los campos que guardamos.
 *
 * Va aparte para poder probarse sin base de datos: cuando estaba embebido, un
 * error tan tonto como una variable local que tapaba a una función solo se
 * descubrió mandando un WhatsApp de verdad.
 */
function interpretarMensaje(msg) {
  const tipo = WhatsAppMessage.schema.path('type').enumValues.includes(msg?.type)
    ? msg.type
    : 'unsupported';

  let cuerpo = '';
  if (msg?.type === 'text') cuerpo = msg.text?.body || '';
  else if (msg?.type === 'button') cuerpo = msg.button?.text || '';
  else if (msg?.type === 'interactive') {
    cuerpo = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '';
  } else if (TIPOS_CON_MEDIO.includes(msg?.type)) {
    cuerpo = msg[msg.type]?.caption || '';
  } else if (msg?.type === 'location') {
    const l = msg.location || {};
    cuerpo = [l.name, l.address].filter(Boolean).join(' — ');
  }

  const medio = TIPOS_CON_MEDIO.includes(msg?.type) ? msg[msg.type] : null;

  return {
    wamid: aTexto(msg?.id),
    contactPhone: aTexto(msg?.from),
    type: tipo,
    text: aTexto(cuerpo).slice(0, 8000),
    mediaId: medio?.id || null,
    mediaMimeType: medio?.mime_type || '',
    sentAt: msg?.timestamp ? new Date(Number(msg.timestamp) * 1000) : new Date()
  };
}

async function guardarEntrante(account, msg, contactName) {
  try {
    await WhatsAppMessage.create({
      businessId: account.businessId,
      accountId: account._id,
      direction: 'in',
      contactName,
      status: 'delivered',
      ...interpretarMensaje(msg)
    });
  } catch (e) {
    /* 11000 = el mismo mensaje ya estaba. Es lo esperado cuando Meta reintenta,
       no un error: se ignora en silencio. */
    if (e.code !== 11000) throw e;
    return;
  }

  await WhatsAppAccount.updateOne({ _id: account._id }, { $set: { lastInboundAt: new Date() } });
}

/* ─────────────────────────────────────────────
 *  API DEL PANEL (autenticada + con el complemento contratado)
 * ───────────────────────────────────────────── */

/** Resuelve el negocio del usuario y exige que tenga el complemento activo. */
const requiereComplemento = asyncHandler(async (req, res, next) => {
  const businessId = req.user?.businessId || req.query.businessId || req.body?.businessId;
  if (!businessId) {
    return res.status(400).json({ message: 'Falta el negocio' });
  }
  if (!(await businessHasFeature(businessId, FEATURE))) {
    return res.status(402).json({
      message: 'La bandeja de WhatsApp es un complemento que tu negocio aún no tiene activo.',
      code: 'ADDON_REQUIRED',
      addon: 'whatsapp_inbox'
    });
  }
  req.businessId = businessId;
  next();
});

/** GET /api/whatsapp-inbox/account — cómo está conectado el número. */
router.get('/account', authMiddleware, requiereComplemento, asyncHandler(async (req, res) => {
  const account = await WhatsAppAccount.findOne({ businessId: req.businessId });
  res.json({ account: account ? account.toPanel() : null, secretsReady: isConfigured() });
}));

/** POST /api/whatsapp-inbox/account — conecta o actualiza el número del negocio. */
router.post('/account', authMiddleware, requiereComplemento, asyncHandler(async (req, res) => {
  const { phoneNumberId, wabaId, accessToken } = req.body || {};
  if (!phoneNumberId || !accessToken) {
    return res.status(400).json({ message: 'Faltan el identificador del número y el token' });
  }
  if (!isConfigured()) {
    return res.status(503).json({
      message: 'El servidor no tiene configurada la llave para guardar secretos (SECRET_BOX_KEY).'
    });
  }

  /* Un número no puede pertenecer a dos negocios: sin este chequeo, uno podría
     reclamar el número de otro y quedarse con sus conversaciones. */
  const ajeno = await WhatsAppAccount.findOne({
    phoneNumberId: String(phoneNumberId).trim(),
    businessId: { $ne: req.businessId }
  });
  if (ajeno) {
    return res.status(409).json({ message: 'Ese número ya está conectado a otro negocio.' });
  }

  // Se valida contra Meta antes de guardar nada.
  let datos;
  try {
    datos = await whatsappCloud.verifyCredentials({
      phoneNumberId: String(phoneNumberId).trim(),
      accessToken: String(accessToken).trim()
    });
  } catch (e) {
    return res.status(400).json({ message: `Meta rechazó las credenciales: ${e.message}` });
  }

  /* Sin este paso la conexión queda a medias en silencio: la WABA tiene que
     autorizar a nuestra app o Meta nunca manda los mensajes, por más que el
     webhook esté verificado y `messages` suscrito. */
  let avisoSuscripcion = '';
  try {
    await whatsappCloud.subscribeAppToWaba({
      wabaId: String(wabaId || '').trim(),
      accessToken: String(accessToken).trim()
    });
  } catch (e) {
    avisoSuscripcion = 'El número quedó conectado, pero no se pudo autorizar a MenuBy '
      + `a recibir los mensajes de esa cuenta (${e.message}). Sin eso no llegarán chats.`;
    logger.warn('[WhatsApp] No se pudo suscribir la app a la WABA', {
      businessId: String(req.businessId), wabaId, error: e.message
    });
  }

  const account = await WhatsAppAccount.findOne({ businessId: req.businessId })
    || new WhatsAppAccount({ businessId: req.businessId });

  account.phoneNumberId = String(phoneNumberId).trim();
  account.wabaId = String(wabaId || '').trim();
  account.displayNumber = datos.displayNumber;
  account.verifiedName = datos.verifiedName;
  account.setAccessToken(accessToken);
  account.status = 'active';
  account.lastError = '';
  account.connectedVia = 'manual';
  account.connectedBy = req.user?.id || null;
  account.connectedAt = new Date();
  await account.save();

  logger.info('[WhatsApp] Número conectado', {
    businessId: String(req.businessId), phoneNumberId: account.phoneNumberId
  });
  res.json({ account: account.toPanel(), warning: avisoSuscripcion || undefined });
}));

/** DELETE /api/whatsapp-inbox/account — desconecta el número. */
router.delete('/account', authMiddleware, requiereComplemento, asyncHandler(async (req, res) => {
  await WhatsAppAccount.deleteOne({ businessId: req.businessId });
  res.json({ success: true });
}));

/** GET /api/whatsapp-inbox/chats — un renglón por contacto, el más reciente arriba. */
router.get('/chats', authMiddleware, requiereComplemento, asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const { Types } = require('mongoose');

  const chats = await WhatsAppMessage.aggregate([
    { $match: { businessId: new Types.ObjectId(String(req.businessId)) } },
    { $sort: { sentAt: -1 } },
    {
      $group: {
        _id: '$contactPhone',
        contactName: { $first: '$contactName' },
        lastText: { $first: '$text' },
        lastType: { $first: '$type' },
        lastDirection: { $first: '$direction' },
        lastAt: { $first: '$sentAt' },
        sinLeer: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$direction', 'in'] }, { $eq: ['$readByStaffAt', null] }] },
              1, 0
            ]
          }
        }
      }
    },
    { $sort: { lastAt: -1 } },
    { $limit: limit }
  ]);

  res.json({ chats: chats.map((c) => ({ ...c, contactPhone: c._id })) });
}));

/** GET /api/whatsapp-inbox/chats/:phone — la conversación. */
router.get('/chats/:phone', authMiddleware, requiereComplemento, asyncHandler(async (req, res) => {
  const contactPhone = whatsappCloud.normalizePhone(req.params.phone);
  if (!contactPhone) return res.status(400).json({ message: 'Número inválido' });

  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const mensajes = await WhatsAppMessage
    .find({ businessId: req.businessId, contactPhone })
    .sort({ sentAt: -1 })
    .limit(limit)
    .lean();

  await WhatsAppMessage.updateMany(
    { businessId: req.businessId, contactPhone, direction: 'in', readByStaffAt: null },
    { $set: { readByStaffAt: new Date() } }
  );

  res.json({
    contactPhone,
    // Se devuelve en orden cronológico, que es como se lee un chat.
    messages: mensajes.reverse(),
    canReply: await whatsappCloud.isWithinServiceWindow(req.businessId, contactPhone)
  });
}));

/**
 * GET /api/whatsapp-inbox/chats/:phone/context — quién es quien está escribiendo.
 *
 * Es lo que separa esta bandeja de tener WhatsApp abierto en otra pestaña: al
 * responder se ve si es un cliente de siempre, cuánto ha gastado, qué pidió la
 * última vez y si tiene un pedido en curso ahora mismo.
 */
router.get('/chats/:phone/context', authMiddleware, requiereComplemento, asyncHandler(async (req, res) => {
  const telefono = whatsappCloud.normalizePhone(req.params.phone);
  if (!telefono) return res.status(400).json({ message: 'Número inválido' });

  const Customer = require('../Models/Customer');
  const Order = require('../Models/Order');
  const CompletedOrder = require('../Models/CompletedOrder');
  const CustomerLoyalty = require('../Models/CustomerLoyalty');
  const { variantesDeTelefono } = require('../utils/phoneVariants');

  /* El mismo número está escrito de varias formas según la colección, así que
     se buscan todas. Ver utils/phoneVariants. */
  const posibles = variantesDeTelefono(telefono);
  const deEsteNegocio = { businessId: req.businessId, phone: { $in: posibles } };

  const [cliente, enCurso, completados, fidelidad] = await Promise.all([
    Customer.findOne(deEsteNegocio).lean(),
    Order.find(deEsteNegocio).sort({ createdAt: -1 }).limit(5)
      .select('orderNumber status orderType totalAmount deliveryFee createdAt items').lean(),
    CompletedOrder.find(deEsteNegocio).sort({ completedAt: -1 }).limit(5)
      .select('orderNumber status orderType totalAmount deliveryFee completedAt createdAt items').lean(),
    CustomerLoyalty.findOne(deEsteNegocio).select('points totalEarned currentTier').lean(),
  ]);

  const resumen = (o) => ({
    _id: o._id,
    orderNumber: o.orderNumber,
    status: o.status,
    orderType: o.orderType,
    total: (Number(o.totalAmount) || 0) + (Number(o.deliveryFee) || 0),
    fecha: o.completedAt || o.createdAt,
    items: (o.items || []).slice(0, 4).map((i) => `${i.quantity || 1}× ${i.name}`),
    masItems: Math.max(0, (o.items || []).length - 4),
  });

  /* El gasto total sale de la ficha del cliente si existe; si no, se suma lo
     que se encuentre, avisando que es parcial para no dar una cifra como si
     fuera el histórico completo. */
  const historico = [...enCurso, ...completados]
    .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt));

  res.json({
    contactPhone: telefono,
    esConocido: !!cliente || historico.length > 0,
    cliente: cliente ? {
      name: cliente.name,
      address: cliente.address,
      totalOrders: cliente.totalOrders,
      totalSpent: cliente.totalSpent,
      lastOrderDate: cliente.lastOrderDate,
    } : null,
    fidelidad: fidelidad || null,
    pedidosEnCurso: enCurso.map(resumen),
    ultimosPedidos: historico.slice(0, 5).map(resumen),
    totalMostrado: historico.length,
  });
}));

/** POST /api/whatsapp-inbox/chats/:phone — responder. */
router.post('/chats/:phone', authMiddleware, requiereComplemento, asyncHandler(async (req, res) => {
  const account = await WhatsAppAccount.findOne({ businessId: req.businessId, status: 'active' });
  if (!account) {
    return res.status(400).json({ message: 'El negocio no tiene un número de WhatsApp conectado.' });
  }

  try {
    const mensaje = await whatsappCloud.sendText({
      account,
      to: req.params.phone,
      text: req.body?.text,
      sentBy: req.user?.id
    });
    await WhatsAppAccount.updateOne({ _id: account._id }, { $set: { lastOutboundAt: new Date() } });
    res.status(201).json({ message: mensaje });
  } catch (e) {
    if (e.code === 'OUTSIDE_WINDOW') {
      return res.status(409).json({ message: e.message, code: e.code });
    }
    if (e.code === 'BAD_PHONE' || e.code === 'EMPTY') {
      return res.status(400).json({ message: e.message, code: e.code });
    }
    logger.error('[WhatsApp] Falló el envío', { error: e.message, businessId: String(req.businessId) });
    await WhatsAppAccount.updateOne(
      { _id: account._id },
      { $set: { lastError: e.message, status: e.status === 401 ? 'error' : account.status } }
    );
    res.status(502).json({ message: `No se pudo enviar: ${e.message}` });
  }
}));

module.exports = router;
// Expuesto solo para poder probarlo sin base de datos.
module.exports.interpretarMensaje = interpretarMensaje;
