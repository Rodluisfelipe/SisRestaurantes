/**
 * Lo que corre mientras hay sesión, sin pantalla propia:
 *  - refrescar el estado (cada 15 s y al volver a la app o a la red);
 *  - mandar la cola sin señal;
 *  - el GPS: en vivo para el mapa, y en segundo plano según haya pedidos;
 *  - la conexión en vivo y las notificaciones;
 *  - no dejar que la pantalla se apague con pedidos en curso;
 *  - si cae una oferta con el domi en otra app, abrirse encima de ella;
 *  - con GPS falso, desconectarlo;
 *  - si lleva un rato quieto yendo al local o al cliente, avisarle.
 */
import NetInfo from '@react-native-community/netinfo';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useMemo, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { encolarGps, vaciar } from '@/lib/cola';
import { REFRESCO_MS } from '@/lib/config';
import { escucharAvisos, registrarToken } from '@/lib/notificaciones';
import { useAvisoQuieto } from '@/lib/useAvisoQuieto';
import { traerAlFrente } from '@/lib/sistema';
import { conectarEnVivo, desconectarEnVivo } from '@/lib/tiempoReal';
import { alPuntoEnSegundoPlano, ponerModoGps, seguir } from '@/lib/ubicacion';
import { pedidosVisibles, useApp } from '@/estado/app';

export function Motor() {
  const sesion = useApp((s) => s.sesion);
  const servidor = useApp((s) => s.servidor);
  const locales = useApp((s) => s.locales);
  const enLineaLocal = useApp((s) => s.enLineaLocal);
  const pedidos = useMemo(() => pedidosVisibles(servidor, locales), [servidor, locales]);
  const enLinea = enLineaLocal ?? !!servidor?.cuenta.enLinea;
  const hayPedidos = pedidos.length > 0;
  const ultimoGpsWeb = useRef(0);
  const gpsSimulado = useApp((s) => s.gpsSimulado);
  const ofertas = servidor?.ofertas;
  const ofertasVistas = useRef(new Set<string>());
  const yo = useApp((s) => s.ubicacion);
  useAvisoQuieto(pedidos, yo);

  // Con la app atrás, la pantalla se entera del GPS por la tarea de segundo plano
  useEffect(() => {
    if (!sesion) return undefined;
    alPuntoEnSegundoPlano((p, simulada) => useApp.getState().ponerUbicacion(p, simulada));
    return () => alPuntoEnSegundoPlano(null);
  }, [sesion]);

  // Refresco periódico + al volver a la app
  useEffect(() => {
    if (!sesion) return;
    const { refrescar } = useApp.getState();
    const t = setInterval(() => { if (AppState.currentState === 'active') refrescar(); }, REFRESCO_MS);
    const cola = setInterval(() => { vaciar(); }, 6000);
    const app = AppState.addEventListener('change', (e) => { if (e === 'active') refrescar(); });
    return () => { clearInterval(t); clearInterval(cola); app.remove(); };
  }, [sesion]);

  // Red: al volver la señal se manda todo lo guardado
  useEffect(() => NetInfo.addEventListener((n) => {
    useApp.getState().ponerRed(n.isConnected !== false && n.isInternetReachable !== false);
  }), []);

  // En vivo + notificaciones
  useEffect(() => {
    if (!sesion) return;
    const refrescar = () => useApp.getState().refrescar();
    conectarEnVivo(refrescar);
    registrarToken();
    const quitar = escucharAvisos(refrescar);
    return () => { desconectarEnVivo(); quitar(); };
  }, [sesion]);

  // GPS en vivo para el mapa (y en web, también para el servidor)
  useEffect(() => {
    if (!sesion) return;
    let parar: (() => void) | undefined;
    seguir((p) => {
      useApp.getState().ponerUbicacion({ lat: p.lat, lng: p.lng }, p.simulada);
      if (p.simulada) return;
      const s = useApp.getState();
      const conectado = s.enLineaLocal ?? !!s.servidor?.cuenta.enLinea;
      if (Platform.OS === 'web' && conectado && Date.now() - ultimoGpsWeb.current > 10_000) {
        ultimoGpsWeb.current = Date.now();
        encolarGps([{ lat: p.lat, lng: p.lng, at: new Date().toISOString(), rumbo: p.rumbo }]);
      }
    }).then((f) => { parar = f; });
    return () => parar?.();
  }, [sesion]);

  // GPS en segundo plano: rápido con pedidos, lento esperando, apagado desconectado
  useEffect(() => {
    if (!sesion) { ponerModoGps('apagado').catch(() => {}); return; }
    ponerModoGps(hayPedidos ? 'ruta' : enLinea ? 'esperando' : 'apagado').catch(() => {});
  }, [sesion, hayPedidos, enLinea]);

  // Oferta nueva con el domi en otra app (o con la pantalla apagada): la app se abre sola encima
  useEffect(() => {
    const nuevas = (ofertas || []).filter((o) => !ofertasVistas.current.has(o.id));
    nuevas.forEach((o) => ofertasVistas.current.add(o.id));
    if (nuevas.length && AppState.currentState !== 'active') traerAlFrente();
  }, [ofertas]);

  // GPS falso: fuera de línea hasta que lo apague (el servidor tampoco le manda pedidos)
  useEffect(() => {
    if (gpsSimulado && enLinea) useApp.getState().conectarse(false).catch(() => {});
  }, [gpsSimulado, enLinea]);

  // Pantalla encendida mientras lleva pedidos
  useEffect(() => {
    if (hayPedidos) activateKeepAwakeAsync('ruta').catch(() => {});
    else deactivateKeepAwake('ruta').catch(() => {});
  }, [hayPedidos]);

  return null;
}
