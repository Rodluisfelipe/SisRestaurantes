import { io } from 'socket.io-client';
import { BACKEND_URL } from '../config';

let socket = null;

export function getSocket(token) {
  if (!socket || !socket.connected) {
    socket = io(BACKEND_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      auth: { token },
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function joinDomiRoom(token, deliveryPersonId, slug, mode) {
  const s = getSocket(token);
  s.on('connect', () => {
    if (mode === 'profile' && deliveryPersonId) {
      s.emit('domi:join', { token, deliveryPersonId });
    } else {
      s.emit('domi:joinFixed', { token, slug });
    }
  });
  // re-join on reconnect
  s.on('reconnect', () => {
    if (mode === 'profile' && deliveryPersonId) {
      s.emit('domi:join', { token, deliveryPersonId });
    } else {
      s.emit('domi:joinFixed', { token, slug });
    }
  });
  return s;
}

export function emitLocation(orderId, lat, lng) {
  if (socket?.connected) {
    socket.emit('domi:location', { orderId, lat, lng });
  }
}
