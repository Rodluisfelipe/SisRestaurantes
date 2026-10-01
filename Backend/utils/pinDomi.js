/**
 * El PIN de MenuBy Go es de la PERSONA (su celular), no de cada negocio.
 *
 * Antes cada negocio le ponía un PIN a su domi y la app dejaba entrar con
 * cualquiera de ellos, juntando todos los perfiles con ese celular. Así, quien
 * se registraba con un celular ajeno (el código llega al correo, no al
 * celular) quedaba dentro de los pedidos del dueño de ese número.
 *
 * Ahora la cuenta (DomiCuenta) guarda un solo PIN. Los PIN viejos de cada
 * negocio solo sirven para la primera entrada: el que funcione queda como el
 * PIN de la persona.
 */
const crypto = require('crypto');

const hashPin = (pin) => crypto.createHash('sha256').update(String(pin)).digest('hex');

/** Compara en tiempo constante (no se puede adivinar el hash por cuánto tarda). */
function mismoHash(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * ¿Este PIN abre la cuenta de esta persona?
 * @param {string} pin
 * @param {{ pinHash?: string|null } | null} cuenta
 * @param {Array<{ code?: string }>} perfiles  sus perfiles en negocios/empresas (para la primera vez)
 */
function pinCorrecto(pin, cuenta, perfiles = []) {
  if (!/^\d{4}$/.test(String(pin || ''))) return false;
  const h = hashPin(pin);
  if (cuenta?.pinHash) return mismoHash(cuenta.pinHash, h);
  return perfiles.some((p) => mismoHash(p.code, h));
}

module.exports = { hashPin, pinCorrecto };
