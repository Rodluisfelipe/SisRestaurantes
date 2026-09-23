const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const BoldCuenta = require('../Models/BoldCuenta');
const Order = require('../Models/Order');
const { tenantAuth } = require('../middleware/tenantAuth');
const { ORDER_STATUS } = require('../utils/constants');
const socketService = require('../services/socketService');
const logger = require('../utils/logger');

/**
 * Cobrar con tarjeta en el menú, con el Botón de Pagos de Bold.
 *
 * Hasta ahora un domicilio se pagaba en efectivo o por transferencia con
 * comprobante. Esto agrega la tarjeta, y el flujo es:
 *
 *   1. El pedido se crea como siempre, en `pending_payment`.
 *   2. El menú pide acá la firma de ESE pedido.
 *   3. El cliente paga en la pasarela de Bold.
 *   4. Bold avisa por webhook y el pedido pasa a `payment_confirmed`.
 *
 * Los estados no son nuevos: son los mismos del comprobante de transferencia,
 * que ya existían y que el panel y la cocina ya saben leer.
 *
 * **El monto se toma de la base, nunca de lo que mande el navegador.** Es la
 * regla que sostiene todo lo demás: la firma existe justamente para que el
 * monto no se pueda cambiar, así que firmar lo que llega del cliente sería
 * ponerle llave a una puerta y dejarla abierta.
 */

/* Firmar es barato pero toca la base. El techo es alto porque un cliente
   puede reintentar si cierra la pasarela por error. */
const limiteFirma = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * La firma de integridad de Bold.
 *
 *     sha256(orderId + amount + currency + llaveSecreta)
 *
 * No estaba en la documentación que Bold entrega —enlaza a otra página que no
 * vino—, así que se averiguó probando cinco variantes contra su servidor el
 * 23/09/2026. Las descartadas están anotadas en `scripts/probar-bold-link.js`
 * para que nadie las vuelva a intentar.
 */
function firmar({ referencia, monto, moneda, secreta }) {
  return crypto
    .createHash('sha256')
    .update(`${referencia}${monto}${moneda}${secreta}`)
    .digest('hex');
}

/**
 * Quiénes pueden encenderlo. En beta.
 *
 * El cobro con tarjeta mueve dinero de verdad y todavía le falta la
 * verificación de firma del webhook, así que no se abre a los 26 negocios a la
 * vez: se prueba con uno y se amplía cuando haya pasado por caja unas semanas.
 *
 * Va en una variable de entorno y no en el código para que sumar un negocio
 * sea cambiar una configuración, no desplegar. Vacía = nadie puede encenderlo.
 *
 *   BOLD_BETA_SLUGS=go-burger
 */
function enBeta(slug) {
  const lista = String(process.env.BOLD_BETA_SLUGS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return lista.includes(String(slug || '').toLowerCase());
}

/** La cuenta del negocio que hace la petición, o null. */
async function cuentaDe(businessId) {
  if (!businessId) return null;
  return BoldCuenta.findOne({ businessId });
}

/* ── Panel ──────────────────────────────────────────────────────────── */

/** GET /api/bold/cuenta — cómo está configurado, sin la secreta. */
router.get('/cuenta', tenantAuth, async (req, res) => {
  try {
    const cuenta = await cuentaDe(req.resolvedBusinessId || req.user?.businessId);
    if (!cuenta) return res.json({ cuenta: null });

    const base = process.env.PUBLIC_URL || 'https://api.menuby.tech';
    res.json({
      cuenta: {
        ...cuenta.toPanel(),
        /* La URL que hay que pegar en el panel de Bold. Se arma acá porque el
           modelo no sabe en qué dominio corre. */
        webhookUrl: `${base}/api/bold/webhook/${cuenta.webhookToken}`,
      },
    });
  } catch (error) {
    logger.error('Error leyendo la cuenta de Bold', error, req);
    res.status(500).json({ message: 'No se pudo cargar' });
  }
});

/** PUT /api/bold/cuenta — guardar las llaves. */
router.put('/cuenta', tenantAuth, async (req, res) => {
  try {
    const businessId = req.resolvedBusinessId || req.user?.businessId;
    if (!businessId) return res.status(400).json({ message: 'Falta el negocio' });

    const { identidad, secreta, entorno, activa } = req.body || {};

    if (entorno && !['pruebas', 'produccion'].includes(entorno)) {
      return res.status(400).json({ message: 'El entorno debe ser pruebas o produccion' });
    }

    /* La puerta de la beta. Se mira el slug y no el id porque la lista la
       escribe una persona en una variable de entorno. */
    const BusinessConfig = require('../Models/BusinessConfig');
    const negocio = await BusinessConfig.findById(businessId).select('slug').lean();
    if (!enBeta(negocio?.slug)) {
      return res.status(403).json({
        message: 'El cobro con tarjeta está en pruebas y todavía no está disponible para este negocio.',
        motivo: 'fuera_de_beta',
      });
    }

    const cuenta = (await cuentaDe(businessId)) || new BoldCuenta({ businessId });

    if (identidad !== undefined) cuenta.identidad = String(identidad).trim();
    /* Vacío = no la cambió. Si se tratara como "bórrala", cualquier guardado
       desde el panel dejaría al negocio sin poder cobrar, porque el formulario
       nunca trae la secreta de vuelta. */
    if (secreta) cuenta.setSecreta(secreta);
    if (entorno) cuenta.entorno = entorno;
    if (activa !== undefined) cuenta.activa = !!activa;

    /* No se puede encender sin las dos llaves: el menú ofrecería tarjeta y el
       cliente se estrellaría al confirmar. */
    if (cuenta.activa && !cuenta.lista()) {
      return res.status(400).json({
        message: 'Faltan las llaves. Pon la de identidad y la secreta antes de activarlo.',
      });
    }

    await cuenta.save();

    const base = process.env.PUBLIC_URL || 'https://api.menuby.tech';
    res.json({
      cuenta: {
        ...cuenta.toPanel(),
        webhookUrl: `${base}/api/bold/webhook/${cuenta.webhookToken}`,
      },
    });
  } catch (error) {
    logger.error('Error guardando la cuenta de Bold', error, req);
    res.status(500).json({ message: 'No se pudo guardar' });
  }
});

/* ── El menú ────────────────────────────────────────────────────────── */

/**
 * POST /api/bold/firma — lo que el menú necesita para abrir la pasarela.
 *
 * Recibe **solo el id del pedido**. Todo lo demás sale de la base.
 */
router.post('/firma', limiteFirma, async (req, res) => {
  try {
    const { orderId } = req.body || {};
    if (!orderId) return res.status(400).json({ message: 'Falta el pedido' });

    const pedido = await Order.findById(orderId)
      .select('businessId finalAmount totalAmount deliveryFee status orderNumber')
      .lean()
      .catch(() => null);

    if (!pedido) return res.status(404).json({ message: 'Ese pedido no existe' });

    /* Un pedido ya pagado no se vuelve a firmar. Sin esto, el enlace de un
       pedido viejo sirve para cobrar otra vez. */
    if (pedido.status !== ORDER_STATUS.PENDING_PAYMENT) {
      return res.status(409).json({
        message: 'Ese pedido no está esperando pago',
        estado: pedido.status,
      });
    }

    const cuenta = await cuentaDe(pedido.businessId);
    if (!cuenta || !cuenta.lista()) {
      return res.status(409).json({ message: 'Este negocio no tiene el pago con tarjeta activo' });
    }

    /* El total real, con domicilio y descuentos ya aplicados. `finalAmount` es
       lo que el negocio cobra; `totalAmount` por convención no incluye el
       envío. Cobrar el segundo sería regalar el domicilio en cada pedido. */
    const monto = Math.round(pedido.finalAmount ?? pedido.totalAmount ?? 0);
    if (monto <= 0) {
      return res.status(409).json({ message: 'Ese pedido no tiene un monto que cobrar' });
    }

    /* La referencia es el id del pedido: así el webhook sabe a cuál aplicar el
       pago sin tener que guardar una tabla de equivalencias. */
    const referencia = String(pedido._id);
    const moneda = 'COP';

    res.json({
      identidad: cuenta.identidad,
      referencia,
      monto: String(monto),
      moneda,
      firma: firmar({ referencia, monto, moneda, secreta: cuenta.getSecreta() }),
      descripcion: `Pedido #${pedido.orderNumber}`,
    });
  } catch (error) {
    logger.error('Error firmando un cobro de Bold', error, req);
    res.status(500).json({ message: 'No se pudo preparar el pago' });
  }
});

/* ── El aviso de Bold ───────────────────────────────────────────────── */

/**
 * POST /api/bold/webhook/:token — Bold avisa que un pago se completó.
 *
 * Es lo único que dice si un pedido quedó pagado. El navegador no sirve como
 * fuente: el cliente puede cerrar la ventana con el pago hecho, o quedarse en
 * la pantalla de éxito sin que el cobro haya pasado.
 *
 * **Pendiente: verificar la firma del webhook.** Bold la manda, pero su
 * documentación no vino en el material que tenemos. Mientras tanto la
 * protección es el token secreto de la URL, que es de cada negocio y de 24
 * bytes. Eso impide que alguien marque pedidos como pagados adivinando la
 * dirección, pero **no** sustituye la verificación de firma: si alguien
 * consigue la URL, puede fabricar avisos. Antes de cobrar de verdad hay que
 * pedirle a Bold cómo firman el webhook y cerrarlo acá.
 */
router.post('/webhook/:token', async (req, res) => {
  /* Se contesta 200 siempre y temprano: un webhook que recibe errores se
     reintenta, y un reintento infinito por un pedido que no existe es ruido
     que tapa los avisos que sí importan. Lo que pasó queda en el log. */
  const responder = () => res.status(200).json({ recibido: true });

  try {
    const token = String(req.params.token || '');
    if (token.length < 32) return responder();

    const cuenta = await BoldCuenta.findOne({ webhookToken: token });
    if (!cuenta) {
      logger.warn('[Bold] Webhook con token desconocido');
      return responder();
    }

    /* Bold anida los datos y su documentación de webhook no vino, así que se
       buscan en los sitios razonables en vez de asumir uno. Lo que llegue
       queda en el log para poder ajustarlo con un caso real delante. */
    const cuerpo = req.body || {};
    const datos = cuerpo.data || cuerpo.payload || cuerpo;
    const referencia = datos.reference || datos.order_id || datos.orderId || '';
    const estado = String(datos.status || datos.payment_status || cuerpo.type || '').toUpperCase();
    const montoAvisado = Number(datos.amount?.total ?? datos.amount ?? 0);

    logger.info('[Bold] Webhook recibido', {
      negocio: String(cuenta.businessId), referencia, estado, montoAvisado,
    });

    if (!referencia) return responder();

    const pedido = await Order.findById(referencia).catch(() => null);
    if (!pedido) {
      logger.warn('[Bold] Webhook de un pedido que no existe', { referencia });
      return responder();
    }

    /* Que el pago sea del negocio dueño de la cuenta. Sin esto, el token de un
       negocio serviría para confirmar pedidos de otro. */
    if (String(pedido.businessId) !== String(cuenta.businessId)) {
      logger.warn('[Bold] Webhook cruzado entre negocios', { referencia });
      return responder();
    }

    const aprobado = ['APPROVED', 'PAID', 'SUCCESS', 'SUCCEEDED', 'COMPLETED'].includes(estado);

    if (!aprobado) {
      /* Rechazado o cancelado: el pedido se queda esperando pago. No se
         cancela solo, porque el cliente puede reintentar con otra tarjeta y
         cancelarlo por él lo obligaría a armarlo de nuevo. */
      cuenta.ultimoError = `Pago no aprobado (${estado || 'sin estado'})`;
      await cuenta.save();
      return responder();
    }

    /* El monto avisado tiene que coincidir con lo que el pedido cobra. Es la
       última defensa: si el aviso viniera alterado, acá se cae. */
    const esperado = Math.round(pedido.finalAmount ?? pedido.totalAmount ?? 0);
    if (montoAvisado > 0 && Math.round(montoAvisado) !== esperado) {
      logger.error('[Bold] El monto avisado no coincide con el pedido', {
        referencia, montoAvisado, esperado,
      });
      cuenta.ultimoError = `Monto distinto: aviso ${montoAvisado}, pedido ${esperado}`;
      await cuenta.save();
      return responder();
    }

    /* Idempotencia: Bold reintenta el webhook, y sin esto el mismo pago
       avanzaría el pedido dos veces. */
    if (pedido.status !== ORDER_STATUS.PENDING_PAYMENT) {
      logger.info('[Bold] Webhook repetido, el pedido ya no espera pago', {
        referencia, estado: pedido.status,
      });
      return responder();
    }

    pedido.status = ORDER_STATUS.PAYMENT_CONFIRMED;
    pedido.paymentMethod = 'bold';
    await pedido.save();

    cuenta.ultimoPagoAt = new Date();
    cuenta.ultimoError = '';
    await cuenta.save();

    /* Que el panel y la cocina se enteren sin esperar al siguiente sondeo: el
       cliente ya pagó y está esperando su comida. */
    socketService.emitToBusiness(String(pedido.businessId), 'order_status_update', {
      orderId: String(pedido._id),
      status: pedido.status,
    });

    logger.info('[Bold] Pedido pagado', { referencia, orden: pedido.orderNumber });
    return responder();
  } catch (error) {
    logger.error('[Bold] Error procesando el webhook', error);
    return responder();
  }
});

module.exports = router;
