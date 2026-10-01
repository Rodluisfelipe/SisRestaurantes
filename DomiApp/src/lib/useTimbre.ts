/**
 * Quién timbra un pedido nuevo: la llamada del sistema o la pantalla de la app.
 *
 * Con la llamada nativa (hayLlamadas), mientras el domi no está viendo la app
 * timbra el sistema (prende la pantalla, suena en bucle). Apenas la ve, se
 * cuelga la llamada y timbra la pantalla de la app: nunca suenan dos.
 * Sin llamada nativa (versión vieja), timbra la app como siempre.
 */
import { useEffect, useState } from 'react';
import { appALaVista, cancelarLlamada, hayLlamadas } from './sistema';

/** true = la app debe sonar. `claves`: las llamadas que se cuelgan al verla. */
export function useTimbre(claves: string[]): boolean {
  const hay = claves.length > 0;
  const [visto, setVisto] = useState(() => !hayLlamadas || appALaVista());
  const llave = claves.join('|');

  useEffect(() => {
    if (!hay || !hayLlamadas) return undefined;
    const revisar = () => {
      const v = appALaVista();
      setVisto(v);
      if (v) claves.forEach(cancelarLlamada);
    };
    revisar();
    const t = setInterval(revisar, 700);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hay, llave]);

  return hay && (!hayLlamadas || visto);
}
