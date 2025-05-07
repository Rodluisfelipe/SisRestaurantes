const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const eventsRouter = require("./Routes/events");
const http = require("http");
const fs = require("fs");
const path = require("path");

// Cargar configuración desde config.json
let config;
try {
  const configPath = path.join(__dirname, '../config.json');
  const configData = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(configData);
  console.log("Configuración cargada correctamente desde config.json");
} catch (error) {
  console.error("Error al cargar config.json:", error);
  config = {
    mongodb_uri: "mongodb://localhost:27017/restaurante",
    backend_url: "http://localhost:5000/api",
    frontend_url: "http://localhost:5173"
  };
  console.log("Usando configuración por defecto");
}

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

// Usar la configuración
const MONGO_URI = config.mongodb_uri;
const ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173', config.frontend_url].filter(Boolean);

// Configurar CORS con los orígenes permitidos
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

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
