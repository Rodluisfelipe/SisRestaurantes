import { describe, expect, it } from 'vitest';
import { leerCantidad, lineaARepetir } from './atajosBusqueda';

describe('leerCantidad', () => {
  it('toma la cantidad y deja el resto para buscar', () => {
    expect(leerCantidad('3*')).toEqual({ cantidad: '3', resto: '' });
    expect(leerCantidad('3*coca')).toEqual({ cantidad: '3', resto: 'coca' });
    expect(leerCantidad(' 12 * papas')).toEqual({ cantidad: '12', resto: 'papas' });
  });

  it('deja en paz lo que es un nombre o un código', () => {
    expect(leerCantidad('2x1 burger')).toBeNull();
    expect(leerCantidad('7702004')).toBeNull();
    expect(leerCantidad('coca')).toBeNull();
  });

  it('no acepta cero ni más de tres dígitos', () => {
    expect(leerCantidad('0*')).toBeNull();
    expect(leerCantidad('1000*')).toBeNull();
  });
});

describe('lineaARepetir', () => {
  it('repite la señalada si hay', () => {
    expect(lineaARepetir(4, 1)).toBe(1);
  });

  it('si no, la última que entró', () => {
    expect(lineaARepetir(4, null)).toBe(3);
  });

  it('una señalada que ya no existe no cuenta', () => {
    expect(lineaARepetir(2, 5)).toBe(1);
  });

  it('con el carrito vacío no hay nada', () => {
    expect(lineaARepetir(0, null)).toBeNull();
  });
});

import { leerPrecioLibre } from './atajosBusqueda';

describe('leerPrecioLibre', () => {
  it('lee el monto, con o sin puntos de mil', () => {
    expect(leerPrecioLibre('$5000')).toBe(5000);
    expect(leerPrecioLibre('$ 12.500')).toBe(12500);
  });

  it('sin el signo es una búsqueda, no un precio', () => {
    expect(leerPrecioLibre('5000')).toBeNull();
  });

  it('descarta lo que no puede ser un precio', () => {
    expect(leerPrecioLibre('$0')).toBeNull();
    expect(leerPrecioLibre('$99999999')).toBeNull();
    expect(leerPrecioLibre('$abc')).toBeNull();
  });
});
