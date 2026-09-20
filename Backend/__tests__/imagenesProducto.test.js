/**
 * La galería de fotos de un producto.
 *
 * Lo que importa: que la principal quede siempre de primera (es la que ve el
 * cliente en el menú y la que lee el resto de la app), que no se repitan y que
 * no se pueda colar una lista enorme desde el panel.
 */
const { MAX_IMAGENES, normalizarImagenes } = require('../utils/imagenesProducto');

describe('galería de fotos del producto', () => {
  it('pone la principal de primera aunque no venga en la lista', () => {
    expect(normalizarImagenes(['b.jpg', 'c.jpg'], 'a.jpg')).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
  });

  it('no repite la principal si ya está en la lista', () => {
    expect(normalizarImagenes(['a.jpg', 'b.jpg'], 'a.jpg')).toEqual(['a.jpg', 'b.jpg']);
  });

  it('respeta el orden que dejó el negocio cuando no hay principal aparte', () => {
    expect(normalizarImagenes(['c.jpg', 'a.jpg', 'b.jpg'], '')).toEqual(['c.jpg', 'a.jpg', 'b.jpg']);
  });

  it('limpia espacios, vacíos y valores que no son texto', () => {
    expect(normalizarImagenes(['  a.jpg  ', '', null, 42, { url: 'x' }, 'b.jpg'], null))
      .toEqual(['a.jpg', 'b.jpg']);
  });

  it('corta en el máximo permitido', () => {
    const muchas = Array.from({ length: 12 }, (_, i) => `foto-${i}.jpg`);
    const resultado = normalizarImagenes(muchas, 'principal.jpg');
    expect(resultado).toHaveLength(MAX_IMAGENES);
    expect(resultado[0]).toBe('principal.jpg');
  });

  it('un producto sin fotos queda con la galería vacía', () => {
    expect(normalizarImagenes(undefined, undefined)).toEqual([]);
    expect(normalizarImagenes(null, '')).toEqual([]);
    expect(normalizarImagenes('no es una lista', '')).toEqual([]);
  });
});
