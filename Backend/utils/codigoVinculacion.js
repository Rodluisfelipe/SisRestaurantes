const crypto = require('crypto');

/**
 * El código que se dicta por teléfono.
 *
 * El alfabeto excluye 0, O, 1, I y L: son las que hacen que quien escucha
 * "cero" escriba "O", y quien lee un código en un monitor a dos metros
 * confunda el uno con la ele. Quitar cinco letras cuesta medio bit de entropía
 * y ahorra la mitad de las llamadas a soporte.
 */
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LARGO = 8;

/**
 * Ocho caracteres de un alfabeto de 31: unas 2^39 combinaciones.
 *
 * Se usa `randomInt` y no `Math.random`: este código es la llave con la que una
 * terminal entra al negocio, y `Math.random` es predecible si alguien observa
 * suficientes salidas.
 */
function generar() {
  let codigo = '';
  for (let i = 0; i < LARGO; i++) {
    codigo += ALFABETO[crypto.randomInt(ALFABETO.length)];
  }
  return codigo;
}

/**
 * Lo que escribió el cajero, listo para comparar.
 *
 * Quita guiones y espacios —el código se muestra como ABCD-EFGH y la gente lo
 * copia con el guion— y pasa a mayúsculas. Nada más.
 *
 * Deliberadamente **no** traduce caracteres parecidos. La tentación es mapear
 * 0→O y 1→I para "ayudar", pero esas letras no están en el alfabeto: adivinar
 * qué quiso escribir alguien es cambiarle el código por otro que podría existir
 * y pertenecer a otro negocio. Si un carácter no es del alfabeto, el código
 * simplemente no coincide y el mensaje se lo dice.
 */
function normalizar(entrada) {
  return String(entrada || '')
    .toUpperCase()
    .replace(/[\s\-_.]/g, '');
}

/** Como se le muestra al dueño: ABCD-EFGH, que se lee de un vistazo. */
function bonito(codigo) {
  const limpio = String(codigo || '');
  return limpio.length === LARGO ? `${limpio.slice(0, 4)}-${limpio.slice(4)}` : limpio;
}

module.exports = { generar, normalizar, bonito, ALFABETO, LARGO };
