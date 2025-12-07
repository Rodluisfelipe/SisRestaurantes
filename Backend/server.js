const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const path = require("path");

// Cargar variables de entorno - ESTO DEBE IR PRIMERO
require('dotenv').config();

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

// Usar las variables de entorno
const MONGO_URI = process.env.MONGODB_URI;
const isProd = process.env.NODE_ENV === 'production';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://menuby.tech', 'https://menuby.tech', 'https://www.menuby.tech', 'http://127.0.0.1:5173', 'http://localhost:5173', 'https://157-245-125-216.nip.io'];

// Crear la aplicación Express PRIMERO
const app = express();
const server = http.createServer(app);

// Inicializar socket.io
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      // Permitir solicitudes sin origen
      if (!origin) return callback(null, true);
      
      // Verificar si el origen está en la lista de permitidos
      if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log(`Origen no permitido (Socket.io): ${origin}`);
        callback(null, true); // Permitir cualquier origen en producción para mayor flexibilidad
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  }
});

// Exponer io globalmente para usarlo en otros módulos
app.set('io', io);

// Inicializar lógica de sockets
require('./services/socketService').initSocket(io);

// Configurar CORS con los orígenes permitidos
app.use(cors({
  origin: function (origin, callback) {
    // Permitir solicitudes sin origen (como aplicaciones móviles o curl)
    if (!origin) return callback(null, true);
    
    // Verificar si el origen está en la lista de permitidos
    if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`Origen no permitido: ${origin}`);
      callback(null, true); // Permitir cualquier origen en producción para mayor flexibilidad
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Manejar peticiones OPTIONS explícitamente
app.options('*', cors());

app.use(express.json());

// Servir archivos estáticos desde la carpeta uploads
app.use('/uploads', express.static('uploads'));

// Endpoint de prueba para verificar archivos
app.get('/test-uploads', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const uploadsDir = path.join(__dirname, 'uploads', 'banners');
    const files = fs.readdirSync(uploadsDir);
    
    res.json({
      success: true,
      message: 'Archivos encontrados en uploads/banners',
      files: files,
      baseUrl: `${req.protocol}://${req.get('host')}/uploads/banners/`
    });
  } catch (error) {
    res.json({
      success: false,
      message: 'Error al leer archivos',
      error: error.message
    });
  }
});

// Rutas API original
app.use("/api/products", require("./Routes/products"));
app.use("/api/business-config", require("./Routes/businessConfig"));
app.use("/api/businesses", require("./Routes/businesses")); // Catálogo de restaurantes
app.use("/api/banners", require("./Routes/banners")); // Gestión de banners promocionales
app.use("/api/categories", require("./Routes/categories"));
app.use("/api/topping-groups", require("./Routes/toppingGroups"));
app.use("/api/customers", require("./Routes/customers"));
app.use("/api/coupons", require("./Routes/coupons"));
app.use("/api/auth", require("./Routes/auth"));
app.use("/api/tables", require("./Routes/tables"));
app.use("/api/orders", require("./Routes/orders"));
app.use("/api/favorites", require("./Routes/favorites")); // Productos favoritos del cliente
app.use("/api/delivery-zones", require("./Routes/deliveryZones")); // Zonas de entrega
app.use("/api/push", require("./Routes/push")); // Push notifications (PWA)
app.use("/api/health", require("./Routes/health")); // Health check endpoint para Uptime Robot
app.use("/api/debug", require("./Routes/debug")); // Debug endpoints para Socket.IO

// Rutas específicas para superadmin (integradas desde BackendSA)
app.use("/api/superadmin/auth", require("./Routes/authSuperAdmin"));
app.use("/api/superadmin", require("./Routes/superadmin"));
// Importante: paymentRequests debe ir ANTES de subscriptions para que /api/subscription/me se procese correctamente
app.use("/api", require("./Routes/paymentRequests"));
app.use("/api/subscriptions", require("./Routes/subscriptions"));
app.use("/api/admin/subscriptions", require("./Routes/adminSubscriptions"));
app.use("/api/coupons", require("./Routes/coupons"));
app.use("/api/whatsapp-templates", require("./Routes/whatsappTemplates"));

// Servir archivos de comprobantes
app.use('/uploads/proofs', express.static(path.join(__dirname, 'uploads/proofs')));
  
// Ruta específica para SSE
app.use("/events", require("./Routes/events"));

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
    
    // Configurar VAPID para push notifications (opcional - no bloquear inicio si falla)
    // Intentar cargar pushService de forma segura
    let pushService = null;
    try {
      pushService = require('./services/pushService');
    } catch (error) {
      console.warn('⚠️ Push notifications no disponibles (web-push no instalado):', error.message);
    }
    
    if (pushService && pushService.configureVapid) {
      try {
        pushService.configureVapid();
      } catch (error) {
        console.warn('⚠️ Error configurando VAPID:', error.message);
      }
    }
    
    const port = process.env.PORT || 5000;
    server.listen(port, () =>
      console.log(`Servidor unificado (Backend + BackendSA) corriendo en el puerto ${port}`)
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
