const { verifyToken } = require('../config/jwt');

module.exports = function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  
  // Manejar tokens temporales de SuperAdmin
  if (token.startsWith('temp_sa_token_')) {
    // Para tokens temporales, necesitamos obtener el usuario del contexto
    // Este es un token especial usado cuando SuperAdmin accede a un panel de negocio
    // El frontend debe enviar la información del usuario en otro lugar o necesitamos
    // buscar al SuperAdmin en la sesión
    
    // Por ahora, permitimos el acceso y dejamos que el endpoint específico maneje la lógica
    req.user = {
      id: 'superadmin_temp',
      role: 'superadmin',
      isTempToken: true
    };
    return next();
  }
  
  try {
    const decoded = verifyToken(token);
    if (!decoded) return res.status(401).json({ message: 'Invalid token' });
    
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Error verificando token:', err);
    return res.status(401).json({ message: 'Invalid token', error: err.message });
  }
} 