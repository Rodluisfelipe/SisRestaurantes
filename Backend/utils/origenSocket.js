/**
 * ¿Se acepta esta conexión de socket según su Origin?
 *
 * - Sin Origin (curl, servidores): sí.
 * - En la lista de orígenes permitidos (el panel, el menú): sí.
 * - Mismo origen que el propio servidor: sí. Es lo que manda la app nativa
 *   del domi: Android le pone al WebSocket como Origin la dirección a la que
 *   se conecta (https://api.menuby.tech), y eso no es una página ajena.
 */
function origenSocketPermitido(origen, host, permitidos = []) {
  if (!origen) return true;
  if (permitidos.includes(origen)) return true;
  try {
    return !!host && new URL(origen).host === String(host).toLowerCase();
  } catch {
    return false;
  }
}

module.exports = { origenSocketPermitido };
