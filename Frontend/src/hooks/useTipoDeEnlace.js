import { useState, useEffect } from 'react';
import api from '../services/api';
import { registrarOrigen } from '../utils/origenVisita';

/**
 * Qué tipo de pedido impone el enlace por el que entró el cliente.
 *
 * Lo consultan dos sitios distintos —el carrito, para esconder las opciones que
 * no aplican, y el menú, para decidir si pinta el banner de música—, así que la
 * respuesta se memoriza: sin esto serían dos llamadas idénticas por cada carga
 * del menú, multiplicadas por cada comensal.
 */
const memoria = new Map(); // "businessId|source" -> Promise<forzarTipo>

function resolver(businessId, source) {
  const clave = `${businessId}|${source}`;
  if (memoria.has(clave)) return memoria.get(clave);

  const promesa = api
    .get(`/tracked-links/resolver?businessId=${businessId}&source=${encodeURIComponent(source)}`)
    .then(({ data }) => data?.forzarTipo || null)
    .catch(() => {
      // Que falle la consulta no puede dejar al cliente sin poder pedir: se
      // olvida para reintentar luego y, mientras tanto, se muestran todas las
      // opciones del negocio, que es el comportamiento de siempre.
      memoria.delete(clave);
      return null;
    });

  memoria.set(clave, promesa);
  return promesa;
}

export default function useTipoDeEnlace(businessId) {
  const [tipo, setTipo] = useState(null);

  useEffect(() => {
    /* `registrarOrigen` y no `origenActual`: lee el `?source=` de la URL y de
       paso lo guarda. Antes esto solo miraba sessionStorage, y en la PRIMERA
       visita todavía estaba vacío —el menú lo llenaba en un efecto declarado
       más abajo, o sea después de este—, así que el hook se rendía y el banner
       no salía hasta recargar la página. Leyendo la URL, ya no depende de que
       otro efecto le prepare el terreno. */
    const origen = registrarOrigen();
    if (!origen || !businessId) { setTipo(null); return; }

    let vivo = true;
    resolver(businessId, origen).then((t) => { if (vivo) setTipo(t); });
    return () => { vivo = false; };
  }, [businessId]);

  return tipo;
}
