import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatear, TOPE_S, useSpeedOfService } from './useSpeedOfService';

/**
 * El cronómetro de la venta.
 *
 * Se prueba con el reloj simulado porque lo que hay que verificar son tramos de
 * minutos y horas: esperar de verdad convertiría la suite en algo que nadie
 * ejecuta. `vi.setSystemTime` mueve `Date.now`, que es justo de donde el hook
 * saca el tiempo —y no de contar tics— para que una suspensión del equipo no le
 * descuadre la cuenta.
 */

/** Adelanta el reloj y deja que el intervalo corra.
 *
 * Solo `advanceTimersByTime`: con los temporizadores simulados esa llamada
 * ya mueve `Date.now` además de disparar los intervalos. Adelantar también
 * con `setSystemTime` haría avanzar el reloj el doble, y las duraciones
 * saldrían justo al doble de lo que la prueba cree estar midiendo. */
function avanzar(segundos: number) {
  act(() => {
    vi.advanceTimersByTime(segundos * 1000);
  });
}

describe('el cronómetro de la venta', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-20T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('empieza apagado: un contador en cero toda la jornada es ruido', () => {
    const { result } = renderHook(() => useSpeedOfService());

    expect(result.current.reloj).toBe('');
    expect(result.current.segundos).toBe(0);
    expect(result.current.ritmo).toBe('apagado');
  });

  it('arranca con el primer gesto de la venta', () => {
    /* Lo llaman el primer producto y la asociación de cliente: cualquiera de
       los dos puede ser el comienzo real. */
    const { result } = renderHook(() => useSpeedOfService());

    act(() => result.current.arrancar());
    expect(result.current.reloj).toBe('00:00');

    avanzar(5);
    expect(result.current.segundos).toBe(5);
    expect(result.current.reloj).toBe('00:05');
  });

  it('arrancar de nuevo no reinicia la cuenta', () => {
    /* Es lo que permite llamarlo en cada producto sin pensarlo. Si reiniciara,
       marcar el segundo producto pondría el reloj en cero y el dato no mediría
       nada. */
    const { result } = renderHook(() => useSpeedOfService());

    act(() => result.current.arrancar());
    avanzar(30);
    act(() => result.current.arrancar());
    act(() => result.current.arrancar());

    expect(result.current.segundos).toBe(30);
  });

  it('cambia de color según el ritmo, sin interrumpir nada', () => {
    /* El color es para el negocio, no una nota al cajero: una venta de veinte
       productos tarda más que un café. Por eso solo cambia un color. */
    const { result } = renderHook(() => useSpeedOfService());

    act(() => result.current.arrancar());
    expect(result.current.ritmo).toBe('bien');

    avanzar(45);
    expect(result.current.ritmo).toBe('bien');

    avanzar(1); // 46 s
    expect(result.current.ritmo).toBe('medio');

    avanzar(44); // 90 s
    expect(result.current.ritmo).toBe('medio');

    avanzar(1); // 91 s
    expect(result.current.ritmo).toBe('lento');
  });

  it('cerrar devuelve los segundos y apaga el reloj', () => {
    const { result } = renderHook(() => useSpeedOfService());

    act(() => result.current.arrancar());
    avanzar(47);

    let duracion = -1;
    act(() => { duracion = result.current.cerrar(); });

    expect(duracion).toBe(47);
    expect(result.current.reloj).toBe('');
    expect(result.current.ritmo).toBe('apagado');
  });

  it('cerrar sin haber arrancado devuelve cero, no un disparate', () => {
    /* Pasa cuando una venta se retoma de "en espera": el carrito llega lleno
       sin que esta pantalla haya medido nada. */
    const { result } = renderHook(() => useSpeedOfService());

    let duracion = -1;
    act(() => { duracion = result.current.cerrar(); });

    expect(duracion).toBe(0);
  });

  it('una caja olvidada encendida se acota a dos horas', () => {
    /* Una venta abierta desde la mañana y cobrada en la tarde no es una toma
       de cinco horas: es una pantalla que quedó prendida. Ese único valor
       arruina el promedio del día entero. */
    const { result } = renderHook(() => useSpeedOfService());

    act(() => result.current.arrancar());
    avanzar(8 * 3600); // ocho horas

    let duracion = -1;
    act(() => { duracion = result.current.cerrar(); });

    expect(duracion).toBe(TOPE_S);
    expect(TOPE_S).toBe(7200);
  });

  it('justo en el tope no se recorta', () => {
    const { result } = renderHook(() => useSpeedOfService());

    act(() => result.current.arrancar());
    avanzar(7200);

    let duracion = -1;
    act(() => { duracion = result.current.cerrar(); });

    expect(duracion).toBe(7200);
  });

  it('un reloj que salta hacia atrás no produce una duración negativa', () => {
    /* Pasa de verdad: la pila de la placa está agotada, el equipo cree estar
       en 1970 y al sincronizar con la nube el reloj se corrige a mitad de una
       venta. Una duración negativa envenenaría el promedio del negocio. */
    const { result } = renderHook(() => useSpeedOfService());

    act(() => result.current.arrancar());
    act(() => { vi.setSystemTime(Date.now() - 3600 * 1000); });

    let duracion = -1;
    act(() => { duracion = result.current.cerrar(); });

    expect(duracion).toBe(0);
  });

  it('reiniciar descarta la medición sin devolverla', () => {
    /* La venta se canceló con Escape. Si el reloj se conservara, la siguiente
       empezaría corrida y el promedio del día quedaría inflado. */
    const { result } = renderHook(() => useSpeedOfService());

    act(() => result.current.arrancar());
    avanzar(60);
    act(() => result.current.reiniciar());

    expect(result.current.reloj).toBe('');

    act(() => result.current.arrancar());
    expect(result.current.segundos).toBe(0);
  });

  it('el segundero no corre mientras no hay venta', () => {
    /* Un intervalo encendido catorce horas en un equipo de mostrador es un
       redibujado por segundo para mostrar un cero. */
    const { result } = renderHook(() => useSpeedOfService());

    avanzar(120);
    expect(result.current.segundos).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('deja de contar al desmontarse', () => {
    const { result, unmount } = renderHook(() => useSpeedOfService());

    act(() => result.current.arrancar());
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('el formato del reloj', () => {
  it('es MM:SS con dos dígitos', () => {
    expect(formatear(0)).toBe('00:00');
    expect(formatear(5)).toBe('00:05');
    expect(formatear(47)).toBe('00:47');
    expect(formatear(60)).toBe('01:00');
    expect(formatear(91)).toBe('01:31');
    expect(formatear(599)).toBe('09:59');
  });

  it('por encima de una hora sigue contando minutos', () => {
    /* "74:12" se lee peor que "1:14:12" en un reloj de pared, pero mejor en un
       mostrador: lo que hay que entender es "esto lleva demasiado". */
    expect(formatear(3600)).toBe('60:00');
    expect(formatear(4452)).toBe('74:12');
    expect(formatear(7200)).toBe('120:00');
  });

  it('un negativo no imprime basura', () => {
    expect(formatear(-30)).toBe('00:00');
  });
});
