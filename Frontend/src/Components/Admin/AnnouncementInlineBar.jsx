import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../../config';

const PRIORITY = {
  urgent: {
    bar: 'bg-red-50 border-red-200',
    accent: 'bg-red-500',
    text: 'text-red-900',
    sub: 'text-red-700',
    divider: 'border-red-200',
    label: 'Urgente',
  },
  high: {
    bar: 'bg-orange-50 border-orange-200',
    accent: 'bg-orange-500',
    text: 'text-orange-900',
    sub: 'text-orange-700',
    divider: 'border-orange-200',
    label: 'Importante',
  },
  medium: {
    bar: 'bg-blue-50 border-blue-200',
    accent: 'bg-blue-500',
    text: 'text-blue-900',
    sub: 'text-blue-700',
    divider: 'border-blue-200',
    label: 'Información',
  },
  low: {
    bar: 'bg-slate-50 border-slate-200',
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

const getBaseUrl = () => API_URL.replace(/\/api$/, '');

function resolveImageUrl(image) {
  if (!image) return null;
  if (/^https?:\/\//i.test(image)) return image;
  return `${getBaseUrl()}${image}`;
}

export default function AnnouncementInlineBar() {
  const [announcements, setAnnouncements] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [dismissing, setDismissing] = useState(false);

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
    setDismissing(false);
  }, [announcements, dismissing]);

  if (announcements.length === 0) return null;

  const current = announcements[0];
  const cfg = PRIORITY[current.priority] || PRIORITY.medium;
  const imgSrc = resolveImageUrl(current.image);
  const remaining = announcements.length - 1;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={current._id}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <div className={`rounded-2xl border ${cfg.bar} overflow-hidden`}>
          <div className="flex items-stretch">
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="flex-1 flex items-center gap-3 px-4 py-3 text-left min-w-0 active:opacity-80 transition-opacity"
              aria-expanded={expanded}
            >
              <span className={`flex-shrink-0 w-9 h-9 rounded-xl ${cfg.accent} flex items-center justify-center shadow-sm`}>
                <BellIcon className="w-[18px] h-[18px] text-white" />
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.sub}`}>
                    {cfg.label}
                  </span>
                  {remaining > 0 && (
                    <span className={`text-[10px] font-semibold ${cfg.sub} bg-white/70 px-1.5 py-0.5 rounded`}>
                      +{remaining} más
                    </span>
                  )}
                </div>
                <p className={`text-sm font-bold ${cfg.text} ${expanded ? '' : 'truncate'}`}>
                  {current.title}
                </p>
              </div>

              <motion.svg
                animate={{ rotate: expanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className={`w-5 h-5 ${cfg.sub} opacity-60 flex-shrink-0`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </motion.svg>
            </button>

            <button
              type="button"
              onClick={dismiss}
              disabled={dismissing}
              className={`flex-shrink-0 w-11 flex items-center justify-center ${cfg.sub} opacity-60 hover:opacity-100 hover:bg-white/50 transition disabled:opacity-30 border-l ${cfg.divider}`}
              aria-label="Quitar este aviso"
              title="Marcar como visto"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
                className="overflow-hidden"
              >
                <div className={`px-4 pb-4 pt-2 border-t ${cfg.divider}`}>
                  {imgSrc && (
                    <img
                      src={imgSrc}
                      alt={current.title}
                      className="w-full max-h-56 object-contain rounded-lg bg-white/50 mb-3"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                  <p className={`text-sm ${cfg.text} whitespace-pre-line leading-relaxed`}>
                    {current.body}
                  </p>
                  <p className={`text-xs ${cfg.sub} opacity-70 mt-3`}>
                    {new Date(current.createdAt).toLocaleDateString('es-CO', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
