const express = require("express");
const router = express.Router();
const eventService = require('../services/eventService');
const authMiddleware = require('../middleware/authMiddleware');

// Proteger SSE con autenticación
router.use(authMiddleware);

// Middleware para configurar la respuesta SSE
const setSSEHeaders = (req, res, next) => {
  // Require businessId for tenant isolation
  const businessId = req.query.businessId || req.user.businessId;
  if (!businessId) {
    return res.status(400).json({ message: 'businessId is required for SSE' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  
  // Enviar un comentario inicial para mantener la conexión
  res.write(':\n\n');
  
  const client = res;
  req._sseBusinessId = businessId.toString();
  eventService.addClient(client, req._sseBusinessId);
  
  // Mantener la conexión viva
  const keepAlive = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch (err) {
      clearInterval(keepAlive);
      eventService.removeClient(client, req._sseBusinessId);
    }
  }, 30000);
  
  // Manejar desconexión del cliente
  req.on('close', () => {
    clearInterval(keepAlive);
    eventService.removeClient(client, req._sseBusinessId);
  });
  
  next();
};

// Ruta para establecer la conexión SSE
router.get("/", setSSEHeaders, (req, res) => {
  // Enviar un evento inicial para confirmar la conexión
  const initialData = JSON.stringify({
    type: 'connection',
    message: 'Conexión establecida'
  });
  res.write(`data: ${initialData}\n\n`);
});

module.exports = router; 