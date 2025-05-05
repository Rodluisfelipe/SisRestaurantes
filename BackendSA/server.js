// server.js para BackendSA (Superadmin)
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const socketService = require('./socketService');
require('dotenv').config({ path: process.env.NODE_ENV === 'development' ? './env.development' : './.env' });

const app = express();
const server = http.createServer(app);

// Configuración de CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Rutas
app.use('/api/superadmin', require('./Routes/superadmin'));
app.use('/api/superadmin/auth', require('./Routes/auth'));

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Conexión a MongoDB y arranque del servidor
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sisrestaurantes';
const PORT = 5100;

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB conectado (BackendSA)');
    // Inicializar socket.io
    const io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization']
      }
    });
    socketService.initSocket(io);
    server.listen(PORT, () => {
      console.log(`BackendSA corriendo en el puerto ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Error de conexión a MongoDB:', err);
  }); 