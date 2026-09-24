const express = require('express');
const router = express.Router();
const { tenantAuth } = require('../middleware/tenantAuth');
const CompletedOrder = require('../Models/CompletedOrder');
const Product = require('../Models/Product');
const Supply = require('../Models/Supply');
const Category = require('../Models/Category');
const logger = require('../utils/logger');
const { calcular } = require('../utils/rentabilidad');
const { rango } = require('./posPanel');

/**
 * GET /api/rentabilidad — ventas, costo, utilidad y margen de un periodo.
 *
 * Junta la caja y el menú, como Completados: es un informe del negocio, no de
 * un canal. El cálculo vive en utils/rentabilidad.js.
 */
router.get('/', tenantAuth, async (req, res) => {
  try {
    if (req.user?.scope === 'pos') return res.status(403).json({ message: 'Esta consulta es del panel' });
    // Costos y márgenes son del dueño, no del personal del panel.
    if (req.user?.role === 'staff') return res.status(403).json({ message: 'Solo el administrador ve la rentabilidad' });
    const businessId = req.user?.businessId || req.query.businessId;
    if (!businessId) return res.status(400).json({ message: 'businessId es requerido' });
    const { inicio, fin } = rango(req.query);

    const pedidos = await CompletedOrder.find({
      businessId,
      status: { $ne: 'cancelled' },
      completedAt: { $gte: inicio, $lte: fin },
    })
      .select('items.productId items.name items.price items.quantity items.variante discountAmount')
      .lean();

    const ids = [...new Set(pedidos.flatMap((p) => (p.items || []).map((i) => String(i.productId || ''))).filter(Boolean))];
    const [productos, insumos, categorias] = await Promise.all([
      Product.find({ _id: { $in: ids }, businessId }).select('name category cost recipe variantes').lean(),
      Supply.find({ businessId }).select('cost').lean(),
      Category.find({ businessId }).select('name').lean(),
    ]);

    const informe = calcular(
      pedidos,
      Object.fromEntries(productos.map((p) => [String(p._id), p])),
      Object.fromEntries(insumos.filter((s) => typeof s.cost === 'number').map((s) => [String(s._id), s.cost])),
      Object.fromEntries(categorias.map((c) => [String(c._id), c.name])),
    );
    res.json({ desde: inicio, hasta: fin, pedidos: pedidos.length, ...informe });
  } catch (error) {
    logger.error('Error calculando la rentabilidad', error, req);
    res.status(500).json({ message: 'No se pudo calcular la rentabilidad' });
  }
});

module.exports = router;
