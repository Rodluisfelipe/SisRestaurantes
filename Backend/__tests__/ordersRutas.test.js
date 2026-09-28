/**
 * Routes/orders/ se separó en archivos. Esta prueba CARGA el router de verdad
 * (no lee su texto): un error de sintaxis, un require roto o un orden de
 * montaje equivocado falla acá y no en producción.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'prueba';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'prueba2';

const orders = require('../Routes/orders');

const rutas = (r) => r.stack.flatMap((capa) => {
  if (capa.route) return Object.keys(capa.route.methods).map((m) => `${m.toUpperCase()} ${capa.route.path}`);
  return capa.handle?.stack ? rutas(capa.handle) : [];
});

describe('Routes/orders', () => {
  const todas = rutas(orders);

  it('registra los 25 endpoints de siempre', () => {
    expect(todas).toHaveLength(25);
    expect(new Set(todas).size).toBe(25);
  });

  it('las rutas de un segmento van antes que GET /:id', () => {
    const detalle = todas.indexOf('GET /:id');
    expect(detalle).toBeGreaterThan(-1);
    for (const r of ['GET /', 'GET /completed', 'GET /bought-together', 'GET /my-orders', 'GET /open-tab']) {
      expect(todas.indexOf(r)).toBeGreaterThan(-1);
      expect(todas.indexOf(r)).toBeLessThan(detalle);
    }
  });

  it('conserva lo que usan la caja y las reservas', () => {
    expect(typeof orders.actualizarEstadoPedido).toBe('function');
    expect(typeof orders.generateOrderNumber).toBe('function');
  });
});
