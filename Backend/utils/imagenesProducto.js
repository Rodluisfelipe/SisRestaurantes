/**
 * Galería de fotos de un producto.
 *
 * `image` sigue siendo la foto principal porque medio sistema la lee: el menú,
 * el catálogo público, el POS, el link y los mensajes de WhatsApp. `images`
 * guarda la galería completa con esa misma principal de primera, así no hay dos
 * versiones de la verdad ni hace falta tocar todo lo que ya funciona.
 */

const MAX_IMAGENES = 5;

/**
 * Deja la galería como la espera el menú: direcciones limpias, sin repetidas,
 * con la principal de primera y como mucho MAX_IMAGENES.
 */
function normalizarImagenes(images, principal) {
  const lista = Array.isArray(images) ? images : [];
  const limpias = [];
  for (const url of [principal, ...lista]) {
    const limpia = typeof url === 'string' ? url.trim() : '';
    if (limpia && !limpias.includes(limpia)) limpias.push(limpia);
  }
  return limpias.slice(0, MAX_IMAGENES);
}

module.exports = { MAX_IMAGENES, normalizarImagenes };
