import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Autorizar from './Autorizar';

/**
 * Autorizar por permiso: el PIN de alguien que pueda hacerlo, o nada si
 * quien está en la caja ya puede.
 */
describe('Autorizar', () => {
  it('quien ya tiene el permiso solo escribe el motivo, sin PIN', () => {
    const onListo = vi.fn();
    render(<Autorizar titulo="Descuento" detalle="" permiso="descuento" yo="Felipe" onListo={onListo} onCancelar={() => {}} />);
    expect(screen.queryByText('Autorizar')).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('Por qué (obligatorio)'), { target: { value: 'Cliente frecuente' } });
    fireEvent.click(screen.getByText('Confirmar'));
    expect(onListo).toHaveBeenCalledWith('Cliente frecuente', 'Felipe');
  });

  it('sin motivo no se confirma', () => {
    const onListo = vi.fn();
    render(<Autorizar titulo="Descuento" detalle="" permiso="descuento" yo="Felipe" onListo={onListo} onCancelar={() => {}} />);
    fireEvent.click(screen.getByText('Confirmar'));
    expect(onListo).not.toHaveBeenCalled();
    expect(screen.getByText('Escribe por qué')).toBeTruthy();
  });

  it('sin el permiso pide el PIN de alguien que pueda', () => {
    render(<Autorizar titulo="Descuento" detalle="" permiso="descuento" onListo={() => {}} onCancelar={() => {}} />);
    expect(screen.getByText('PIN de alguien que pueda hacerlo')).toBeTruthy();
    expect(screen.getByText('Autorizar')).toBeTruthy();
  });

  it('las acciones sin motivo solo piden el PIN', () => {
    render(<Autorizar sinMotivo titulo="Agotados" detalle="" permiso="agotados" onListo={() => {}} onCancelar={() => {}} />);
    expect(screen.queryByPlaceholderText('Por qué (obligatorio)')).toBeNull();
    expect(screen.getByText('Autorizar')).toBeTruthy();
  });
});
