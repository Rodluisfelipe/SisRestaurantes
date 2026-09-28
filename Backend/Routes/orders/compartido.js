/**
 * Pedidos — Piezas que usan varias partes de los pedidos: número de pedido, llave del
 * cliente, quién es personal del negocio, límites por IP, subida de
 * comprobantes y el total de una línea.
 *
 * Parte de Routes/orders/ (ver index.js para el orden de montaje).
 */
const jwt = require("jsonwebtoken");
const Order = require("../../Models/Order");
const CompletedOrder = require("../../Models/CompletedOrder");
const { ObjectId } = require("mongoose").Types;
const logger = require("../../utils/logger");
const rateLimit = require('express-rate-limit');
const Counter = require('../../Models/Counter');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// Multer config for payment proof uploads — scoped by order ID for tenant isolation
const proofStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use order ID from URL params to scope uploads
    const orderId = req.params.id || 'unknown';
    const safeId = orderId.replace(/[^a-zA-Z0-9]/g, '');
    const dir = path.join(__dirname, '..', '..', 'uploads', 'order-proofs', safeId);
    const fs = require('fs');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, 'proof-' + uniqueSuffix + ext);
  }
});

const uploadProof = multer({
  storage: proofStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for mobile photos
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'image/heic', 'image/heif'                 // iPhone
    ];
    if (allowedMimes.includes(file.mimetype.toLowerCase())) {
      return cb(null, true);
    }
    // Also check extension as fallback (some Android browsers don't set mimetype)
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];
    if (allowedExts.includes(ext)) {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten imágenes (jpg, png, webp)'));
  }
});

// Rate limiter for public order creation (by IP)
const createOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 orders per IP per 15 minutes
  message: { message: 'Demasiados pedidos. Intente nuevamente en unos minutos.' }
});

// Rate limiter per phone+businessId — prevents rapid duplicate orders from same customer
const orderPhoneLimiter = rateLimit({
  windowMs: 5 * 1000, // 5 seconds
  max: 1,
  keyGenerator: (req) => {
    const phone = req.body?.customerPhone || req.body?.phone || 'no-phone';
    const businessId = req.body?.businessId || 'no-biz';
    return `order:${businessId}:${phone}`;
  },
  message: { message: 'Pedido duplicado. Espere unos segundos antes de intentar de nuevo.', code: 'ORDER_RATE_LIMITED' },
  skipFailedRequests: true
});

// Rate limiter for public order tracking/history
const publicOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { message: 'Demasiadas consultas. Intente nuevamente más tarde.' }
});

// Separate rate limiter for chat messages (more generous)
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 15,
  message: { message: 'Demasiados mensajes. Espera un momento.' }
});

// Generate a customer token for order tracking
const generateCustomerToken = () => {
  return crypto.randomBytes(16).toString('hex');
};

/**
 * Mayor número de pedido de un negocio, comparando como NÚMERO.
 *
 * orderNumber se guarda como texto, y antes se buscaba el mayor con
 * .sort({ orderNumber: -1 }), que ordena alfabéticamente: "9" queda por
 * encima de "4187" porque compara el primer carácter. El contador se
 * inicializaba entonces en 9 —o en 999— y volvía a repartir números que ya
 * existían.
 *
 * Eso dejó 270 números repetidos solo en el negocio más activo: dos pedidos
 * distintos con el mismo #, que es un problema serio cuando el cliente
 * reclama por "el pedido 45" o cuando cocina compara con el ticket.
 */
async function mayorNumeroDePedido(businessId, Booking) {
  const bid = new ObjectId(businessId.toString());
  const mayorDe = async (Modelo) => {
    const r = await Modelo.aggregate([
      { $match: { businessId: bid } },
      // Los que no son numéricos se descartan; hubo números por timestamp
      // cuando el contador fallaba, y esos dispararían el contador al futuro.
      { $project: { n: { $convert: { input: '$orderNumber', to: 'int', onError: 0, onNull: 0 } } } },
      { $match: { n: { $lt: 1000000 } } },
      { $group: { _id: null, max: { $max: '$n' } } },
    ]);
    return r[0]?.max || 0;
  };

  const [a, c, b] = await Promise.all([
    mayorDe(Order),
    mayorDe(CompletedOrder),
    mayorDe(Booking),
  ]);
  return Math.max(a, c, b);
}

// Helper function to get order number (shared with bookings) — ATOMIC
const generateOrderNumber = async (businessId) => {
  try {
    const counterId = `orderNumber:${businessId.toString()}`;
    
    // Check if counter exists; if not, seed it from existing data
    const existing = await Counter.findById(counterId);
    if (!existing) {
      const Booking = require('../../Models/Booking');
      const highest = await mayorNumeroDePedido(businessId, Booking);

      // Seed counter — use $max to avoid overwriting if another request seeded first
      await Counter.findOneAndUpdate(
        { _id: counterId },
        { $max: { seq: highest } },
        { upsert: true }
      );
    }
    
    // Atomic increment — no race conditions possible
    const counter = await Counter.findOneAndUpdate(
      { _id: counterId },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    
    return counter.seq.toString();
  } catch (error) {
    // Fallback to timestamp-based order number
    logger.error('Error generating atomic order number, using fallback', error);
    return Date.now().toString();
  }
};

/**
 * ¿Quien pide viene con un token válido del negocio?
 *
 * Antes el salto de los límites dependía de `orderChannel` del cuerpo, o sea de
 * un dato que escribe quien llama: bastaba mandar `orderChannel: 'admin'` para
 * saltarse los límites pensados para comensales, y este endpoint es público.
 * Ahora depende de la firma del token, que no se puede inventar.
 *
 * De paso arregla lo contrario: el personal que toma un pedido desde un chat de
 * WhatsApp manda `orderChannel: 'whatsapp'` —que es de donde viene de verdad— y
 * antes eso lo habría metido en la cola de límites de los comensales.
 */
function esPersonalDelNegocio(req) {
  const cabecera = req.headers.authorization || '';
  if (!cabecera.startsWith('Bearer ')) return false;
  try {
    const decoded = jwt.verify(cabecera.slice(7), process.env.JWT_SECRET);
    // Cualquier token nuestro válido: admin, staff o superadmin.
    return !!decoded?.id;
  } catch {
    return false;
  }
}

/* ¿Quien hace la petición es personal de ESTE negocio (o superadmin)? Cargar a
   crédito es prestar plata del negocio: no basta con cualquier token válido. */
async function personalDeEsteNegocio(req, businessId) {
  const cabecera = req.headers.authorization || '';
  if (!cabecera.startsWith('Bearer ')) return false;
  try {
    const decoded = jwt.verify(cabecera.slice(7), process.env.JWT_SECRET);
    if (decoded?.role === 'superadmin') return true;
    if (!decoded?.id) return false;
    const Admin = require('../../Models/Admin');
    const quien = await Admin.findById(decoded.id).select('businessId').lean();
    return !!quien && String(quien.businessId) === String(businessId);
  } catch {
    return false;
  }
}

/* Precio de una línea con sus adiciones incluidas. Mismo criterio que usa
   add-items para no separarse con el tiempo. */
function lineTotal(item) {
  const toppings = (item.selectedToppings || []).reduce((ts, t) => {
    let tp = Number(t.price) || 0;
    if (Array.isArray(t.subGroups)) {
      tp += t.subGroups.reduce((ss, sg) => ss + (Number(sg.price) || 0), 0);
    }
    return ts + tp;
  }, 0);
  return ((Number(item.price) || 0) + toppings) * (Number(item.quantity) || 0);
}

module.exports = {
  proofStorage,
  uploadProof,
  createOrderLimiter,
  orderPhoneLimiter,
  publicOrderLimiter,
  chatLimiter,
  generateCustomerToken,
  mayorNumeroDePedido,
  generateOrderNumber,
  esPersonalDelNegocio,
  personalDeEsteNegocio,
  lineTotal,
};
