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
const PosDevolucion = require('../Models/PosDevolucion');
const PosVinculacion = require('../Models/PosVinculacion');
const { normalizar } = require('../utils/codigoVinculacion');
const { conDefectos } = require('../utils/configPos');
const Customer = require('../Models/Customer');
const { redimir } = require('../services/fidelizacion');
const { resolveBusinessId } = require('../utils/businessResolver');
const CustomerLoyalty = require('../Models/CustomerLoyalty');
const LoyaltyProgram = require('../Models/LoyaltyProgram');
const rateLimit = require('express-rate-limit');
const PosExcepcion = require('../Models/PosExcepcion');
const {
  validarVenta, validarCierre, validarExcepcion, aplanarCatalogo, validarDevolucion,
  pedidoParaCaja, ESTADOS_ACTIVOS,
} = require('../utils/pos');
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

    /* El cliente, si el cajero lo asoció: por su id de la nube, o por su
       teléfono si se registró en la caja y todavía tenía el id local. */
    const { clienteDeLaCaja, mover: moverCredito } = require('../services/credito');
    const cliente = (venta.clienteId || venta.clienteTelefono)
      ? await clienteDeLaCaja(businessId, { clienteId: venta.clienteId, telefono: venta.clienteTelefono })
      : null;

    const guardada = await CompletedOrder.create({
      businessId,
      posSaleId: venta.id,
      orderNumber,
      customerName: cliente?.name || 'Mostrador',
      phone: cliente?.phone || '',
      ...(cliente ? { customerId: cliente._id } : {}),
      orderType: 'takeaway',
      orderChannel: 'pos',
      status: 'completed',
      items: venta.items,
      /* `totalAmount` es lo que valía antes del descuento y `finalAmount` lo
         que el cliente pagó. Es el mismo significado que tienen en un pedido
         del menú, así que los informes del negocio suman las dos cosas sin
         tener que saber de dónde vino la venta. */
      totalAmount: venta.bruto,
      discountAmount: venta.descuento,
      /* `finalAmount` es lo que el negocio facturó, **sin la propina**: la
         propina no es suya. Lo que el cliente entregó es finalAmount +
         tipAmount, y esa suma se reconstruye donde haga falta. */
      finalAmount: venta.total,
      tipAmount: venta.propina,
      paymentMethod: venta.medioPago,
      ...(venta.descuento > 0 ? { discountReason: venta.descuentoMotivo } : {}),
      ...(venta.pago ? { posPago: venta.pago } : {}),
      ...(venta.pagos.length > 1 ? { posPagos: venta.pagos } : {}),
      ...(venta.impuestos.inc || venta.impuestos.iva || venta.impuestos.exento
        ? { posImpuestos: venta.impuestos }
        : {}),
      /* La hora es la de la caja, no la del servidor: una venta que se hizo sin
         internet a las 3 de la tarde no puede aparecer a las 9 de la noche,
         cuando volvió la señal. */
      createdAt: venta.creadaEn,
      completedAt: venta.creadaEn,
      /* Una venta de mostrador nace aceptada y entregada en el mismo acto: el
         cliente estaba ahí. Las marcas intermedias —cocina, despacho— quedan
         vacías porque nunca ocurrieron, y vale más un hueco honesto que una
         hora inventada que después alguien promedia. */
      marcasTiempo: {
        aceptado: venta.creadaEn,
        entregado: venta.creadaEn,
        duracionTomaSegundos: venta.duracionTomaSegundos,
      },
    });

    if (cliente) {
      await Customer.updateOne(
        { _id: cliente._id, businessId },
        { $inc: { totalOrders: 1, totalSpent: venta.total }, $set: { lastOrderDate: new Date(venta.creadaEn || Date.now()) } },
      );
    }

    /* Lo fiado, a la cuenta del cliente. Idempotente por el id de la venta:
       un reintento de la cola no carga dos veces. La caja ya revisó el cupo
       —con su copia, posiblemente sin internet— y la venta ya ocurrió: aquí
       se registra, no se decide. */
    const fiado = venta.pagos.filter((p) => p.metodo === 'credito').reduce((t, p) => t + p.monto, 0);
    if (fiado > 0) {
      if (cliente) {
        await moverCredito({
          businessId, customerId: cliente._id, tipo: 'cargo', monto: fiado, origenId: venta.id,
          referencia: `Venta #${orderNumber}`, usuario: venta.cajero, fecha: venta.creadaEn,
        });
      } else {
        logger.warn('Venta a crédito sin cliente identificable', { businessId: String(businessId), venta: venta.id });
      }
    }

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

/* POST /api/pos/sync-refund — una devolución hecha en el mostrador.
 *
 * Llega cuando la plata **ya salió de la gaveta**: un supervisor la autorizó
 * frente al cliente, posiblemente sin internet y horas antes. Este lado no
 * aprueba ni rechaza el hecho; lo registra y devuelve las unidades al
 * inventario, que es lo único que la caja no puede hacer sola —el catálogo
 * local no lleva existencias—. */
router.post('/sync-refund', tenantAuth, cajaVigente, async (req, res) => {
  const businessId = req.user?.businessId || req.body.businessId;
  if (!businessId) return res.status(400).json({ message: 'businessId es requerido' });

  const revisada = validarDevolucion(req.body);
  if (!revisada.ok) {
    // 400 y no 500: que la cola sepa que reintentar no va a servir.
    return res.status(400).json({ message: revisada.error, motivo: 'payload_invalido' });
  }

  const dev = revisada.devolucion;

  try {
    /* Idempotencia, igual que en la venta. Sin esto, una devolución cuya
       respuesta se perdió en el camino sumaría el inventario dos veces al
       reintentarse, y el negocio creería tener unidades que no tiene. */
    const yaEstaba = await PosDevolucion.findOne({ businessId, posRefundId: dev.id })
      .select('_id')
      .lean();

    if (yaEstaba) {
      return res.json({ ok: true, duplicada: true, id: yaEstaba._id });
    }

    /* La orden original, si esta caja la subió. Puede no estar: la venta pudo
       hacerse en otra terminal, o seguir en su cola. La devolución se registra
       igual —la plata ya salió— y queda con la referencia del consecutivo. */
    const original = await CompletedOrder.findOne({ businessId, posSaleId: dev.ventaId })
      .select('_id orderNumber')
      .lean();

    const guardada = await PosDevolucion.create({
      businessId,
      posRefundId: dev.id,
      posSaleId: dev.ventaId,
      orderId: original?._id || null,
      orderNumber: original?.orderNumber || dev.consecutivo,
      items: dev.items,
      total: dev.total,
      medio: dev.medio,
      motivo: dev.motivo,
      cajero: dev.cajero,
      autorizo: dev.autorizo,
      turnoId: dev.turnoId,
      createdAt: dev.creadaEn,
    });

    /* El inventario vuelve a subir. Signo +1, la misma función que usa todo el
       sistema: devolver por caja y devolver por el panel tienen que dar
       exactamente lo mismo. */
    await moverStock(dev.items, +1, {
      businessId,
      type: 'return',
      orderId: original?._id,
      orderNumber: original?.orderNumber || dev.consecutivo,
      userName: dev.cajero,
      note: `Devolución en caja: ${dev.motivo}`,
    });

    socketService.emitToBusiness(String(businessId), 'pos_refund_synced', {
      id: String(guardada._id),
      orderNumber: guardada.orderNumber,
      total: dev.total,
    });

    logger.info('Devolución de caja registrada', {
      posRefundId: dev.id,
      businessId: String(businessId),
      total: dev.total,
    });
    res.status(201).json({ ok: true, duplicada: false, id: guardada._id });
  } catch (error) {
    // Carrera entre dos reintentos: el índice único decide.
    if (error.code === 11000) {
      const existente = await PosDevolucion.findOne({ businessId, posRefundId: dev.id })
        .select('_id')
        .lean();
      if (existente) return res.json({ ok: true, duplicada: true, id: existente._id });
    }
    logger.error('Error registrando la devolución del POS', error, req);
    res.status(500).json({ message: 'No se pudo registrar la devolución' });
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
      cajaNombre: req.caja?.nombre || '',
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
      /* Cada movimiento con su motivo cuando la caja los manda; las cajas
         viejas solo mandan los totales y se guardan como antes. */
      movements: c.movimientos.length
        ? c.movimientos.map((m) => ({
          type: m.tipo === 'entrada' ? 'income' : 'expense',
          amount: m.monto,
          description: m.motivo,
          createdAt: m.creadoEn,
        }))
        : [
          ...(c.entradas > 0 ? [{ type: 'income', amount: c.entradas, description: 'Entradas de efectivo del turno' }] : []),
          ...(c.salidas > 0 ? [{ type: 'expense', amount: c.salidas, description: 'Salidas de efectivo del turno' }] : []),
        ],
      posDetalle: { ...c.detalle, ventasEfectivo: c.ventasEfectivo, ventasOtros: c.ventasOtros },
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
        .select('name price active category sku variantes updatedAt createdAt image images toppingGroups enPos')
        /* Los extras viajan **dentro** de cada producto y no como catálogo
           aparte. Duplica datos —dos hamburguesas comparten el grupo "salsas"—
           pero es lo que permite que la caja arme la pantalla de extras sin
           una segunda consulta ni una segunda tabla que mantener sincronizada.
           Un grupo de extras pesa unos cientos de bytes. */
        .populate({
          path: 'toppingGroups',
          match: { active: true },
          select: 'name isMultipleChoice isRequired allowRepeats maxSelections basePrice options subGroups active',
        })
        .sort({ updatedAt: 1 })
        .limit(limite)
        .lean(),
      /* El orden viaja con el nombre: la caja muestra las categorías en el
         mismo orden que el panel, que es el que el dueño decidió. Ordenar
         alfabéticamente —como hacía la caja— pone "Adiciones" antes que
         "Hamburguesas", y el cajero busca donde no está. */
      Category.find({ businessId }).select('name displayOrder').lean(),
      /* La identidad del negocio viaja por aquí y no por el emparejamiento
         porque el emparejamiento pasa una vez en la vida de la caja: si el
         dueño cambia su color en el panel, la caja tendría el viejo para
         siempre. Esta bajada corre cada pocos minutos. */
      BusinessConfig.findById(businessId).select('businessName theme.buttonColor theme.buttonTextColor nit address phone whatsappNumber slug logo printerSettings').lean(),
    ]);

    const porId = Object.fromEntries(
      categorias.map((c) => [String(c._id), { nombre: c.name, orden: c.displayOrder ?? 999 }]),
    );
    const filas = aplanarCatalogo(productos, porId);

    /* La configuración de esta terminal, si cambió.

       Se manda solo cuando su fecha es posterior a la marca de agua que trajo
       la caja. Mandarla siempre serían unos cientos de bytes cada treinta
       segundos, por terminal, para decir que nada cambió; y en un negocio con
       seis cajas eso es ruido constante en la conexión del local.

       En la primera bajada —cuando la caja no manda `since`— va siempre: una
       terminal recién instalada necesita su configuración antes que nada. */
    let configuracion = null;
    if (req.caja?.tokenId) {
      const terminal = await PosCaja.findOne({ businessId, tokenId: req.caja.tokenId })
        .select('nombre config')
        .lean();

      const cambiada =
        !desde ||
        !terminal?.config?.actualizadoEn ||
        new Date(terminal.config.actualizadoEn) > desde;

      if (terminal && cambiada) {
        configuracion = { nombre: terminal.nombre, ...conDefectos(terminal.config) };
      }
    }

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
        /* El membrete de la tirilla, el mismo que imprime el PrintAgent. Van
           siempre, aunque estén vacíos: si el dueño borra el NIT en el panel,
           la caja tiene que dejar de imprimirlo. */
        nit: (negocio?.nit || '').trim(),
        direccion: (negocio?.address || '').trim(),
        telefono: (negocio?.phone || negocio?.whatsappNumber || '').trim(),
        /* El QR del menú en la tirilla: el mismo enlace y el mismo interruptor
           que usa el agente de impresión (Routes/printAgent.js). */
        menu_url: negocio?.slug
          ? `${(process.env.FRONTEND_URL || 'https://menuby.tech').replace(/\/$/, '')}/${negocio.slug}`
          : '',
        qr_en_tirilla: negocio?.printerSettings?.showQR !== false,
        // El logo, para la pantalla de entrada de la caja.
        logo: typeof negocio?.logo === 'string' ? negocio.logo : '',
      },
      configuracion,
    });
  } catch (error) {
    logger.error('Error entregando el catálogo al POS', error, req);
    res.status(500).json({ message: 'No se pudo cargar el catálogo' });
  }
});

/* GET /api/pos/customers?since=ISO — los clientes que cambiaron.
 *
 * La caja guarda una copia local para poder buscar por cédula o teléfono en
 * menos de lo que tarda el cajero en soltar el teclado, **y sin internet**. Un
 * cliente que llega al mostrador con la conexión caída no puede quedarse sin
 * sus puntos porque el router se reinició.
 *
 * Por marca de agua, como el catálogo: la primera bajada trae todo y las
 * siguientes solo lo que cambió. Un negocio con veinte mil clientes no puede
 * mandarlos enteros cada treinta segundos.
 *
 * Los puntos viven en otra colección y se cruzan por teléfono, que es como los
 * lleva el programa de fidelización. */
router.get('/customers', tenantAuth, cajaVigente, async (req, res) => {
  const businessId = req.user?.businessId || req.query.businessId;
  if (!businessId) return res.status(400).json({ message: 'businessId es requerido' });

  try {
    const desde = req.query.since ? new Date(req.query.since) : null;
    const filtro = { businessId };
    if (desde && !Number.isNaN(desde.getTime())) {
      filtro.updatedAt = { $gt: desde };
    }

    const limite = Math.min(parseInt(req.query.limit, 10) || 500, 2000);

    const clientes = await Customer.find(filtro)
      .select('phone name documento tipoDocumento saldoFavor status updatedAt')
      .sort({ updatedAt: 1 })
      .limit(limite)
      .lean();

    /* Los puntos de esos clientes, en una sola consulta. Uno por cliente
       serían quinientas consultas por sincronización y por terminal. */
    const telefonos = clientes.map((c) => c.phone).filter(Boolean);
    const puntos = telefonos.length
      ? await CustomerLoyalty.find({ businessId, phone: { $in: telefonos } })
          .select('phone points')
          .lean()
      : [];
    const porTelefono = Object.fromEntries(puntos.map((p) => [p.phone, p.points || 0]));

    const filas = clientes.map((c) => ({
      id: String(c._id),
      documento: c.documento || '',
      tipo_documento: c.tipoDocumento || 'CC',
      telefono: c.phone || '',
      nombre: c.name || '',
      puntos: porTelefono[c.phone] || 0,
      saldo_favor: Math.max(0, Math.round(c.saldoFavor || 0)),
      estado: c.status || 'active',
      credito_habilitado: c.credito?.habilitado === true,
      cupo: Math.max(0, Math.round(c.credito?.cupo || 0)),
      saldo_credito: Math.max(0, Math.round(c.credito?.saldo || 0)),
      actualizado: (c.updatedAt || new Date()).toISOString(),
    }));

    /* Las recompensas activas, para que la caja pueda ofrecerlas sin
       internet. Van con los clientes y no en su propia ruta porque se piden
       juntas y son pocas: un negocio tiene diez recompensas, no diez mil. */
    const programa = await LoyaltyProgram.findOne({ businessId, isActive: true })
      .select('rewards pointsPerAmount amountPerPoints')
      .lean();

    const recompensas = (programa?.rewards || [])
      .filter((r) => r.isActive !== false)
      .map((r) => ({
        id: String(r._id),
        nombre: r.name,
        tipo: r.type,
        costo_puntos: Math.max(1, Math.round(r.pointsCost || 1)),
        producto_id: r.productId ? String(r.productId) : '',
        valor_descuento: Math.max(0, Math.round(r.discountValue || 0)),
      }));

    res.json({
      filas,
      hay_mas: clientes.length === limite,
      recompensas,
      /* Cuántos pesos vale un punto, para que la caja pueda decirle al cliente
         cuánto lleva acumulado sin preguntar. */
      puntos_por_monto: programa?.pointsPerAmount || 0,
      monto_por_puntos: programa?.amountPerPoints || 0,
    });
  } catch (error) {
    logger.error('Error entregando los clientes al POS', error, req);
    res.status(500).json({ message: 'No se pudieron cargar los clientes' });
  }
});

/* POST /api/pos/customers — un cliente dado de alta en el mostrador.
 *
 * Llega por la cola, igual que una venta: la caja ya lo registró local y ya
 * siguió atendiendo. Esto no aprueba nada, solo lo asienta.
 *
 * **La llave es el teléfono, no el id.** La terminal generó un UUIDv7 para su
 * copia local, pero aquí los ids son ObjectId y no puede adoptarse. El teléfono
 * sirve mejor de todos modos: es con lo que el programa de puntos lleva las
 * cuentas, y es lo que el cliente dice en el mostrador.
 *
 * Eso hace la operación idempotente sin esfuerzo, que es lo que necesita una
 * cola que reintenta: el mismo envío repetido encuentra la ficha que dejó el
 * primero. Y cubre el caso que pasa de verdad —el cliente ya existía porque
 * pidió un domicilio el mes pasado y el cajero lo registró sin saberlo—: gana
 * la ficha vieja, que tiene el historial y los puntos. Crear una nueva los
 * dejaría huérfanos. */
router.post('/customers', tenantAuth, cajaVigente, async (req, res) => {
  const businessId = req.user?.businessId || req.body.businessId;
  if (!businessId) return res.status(400).json({ message: 'businessId es requerido' });

  const telefono = String(req.body.telefono || '').trim().slice(0, 30);
  const nombre = String(req.body.nombre || '').trim().slice(0, 80);

  if (!telefono || !nombre) {
    /* 400 y no 500: que la cola sepa que reintentar no va a servir y lo aparte
       en vez de taponarse con esto. */
    return res.status(400).json({ message: 'El cliente necesita teléfono y nombre', motivo: 'payload_invalido' });
  }

  try {
    /* Primero se mira si ya existe por teléfono, que es la llave real del
       negocio: el mismo número es el mismo cliente aunque el cajero lo haya
       vuelto a escribir. */
    const existente = await Customer.findOne({ businessId, phone: telefono })
      .select('_id name documento')
      .lean();

    if (existente) {
      /* Se completa lo que faltaba sin pisar lo que ya había: un nombre puesto
         hace seis meses en un domicilio vale más que el que el cajero alcanzó
         a teclear con la fila esperando. */
      const documento = String(req.body.documento || '').trim().slice(0, 20);
      if (documento && !existente.documento) {
        await Customer.updateOne({ _id: existente._id }, { $set: { documento } });
      }

      return res.json({ ok: true, duplicado: true, id: String(existente._id) });
    }

    const creado = await Customer.create({
      businessId,
      phone: telefono,
      name: nombre,
      documento: String(req.body.documento || '').trim().slice(0, 20),
      tipoDocumento: ['CC', 'NIT', 'CE', 'PP'].includes(req.body.tipo_documento)
        ? req.body.tipo_documento
        : 'CC',
    });

    /* El id local de la terminal se registra en el log y no en la ficha: sirve
       para rastrear de qué caja salió si algo no cuadra, y no vale la pena una
       columna en la colección para eso. */
    logger.info('Cliente dado de alta desde una caja', {
      businessId: String(businessId),
      telefono,
      id: String(creado._id),
      posClienteId: String(req.body.pos_cliente_id || ''),
    });

    res.status(201).json({ ok: true, duplicado: false, id: String(creado._id) });
  } catch (error) {
    /* Carrera entre dos reintentos simultáneos: el índice único por teléfono es
       el que decide, y el que perdió devuelve la ficha que sí quedó. */
    if (error.code === 11000) {
      const yaEsta = await Customer.findOne({ businessId, phone: telefono }).select('_id').lean();
      if (yaEsta) return res.json({ ok: true, duplicado: true, id: String(yaEsta._id) });
    }
    logger.error('Error dando de alta el cliente del POS', error, req);
    res.status(500).json({ message: 'No se pudo registrar el cliente' });
  }
});

/* POST /api/pos/redeem-reward — canjear puntos desde el mostrador.
 *
 * El canje del menú web vive en /api/loyalty/redeem y no sirve para esto por
 * dos razones. La primera es de cierre: el token de una caja solo puede tocar
 * /api/pos (ver middleware/alcanceCaja), y abrirle un hueco a otra ruta
 * debilitaría justamente lo que protege a las terminales robadas.
 *
 * La segunda es que aquí se exige más. En el menú es el cliente quien quema
 * sus propios puntos; en el mostrador hay un empleado con las manos en el
 * dinero, y una salida de valor sin firma es el primer sitio donde mirar
 * cuando algo no cuadra. Por eso van obligatorios:
 *
 *   - `posSaleId`: la venta contra la que se redime. Sin él se pueden quemar
 *     puntos al aire, sin que el cliente esté siquiera presente.
 *   - `cajero`: quién lo procesó.
 *
 * La terminal se identifica sola por su token, así que no se pide.
 *
 * El descuento es el mismo código que el del menú —services/fidelizacion— para
 * que arreglar una carrera en un lado no deje el hueco abierto en el otro. */
router.post('/redeem-reward', tenantAuth, cajaVigente, async (req, res) => {
  const crudo = req.user?.businessId || req.body.businessId;
  if (!crudo) return res.status(400).json({ message: 'businessId es requerido' });

  const telefono = String(req.body.telefono || req.body.phone || '').trim();
  const rewardId = String(req.body.reward_id || req.body.rewardId || '').trim();
  const posSaleId = String(req.body.venta_id || req.body.posSaleId || '').trim();
  const cajero = String(req.body.cajero || '').trim();

  if (!telefono || !rewardId) {
    return res.status(400).json({ message: 'Falta el teléfono del cliente o la recompensa' });
  }
  if (!posSaleId) {
    return res.status(400).json({
      message: 'El canje tiene que ir con la venta en la que se usa',
      motivo: 'sin_venta',
    });
  }
  if (!cajero) {
    return res.status(400).json({
      message: 'Falta quién está procesando el canje',
      motivo: 'sin_cajero',
    });
  }

  try {
    let businessId;
    try {
      businessId = await resolveBusinessId(crudo);
    } catch {
      return res.status(404).json({ message: 'Negocio no encontrado' });
    }

    const salida = await redimir({
      businessId,
      telefono,
      rewardId,
      origen: 'pos',
      posSaleId,
      autorizadoPor: cajero,
      cajaTokenId: req.caja?.tokenId || '',
      cajaNombre: req.caja?.nombre || '',
    });

    if (salida.ok) {
      logger.info('Canje de puntos en caja', {
        businessId: String(businessId), posSaleId, cajero, puntos: salida.cuerpo.pointsSpent,
      });
    }

    return res.status(salida.estado).json(salida.cuerpo);
  } catch (error) {
    logger.error('Error canjeando puntos desde la caja', error, req);
    res.status(500).json({ message: 'No se pudo canjear la recompensa' });
  }
});

/* ── Pedidos web ───────────────────────────────────────────────────────────
 *
 * Los pedidos que entran por el menú, el WhatsApp o el panel, para
 * despacharlos desde la caja. El POS web los mostraba y la caja nativa no:
 * quien atendía el mostrador tenía que tener el panel abierto en otra
 * pantalla para enterarse de que había un domicilio esperando.
 *
 * La caja pregunta cada pocos segundos. Son pocos pedidos activos por negocio
 * y la consulta va por índice; un socket sería más inmediato, pero una caja
 * que se queda sin internet a ratos se recupera sola preguntando, y un socket
 * caído sin que nadie lo note es un pedido que nadie ve.
 */
const Order = require('../Models/Order');
const ordersRouter = require('./orders');
const { validateUpdateOrderStatus } = require('../middleware/validators/orderValidators');

router.get('/pedidos', tenantAuth, cajaVigente, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const pedidos = await Order.find({
      businessId,
      status: { $in: ESTADOS_ACTIVOS },
      /* Lo que la propia caja vende no es un pedido que atender: ya se
         despachó en el mostrador. Las cuentas abiertas de mesa del POS web
         tampoco. */
      orderChannel: { $ne: 'pos' },
      posOpenTab: { $ne: true },
    })
      .sort({ createdAt: 1 })
      .limit(100)
      .lean();
    res.set('Cache-Control', 'no-store');
    res.json({ pedidos: pedidos.map(pedidoParaCaja) });
  } catch (error) {
    logger.error('Error entregando los pedidos web al POS', error, req);
    res.status(500).json({ message: 'No se pudieron cargar los pedidos' });
  }
});

/* Mover un pedido: aceptarlo, marcarlo listo, entregarlo, cancelarlo.
   Pasa por el mismo camino que el panel —ver `actualizarEstadoPedido` en
   Routes/orders.js— con el negocio que dice el token de la caja. */
router.patch('/pedidos/:id/estado', tenantAuth, cajaVigente, (req, res, next) => {
  req.body = { status: req.body?.estado };
  next();
}, validateUpdateOrderStatus, ordersRouter.actualizarEstadoPedido);


/* ── Agotados ──────────────────────────────────────────────────────────────
 *
 * Marcar desde la caja que algo se acabó. Es el mismo `active` que el dueño
 * apaga en el panel —el que lo quita del menú—, así que un agotado marcado en
 * el mostrador deja de venderse también por el menú web en el acto, en vez de
 * seguir entrando pedidos de algo que ya no hay.
 *
 * Recibe el valor y no un "cambiar": si la caja reintenta por una red floja,
 * un toggle lo volvería a encender.
 */
const productsRouter = require('./products');
const { audit } = require('../utils/auditLog');

router.patch('/productos/:id/disponible', tenantAuth, cajaVigente, async (req, res) => {
  try {
    // El catálogo de la caja usa "id:talla" para las variantes; se apaga el producto.
    const id = String(req.params.id || '').split(':')[0];
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Producto no válido' });
    if (typeof req.body?.disponible !== 'boolean') {
      return res.status(400).json({ message: 'Falta decir si está disponible' });
    }

    const businessId = req.user.businessId;
    const producto = await Product.findOne({ _id: id, businessId });
    if (!producto) return res.status(404).json({ message: 'Ese producto no es de este negocio' });

    if (producto.active !== req.body.disponible) {
      const antes = producto.toObject();
      producto.active = req.body.disponible;
      // Mueve updatedAt: es lo que hace que las demás cajas lo bajen.
      await producto.save();
      audit({
        action: 'toggle', resource: 'product', resourceId: producto._id, resourceName: producto.name,
        businessId, before: antes, after: producto.toObject(), req,
      });
      productsRouter.avisarCambioDeProductos(businessId, {
        type: 'toggled', productId: producto._id, active: producto.active,
      });
    }

    res.json({ ok: true, disponible: producto.active });
  } catch (error) {
    logger.error('Error marcando un agotado desde el POS', error, req);
    res.status(500).json({ message: 'No se pudo cambiar el producto' });
  }
});


/* GET /api/pos/personal — quién entra a esta caja y qué puede hacer.
 *
 * Lo define el dueño en el panel (Punto de venta → Personal). Si nunca lo
 * definió, van listas vacías y la caja sigue con sus usuarios locales. */
router.get('/personal', tenantAuth, cajaVigente, async (req, res) => {
  try {
    const PosPersonal = require('../Models/PosPersonal');
    const doc = await PosPersonal.findOne({ businessId: req.user.businessId }).lean();
    res.set('Cache-Control', 'no-store');
    res.json({
      roles: doc?.roles || [],
      usuarios: (doc?.usuarios || []).map((u) => ({
        id: String(u._id),
        nombre: u.nombre,
        pin_hash: u.pinHash,
        rol: u.rol,
        activo: u.activo !== false,
      })),
    });
  } catch (error) {
    logger.error('Error entregando el personal al POS', error, req);
    res.status(500).json({ message: 'No se pudo cargar el personal' });
  }
});


/* POST /api/pos/cortes — un corte Z que sube la caja por su cola.
 *
 * Idempotente por caja y número: un reintento responde "ya estaba". */
router.post('/cortes', tenantAuth, cajaVigente, async (req, res) => {
  try {
    const PosCorteZ = require('../Models/PosCorteZ');
    const inf = req.body || {};
    const numero = parseInt(inf.numero, 10);
    if (!Number.isInteger(numero) || numero < 1 || inf.tipo !== 'Z') {
      return res.status(400).json({ message: 'No es un corte Z válido' });
    }
    const cajaTokenId = req.caja?.tokenId || 'sin-caja';
    const businessId = req.user.businessId;
    const ya = await PosCorteZ.findOne({ businessId, cajaTokenId, numero }).select('_id').lean();
    if (ya) return res.json({ ok: true, duplicado: true });
    await PosCorteZ.create({
      businessId,
      cajaTokenId,
      cajaNombre: req.caja?.nombre || '',
      numero,
      desde: String(inf.desde || ''),
      hasta: String(inf.hasta || ''),
      cajero: String(inf.cajero || '').slice(0, 80),
      ventas: Number(inf.ventas) || 0,
      total: Number(inf.total) || 0,
      informe: inf,
    });
    res.status(201).json({ ok: true, duplicado: false });
  } catch (error) {
    if (error?.code === 11000) return res.json({ ok: true, duplicado: true });
    logger.error('Error guardando un corte Z', error, req);
    res.status(500).json({ message: 'No se pudo guardar el corte' });
  }
});


/* POST /api/pos/abonos — un abono recibido en la caja, por su cola.
 *
 * Idempotente por el id del abono: un reintento no abona dos veces. */
router.post('/abonos', tenantAuth, cajaVigente, async (req, res) => {
  try {
    const { clienteDeLaCaja, mover } = require('../services/credito');
    const a = req.body || {};
    const id = String(a.id || '').trim();
    const monto = Math.round(Number(a.monto) || 0);
    if (id.length < 8 || monto <= 0) return res.status(400).json({ message: 'Abono inválido' });
    const businessId = req.user.businessId;
    const cliente = await clienteDeLaCaja(businessId, { clienteId: a.cliente_id, telefono: a.cliente_telefono });
    if (!cliente) return res.status(400).json({ message: 'No se encontró el cliente del abono' });
    const r = await mover({
      businessId, customerId: cliente._id, tipo: 'abono', monto, origenId: id,
      medio: String(a.medio || 'efectivo').slice(0, 20), usuario: String(a.cajero || '').slice(0, 80),
      referencia: req.caja?.nombre ? `Caja ${req.caja.nombre}` : 'Caja', fecha: a.creada_en,
    });
    res.status(r.duplicado ? 200 : 201).json({ ok: true, ...r });
  } catch (error) {
    logger.error('Error registrando un abono del POS', error, req);
    res.status(500).json({ message: 'No se pudo registrar el abono' });
  }
});


module.exports = router;
