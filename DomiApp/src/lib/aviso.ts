/**
 * Que la oferta se note: tono en bucle y vibración fuerte mientras está en
 * pantalla, y un golpe de vibración distinto para "hecho" y para "error".
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform, Vibration } from 'react-native';

let tono: AudioPlayer | null = null;
let sonando = false;

export async function sonarOferta(conSonido: boolean, conVibracion: boolean) {
  if (sonando) return;
  sonando = true;
  if (conVibracion && Platform.OS !== 'web') Vibration.vibrate([0, 700, 400, 700, 400], true);
  if (!conSonido) return;
  try {
    await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'duckOthers' });
    tono ??= createAudioPlayer(require('../../assets/sonidos/oferta.wav'));
    tono.loop = true;
    await tono.seekTo(0);
    tono.play();
  } catch {
    /* sin audio: queda la vibración */
  }
}

export function callarOferta() {
  sonando = false;
  if (Platform.OS !== 'web') Vibration.cancel();
  try { tono?.pause(); } catch { /* nada */ }
}

export function tocar() {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
}

export function exito() {
  if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function fallo() {
  if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}
