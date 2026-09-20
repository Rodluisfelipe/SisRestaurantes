import { describe, expect, it } from 'vitest';
import { enVariante, idBase, variantesDe } from './SelectorVariante';
import type { Producto } from './nativo';

/**
 * El conmutador de presentación.
 *
 * Lo que se prueba aquí es que funcione con **texto libre**, que es lo que el
 * comerciante escribe de verdad en el panel: "Mediana", "500 ml", "Talla M".
 * Una implementación con `S`/`M`/`L` fijos pasaría cualquier prueba escrita
 * con `S`/`M`/`L` y fallaría el primer día en un negocio real.
 */

const fila = (id: string, nombre: string, variante: string, precio: number): Producto => ({
  id,
  nombre,
  precio,
  categoria: 'Bebidas',
  variante,
  foto: '',
  extras: [],
});

/* Como lo aplana el backend: una fila por variante, con id `<producto>:<valor>`. */
const CATALOGO: Producto[] = [
  fila('gaseosa:Personal', 'Gaseosa', 'Personal', 3000),
  fila('gaseosa:Mediana', 'Gaseosa', 'Mediana', 4500),
  fila('gaseosa:Litro', 'Gaseosa', 'Litro', 7000),
  fila('jugo:Mediana', 'Jugo', 'Mediana', 5000),
  // Sin variantes: no lleva dos puntos en el id.
  fila('pan', 'Pan', '', 1500),
];

describe('de qué producto es una fila', () => {
  it('el prefijo antes de los dos puntos hermana a las variantes', () => {
    expect(idBase('gaseosa:Mediana')).toBe('gaseosa');
    expect(idBase('gaseosa:Litro')).toBe('gaseosa');
  });

  it('un producto sin variantes es su propio base', () => {
    expect(idBase('pan')).toBe('pan');
  });

  it('un id de Mongo con varios valores corta en el primer separador', () => {
    /* El backend une los valores con `|`, así que el id real se parece a
       `507f1f77bcf86cd799439011:Rojo|M`. */
    expect(idBase('507f1f77bcf86cd799439011:Rojo|M')).toBe('507f1f77bcf86cd799439011');
  });
});

describe('qué presentaciones se ofrecen', () => {
  it('salen del catálogo, no de una lista fija', () => {
    /* Esta es la prueba que importa: son las palabras que escribió el
       comerciante, no `S`, `M` ni `L`. */
    expect(variantesDe(CATALOGO)).toEqual(['Litro', 'Mediana', 'Personal']);
  });

  it('no se repiten aunque dos productos compartan presentación', () => {
    // "Mediana" está en la gaseosa y en el jugo, y es un solo botón.
    expect(variantesDe(CATALOGO).filter((v) => v === 'Mediana')).toHaveLength(1);
  });

  it('un catálogo sin variantes no ofrece ninguna', () => {
    /* Y con ninguna el conmutador no se dibuja: ocuparía el espacio de la
       ficha del cliente para no decidir nada. */
    expect(variantesDe([fila('pan', 'Pan', '', 1500)])).toEqual([]);
  });

  it('con demasiadas presentaciones se rinde en vez de llenar la columna', () => {
    /* Una tienda de ropa tiene veinte tallas. Veinte botones en una columna de
       264 px no son tocables, y la alternativa —recortar a seis -- mostraría
       seis al azar. Mejor ninguno y que use la rejilla. */
    const muchas = Array.from({ length: 20 }, (_, i) =>
      fila(`camiseta:T${i}`, 'Camiseta', `Talla ${i}`, 30000),
    );

    expect(variantesDe(muchas)).toEqual([]);
  });
});

describe('marcar en la presentación elegida', () => {
  it('con [Mediana] puesta, tocar la gaseosa marca la mediana', () => {
    /* El caso del mostrador rápido: el cliente pide una gaseosa mediana y el
       cajero no tiene que abrir ningún modal. */
    const personal = CATALOGO[0];
    const elegido = enVariante(personal, 'Mediana', CATALOGO);

    expect(elegido.variante).toBe('Mediana');
    expect(elegido.precio).toBe(4500);
  });

  it('un producto que no viene en esa presentación entra tal cual', () => {
    /* Hay gaseosa mediana pero no hay pan mediano. Tocar el pan con [Mediana]
       puesta tiene que marcar el pan, no fallar en silencio ni marcar otra
       cosa. */
    const pan = CATALOGO[4];

    expect(enVariante(pan, 'Mediana', CATALOGO)).toBe(pan);
  });

  it('sin presentación elegida no se cambia nada', () => {
    const litro = CATALOGO[2];

    expect(enVariante(litro, '', CATALOGO)).toBe(litro);
  });

  it('si ya es esa presentación, devuelve la misma fila', () => {
    const mediana = CATALOGO[1];

    expect(enVariante(mediana, 'Mediana', CATALOGO)).toBe(mediana);
  });

  it('no salta de un producto a otro aunque compartan presentación', () => {
    /* El jugo también es "Mediana". Tocar la gaseosa nunca puede terminar
       marcando un jugo: el cliente pagaría otra cosa. */
    const gaseosaLitro = CATALOGO[2];
    const elegido = enVariante(gaseosaLitro, 'Mediana', CATALOGO);

    expect(elegido.nombre).toBe('Gaseosa');
    expect(elegido.id).toBe('gaseosa:Mediana');
  });
});
