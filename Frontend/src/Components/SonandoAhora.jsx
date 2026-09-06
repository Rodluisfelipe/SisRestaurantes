import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

/**
 * Banner minimalista de qué está sonando en el local.
 *
 * Solo aparece si de verdad hay música sonando: sin canción no se pinta nada,
 * ni un espacio vacío ni un "cargando". El comensal entró a pedir comida, no a
 * mirar un cargador.
 *
 * Se consulta cada 15s. El backend cachea 10s por local, así que aunque haya
 * cuarenta mesas con el menú abierto, Spotify recibe ~6 llamadas por minuto.
 */
const CADA_MS = 15000;

export default function SonandoAhora({ businessId, theme }) {
  const [cancion, setCancion] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    if (!businessId) return;
    let vivo = true;

    const consultar = async () => {
      // Con la pestaña en segundo plano no tiene sentido preguntar: el
      // comensal no lo está viendo y solo gastaría batería y datos.
      if (document.hidden) return;
      try {
        const { data } = await api.get(`/spotify/sonando?businessId=${businessId}`);
        if (vivo) setCancion(data?.sonando ? data : null);
      } catch {
        if (vivo) setCancion(null);
      }
    };

    consultar();
    timer.current = setInterval(consultar, CADA_MS);

    // Al volver a la pestaña, refrescar de una para no mostrar la canción vieja.
    const alVolver = () => { if (!document.hidden) consultar(); };
    document.addEventListener('visibilitychange', alVolver);

    return () => {
      vivo = false;
      clearInterval(timer.current);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [businessId]);

  if (!cancion?.sonando) return null;

  const acento = theme?.buttonColor || '#1DB954';
  const progreso = cancion.duracionMs
    ? Math.min(100, Math.round((cancion.progresoMs / cancion.duracionMs) * 100))
    : 0;

  return (
    <div className="px-3 pt-2">
      <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-slate-900/95 backdrop-blur-sm overflow-hidden">
        {cancion.imagen && (
          <img
            src={cancion.imagen}
            alt=""
            loading="lazy"
            className="w-9 h-9 rounded-md object-cover flex-shrink-0"
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {/* Tres barritas animadas: dicen "esto está sonando ahora" sin
                necesidad de escribirlo. */}
            <span className="flex items-end gap-[2px] h-2.5 flex-shrink-0" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-[2px] rounded-full animate-pulse"
                  style={{
                    backgroundColor: acento,
                    height: `${[70, 100, 45][i]}%`,
                    animationDelay: `${i * 180}ms`,
                    animationDuration: '900ms',
                  }}
                />
              ))}
            </span>
            <p className="text-[12px] font-bold text-white truncate leading-tight">{cancion.titulo}</p>
          </div>
          <p className="text-[10.5px] text-white/50 truncate leading-tight mt-0.5">{cancion.artista}</p>
        </div>
      </div>

      {progreso > 0 && (
        <div className="h-[2px] bg-slate-900/95 rounded-b-xl overflow-hidden -mt-px mx-0.5">
          <div
            className="h-full transition-all duration-1000 ease-linear"
            style={{ width: `${progreso}%`, backgroundColor: acento }}
          />
        </div>
      )}
    </div>
  );
}
