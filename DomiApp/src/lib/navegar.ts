/**
 * Salir de la app a lo que el domi ya sabe usar: Google Maps o Waze para
 * llegar, el teléfono para llamar, WhatsApp para escribir.
 */
import { Linking, Platform } from 'react-native';
import type { Punto } from './tipos';

export async function navegarA(destino: Punto | null, direccion: string, app: 'google' | 'waze') {
  const q = destino ? `${destino.lat},${destino.lng}` : encodeURIComponent(direccion);
  const intentos: string[] = [];
  if (app === 'waze') {
    intentos.push(destino ? `waze://?ll=${q}&navigate=yes` : `waze://?q=${q}&navigate=yes`);
    intentos.push(destino ? `https://waze.com/ul?ll=${q}&navigate=yes` : `https://waze.com/ul?q=${q}&navigate=yes`);
  }
  if (Platform.OS === 'android') intentos.push(`google.navigation:q=${q}&mode=l`); // l = moto
  intentos.push(`https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=two-wheeler`);
  for (const url of intentos) {
    try {
      if (url.startsWith('http') || (await Linking.canOpenURL(url))) {
        await Linking.openURL(url);
        return;
      }
    } catch { /* probar el siguiente */ }
  }
}

/** 3001234567 → 573001234567 (WhatsApp necesita el país). */
function internacional(tel: string) {
  const d = tel.replace(/\D/g, '');
  if (d.length === 10 && d.startsWith('3')) return `57${d}`;
  return d;
}

export function llamarA(tel: string | null) {
  if (tel) Linking.openURL(`tel:${tel.replace(/[^\d+]/g, '')}`).catch(() => {});
}

export function whatsappA(tel: string | null, texto: string) {
  if (!tel) return;
  Linking.openURL(`https://wa.me/${internacional(tel)}?text=${encodeURIComponent(texto)}`).catch(() => {});
}
