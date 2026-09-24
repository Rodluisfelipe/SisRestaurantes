/**
 * Crédito de los clientes: fiar en la caja, abonar, y que no se cobre dos veces.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresco-de-prueba';

const fs = require('fs');
const path = require('path');
const { validarVenta } = require('../utils/pos');

const fuente = (r) => fs.readFileSync(path.join(__dirname, '..', r), 'utf8');

describe('la venta de caja trae a su cliente', () => {
  it('ya no se descarta: sin esto todo quedaba como "Mostrador"', () => {
    const r = validarVenta({
      id: '0192f3a1-aaaa-7bbb-8ccc-123456789abc',
      consecutivo: 1,
      total: 10000,
      medio_pago: 'credito',
      pagos: [{ metodo: 'credito', monto: 10000 }],
      items: [{ producto_id: '', nombre: 'Varios', precio: 10000, cantidad: 1 }],
      cliente_id: '66f000000000000000000abc',
      cliente_telefono: '3001234567',
      creada_en: '2026-09-23T12:00:00-05:00',
    });
    expect(r.ok).toBe(true);
    expect(r.venta.clienteId).toBe('66f000000000000000000abc');
    expect(r.venta.clienteTelefono).toBe('3001234567');
    expect(r.venta.pagos[0].metodo).toBe('credito');
  });
});

describe('la cuenta del cliente', () => {
  const servicio = fuente('services/credito.js');
  const modelo = fuente('Models/CreditoMovimiento.js');
  const pos = fuente('Routes/pos.js');
  const panel = fuente('Routes/credito.js');

  it('un reintento de la cola no fía ni abona dos veces', () => {
    expect(modelo).toContain('{ businessId: 1, origenId: 1 }, { unique: true }');
    expect(servicio).toContain('CreditoMovimiento.findOne({ businessId, origenId })');
    expect(pos).toContain('origenId: venta.id');
  });

  it('el saldo nunca queda negativo', () => {
    expect(servicio).toContain("$max: [0,");
  });

  it('las otras cajas se enteran del saldo nuevo', () => {
    expect(servicio).toContain("updatedAt: '$$NOW'");
  });

  it('la caja recibe su cupo y su saldo para fiar sin internet', () => {
    expect(pos).toContain('credito_habilitado: c.credito?.habilitado === true');
    expect(pos).toContain('saldo_credito:');
  });

  it('abonos de la caja por su cola, con una caja vigente', () => {
    expect(pos).toMatch(/router\.post\('\/abonos', tenantAuth, cajaVigente/);
  });

  it('habilitar crédito y cupo es del administrador', () => {
    expect(panel).toContain("req.user?.role === 'staff'");
  });
});
