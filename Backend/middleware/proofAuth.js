const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Acceso a comprobantes de pago.
 *
 * Antes bastaba con presentar un JWT válido: se verificaba la firma y se
 * servía el archivo, sin mirar de quién era. Cualquiera que se registrara
 * podía descargar los comprobantes de CUALQUIER negocio con solo acertar el
 * nombre del archivo — recibos bancarios y datos personales ajenos.
 *
 * Ahora, además de la firma, se comprueba que quien pide sea el dueño:
 *   - superadmin ve todo (es quien aprueba los pagos de suscripción)
 *   - un negocio solo ve lo suyo
 *   - un admin de marca ve el de cualquiera de sus sucursales
 *
 * Si no se puede determinar el dueño se niega. Es deliberado: ante la duda,
 * con datos financieros de terceros, no servir el archivo.
 */

function extractToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.split(' ')[1];
  /* También por query: el visor abre el comprobante en una pestaña nueva y
     ahí no hay forma de mandar cabeceras. Queda registrado en los logs del
     proxy, que es el precio de que se pueda ver desde el navegador. */
  if (req.query.token) return String(req.query.token);
  return null;
}

// El token no siempre trae businessId; el Admin sí lo tiene.
async function requesterBusinessId(payload) {
  if (payload.businessId) return String(payload.businessId);
  if (!payload.id) return null;
  const Admin = require('../Models/Admin');
  const admin = await Admin.findById(payload.id).select('businessId').lean();
  return admin?.businessId ? String(admin.businessId) : null;
}

// Comprobante de suscripción: la ruta guardada identifica el registro
async function ownerOfSubscriptionProof(file) {
  const PaymentRequest = require('../Models/PaymentRequest');
  const doc = await PaymentRequest
    .findOne({ proofUrl: `/uploads/proofs/${file}` })
    .select('businessId')
    .lean();
  return doc?.businessId ? String(doc.businessId) : null;
}

// Comprobante de pedido: el id del pedido viaja en la propia ruta
async function ownerOfOrderProof(orderId) {
  if (!/^[a-f0-9]{24}$/i.test(orderId)) return null;
  const Order = require('../Models/Order');
  const CompletedOrder = require('../Models/CompletedOrder');
  const doc =
    (await Order.findById(orderId).select('businessId').lean()) ||
    (await CompletedOrder.findById(orderId).select('businessId').lean());
  return doc?.businessId ? String(doc.businessId) : null;
}

// Una marca puede ver los comprobantes de sus sucursales
async function sameBrand(ownerBusinessId, brandId) {
  if (!brandId) return false;
  const BusinessConfig = require('../Models/BusinessConfig');
  const biz = await BusinessConfig.findById(ownerBusinessId).select('brandId').lean();
  return !!biz?.brandId && String(biz.brandId) === String(brandId);
}

/**
 * @param {'subscription'|'order'} kind qué carpeta protege este middleware
 */
function proofAuth(kind) {
  return async (req, res, next) => {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ message: 'No token' });

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Invalid token' });
    }

    if (payload.role === 'superadmin') return next();

    try {
      const requester = await requesterBusinessId(payload);
      if (!requester) {
        return res.status(403).json({ message: 'Sin acceso a este comprobante' });
      }

      // Express ya quitó el prefijo del montaje: queda "/archivo" o "/pedido/archivo"
      const parts = req.path.split('/').filter(Boolean);
      let owner = null;
      if (kind === 'order') {
        owner = parts.length >= 2 ? await ownerOfOrderProof(parts[0]) : null;
      } else {
        owner = parts.length === 1 ? await ownerOfSubscriptionProof(parts[0]) : null;
      }

      if (owner && (owner === requester || (await sameBrand(owner, payload.brandId)))) {
        return next();
      }

      logger.warn('Acceso denegado a comprobante ajeno', {
        kind,
        path: req.path,
        requesterBusinessId: requester,
        ownerBusinessId: owner,
      });
      return res.status(403).json({ message: 'Sin acceso a este comprobante' });
    } catch (error) {
      logger.error('Error validando acceso a comprobante', error);
      return res.status(500).json({ message: 'Error validando acceso' });
    }
  };
}

module.exports = proofAuth;
