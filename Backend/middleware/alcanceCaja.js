const { verifyToken } = require('../config/jwt');
const logger = require('../utils/logger');

/**
 * Un token de caja solo sirve para lo de la caja.
 *
 * El token que vive en una terminal de mostrador dura noventa días y está en un
 * equipo que cualquiera puede llevarse. Sin esto valdría lo mismo que la sesión
 * del dueño: cambiar precios, ver ventas de todas las sedes, tocar la
 * suscripción. Con esto, quien se robe la terminal solo puede hacer lo que ya
 * podía hacer con la terminal en la mano: registrar ventas y bajar el catálogo.
 *
 * **Va montado antes de las rutas, no dentro de cada una.** Es deliberado: una
 * lista de rutas permitidas se olvida de actualizar en cuanto alguien agrega un
 * endpoint nuevo, y el olvido no se nota —todo sigue funcionando— hasta que
 * alguien lo aprovecha. Aquí lo que no está explícitamente permitido queda
 * cerrado por omisión, que es el único orden que sobrevive al tiempo.
 */

/** Lo único que un token de caja puede tocar. */
const PERMITIDO = /^\/api\/pos\//;

function alcanceCaja(req, res, next) {
  const cabecera = req.headers.authorization || '';
  if (!cabecera.startsWith('Bearer ')) return next();

  /* Se decodifica aquí aunque authMiddleware lo vuelva a hacer después. Es una
     verificación de firma más por petición —microsegundos— a cambio de que el
     cierre no dependa de que cada ruta se acuerde de aplicarlo. */
  const datos = verifyToken(cabecera.slice(7));
  if (!datos || datos.scope !== 'pos') return next();

  if (PERMITIDO.test(req.path)) {
    // Para que las rutas del POS sepan qué caja les está hablando.
    req.caja = { tokenId: datos.jti || '', nombre: datos.caja || '' };
    return next();
  }

  logger.warn('Un token de caja intentó salirse de /api/pos', {
    ruta: req.path,
    caja: datos.caja || 'sin nombre',
    businessId: datos.businessId,
  });

  return res.status(403).json({
    message: 'Este token es de una caja registradora y solo sirve para el punto de venta',
    motivo: 'fuera_de_alcance',
  });
}

module.exports = { alcanceCaja, PERMITIDO };
