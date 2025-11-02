const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

module.exports = function authMiddleware(req, res, next) {
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
    
    // Token válido - agregar al request
    req.user = decoded;
    
    // Si es SuperAdmin, agregar flag
    if (decoded.role === 'superadmin') {
      req.user.isSuperAdmin = true;
    }
    
    next();
  } catch (err) {
    logger.error('Error verificando token', err, req);
    return res.status(401).json({ message: 'Invalid token', error: err.message });
  }
} 