/**
 * Lightweight HTML/XSS sanitizer for user-generated text fields.
 * Strips all HTML tags and decodes common entities.
 * Does NOT require external dependencies.
 */

/**
 * Remove HTML tags from a string and decode entities.
 * @param {string} str - Input string (potentially containing HTML)
 * @returns {string} Plain text with no HTML tags
 */
function stripHtml(str) {
  if (!str || typeof str !== 'string') return str || '';
  /* Primero se decodifican las entidades y DESPUÉS se quitan las etiquetas.
     Al revés (como estaba), "&lt;img onerror=…&gt;" pasaba la limpieza y
     salía convertido en una etiqueta real. Se repite hasta que no quede
     nada que quitar, por si vienen anidadas ("<<b>img …>"). */
  let texto = str
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&');
  let antes;
  do {
    antes = texto;
    texto = texto.replace(/<[^>]*>/g, '');
  } while (texto !== antes);
  return texto.trim();
}

/**
 * Sanitize an object's string fields recursively (shallow — only top-level keys).
 * @param {Object} obj - Object whose string values to sanitize
 * @param {string[]} fields - Array of field names to sanitize
 * @returns {Object} Same object with sanitized fields
 */
function sanitizeFields(obj, fields) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const field of fields) {
    if (typeof obj[field] === 'string') {
      obj[field] = stripHtml(obj[field]);
    }
  }
  return obj;
}

module.exports = { stripHtml, sanitizeFields };
