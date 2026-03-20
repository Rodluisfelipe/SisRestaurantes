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
  return str
    .replace(/<[^>]*>/g, '')        // Remove HTML tags
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .trim();
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
