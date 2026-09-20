const express = require('express');
const router = express.Router();
const Devolucion = require('../Models/Devolucion');
const Order = require('../Models/Order');
const CompletedOrder = require('../Models/CompletedOrder');
const { tenantAuth } = require('../middleware/tenantAuth');
const { isValidObjectId } = require('../utils/validators');
const { moverStock } = require('../services/inventario');
const { validarLineas, normalizarCambio, calcularPlata } = require('../utils/devoluciones');
const socketService = require('../services/socketService');
const logger = require('../utils/logger');

/**
 * Devoluciones y cambios de una tienda.
 *
 * Tres reglas que no se negocian, y son las mismas que ya rigen los pedidos:
 *
 * 1. El precio sale del pedido, no de quien llama. Si no, devolver una
 *    camiseta de 40.000 por 400.000 sería cuestión de editar un número.
 * 2. No se puede devolver más de lo que se compró, contando lo ya devuelto
 *    antes en ese mismo pedido.
 * 3. El inventario se mueve una sola vez, cuando el producto de verdad llega
 *    a la tienda. Ni al registrar la solicitud ni cada vez que alguien toque
 *    el estado.
 */

/** El pedido, esté activo o ya archivado. */
async function buscarPedido(businessId, orderId) {
  if (!orderId || !isValidObjectId(orderId)) return null;
  const filtro = { _id: orderId, businessId };
  return (await Order.findOne(filtro).select('orderNumber items customerName phone').lean())
    || (await CompletedOrder.findOne(filtro).select('orderNumber items customerName phone').lean());
}

/** Cuánto de ese pedido ya se devolvió antes, por línea. */
async function yaDevuelto(businessId, orderId) {
  const previas = await Devolucion.find({
    businessId,
    orderId,
    estado: { $ne: 'rechazada' },
  }).select('items').lean();

  return previas.flatMap((d) => d.items || []);
}

/* POST / — registrar una devolución o un cambio. */
router.post('/', tenantAuth, async (req, res) => {
  try {
    const businessId = req.user?.businessId || req.body.businessId;
    if (!businessId) return res.status(400).json({ message: 'businessId es requerido' });

    const { orderId, tipo, motivo, nota, reingresaStock, cambioPor } = req.body;
    if (!['devolucion', 'cambio'].includes(tipo)) {
      return res.status(400).json({ message: 'El tipo debe ser devolucion o cambio' });
    }

    const pedidos = Array.isArray(req.body.items) ? req.body.items : [];
    if (!pedidos.length) return res.status(400).json({ message: 'Hay que decir qué se devuelve' });

    const pedido = await buscarPedido(businessId, orderId);
    if (orderId && !pedido) return res.status(404).json({ message: 'Pedido no encontrado' });

    const devueltas = pedido ? await yaDevuelto(businessId, pedido._id) : [];

    const validadas = validarLineas(pedido, devueltas, pedidos);
    if (!validadas.ok) return res.status(400).json({ message: validadas.error });

    const items = validadas.items;
    const llevaEnCambio = tipo === 'cambio' ? normalizarCambio(cambioPor) : [];
    const plata = calcularPlata(tipo, items, llevaEnCambio);

    const devolucion = await Devolucion.create({
      businessId,
      orderId: pedido?._id || null,
      orderNumber: pedido?.orderNumber || String(req.body.orderNumber || ''),
      tipo,
      motivo: Devolucion.MOTIVOS.includes(motivo) ? motivo : 'otro',
      nota: String(nota || '').slice(0, 500),
      items,
      cambioPor: llevaEnCambio,
      montoDevuelto: plata.montoDevuelto,
      diferencia: plata.diferencia,
      reingresaStock: reingresaStock !== false,
      customerName: pedido?.customerName || String(req.body.customerName || '').slice(0, 120),
      phone: pedido?.phone || String(req.body.phone || '').slice(0, 30),
      userId: req.user?.id || null,
      userName: req.user?.name || '',
    });

    logger.info('Devolución registrada', { id: String(devolucion._id), tipo, businessId: String(businessId) });
    socketService.emitToBusiness(String(businessId), 'devolucion-creada', { id: String(devolucion._id) });

    res.status(201).json(devolucion);
  } catch (error) {
    logger.error('Error registrando la devolución', error, req);
    res.status(500).json({ message: 'No se pudo registrar la devolución' });
  }
});

/* GET / — el listado del panel. */
router.get('/', tenantAuth, async (req, res) => {
  try {
    const businessId = req.user?.businessId || req.query.businessId;
    if (!businessId) return res.status(400).json({ message: 'businessId es requerido' });

    const filtro = { businessId };
    if (req.query.estado && Devolucion.ESTADOS.includes(req.query.estado)) filtro.estado = req.query.estado;
    if (req.query.orderId && isValidObjectId(req.query.orderId)) filtro.orderId = req.query.orderId;

    const limite = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const devoluciones = await Devolucion.find(filtro).sort({ createdAt: -1 }).limit(limite).lean();

    /* Un resumen corto: cuántas están esperando el producto y cuánta plata se
       fue en devoluciones. Es lo que el negocio mira primero. */
    const todas = await Devolucion.find({ businessId, estado: { $ne: 'rechazada' } })
      .select('estado montoDevuelto tipo motivo').lean();

    res.json({
      devoluciones,
      resumen: {
        total: todas.length,
        pendientes: todas.filter((d) => d.estado === 'pendiente').length,
        porResolver: todas.filter((d) => d.estado === 'recibida').length,
        montoDevuelto: todas.reduce((t, d) => t + (Number(d.montoDevuelto) || 0), 0),
        cambios: todas.filter((d) => d.tipo === 'cambio').length,
        motivoMasComun: Object.entries(
          todas.reduce((acc, d) => ({ ...acc, [d.motivo]: (acc[d.motivo] || 0) + 1 }), {}),
        ).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
      },
    });
  } catch (error) {
    logger.error('Error listando devoluciones', error, req);
    res.status(500).json({ message: 'No se pudieron cargar las devoluciones' });
  }
});

/* PATCH /:id/estado — avanzar la devolución. */
router.patch('/:id/estado', tenantAuth, async (req, res) => {
  try {
    const businessId = req.user?.businessId || req.body.businessId;
    const { estado } = req.body;
    if (!Devolucion.ESTADOS.includes(estado)) {
      return res.status(400).json({ message: 'Estado inválido' });
    }
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Id inválido' });
    }

    const devolucion = await Devolucion.findOne({ _id: req.params.id, businessId });
    if (!devolucion) return res.status(404).json({ message: 'Devolución no encontrada' });

    /* El inventario se mueve al recibir el producto, no antes: mientras el
       cliente no haya traído la camiseta, esa talla no está disponible por más
       que la devolución esté registrada. Y una sola vez, pase lo que pase
       después con el estado. */
    if (estado === 'recibida' && !devolucion.stockMovido) {
      if (devolucion.reingresaStock) {
        await moverStock(devolucion.items, +1, {
          businessId,
          type: 'return',
          orderId: devolucion.orderId,
          orderNumber: devolucion.orderNumber,
          userId: req.user?.id || null,
          userName: req.user?.name || '',
          note: `Devolución ${devolucion.tipo === 'cambio' ? '(cambio)' : ''} · ${devolucion.motivo}`.trim(),
        });
      }
      // En un cambio, lo que se lleva en reemplazo sale del inventario.
      if (devolucion.tipo === 'cambio' && devolucion.cambioPor?.length) {
        await moverStock(devolucion.cambioPor, -1, {
          businessId,
          type: 'sale',
          orderId: devolucion.orderId,
          orderNumber: devolucion.orderNumber,
          userId: req.user?.id || null,
          userName: req.user?.name || '',
          note: 'Entregado en un cambio',
        });
      }
      devolucion.stockMovido = true;
      devolucion.recibidaAt = new Date();
    }

    if (estado === 'resuelta') devolucion.resueltaAt = new Date();
    devolucion.estado = estado;
    await devolucion.save();

    socketService.emitToBusiness(String(businessId), 'devolucion-actualizada', { id: String(devolucion._id), estado });
    res.json(devolucion);
  } catch (error) {
    logger.error('Error actualizando la devolución', error, req);
    res.status(500).json({ message: 'No se pudo actualizar la devolución' });
  }
});

module.exports = router;
