const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { formatHttpError } = require('../utils/errorFormatter');

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
    logger.error('Error en health check', error, req);
    return res.status(500).json(formatHttpError(req, 'Error interno del servidor', 500));
  }
});

module.exports = router;
