import { useEffect, useState } from 'react';
import { urlComprobante } from '../utils/comprobantes';

/** La imagen de un comprobante protegido, pedida con la sesión en la cabecera. */
export default function ComprobanteImagen({ ruta, alt = 'Comprobante de pago', className = '' }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    setUrl(null);
    setError('');
    urlComprobante(ruta)
      .then((u) => { if (vivo) setUrl(u); })
      .catch((e) => { if (vivo) setError(e.message); });
    return () => { vivo = false; };
  }, [ruta]);

  if (error) {
    return <div className={`${className} flex items-center justify-center bg-slate-100 text-2xs text-slate-500 text-center p-2`}>{error}</div>;
  }
  if (!url) return <div className={`${className} bg-slate-100 animate-pulse`} />;
  return <img src={url} alt={alt} className={className} />;
}
