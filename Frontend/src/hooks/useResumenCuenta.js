import { useEffect, useState } from 'react';
import api from '../services/api';
import { tieneCuenta, negocioDeLaCuenta } from '../utils/cuentaCliente';

/**
 * El resumen de "Mi cuenta" (nombre, puntos, favoritos) para mostrarlo sin
 * entrar: en la pestaña "Más" y en la cabecera de su panel.
 *
 * Se pide una vez por negocio y se comparte; vuelve a pedirse cuando llega o
 * se va la llave (evento `mb:cuenta`). Sin cuenta, es null y nadie espera.
 */

let cache = { negocio: null, datos: null, promesa: null };
const oyentes = new Set();

function publicar(datos) {
  cache.datos = datos;
  oyentes.forEach((f) => f(datos));
}

async function pedir(negocio, forzar = false) {
  if (!negocio || !tieneCuenta(negocio)) { cache = { negocio, datos: null, promesa: null }; publicar(null); return; }
  if (!forzar && cache.negocio === negocio && (cache.datos || cache.promesa)) return;
  cache.negocio = negocio;
  cache.promesa = api.get('/cuenta')
    .then(({ data }) => publicar(data))
    .catch(() => publicar(null))
    .finally(() => { cache.promesa = null; });
}

if (typeof window !== 'undefined') {
  window.addEventListener('mb:cuenta', (e) => pedir(e.detail?.businessId, true));
}

export default function useResumenCuenta() {
  const negocio = negocioDeLaCuenta();
  const [datos, setDatos] = useState(cache.negocio === negocio ? cache.datos : null);

  useEffect(() => {
    oyentes.add(setDatos);
    pedir(negocio);
    return () => { oyentes.delete(setDatos); };
  }, [negocio]);

  return {
    resumen: datos,
    recargar: () => pedir(negocio, true),
  };
}
