import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

/**
 * Qué está sonando en el local, integrado en el menú.
 *
 * Usa las CSS variables que el menú ya cuelga de su contenedor (--mb-accent,
 * --mb-card, --mb-ink…), así que hereda el color del negocio sin recibir un
 * solo prop de tema: si el restaurante cambia su color, esto cambia con él.
 *
 * Solo aparece si de verdad hay música sonando. Sin canción no se pinta nada
 * —ni un hueco ni un "cargando"—: el comensal entró a pedir comida.
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

  const progreso = cancion.duracionMs
    ? Math.min(100, Math.round((cancion.progresoMs / cancion.duracionMs) * 100))
    : 0;

  return (
    <div className="px-3 pt-3">
      <div
        className="relative flex items-center gap-3 p-2.5 overflow-hidden"
        style={{
          /* Tinte del color del negocio, no una capa encima: `--mb-accent-softer`
             es un color sólido (no translúcido), así que superponerlo tapaba la
             tarjeta y solo se salvaba por el orden de pintado. Como fondo hace
             lo mismo visualmente y sin esa fragilidad. */
          background: 'var(--mb-accent-softer)',
          border: '1px solid var(--mb-line)',
          borderRadius: 'var(--mb-radius-card)',
          boxShadow: 'var(--mb-shadow-card)',
        }}
      >

        {cancion.imagen && (
          <img
            src={cancion.imagen}
            alt=""
            loading="lazy"
            className="w-11 h-11 object-cover flex-shrink-0"
            style={{ borderRadius: 'calc(var(--mb-radius-card) - 6px)' }}
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {/* Tres barritas: dicen "esto suena ahora" sin escribirlo. */}
            <span className="flex items-end gap-[2px] h-2.5 flex-shrink-0" aria-hidden="true">
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
              className="text-[9.5px] font-bold uppercase tracking-wider"
              style={{ color: 'var(--mb-accent)' }}
            >
              Sonando
            </span>
          </div>

          <p
            className="text-[13px] font-bold truncate leading-tight mt-1"
            style={{ color: 'var(--mb-ink)' }}
          >
            {cancion.titulo}
          </p>
          <p
            className="text-[11px] truncate leading-tight"
            style={{ color: 'var(--mb-ink-3)' }}
          >
            {cancion.artista}
          </p>
        </div>

        {progreso > 0 && (
          <div
            className="absolute bottom-0 left-0 right-0 h-[2px]"
            style={{ background: 'var(--mb-line)' }}
            aria-hidden="true"
          >
            <div
              className="h-full transition-all duration-1000 ease-linear"
              style={{ width: `${progreso}%`, background: 'var(--mb-accent)' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
