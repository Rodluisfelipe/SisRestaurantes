const { verifyToken } = require('../config/jwt');

const authenticateToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    req.user = decoded;
    req.userId = decoded.id;
    req.user.businessId = decoded.businessId;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Authentication failed' });
  }
};

const requireSuperAdmin = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'SuperAdmin access required' });
    }
    next();
  } catch (error) {
    res.status(403).json({ message: 'Access denied' });
  }
};

module.exports = {
  authenticateToken,
  requireSuperAdmin
}; 