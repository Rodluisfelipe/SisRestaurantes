import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

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
export default function useWhatsAppUnread(businessId, { intervaloMs = 30000 } = {}) {
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
    const t = setInterval(consultar, intervaloMs);
    return () => { vivo = false; clearInterval(t); };
  }, [businessId, intervaloMs]);

  return sinLeer;
}
