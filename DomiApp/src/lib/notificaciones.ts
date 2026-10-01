/**
 * Avisos al celular: que la oferta suene aunque la app esté cerrada.
 *
 * El servidor manda la oferta por Firebase con el canal 'incoming-orders'.
 * Ese canal lo crea la app con importancia máxima, su propio tono y
 * vibración larga: es lo que hace que suene como una llamada y no como un
 * mensaje de WhatsApp más.
 */
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { llamar } from './api';

export const CANAL_OFERTAS = 'incoming-orders';
export const CANAL_AVISOS = 'avisos';

Notifications.setNotificationHandler({
  // Con la app al frente, la oferta ya se ve en pantalla grande: sin banner doble.
  handleNotification: async (n) => {
    const esOferta = n.request.content.data?.type === 'offer';
    const alFrente = AppState.currentState === 'active';
    return {
      shouldShowBanner: !(esOferta && alFrente),
      shouldShowList: true,
      shouldPlaySound: !(esOferta && alFrente),
      shouldSetBadge: false,
    };
  },
});

export async function crearCanales() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CANAL_OFERTAS, {
    name: 'Pedidos nuevos',
    description: 'Suena cuando te ofrecen un pedido',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'oferta.wav',
    vibrationPattern: [0, 600, 250, 600, 250, 600],
    enableVibrate: true,
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    lightColor: '#E11D2A',
  });
  await Notifications.setNotificationChannelAsync(CANAL_AVISOS, {
    name: 'Avisos',
    description: 'Cambios en tus pedidos y en tu cuadre',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

export async function permisoNotificaciones(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}

export async function pedirNotificaciones(): Promise<boolean> {
  await crearCanales();
  const r = await Notifications.requestPermissionsAsync();
  return r.granted;
}

/** Registra el token de Firebase del celular para que lleguen las ofertas. */
export async function registrarToken(): Promise<boolean> {
  try {
    if (!(await permisoNotificaciones())) return false;
    await crearCanales();
    const t = await Notifications.getDevicePushTokenAsync();
    if (typeof t.data !== 'string') return false;
    await llamar('/domi-app/push', { cuerpo: { token: t.data } });
    return true;
  } catch {
    return false;
  }
}

/** Un aviso al domi desde el propio celular (suena aunque esté en otra app). */
export async function avisarAlDomi(titulo: string, cuerpo: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: titulo, body: cuerpo, sound: 'default', data: { type: 'aviso' } },
      trigger: Platform.OS === 'android' ? { channelId: CANAL_AVISOS } : null,
    });
  } catch { /* sin permiso de avisos: nada que hacer */ }
}

/** Llamado cuando llega o se toca un aviso: la app refresca y muestra la oferta. */
export function escucharAvisos(alLlegar: () => void) {
  const a = Notifications.addNotificationReceivedListener(() => alLlegar());
  const b = Notifications.addNotificationResponseReceivedListener(() => alLlegar());
  return () => { a.remove(); b.remove(); };
}
