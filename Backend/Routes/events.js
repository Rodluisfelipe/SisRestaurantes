const express = require("express");
const router = express.Router();
const eventService = require('../services/eventService');

// Middleware para configurar la respuesta SSE
const setSSEHeaders = (req, res, next) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  
  // Enviar un comentario inicial para mantener la conexión
  res.write(':\n\n');
  
  const client = res;
  eventService.addClient(client);
  
  // Mantener la conexión viva
  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 30000);
  
  // Manejar desconexión del cliente
  req.on('close', () => {
    clearInterval(keepAlive);
    eventService.removeClient(client);
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