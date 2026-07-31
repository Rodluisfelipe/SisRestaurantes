import React, { useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

/**
 * MenuScreen — contenedor de "pantalla completa" del menú V2.
 *
 * Las secciones (cuenta, pedidos, favoritos…) dejan de ser modales flotantes y
 * pasan a comportarse como pantallas de app: entran desde la derecha, ocupan
 * todo el alto, tienen barra superior con volver y respetan las safe areas.
 *
 * Solo aporta el marco: el contenido lo pone cada sección.
 */
export default function MenuScreen({
  open,
  onClose,
  title,
  subtitle,
  /** Nodo opcional a la derecha de la barra (acciones) */
  action = null,
  /** Contenido fijo bajo la barra (tabs, buscador…) que no hace scroll */
  sticky = null,
  /** Pie fijo (CTA principal) */
  footer = null,
  children,
}) {
  const reduceMotion = useReducedMotion();

  // Bloquear el scroll del fondo mientras la pantalla está abierta
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Volver con Escape (y con el gesto/botón atrás del navegador)
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
        {/* Fondo — solo en escritorio, donde el panel no cubre la pantalla */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="hidden md:block fixed inset-0 z-[109] bg-black/45 backdrop-blur-sm"
        />
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { x: '100%' }}
          animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { x: '100%' }}
          transition={reduceMotion ? { duration: 0.15 } : { type: 'spring', damping: 30, stiffness: 320 }}
          /* En móvil ocupa todo; en escritorio es un panel centrado, porque una
             pantalla completa en un monitor de 27" se ve enorme y vacía.
             Se centra con left/calc y no con -translate-x-1/2: framer-motion
             anima transform y pisaría esa clase. */
          className="fixed inset-0 z-[110] flex flex-col md:inset-y-6 md:left-[calc(50%-280px)] md:w-[560px] md:rounded-3xl md:overflow-hidden md:shadow-2xl"
          style={{ background: 'var(--mb-surface)' }}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          {/* Barra superior */}
          <div
            className="flex items-center gap-3 px-3 py-2.5 shrink-0 border-b"
            style={{
              borderColor: 'var(--mb-line)',
              background: 'var(--mb-card)',
              paddingTop: 'calc(10px + env(safe-area-inset-top, 0px))',
            }}
          >
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-transform shrink-0"
              style={{ background: 'var(--mb-surface-2)', color: 'var(--mb-ink)' }}
              aria-label="Volver"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="text-[17px] font-extrabold tracking-tight truncate" style={{ color: 'var(--mb-ink)' }}>{title}</h2>
              {subtitle && <p className="text-[12px] truncate" style={{ color: 'var(--mb-ink-2)' }}>{subtitle}</p>}
            </div>
            {action}
          </div>

          {sticky && (
            <div className="shrink-0 border-b" style={{ borderColor: 'var(--mb-line)', background: 'var(--mb-card)' }}>
              {sticky}
            </div>
          )}

          {/* Contenido */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {children}
          </div>

          {footer && (
            <div
              className="shrink-0 border-t px-4 pt-3"
              style={{
                borderColor: 'var(--mb-line)',
                background: 'var(--mb-card)',
                paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
              }}
            >
              {footer}
            </div>
          )}
        </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
