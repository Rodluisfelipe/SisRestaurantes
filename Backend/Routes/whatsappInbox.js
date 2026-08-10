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
    const guardado = await guardarEntrante(account, msg, nombres[aTexto(msg.from)] || '');
    // Solo se contesta lo que se acaba de guardar: si era un reintento de Meta,
    // guardarEntrante devuelve null y el agente no responde dos veces.
    if (guardado) {
      avisarAlPanel(account.businessId, 'whatsapp:mensaje', {
        contactPhone: guardado.contactPhone,
        direction: 'in',
      });
      // Una nota de voz se pasa a texto antes de que nadie la lea.
      await quizaTranscribir(account, guardado);

      /* El dueño preguntando por su negocio va primero: si su número está
         autorizado, no se le trata como a un cliente que quiere pedir. Sin
         este orden, "cuánto vendimos hoy" acabaría en el agente de ventas
         intentando venderle una hamburguesa a su propio dueño. */
      const respondido = await quizaRespondaElAsistente(account, guardado);
      if (!respondido) await quizaContesteElAgente(account, guardado);
    }
  }

  // ── Acuses de entrega de lo que mandamos ──
  for (const st of value.statuses || []) {
    const permitidos = ['sent', 'delivered', 'read', 'failed'];
    if (!permitidos.includes(st.status)) continue;
    const r = await WhatsAppMessage.updateOne(
      { wamid: aTexto(st.id) },
      {
        $set: {
          status: st.status,
          errorMessage: st.errors?.[0]?.title || ''
        }
      }
    );
    /* Solo si de verdad cambió algo: Meta manda 'sent', 'delivered' y 'read'
       del mismo mensaje, y sin este filtro cada acuse dispararía un refresco
       del panel para pintar un chulo. */
    if (r.modifiedCount) {
      avisarAlPanel(account.businessId, 'whatsapp:estado', { wamid: aTexto(st.id), status: st.status });
    }
  }
}

/**
 * Avisar al panel de que pasó algo, por socket.
 *
 * Sin esto la bandeja solo se enteraba cuando le tocaba volver a preguntar
 * —cada quince segundos—, así que un mensaje podía pasar un cuarto de minuto
 * sin que nadie lo viera. Va envuelto en try porque un fallo del socket no
 * puede tumbar el webhook: si el aviso se pierde, el refresco periódico sigue
 * ahí de red de seguridad.
 */
function avisarAlPanel(businessId, evento, datos) {
  try {
    require('../services/socketService').emitToBusiness(String(businessId), evento, datos);
  } catch (e) {
    logger.warn('[WhatsApp] No se pudo avisar al panel', { error: e.message, evento });
  }
}

const TIPOS_CON_MEDIO = ['image', 'audio', 'video', 'document', 'sticker'];

const { motivoDeMeta } = require('../utils/motivosWhatsApp');

/**
 * Traduce un mensaje de Meta a los campos que guardamos.
 *
 * Va aparte para poder probarse sin base de datos: cuando estaba embebido, un
 * error tan tonto como una variable local que tapaba a una función solo se
 * descubrió mandando un WhatsApp de verdad.
 */
function interpretarMensaje(msg) {
  const conocido = WhatsAppMessage.schema.path('type').enumValues.includes(msg?.type);
  const tipo = conocido ? msg.type : 'unsupported';

  /* Cuando llega algo que no manejamos hay que dejar constancia de QUÉ era.
     Sin esto, un mensaje que no aparece en la bandeja es un misterio sin
     forma de investigarlo: en la base queda 'unsupported' y nada más.

     Se registra también cuando el tipo ES 'unsupported', y no solo cuando no
     lo reconocemos: 'unsupported' está en nuestra lista, así que ese caso
     pasaba por bueno en silencio. Y resulta que es el propio Meta el que
     manda ese tipo, con un `errors` que explica el motivo — justo lo que
     hacía falta saber. */
  if (!conocido || msg?.type === 'unsupported') {
    logger.warn('[WhatsApp] Mensaje que no se puede mostrar', {
      tipo: msg?.type || '(sin tipo)',
      campos: Object.keys(msg || {}).join(','),
      // Aquí viene el código y el título de Meta: el motivo exacto.
      errores: JSON.stringify(msg?.errors || []).slice(0, 400),
      muestra: JSON.stringify(msg?.[msg?.type] || {}).slice(0, 300),
    });
  }

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
  } else if (msg?.type === 'reaction') {
    /* Una reacción es un emoji sobre un mensaje anterior, no un mensaje con
       contenido. Sin esto quedaba una burbuja vacía en la conversación. */
    cuerpo = msg.reaction?.emoji ? `Reaccionó ${msg.reaction.emoji}` : 'Quitó su reacción';
  }

  const medio = TIPOS_CON_MEDIO.includes(msg?.type) ? msg[msg.type] : null;

  return {
    wamid: aTexto(msg?.id),
    contactPhone: aTexto(msg?.from),
    type: tipo,
    text: aTexto(cuerpo).slice(0, 8000),
    mediaId: medio?.id || null,
    mediaMimeType: medio?.mime_type || '',
    /* El motivo que da Meta cuando no entrega el contenido. Guardarlo permite
       decirle a quien atiende por qué no ve nada, en vez de dejar una burbuja
       muda que parece un fallo nuestro. */
    errorMessage: motivoDeMeta(msg?.errors?.[0]),
    sentAt: msg?.timestamp ? new Date(Number(msg.timestamp) * 1000) : new Date()
  };
}

async function guardarEntrante(account, msg, contactName) {
  let guardado;
  try {
    guardado = await WhatsAppMessage.create({
      businessId: account.businessId,
      accountId: account._id,
      direction: 'in',
      contactName,
      status: 'delivered',
      ...interpretarMensaje(msg)
    });
  } catch (e) {
    /* 11000 = el mismo mensaje ya estaba. Es lo esperado cuando Meta reintenta,
       no un error: se ignora en silencio. Se devuelve null para que el agente
       no vuelva a contestar el mismo mensaje. */
    if (e.code !== 11000) throw e;
    return null;
  }

  await WhatsAppAccount.updateOne({ _id: account._id }, { $set: { lastInboundAt: new Date() } });
  return guardado;
}

/**
 * Deja que el agente conteste, si el negocio lo tiene contratado y encendido.
 *
 * El pedido se crea llamando a nuestra propia API en vez de escribir en la
 * colección: ahí viven la numeración, el descuento de stock, el alta del
 * cliente y los avisos por socket. Duplicar todo eso es como aparecen las
 * diferencias entre canales que ya arreglamos.
 */
/**
 * Pasa a texto la nota de voz que acaba de llegar.
 *
 * En Colombia mucha gente pide por audio. Hasta ahora el agente los ignoraba
 * en silencio: el cliente hablaba y no le contestaba nadie.
 *
 * La transcripción se guarda aparte del texto y se muta el mensaje en memoria
 * para que el agente, que viene justo después, la lea como si el cliente la
 * hubiera escrito.
 *
 * Nunca lanza: que falle transcribir no puede impedir que el audio quede en la
 * bandeja para que lo escuche una persona.
 */
async function quizaTranscribir(account, mensaje) {
  if (mensaje.type !== 'audio' || !mensaje.mediaId) return;

  try {
    // Solo si el agente va a usarla: bajar y transcribir cuesta, y sin agente
    // encendido nadie leería el resultado.
    if (!account.agente?.activo) return;
    if (!(await businessHasFeature(account.businessId, 'whatsappAgent'))) return;

    const archivo = await whatsappCloud.obtenerMedio(account, mensaje.mediaId);
    const { transcribir } = require('../services/whatsappAgent/transcribir');
    const texto = await transcribir({ buffer: archivo.buffer, mimeType: archivo.mimeType });
    if (!texto) return;

    await WhatsAppMessage.updateOne({ _id: mensaje._id }, { $set: { transcripcion: texto } });
    mensaje.transcripcion = texto;

    avisarAlPanel(account.businessId, 'whatsapp:mensaje', {
      contactPhone: mensaje.contactPhone,
      direction: 'in',
    });
  } catch (e) {
    logger.warn('[WhatsApp] No se pudo transcribir la nota de voz', {
      error: e.message, businessId: String(account.businessId),
    });
  }
}

/**
 * Si escribe el dueño, se le informa en vez de venderle.
 *
 * Devuelve true si contestó, para que el agente de clientes no vuelva a
 * responder al mismo mensaje.
 *
 * No depende del complemento del agente ni de que esté encendido: consultar
 * tus propios datos no es lo mismo que tener un bot atendiendo clientes, y
 * cobrarlo junto habría dejado a medio mundo sin poder preguntar cuánto vendió.
 */
async function quizaRespondaElAsistente(account, mensaje) {
  const dicho = mensaje.text || mensaje.transcripcion;
  if (!dicho) return false;

  try {
    const asistente = require('../services/whatsappAdmin');
    const respuesta = await asistente.atender({
      account,
      contactPhone: mensaje.contactPhone,
      texto: dicho,
    });
    if (!respuesta) return false;

    if (mensaje.wamid) {
      whatsappCloud.markAsRead({ account, wamid: mensaje.wamid, escribiendo: true }).catch(() => {});
    }
    await whatsappCloud.sendText({ account, to: mensaje.contactPhone, text: respuesta });
    return true;
  } catch (e) {
    logger.error('[WhatsApp] Falló el asistente administrativo', {
      error: e.message, businessId: String(account.businessId),
    });
    /* Se devuelve true igual: el número es del dueño, y dejar que el agente de
       ventas le conteste a una pregunta de caja es peor que no contestar. */
    return true;
  }
}

async function quizaContesteElAgente(account, mensaje) {
  try {
    if (!account.agente?.activo) return;
    if (!(await businessHasFeature(account.businessId, 'whatsappAgent'))) return;
    /* Lo dicho en una nota de voz vale igual que lo escrito. Las fotos y los
       documentos siguen sin interpretarse. */
    const dicho = mensaje.text || mensaje.transcripcion;
    if (!dicho) return;

    /* Acuse de lectura y "escribiendo…", en la misma llamada.
       Va acá y no antes porque Meta pide no mostrar los puntitos si no se va a
       responder: en este punto ya se sabe que sí. Interpretar el mensaje tarda
       unos segundos, y sin esta señal el cliente cree que nadie lo leyó. */
    if (mensaje.wamid) {
      whatsappCloud.markAsRead({ account, wamid: mensaje.wamid, escribiendo: true })
        .catch(() => {});   // cosmético: nunca puede frenar la respuesta
    }

    const BusinessConfig = require('../Models/BusinessConfig');
    const negocio = await BusinessConfig.findById(account.businessId)
      .select('name businessName slug').lean();

    const agente = require('../services/whatsappAgent');
    const respuesta = await agente.atender({
      account,
      negocio: negocio?.name || negocio?.businessName || 'nuestro restaurante',
      // Con el slug el agente puede mandar al menú en vez de teclear el pedido.
      slug: negocio?.slug,
      texto: dicho,
      contactPhone: mensaje.contactPhone,
      reglas: account.agente?.reglas || '',
      crearOrden: (datos) => crearPedidoPorLaApi(account.businessId, datos),
    });

    if (respuesta) {
      /* No se manda de golpe: una respuesta instantánea y en un solo bloque es
         lo que más delata que no hay nadie del otro lado. Se escribe con una
         pausa proporcional al largo, y el acuse va aparte de la pregunta,
         como escribe cualquiera en WhatsApp. */
      const { enviarComoPersona } = require('../services/whatsappAgent/humanizar');
      await enviarComoPersona({
        respuesta,
        enviar: (texto) => whatsappCloud.sendText({ account, to: mensaje.contactPhone, text: texto }),
        // Los puntitos se caen al llegar un mensaje: hay que repetirlos.
        escribiendo: () => (mensaje.wamid
          ? whatsappCloud.markAsRead({ account, wamid: mensaje.wamid, escribiendo: true })
          : Promise.resolve()),
      });
    }
  } catch (e) {
    /* Sin cupo no es un error: es el tope que se le vendió. El mensaje ya está
       en la bandeja y el negocio puede responder a mano. Se deja constancia una
       sola vez por periodo para que se entere sin llenarle el registro. */
    if (e.code === 'SIN_CUPO') {
      const cupo = require('../services/whatsappAgent/cupo');
      const estado = cupo.estado(account);
      if (!account.agente.consumo.avisadoSinCupo) {
        account.agente.consumo.avisadoSinCupo = true;
        account.markModified('agente.consumo');
        await account.save().catch(() => {});
        logger.warn('[Agente] Cupo de conversaciones agotado', {
          businessId: String(account.businessId), ...estado,
        });
      }
      return;
    }

    /* Que el agente falle no puede tumbar la recepción del mensaje: ya quedó
       guardado y visible en la bandeja para que lo atienda una persona. */
    logger.error('[Agente] No se pudo atender el mensaje', {
      businessId: String(account.businessId), error: e.message,
    });

    /* Si Meta rechaza las credenciales, el negocio tiene que enterarse: el
       agente piensa la respuesta pero no puede enviarla, y sin esto la única
       señal sería que nadie contesta. Un token vencido dejaría la bandeja muda
       durante días sin que nada lo dijera. */
    if (e.status === 401 || /token|expired|OAuth/i.test(e.message || '')) {
      await WhatsAppAccount.updateOne(
        { _id: account._id },
        { $set: { status: 'error', lastError: `No se pudo responder: ${e.message}` } },
      ).catch(() => {});
    }
  }
}

async function crearPedidoPorLaApi(businessId, datos) {
  const jwtLib = require('jsonwebtoken');
  /* Token propio y de un minuto: es nuestro servidor llamándose a sí mismo,
     firmado con nuestro secreto. Sirve para no caer en los límites pensados
     para comensales sin abrir ninguna puerta trasera. */
  const token = jwtLib.sign(
    { id: String(businessId), role: 'system', businessId: String(businessId) },
    process.env.JWT_SECRET,
    { expiresIn: '1m' },
  );

  const puerto = process.env.PORT || 5000;
  const res = await fetch(`http://127.0.0.1:${puerto}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(datos),
  });

  const cuerpo = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(cuerpo?.message || `La API rechazó el pedido (${res.status})`);
  return cuerpo;
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

/* ─────────────────────────────────────────────
 *  REGISTRO INTEGRADO
 *
 *  El cliente abre un enlace, entra con su Facebook y vuelve conectado, sin
 *  ver nunca la consola de Meta ni copiar identificadores.
 * ───────────────────────────────────────────── */

/**
 * Firma el negocio dentro del `state` que viaja hasta Meta y vuelve.
 *
 * Sin firma, cualquiera podría cambiar el `state` por el id de otro negocio y
 * conectarle un número ajeno —o peor, robarle el suyo—. La firma sale del mismo
 * secreto del servidor, así que un state manipulado no valida.
 */
function firmarNegocio(businessId) {
  const dato = String(businessId);
  const firma = crypto.createHmac('sha256', process.env.JWT_SECRET)
    .update(dato).digest('hex').slice(0, 32);
  return `${dato}.${firma}`;
}

function leerNegocioFirmado(state) {
  const [dato, firma] = String(state || '').split('.');
  if (!dato || !firma) return null;
  const esperada = crypto.createHmac('sha256', process.env.JWT_SECRET)
    .update(dato).digest('hex').slice(0, 32);
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return dato;
}

/** GET /api/whatsapp-inbox/oauth/enlace — el enlace que se le manda al cliente. */
router.get('/oauth/enlace', authMiddleware, requiereComplemento, asyncHandler(async (req, res) => {
  const base = process.env.WHATSAPP_SIGNUP_URL;
  if (!base) {
    return res.status(503).json({
      message: 'Falta configurar el enlace de registro de Meta (WHATSAPP_SIGNUP_URL).',
    });
  }
  const sep = base.includes('?') ? '&' : '?';
  res.json({ enlace: `${base}${sep}state=${encodeURIComponent(firmarNegocio(req.businessId))}` });
}));

/**
 * GET /api/whatsapp-inbox/oauth/callback — a donde vuelve el cliente.
 *
 * Es público porque lo llama el navegador del cliente tras pasar por Meta; la
 * autenticación la da el `state` firmado, no una sesión nuestra.
 */
router.get('/oauth/callback', asyncHandler(async (req, res) => {
  const panel = process.env.FRONTEND_URL || 'https://menuby.tech';
  const volver = (estado, detalle) => res.redirect(
    `${panel}/whatsapp-conectado?estado=${estado}${detalle ? `&motivo=${encodeURIComponent(detalle)}` : ''}`,
  );

  const businessId = leerNegocioFirmado(req.query.state);
  if (!businessId) {
    logger.warn('[WhatsApp] Callback con state inválido');
    return volver('error', 'El enlace no es válido o fue alterado');
  }
  if (!req.query.code) {
    // El cliente cerró la ventana o rechazó los permisos.
    return volver('cancelado');
  }

  try {
    const token = await whatsappCloud.canjearCodigo(String(req.query.code));
    const datos = await whatsappCloud.cuentaDelToken(token);

    /* Un número pertenece a un solo negocio: sin esto, alguien podría conectar
       el número de otro y quedarse con sus conversaciones. */
    const ajeno = await WhatsAppAccount.findOne({
      phoneNumberId: datos.phoneNumberId, businessId: { $ne: businessId },
    });
    if (ajeno) return volver('error', 'Ese número ya está conectado a otro negocio');

    /* El paso invisible: sin autorizar la app en la cuenta, Meta nunca manda
       los mensajes por más que todo lo demás esté bien. */
    await whatsappCloud.subscribeAppToWaba({ wabaId: datos.wabaId, accessToken: token });

    const account = await WhatsAppAccount.findOne({ businessId })
      || new WhatsAppAccount({ businessId });
    account.phoneNumberId = datos.phoneNumberId;
    account.wabaId = datos.wabaId;
    account.displayNumber = datos.displayNumber;
    account.verifiedName = datos.verifiedName;
  account.nameStatus = datos.nameStatus || '';
    account.setAccessToken(token);
    account.status = 'active';
    account.lastError = '';
    account.connectedVia = 'embedded_signup';
    account.connectedAt = new Date();
    await account.save();

    logger.info('[WhatsApp] Número conectado por registro integrado', {
      businessId, phoneNumberId: datos.phoneNumberId,
    });
    return volver('ok');
  } catch (e) {
    logger.error('[WhatsApp] Falló el registro integrado', { businessId, error: e.message });
    return volver('error', e.message);
  }
}));

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
  account.nameStatus = datos.nameStatus || '';
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

/** PATCH /api/whatsapp-inbox/agente — enciende el agente y fija sus reglas. */
router.patch('/agente', authMiddleware, requiereComplemento, asyncHandler(async (req, res) => {
  const account = await WhatsAppAccount.findOne({ businessId: req.businessId });
  if (!account) return res.status(400).json({ message: 'Primero conecta tu número de WhatsApp.' });

  const { activo, reglas, soloEnHorario } = req.body || {};

  /* Encenderlo exige tenerlo contratado; apagarlo siempre se puede, para que
     nadie quede atrapado con un agente contestando que no puede detener. */
  if (activo && !(await businessHasFeature(req.businessId, 'whatsappAgent'))) {
    return res.status(402).json({
      message: 'El agente de IA es un complemento aparte que tu negocio aún no tiene activo.',
      code: 'ADDON_REQUIRED',
      addon: 'whatsapp_agent'
    });
  }

  account.agente = account.agente || {};
  if (activo !== undefined) account.agente.activo = !!activo;
  if (reglas !== undefined) account.agente.reglas = String(reglas).slice(0, 2000);
  if (soloEnHorario !== undefined) account.agente.soloEnHorario = !!soloEnHorario;
  await account.save();

  logger.info('[WhatsApp] Agente configurado', {
    businessId: String(req.businessId), activo: account.agente.activo,
  });
  res.json({ account: account.toPanel() });
}));

/**
 * POST /api/whatsapp-inbox/chats/:phone/retomar — que vuelva a atender una persona.
 *
 * Cuando alguien del negocio contesta a mano, el agente debe callarse: dos
 * voces respondiendo la misma conversación confunden al cliente.
 */
router.post('/chats/:phone/retomar', authMiddleware, requiereComplemento, asyncHandler(async (req, res) => {
  const telefono = whatsappCloud.normalizePhone(req.params.phone);
  if (!telefono) return res.status(400).json({ message: 'Número inválido' });

  const devolver = !!req.body?.devolverAlAgente;

  const WhatsAppAgentSession = require('../Models/WhatsAppAgentSession');
  await WhatsAppAgentSession.updateOne(
    { businessId: req.businessId, contactPhone: telefono },
    {
      $set: {
        estado: devolver ? 'activa' : 'con_humano',
        motivoTraspaso: devolver ? '' : 'lo tomó una persona del negocio',
        ultimaActividad: new Date(),
      },
    },
    { upsert: true },
  );

  /* Al devolverle el chat, el agente contesta lo que quedó sin responder.
     Sin esto, reactivarlo no hacía nada visible: el cliente ya había escrito
     y se quedaba esperando hasta que volviera a escribir. */
  let contestara = false;
  if (devolver) {
    const ultimo = await WhatsAppMessage
      .findOne({ businessId: req.businessId, contactPhone: telefono })
      .sort({ sentAt: -1 });

    // Solo si el último de la conversación es del cliente: si el último es
    // nuestro, ya se le contestó y no hay nada pendiente.
    if (ultimo && ultimo.direction === 'in') {
      const account = await WhatsAppAccount.findOne({ businessId: req.businessId, status: 'active' });
      if (account) {
        contestara = true;
        /* Sin await: interpretar y responder tarda segundos, y el botón del
           panel no puede quedarse colgado esperando. */
        quizaContesteElAgente(account, ultimo).catch((e) => {
          logger.warn('[WhatsApp] El agente no pudo retomar la conversación', { error: e.message });
        });
      }
    }
  }

  res.json({ success: true, estado: devolver ? 'activa' : 'con_humano', contestara });
}));

/* ─────────────────────────────────────────────
 *  PLANTILLAS
 *
 *  Son la única forma de escribirle a alguien fuera de la ventana de 24 horas:
 *  "tu pedido salió", "dejaste tu carrito". Meta las revisa una por una.
 *
 *  No confundir con Routes/whatsappTemplates.js, que es el texto del enlace
 *  wa.me del menú y no tiene relación con esto.
 * ───────────────────────────────────────────── */

/** Devuelve la cuenta conectada, o corta con un mensaje claro. */
async function cuentaConectada(req, res) {
  const account = await WhatsAppAccount.findOne({ businessId: req.businessId });
  if (!account) {
    res.status(400).json({ message: 'Primero conecta tu número de WhatsApp.' });
    return null;
  }
  if (!account.wabaId) {
    res.status(400).json({
      message: 'Falta el identificador de la cuenta de WhatsApp Business (WABA) para gestionar plantillas.',
    });
    return null;
  }
  return account;
}

/** GET /api/whatsapp-inbox/plantillas */
router.get('/plantillas', authMiddleware, requiereComplemento, asyncHandler(async (req, res) => {
  const account = await cuentaConectada(req, res);
  if (!account) return;

  try {
    const plantillas = await whatsappCloud.listarPlantillas({
      wabaId: account.wabaId, accessToken: account.getAccessToken(),
    });
    res.json({ plantillas });
  } catch (e) {
    res.status(502).json({ message: `Meta no devolvió las plantillas: ${e.message}` });
  }
}));

/** POST /api/whatsapp-inbox/plantillas — crea una y la manda a revisión. */
router.post('/plantillas', authMiddleware, requiereComplemento, asyncHandler(async (req, res) => {
  const account = await cuentaConectada(req, res);
  if (!account) return;

  const { nombre, categoria, idioma, cuerpo, ejemplos } = req.body || {};
  if (!nombre || !cuerpo) {
    return res.status(400).json({ message: 'La plantilla necesita nombre y contenido.' });
  }

  try {
    const creada = await whatsappCloud.crearPlantilla({
      wabaId: account.wabaId,
      accessToken: account.getAccessToken(),
      nombre, categoria, idioma, cuerpo, ejemplos,
    });
    logger.info('[WhatsApp] Plantilla creada', {
      businessId: String(req.businessId), nombre: creada.name,
    });
    res.status(201).json({
      plantilla: creada,
      aviso: 'Meta la revisa antes de poder usarla. Suele tardar unos minutos.',
    });
  } catch (e) {
    /* El error de Meta se pasa tal cual: dice el motivo real ("nombre
       inválido", "faltan ejemplos") y traducirlo a "error al crear" le quita
       al negocio la única pista que tiene. */
    res.status(400).json({ message: `Meta rechazó la plantilla: ${e.message}` });
  }
}));

/** DELETE /api/whatsapp-inbox/plantillas/:nombre */
router.delete('/plantillas/:nombre', authMiddleware, requiereComplemento, asyncHandler(async (req, res) => {
  const account = await cuentaConectada(req, res);
  if (!account) return;

  try {
    await whatsappCloud.borrarPlantilla({
      wabaId: account.wabaId,
      accessToken: account.getAccessToken(),
      nombre: req.params.nombre,
    });
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ message: `No se pudo borrar: ${e.message}` });
  }
}));

/**
 * POST /api/whatsapp-inbox/chats/:phone/plantilla — escribir fuera de las 24h.
 */
router.post('/chats/:phone/plantilla', authMiddleware, requiereComplemento, asyncHandler(async (req, res) => {
  const account = await WhatsAppAccount.findOne({ businessId: req.businessId, status: 'active' });
  if (!account) return res.status(400).json({ message: 'No hay un número conectado.' });

  const { nombre, idioma, variables } = req.body || {};
  if (!nombre) return res.status(400).json({ message: 'Falta la plantilla a enviar.' });

  try {
    const mensaje = await whatsappCloud.enviarPlantilla({
      account, to: req.params.phone, nombre, idioma, variables,
    });
    res.status(201).json({ message: mensaje });
  } catch (e) {
    res.status(502).json({ message: `No se pudo enviar: ${e.message}` });
  }
}));

/** DELETE /api/whatsapp-inbox/account — desconecta el número. */
router.delete('/account', authMiddleware, requiereComplemento, asyncHandler(async (req, res) => {
  await WhatsAppAccount.deleteOne({ businessId: req.businessId });
  res.json({ success: true });
}));

/**
 * GET /api/whatsapp-inbox/sin-leer — cuántos mensajes esperan respuesta.
 *
 * Es lo que hace que la bandeja sirva de algo: sin un aviso en el menú, el
 * negocio no se entera de que llegó un mensaje y sigue mirando el celular.
 * Se deja aparte y devolviendo solo un número porque el panel lo consulta cada
 * medio minuto.
 */
router.get('/sin-leer', authMiddleware, requiereComplemento, asyncHandler(async (req, res) => {
  const sinLeer = await WhatsAppMessage.countDocuments({
    businessId: req.businessId, direction: 'in', readByStaffAt: null,
  });
  res.json({ sinLeer });
}));

/**
 * GET /api/whatsapp-inbox/origen — de qué enlace vinieron los pedidos.
 *
 * Es lo que convierte el precio en una conversación distinta: en vez de
 * discutir cuánto cuesta MenuBy, se ve cuánto trajo cada canal. Sin esto el
 * dato se guarda pero nadie lo mira.
 *
 * Va en esta ruta y no en la de pedidos porque es la pantalla de WhatsApp la
 * que le da sentido, pero mide TODOS los canales, no solo WhatsApp.
 */
router.get('/origen', authMiddleware, requiereComplemento, asyncHandler(async (req, res) => {
  const { Types } = require('mongoose');
  const CompletedOrder = require('../Models/CompletedOrder');
  const Order = require('../Models/Order');
  const { SALES, DELIVERY } = require('../utils/revenue');

  const dias = Math.min(Math.max(Number(req.query.dias) || 30, 1), 365);
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  const negocio = new Types.ObjectId(String(req.businessId));

  /* Los pedidos viven en dos colecciones —activos y completados—, así que se
     consultan las dos y se suman. Mirar solo una da la mitad del cuadro. */
  const agrupar = [
    { $group: {
      _id: { $ifNull: ['$source', 'sin-marcar'] },
      pedidos: { $sum: 1 },
      ventas: { $sum: SALES },
      envios: { $sum: DELIVERY },
    } },
  ];

  const [completados, activos] = await Promise.all([
    CompletedOrder.aggregate([
      { $match: { businessId: negocio, completedAt: { $gte: desde } } }, ...agrupar,
    ]),
    Order.aggregate([
      { $match: { businessId: negocio, createdAt: { $gte: desde }, status: { $ne: 'cancelled' } } }, ...agrupar,
    ]),
  ]);

  const total = new Map();
  for (const fila of [...completados, ...activos]) {
    const previo = total.get(fila._id) || { pedidos: 0, ventas: 0, envios: 0 };
    total.set(fila._id, {
      pedidos: previo.pedidos + fila.pedidos,
      ventas: previo.ventas + fila.ventas,
      envios: previo.envios + fila.envios,
    });
  }

  const origenes = [...total]
    .map(([origen, v]) => ({ origen, ...v, ticketPromedio: v.pedidos ? Math.round(v.ventas / v.pedidos) : 0 }))
    .sort((a, b) => b.ventas - a.ventas);

  res.json({
    dias,
    desde,
    origenes,
    totales: origenes.reduce((s, o) => ({
      pedidos: s.pedidos + o.pedidos,
      ventas: s.ventas + o.ventas,
      envios: s.envios + o.envios,
    }), { pedidos: 0, ventas: 0, envios: 0 }),
  });
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
        /* Si es una nota de voz, en la lista se lee lo que dijo. Sin esto la
           fila salía vacía y había que abrir el chat para saber de qué iba. */
        lastText: { $first: { $ifNull: [{ $cond: [{ $eq: ['$text', ''] }, null, '$text'] }, '$transcripcion'] } },
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

  /* Se le pega a cada chat lo que pasó en él, para que el negocio vea de un
     vistazo cuál está atendido, a cuál se le mandó el menú y cuál terminó en
     pedido, sin abrirlos uno por uno. */
  const telefonos = chats.map((c) => c._id);
  const WhatsAppAgentSession = require('../Models/WhatsAppAgentSession');
  const sesiones = await WhatsAppAgentSession
    .find({ businessId: req.businessId, contactPhone: { $in: telefonos } })
    .select('contactPhone estado menuEnviadoAt orderNumber motivoTraspaso')
    .lean();
  const porTelefono = new Map(sesiones.map((s) => [s.contactPhone, s]));

  res.json({
    chats: chats.map((c) => {
      const s = porTelefono.get(c._id);
      return {
        ...c,
        contactPhone: c._id,
        // Lo último lo dijo el cliente y nadie ha respondido.
        esperandoRespuesta: c.lastDirection === 'in',
        agente: s ? {
          estado: s.estado,
          menuEnviado: !!s.menuEnviadoAt,
          orderNumber: s.orderNumber || null,
          motivoTraspaso: s.motivoTraspaso || '',
        } : null,
      };
    }),
  });
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

  /* Los que estaban sin leer, antes de marcarlos: hacen falta para avisarle a
     WhatsApp, y después de la actualización ya no se sabe cuáles eran. */
  const sinLeer = await WhatsAppMessage
    .find({ businessId: req.businessId, contactPhone, direction: 'in', readByStaffAt: null })
    .sort({ sentAt: -1 }).limit(1).select('wamid').lean();

  await WhatsAppMessage.updateMany(
    { businessId: req.businessId, contactPhone, direction: 'in', readByStaffAt: null },
    { $set: { readByStaffAt: new Date() } }
  );

  /* El doble check azul en el teléfono del cliente. Basta con marcar el último:
     WhatsApp da por leídos todos los anteriores. Solo se llama cuando de verdad
     había algo sin leer —si no, cada refresco de la bandeja sería una llamada a
     Meta cada minuto y por cada panel abierto. Sin await: es cosmético y no
     puede retrasar el pintado del chat. */
  if (sinLeer[0]?.wamid) {
    const cuenta = await WhatsAppAccount.findOne({ businessId: req.businessId, status: 'active' });
    if (cuenta) {
      whatsappCloud.markAsRead({ account: cuenta, wamid: sinLeer[0].wamid }).catch(() => {});
    }
  }

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

    /* Si una persona contesta, el agente se calla. Dos voces respondiendo la
       misma conversación confunden al cliente, y el negocio no tendría cómo
       saber cuál de las dos prometió qué. */
    const WhatsAppAgentSession = require('../Models/WhatsAppAgentSession');
    await WhatsAppAgentSession.updateOne(
      { businessId: req.businessId, contactPhone: mensaje.contactPhone },
      {
        $set: {
          estado: 'con_humano',
          motivoTraspaso: 'contestó una persona del negocio',
          ultimaActividad: new Date(),
        },
      },
      { upsert: true },
    ).catch(() => {});

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

/**
 * GET /api/whatsapp-inbox/media/:mediaId — el archivo que mandó un cliente.
 *
 * Pasa por acá y no directo a Meta porque la URL que Meta entrega es temporal
 * y además exige el token: el navegador no puede pedirla, y publicar el token
 * para que pudiera sería regalar la cuenta de WhatsApp del negocio.
 *
 * El archivo se sirve solo si pertenece a este negocio. Sin esa comprobación,
 * cualquiera con una sesión válida podría ver las fotos que los clientes le
 * mandan a otro restaurante.
 */
router.get('/media/:mediaId', authMiddleware, requiereComplemento, asyncHandler(async (req, res) => {
  const mensaje = await WhatsAppMessage.findOne({
    businessId: req.businessId,
    mediaId: String(req.params.mediaId),
  }).lean();
  if (!mensaje) return res.status(404).json({ message: 'Archivo no encontrado' });

  const account = await WhatsAppAccount.findOne({ businessId: req.businessId });
  if (!account) return res.status(400).json({ message: 'El negocio no tiene WhatsApp conectado.' });

  try {
    const archivo = await whatsappCloud.obtenerMedio(account, mensaje.mediaId);
    res.set('Content-Type', archivo.mimeType);
    /* Mientras existan no cambian, así que se cachean en el navegador y se
       ahorra el viaje en cada scroll. Ojo con el plazo: los archivos que
       llegan por webhook viven 7 días, no 30 —los 30 son para los que subimos
       nosotros—, así que una conversación de la semana pasada ya no tiene sus
       fotos. */
    res.set('Cache-Control', 'private, max-age=86400');
    if (archivo.fileName) {
      res.set('Content-Disposition', `inline; filename="${encodeURIComponent(archivo.fileName)}"`);
    }
    return res.send(archivo.buffer);
  } catch (e) {
    logger.warn('[WhatsApp] No se pudo bajar un archivo', {
      error: e.message, status: e.status, mediaId: mensaje.mediaId,
    });

    /* Un 401 no es un archivo perdido: es la sesión de WhatsApp caducada, y
       con ella deja de funcionar TODO —también enviar—. Decir "el archivo ya
       no está disponible" mandaba a buscar el problema donde no estaba; que
       fue exactamente lo que pasó. Se marca la cuenta para que el aviso de
       reconectar salga arriba de la bandeja. */
    if (e.status === 401) {
      await WhatsAppAccount.updateOne(
        { _id: account._id },
        { $set: { status: 'error', lastError: 'La sesión de WhatsApp caducó. Vuelve a conectar el número con un token permanente.' } }
      ).catch(() => {});
      return res.status(401).json({
        message: 'La sesión de WhatsApp caducó. Vuelve a conectar el número.',
        code: 'TOKEN_VENCIDO',
      });
    }

    /* 404 y no 502: Meta guarda 7 días los archivos que llegan por webhook, y
       pasado eso no es una avería nuestra sino un archivo que ya no existe. */
    return res.status(404).json({ message: 'WhatsApp ya no guarda este archivo (los borra a los 7 días).' });
  }
}));

/**
 * POST /api/whatsapp-inbox/chats/:phone/media — mandarle un archivo al cliente.
 */
const multer = require('multer');
const subida = multer({
  storage: multer.memoryStorage(),
  // El tope de Meta para documentos son 100 MB; los demás, menos.
  limits: { fileSize: 16 * 1024 * 1024, files: 1 },
});

router.post(
  '/chats/:phone/media',
  authMiddleware,
  requiereComplemento,
  subida.single('archivo'),
  asyncHandler(async (req, res) => {
    const account = await WhatsAppAccount.findOne({ businessId: req.businessId, status: 'active' });
    if (!account) {
      return res.status(400).json({ message: 'El negocio no tiene un número de WhatsApp conectado.' });
    }
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ message: 'No llegó ningún archivo.' });
    }

    try {
      const mensaje = await whatsappCloud.sendMedia({
        account,
        to: req.params.phone,
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
        fileName: req.file.originalname,
        caption: req.body?.caption,
        sentBy: req.user?.id,
      });
      await WhatsAppAccount.updateOne({ _id: account._id }, { $set: { lastOutboundAt: new Date() } });

      // Igual que con el texto: si contesta una persona, el agente se calla.
      const WhatsAppAgentSession = require('../Models/WhatsAppAgentSession');
      await WhatsAppAgentSession.updateOne(
        { businessId: req.businessId, contactPhone: mensaje.contactPhone },
        {
          $set: {
            estado: 'con_humano',
            motivoTraspaso: 'contestó una persona del negocio',
            ultimaActividad: new Date(),
          },
        },
        { upsert: true },
      ).catch(() => {});

      return res.status(201).json({ message: mensaje });
    } catch (e) {
      if (e.code === 'OUTSIDE_WINDOW') return res.status(409).json({ message: e.message, code: e.code });
      if (['BAD_PHONE', 'EMPTY', 'MUY_GRANDE', 'TIPO_NO_ADMITIDO'].includes(e.code)) {
        return res.status(400).json({ message: e.message, code: e.code });
      }
      logger.error('[WhatsApp] Falló el envío de un archivo', {
        error: e.message, businessId: String(req.businessId),
      });
      return res.status(502).json({ message: `No se pudo enviar: ${e.message}` });
    }
  })
);

/* ─────────────────────────────────────────────
 *  CONSULTAS DEL DUEÑO
 *
 *  Los números que pueden preguntarle al negocio por sus ventas, su caja y su
 *  inventario. Quien esté en esta lista ve cifras de dinero, así que se
 *  gestiona solo desde el panel y nunca desde WhatsApp: si se pudiera añadir
 *  un número por chat, bastaría con engañar al bot para leer la caja ajena.
 * ───────────────────────────────────────────── */

router.get('/consultas/numeros', authMiddleware, requiereComplemento, asyncHandler(async (req, res) => {
  const account = await WhatsAppAccount.findOne({ businessId: req.businessId });
  res.json({ numeros: account?.consultas?.numeros || [] });
}));

router.post('/consultas/numeros', authMiddleware, requiereComplemento, asyncHandler(async (req, res) => {
  const account = await WhatsAppAccount.findOne({ businessId: req.businessId });
  if (!account) return res.status(400).json({ message: 'El negocio no tiene WhatsApp conectado.' });

  const telefono = whatsappCloud.normalizePhone(req.body?.telefono);
  if (!telefono) return res.status(400).json({ message: 'Ese número no parece válido.' });

  const yaEsta = (account.consultas?.numeros || [])
    .some((n) => String(n.telefono).replace(/\D/g, '').slice(-10) === telefono.slice(-10));
  if (yaEsta) return res.status(409).json({ message: 'Ese número ya está autorizado.' });

  account.consultas = account.consultas || { numeros: [] };
  account.consultas.numeros.push({
    telefono,
    nombre: String(req.body?.nombre || '').trim().slice(0, 60),
  });
  await account.save();

  res.status(201).json({ numeros: account.consultas.numeros });
}));

router.delete('/consultas/numeros/:telefono', authMiddleware, requiereComplemento, asyncHandler(async (req, res) => {
  const account = await WhatsAppAccount.findOne({ businessId: req.businessId });
  if (!account) return res.status(400).json({ message: 'El negocio no tiene WhatsApp conectado.' });

  const buscado = String(req.params.telefono).replace(/\D/g, '').slice(-10);
  account.consultas.numeros = (account.consultas?.numeros || [])
    .filter((n) => String(n.telefono).replace(/\D/g, '').slice(-10) !== buscado);
  await account.save();

  res.json({ numeros: account.consultas.numeros });
}));

module.exports = router;
// Expuesto solo para poder probarlo sin base de datos.
module.exports.interpretarMensaje = interpretarMensaje;
