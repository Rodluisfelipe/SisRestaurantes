const jwt = require('jsonwebtoken');
const SuperAdmin = require('../Models/SuperAdmin');

// Configuración de JWT (debe coincidir con la del controlador)
const JWT_SECRET = process.env.JWT_SECRET || 'superadmin-secret-key';

/**
 * Middleware para proteger rutas que requieren autenticación de SuperAdmin
 * Verifica el token JWT en el header Authorization
 */
exports.protectSuperAdmin = async (req, res, next) => {
  try {
    let token;
    
    // Verificar si existe el header de autorización y si es un token Bearer
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // Verificar que el token existe
    if (!token) {
      return res.status(401).json({
        message: 'No estás autorizado para acceder a esta ruta'
      });
    }
    
    try {
      // Verificar token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Verificar que el rol sea superadmin
      if (decoded.role !== 'superadmin') {
        return res.status(403).json({
          message: 'Acceso denegado: se requiere rol de superadmin'
        });
      }
      
      // Buscar el SuperAdmin
      const superAdmin = await SuperAdmin.findById(decoded.id);
      if (!superAdmin) {
        return res.status(401).json({
          message: 'El usuario con este token ya no existe'
        });
      }
      
      // Agregar el SuperAdmin a la petición
      req.user = {
        id: superAdmin._id,
        email: superAdmin.email,
        role: 'superadmin'
      };
      
      next();
    } catch (error) {
      // Error de verificación del token
      return res.status(401).json({
        message: 'Token inválido o expirado'
      });
    }
  } catch (error) {
    console.error('Error en middleware de autenticación:', error);
    res.status(500).json({
      message: 'Error interno del servidor en autenticación'
    });
  }
}; 