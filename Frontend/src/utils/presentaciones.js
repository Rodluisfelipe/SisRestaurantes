import { getEffectivePrice } from './promo';

/**
 * Presentaciones de un producto de tienda: 50 ml, talla M, color negro…
 *
 * Con una sola referencia el menú muestra un precio y ya está. Con varias ese
 * precio suelto engaña —¿es el del frasco pequeño o el del grande?—, así que
 * la tarjeta necesita saber cuáles hay y cuánto vale cada una.
 *
 * Una variante sin precio propio hereda el del producto, promo incluida: es el
 * mismo criterio con el que se cobra al agregar al carrito.
 */
export function leerPresentaciones(product) {
  const base = Number(getEffectivePrice(product)) || 0;

  const lista = (Array.isArray(product?.variantes) ? product.variantes : [])
    .filter((v) => v && v.activo !== false && Array.isArray(v.valores) && v.valores.length)
    .map((v) => ({
      etiqueta: v.valores.join(' · '),
      precio: (v.precio === null || v.precio === undefined || v.precio === '') ? base : Number(v.precio),
    }))
    .filter((v) => Number.isFinite(v.precio));

  const varias = lista.length > 1;
  /* Si todas valen lo mismo (tallas de una camiseta) repetir el precio en cada
     chip es ruido: se muestran los nombres y el precio sigue siendo uno solo. */
  const preciosDistintos = varias && new Set(lista.map((p) => p.precio)).size > 1;

  return {
    lista,
    varias,
    preciosDistintos,
    desde: varias ? Math.min(...lista.map((p) => p.precio)) : null,
  };
}

export const enPesos = (n) => Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 });
