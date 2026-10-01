/**
 * App del domiciliario v2: la plata (ganancia, efectivo, cuadre) y los eventos
 * que llegan del celular, incluso horas después por falta de señal.
 */
const d = require('../utils/domiApp');

describe('efectivo que cobra el domi', () => {
  test('en efectivo cobra el total, que ya trae el domicilio', () => {
    expect(d.efectivoACobrar({ paymentMethod: 'efectivo', finalAmount: 32000, totalAmount: 27000 })).toBe(32000);
    expect(d.efectivoACobrar({ paymentMethod: 'cash', totalAmount: 15000 })).toBe(15000);
  });

  test('pagado por Nequi, tarjeta o crédito no cobra nada', () => {
    for (const m of ['nequi', 'bold', 'transferencia', 'credito', null]) {
      expect(d.efectivoACobrar({ paymentMethod: m, finalAmount: 30000 })).toBe(0);
    }
  });
});

describe('lo que gana el domi', () => {
  const pedido = { deliveryFee: 5000 };

  test('por defecto se queda con el domicilio', () => {
    expect(d.gananciaDomi(pedido)).toBe(5000);
    expect(d.gananciaDomi(pedido, { modo: 'raro' })).toBe(5000);
  });

  test('fijo, porcentaje o nada', () => {
    expect(d.gananciaDomi(pedido, { modo: 'fijo', valor: 4000 })).toBe(4000);
    expect(d.gananciaDomi(pedido, { modo: 'porcentaje', valor: 80 })).toBe(4000);
    expect(d.gananciaDomi(pedido, { modo: 'ninguno' })).toBe(0);
  });

  test('una regla absurda no paga de más ni en negativo', () => {
    expect(d.gananciaDomi(pedido, { modo: 'porcentaje', valor: 500 })).toBe(5000);
    expect(d.gananciaDomi(pedido, { modo: 'fijo', valor: -3000 })).toBe(0);
    expect(d.gananciaDomi({ deliveryFee: -100 })).toBe(0);
  });
});

describe('cuadre de efectivo', () => {
  test('trae efectivo: entrega lo cobrado menos lo que ganó', () => {
    const c = d.cuadrar([{ efectivo: 32000, ganancia: 5000 }, { efectivo: 20000, ganancia: 4000 }]);
    expect(c).toEqual({ entregas: 2, efectivo: 52000, ganancias: 9000, neto: 43000, debeEntregar: 43000, leDeben: 0 });
  });

  test('todo pagado por transferencia: el local le debe su pago', () => {
    const c = d.cuadrar([{ efectivo: 0, ganancia: 5000 }, { efectivo: 0, ganancia: 5000 }]);
    expect(c.debeEntregar).toBe(0);
    expect(c.leDeben).toBe(10000);
  });

  test('sin entregas está en cero', () => {
    expect(d.cuadrar([])).toMatchObject({ entregas: 0, neto: 0, debeEntregar: 0, leDeben: 0 });
  });
});

describe('el mismo celular guardado distinto', () => {
  test('con y sin 57 es la misma persona', () => {
    expect(d.variantesTelefono('300 123 4567')).toEqual(['3001234567', '573001234567']);
    expect(d.variantesTelefono('+57 300-123-4567')).toEqual(['573001234567', '3001234567']);
    expect(d.variantesTelefono('')).toEqual([]);
  });
});

describe('recorrido del pedido', () => {
  test('el estado sale de las marcas de tiempo', () => {
    expect(d.estadoParaDomi({})).toBe('hacia_local');
    expect(d.estadoParaDomi({ deliveryArrivedStoreAt: 1 })).toBe('en_local');
    expect(d.estadoParaDomi({ deliveryArrivedStoreAt: 1, deliveryPickedAt: 1 })).toBe('hacia_cliente');
    expect(d.estadoParaDomi({ deliveryPickedAt: 1, deliveryArrivedCustomerAt: 1 })).toBe('con_cliente');
    expect(d.estadoParaDomi({ deliveredAt: 1 })).toBe('entregado');
    expect(d.estadoParaDomi({ deliveryFailedAt: 1 })).toBe('no_entregado');
    expect(d.estadoParaDomi({ status: 'cancelled' })).toBe('cancelado');
  });

  test('solo se avanza en orden', () => {
    expect(d.puedeAplicar('recogido', 'hacia_local').aplicar).toBe(true);
    expect(d.puedeAplicar('entregado', 'hacia_cliente').aplicar).toBe(true);
    expect(d.puedeAplicar('entregado', 'hacia_local')).toEqual({ aplicar: false, motivo: 'fuera_de_orden' });
  });

  test('un reintento de algo que ya pasó no es un error', () => {
    expect(d.puedeAplicar('recogido', 'hacia_cliente')).toEqual({ aplicar: false, yaEstaba: true });
    expect(d.puedeAplicar('llegue_local', 'con_cliente')).toEqual({ aplicar: false, yaEstaba: true });
    expect(d.puedeAplicar('entregado', 'entregado')).toEqual({ aplicar: false, yaEstaba: true });
  });

  test('un pedido cancelado o cerrado no se toca', () => {
    expect(d.puedeAplicar('recogido', 'cancelado').motivo).toBe('cancelado');
    expect(d.puedeAplicar('recogido', 'no_entregado').motivo).toBe('cerrado');
  });
});

describe('eventos del celular', () => {
  const ahora = new Date('2026-09-29T20:00:00Z');
  const base = { id: 'a1b2c3d4-e5f6', tipo: 'entregado', pedidoId: '66f000000000000000000abc' };

  test('uno bien formado pasa con su hora', () => {
    const r = d.validarEvento({ ...base, at: '2026-09-29T19:00:00Z', lat: 4.86, lng: -74.05, datos: { codigo: '1234' } }, ahora);
    expect(r.ok).toBe(true);
    expect(r.evento.at.toISOString()).toBe('2026-09-29T19:00:00.000Z');
    expect(r.evento.ubicacion).toEqual({ lat: 4.86, lng: -74.05 });
    expect(r.evento.datos.codigo).toBe('1234');
  });

  test('reloj adelantado se corrige a ahora; más de 2 días se rechaza', () => {
    expect(d.validarEvento({ ...base, at: '2026-09-30T20:00:00Z' }, ahora).evento.at).toEqual(ahora);
    expect(d.validarEvento({ ...base, at: '2026-09-26T20:00:00Z' }, ahora).error).toBe('muy_viejo');
  });

  test('rechaza lo mal formado', () => {
    expect(d.validarEvento({ ...base, id: 'x' }, ahora).error).toBe('id_invalido');
    expect(d.validarEvento({ ...base, tipo: 'borrar' }, ahora).error).toBe('tipo_invalido');
    expect(d.validarEvento({ ...base, pedidoId: '{"$ne":1}' }, ahora).error).toBe('pedido_invalido');
    expect(d.validarEvento({ ...base, datos: { codigo: '12' } }, ahora).error).toBe('codigo_invalido');
    expect(d.validarEvento({ ...base, datos: { fotoUrl: 'javascript:alert(1)' } }, ahora).error).toBe('foto_invalida');
  });

  test('ubicación 0,0 o fuera de rango se ignora', () => {
    expect(d.validarEvento({ ...base, lat: 0, lng: 0 }, ahora).evento.ubicacion).toBeNull();
    expect(d.validarEvento({ ...base, lat: 200, lng: 5 }, ahora).evento.ubicacion).toBeNull();
  });

  test('no entregado siempre lleva un motivo conocido', () => {
    expect(d.validarEvento({ ...base, tipo: 'no_entregado', datos: { motivo: 'direccion_errada' } }, ahora).evento.datos.motivo).toBe('direccion_errada');
    expect(d.validarEvento({ ...base, tipo: 'no_entregado', datos: { motivo: 'inventado' } }, ahora).evento.datos.motivo).toBe('otro');
  });
});

describe('distancias', () => {
  test('Chía a Bogotá centro es ~29 km', () => {
    const km = d.distanciaKm({ lat: 4.8617, lng: -74.0328 }, { lat: 4.5981, lng: -74.0760 });
    expect(km).toBeGreaterThan(28);
    expect(km).toBeLessThan(31);
  });

  test('lee lat/lng y lat/lon', () => {
    expect(d.coordenadas({ lat: 4.8, lon: -74 })).toEqual({ lat: 4.8, lng: -74 });
    expect(d.coordenadas({ lat: 0, lng: 0 })).toBeNull();
  });
});

describe('revisarCercania: entregar solo cerca del cliente', () => {
  const { revisarCercania, RADIO_ENTREGA_M } = require('../utils/domiApp');
  const cliente = { lat: 4.8612, lng: -74.061 };

  test('cerca de la dirección (dentro del radio) pasa', () => {
    // ~110 m al norte
    expect(revisarCercania('entregado', { lat: 4.8622, lng: -74.061 }, cliente)).toMatchObject({ ok: true });
    expect(revisarCercania('llegue_cliente', cliente, cliente)).toMatchObject({ ok: true, metros: 0 });
  });

  test('lejos de la dirección no deja entregar y dice a cuántos metros está', () => {
    const r = revisarCercania('entregado', { lat: 4.8712, lng: -74.061 }, cliente); // ~1,1 km
    expect(r.ok).toBe(false);
    expect(r.error).toBe('lejos_del_cliente');
    expect(r.metros).toBeGreaterThan(RADIO_ENTREGA_M);
  });

  test('sin ubicación del domi no se puede comprobar: no deja', () => {
    expect(revisarCercania('llegue_cliente', null, cliente)).toEqual({ ok: false, error: 'sin_ubicacion' });
  });

  test('pedido sin punto en el mapa, o pasos que no son de entrega, pasan', () => {
    expect(revisarCercania('entregado', { lat: 4.9, lng: -74 }, null)).toEqual({ ok: true });
    expect(revisarCercania('recogido', null, cliente)).toEqual({ ok: true });
    expect(revisarCercania('no_entregado', null, cliente)).toEqual({ ok: true });
  });
});
