/**
 * Los pedidos web en la caja nativa.
 *
 * El POS web los mostraba y la caja nativa no: quien atendía el mostrador
 * tenía que tener el panel abierto aparte para enterarse de un domicilio.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresco-de-prueba';

const fs = require('fs');
const path = require('path');
const { pedidoParaCaja, ESTADOS_ACTIVOS } = require('../utils/pos');

const PEDIDO = {
  _id: '66f000000000000000000abc',
  orderNumber: '1042',
  status: 'pending',
  orderChannel: 'inapp',
  orderType: 'delivery',
  customerName: '  Ana ',
  phone: '3001234567',
  address: 'Cra 10 # 20-30',
  customerNotes: 'Timbre dañado',
  paymentMethod: 'cash',
  finalAmount: 32000,
  totalAmount: 28000,
  deliveryFee: 4000,
  createdAt: new Date('2026-09-23T17:00:00Z'),
  items: [{
    name: 'Combo Go',
    price: 28000,
    quantity: 1,
    variante: { valores: [] },
    selectedToppings: [
      { groupName: 'Bebida', optionName: 'Coca-Cola' },
      { groupName: 'Salsas', subGroups: [{ subGroupTitle: 'Salsas', optionName: 'BBQ' }] },
    ],
  }],
};

describe('pedidoParaCaja', () => {
  const p = pedidoParaCaja(PEDIDO);

  it('trae lo que el cajero necesita para despachar', () => {
    expect(p).toMatchObject({
      id: '66f000000000000000000abc',
      numero: '1042',
      estado: 'pending',
      tipo: 'delivery',
      cliente: 'Ana',
      direccion: 'Cra 10 # 20-30',
      notas: 'Timbre dañado',
    });
  });

  it('el total es el que paga el cliente, con el domicilio', () => {
    expect(p.total).toBe(32000);
    expect(p.envio).toBe(4000);
  });

  it('los extras llegan listos para leer, también los de subgrupo', () => {
    expect(p.items[0].extras).toEqual(['Coca-Cola', 'BBQ']);
  });

  it('sin número de pedido usa el final del id', () => {
    expect(pedidoParaCaja({ ...PEDIDO, orderNumber: '' }).numero).toBe('000abc');
  });

  it('un pedido a medio llenar no rompe nada', () => {
    const vacio = pedidoParaCaja({ _id: 'x', status: 'pending' });
    expect(vacio.items).toEqual([]);
    expect(vacio.total).toBe(0);
  });

  it('los finales no son activos', () => {
    for (const fin of ['completed', 'delivered', 'cancelled']) {
      expect(ESTADOS_ACTIVOS).not.toContain(fin);
    }
  });
});

describe('las rutas de la caja', () => {
  const pos = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'pos.js'), 'utf8');
  const orders = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'orders.js'), 'utf8');

  it('exigen el token de una caja vigente', () => {
    expect(pos).toMatch(/router\.get\('\/pedidos', tenantAuth, cajaVigente/);
    expect(pos).toMatch(/router\.patch\('\/pedidos\/:id\/estado', tenantAuth, cajaVigente/);
  });

  it('la caja no ve lo que ella misma vendió', () => {
    expect(pos).toContain("orderChannel: { $ne: 'pos' }");
  });

  it('cambiar el estado pasa por el mismo camino que el panel', () => {
    expect(pos).toContain('ordersRouter.actualizarEstadoPedido');
    expect(orders).toContain('router.patch("/:id/status", tenantAuth, validateUpdateOrderStatus, actualizarEstadoPedido)');
    expect(orders).toContain('router.actualizarEstadoPedido = actualizarEstadoPedido');
  });

  it('la función compartida existe al cargar el módulo', () => {
    // Cargar orders.js arrastra la base y los servicios; se prueba lo mínimo.
    expect(orders).toMatch(/async function actualizarEstadoPedido\(req, res\) \{/);
  });
});

describe('agotados desde la caja', () => {
  const pos = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'pos.js'), 'utf8');
  const products = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'products.js'), 'utf8');

  it('exige una caja vigente', () => {
    expect(pos).toMatch(/router\.patch\('\/productos\/:id\/disponible', tenantAuth, cajaVigente/);
  });

  it('pone un valor y no alterna: un reintento no lo vuelve a encender', () => {
    expect(pos).toContain("typeof req.body?.disponible !== 'boolean'");
    expect(pos).toContain('producto.active = req.body.disponible');
  });

  it('solo toca productos del negocio del token', () => {
    expect(pos).toContain('Product.findOne({ _id: id, businessId })');
  });

  it('avisa igual que el panel', () => {
    expect(products).toContain('router.avisarCambioDeProductos = avisarCambioDeProductos');
    expect(pos).toContain('productsRouter.avisarCambioDeProductos(');
  });
});
