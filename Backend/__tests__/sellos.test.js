/* Tarjeta de sellos: la configuración siempre queda en rangos sanos y el
   descuento del premio nunca pasa del valor del pedido. */
jest.mock('../Models/LoyaltyProgram', () => ({}));
jest.mock('../Models/CustomerLoyalty', () => ({}));
jest.mock('../Models/Customer', () => ({}));
jest.mock('../Models/Product', () => ({
  findById: () => ({ select: () => ({ lean: async () => ({ price: 7000 }) }) }),
}));

const { tarjetaDe, descuentoDelPremio, estadoTarjeta } = require('../services/sellos');

describe('tarjetaDe', () => {
  test('sin datos usa 10 sellos, sin mínimo y producto gratis', () => {
    const t = tarjetaDe({});
    expect(t.requeridos).toBe(10);
    expect(t.montoMinimo).toBe(0);
    expect(t.premio.tipo).toBe('free_product');
  });

  test('los sellos quedan entre 2 y 30', () => {
    expect(tarjetaDe({ stampCard: { required: 1 } }).requeridos).toBe(2);
    expect(tarjetaDe({ stampCard: { required: 99 } }).requeridos).toBe(30);
  });

  test('un tipo de premio desconocido vuelve a producto gratis', () => {
    expect(tarjetaDe({ stampCard: { reward: { type: 'free_delivery' } } }).premio.tipo).toBe('free_product');
  });
});

describe('descuentoDelPremio', () => {
  const tarjeta = (reward) => tarjetaDe({ stampCard: { reward } });

  test('descuento fijo no pasa del total', async () => {
    expect(await descuentoDelPremio(tarjeta({ type: 'discount_fixed', discountValue: 10000 }), [], 25000)).toEqual({ ok: true, descuento: 10000 });
    expect(await descuentoDelPremio(tarjeta({ type: 'discount_fixed', discountValue: 10000 }), [], 6000)).toEqual({ ok: true, descuento: 6000 });
  });

  test('porcentaje con tope', async () => {
    expect(await descuentoDelPremio(tarjeta({ type: 'discount_percent', discountValue: 20 }), [], 50000)).toEqual({ ok: true, descuento: 10000 });
    expect(await descuentoDelPremio(tarjeta({ type: 'discount_percent', discountValue: 20, maxDiscount: 5000 }), [], 50000)).toEqual({ ok: true, descuento: 5000 });
  });

  test('producto gratis exige que el pedido lo traiga y usa el precio de la base', async () => {
    const t = tarjeta({ type: 'free_product', productId: 'abc', productName: 'Papas' });
    const sin = await descuentoDelPremio(t, [{ productId: 'otro' }], 20000);
    expect(sin.ok).toBe(false);
    expect(sin.message).toMatch(/Papas/);
    // El navegador dice $1, pero cuenta el precio real ($7.000)
    expect(await descuentoDelPremio(t, [{ productId: 'abc', price: 1 }], 20000)).toEqual({ ok: true, descuento: 7000 });
  });
});

test('estadoTarjeta sin ficha del cliente arranca en cero', () => {
  const e = estadoTarjeta({ stampCard: { required: 8 } }, null);
  expect(e).toMatchObject({ requeridos: 8, sellos: 0, premiosDisponibles: 0 });
});
