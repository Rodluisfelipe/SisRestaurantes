/**
 * DEPRECATED: Este archivo es un alias de authMiddleware.js
 * Usar directamente: const authMiddleware = require('./authMiddleware');
 * Se mantiene por compatibilidad hacia atrás.
 */
const authMiddleware = require('./authMiddleware');

const authenticateToken = authMiddleware;

const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({ message: 'SuperAdmin access required' });
  }
  next();
};

module.exports = {
  authenticateToken,
  requireSuperAdmin
}; 