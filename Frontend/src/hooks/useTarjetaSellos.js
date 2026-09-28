import { useEffect, useState } from 'react';
import api from '../services/api';
import useResumenCuenta from './useResumenCuenta';

/**
 * La tarjeta de sellos para mostrar en el menú.
 *
 * Con cuenta en este celular: sus sellos (vienen en el resumen de la cuenta).
 * Sin cuenta: la tarjeta del negocio en cero, para que sepa que existe y qué
 * se gana. Si el negocio no usa sellos, null.
 *
 * @returns {null | { sellos: number, requeridos: number, premio: string, premioProductId: string, premiosDisponibles: number, propia: boolean }}
 */
export default function useTarjetaSellos(businessId) {
  const { resumen } = useResumenCuenta();
  const [publica, setPublica] = useState(null);
  const conCuenta = !!resumen;
  const puntos = resumen?.puntos;

  useEffect(() => {
    if (conCuenta || !businessId) return undefined;
    let vivo = true;
    api.get('/loyalty/tarjeta', { params: { businessId } })
      .then(({ data }) => { if (vivo) setPublica(data?.active ? data.tarjeta : null); })
      .catch(() => { if (vivo) setPublica(null); });
    return () => { vivo = false; };
  }, [conCuenta, businessId]);

  if (conCuenta) {
    if (puntos?.modo !== 'sellos') return null;
    return { sellos: puntos.sellos, requeridos: puntos.requeridos, premio: puntos.premio, premioProductId: puntos.premioProductId || '', premiosDisponibles: puntos.premiosDisponibles, propia: true };
  }
  if (!publica) return null;
  return { sellos: 0, requeridos: publica.requeridos, premio: publica.premio?.nombre || '', premioProductId: publica.premio?.productId || '', premiosDisponibles: 0, propia: false };
}
