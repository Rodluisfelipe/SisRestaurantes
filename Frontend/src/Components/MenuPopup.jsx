import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

const todayStr = () => new Date().toISOString().slice(0, 10);
const keyFor = (id) => `mb_popup_${id}`;
const INPUT_TYPE = { name: 'text', email: 'email', phone: 'tel', birthday: 'date' };

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
 * MenuPopup — muestra al cliente un anuncio configurado por el negocio, en el
 * formato elegido (modal, barra arriba/abajo, toast en esquina o pantalla
 * completa), con formulario opcional de captura. Registra vistas, clics y envíos.
 */
export default function MenuPopup({ businessId, themeColor = '#E8002D' }) {
  const [popup, setPopup] = useState(null);
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false); // barra/toast → abre tarjeta completa
  const [values, setValues] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState('');
  const [formErr, setFormErr] = useState('');
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

  const close = () => { setVisible(false); setExpanded(false); };

  const trackClick = () => { if (popup) api.post(`/menu-popups/${popup._id}/click`).catch(() => {}); };

  const handleCta = () => {
    if (!popup) return;
    trackClick();
    const url = (popup.ctaUrl || '').trim();
    if (url) {
      if (/^https?:\/\//i.test(url)) window.open(url, '_blank', 'noopener,noreferrer');
      else if (url.startsWith('#')) { try { document.querySelector(url)?.scrollIntoView({ behavior: 'smooth' }); } catch {} }
      else window.location.href = url;
    }
    close();
  };

  const hasForm = !!(popup?.form?.enabled && (popup.form.fields || []).length > 0);

  const handleSubmit = async () => {
    if (!popup) return;
    setFormErr('');
    for (const f of popup.form.fields) {
      if (f.required && !String(values[f.key] || '').trim()) {
        setFormErr(`El campo "${f.label}" es obligatorio`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await api.post(`/menu-popups/${popup._id}/submit`, { data: values });
      setDone(res.data?.message || popup.form.successMessage || '¡Gracias!');
    } catch (e) {
      setFormErr(e.response?.data?.message || 'Error al enviar');
    } finally {
      setSubmitting(false);
    }
  };

  if (!popup) return null;
  const fmt = popup.format || 'modal';

  // Botón de cerrar reutilizable
  const CloseBtn = ({ dark }) => (
    <button
      onClick={close}
      className={`absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${dark ? 'bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}
      aria-label="Cerrar"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
    </button>
  );

  // Contenido del formulario / CTA
  const ActionBlock = () => {
    if (done) {
      return (
        <div className="mt-4 flex flex-col items-center gap-2">
          <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
          <p className="text-emerald-600 font-bold">{done}</p>
        </div>
      );
    }
    if (hasForm) {
      return (
        <div className="mt-4 space-y-2 text-left">
          {popup.form.title && <p className="text-sm font-bold text-slate-700 text-center mb-1">{popup.form.title}</p>}
          {popup.form.fields.map(f => (
            <input
              key={f.key}
              type={INPUT_TYPE[f.key] || 'text'}
              value={values[f.key] || ''}
              onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
              placeholder={f.label + (f.required ? ' *' : '')}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': `${themeColor}40` }}
            />
          ))}
          {formErr && <p className="text-xs text-red-500 font-semibold">{formErr}</p>}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3.5 rounded-2xl text-white font-black text-[15px] shadow-lg active:scale-[0.98] transition-transform disabled:opacity-60"
            style={{ backgroundColor: themeColor, boxShadow: `0 12px 28px -12px ${themeColor}` }}
          >
            {submitting ? 'Enviando…' : (popup.form.submitText || 'Enviar')}
          </button>
        </div>
      );
    }
    return (
      <button
        onClick={popup.ctaText ? handleCta : close}
        className="mt-5 w-full py-3.5 rounded-2xl text-white font-black text-[15px] shadow-lg active:scale-[0.98] transition-transform"
        style={{ backgroundColor: themeColor, boxShadow: `0 12px 28px -12px ${themeColor}` }}
      >
        {popup.ctaText || '¡Entendido!'}
      </button>
    );
  };

  // Tarjeta (usada por modal, fullscreen, toast y barra expandida)
  const Card = ({ fullscreen }) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 20 }}
      transition={{ type: 'spring', damping: 26, stiffness: 320 }}
      className={`relative bg-white shadow-2xl overflow-hidden ${fullscreen ? 'w-full h-full flex flex-col' : 'w-full max-w-sm rounded-3xl'}`}
    >
      <CloseBtn dark={!!popup.image} />
      {popup.image && (
        <img src={popup.image} alt={popup.title} className={`w-full object-cover bg-slate-100 ${fullscreen ? 'h-1/2' : 'max-h-56'}`} />
      )}
      <div className={`p-5 text-center overflow-y-auto ${fullscreen ? 'flex-1 flex flex-col justify-center max-w-md mx-auto w-full' : ''}`}>
        <h3 className="text-xl font-black text-slate-900 leading-tight">{popup.title}</h3>
        {popup.body && <p className="text-[15px] text-slate-500 mt-2 leading-relaxed whitespace-pre-line">{popup.body}</p>}
        <ActionBlock />
      </div>
    </motion.div>
  );

  // ── BARRA (arriba / abajo) ──
  if ((fmt === 'bar-top' || fmt === 'bar-bottom') && !expanded) {
    const openFull = hasForm || (popup.body && popup.body.length > 60);
    return (
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ y: fmt === 'bar-top' ? -60 : 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: fmt === 'bar-top' ? -60 : 60, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            className={`fixed left-0 right-0 z-[100] px-3 ${fmt === 'bar-top' ? 'top-0 pt-2' : 'bottom-0 pb-2'}`}
          >
            <div className="max-w-2xl mx-auto flex items-center gap-3 rounded-2xl shadow-xl px-4 py-2.5 text-white" style={{ backgroundColor: themeColor }}>
              {popup.image && <img src={popup.image} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm truncate">{popup.title}</p>
                {popup.body && <p className="text-[12px] text-white/80 truncate">{popup.body}</p>}
              </div>
              <button
                onClick={() => { if (openFull) { setExpanded(true); } else { handleCta(); } }}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 font-black text-xs transition-colors"
              >
                {popup.ctaText || (openFull ? 'Ver' : 'Ver')}
              </button>
              <button onClick={close} className="shrink-0 w-6 h-6 rounded-full hover:bg-white/20 flex items-center justify-center" aria-label="Cerrar">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // ── TOAST (esquina inferior derecha) ──
  if (fmt === 'toast' && !expanded) {
    return (
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ x: 40, y: 20, opacity: 0 }}
            animate={{ x: 0, y: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 280 }}
            className="fixed bottom-4 right-4 z-[100] w-[calc(100%-2rem)] max-w-xs"
          >
            <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
              <CloseBtn dark={!!popup.image} />
              {popup.image && <img src={popup.image} alt={popup.title} className="w-full max-h-32 object-cover bg-slate-100" />}
              <div className="p-4 text-center">
                <h3 className="text-base font-black text-slate-900 leading-tight">{popup.title}</h3>
                {popup.body && <p className="text-[13px] text-slate-500 mt-1 leading-snug line-clamp-3">{popup.body}</p>}
                <ActionBlock />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // ── MODAL / PANTALLA COMPLETA / (barra o toast expandidos) ──
  const isFull = fmt === 'fullscreen';
  return (
    <AnimatePresence>
      {visible && (
        <div className={`fixed inset-0 z-[100] flex justify-center ${isFull ? '' : 'items-center p-4'}`}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={close}
          />
          <div className={`relative ${isFull ? 'w-full h-full' : 'w-full max-w-sm'}`}>
            <Card fullscreen={isFull} />
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
