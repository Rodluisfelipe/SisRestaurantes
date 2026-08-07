const express = require('express');
const router = express.Router();
const Supply = require('../Models/Supply');
const Product = require('../Models/Product');
const StockMovement = require('../Models/StockMovement');
const { tenantAuth } = require('../middleware/tenantAuth');
const logger = require('../utils/logger');

/**
 * Insumos — inventario avanzado.
 *
 * Un restaurante no controla "hamburguesas": controla pan, carne y queso.
 * Estas rutas manejan lo que el negocio compra, y las recetas enlazan cada
 * producto con lo que consume al venderse.
 */

const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

/** GET /api/supplies — listado con su estado */
router.get('/', tenantAuth, async (req, res) => {
  try {
    const businessId = req.user?.businessId || req.query.businessId;
    if (!businessId) return res.status(400).json({ message: 'businessId es requerido' });

    const insumos = await Supply.find({ businessId }).lean();

    const agotados = insumos.filter((s) => (s.stock ?? 0) <= 0);
    const bajos = insumos.filter((s) => {
      const v = s.stock ?? 0;
      return v > 0 && s.lowStockAlert > 0 && v <= s.lowStockAlert;
    });

    // Mismo criterio que el inventario de productos: primero lo que urge
    const peso = (s) => {
      const v = s.stock ?? 0;
      if (v <= 0) return 0;
      if (s.lowStockAlert > 0 && v <= s.lowStockAlert) return 1;
      return 2;
    };
    insumos.sort((a, b) => peso(a) - peso(b) || (a.name || '').localeCompare(b.name || ''));

    res.json({
      insumos,
      unidades: Supply.UNIDADES,
      resumen: {
        total: insumos.length,
        agotados: agotados.length,
        bajos: bajos.length,
        valorInventario: insumos.reduce((t, s) => t + (s.cost || 0) * Math.max(0, s.stock ?? 0), 0),
        sinCosto: insumos.filter((s) => s.cost == null).length,
      },
    });
  } catch (error) {
    logger.error('Error obteniendo insumos', error, req);
    res.status(500).json({ message: 'Error al obtener los insumos' });
  }
});

/** POST /api/supplies — crear */
router.post('/', tenantAuth, async (req, res) => {
  try {
    const businessId = req.user?.businessId || req.body.businessId;
    if (!businessId) return res.status(400).json({ message: 'businessId es requerido' });

    const { name, unit, stock, cost, lowStockAlert, supplier } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ message: 'El nombre es requerido' });

    const insumo = await Supply.create({
      businessId,
      name: String(name).trim(),
      unit: Object.keys(Supply.UNIDADES).includes(unit) ? unit : 'u',
      stock: Math.max(0, num(stock) || 0),
      cost: num(cost),
      lowStockAlert: Math.max(0, num(lowStockAlert) || 0),
      supplier: (supplier || '').trim(),
    });

    // El conteo inicial también deja rastro: si mañana no cuadra, se sabe de
    // dónde partió.
    if (insumo.stock > 0) {
      await StockMovement.create({
        businessId, supplyId: insumo._id, productName: insumo.name, unit: insumo.unit,
        type: 'initial', quantity: insumo.stock, stockBefore: 0, stockAfter: insumo.stock,
        userId: req.user?.id || null, note: 'Conteo inicial',
      }).catch(() => {});
    }

    res.status(201).json(insumo);
  } catch (error) {
    logger.error('Error creando insumo', error, req);
    res.status(500).json({ message: 'Error al crear el insumo' });
  }
});

/** PATCH /api/supplies/:id — ajustar existencias o datos */
router.patch('/:id', tenantAuth, async (req, res) => {
  try {
    const businessId = req.user?.businessId || req.body.businessId;
    const insumo = await Supply.findOne({ _id: req.params.id, ...(businessId ? { businessId } : {}) });
    if (!insumo) return res.status(404).json({ message: 'Insumo no encontrado' });

    const { name, unit, stock, cost, lowStockAlert, supplier, delta, motivo, nota } = req.body;
    const stockAntes = insumo.stock ?? 0;

    if (name !== undefined && String(name).trim()) insumo.name = String(name).trim();
    if (unit !== undefined && Object.keys(Supply.UNIDADES).includes(unit)) insumo.unit = unit;
    if (cost !== undefined) insumo.cost = num(cost);
    if (lowStockAlert !== undefined) insumo.lowStockAlert = Math.max(0, num(lowStockAlert) || 0);
    if (supplier !== undefined) insumo.supplier = (supplier || '').trim();

    /* delta suma sobre lo que haya, para que dos ajustes simultáneos no se
       pisen. stock fija un valor exacto, para el conteo físico. */
    if (delta !== undefined) {
      insumo.stock = Math.max(0, stockAntes + (num(delta) || 0));
    } else if (stock !== undefined) {
      insumo.stock = Math.max(0, num(stock) || 0);
    }

    await insumo.save();

    if (insumo.stock !== stockAntes) {
      await StockMovement.create({
        businessId: insumo.businessId,
        supplyId: insumo._id,
        productName: insumo.name,
        unit: insumo.unit,
        type: ['purchase', 'waste', 'adjust'].includes(motivo) ? motivo : 'adjust',
        quantity: insumo.stock - stockAntes,
        stockBefore: stockAntes,
        stockAfter: insumo.stock,
        userId: req.user?.id || null,
        note: (nota || '').slice(0, 200),
      }).catch(() => {});
    }

    res.json(insumo);
  } catch (error) {
    logger.error('Error ajustando insumo', error, req);
    res.status(500).json({ message: 'Error al ajustar el insumo' });
  }
});

/** DELETE /api/supplies/:id */
router.delete('/:id', tenantAuth, async (req, res) => {
  try {
    const businessId = req.user?.businessId || req.query.businessId;
    const insumo = await Supply.findOne({ _id: req.params.id, ...(businessId ? { businessId } : {}) });
    if (!insumo) return res.status(404).json({ message: 'Insumo no encontrado' });

    /* No se borra si alguna receta lo usa: dejaría platos consumiendo un
       insumo fantasma y el descuento fallaría en silencio. */
    const enUso = await Product.countDocuments({ 'recipe.supplyId': insumo._id });
    if (enUso > 0) {
      return res.status(409).json({
        message: `${enUso} producto(s) lo usan en su receta. Quítalo de esas recetas antes de eliminarlo.`,
        code: 'SUPPLY_IN_USE',
        productos: enUso,
      });
    }

    await Supply.deleteOne({ _id: insumo._id });
    res.json({ message: 'Insumo eliminado' });
  } catch (error) {
    logger.error('Error eliminando insumo', error, req);
    res.status(500).json({ message: 'Error al eliminar el insumo' });
  }
});

/** PUT /api/supplies/recipe/:productId — define qué consume un producto */
router.put('/recipe/:productId', tenantAuth, async (req, res) => {
  try {
    const businessId = req.user?.businessId || req.body.businessId;
    const producto = await Product.findOne({ _id: req.params.productId, ...(businessId ? { businessId } : {}) });
    if (!producto) return res.status(404).json({ message: 'Producto no encontrado' });

    const receta = Array.isArray(req.body.recipe) ? req.body.recipe : [];

    // Solo insumos del propio negocio: sin esto se podría enlazar el insumo
    // de otro y descontárselo al venderse este plato.
    const ids = receta.map((r) => r.supplyId).filter(Boolean);
    const propios = await Supply.find({ _id: { $in: ids }, businessId }).select('_id').lean();
    const validos = new Set(propios.map((s) => s._id.toString()));

    producto.recipe = receta
      .filter((r) => r.supplyId && validos.has(String(r.supplyId)) && Number(r.quantity) > 0)
      .map((r) => ({ supplyId: r.supplyId, quantity: Number(r.quantity) }));

    await producto.save();
    logger.info('Receta actualizada', { productId: producto._id.toString(), lineas: producto.recipe.length });

    res.json({ _id: producto._id, name: producto.name, recipe: producto.recipe });
  } catch (error) {
    logger.error('Error guardando la receta', error, req);
    res.status(500).json({ message: 'Error al guardar la receta' });
  }
});

module.exports = router;
