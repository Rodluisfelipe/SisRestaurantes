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

/* Todos los días cerrados: si el horario mandara, este negocio no podría
   vender nunca. Es el caso que separa una carta de una tienda. */
const SIEMPRE_CERRADO = {
  monday: { isOpen: false }, tuesday: { isOpen: false }, wednesday: { isOpen: false },
  thursday: { isOpen: false }, friday: { isOpen: false }, saturday: { isOpen: false },
  sunday: { isOpen: false },
};

describe('una tienda no cierra por horario', () => {
  it('el restaurante con todo el horario cerrado está cerrado', () => {
    const r = negocio({ businessHours: SIEMPRE_CERRADO });
    expect(r.isCurrentlyOpen()).toBe(false);
    expect(r.getBusinessStatus().isOpen).toBe(false);
  });

  it('la tienda con el mismo horario sigue vendiendo', () => {
    const t = negocio({ tipoTienda: 'ecommerce', businessHours: SIEMPRE_CERRADO });
    expect(t.isCurrentlyOpen()).toBe(true);
    expect(t.getBusinessStatus().isOpen).toBe(true);
  });

  it('pausar ventas a mano sí la apaga', () => {
    // El horario deja de ser una puerta, pero el interruptor del negocio no.
    const t = negocio({ tipoTienda: 'ecommerce', businessHours: SIEMPRE_CERRADO, isOpen: false });
    expect(t.getBusinessStatus().isOpen).toBe(false);
  });

  it('y pausar el menú también', () => {
    const t = negocio({ tipoTienda: 'ecommerce', businessHours: SIEMPRE_CERRADO, menuStatus: 'paused' });
    expect(t.getBusinessStatus().isOpen).toBe(false);
  });
});
