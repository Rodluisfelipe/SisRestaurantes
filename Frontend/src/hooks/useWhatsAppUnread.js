import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { socket, joinBusiness } from '../services/socket';

/**
 * Cuántos mensajes de WhatsApp esperan respuesta.
 *
 * Sin este aviso la bandeja no sirve de nada: el negocio no se entera de que
 * llegó un mensaje y sigue atendiendo desde el celular, que es justo lo que el
 * complemento promete quitarle de encima.
 *
 * Solo consulta si el negocio tiene la bandeja contratada. Si el backend
 * responde 402 —no la tiene— deja de preguntar para siempre en vez de golpear
 * la API cada medio minuto sin motivo.
 */
export default function useWhatsAppUnread(businessId, { intervaloMs = 60000 } = {}) {
  const [sinLeer, setSinLeer] = useState(0);
  const noAplica = useRef(false);

  useEffect(() => {
    if (!businessId) return undefined;
    noAplica.current = false;
    let vivo = true;

    const consultar = async () => {
      if (noAplica.current || !vivo) return;
      try {
        const { data } = await api.get(`/whatsapp-inbox/sin-leer?businessId=${businessId}`);
        if (vivo) setSinLeer(data?.sinLeer || 0);
      } catch (e) {
        // 402 = no tiene el complemento. Cualquier otro fallo es pasajero.
        if (e?.response?.status === 402) {
          noAplica.current = true;
          if (vivo) setSinLeer(0);
        }
      }
    };

    consultar();

    /* El aviso llega por socket, así que el número sube en el momento. La
       consulta periódica queda de red de seguridad —más espaciada— por si el
       socket se cae o un aviso se pierde. */
    if (!socket.connected) socket.connect();
    joinBusiness(businessId);
    socket.on('whatsapp:mensaje', consultar);

    const t = setInterval(consultar, intervaloMs);
    return () => {
      vivo = false;
      socket.off('whatsapp:mensaje', consultar);
      clearInterval(t);
    };
  }, [businessId, intervaloMs]);

  return sinLeer;
}
