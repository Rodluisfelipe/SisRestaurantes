import { describe, expect, it } from 'vitest';
import {
  agregarAlCarrito, brutoDe, esRecompensa, fijarCantidad, lineaDeRecompensa,
  quitarLineasDeRecompensa, rebajaPorRecompensa,
} from './carrito';
import type { LineaVenta, Producto, Recompensa } from './nativo';

/**
 * Lo que decide cuánto paga el cliente.
 *
 * Estas dos reglas —cómo se agrupan las líneas y cuánto rebaja una recompensa—
 * fallan en silencio: no dan error, no pintan nada raro, y la caja sigue
 * cobrando. Lo que cambia es la cifra. Por eso se prueban una por una, y por
 * eso cada prueba dice qué pasa en el mostrador cuando se rompe.
 */

const producto = (id: string, precio: number, variante = ''): Producto => ({
  id,
  nombre: 'Café',
  precio,
  categoria: 'Bebidas',
  variante,
  foto: '',
  extras: [],
});

const recompensa = (tipo: string, valor = 0): Recompensa => ({
  id: 'r1',
  nombre: 'Café gratis',
  tipo,
  costo_puntos: 100,
  producto_id: 'p1',
  valor_descuento: valor,
});

describe('cómo se agrupan las líneas del carrito', () => {
  it('el mismo producto marcado dos veces es una línea con cantidad 2', () => {
    /* Sin esto, diez cafés serían diez líneas y el cajero no podría leer el
       pedido de un vistazo antes de cobrar. */
    const café = producto('p1', 5000);
    const carrito = agregarAlCarrito(agregarAlCarrito([], café), café);

    expect(carrito).toHaveLength(1);
    expect(carrito[0].cantidad).toBe(2);
    expect(brutoDe(carrito)).toBe(10000);
  });

  it('el café gratis de un canje NO se agrupa con el café que se cobra', () => {
    /* Este es el que importa. El cliente canjea su café gratis y después pide
       otro: si las dos líneas se fusionaran en la de precio cero, el negocio
       regalaría el segundo y nadie se enteraría —la pantalla mostraría "Café
       x2 · GRATIS" y el cajero lo leería como correcto—. */
    const café = producto('p1', 5000);
    const conRegalo = [lineaDeRecompensa(café, recompensa('free_product'))];
    const carrito = agregarAlCarrito(conRegalo, café);

    expect(carrito).toHaveLength(2);
    expect(carrito[0].precio).toBe(0);
    expect(carrito[1].precio).toBe(5000);
    // El negocio cobra uno y regala uno, que es lo que el canje prometió.
    expect(brutoDe(carrito)).toBe(5000);
  });

  it('en el otro orden tampoco se agrupan', () => {
    /* El cajero marca el café primero y el canje llega después. La línea
       gratis se agrega aparte, no suma cantidad a la que ya se cobraba. */
    const café = producto('p1', 5000);
    const carrito = [
      ...agregarAlCarrito([], café),
      lineaDeRecompensa(café, recompensa('free_product')),
    ];

    expect(carrito).toHaveLength(2);
    expect(brutoDe(carrito)).toBe(5000);
  });

  it('dos variantes del mismo producto son dos líneas', () => {
    const chico = producto('p1', 3000, 'Pequeño');
    const grande = producto('p1', 5000, 'Grande');

    expect(agregarAlCarrito(agregarAlCarrito([], chico), grande)).toHaveLength(2);
  });

  it('el mismo producto con extras distintos son dos líneas', () => {
    /* La cocina tiene que recibirlas por separado: una hamburguesa con queso y
       otra sin él no son dos unidades de lo mismo. */
    const hamburguesa = producto('p2', 18000);
    const conQueso = agregarAlCarrito([], hamburguesa, [{ grupo: 'Adiciones', nombre: 'Queso', cantidad: 1, precio: 2500 }], 2500);
    const carrito = agregarAlCarrito(conQueso, hamburguesa);

    expect(carrito).toHaveLength(2);
    expect(carrito[0].precio).toBe(20500);
    expect(carrito[1].precio).toBe(18000);
  });

  it('el mismo producto con los mismos extras sí se agrupa', () => {
    const hamburguesa = producto('p2', 18000);
    const extras = [{ grupo: 'Adiciones', nombre: 'Queso', cantidad: 1, precio: 2500 }];
    const una = agregarAlCarrito([], hamburguesa, extras, 2500);
    const dos = agregarAlCarrito(una, hamburguesa, extras, 2500);

    expect(dos).toHaveLength(1);
    expect(dos[0].cantidad).toBe(2);
  });

  it('agregar no muta el carrito que recibe', () => {
    /* React compara por referencia: si se mutara, la pantalla no se
       redibujaría y el cajero marcaría un producto que no aparece. */
    const café = producto('p1', 5000);
    const antes: LineaVenta[] = agregarAlCarrito([], café);
    const despues = agregarAlCarrito(antes, café);

    expect(antes[0].cantidad).toBe(1);
    expect(despues).not.toBe(antes);
  });

  it('la línea de recompensa se reconoce y se puede quitar', () => {
    const café = producto('p1', 5000);
    const carrito = agregarAlCarrito(
      [lineaDeRecompensa(café, recompensa('free_product'))],
      café,
    );

    expect(carrito.filter(esRecompensa)).toHaveLength(1);

    const sinRegalo = quitarLineasDeRecompensa(carrito);
    expect(sinRegalo).toHaveLength(1);
    expect(sinRegalo[0].precio).toBe(5000);
  });
});

describe('el multiplicador de cantidad', () => {
  it('con 3 puesto, tocar el producto mete tres unidades', () => {
    /* Es todo el punto: tocar tres veces la misma casilla son tres toques
       y tres rebotes posibles en un monitor resistivo. */
    const empanada = producto('p3', 3000);

    const carrito = agregarAlCarrito([], empanada, [], 0, 3);

    expect(carrito).toHaveLength(1);
    expect(carrito[0].cantidad).toBe(3);
    expect(brutoDe(carrito)).toBe(9000);
  });

  it('suma sobre lo que ya había de ese producto', () => {
    const empanada = producto('p3', 3000);
    const una = agregarAlCarrito([], empanada);

    expect(agregarAlCarrito(una, empanada, [], 0, 3)[0].cantidad).toBe(4);
  });

  it('sin multiplicador entra una sola, como siempre', () => {
    /* Las llamadas que ya existían no pasan unidades: tienen que seguir
       comportándose igual. */
    expect(agregarAlCarrito([], producto('p3', 3000))[0].cantidad).toBe(1);
  });

  it('un multiplicador absurdo no entra', () => {
    /* Cero o negativo dejaría una línea que no se puede cobrar; un número
       enorme, una venta de un millón de empanadas por un dedo mal puesto. */
    const empanada = producto('p3', 3000);

    expect(agregarAlCarrito([], empanada, [], 0, 0)[0].cantidad).toBe(1);
    expect(agregarAlCarrito([], empanada, [], 0, -5)[0].cantidad).toBe(1);
    expect(agregarAlCarrito([], empanada, [], 0, 9999)[0].cantidad).toBe(99);
  });
});

describe('fijar la cantidad de una línea', () => {
  const dosLineas = () => {
    const uno = agregarAlCarrito([], producto('p1', 5000));
    return agregarAlCarrito(uno, producto('p2', 8000));
  };

  it('deja la línea en esa cantidad exacta, no suma', () => {
    /* El cajero corrige un 1x a 4x. Teclear 4 dos veces tiene que dejar 4,
       no 8: quien corrige espera que el número que teclea sea el final. */
    const carrito = fijarCantidad(dosLineas(), 0, 4);

    expect(carrito[0].cantidad).toBe(4);
    expect(fijarCantidad(carrito, 0, 4)[0].cantidad).toBe(4);
  });

  it('no toca las demás líneas', () => {
    const carrito = fijarCantidad(dosLineas(), 0, 4);

    expect(carrito[1].cantidad).toBe(1);
    expect(carrito[1].producto_id).toBe('p2');
  });

  it('nunca deja una línea en cero', () => {
    /* Dejarla en cero sería quitarla, y quitar una línea pasa por su propia
       puerta —con autorización si la cocina ya la tiene—. Colarse por aquí
       saltaría ese control. */
    expect(fijarCantidad(dosLineas(), 0, 0)[0].cantidad).toBe(1);
    expect(fijarCantidad(dosLineas(), 0, -3)[0].cantidad).toBe(1);
  });

  it('un índice que no existe no rompe el carrito', () => {
    const antes = dosLineas();

    expect(fijarCantidad(antes, 9, 4)).toBe(antes);
    expect(fijarCantidad(antes, -1, 4)).toBe(antes);
  });

  it('no muta el carrito que recibe', () => {
    const antes = dosLineas();
    const despues = fijarCantidad(antes, 0, 4);

    expect(antes[0].cantidad).toBe(1);
    expect(despues).not.toBe(antes);
  });
});

describe('cuánto rebaja una recompensa', () => {
  it('un 10% sobre 20.000 son 2.000', () => {
    expect(rebajaPorRecompensa(recompensa('discount_percent', 10), 20000)).toBe(2000);
  });

  it('y sobre 30.000 son 3.000: el porcentaje sigue al total', () => {
    /* El caso que se rompe en producción: el cliente canjea su 10% sobre
       20.000 y después agrega un plato de 10.000. Si la rebaja se hubiera
       congelado en 2.000, se le cobrarían 1.000 de más y la pantalla mostraría
       un descuento —solo que el equivocado—. */
    const diezPorCiento = recompensa('discount_percent', 10);

    expect(rebajaPorRecompensa(diezPorCiento, 20000)).toBe(2000);
    expect(rebajaPorRecompensa(diezPorCiento, 30000)).toBe(3000);
  });

  it('una cifra fija no se mueve con el total', () => {
    /* Un "5.000 de descuento" es eso, valga la venta lo que valga. */
    const cincoMil = recompensa('discount_fixed', 5000);

    expect(rebajaPorRecompensa(cincoMil, 20000)).toBe(5000);
    expect(rebajaPorRecompensa(cincoMil, 30000)).toBe(5000);
  });

  it('nunca rebaja más de lo que vale la venta', () => {
    /* Un total negativo en una caja significaría que la gaveta le debe plata
       al cliente. */
    expect(rebajaPorRecompensa(recompensa('discount_fixed', 50000), 20000)).toBe(20000);
    expect(rebajaPorRecompensa(recompensa('discount_percent', 150), 20000)).toBe(20000);
  });

  it('un producto gratis no rebaja nada además', () => {
    /* Ya entró al carrito a precio cero: sumarle un descuento sería regalarlo
       dos veces. */
    expect(rebajaPorRecompensa(recompensa('free_product'), 20000)).toBe(0);
  });

  it('sin recompensa no hay rebaja', () => {
    expect(rebajaPorRecompensa(null, 20000)).toBe(0);
  });

  it('un valor negativo no se convierte en un recargo', () => {
    expect(rebajaPorRecompensa(recompensa('discount_fixed', -5000), 20000)).toBe(0);
    expect(rebajaPorRecompensa(recompensa('discount_percent', -10), 20000)).toBe(0);
  });

  it('sobre un carrito vacío la rebaja es cero', () => {
    expect(rebajaPorRecompensa(recompensa('discount_percent', 10), 0)).toBe(0);
  });
});
