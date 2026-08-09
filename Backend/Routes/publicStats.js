const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

/**
 * Estadísticas públicas y agregadas de toda la plataforma, para la landing.
 * No expone datos de ningún negocio en particular: solo totales.
 *
 * Se cachea en memoria porque es un endpoint público que puede recibir
 * mucho tráfico y las cifras no necesitan ser exactas al segundo.
 */
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos
let cache = { data: null, at: 0 };

router.get('/public', async (req, res) => {
  try {
    if (cache.data && Date.now() - cache.at < CACHE_TTL_MS) {
      return res.json(cache.data);
    }

    const Order = require('../Models/Order');
    const CompletedOrder = require('../Models/CompletedOrder');
    const BusinessConfig = require('../Models/BusinessConfig');

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Un pedido vive en Order O en CompletedOrder (se mueve al completarse),
    // así que sumar ambos por createdAt no duplica.
    /* Los totales históricos también salen de acá, y no escritos a mano en la
       landing: una cifra fija envejece y termina siendo mentira sin que nadie
       lo note. La página decía "500+ restaurantes" con 28 registrados. */
    const [activeCount, completedCount, cities, businesses, totalActivos, totalCompletados, ventas] = await Promise.all([
      Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
      CompletedOrder.countDocuments({ createdAt: { $gte: startOfMonth } }),
      BusinessConfig.distinct('city', { isActive: true, city: { $nin: [null, ''] } }),
      BusinessConfig.countDocuments({ isActive: true }),
      Order.estimatedDocumentCount(),
      CompletedOrder.estimatedDocumentCount(),
      CompletedOrder.aggregate([
        { $group: { _id: null, total: { $sum: { $ifNull: ['$totalAmount', 0] } } } },
      ]),
    ]);

    const data = {
      ordersThisMonth: activeCount + completedCount,
      cities: Array.isArray(cities) ? cities.length : 0,
      businesses,
      // Totales de toda la historia, para la prueba social de la landing.
      ordersTotal: totalActivos + totalCompletados,
      salesTotal: Math.round(ventas?.[0]?.total || 0),
      updatedAt: now.toISOString(),
    };

    cache = { data, at: Date.now() };
    res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    res.json(data);
  } catch (e) {
    logger.warn('public stats error', { error: e.message });
    // Nunca romper la landing: devolver ceros y que el front oculte lo vacío.
    res.json({
      ordersThisMonth: 0, cities: 0, businesses: 0,
      ordersTotal: 0, salesTotal: 0,
      updatedAt: new Date().toISOString(),
    });
  }
});

module.exports = router;
