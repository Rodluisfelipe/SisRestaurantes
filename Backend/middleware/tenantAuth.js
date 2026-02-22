const authMiddleware = require('./authMiddleware');
const { resolveBusinessId } = require('../utils/businessResolver');
const logger = require('../utils/logger');

/**
 * Middleware that combines authentication + tenant isolation.
 * Verifies the JWT token AND ensures the user belongs to the business they're modifying.
 * 
 * For GET (read) routes that are public (e.g. customers viewing menu), use publicRead instead.
 * For write routes (POST/PUT/DELETE), this ensures tenant isolation.
 */
function tenantAuth(req, res, next) {
  // First, authenticate the token
  authMiddleware(req, res, async (err) => {
    if (err) return; // authMiddleware already sent the response

    try {
      // SuperAdmins can access any business
      if (req.user && req.user.isSuperAdmin) {
        return next();
      }

      // Get businessId from request (body, query, or params)
      const requestBusinessId = req.body.businessId || req.query.businessId || req.params.businessId;

      if (!requestBusinessId) {
        // If the user's token has a businessId, inject it into the request for downstream handlers
        if (req.user && req.user.businessId) {
          req.resolvedBusinessId = req.user.businessId;
          return next();
        }
        // No businessId anywhere — reject for write operations, allow for safe reads
        const safeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
        if (!safeMethod) {
          return res.status(400).json({ message: 'businessId es requerido para esta operación' });
        }
        return next();
      }

      // Resolve the businessId (could be a slug)
      let resolvedBusinessId;
      try {
        resolvedBusinessId = await resolveBusinessId(requestBusinessId);
      } catch (resolveError) {
        return res.status(404).json({ message: 'Negocio no encontrado' });
      }

      // Verify the authenticated user belongs to this business
      const userBusinessId = req.user.businessId;
      if (userBusinessId && resolvedBusinessId && 
          userBusinessId.toString() !== resolvedBusinessId.toString()) {
        logger.warn('Tenant isolation violation attempt', {
          userId: req.user.id,
          userBusiness: userBusinessId,
          requestedBusiness: resolvedBusinessId
        }, req);
        return res.status(403).json({ message: 'No tienes acceso a este negocio' });
      }

      next();
    } catch (error) {
      logger.error('Error in tenant auth middleware', error, req);
      return res.status(500).json({ message: 'Error de autenticación' });
    }
  });
}

/**
 * Auth-only middleware (no tenant check) - for routes where tenant
 * verification is handled inline or not needed.
 */
const authOnly = authMiddleware;

module.exports = { tenantAuth, authOnly };
