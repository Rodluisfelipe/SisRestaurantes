import { describe, expect, it } from 'vitest';
import { billetesProbables } from './cobroRapido';

describe('billetesProbables', () => {
  it('redondea hacia arriba a los billetes que circulan', () => {
    expect(billetesProbables(27_000)).toEqual([30_000, 40_000, 50_000]);
  });

  it('no repite el total: pagar exacto tiene su propio botón', () => {
    expect(billetesProbables(50_000)).not.toContain(50_000);
    expect(billetesProbables(50_000)).toContain(100_000);
  });

  it('con montos chicos propone lo chico', () => {
    expect(billetesProbables(3_500)).toEqual([5_000, 10_000, 20_000]);
  });

  it('respeta cuántos caben', () => {
    expect(billetesProbables(27_000, 2)).toEqual([30_000, 40_000]);
  });

  it('sin total no hay nada', () => {
    expect(billetesProbables(0)).toEqual([]);
  });
});

import { opcionesPropina } from './CobroMixto';

describe('opcionesPropina', () => {
  it('ofrece la sugerida del panel aunque no sea de las de siempre', () => {
    expect(opcionesPropina(8)).toEqual([0, 5, 8, 10]);
  });

  it('no repite la que ya está', () => {
    expect(opcionesPropina(10)).toEqual([0, 5, 10]);
  });

  it('con sugerida cero quedan las de siempre', () => {
    expect(opcionesPropina(0)).toEqual([0, 5, 10]);
  });
});
