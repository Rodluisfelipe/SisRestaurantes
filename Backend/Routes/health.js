const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * @route GET /api/health
 * @desc Comprehensive health check — used by Docker healthcheck and Uptime Robot
 * @access Public
 */
router.get('/', async (req, res) => {
  const start = Date.now();
  const checks = {};

  // 1. MongoDB connection
  try {
    const mongoState = mongoose.connection.readyState;
    // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
    checks.mongodb = mongoState === 1 ? 'ok' : `unhealthy (state=${mongoState})`;
    if (mongoState === 1) {
      // Ping to verify actual connectivity (fast op)
      await mongoose.connection.db.admin().ping();
    }
  } catch (err) {
    checks.mongodb = `error: ${err.message}`;
  }

  // 2. Memory usage
  const mem = process.memoryUsage();
  checks.memory = {
    rss_mb: Math.round(mem.rss / 1024 / 1024),
    heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
    heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
    external_mb: Math.round(mem.external / 1024 / 1024)
  };

  // 3. Uptime
  checks.uptime_seconds = Math.round(process.uptime());

  // 4. Response time
  checks.response_time_ms = Date.now() - start;

  // Determine overall status
  const isHealthy = checks.mongodb === 'ok' && checks.memory.rss_mb < 800;
  const statusCode = isHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    checks
  });
});

module.exports = router;
