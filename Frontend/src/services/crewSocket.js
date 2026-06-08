/**
 * Socket dedicado para el marketplace Crew.
 *
 * Por qué uno aparte: el socket global (services/socket.js) usa accessToken
 * o superadmin_token y tiene lógica de "joinBusiness" que no aplica acá.
 * Acá solo nos interesa el chat 1:1 worker↔business, autenticado con el token
 * que tenga el usuario (crew_token si es worker, accessToken si es admin).
 */
import { io } from 'socket.io-client';
import { BACKEND_URL } from '../config';

function pickToken() {
  return (
    localStorage.getItem('crew_token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('superadmin_token') ||
    null
  );
}

let socket = null;

export function getCrewSocket() {
  if (socket) return socket;
  const url = import.meta.env.VITE_SOCKET_URL || BACKEND_URL;
  socket = io(url, {
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    transports: ['polling', 'websocket'],
    path: '/socket.io',
    query: { clientType: 'crew' },
    auth: { token: pickToken() },
  });

  // Refresca el token en cada reintento (por si el usuario cambia de cuenta).
  socket.io.on('reconnect_attempt', () => {
    socket.auth = { token: pickToken() };
  });

  return socket;
}

/**
 * Suscribe al cliente a una conversación y devuelve un disposer.
 * Usa autenticación inline para sostener el caso del worker, ya que su token
 * vive en crew_token y no necesariamente estaba en el handshake.
 */
export function subscribeCrewConversation(conversationId, onMessage) {
  const s = getCrewSocket();
  const token = pickToken();

  const join = () => s.emit('crew:joinConversation', { conversationId, token });

  if (s.connected) join();
  else {
    s.connect();
    s.once('connect', join);
  }

  const messageHandler = (payload) => {
    if (!payload || String(payload.conversationId) !== String(conversationId)) return;
    onMessage(payload.message);
  };
  s.on('crew-message', messageHandler);

  // Re-unirse al room tras un reconnect (rooms no persisten en el servidor).
  const reconnectHandler = () => join();
  s.on('connect', reconnectHandler);

  return () => {
    s.off('crew-message', messageHandler);
    s.off('connect', reconnectHandler);
    s.emit('crew:leaveConversation', { conversationId });
  };
}
