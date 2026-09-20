const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const CompletedOrder = require('../Models/CompletedOrder');
const Product = require('../Models/Product');
const Category = require('../Models/Category');
const Counter = require('../Models/Counter');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { tenantAuth } = require('../middleware/tenantAuth');
const CashRegister = require('../Models/CashRegister');
const BusinessConfig = require('../Models/BusinessConfig');
const PosCaja = require('../Models/PosCaja');
const PosVinculacion = require('../Models/PosVinculacion');
const { normalizar } = require('../utils/codigoVinculacion');
const rateLimit = require('express-rate-limit');
const PosExcepcion = require('../Models/PosExcepcion');
const { validarVenta, validarCierre, validarExcepcion, aplanarCatalogo } = require('../utils/pos');
const { moverStock } = require('../services/inventario');
const socketService = require('../services/socketService');
const logger = require('../utils/logger');

/**
 * Lo que la caja nativa necesita de la nube: subir ventas y bajar el catálogo.
 *
 * La caja ya cobró y ya imprimió antes de llamar aquí. Eso cambia el contrato
 * respecto al resto de la API: esto no "crea" una venta, la **registra**. No
 * puede rechazarla por precios desactualizados ni por horario, porque el
 * cliente ya pagó y ya se fue.
 *
 * Lo único que puede pasar dos veces es la llamada, nunca la venta: el POS
 * reintenta hasta que confirmemos, así que todo aquí es idempotente por el id
 * que generó la caja.
 */

/**
 * La caja que habla tiene que seguir vinculada.
 *
 * Es la mitad que falta de la revocación: sin esta consulta, "desvincular" en
 * el panel sería un botón que no apaga nada, porque un token firmado vale hasta
 * que vence pase lo que pase en la base.
 *
 * Una sesión normal del panel pasa de largo: esto solo aplica a tokens de caja.
 */
async function cajaVigente(req, res, next) {
  if (!req.caja?.tokenId) return next();

  try {
    const caja = await PosCaja.findOne({ tokenId: req.caja.tokenId }).select('revocada nombre').lean();

    if (!caja || caja.revocada) {
      return res.status(403).json({
        message: 'Esta caja fue desvinculada. Pide que la vinculen otra vez.',
        motivo: 'caja_revocada',
      });
    }

    /* Se anota que sigue viva, sin esperar la escritura: si falla, lo único que
       se pierde es un dato de diagnóstico, y una venta no puede esperar por
       eso. */
    PosCaja.updateOne(
      { tokenId: req.caja.tokenId },
      { $set: { ultimaVezVista: new Date(), ultimaActividad: req.path.replace('/', '') } },
    ).catch(() => {});

    next();
  } catch (error) {
    logger.error('Error verificando la caja', error, req);
    /* Ante un fallo de base se deja pasar: bloquear las ventas de todas las
       cajas del país porque una consulta de diagnóstico falló sería peor que el
       riesgo que esta comprobación evita. */
    next();
  }
}

/** Número de pedido del negocio, atómico. Mismo criterio que orders.js. */
async function siguienteNumero(businessId) {
  try {
    const counter = await Counter.findOneAndUpdate(
      { _id: `orderNumber:${businessId.toString()}` },
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );
    return counter.seq.toString();
  } catch (error) {
    logger.error('No se pudo numerar la venta del POS', error);
    return Date.now().toString();
  }
}

/* Adivinar un código de ocho caracteres son 2^39 intentos. Con esto, además,
   hay que hacerlos de a diez por minuto desde la misma IP. */
const limiteVinculacion = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: 'Demasiados intentos. Espera un minuto.', motivo: 'demasiados_intentos' },
});

/* POST /api/pos/vincular — canjear el código por el token de la caja.
 *
 * Es la única ruta del POS sin autenticación, y tiene que serlo: una caja
 * recién instalada no tiene con qué autenticarse todavía. Lo que la protege es
 * el código: ocho caracteres, diez minutos de vida, un solo uso y diez intentos
 * por minuto.
 */
router.post('/vincular', limiteVinculacion, async (req, res) => {
  const codigo = normalizar(req.body.codigo);
  if (codigo.length < 6) {
    return res.status(400).json({ message: 'Escribe el código completo', motivo: 'codigo_corto' });
  }

  try {
    /* Se marca como usado en la misma operación que se busca: dos cajas que
       canjeen el mismo código en el mismo segundo no pueden nacer las dos. */
    const vinculacion = await PosVinculacion.findOneAndUpdate(
      { codigo, usadoEn: null, expiraEn: { $gt: new Date() } },
      { $set: { usadoEn: new Date() } },
      { new: true },
    );

    if (!vinculacion) {
      /* El mismo mensaje para "no existe", "ya se usó" y "venció": distinguirlos
         le diría a quien prueba códigos al azar cuándo acertó uno. */
      return res.status(404).json({
        message: 'Ese código no sirve. Pide uno nuevo desde el panel.',
        motivo: 'codigo_invalido',
      });
    }

    const businessId = vinculacion.businessId;
    const tokenId = crypto.randomUUID();
    const dias = 90;

    const token = jwt.sign(
      {
        id: String(businessId),
        businessId: String(businessId),
        role: 'admin',
        scope: 'pos',
        caja: vinculacion.nombre,
        jti: tokenId,
      },
      process.env.JWT_SECRET,
      { expiresIn: `${dias}d` },
    );

    const caja = await PosCaja.create({
      businessId,
      nombre: vinculacion.nombre,
      tokenId,
      vinculadaPor: vinculacion.creadaPor,
      venceEn: new Date(Date.now() + dias * 24 * 60 * 60 * 1000),
    });

    await PosVinculacion.updateOne({ _id: vinculacion._id }, { $set: { usadoPorCaja: caja._id } });

    const negocio = await BusinessConfig.findById(businessId).select('businessName').lean();

    logger.info('Caja vinculada por código', { businessId: String(businessId), caja: vinculacion.nombre });
    res.json({
      token,
      negocio: negocio?.businessName || '',
      caja: vinculacion.nombre,
      vence_en_dias: dias,
    });
  } catch (error) {
    logger.error('Error vinculando la caja', error, req);
    res.status(500).json({ message: 'No se pudo vincular la caja' });
  }
});

/* POST /api/pos/pair — emparejar una caja con este negocio.
 *
 * Se llama UNA vez, con la sesión del panel, y devuelve el token con el que la
 * caja va a trabajar de ahí en adelante.
 *
 * Por qué no sirve el token del panel: vence en 24 horas. Una caja que lo use
 * deja de sincronizar al día siguiente, en mitad del servicio y sin que nadie
 * entienda por qué. El de la caja dura 90 días y vive en el llavero del sistema
 * operativo, no en un archivo.
 *
 * Lo que este token NO puede hacer es tan importante como lo que puede: lleva
 * `scope: 'pos'`, así que si mañana se restringe por scope, una caja robada no
 * sirve para entrar al panel ni para cambiar precios. Hoy vale lo mismo que la
 * sesión del negocio, y eso está dicho aquí para que nadie lo descubra tarde.
 */
router.post('/pair', tenantAuth, async (req, res) => {
  const businessId = req.user?.businessId || req.body.businessId;
  if (!businessId) return res.status(400).json({ message: 'businessId es requerido' });

  try {
    const caja = String(req.body.caja || 'caja-1').trim().slice(0, 40);

    /* El jti es el nombre del token, y es lo que permite matarlo desde el panel
       sin tener que guardar el token mismo: guardar el token sería dejar la
       llave puesta en la cerradura. */
    const tokenId = crypto.randomUUID();
    const dias = 90;

    const token = jwt.sign(
      {
        id: req.user?.id || String(businessId),
        businessId: String(businessId),
        role: req.user?.role || 'admin',
        scope: 'pos',
        caja,
        jti: tokenId,
      },
      process.env.JWT_SECRET,
      { expiresIn: `${dias}d` },
    );

    await PosCaja.create({
      businessId,
      nombre: caja,
      tokenId,
      vinculadaPor: req.user?.id || null,
      venceEn: new Date(Date.now() + dias * 24 * 60 * 60 * 1000),
    });

    const negocio = await BusinessConfig.findById(businessId).select('businessName').lean();

    logger.info('Caja emparejada', { businessId: String(businessId), caja, tokenId });
    res.json({
      token,
      // Para que la caja muestre a qué negocio quedó conectada, y el técnico
      // se dé cuenta en el acto si emparejó la equivocada.
      negocio: negocio?.businessName || '',
      vence_en_dias: dias,
    });
  } catch (error) {
    logger.error('Error emparejando la caja', error, req);
    res.status(500).json({ message: 'No se pudo emparejar la caja' });
  }
});

/* POST /api/pos/sync-sale — registrar una venta de la caja. */
router.post('/sync-sale', tenantAuth, cajaVigente, async (req, res) => {
  const businessId = req.user?.businessId || req.body.businessId;
  if (!businessId) return res.status(400).json({ message: 'businessId es requerido' });

  const revisada = validarVenta(req.body);
  if (!revisada.ok) {
    /* 400 y no 500: que el POS sepa que reintentar no va a servir. Su cola lo
       aparta después de un par de intentos en vez de taponarse con esto. */
    return res.status(400).json({ message: revisada.error, motivo: 'payload_invalido' });
  }

  const venta = revisada.venta;

  try {
    /* Idempotencia. Primero se mira, porque el caso común de un reintento es
       que la venta YA entró y la respuesta se perdió en el camino. */
    const yaEstaba = await CompletedOrder.findOne({ businessId, posSaleId: venta.id })
      .select('_id orderNumber totalAmount')
      .lean();

    if (yaEstaba) {
      return res.json({ ok: true, duplicada: true, orderId: yaEstaba._id, orderNumber: yaEstaba.orderNumber });
    }

    const orderNumber = await siguienteNumero(businessId);

    const guardada = await CompletedOrder.create({
      businessId,
      posSaleId: venta.id,
      orderNumber,
      customerName: 'Mostrador',
      phone: '',
      orderType: 'takeaway',
      orderChannel: 'pos',
      status: 'completed',
      items: venta.items,
      totalAmount: venta.total,
      finalAmount: venta.total,
      paymentMethod: venta.medioPago,
      ...(venta.pago ? { posPago: venta.pago } : {}),
      /* La hora es la de la caja, no la del servidor: una venta que se hizo sin
         internet a las 3 de la tarde no puede aparecer a las 9 de la noche,
         cuando volvió la señal. */
      createdAt: venta.creadaEn,
      completedAt: venta.creadaEn,
    });

    /* El inventario se mueve con la misma función que el resto del sistema, no
       con una copia: descontar por una venta de caja y por un pedido del menú
       tienen que dar exactamente lo mismo. */
    await moverStock(venta.items, -1, {
      businessId,
      type: 'sale',
      orderId: guardada._id,
      orderNumber,
      userName: venta.cajero,
      note: 'Venta en caja',
    });

    socketService.emitToBusiness(String(businessId), 'pos_sale_synced', {
      orderId: String(guardada._id),
      orderNumber,
      total: venta.total,
    });

    logger.info('Venta de caja registrada', { posSaleId: venta.id, orderNumber, businessId: String(businessId) });
    res.status(201).json({ ok: true, duplicada: false, orderId: guardada._id, orderNumber });
  } catch (error) {
    /* Carrera entre dos reintentos simultáneos: el índice único es el que
       decide, y el que perdió devuelve la venta que sí quedó. Es la diferencia
       entre "idempotente" e "idempotente de verdad". */
    if (error.code === 11000) {
      const existente = await CompletedOrder.findOne({ businessId, posSaleId: venta.id })
        .select('_id orderNumber')
        .lean();
      if (existente) {
        return res.json({ ok: true, duplicada: true, orderId: existente._id, orderNumber: existente.orderNumber });
      }
    }
    logger.error('Error registrando la venta del POS', error, req);
    res.status(500).json({ message: 'No se pudo registrar la venta' });
  }
});

/* POST /api/pos/shifts/close — el arqueo de un turno cerrado en la caja.
 *
 * Llega cuando el turno YA se cerró en el mostrador, posiblemente horas
 * después si la caja estuvo sin internet. Es un registro para auditar, no una
 * operación que el servidor pueda aprobar o rechazar: lo que se cuenta ya se
 * contó. */
router.post('/shifts/close', tenantAuth, cajaVigente, async (req, res) => {
  const businessId = req.user?.businessId || req.body.businessId;
  if (!businessId) return res.status(400).json({ message: 'businessId es requerido' });

  const revisado = validarCierre(req.body);
  if (!revisado.ok) {
    return res.status(400).json({ message: revisado.error, motivo: 'payload_invalido' });
  }

  const c = revisado.cierre;

  try {
    const yaEstaba = await CashRegister.findOne({ businessId, posTurnoId: c.turnoId })
      .select('_id difference')
      .lean();
    if (yaEstaba) {
      return res.json({ ok: true, duplicado: true, cierreId: yaEstaba._id });
    }

    const guardado = await CashRegister.create({
      businessId,
      posTurnoId: c.turnoId,
      origen: 'pos-nativo',
      cajeroNombre: c.cajero,
      openedBy: req.user?.id || undefined,
      openedAt: c.abiertoEn,
      closedAt: c.cerradoEn,
      status: 'closed',
      openingAmount: c.fondoInicial,
      closingAmount: c.contado,
      expectedAmount: c.esperado,
      difference: c.diferencia,
      /* Las entradas y salidas de la gaveta, tal como las registró el cajero.
         Sin ellas, un faltante de 50.000 y un pago al domiciliario de 50.000 se
         ven exactamente igual desde el panel. */
      movements: [
        ...(c.entradas > 0 ? [{ type: 'income', amount: c.entradas, description: 'Entradas de efectivo del turno' }] : []),
        ...(c.salidas > 0 ? [{ type: 'expense', amount: c.salidas, description: 'Salidas de efectivo del turno' }] : []),
      ],
      salesSummary: {
        totalSales: c.ventasEfectivo + c.ventasOtros,
        totalOrders: c.ventas,
        posSales: { total: c.ventasEfectivo + c.ventasOtros, count: c.ventas },
      },
    });

    /* Un descuadre es lo único de un cierre que alguien tiene que mirar hoy
       mismo, así que se avisa al panel en vivo en vez de esperar a que alguien
       entre a buscarlo. */
    if (c.diferencia !== 0) {
      socketService.emitToBusiness(String(businessId), 'pos_shift_mismatch', {
        cierreId: String(guardado._id),
        cajero: c.cajero,
        diferencia: c.diferencia,
      });
    }

    logger.info('Arqueo de caja nativa registrado', {
      posTurnoId: c.turnoId,
      diferencia: c.diferencia,
      businessId: String(businessId),
    });
    res.status(201).json({ ok: true, duplicado: false, cierreId: guardado._id });
  } catch (error) {
    if (error.code === 11000) {
      const existente = await CashRegister.findOne({ businessId, posTurnoId: c.turnoId }).select('_id').lean();
      if (existente) return res.json({ ok: true, duplicado: true, cierreId: existente._id });
    }
    logger.error('Error registrando el arqueo del POS', error, req);
    res.status(500).json({ message: 'No se pudo registrar el cierre de turno' });
  }
});

/* POST /api/pos/audit — una anulación, un descuento o una apertura de cajón.
 *
 * Es el registro que el dueño mira cuando la caja no cuadra. Llega por la cola,
 * así que puede aparecer dos días después si esa caja estuvo sin internet: la
 * fecha que vale es la del mostrador. */
router.post('/audit', tenantAuth, cajaVigente, async (req, res) => {
  const businessId = req.user?.businessId || req.body.businessId;
  if (!businessId) return res.status(400).json({ message: 'businessId es requerido' });

  const revisada = validarExcepcion(req.body);
  if (!revisada.ok) {
    return res.status(400).json({ message: revisada.error, motivo: 'payload_invalido' });
  }

  const e = revisada.excepcion;

  try {
    const yaEstaba = await PosExcepcion.findOne({ businessId, posExcepcionId: e.id }).select('_id').lean();
    if (yaEstaba) return res.json({ ok: true, duplicada: true, id: yaEstaba._id });

    const guardada = await PosExcepcion.create({
      businessId,
      posExcepcionId: e.id,
      turnoId: e.turnoId,
      tipo: e.tipo,
      detalle: e.detalle,
      monto: e.monto,
      motivo: e.motivo,
      cajero: e.cajero,
      autorizo: e.autorizo,
      ocurridaEn: e.ocurridaEn,
    });

    /* Una anulación con plata de por medio se avisa en vivo. No es alarmismo:
       el momento de preguntar "¿qué pasó con esos ocho cafés?" es hoy, no
       cuando el contador cierre el mes. */
    if (e.tipo === 'anular_item' || e.tipo === 'descuento') {
      socketService.emitToBusiness(String(businessId), 'pos_excepcion', {
        id: String(guardada._id),
        tipo: e.tipo,
        cajero: e.cajero,
        autorizo: e.autorizo,
        monto: e.monto,
        detalle: e.detalle,
      });
    }

    res.status(201).json({ ok: true, duplicada: false, id: guardada._id });
  } catch (error) {
    if (error.code === 11000) {
      const existente = await PosExcepcion.findOne({ businessId, posExcepcionId: e.id }).select('_id').lean();
      if (existente) return res.json({ ok: true, duplicada: true, id: existente._id });
    }
    logger.error('Error registrando la excepción del POS', error, req);
    res.status(500).json({ message: 'No se pudo registrar la excepción' });
  }
});

/* GET /api/pos/audit — lo ocurrido, para el panel del dueño. */
/* Esta la lee el panel, no la caja. Vive bajo /api/pos por vecindad temática,
   pero un token de terminal no tiene por qué poder leerse quién anuló qué:
   sin esto, una caja robada sirve para auditar al negocio. */
router.get('/audit', tenantAuth, (req, res, next) => {
  if (req.caja?.tokenId) {
    return res.status(403).json({ message: 'Esta consulta es del panel', motivo: 'fuera_de_alcance' });
  }
  next();
}, async (req, res) => {
  const businessId = req.user?.businessId || req.query.businessId;
  if (!businessId) return res.status(400).json({ message: 'businessId es requerido' });

  try {
    const filtro = { businessId };
    if (req.query.turnoId) filtro.turnoId = String(req.query.turnoId);
    if (req.query.tipo) filtro.tipo = String(req.query.tipo);

    const excepciones = await PosExcepcion.find(filtro)
      .sort({ ocurridaEn: -1 })
      .limit(Math.min(parseInt(req.query.limit, 10) || 100, 500))
      .lean();

    /* El resumen por cajero es lo que convierte una lista larga en una señal:
       "Ana anuló 8 veces por 120.000" se lee de un vistazo. */
    const porCajero = {};
    for (const x of excepciones) {
      if (x.tipo !== 'anular_item' && x.tipo !== 'descuento') continue;
      const fila = porCajero[x.cajero] || { cajero: x.cajero, veces: 0, monto: 0 };
      fila.veces += 1;
      fila.monto += x.monto || 0;
      porCajero[x.cajero] = fila;
    }

    res.json({
      excepciones,
      porCajero: Object.values(porCajero).sort((a, b) => b.monto - a.monto),
    });
  } catch (error) {
    logger.error('Error listando excepciones del POS', error, req);
    res.status(500).json({ message: 'No se pudieron cargar las excepciones' });
  }
});

/* GET /api/pos/catalog?since=ISO — lo que cambió desde la última bajada. */
router.get('/catalog', tenantAuth, cajaVigente, async (req, res) => {
  const businessId = req.user?.businessId || req.query.businessId;
  if (!businessId) return res.status(400).json({ message: 'businessId es requerido' });

  try {
    const desde = req.query.since ? new Date(req.query.since) : null;
    const filtro = { businessId };
    /* Marca de agua. Sin ella habría que bajar el catálogo entero en cada
       arranque: funciona con 50 productos y se cae con 5.000, que es justo el
       negocio que más lo necesita. */
    if (desde && !Number.isNaN(desde.getTime())) {
      filtro.updatedAt = { $gt: desde };
    }

    const limite = Math.min(parseInt(req.query.limit, 10) || 500, 1000);

    const [productos, categorias, negocio] = await Promise.all([
      Product.find(filtro)
        .select('name price active category sku variantes updatedAt createdAt')
        .sort({ updatedAt: 1 })
        .limit(limite)
        .lean(),
      Category.find({ businessId }).select('name').lean(),
      /* La identidad del negocio viaja por aquí y no por el emparejamiento
         porque el emparejamiento pasa una vez en la vida de la caja: si el
         dueño cambia su color en el panel, la caja tendría el viejo para
         siempre. Esta bajada corre cada pocos minutos. */
      BusinessConfig.findById(businessId).select('businessName theme.buttonColor theme.buttonTextColor').lean(),
    ]);

    const porId = Object.fromEntries(categorias.map((c) => [String(c._id), c.name]));
    const filas = aplanarCatalogo(productos, porId);

    /* `hay_mas` lo decide el tamaño del lote, no el de las filas: un producto
       con diez tallas son diez filas y un solo producto. Si se contaran filas,
       la caja pediría de nuevo lo mismo y nunca avanzaría. */
    res.json({
      filas,
      hay_mas: productos.length === limite,
      negocio: {
        nombre: negocio?.businessName || '',
        color: negocio?.theme?.buttonColor || '',
        color_texto: negocio?.theme?.buttonTextColor || '',
      },
    });
  } catch (error) {
    logger.error('Error entregando el catálogo al POS', error, req);
    res.status(500).json({ message: 'No se pudo cargar el catálogo' });
  }
});

module.exports = router;
