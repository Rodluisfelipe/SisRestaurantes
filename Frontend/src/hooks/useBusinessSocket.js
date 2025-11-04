import { useEffect, useState } from 'react';
import { socket, joinBusiness } from '../services/socket';

/**
 * Hook para conectarse al socket de un negocio específico
 * @param {string} businessId - ID del negocio
 * @returns {object|null} - Instancia del socket conectada
 */
export const useBusinessSocket = (businessId) => {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!businessId || !socket) {
      return;
    }

    // Conectar si no está conectado
    if (!socket.connected) {
      socket.connect();
    }

    // Unirse al negocio cuando el socket esté conectado
    const handleConnect = () => {
      setConnected(true);
      joinBusiness(businessId);
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    // Si ya está conectado, unirse inmediatamente
    if (socket.connected) {
      handleConnect();
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [businessId]);

  return socket;
};

