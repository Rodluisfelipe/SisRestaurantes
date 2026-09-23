import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import OpcionesLinea from './OpcionesLinea';
import type { GrupoExtra } from './nativo';
import { clave } from './reglasExtras';

/**
 * Las opciones de un combo, debajo del ticket y sin confirmar.
 *
 * Lo que se prueba es que el panel no tenga ningún paso: todo a la vista,
 * cada toque sale de una hacia la línea, y lo obligatorio se señala sin
 * bloquear.
 */

const BEBIDA: GrupoExtra = {
  id: 'g-bebida', nombre: 'Bebida', precio_base: 0, obligatorio: true, multiple: false,
  opciones: [{ nombre: 'Coca-Cola', precio: 0 }, { nombre: 'Malteada', precio: 3000 }],
  subgrupos: [],
};
const ADICIONES: GrupoExtra = {
  id: 'g-adiciones', nombre: 'Adiciones', precio_base: 0, obligatorio: false, multiple: true,
  opciones: [{ nombre: 'Tocineta', precio: 4000 }],
  subgrupos: [],
};

const montar = (elegidas = {}) => {
  const onTocar = vi.fn();
  const onCerrar = vi.fn();
  render(
    <OpcionesLinea
      titulo="Combo Go"
      cantidad={1}
      precio={20000}
      grupos={[BEBIDA, ADICIONES]}
      elegidas={elegidas}
      onTocar={onTocar}
      onCerrar={onCerrar}
    />,
  );
  return { onTocar, onCerrar };
};

describe('OpcionesLinea', () => {
  it('muestra todos los grupos a la vez, sin pasos', () => {
    montar();
    expect(screen.getByText('Coca-Cola')).toBeTruthy();
    expect(screen.getByText('Tocineta')).toBeTruthy();
  });

  it('no tiene confirmar ni siguiente: solo Listo para volver a la carta', () => {
    montar();
    expect(screen.queryByText(/confirmar|siguiente/i)).toBeNull();
  });

  it('cada toque va directo a la línea', () => {
    const { onTocar } = montar();
    fireEvent.click(screen.getByText('Malteada'));
    expect(onTocar).toHaveBeenCalledWith(BEBIDA, 'Malteada', '');
  });

  it('señala el obligatorio sin elegir, también en la barra', () => {
    montar();
    expect(screen.getByText('elige uno')).toBeTruthy();
    expect(screen.getByText('Falta: Bebida')).toBeTruthy();
  });

  it('lo obligatorio va primero aunque el panel lo tenga después', () => {
    render(
      <OpcionesLinea titulo="Combo" cantidad={1} precio={1} grupos={[ADICIONES, BEBIDA]}
        elegidas={{}} onTocar={() => {}} onCerrar={() => {}} />,
    );
    const secciones = document.querySelectorAll('[data-grupo]');
    expect(secciones[0].getAttribute('data-grupo')).toBe('g-bebida');
  });

  it('con la bebida elegida ya no falta nada y se ve marcada', () => {
    montar({ [clave('g-bebida', '', 'Coca-Cola')]: 1 });
    expect(screen.queryByText('elige uno')).toBeNull();
    expect(screen.getByText('Ya está en el ticket')).toBeTruthy();
    expect(screen.getByText('Coca-Cola').closest('button')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('el precio de lo que cobra se ve en la casilla', () => {
    montar();
    expect(screen.getByText(/\+.*4\.000/)).toBeTruthy();
  });

  it('Listo vuelve a la carta', () => {
    const { onCerrar } = montar();
    fireEvent.click(screen.getByText('Listo'));
    expect(onCerrar).toHaveBeenCalled();
  });
});
