import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Cuánto tarda el mostrador en armar una venta.
 *
 * El dueño sabe cuánto vendió y no sabe por qué a las 12:30 hay fila. Puede ser
 * la cocina o puede ser que el cajero tarde dos minutos en encontrar los
 * productos; son dos problemas distintos y se arreglan distinto —uno con
 * personal, el otro reordenando el menú—. Sin medirlo, la decisión es a ojo.
 *
 * Esto lo mide **sin pedirle nada al cajero**. Arranca solo con el primer gesto
 * de la venta y se detiene al cobrar. Si hubiera que tocar un botón para
 * iniciarlo, nadie lo tocaría y el dato sería mentira los días de más trabajo,
 * que son justamente los que importan.
 *
 * Dos decisiones sobre las que vale la pena ser explícito:
 *
 * - **El cronómetro no juzga al cajero.** El color es para el negocio, no una
 *   nota al empleado: una venta de veinte productos tarda más que un café y eso
 *   no es lentitud. Por eso no hay alarma, ni sonido, ni nada que interrumpa.
 * - **El tiempo sale del reloj de pared** (`Date.now`) y no de contar tics. Si
 *   el equipo se suspende a mitad de una venta, al despertar la cifra sigue
 *   siendo la correcta; con un contador quedaría corta.
 */

/** A partir de aquí la venta va lenta para un mostrador. */
const AMBAR_S = 46;
/** A partir de aquí hay un cuello de botella que mirar. */
const ROJO_S = 91;

/** Dos horas. Más que esto no es una venta lenta: es una pantalla olvidada. */
export const TOPE_S = 7200;

export type RitmoSOS = 'apagado' | 'bien' | 'medio' | 'lento';

export interface SpeedOfService {
  /** Segundos transcurridos. 0 cuando no hay venta en curso. */
  segundos: number;
  /** `MM:SS`, listo para pintar. Vacío cuando no hay venta en curso. */
  reloj: string;
  ritmo: RitmoSOS;
  /** Arranca si no había empezado. Llamarlo de más no reinicia nada. */
  arrancar: () => void;
  /**
   * Cierra la medición y devuelve lo que se guarda con la venta.
   *
   * Acotado a dos horas, igual que en Rust y en el validador del backend. Los
   * tres topes existen por separado a propósito: este es para que la pantalla
   * no muestre un número absurdo, y los otros dos porque un cliente de la API
   * no es de fiar aunque hoy ese cliente sea esta misma pantalla.
   */
  cerrar: () => number;
  /** Descarta la medición sin guardarla: la venta se canceló. */
  reiniciar: () => void;
}

export function useSpeedOfService(): SpeedOfService {
  /* El instante de arranque vive en los dos sitios a la vez, y no es
     duplicación por descuido:

     - El estado enciende y apaga el intervalo, que es trabajo de React.
     - La ref es la que leen `arrancar` y `cerrar`. Esas dos corren dentro de
       manejadores de eventos, donde el estado es el del último render: si
       `cerrar` leyera el estado justo después de un `arrancar` en el mismo
       gesto, vería `null` y la venta se guardaría con duración cero. */
  const inicio = useRef<number | null>(null);
  const [corriendo, setCorriendo] = useState<number | null>(null);
  const [segundos, setSegundos] = useState(0);

  /* El segundero solo corre si hay algo que contar. Un intervalo encendido toda
     la jornada en un equipo de mostrador es un redibujado por segundo durante
     catorce horas para mostrar un cero. */
  useEffect(() => {
    if (corriendo === null) return;

    setSegundos(Math.floor((Date.now() - corriendo) / 1000));
    const id = window.setInterval(() => {
      setSegundos(Math.floor((Date.now() - corriendo) / 1000));
    }, 1000);

    return () => window.clearInterval(id);
  }, [corriendo]);

  const arrancar = useCallback(() => {
    /* Idempotente a propósito: lo llaman el primer producto, la selección de
       cliente y el botón de venta nueva, y cualquiera de los tres puede ser el
       primero. Si reiniciara, marcar el segundo producto pondría el reloj en
       cero y el dato no mediría nada. */
    if (inicio.current !== null) return;
    const ahora = Date.now();
    inicio.current = ahora;
    setCorriendo(ahora);
  }, []);

  const reiniciar = useCallback(() => {
    inicio.current = null;
    setCorriendo(null);
    setSegundos(0);
  }, []);

  const cerrar = useCallback(() => {
    if (inicio.current === null) return 0;
    const duracion = Math.round((Date.now() - inicio.current) / 1000);
    inicio.current = null;
    setCorriendo(null);
    setSegundos(0);
    return Math.min(TOPE_S, Math.max(0, duracion));
  }, []);

  const activo = corriendo !== null;

  return {
    segundos: activo ? segundos : 0,
    reloj: activo ? formatear(segundos) : '',
    ritmo: !activo ? 'apagado' : segundos >= ROJO_S ? 'lento' : segundos >= AMBAR_S ? 'medio' : 'bien',
    arrancar,
    cerrar,
    reiniciar,
  };
}

/**
 * `MM:SS`.
 *
 * Por encima de una hora se siguen mostrando los minutos corridos: "74:12" se
 * lee peor que "1:14:12" en un reloj, pero mejor en un mostrador, donde lo que
 * hay que entender es "esto lleva demasiado" y no cuánto exactamente.
 */
export function formatear(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
