const express = require('express');
const router = express.Router();

/**
 * @route GET /api/health
 * @desc Endpoint de health check para monitoreo
 * @access Public
 */
router.get('/', (req, res) => {
  try {
    // Información básica del sistema
    const healthInfo = {
      status: 'online',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      memory: process.memoryUsage()
    };
    
    return res.status(200).json(healthInfo);
  } catch (error) {
    console.error('Error en health check:', error);
    return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
  }
});

module.exports = router;
