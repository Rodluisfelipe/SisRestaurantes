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
    const [activeCount, completedCount, cities, businesses] = await Promise.all([
      Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
      CompletedOrder.countDocuments({ createdAt: { $gte: startOfMonth } }),
      BusinessConfig.distinct('city', { isActive: true, city: { $nin: [null, ''] } }),
      BusinessConfig.countDocuments({ isActive: true }),
    ]);

    const data = {
      ordersThisMonth: activeCount + completedCount,
      cities: Array.isArray(cities) ? cities.length : 0,
      businesses,
      updatedAt: now.toISOString(),
    };

    cache = { data, at: Date.now() };
    res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    res.json(data);
  } catch (e) {
    logger.warn('public stats error', { error: e.message });
    // Nunca romper la landing: devolver ceros y que el front oculte lo vacío.
    res.json({ ordersThisMonth: 0, cities: 0, businesses: 0, updatedAt: new Date().toISOString() });
  }
});

module.exports = router;
