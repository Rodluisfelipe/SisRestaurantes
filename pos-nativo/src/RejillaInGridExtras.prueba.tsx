import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import RejillaInGridExtras from './RejillaInGridExtras';
import type { GrupoExtra, Producto } from './nativo';

/**
 * Elegir extras en una sola pantalla.
 *
 * Antes esto iba grupo por grupo y, con varias unidades, una vuelta completa
 * por cada una: tres combos de dos grupos eran seis pantallas de "siguiente".
 * Lo que se prueba acá es que eso ya no pase —que todo esté a la vista y se
 * confirme una vez— sin perder lo que sí protegía el paso a paso: que no se
 * mande a cocina un plato al que le falta elegir el término.
 */

const PRODUCTO: Producto = {
  id: 'burger',
  nombre: 'Hamburguesa',
  precio: 20000,
  categoria: 'Fuertes',
  variante: '',
  foto: '',
  extras: [],
};

/** Obligatorio y excluyente: hay que elegir uno y solo uno. */
const TERMINO: GrupoExtra = {
  id: 'g-termino',
  nombre: 'Término',
  precio_base: 0,
  obligatorio: true,
  multiple: false,
  opciones: [
    { nombre: 'Tres cuartos', precio: 0 },
    { nombre: 'Bien asada', precio: 0 },
  ],
  subgrupos: [],
};

/** Opcional y de varias: se pueden marcar todas las que quiera. */
const ADICIONES: GrupoExtra = {
  id: 'g-adiciones',
  nombre: 'Adiciones',
  precio_base: 0,
  obligatorio: false,
  multiple: true,
  opciones: [
    { nombre: 'Tocineta', precio: 4000 },
    { nombre: 'Queso extra', precio: 3000 },
  ],
  subgrupos: [],
};

const GRUPOS = [TERMINO, ADICIONES];

const montar = (props: Partial<Parameters<typeof RejillaInGridExtras>[0]> = {}) => {
  const onListo = vi.fn();
  const onCancelar = vi.fn();
  render(
    <RejillaInGridExtras
      producto={PRODUCTO}
      cantidad={1}
      grupos={GRUPOS}
      columnas={4}
      onListo={onListo}
      onCancelar={onCancelar}
      {...props}
    />,
  );
  return { onListo, onCancelar };
};

describe('todo en una pantalla', () => {
  it('muestra los dos grupos a la vez', () => {
    /* El punto entero del cambio. Si un grupo no está visible, el cajero
       volvió a necesitar un "siguiente" para llegar a él. */
    montar();

    expect(screen.getByText('Término')).toBeTruthy();
    expect(screen.getByText('Adiciones')).toBeTruthy();
    expect(screen.getByText('Tres cuartos')).toBeTruthy();
    expect(screen.getByText('Tocineta')).toBeTruthy();
  });

  it('no hay botón de siguiente', () => {
    montar();

    expect(screen.queryByText(/Siguiente/i)).toBeNull();
  });

  it('marcar una opción no salta a otro grupo', () => {
    /* Avanzar solo era lo que obligaba a recorrer la pantalla en el orden de
       los grupos. El cliente no habla en ese orden. */
    montar();

    fireEvent.click(screen.getByText('Tocineta'));

    expect(screen.getByText('Término')).toBeTruthy();
    expect(screen.getByText('Tres cuartos')).toBeTruthy();
  });
});

describe('lo que el paso a paso sí protegía', () => {
  it('no confirma si falta un grupo obligatorio', () => {
    /* Sin esto se manda a cocina una carne sin término y el cocinero tiene
       que salir a preguntar con la fila armada. */
    const { onListo } = montar();

    fireEvent.click(screen.getByText(/^Falta/));

    expect(onListo).not.toHaveBeenCalled();
  });

  it('el botón dice cuál grupo falta, en vez de apagarse', () => {
    /* Un botón deshabilitado en un mostrador no explica nada, y con varios
       grupos en pantalla el cajero se queda mirando sin saber cuál es. */
    montar();

    expect(screen.getByText('Falta Término')).toBeTruthy();
  });

  it('confirma cuando ya está resuelto', () => {
    const { onListo } = montar();

    fireEvent.click(screen.getByText('Tres cuartos'));
    fireEvent.click(screen.getByText('Confirmar'));

    expect(onListo).toHaveBeenCalledTimes(1);
    expect(onListo.mock.calls[0][0]).toHaveLength(1);
  });

  it('un grupo opcional no traba nada', () => {
    const { onListo } = montar();

    fireEvent.click(screen.getByText('Bien asada'));
    fireEvent.click(screen.getByText('Confirmar'));

    expect(onListo).toHaveBeenCalled();
  });
});

describe('el precio de lo que se marca', () => {
  it('suma las adiciones', () => {
    const { onListo } = montar();

    fireEvent.click(screen.getByText('Tres cuartos'));
    fireEvent.click(screen.getByText('Tocineta'));
    fireEvent.click(screen.getByText('Queso extra'));
    fireEvent.click(screen.getByText('Confirmar'));

    expect(onListo.mock.calls[0][0][0].sobreprecio).toBe(7000);
  });

  it('en un grupo de una sola, la segunda reemplaza a la primera', () => {
    /* Si sumara, una carne quedaría "tres cuartos y bien asada" y con el
       sobreprecio de las dos. */
    const { onListo } = montar();

    fireEvent.click(screen.getByText('Tres cuartos'));
    fireEvent.click(screen.getByText('Bien asada'));
    fireEvent.click(screen.getByText('Confirmar'));

    const extras = onListo.mock.calls[0][0][0].extras;
    expect(extras.filter((e: { grupo: string }) => e.grupo === 'Término')).toHaveLength(1);
  });
});

describe('varias unidades', () => {
  it('devuelve una configuración por unidad', () => {
    const { onListo } = montar({ cantidad: 3 });

    fireEvent.click(screen.getByText('Tres cuartos'));
    fireEvent.click(screen.getByText('Las 3 iguales'));

    expect(onListo.mock.calls[0][0]).toHaveLength(3);
  });

  it('"las N iguales" copia lo marcado a todas', () => {
    /* Es el caso que de verdad ocurre en un mostrador: tres combos normales.
       Con esto son dos toques, no tres vueltas de pantalla. */
    const { onListo } = montar({ cantidad: 3 });

    fireEvent.click(screen.getByText('Tres cuartos'));
    fireEvent.click(screen.getByText('Tocineta'));
    fireEvent.click(screen.getByText('Las 3 iguales'));

    for (const u of onListo.mock.calls[0][0]) {
      expect(u.sobreprecio).toBe(4000);
    }
  });

  it('se puede saltar a la unidad que el cliente cambió', () => {
    /* Las pestañas son la razón de que no haya que recorrer las anteriores
       para llegar a la tercera. */
    const { onListo } = montar({ cantidad: 2 });

    fireEvent.click(screen.getByText('Tres cuartos'));

    // A la segunda, y se le pone otra cosa.
    const cabecera = screen.getByText('Hamburguesa').parentElement as HTMLElement;
    fireEvent.click(within(cabecera).getByText('2'));
    fireEvent.click(screen.getByText('Bien asada'));
    fireEvent.click(screen.getByText('Tocineta'));

    fireEvent.click(screen.getByText('Confirmar 2'));

    const [primera, segunda] = onListo.mock.calls[0][0];
    expect(primera.sobreprecio).toBe(0);
    expect(segunda.sobreprecio).toBe(4000);
  });

  it('no confirma si a una unidad le falta lo obligatorio', () => {
    /* La trampa de las pestañas: se resuelve la primera, se pasa a la segunda
       y se confirma olvidando que quedó sin término. */
    const { onListo } = montar({ cantidad: 2 });

    fireEvent.click(screen.getByText('Tres cuartos'));
    const cabecera = screen.getByText('Hamburguesa').parentElement as HTMLElement;
    fireEvent.click(within(cabecera).getByText('2'));

    fireEvent.click(screen.getByText(/^Falta/));

    expect(onListo).not.toHaveBeenCalled();
  });
});

describe('cómo se sale', () => {
  it('cancelar avisa a quien lo abrió', () => {
    const { onCancelar } = montar();

    fireEvent.click(screen.getByText('Cancelar'));

    expect(onCancelar).toHaveBeenCalled();
  });

  it('Escape también', () => {
    /* En una caja se trabaja con teclado: el cajero no suelta para tomar el
       ratón y cerrar una pantalla que abrió por error. */
    const { onCancelar } = montar();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onCancelar).toHaveBeenCalled();
  });
});
