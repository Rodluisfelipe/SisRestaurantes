import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CobroMixto from './CobroMixto';

/** El botón grande de cobrar: dice "Cobrar" o "Faltan $…" según el caso. */
const botonCobrar = () =>
  screen.getAllByRole('button').find((b) => /^(Cobrar|Faltan)/.test(b.textContent || ''))!;

const montar = (credito: number | null, total = 10000) => {
  const onCobrar = vi.fn();
  render(
    <CobroMixto
      total={total}
      conPropina={false}
      pidiendoVoucher
      credito={credito}
      onCambio={() => {}}
      onMedio={() => {}}
      onCobrar={onCobrar}
      onCancelar={() => {}}
    />,
  );
  return { onCobrar };
};

/**
 * Fiar desde la caja: solo a quien tiene crédito, y nunca por encima del cupo.
 */
describe('cobrar a crédito', () => {
  it('sin crédito habilitado no aparece la opción', () => {
    montar(null);
    expect(screen.queryByText('Crédito')).toBeNull();
  });

  it('con cupo suficiente se fía de un toque, sin pedir voucher', () => {
    const { onCobrar } = montar(50000);
    fireEvent.click(screen.getByText('Crédito'));
    expect(screen.getByText(/Se le fía/)).toBeTruthy();
    fireEvent.click(botonCobrar());
    expect(onCobrar).toHaveBeenCalledWith([{ metodo: 'credito', monto: 10000, referencia: '' }], 0);
  });

  it('por encima del cupo no deja cobrar', () => {
    const { onCobrar } = montar(5000);
    fireEvent.click(screen.getByText('Crédito'));
    expect(screen.getByText(/Supera el cupo/)).toBeTruthy();
    fireEvent.click(botonCobrar());
    expect(onCobrar).not.toHaveBeenCalled();
  });
});
