/**
 * Conexión en vivo con el servidor: una oferta nueva llega en menos de un
 * segundo con la app abierta. Con la app cerrada llega por Firebase
 * (notificaciones.ts); las dos terminan pidiendo el estado de nuevo.
 */
import { io, type Socket } from 'socket.io-client';
import { SERVIDOR } from './config';
import { sesionActual } from './api';

let socket: Socket | null = null;

export async function conectarEnVivo(alCambiar: (motivo: string) => void) {
  desconectarEnVivo();
  const s = await sesionActual();
  if (!s) return;
  socket = io(SERVIDOR, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 15000,
  });
  const unirse = async () => {
    const actual = await sesionActual();
    if (actual) socket?.emit('domi2:join', { token: actual.token });
  };
  socket.on('connect', unirse);
  socket.on('domi2:error', () => setTimeout(unirse, 5000)); // el token se renueva con el siguiente refresco
  for (const ev of ['delivery:offer', 'delivery:assigned', 'domi:liquidado', 'orderUpdated']) {
    socket.on(ev, () => alCambiar(ev));
  }
}

export function desconectarEnVivo() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}
