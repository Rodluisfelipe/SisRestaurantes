const jwt = require('jsonwebtoken');
const SuperAdmin = require('../Models/SuperAdmin');
const logger = require('../utils/logger');

// Configuración de JWT (debe coincidir con la del controlador)
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// Niveles de rol — mayor número = más permisos
const ROLE_LEVEL = {
  auditor: 1,
  support: 2,
  admin: 3,
  owner: 4,
};

/**
 * Verifica si el rol del usuario tiene al menos el nivel requerido.
 */
exports.hasMinRole = function hasMinRole(userRole, minRole) {
  const userLevel = ROLE_LEVEL[userRole] || 0;
  const required = ROLE_LEVEL[minRole] || 0;
  return userLevel >= required;
};

/**
 * Middleware factory: bloquea si el usuario no tiene al menos `minRole`.
 * Uso: router.delete('/biz/:id', requireRole('admin'), handler)
 */
exports.requireRole = function requireRole(minRole) {
  return (req, res, next) => {
    const userRole = req.user?.superAdminRole;
    if (!exports.hasMinRole(userRole, minRole)) {
      return res.status(403).json({
        message: `Acceso denegado: se requiere rol ${minRole} o superior (tu rol: ${userRole || 'desconocido'})`,
      });
    }
    next();
  };
};

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
      const superAdmin = await SuperAdmin.findById(decoded.id).select('email role active name');
      if (!superAdmin) {
        return res.status(401).json({
          message: 'El usuario con este token ya no existe'
        });
      }

      // Bloquear si está desactivado
      if (superAdmin.active === false) {
        return res.status(403).json({
          message: 'Tu cuenta ha sido desactivada. Contacta al owner del panel.'
        });
      }

      // Agregar el SuperAdmin a la petición
      req.user = {
        id: superAdmin._id,
        email: superAdmin.email,
        name: superAdmin.name,
        role: 'superadmin',
        // Rol granular dentro del panel (owner/admin/support/auditor)
        superAdminRole: superAdmin.role || 'owner',
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