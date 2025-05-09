const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const eventsRouter = require("./Routes/events");
const http = require("http");

// Cargar variables de entorno - ESTO DEBE IR PRIMERO
require('dotenv').config({ path: process.env.NODE_ENV === 'development' ? './env.development' : './.env' });

/**
 * Servidor principal de la aplicación
 * 
 * Este archivo configura:
 * - El servidor Express
 * - La conexión con MongoDB
 * - CORS para permitir solicitudes desde el frontend
 * - Server-Sent Events (SSE) para actualizaciones en tiempo real
 * - Las rutas de la API
 */

// Crear la aplicación Express PRIMERO
const app = express();
const server = http.createServer(app);

// Inicializar socket.io
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"]
  }
});

// Exponer io globalmente para usarlo en otros módulos
app.set('io', io);

// Inicializar lógica de sockets
require('./services/socketService').initSocket(io);

// Usar las variables de entorno
const MONGO_URI = process.env.MONGODB_URI;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

// Configurar CORS con los orígenes permitidos
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Ruta raíz para mostrar estado del backend
app.get('/', (req, res) => {
  res.json({ message: 'API SisRestaurantes funcionando' });
});

// Rutas API
app.use("/api/products", require("./Routes/products"));
app.use("/api/business-config", require("./Routes/businessConfig"));
app.use("/api/categories", require("./Routes/categories"));
app.use("/api/topping-groups", require("./Routes/toppingGroups"));
app.use("/api/auth", require("./Routes/auth"));
app.use("/api/tables", require("./Routes/tables"));
app.use("/api/orders", require("./Routes/orders"));
  
// Ruta específica para SSE
app.use("/events", eventsRouter);

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    message: "Error interno del servidor",
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    const port = process.env.PORT || 5000;
    server.listen(port, () =>
      console.log(`Server running on port ${port}`)
    );

    // Manejar cierre graceful del servidor
    process.on('SIGTERM', () => {
      console.log('SIGTERM recibido. Cerrando servidor...');
      server.close(() => {
        console.log('Servidor cerrado.');
        process.exit(0);
      });
    });
  })
  .catch((err) => console.error("Error de conexión a MongoDB:", err));
