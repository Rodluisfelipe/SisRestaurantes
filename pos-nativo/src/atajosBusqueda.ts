/**
 * Lo que se puede teclear en el buscador además de un nombre.
 *
 * `3*` es la cantidad del siguiente producto, como en cualquier caja
 * registradora: "3*" y escanear, o "3*coca" y Enter, marcan tres de una. Antes
 * la cantidad solo entraba por el teclado numérico de la pantalla, así que un
 * cajero con las manos en el teclado físico tenía que soltarlo para tocar el
 * monitor y volver.
 *
 * El asterisco y no la x: "2x1" es el nombre de media carta de promociones.
 */
export function leerCantidad(texto: string): { cantidad: string; resto: string } | null {
  const m = /^\s*(\d{1,3})\s*\*\s*(.*)$/.exec(texto);
  if (!m) return null;
  // No existe "0 empanadas": un cero no es una cantidad.
  if (parseInt(m[1], 10) === 0) return null;
  return { cantidad: String(parseInt(m[1], 10)), resto: m[2] };
}

/**
 * Qué línea repite el `+` con el buscador vacío: la señalada, o si no hay,
 * la última que entró. `null` con el carrito vacío.
 *
 * "Otra igual" es el pedido más común en un mostrador, y la línea que acaba de
 * entrar es casi siempre la que el cliente quiere repetir.
 */
export function lineaARepetir(largo: number, activa: number | null): number | null {
  if (activa !== null && activa >= 0 && activa < largo) return activa;
  return largo > 0 ? largo - 1 : null;
}

/**
 * `$5000` es un producto de precio libre: lo que no está en la carta —una
 * bolsa, un adicional que el negocio no cargó, "lo de siempre" del vecino—.
 * Sin esto el cajero tenía que ir al panel a crear un producto con el
 * cliente esperando, o cobrarlo por fuera de la caja.
 *
 * Entre $100 y $9.999.999: menos no es un precio y más es un error de tecleo.
 */
export function leerPrecioLibre(texto: string): number | null {
  const m = /^\s*\$\s*([\d.]+)\s*$/.exec(texto);
  if (!m) return null;
  const valor = parseInt(m[1].replace(/\./g, ''), 10);
  if (!Number.isFinite(valor) || valor < 100 || valor > 9_999_999) return null;
  return valor;
}
