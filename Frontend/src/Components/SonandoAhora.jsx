import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

/**
 * Qué suena en el local — una línea bajo el nombre del negocio.
 *
 * Deliberadamente diminuto: es un detalle simpático, no información que el
 * comensal necesite para pedir. Por eso no tiene tarjeta, ni borde, ni fondo;
 * vive en el mismo aire que la dirección y la descripción del negocio.
 *
 * Hereda el color del negocio de las CSS variables que el menú cuelga de su
 * contenedor, así que no recibe ningún prop de tema.
 *
 * Si no hay música sonando no se pinta nada — ni un hueco ni un "cargando".
 *
 * Se consulta cada 15s y el backend cachea 10s por local, así que aunque haya
 * cuarenta mesas con el menú abierto Spotify recibe ~6 llamadas por minuto.
 */
const CADA_MS = 15000;

export default function SonandoAhora({ businessId }) {
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

    const alVolver = () => { if (!document.hidden) consultar(); };
    document.addEventListener('visibilitychange', alVolver);

    return () => {
      vivo = false;
      clearInterval(timer.current);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [businessId]);

  if (!cancion?.sonando) return null;

  return (
    <div className="flex items-center gap-2 mt-1.5 min-w-0">
      {cancion.imagen && (
        <img
          src={cancion.imagen}
          alt=""
          loading="lazy"
          className="w-6 h-6 rounded object-cover flex-shrink-0"
        />
      )}

      {/* Tres barritas + la etiqueta. Las barras solas se leen como adorno;
          con el texto al lado queda claro que es lo que suena AHORA. */}
      <span className="flex items-center gap-1.5 flex-shrink-0">
        <span className="flex items-end gap-[2px] h-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-[2px] rounded-full animate-pulse"
              style={{
                background: 'var(--mb-accent)',
                height: `${[70, 100, 45][i]}%`,
                animationDelay: `${i * 180}ms`,
                animationDuration: '900ms',
              }}
            />
          ))}
        </span>
        <span
          className="text-[10px] font-bold uppercase tracking-wide whitespace-nowrap"
          style={{ color: 'var(--mb-accent)' }}
        >
          Sonando ahora
        </span>
      </span>

      {/* La canción cede el espacio: si no cabe se recorta ella, nunca la
          etiqueta ni el nombre del negocio de arriba. */}
      <p className="text-[12px] leading-tight truncate min-w-0" style={{ color: 'var(--mb-ink-2)' }}>
        <span className="font-semibold" style={{ color: 'var(--mb-ink)' }}>{cancion.titulo}</span>
        {cancion.artista && (
          <span style={{ color: 'var(--mb-ink-3)' }}> · {cancion.artista}</span>
        )}
      </p>
    </div>
  );
}
