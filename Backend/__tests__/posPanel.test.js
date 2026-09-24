/**
 * La sección "Punto de venta" del panel y los arreglos que salieron al
 * armarla: cierres rechazados por una devolución, cierres ajenos legibles por
 * id, y cierres de la caja mezclados con los del POS web.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresco-de-prueba';

const fs = require('fs');
const path = require('path');
const { validarCierre } = require('../utils/pos');
const panel = require('../Routes/posPanel');

const fuente = (r) => fs.readFileSync(path.join(__dirname, '..', r), 'utf8');

describe('el resumen de la caja', () => {
  const r = panel.resumir({
    ventas: [
      { finalAmount: 30000, tipAmount: 3000, discountAmount: 0, paymentMethod: 'efectivo' },
      { finalAmount: 50000, tipAmount: 0, discountAmount: 5000, paymentMethod: 'mixto',
        posPagos: [{ metodo: 'efectivo', monto: 20000 }, { metodo: 'tarjeta', monto: 30000 }] },
    ],
    cierres: [{ difference: 0 }, { difference: -2000 }],
    excepciones: [{ tipo: 'anular_borrador', monto: 7500 }, { tipo: 'anular_borrador', monto: 4500 }],
    devoluciones: [{ total: 12000 }],
  });

  it('suma lo vendido, las propinas y los descuentos', () => {
    expect(r.ventas).toMatchObject({ cantidad: 2, total: 80000, ticketPromedio: 40000, propinas: 3000, descuentos: 5000 });
  });

  it('un pago mixto se reparte en sus medios', () => {
    const efectivo = r.ventas.porMedio.find((m) => m.metodo === 'efectivo');
    const tarjeta = r.ventas.porMedio.find((m) => m.metodo === 'tarjeta');
    expect(efectivo.total).toBe(50000);
    expect(tarjeta.total).toBe(30000);
  });

  it('cuenta los cierres con descuadre', () => {
    expect(r.cierres).toEqual({ cantidad: 2, conDescuadre: 1, diferencia: -2000 });
  });

  it('agrupa la auditoría por tipo', () => {
    expect(r.auditoria).toEqual([{ tipo: 'anular_borrador', veces: 2, monto: 12000 }]);
  });
});

describe('el rango de fechas', () => {
  it('un día es de medianoche a medianoche en Colombia', () => {
    const { inicio, fin } = panel.rango({ desde: '2026-09-23' });
    expect(inicio.toISOString()).toBe('2026-09-23T05:00:00.000Z');
    expect(fin.toISOString()).toBe('2026-09-24T04:59:59.999Z');
  });

  it('no deja pedir más de un trimestre', () => {
    const { inicio, fin } = panel.rango({ desde: '2020-01-01', hasta: '2026-09-23' });
    expect(fin - inicio).toBeLessThanOrEqual(93 * 24 * 3600 * 1000);
  });

  it('una fecha mal escrita no rompe nada: usa hoy', () => {
    const { inicio } = panel.rango({ desde: 'ayer' });
    expect(inicio).toBeInstanceOf(Date);
    expect(Number.isNaN(inicio.getTime())).toBe(false);
  });
});

describe('el cierre de turno que sube la caja', () => {
  const base = {
    turno_id: 'turno-0001', fondo_inicial: 100000, ventas_efectivo: 50000, ventas_otros: 0,
    entradas: 0, salidas: 0, contado: 138000,
  };

  it('un turno con devolución en efectivo ya no se rechaza', () => {
    // La caja resta lo devuelto; el servidor no lo restaba y el cierre quedaba apartado.
    const r = validarCierre({ ...base, devoluciones_efectivo: 12000, esperado: 138000, diferencia: 0 });
    expect(r.ok).toBe(true);
    expect(r.cierre.detalle.devolucionesEfectivo).toBe(12000);
  });

  it('una caja vieja que no manda devoluciones sigue funcionando', () => {
    const r = validarCierre({ ...base, esperado: 150000, contado: 150000, diferencia: 0 });
    expect(r.ok).toBe(true);
  });

  it('guarda cada movimiento con su motivo', () => {
    const r = validarCierre({
      ...base, salidas: 50000, esperado: 100000, contado: 100000, diferencia: 0,
      movimientos: [{ tipo: 'salida', monto: 50000, motivo: 'Pago domiciliario', usuario: 'Ana' }, { tipo: 'robo', monto: 1 }],
    });
    expect(r.cierre.movimientos).toHaveLength(1);
    expect(r.cierre.movimientos[0]).toMatchObject({ tipo: 'salida', monto: 50000, motivo: 'Pago domiciliario' });
  });
});

describe('seguridad y separación', () => {
  it('un token de caja no entra al panel', () => {
    expect(fuente('Routes/posPanel.js')).toContain("req.user?.scope === 'pos'");
  });

  it('el detalle de un cierre se busca dentro del negocio de quien pregunta', () => {
    const src = fuente('Routes/cashRegister.js');
    expect(src).not.toContain('CashRegister.findById(req.params.id)');
    expect(src).toContain('filtro.businessId = req.user.businessId');
  });

  it('el historial del POS web no mezcla los cierres de la caja nativa', () => {
    expect(fuente('Routes/cashRegister.js')).toContain("origen: { $ne: 'pos-nativo' }");
  });
});

describe('las impresoras de la caja, con lo del agente de impresión', () => {
  const { validarConfig } = require('../utils/configPos');
  const imp = (dada) => validarConfig({ hardware: { impresoraCaja: dada } }).config.hardware.impresoraCaja;

  it('acepta una impresora de Windows por nombre', () => {
    expect(imp({ tipo: 'WINDOWS', nombre: 'POS-58' })).toMatchObject({ tipo: 'WINDOWS', nombre: 'POS-58' });
  });

  it('los mismos cuatro anchos que el agente', () => {
    for (const mm of [44, 58, 76, 80]) expect(imp({ tipo: 'RED', anchoMm: mm }).anchoMm).toBe(mm);
    expect(imp({ tipo: 'RED', anchoMm: 100 }).anchoMm).toBe(80);
  });

  it('cuchilla y QR, con valores seguros por defecto', () => {
    expect(imp({ tipo: 'RED' })).toMatchObject({ corte: true, qr: 'imagen' });
    expect(imp({ tipo: 'RED', corte: false, qr: 'nativo' })).toMatchObject({ corte: false, qr: 'nativo' });
    expect(imp({ tipo: 'RED', qr: 'lo-que-sea' }).qr).toBe('imagen');
  });
});

describe('los cierres en Punto de venta', () => {
  it('muestra los de la caja y los del POS web juntos, con filtro', () => {
    const src = fuente('Routes/posPanel.js');
    expect(src).toContain("if (req.query.origen === 'pos-nativo') filtro.origen = 'pos-nativo'");
    expect(src).toContain("if (req.query.origen === 'web') filtro.origen = { $ne: 'pos-nativo' }");
  });
});

describe('los cortes Z', () => {
  const pos = fuente('Routes/pos.js');
  const modelo = fuente('Models/PosCorteZ.js');

  it('solo acepta cortes Z de una caja vigente', () => {
    expect(pos).toMatch(/router\.post\('\/cortes', tenantAuth, cajaVigente/);
    expect(pos).toContain("inf.tipo !== 'Z'");
  });

  it('un reintento de la cola no duplica el corte', () => {
    expect(modelo).toContain('{ businessId: 1, cajaTokenId: 1, numero: 1 }, { unique: true }');
    expect(pos).toContain('duplicado: true');
  });
});
