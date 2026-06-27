const express = require('express');
const router = express.Router();
const BusinessConfig = require('../Models/BusinessConfig');
const Product = require('../Models/Product');
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

// GET /api/marketplace/suppliers — lista de proveedores aprobados
router.get('/suppliers', authMiddleware, async (req, res) => {
  try {
    const suppliers = await BusinessConfig.find(
      { isSupplier: true, isActive: true },
      'businessName slug logo description supplierInfo address whatsappNumber'
    ).lean();
    res.json({ success: true, suppliers });
  } catch (error) {
    logger.error('Error fetching marketplace suppliers', error, req);
    res.status(500).json({ message: 'Error al obtener proveedores' });
  }
});

// GET /api/marketplace/products — productos de todos los proveedores
router.get('/products', authMiddleware, async (req, res) => {
  try {
    const { supplierId, category, search } = req.query;

    // Obtener IDs de todos los proveedores activos
    const supplierQuery = { isSupplier: true, isActive: true };
    if (supplierId) supplierQuery._id = supplierId;

    const suppliers = await BusinessConfig.find(supplierQuery, '_id businessName slug logo supplierInfo').lean();
    const supplierIds = suppliers.map(s => s._id);
    const supplierMap = Object.fromEntries(suppliers.map(s => [String(s._id), s]));

    if (!supplierIds.length) return res.json({ success: true, products: [] });

    const productQuery = { businessId: { $in: supplierIds }, active: true };
    if (search) productQuery.name = { $regex: search, $options: 'i' };

    const products = await Product.find(productQuery)
      .select('name description price image businessId category')
      .lean();

    const enriched = products.map(p => ({
      ...p,
      supplier: supplierMap[String(p.businessId)] || null
    }));

    res.json({ success: true, products: enriched });
  } catch (error) {
    logger.error('Error fetching marketplace products', error, req);
    res.status(500).json({ message: 'Error al obtener productos del marketplace' });
  }
});

module.exports = router;
