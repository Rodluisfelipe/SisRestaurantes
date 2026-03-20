const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// Cache for recently verified users (TTL: 5 minutes)
const verifiedUsersCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function cleanCache() {
  const now = Date.now();
  for (const [key, entry] of verifiedUsersCache) {
    if (now - entry.timestamp > CACHE_TTL) {
      verifiedUsersCache.delete(key);
    }
  }
}
// Clean cache every 10 minutes
setInterval(cleanCache, 10 * 60 * 1000);

module.exports = async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('No authorization header provided', null, req);
    return res.status(401).json({ message: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  
  const JWT_SECRET = process.env.JWT_SECRET;
  
  try {
    // Verificar el token con JWT_SECRET (funciona para Admin y SuperAdmin)
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (!decoded) {
      logger.warn('Token verification returned null', null, req);
      return res.status(401).json({ message: 'Invalid token' });
    }
    
    // Verify user still exists in DB (with cache to avoid DB hit every request)
    const cacheKey = `${decoded.id}_${decoded.role || 'admin'}`;
    const cached = verifiedUsersCache.get(cacheKey);
    
    if (!cached || (Date.now() - cached.timestamp > CACHE_TTL)) {
      let userExists = false;
      if (decoded.role === 'superadmin') {
        const SuperAdmin = require('../Models/SuperAdmin');
        userExists = await SuperAdmin.exists({ _id: decoded.id });
      } else {
        const Admin = require('../Models/Admin');
        userExists = await Admin.exists({ _id: decoded.id });
      }
      
      if (!userExists) {
        logger.warn('Token references non-existent user', { userId: decoded.id }, req);
        return res.status(401).json({ message: 'User no longer exists' });
      }
      
      verifiedUsersCache.set(cacheKey, { timestamp: Date.now() });
    }
    
    // Token válido - agregar al request
    req.user = decoded;
    
    // Si es SuperAdmin, agregar flag
    if (decoded.role === 'superadmin') {
      req.user.isSuperAdmin = true;
    }
    
    next();
  } catch (err) {
    logger.error('Error verificando token', err, req);
    // Don't leak internal error details
    const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return res.status(401).json({ message });
  }
}

// Middleware factory: restrict access to specific roles
module.exports.requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.user?.role || 'admin';
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: 'No tienes permiso para esta acción' });
    }
    next();
  };
};

// Invalidate a specific user from the verified-users cache
module.exports.invalidateUserCache = (userId, role = 'admin') => {
  const cacheKey = `${userId}_${role}`;
  verifiedUsersCache.delete(cacheKey);
};