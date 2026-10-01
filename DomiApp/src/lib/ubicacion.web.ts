/** En el navegador (solo para probar): GPS del navegador, sin segundo plano. */
import type { Punto } from './tipos';

export const TAREA_GPS = 'menuby-domi-gps';
export type EstadoPermisos = { primerPlano: boolean; segundoPlano: boolean; gpsEncendido: boolean };

const geo = () => (typeof navigator !== 'undefined' ? navigator.geolocation : undefined);

export async function permisosUbicacion(): Promise<EstadoPermisos> {
  let concedido = false;
  try {
    const p = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    concedido = p?.state === 'granted';
  } catch { /* navegador sin permissions API */ }
  return { primerPlano: concedido, segundoPlano: concedido, gpsEncendido: !!geo() };
}

export async function pedirPrimerPlano() {
  return !!(await ubicacionActual());
}
export const pedirSegundoPlano = pedirPrimerPlano;

export function ubicacionActual(): Promise<Punto | null> {
  return new Promise((res) => {
    const g = geo();
    if (!g) return res(null);
    g.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null), { timeout: 8000 });
  });
}

export async function seguir(alMoverse: (p: Punto & { rumbo: number | null; simulada: boolean }) => void) {
  const g = geo();
  if (!g) return () => {};
  const id = g.watchPosition((p) => alMoverse({ lat: p.coords.latitude, lng: p.coords.longitude, rumbo: p.coords.heading ?? null, simulada: false }), () => {}, { enableHighAccuracy: true });
  return () => g.clearWatch(id);
}

export async function ponerModoGps(_modo: 'apagado' | 'ruta' | 'esperando') {
  /* sin segundo plano en web */
}
