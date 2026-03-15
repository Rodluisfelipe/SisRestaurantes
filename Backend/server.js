const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const path = require("path");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoSanitize = require("express-mongo-sanitize");
const compression = require("compression");
const Sentry = require("@sentry/node");

// Cargar variables de entorno - ESTO DEBE IR PRIMERO
require('dotenv').config();

// Inicializar Sentry - Monitoreo de errores en producción
Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.NODE_ENV || 'development',
  enabled: process.env.NODE_ENV === 'production' && !!process.env.SENTRY_DSN,
  // Performance monitoring - captura 20% de transacciones
  tracesSampleRate: 0.2,
  // Do NOT send PII (GDPR compliance)
  sendDefaultPii: false,
});

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
// CORS: prefer ALLOWED_ORIGINS env var. Fallback includes nip.io for backward compat.
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
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-business-id"],
    credentials: true
  }
});

// Exponer io globalmente para usarlo en otros módulos
app.set('io', io);

// Trust first proxy (nginx) — necessary for express-rate-limit and req.ip behind reverse proxy
app.set('trust proxy', 1);

// Inicializar lógica de sockets
require('./services/socketService').initSocket(io);

// Configurar CORS con los orígenes permitidos
app.use(cors({
  origin: function (origin, callback) {
    // No Origin header = not a cross-origin browser request (curl, Wget, mobile apps, healthchecks)
    // These are safe to allow — CORS is a browser-only mechanism
    if (!origin) {
      return callback(null, true);
    }
    
    // Reject literal "null" origin from sandboxed iframes in production
    if (origin === 'null' && isProd) {
      return callback(new Error('Null origin not allowed'));
    }
    
    // Verificar si el origen está en la lista de permitidos
    if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-business-id', 'x-customer-token'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
  
}));

// Manejar peticiones OPTIONS explícitamente
app.options('*', cors());

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  },
  strictTransportSecurity: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  crossOriginOpenerPolicy: { policy: 'same-origin' }
}));

// Request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

app.use(compression());

app.use(express.json());

// NoSQL injection sanitization
app.use(mongoSanitize());

// Servir archivos estáticos — solo banners/announcements públicamente
// Proofs y order-proofs requieren auth (servidos por endpoints dedicados)
app.use('/uploads/banners', express.static('uploads/banners'));
app.use('/uploads/announcements', express.static('uploads/announcements'));
app.use('/uploads/products', express.static('uploads/products'));

// Authenticated access to payment proofs and order proofs
// Accepts token via Authorization header OR ?token= query param (for <img> tags)
const jwt = require('jsonwebtoken');
const proofAuth = (req, res, next) => {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
};
app.use('/uploads/proofs', proofAuth, express.static('uploads/proofs'));
app.use('/uploads/order-proofs', proofAuth, express.static('uploads/order-proofs'));

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
app.use("/api/floors", require("./Routes/floors"));
app.use("/api/orders", require("./Routes/orders"));
app.use("/api/favorites", require("./Routes/favorites")); // Productos favoritos del cliente
app.use("/api/delivery-zones", require("./Routes/deliveryZones")); // Zonas de entrega
app.use("/api/delivery-admin", require("./Routes/deliveryAdmin")); // Gestión de domiciliarios (admin)
app.use("/api/delivery", require("./Routes/deliveryPublic")); // Endpoints públicos de domiciliarios
app.use("/api/restaurants", require("./Routes/deliveryPublic")); // Rutas públicas /restaurants/:slug/domi y /track
app.use("/api/reviews", require("./Routes/reviews")); // Reseñas de clientes
app.use("/api/bookings", require("./Routes/bookings")); // Bookings / appointments for service businesses
app.use("/api/email", require("./Routes/email")); // Email configuration and test
app.use("/api/push", require("./Routes/push")); // Push notifications (PWA)
app.use("/api/upload", require("./Routes/upload")); // Subida de imágenes a DigitalOcean Spaces
app.use("/api/health", require("./Routes/health")); // Health check endpoint para Uptime Robot
app.use("/api/help-chat", require("./Routes/helpChat")); // Asistente IA de ayuda (Groq)
app.use("/api/ai-tools", require("./Routes/aiTools")); // Herramientas IA (nombres, respuestas a reseñas)
app.use("/api/dashboard", require("./Routes/dashboard")); // Dashboard de métricas admin
app.use("/api/cash-register", require("./Routes/cashRegister")); // POS - Caja registradora
// Debug endpoints - solo disponibles en desarrollo
if (process.env.NODE_ENV !== 'production') {
  app.use("/api/debug", require("./Routes/debug"));
}

// Rutas específicas para superadmin (integradas desde BackendSA)
app.use("/api/superadmin/auth", require("./Routes/authSuperAdmin"));
app.use("/api/superadmin", require("./Routes/superadmin"));
// Importante: paymentRequests debe ir ANTES de subscriptions para que /api/subscription/me se procese correctamente
app.use("/api", require("./Routes/paymentRequests"));
app.use("/api/subscriptions", require("./Routes/subscriptions"));
app.use("/api/admin/subscriptions", require("./Routes/adminSubscriptions"));
app.use("/api/whatsapp-templates", require("./Routes/whatsappTemplates"));
app.use("/api/announcements", require("./Routes/announcements")); // Sistema de anuncios/novedades
app.use("/api/loyalty", require("./Routes/loyalty")); // Programa de fidelidad
app.use("/api/epayco", require("./Routes/epaycoPayments")); // Pagos automáticos ePayco
app.use("/api/dlocal", require("./Routes/dlocalPayments")); // Pagos automáticos dLocal Go

// Ruta específica para SSE
app.use("/events", require("./Routes/events"));

// Sentry error handler - DEBE ir antes del manejador de errores genérico
Sentry.setupExpressErrorHandler(app);

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    message: "Error interno del servidor",
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    sentryId: res.sentry // ID del error en Sentry para referencia
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
    
    // Iniciar cron de recordatorios de suscripción
    try {
      const { startSubscriptionCron } = require('./services/subscriptionCron');
      startSubscriptionCron();
    } catch (error) {
      console.warn('⚠️ Error iniciando cron de suscripciones:', error.message);
    }
    
    // Cron de cierre automático a medianoche Colombia
    try {
      const { startOrderCleanupCron } = require('./services/orderCleanupCron');
      startOrderCleanupCron();
    } catch (error) {
      console.warn('⚠️ Error iniciando cron de limpieza de pedidos:', error.message);
    }

    // Cron de recordatorios de citas/bookings
    try {
      const { startBookingReminderCron } = require('./services/bookingReminderCron');
      startBookingReminderCron();
    } catch (error) {
      console.warn('⚠️ Error iniciando cron de recordatorios de citas:', error.message);
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
