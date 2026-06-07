import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { API_URL } from '../../config';

const PRIORITY = {
  urgent: {
    bar: 'bg-red-50 border-red-200 hover:bg-red-100/60',
    accent: 'bg-red-500',
    text: 'text-red-900',
    sub: 'text-red-700',
    divider: 'border-red-200',
    label: 'Urgente',
  },
  high: {
    bar: 'bg-orange-50 border-orange-200 hover:bg-orange-100/60',
    accent: 'bg-orange-500',
    text: 'text-orange-900',
    sub: 'text-orange-700',
    divider: 'border-orange-200',
    label: 'Importante',
  },
  medium: {
    bar: 'bg-blue-50 border-blue-200 hover:bg-blue-100/60',
    accent: 'bg-blue-500',
    text: 'text-blue-900',
    sub: 'text-blue-700',
    divider: 'border-blue-200',
    label: 'Información',
  },
  low: {
    bar: 'bg-slate-50 border-slate-200 hover:bg-slate-100/60',
    accent: 'bg-slate-500',
    text: 'text-slate-800',
    sub: 'text-slate-600',
    divider: 'border-slate-200',
    label: 'Nota',
  },
};

const BellIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

const ExpandIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
  </svg>
);

const getBaseUrl = () => API_URL.replace(/\/api$/, '');

function resolveImageUrl(image) {
  if (!image) return null;
  if (/^https?:\/\//i.test(image)) return image;
  return `${getBaseUrl()}${image}`;
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/* ─── Image Lightbox (portal, full screen) ─── */
function ImageLightbox({ src, alt, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Imagen ampliada"
    >
      <motion.img
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 280 }}
        src={src}
        alt={alt}
        className="max-w-[96vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white backdrop-blur-md flex items-center justify-center transition-colors"
        aria-label="Cerrar"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/70 text-xs font-medium tracking-wide pointer-events-none select-none">
        Toca fuera o pulsa Esc para cerrar
      </p>
    </motion.div>,
    document.body
  );
}

/* ─── Main Component ─── */
export default function AnnouncementInlineBar() {
  const [announcements, setAnnouncements] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    let cancelled = false;
    fetch(`${API_URL}/announcements/pending/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setAnnouncements(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const dismiss = useCallback(async () => {
    if (dismissing || announcements.length === 0) return;
    setDismissing(true);
    const current = announcements[0];
    const token = localStorage.getItem('accessToken');
    try {
      await fetch(`${API_URL}/announcements/${current._id}/seen`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
    setAnnouncements((prev) => prev.slice(1));
    setExpanded(false);
    setLightboxOpen(false);
    setDismissing(false);
  }, [announcements, dismissing]);

  if (announcements.length === 0) return null;

  const current = announcements[0];
  const cfg = PRIORITY[current.priority] || PRIORITY.medium;
  const imgSrc = resolveImageUrl(current.image);
  const remaining = announcements.length - 1;

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={current._id}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <div className={`rounded-2xl border ${cfg.bar} overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-colors`}>
            {/* Header (always visible) */}
            <div className="flex items-stretch">
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="flex-1 flex items-center gap-3 px-4 py-3 text-left min-w-0 active:opacity-80 transition-opacity"
                aria-expanded={expanded}
                aria-label={`${cfg.label}: ${current.title}. ${expanded ? 'Colapsar' : 'Expandir'}`}
              >
                {/* Priority icon */}
                <span className="relative flex-shrink-0">
                  <span className={`block w-9 h-9 rounded-xl ${cfg.accent} flex items-center justify-center shadow-sm`}>
                    <BellIcon className="w-[18px] h-[18px] text-white" />
                  </span>
                  {/* Subtle pulsing dot for unseen (only when collapsed) */}
                  {!expanded && (
                    <motion.span
                      animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0.2, 0.6] }}
                      transition={{ duration: 1.8, repeat: Infinity }}
                      className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${cfg.accent} ring-2 ring-white`}
                    />
                  )}
                </span>

                {/* Label + title */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.sub}`}>
                      {cfg.label}
                    </span>
                    {remaining > 0 && (
                      <span className={`text-[10px] font-bold ${cfg.sub} bg-white/80 px-1.5 py-0.5 rounded-full`}>
                        +{remaining} más
                      </span>
                    )}
                    {imgSrc && (
                      <span className={`text-[10px] font-semibold ${cfg.sub} opacity-70 hidden sm:inline-flex items-center gap-1`}>
                        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                        con imagen
                      </span>
                    )}
                  </div>
                  <p className={`text-sm font-bold ${cfg.text} ${expanded ? '' : 'truncate'}`}>
                    {current.title}
                  </p>
                </div>

                {/* Chevron */}
                <motion.svg
                  animate={{ rotate: expanded ? 180 : 0 }}
                  transition={{ duration: 0.22 }}
                  className={`w-5 h-5 ${cfg.sub} opacity-60 flex-shrink-0`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </motion.svg>
              </button>

              {/* Dismiss (X) */}
              <button
                type="button"
                onClick={dismiss}
                disabled={dismissing}
                className={`flex-shrink-0 w-11 sm:w-12 flex items-center justify-center ${cfg.sub} opacity-60 hover:opacity-100 hover:bg-white/60 transition disabled:opacity-30 border-l ${cfg.divider}`}
                aria-label="Quitar este aviso"
                title="Marcar como visto"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Expanded body */}
            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                  className="overflow-hidden"
                >
                  <div className={`px-4 pb-4 pt-3 border-t ${cfg.divider} bg-white/40`}>
                    {/* Image with explicit expand button */}
                    {imgSrc && (
                      <button
                        type="button"
                        onClick={() => setLightboxOpen(true)}
                        className="group relative block w-full mb-4 rounded-xl overflow-hidden bg-white/70 ring-1 ring-black/5 hover:ring-black/10 transition-all active:scale-[0.99]"
                        aria-label="Ver imagen ampliada"
                      >
                        <img
                          src={imgSrc}
                          alt={current.title}
                          className="w-full max-h-72 sm:max-h-80 object-contain"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                        {/* Persistent expand badge (top-right) */}
                        <span className="absolute top-2 right-2 inline-flex items-center gap-1.5 bg-black/55 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shadow-md">
                          <ExpandIcon className="w-3.5 h-3.5" />
                          Ampliar
                        </span>
                        {/* Hover overlay hint */}
                        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white text-slate-900 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                            <ExpandIcon className="w-3.5 h-3.5" />
                            Toca para ampliar
                          </span>
                        </span>
                      </button>
                    )}

                    {/* Body */}
                    <p className={`text-[14px] sm:text-[15px] ${cfg.text} whitespace-pre-line leading-relaxed`}>
                      {current.body}
                    </p>

                    {/* Footer: date + close hint */}
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className={`text-[11px] ${cfg.sub} opacity-70 flex items-center gap-1.5`}>
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <circle cx="12" cy="12" r="10"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2"/>
                        </svg>
                        {formatDate(current.createdAt)}
                      </p>
                      <button
                        type="button"
                        onClick={dismiss}
                        disabled={dismissing}
                        className={`text-[12px] font-bold ${cfg.text} px-3 py-1.5 rounded-lg bg-white hover:bg-white/80 ring-1 ${cfg.divider} transition active:scale-95 disabled:opacity-50`}
                      >
                        Entendido ✓
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Lightbox portal */}
      <AnimatePresence>
        {lightboxOpen && imgSrc && (
          <ImageLightbox
            src={imgSrc}
            alt={current.title}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
