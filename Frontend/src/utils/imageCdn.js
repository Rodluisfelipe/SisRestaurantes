/**
 * Ajusta las URLs de imágenes al tamaño en que realmente se ven.
 *
 * Las fotos de producto llegaban a 511x511 con calidad 85 para tarjetas que en
 * un móvil miden ~180 px. Pedirlas al tamaño correcto ahorra cerca de un tercio
 * de bytes por foto, y en un menú de 29 productos eso son unos 240 KB.
 *
 * Solo se tocan los CDN que aceptan transformaciones por URL. Cualquier otro
 * origen —Spaces, un enlace suelto— se devuelve intacto: es preferible servir
 * la imagen grande que romperla.
 */

/* Anchos ofrecidos al navegador, de una tarjeta en pantalla pequeña hasta un
   hero en escritorio a 2x. Se incluye 200 porque ahí el ahorro es grande (una
   foto típica pasa de 29 KB a 11 KB) y los 800 para que una imagen de origen
   grande no se vea borrosa en pantallas densas. Con fotos de origen pequeñas
   —la mayoría del catálogo actual, de unos 320 px— los anchos altos devuelven
   lo mismo: no estorban, simplemente no ahorran. */
const WIDTHS = [200, 256, 400, 560, 800];

/** Una URL de Rappi: ...png?e=webp&d=511x511&q=85 */
function rappi(url, width, quality) {
  try {
    const u = new URL(url);
    u.searchParams.set('e', 'webp');
    u.searchParams.set('d', `${width}x${width}`);
    u.searchParams.set('q', String(quality));
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Cloudinary transforma por segmento de ruta.
 *
 * Se encadenan con barras (/w_400/q_78/f_auto/) y no con comas, que es la
 * forma habitual: srcset separa sus entradas por comas, así que una URL con
 * comas dentro haría que el navegador leyera mal la lista entera.
 */
function cloudinary(url, width, quality) {
  if (!url.includes('/upload/')) return url;
  // Si ya trae transformaciones, no se pisan: podrían ser intencionales.
  const [base, rest] = url.split('/upload/');
  if (hasCloudinaryTransform(rest)) return url;
  return `${base}/upload/w_${width}/q_${quality}/f_auto/${rest}`;
}

function hasCloudinaryTransform(rest) {
  return /^[a-z]{1,2}_[^/]+\//.test(rest || '');
}

function transform(url, width, quality) {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;

  if (url.includes('images.rappi.com')) return rappi(url, width, quality);
  if (url.includes('res.cloudinary.com')) return cloudinary(url, width, quality);
  return url; // origen sin transformaciones (Spaces, externo): se deja igual
}

/** ¿Este origen admite que le pidamos otro tamaño? */
export function isResizable(url) {
  if (!url || typeof url !== 'string') return false;
  if (url.includes('images.rappi.com')) return true;
  if (url.includes('res.cloudinary.com')) {
    /* Una URL de Cloudinary que ya trae transformaciones se respeta tal cual,
       así que no tiene sentido ofrecer varios anchos: saldrían cuatro entradas
       idénticas y el navegador elegiría la misma imagen en todos los casos. */
    return !hasCloudinaryTransform(url.split('/upload/')[1]);
  }
  return false;
}

/**
 * URL para un ancho concreto.
 * @param {string} url
 * @param {number} width ancho en píxeles de imagen (no CSS)
 * @param {number} quality 1-100
 */
export function imageAt(url, width = 400, quality = 78) {
  return transform(url, width, quality);
}

/**
 * srcset con varios anchos para que el navegador elija según pantalla y
 * densidad. Devuelve cadena vacía si el origen no admite transformaciones,
 * y en ese caso conviene no poner el atributo.
 */
export function imageSrcSet(url, quality = 78) {
  if (!isResizable(url)) return '';
  return WIDTHS.map((w) => `${transform(url, w, quality)} ${w}w`).join(', ');
}

/* Cuánto ocupa una tarjeta del menú en pantalla. La rejilla es de 2 columnas
   en móvil y se va abriendo; el navegador usa esto junto al srcset para no
   descargar más resolución de la que va a mostrar. */
export const CARD_SIZES = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw';
export const HERO_SIZES = '(max-width: 640px) 100vw, 66vw';
