import { describe, expect, it } from 'vitest';
import { columnaDe, minutosDesde, recienLlegados, siguientePaso } from './reglasPedidosWeb';
import type { PedidoWeb } from './nativo';

const pedido = (estado: string, tipo = 'takeaway', id = 'a'): PedidoWeb => ({
  id, numero: '1', estado, canal: 'inapp', tipo, cliente: '', telefono: '', direccion: '',
  mesa: '', notas: '', metodo_pago: 'cash', comprobante: false, total: 0, envio: 0,
  creado: '', items: [],
});

describe('el tablero de pedidos web', () => {
  it('un pedido nuevo se acepta de un toque', () => {
    expect(siguientePaso(pedido('pending'))).toEqual({ estado: 'confirmed', etiqueta: 'Aceptar' });
  });

  it('sin pago no se prepara nada', () => {
    expect(siguientePaso(pedido('pending_payment'))).toBeNull();
  });

  it('con comprobante, primero se confirma el pago', () => {
    expect(siguientePaso(pedido('payment_uploaded'))?.estado).toBe('payment_confirmed');
  });

  it('un domicilio listo se entrega y lo demás se completa', () => {
    expect(siguientePaso(pedido('ready', 'delivery'))?.estado).toBe('delivered');
    expect(siguientePaso(pedido('ready', 'takeaway'))?.estado).toBe('completed');
  });

  it('cada estado cae en su columna', () => {
    expect(columnaDe('pending')).toBe('nuevos');
    expect(columnaDe('payment_uploaded')).toBe('nuevos');
    expect(columnaDe('confirmed')).toBe('preparando');
    expect(columnaDe('ready')).toBe('listos');
  });

  it('avisa solo lo nuevo que no se había visto', () => {
    const vistos = new Set(['a']);
    const lista = [pedido('pending', 'takeaway', 'a'), pedido('pending', 'takeaway', 'b'), pedido('ready', 'takeaway', 'c')];
    expect(recienLlegados(vistos, lista).map((p) => p.id)).toEqual(['b']);
  });

  it('cuenta los minutos de espera', () => {
    const ahora = Date.parse('2026-09-23T17:10:00Z');
    expect(minutosDesde('2026-09-23T17:00:00Z', ahora)).toBe(10);
    expect(minutosDesde('', ahora)).toBe(0);
  });
});
