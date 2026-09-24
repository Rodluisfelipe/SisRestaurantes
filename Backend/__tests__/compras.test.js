/**
 * Compras a proveedores: lo que entra al inventario, a qué costo y qué se debe.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresco-de-prueba';

const fs = require('fs');
const path = require('path');
const { validarCompra, sugerido } = require('../utils/compras');

const LINEA = { tipo: 'insumo', refId: '66f000000000000000000001', nombre: 'Carne', cantidad: 10, costoUnitario: 12000 };

describe('registrar una compra', () => {
  it('el total sale de las líneas, no de lo que diga el cliente', () => {
    const r = validarCompra({ proveedorId: 'p1', total: 1, lineas: [LINEA, { ...LINEA, nombre: 'Pan', cantidad: 20, costoUnitario: 800 }] });
    expect(r.ok).toBe(true);
    expect(r.compra.total).toBe(136000);
  });

  it('lo que no se paga de contado queda por pagar', () => {
    const r = validarCompra({ proveedorId: 'p1', pagado: 50000, lineas: [LINEA] });
    expect(r.compra).toMatchObject({ total: 120000, pagado: 50000, saldo: 70000 });
  });

  it('no se paga más que el total', () => {
    expect(validarCompra({ proveedorId: 'p1', pagado: 999999, lineas: [LINEA] }).compra.saldo).toBe(0);
  });

  it('rechaza lo que no tiene sentido', () => {
    expect(validarCompra({ lineas: [LINEA] }).ok).toBe(false);
    expect(validarCompra({ proveedorId: 'p1', lineas: [] }).ok).toBe(false);
    expect(validarCompra({ proveedorId: 'p1', lineas: [{ ...LINEA, cantidad: 0 }] }).ok).toBe(false);
    expect(validarCompra({ proveedorId: 'p1', lineas: [{ ...LINEA, costoUnitario: -1 }] }).ok).toBe(false);
    expect(validarCompra({ proveedorId: 'p1', lineas: [{ ...LINEA, tipo: 'otro' }] }).ok).toBe(false);
  });
});

describe('qué comprar', () => {
  it('lo que está en o bajo su mínimo, hasta el doble del mínimo', () => {
    expect(sugerido(3, 10)).toBe(17);
    expect(sugerido(10, 10)).toBe(10);
    expect(sugerido(0, 5)).toBe(10);
  });

  it('lo que está sobre el mínimo, o sin mínimo, no se sugiere', () => {
    expect(sugerido(11, 10)).toBe(0);
    expect(sugerido(0, 0)).toBe(0);
  });
});

describe('la ruta', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'compras.js'), 'utf8');

  it('mete la mercancía al kardex como entrada y deja el último costo', () => {
    expect(src).toContain("type: 'purchase'");
    expect(src).toContain('cost: linea.costoUnitario');
  });

  it('solo toca insumos y productos del negocio de quien registra', () => {
    expect(src).toContain('{ _id: linea.refId, businessId }');
    expect(src).toContain('Proveedor.findOne({ _id: v.compra.proveedorId, businessId })');
  });

  it('un token de caja no entra', () => {
    expect(src).toContain("req.user?.scope === 'pos'");
  });
});
