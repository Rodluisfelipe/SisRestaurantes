import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

const SLIDE_MS = 5000;

/**
 * StoryViewer — visor fullscreen de historias del menú.
 * Barras de progreso, tap para avanzar/retroceder, arrastrar hacia abajo cierra.
 * El CTA vive fijo abajo y depende del tipo de slide.
 */
export default function StoryViewer({ story, onClose, onCta, onSlideSeen }) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const rafRef = useRef(null);
  const startRef = useRef(0);
  const elapsedRef = useRef(0);
  const reduceMotion = useReducedMotion();

  const slides = story?.slides || [];
  const slide = slides[index];

  const next = useCallback(() => {
    setIndex((i) => {
      if (i + 1 >= slides.length) { onClose(); return i; }
      return i + 1;
    });
  }, [slides.length, onClose]);

  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  /* Reloj de la barra de progreso. Se reinicia por slide y se puede pausar
     manteniendo el dedo sobre la historia. */
  useEffect(() => {
    setProgress(0);
    elapsedRef.current = 0;
    startRef.current = performance.now();

    const tick = (now) => {
      if (!paused) {
        elapsedRef.current += now - startRef.current;
        const p = Math.min(1, elapsedRef.current / SLIDE_MS);
        setProgress(p);
        if (p >= 1) { next(); return; }
      }
      startRef.current = now;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [index, paused, next]);

  // Avisar que el slide se vio (tracking de popups)
  useEffect(() => {
    if (slide) onSlideSeen?.(slide);
  }, [slide, onSlideSeen]);

  // Cerrar con Escape y navegar con flechas
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, next, prev]);

  // Bloquear el scroll del fondo mientras el visor está abierto
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  if (!slide) return null;

  /* 30/70: la zona de "atrás" es menor porque el gesto natural es avanzar. */
  const handleTap = (e) => {
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
    if (x < e.currentTarget.offsetWidth * 0.3) prev();
    else next();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
        transition={reduceMotion ? { duration: 0.15 } : { type: 'spring', damping: 26, stiffness: 300 }}
        drag={reduceMotion ? false : 'y'}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.5 }}
        onDragEnd={(_, info) => { if (info.offset.y > 110) onClose(); }}
        className="fixed inset-0 z-[120] bg-black flex flex-col"
        style={{ touchAction: 'pan-y' }}
      >
        {/* Barras de progreso */}
        <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 px-3 pt-3" style={{ paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))' }}>
          {slides.map((_, i) => (
            <div key={i} className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.28)' }}>
              <div
                className="h-full rounded-full bg-white"
                style={{ width: i < index ? '100%' : i === index ? `${progress * 100}%` : '0%' }}
              />
            </div>
          ))}
        </div>

        {/* Encabezado */}
        <div className="absolute left-0 right-0 z-20 flex items-center gap-2.5 px-4" style={{ top: 'calc(26px + env(safe-area-inset-top, 0px))' }}>
          {story.cover && <img src={story.cover} alt="" aria-hidden="true" className="w-8 h-8 rounded-full object-cover ring-2 ring-white/30" />}
          <span className="text-white text-[13.5px] font-bold drop-shadow">{story.label}</span>
          <button onClick={onClose} className="ml-auto w-9 h-9 rounded-full flex items-center justify-center text-white/90 active:scale-90" aria-label="Cerrar">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Contenido — el tap navega, mantener pulsado pausa */}
        <div
          className="flex-1 relative select-none"
          onClick={handleTap}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerCancel={() => setPaused(false)}
        >
          {slide.image ? (
            <img src={slide.image} alt={slide.title || ''} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, var(--mb-accent), #111)' }} />
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.05) 32%, rgba(0,0,0,0.78) 100%)' }} />

          {/* Texto */}
          <div className="absolute inset-x-0 bottom-0 px-6 pb-6 text-center">
            {slide.kicker && (
              <span className="inline-block mb-2 px-2.5 py-1 rounded-full text-[11px] font-black" style={{ background: 'var(--mb-accent)', color: 'var(--mb-on-accent)' }}>
                {slide.kicker}
              </span>
            )}
            {/* Las reseñas se leen como cita, no como párrafo suelto */}
            {slide.type === 'review' ? (
              <>
                {slide.rating > 0 && (
                  <div className="flex items-center justify-center gap-0.5 mb-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg key={i} className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill={i < Math.round(slide.rating) ? '#FBBF24' : 'rgba(255,255,255,0.28)'}>
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    ))}
                  </div>
                )}
                {slide.body && (
                  <p className="text-white text-[19px] font-semibold leading-snug drop-shadow-lg line-clamp-6">
                    “{slide.body}”
                  </p>
                )}
                {slide.title && (
                  <p className="text-white/70 text-[13.5px] font-bold mt-3 drop-shadow">— {slide.title}</p>
                )}
              </>
            ) : (
              <>
                {slide.title && <h3 className="text-white text-[23px] font-black leading-tight drop-shadow-lg">{slide.title}</h3>}
                {slide.body && <p className="text-white/85 text-[14.5px] leading-snug mt-2 line-clamp-4 drop-shadow">{slide.body}</p>}
              </>
            )}
          </div>
        </div>

        {/* CTA fijo */}
        {slide.cta && (
          <div className="px-5 pb-6 pt-3 z-20" style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onCta(slide); }}
              className="w-full py-3.5 rounded-2xl text-[15px] font-black active:scale-[0.98] transition-transform"
              style={{ background: 'var(--mb-accent)', color: 'var(--mb-on-accent)' }}
            >
              {slide.cta}
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
