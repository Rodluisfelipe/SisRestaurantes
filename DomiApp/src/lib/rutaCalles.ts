/**
 * La ruta por las calles (la calcula el servidor con Mapbox).
 *
 * La app siempre tiene su plan en línea recta (ruta.ts): funciona sin señal.
 * Encima de eso, cuando hay señal, le pide al servidor la ruta real y la usa
 * para dibujar y para las horas de llegada. Se pide poco a propósito: cuando
 * cambian los pedidos, cuando el domi se alejó de donde se pidió la última
 * vez, o cada 2 minutos para refrescar el tráfico. Cada consulta cuesta.
 */
import { useEffect, useRef, useState } from 'react';
import { llamar } from './api';
import { distanciaKm, type Parada } from './ruta';
import type { Punto } from './tipos';

export type PlanCalles = {
  orden: string[];
  trazo: [number, number][];
  tramos: { clave: string; metros: number | null; segundos: number | null; llegadaSegundos: number }[];
  pedidoEn: Punto;
  at: number;
};

/** Polyline codificada (precisión 6, la de Mapbox) → [[lng, lat], ...] */
export function decodificarPolyline(str: string, precision = 6): [number, number][] {
  const factor = 10 ** precision;
  const out: [number, number][] = [];
  let lat = 0;
  let lng = 0;
  let i = 0;
  const leer = () => {
    let r = 0;
    let d = 0;
    let b: number;
    do {
      b = str.charCodeAt(i++) - 63;
      r |= (b & 0x1f) << d;
      d += 5;
    } while (b >= 0x20 && i <= str.length);
    return r & 1 ? ~(r >> 1) : r >> 1;
  };
  while (i < str.length) {
    lat += leer();
    lng += leer();
    out.push([lng / factor, lat / factor]);
  }
  return out;
}

const REFRESCO_MS = 120_000;
const ALEJADO_KM = 0.25;

/** ¿Hay que pedir de nuevo? */
export function hayQuePedir(anterior: PlanCalles | null, firma: string, firmaAnterior: string, yo: Punto | null, ahora = Date.now()) {
  if (!yo) return false;
  if (!anterior || firma !== firmaAnterior) return true;
  if (ahora - anterior.at > REFRESCO_MS) return true;
  const d = distanciaKm(anterior.pedidoEn, yo);
  return d != null && d > ALEJADO_KM;
}

/** Aplica el plan del servidor a las paradas: orden real, km y minutos reales. */
export function aplicarPlan(paradas: Parada[], plan: PlanCalles | null): Parada[] {
  if (!plan) return paradas;
  const porClave = new Map(paradas.map((p) => [p.clave, p]));
  if (plan.orden.length !== paradas.length || !plan.orden.every((c) => porClave.has(c))) return paradas; // el plan ya no corresponde
  const tramos = new Map(plan.tramos.map((t) => [t.clave, t]));
  return plan.orden.map((c) => {
    const p = porClave.get(c)!;
    const t = tramos.get(c);
    if (!t || t.segundos == null) return p;
    return {
      ...p,
      tramoKm: t.metros != null ? Math.round(t.metros / 100) / 10 : p.tramoKm,
      llegadaMin: Math.max(1, Math.round(t.llegadaSegundos / 60)),
    };
  });
}

/** Hook: el plan por calles para estas paradas (o null mientras no haya). */
export function useRutaCalles(yo: Punto | null, paradas: Parada[], hayRed: boolean) {
  const [plan, setPlan] = useState<PlanCalles | null>(null);
  const firmaAnterior = useRef('');
  const pidiendo = useRef(false);
  const firma = paradas.map((p) => p.clave).sort().join('|');

  useEffect(() => {
    if (!paradas.length) { firmaAnterior.current = ''; return undefined; }
    const revisar = async () => {
      if (!hayRed || pidiendo.current || !hayQuePedir(plan, firma, firmaAnterior.current, yo)) return;
      pidiendo.current = true;
      try {
        const r = await llamar<{ aproximada?: boolean; orden?: string[]; geometria?: string | null; tramos?: PlanCalles['tramos'] }>('/domi-app/ruta', {
          cuerpo: {
            yo,
            paradas: paradas.map((p) => ({ clave: p.clave, ubicacion: p.ubicacion, requiere: p.requiere })),
          },
          tiempo: 12_000,
        });
        firmaAnterior.current = firma;
        if (r.aproximada || !r.orden) { setPlan(null); return; }
        setPlan({ orden: r.orden, trazo: r.geometria ? decodificarPolyline(r.geometria) : [], tramos: r.tramos || [], pedidoEn: yo!, at: Date.now() });
      } catch {
        /* sin señal o sin Mapbox: sigue la línea recta */
      } finally {
        pidiendo.current = false;
      }
    };
    revisar();
    const t = setInterval(revisar, 20_000);
    return () => clearInterval(t);
  }, [firma, yo?.lat, yo?.lng, hayRed, plan]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sin paradas no hay plan (se deriva; no se borra dentro del efecto)
  return paradas.length ? plan : null;
}
