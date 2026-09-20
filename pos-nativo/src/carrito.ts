import type { ExtraElegido, LineaVenta, Producto, Recompensa } from './nativo';

/**
 * Las reglas del carrito, sin pantalla de por medio.
 *
 * Viven aquí y no dentro de `App.tsx` por una razón concreta: son aritmética
 * que decide cuánto paga el cliente, y equivocarse no se ve. Un ítem que se
 * agrupa con el que no debía o un descuento que se queda con la cifra vieja no
 * dan error, no pintan nada raro y no se notan hasta que alguien cuadra la caja
 * al final del día —o hasta que el cliente reclama—.
 *
 * Dentro de un componente de 1.600 líneas eso solo se puede probar montando la
 * caja entera con la red y el disco simulados. Aquí se prueba en dos líneas, y
 * lo que se prueba es exactamente lo que corre.
 */

/** La marca que llevan las líneas que entraron por un canje de puntos. */
export const MARCA_RECOMPENSA = 'Recompensa · ';

/** Si esta línea la puso una recompensa y no el cajero. */
export function esRecompensa(linea: LineaVenta): boolean {
  return Boolean(linea.nota?.startsWith(MARCA_RECOMPENSA));
}

/** Dos listas de extras son la misma. */
function mismosExtras(a: ExtraElegido[] = [], b: ExtraElegido[] = []): boolean {
  return (
    a.length === b.length &&
    a.every((x, k) => x.nombre === b[k]?.nombre && x.cantidad === b[k]?.cantidad)
  );
}

/**
 * Mete un producto al carrito, agrupándolo con el suyo si ya estaba.
 *
 * Qué cuenta como "el suyo" es toda la decisión:
 *
 * - **Mismo producto y misma variante**, obviamente.
 * - **Mismos extras.** Una hamburguesa con queso y otra sin él no se pueden
 *   sumar: la cocina tiene que recibir las dos por separado.
 * - **Mismo precio.** Sin esta tercera condición, el café que entró gratis por
 *   una recompensa y el café que el cliente pide después son "el mismo producto
 *   con los mismos extras": se fusionan en la línea de precio cero y el negocio
 *   regala el segundo. Dos líneas del mismo producto a precios distintos son
 *   dos líneas.
 */
export function agregarAlCarrito(
  carrito: LineaVenta[],
  producto: Producto,
  extras: ExtraElegido[] = [],
  sobreprecio = 0,
): LineaVenta[] {
  /* El precio de la línea es el precio **como se vendió**: base más extras.
     Que sea así es lo que permite que toda la aritmética de la caja —totales,
     vuelto, arqueo, devoluciones— siga intacta. */
  const precio = producto.precio + sobreprecio;

  const i = carrito.findIndex(
    (x) =>
      x.producto_id === producto.id &&
      x.variante === producto.variante &&
      x.precio === precio &&
      mismosExtras(x.extras, extras),
  );

  if (i >= 0) {
    const copia = [...carrito];
    copia[i] = { ...copia[i], cantidad: copia[i].cantidad + 1 };
    return copia;
  }

  return [...carrito, {
    producto_id: producto.id,
    nombre: producto.nombre,
    variante: producto.variante,
    precio,
    cantidad: 1,
    nota: '',
    extras,
  }];
}

/** Una línea de producto gratis, entregada por un canje de puntos. */
export function lineaDeRecompensa(producto: Producto, r: Recompensa): LineaVenta {
  return {
    producto_id: producto.id,
    nombre: producto.nombre,
    variante: producto.variante,
    precio: 0,
    cantidad: 1,
    /* La nota es lo que hace que la línea se pueda reconocer después —para
       quitarla si el cajero se arrepiente— y lo que la cocina lee en la
       comanda. Un producto gratis que no se imprime es un producto que no se
       prepara. */
    nota: `${MARCA_RECOMPENSA}${r.nombre}`,
    extras: [],
  };
}

/** Quita del carrito lo que puso una recompensa. */
export function quitarLineasDeRecompensa(carrito: LineaVenta[]): LineaVenta[] {
  return carrito.filter((l) => !esRecompensa(l));
}

/** Lo que vale el carrito, antes de descuentos. */
export function brutoDe(carrito: LineaVenta[]): number {
  return carrito.reduce((t, i) => t + i.precio * i.cantidad, 0);
}

/**
 * Cuánto rebaja una recompensa sobre un bruto dado.
 *
 * Devuelve cero para `free_product`: ese no rebaja nada, entrega un producto a
 * precio cero, y sumarle además un descuento sería regalarlo dos veces.
 *
 * **Se vuelve a llamar cada vez que el carrito cambia**, y ahí está el punto de
 * la función. Si el porcentaje se calculara una sola vez, el cliente que agrega
 * dos platos después de canjear su 10% recibiría el 10% de lo que llevaba
 * antes: se le cobraría de más y nadie lo notaría, porque la pantalla muestra
 * una rebaja —solo que la equivocada—.
 *
 * Nunca pasa del bruto: un descuento mayor que la venta dejaría un total
 * negativo, que en una caja significa que la gaveta le debe plata al cliente.
 */
export function rebajaPorRecompensa(r: Recompensa | null, bruto: number): number {
  if (!r || r.tipo === 'free_product' || r.tipo === 'free_delivery') return 0;

  const valor = Math.max(0, r.valor_descuento);
  const rebaja = r.tipo === 'discount_percent'
    ? Math.round((bruto * Math.min(100, valor)) / 100)
    : valor;

  return Math.min(Math.max(0, bruto), rebaja);
}
