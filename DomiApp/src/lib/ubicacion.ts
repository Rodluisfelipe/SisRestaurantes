/**
 * El GPS, con la app abierta y con la pantalla apagada.
 *
 * En segundo plano Android mata cualquier cosa que no sea un "servicio en
 * primer plano" con su notificación fija; por eso la tarea va con
 * `foregroundService`. Los puntos no se mandan directo: entran a la cola, así
 * que un túnel o un sótano sin señal no deja huecos en el recorrido.
 *
 * La tarea se define al cargar este archivo, que se importa lo primero en la
 * app: si Android la despierta con la app cerrada, tiene que existir ya.
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { encolarGps, vaciar, type PuntoGps } from './cola';
import { GPS_EN_RUTA_MS, GPS_ESPERANDO_MS } from './config';
import { sesionActual } from './api';
import type { Punto } from './tipos';

export const TAREA_GPS = 'menuby-domi-gps';

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TAREA_GPS, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const puntos: PuntoGps[] = data.locations.map((l) => ({
    lat: l.coords.latitude,
    lng: l.coords.longitude,
    at: new Date(l.timestamp).toISOString(),
    rumbo: l.coords.heading ?? null,
    velocidad: l.coords.speed ?? null,
    simulada: l.mocked === true,
  }));
  await encolarGps(puntos);
  if (await sesionActual()) await vaciar();
});

export type EstadoPermisos = { primerPlano: boolean; segundoPlano: boolean; gpsEncendido: boolean };

export async function permisosUbicacion(): Promise<EstadoPermisos> {
  const [fg, bg, on] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync().catch(() => ({ granted: false })),
    Location.hasServicesEnabledAsync().catch(() => true),
  ]);
  return { primerPlano: fg.granted, segundoPlano: bg.granted, gpsEncendido: on };
}

export async function pedirPrimerPlano() {
  return (await Location.requestForegroundPermissionsAsync()).granted;
}

/** Android pide primero "mientras se usa" y aparte "todo el tiempo". */
export async function pedirSegundoPlano() {
  if (!(await pedirPrimerPlano())) return false;
  return (await Location.requestBackgroundPermissionsAsync()).granted;
}

export async function ubicacionActual(): Promise<Punto | null> {
  try {
    const u = await Location.getLastKnownPositionAsync({ maxAge: 60_000 })
      ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return u ? { lat: u.coords.latitude, lng: u.coords.longitude } : null;
  } catch {
    return null;
  }
}

/**
 * GPS en vivo para la pantalla (el mapa y las distancias).
 *
 * La primera vez el permiso se da DESPUÉS de abrir la app (en "Prepara tu
 * celular"): por eso, sin permiso, se vuelve a mirar cada pocos segundos y
 * el GPS arranca solo apenas lo den, sin reiniciar la app.
 */
export async function seguir(alMoverse: (p: Punto & { rumbo: number | null; simulada: boolean }) => void) {
  let sub: Location.LocationSubscription | null = null;
  let parado = false;
  let espera: ReturnType<typeof setTimeout> | null = null;
  const arrancar = async () => {
    if (parado) return;
    if (!(await permisosUbicacion()).primerPlano) {
      espera = setTimeout(arrancar, 4000);
      return;
    }
    const s = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
      (l) => alMoverse({ lat: l.coords.latitude, lng: l.coords.longitude, rumbo: l.coords.heading ?? null, simulada: l.mocked === true }),
    );
    if (parado) s.remove();
    else sub = s;
  };
  await arrancar();
  return () => {
    parado = true;
    if (espera) clearTimeout(espera);
    sub?.remove();
  };
}

let modoActual: 'apagado' | 'ruta' | 'esperando' = 'apagado';

/**
 * En ruta: cada 5 s o 10 m, para que el cliente vea la moto moverse.
 * Esperando trabajo: cada 30 s o 50 m, lo justo para que le lleguen ofertas
 * cercanas sin gastar batería.
 */
export async function ponerModoGps(modo: 'apagado' | 'ruta' | 'esperando') {
  if (modo === modoActual) return;
  const corriendo = await Location.hasStartedLocationUpdatesAsync(TAREA_GPS).catch(() => false);
  if (modo === 'apagado') {
    if (corriendo) await Location.stopLocationUpdatesAsync(TAREA_GPS);
    modoActual = modo;
    return;
  }
  if (!(await permisosUbicacion()).segundoPlano) return;
  if (corriendo) await Location.stopLocationUpdatesAsync(TAREA_GPS);
  const ruta = modo === 'ruta';
  await Location.startLocationUpdatesAsync(TAREA_GPS, {
    accuracy: ruta ? Location.Accuracy.High : Location.Accuracy.Balanced,
    timeInterval: ruta ? GPS_EN_RUTA_MS : GPS_ESPERANDO_MS,
    distanceInterval: ruta ? 10 : 50,
    deferredUpdatesInterval: ruta ? GPS_EN_RUTA_MS : GPS_ESPERANDO_MS,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: ruta ? 'Llevando pedidos' : 'Conectado: esperando pedidos',
      notificationBody: ruta ? 'El local y el cliente ven dónde vas.' : 'Te avisamos apenas llegue un pedido cerca.',
      notificationColor: '#D30310',
      killServiceOnDestroy: false,
    },
  });
  modoActual = modo;
}
