/** El aviso de "¿Sigues en camino?" (las reglas están en quieto.ts). */
import { useEffect, useRef } from 'react';
import { avisarAlDomi } from './notificaciones';
import { destinoActual, MOVIO_M, tocaAvisar } from './quieto';
import { distanciaKm } from './ruta';
import type { Pedido, Punto } from './tipos';

export function useAvisoQuieto(pedidos: Pedido[], yo: Punto | null) {
  const ancla = useRef<{ p: Punto; at: number } | null>(null);
  const ultimoAviso = useRef(0);
  const datos = useRef({ pedidos, yo });

  // Cada vez que se mueve de verdad, el reloj de "quieto" vuelve a cero
  useEffect(() => {
    datos.current = { pedidos, yo };
    if (!yo) return;
    const a = ancla.current;
    const d = a ? distanciaKm(a.p, yo) : null;
    if (!a || (d != null && d * 1000 > MOVIO_M)) ancla.current = { p: yo, at: Date.now() };
  }, [pedidos, yo]);

  useEffect(() => {
    const t = setInterval(() => {
      const ahora = Date.now();
      const destino = destinoActual(datos.current.pedidos);
      // Atendiendo una parada o sin pedidos: ese tiempo no cuenta como "quieto"
      if (!destino) { if (ancla.current) ancla.current.at = ahora; return; }
      const quietoDesde = ancla.current?.at ?? ahora;
      if (!tocaAvisar({ destino, yo: datos.current.yo, quietoDesde, ultimoAviso: ultimoAviso.current, ahora })) return;
      ultimoAviso.current = ahora;
      const min = Math.round((ahora - quietoDesde) / 60_000);
      avisarAlDomi('¿Sigues en camino?', `Llevas ${min} min sin moverte. ${destino.texto}.`);
    }, 30_000);
    return () => clearInterval(t);
  }, []);
}
