/**
 * Tipo de tienda de un negocio.
 *
 * Es el interruptor que decide si un negocio ve MenuBy de siempre (carta,
 * mesas, domicilio por zonas) o las funciones de tienda (variantes, stock por
 * talla o color, envíos). Lo pone el superadmin, así que lo que importa es que
 * por defecto nadie cambie de comportamiento y que no se pueda guardar un
 * valor inventado.
 */
const BusinessConfig = require('../Models/BusinessConfig');

const negocio = (extra = {}) => new BusinessConfig({ businessName: 'Prueba', slug: 'prueba', ...extra });

describe('tipo de tienda', () => {
  it('por defecto todos siguen siendo restaurante', () => {
    expect(negocio().tipoTienda).toBe('restaurante');
  });

  it('se puede marcar como ecommerce', () => {
    const tienda = negocio({ tipoTienda: 'ecommerce' });
    expect(tienda.validateSync()).toBeUndefined();
    expect(tienda.tipoTienda).toBe('ecommerce');
  });

  it('rechaza cualquier otro valor', () => {
    const errores = negocio({ tipoTienda: 'marketplace' }).validateSync();
    expect(errores?.errors?.tipoTienda).toBeDefined();
  });

  it('no toca el tipo de negocio que ya existía (restaurante, café…)', () => {
    const tienda = negocio({ tipoTienda: 'ecommerce', businessType: 'cafe' });
    expect(tienda.businessType).toBe('cafe');
    expect(tienda.validateSync()).toBeUndefined();
  });
});
