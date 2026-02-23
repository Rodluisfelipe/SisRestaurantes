/**
 * Utilidades de zona horaria para Colombia (America/Bogota, UTC-5).
 * 
 * El servidor Docker corre en UTC. Estas funciones convierten
 * "medianoche Colombia" a un Date UTC que MongoDB puede comparar.
 */

const COL_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC-5 en milisegundos

/**
 * Devuelve la medianoche de HOY en hora Colombia, expresada como Date UTC.
 * Ejemplo: si en Colombia es 22-Feb 11:30 PM → retorna 22-Feb 05:00:00 UTC
 */
function startOfDayCOL(date = new Date()) {
  // Restar 5h para obtener la hora local Colombia
  const colTime = new Date(date.getTime() - COL_OFFSET_MS);
  // Truncar a medianoche en esa hora local
  colTime.setUTCHours(0, 0, 0, 0);
  // Sumar 5h para convertir de vuelta a UTC
  return new Date(colTime.getTime() + COL_OFFSET_MS);
}

/**
 * Devuelve la medianoche de MAÑANA en hora Colombia, expresada como Date UTC.
 */
function endOfDayCOL(date = new Date()) {
  const start = startOfDayCOL(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

module.exports = { startOfDayCOL, endOfDayCOL, COL_OFFSET_MS };
