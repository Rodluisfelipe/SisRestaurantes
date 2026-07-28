import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

const todayStr = () => new Date().toISOString().slice(0, 10);
const keyFor = (id) => `mb_popup_${id}`;

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const ss = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch {} },
};

const shouldShow = (p) => {
  const key = keyFor(p._id);
  switch (p.frequency) {
    case 'always': return true;
    case 'once': return !ls.get(key);
    case 'daily': return ls.get(key) !== todayStr();
    case 'session': return !ss.get(key);
    default: return true;
  }
};

const markSeen = (p) => {
  const key = keyFor(p._id);
  if (p.frequency === 'once') ls.set(key, '1');
  else if (p.frequency === 'daily') ls.set(key, todayStr());
  else if (p.frequency === 'session') ss.set(key, '1');
};

/**
 * MenuPopup — muestra al cliente un anuncio (popup) que el negocio configuró
 * en su menú, respetando la frecuencia elegida y registrando vistas/clics.
 */
export default function MenuPopup({ businessId, themeColor = '#E8002D' }) {
  const [popup, setPopup] = useState(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!businessId) return undefined;
    let cancelled = false;

    api.get(`/menu-popups/active?businessId=${businessId}`)
      .then(res => {
        if (cancelled) return;
        const list = Array.isArray(res.data) ? res.data : [];
        const eligible = list.find(shouldShow);
        if (!eligible) return;
        const delay = Math.max(0, (eligible.delaySeconds ?? 1)) * 1000;
        timerRef.current = setTimeout(() => {
          if (cancelled) return;
          setPopup(eligible);
          setVisible(true);
          markSeen(eligible);
          api.post(`/menu-popups/${eligible._id}/view`).catch(() => {});
        }, delay);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [businessId]);

  const close = () => setVisible(false);

  const handleCta = () => {
    if (!popup) return;
    api.post(`/menu-popups/${popup._id}/click`).catch(() => {});
    const url = (popup.ctaUrl || '').trim();
    if (url) {
      if (/^https?:\/\//i.test(url)) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else if (url.startsWith('#')) {
        try { document.querySelector(url)?.scrollIntoView({ behavior: 'smooth' }); } catch {}
      } else {
        window.location.href = url;
      }
    }
    close();
  };

  if (!popup) return null;

  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={close}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Cerrar */}
            <button
              onClick={close}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
              aria-label="Cerrar"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>

            {popup.image && (
              <img src={popup.image} alt={popup.title} className="w-full max-h-56 object-cover bg-slate-100" />
            )}

            <div className="p-5 text-center">
              <h3 className="text-xl font-black text-slate-900 leading-tight">{popup.title}</h3>
              {popup.body && <p className="text-[15px] text-slate-500 mt-2 leading-relaxed whitespace-pre-line">{popup.body}</p>}

              {popup.ctaText ? (
                <button
                  onClick={handleCta}
                  className="mt-5 w-full py-3.5 rounded-2xl text-white font-black text-[15px] shadow-lg active:scale-[0.98] transition-transform"
                  style={{ backgroundColor: themeColor, boxShadow: `0 12px 28px -12px ${themeColor}` }}
                >
                  {popup.ctaText}
                </button>
              ) : (
                <button
                  onClick={close}
                  className="mt-5 w-full py-3.5 rounded-2xl text-white font-black text-[15px] shadow-lg active:scale-[0.98] transition-transform"
                  style={{ backgroundColor: themeColor, boxShadow: `0 12px 28px -12px ${themeColor}` }}
                >
                  ¡Entendido!
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
