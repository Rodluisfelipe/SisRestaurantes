import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { globalSearch } from '../../services/superadminApi';

const money = (n) => `$${Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

/**
 * GlobalSearch — un solo campo para encontrar cualquier cosa.
 *
 * Soporte no debería tener que adivinar en qué sección buscar: aquí se pega un
 * teléfono, un número de pedido, un nombre o un slug y aparece lo que sea.
 * Se abre con Ctrl/Cmd + K.
 */
export default function GlobalSearch({ onOpenBusiness }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  // Atajo de teclado
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 40);
    else { setQ(''); setRes(null); }
  }, [open]);

  // Se espera a que deje de escribir: sin esto sale una consulta por tecla
  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return undefined; }
    setLoading(true);
    const t = setTimeout(() => {
      globalSearch(q.trim())
        .then(setRes)
        .catch(() => setRes({ businesses: [], orders: [] }))
        .finally(() => setLoading(false));
    }, 280);
    return () => clearTimeout(t);
  }, [q]);

  const nothing = res && !res.businesses?.length && !res.orders?.length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-slate-400 bg-slate-50 border border-slate-200 hover:border-slate-300 hover:text-slate-600 transition-colors"
      >
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="M21 21l-4.3-4.3" />
        </svg>
        <span className="flex-1 text-left">Buscar…</span>
        <kbd className="hidden sm:inline text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-400">⌘K</kbd>
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 sm:pt-24">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                <svg className="w-[18px] h-[18px] text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="M21 21l-4.3-4.3" />
                </svg>
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Negocio, teléfono, #pedido o cliente…"
                  className="flex-1 text-[15px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
                />
                {loading && <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />}
                <button onClick={() => setOpen(false)} className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">ESC</button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto">
                {q.trim().length < 2 ? (
                  <p className="px-4 py-10 text-center text-[13px] text-slate-400">
                    Escribe al menos dos caracteres.
                  </p>
                ) : nothing ? (
                  <p className="px-4 py-10 text-center text-[13px] text-slate-400">
                    Nada coincide con «{q}».
                  </p>
                ) : (
                  <>
                    {res?.businesses?.length > 0 && (
                      <div className="py-2">
                        <p className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Negocios</p>
                        {res.businesses.map((b) => (
                          <div key={b._id} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${b.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                            <div className="min-w-0 flex-1">
                              <p className="text-[13.5px] font-semibold text-slate-800 truncate">{b.businessName}</p>
                              <p className="text-[11.5px] text-slate-400 truncate">/{b.slug}{b.city ? ` · ${b.city}` : ''}</p>
                            </div>
                            {b.slug && (
                              <a
                                href={`/${b.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600"
                              >
                                Menú
                              </a>
                            )}
                            {onOpenBusiness && (
                              <button
                                onClick={() => { setOpen(false); onOpenBusiness(b); }}
                                className="shrink-0 px-2 py-1 rounded-md text-[11px] font-bold bg-slate-800 text-white"
                              >
                                Abrir
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {res?.orders?.length > 0 && (
                      <div className="py-2 border-t border-slate-100">
                        <p className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Pedidos</p>
                        {res.orders.map((o) => (
                          <div key={o._id} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50">
                            <div className="min-w-0 flex-1">
                              <p className="text-[13.5px] font-semibold text-slate-800 truncate">
                                #{o.orderNumber} · {o.customerName}
                              </p>
                              <p className="text-[11.5px] text-slate-400 truncate">
                                {o.business?.businessName || '—'}
                                {o.phone ? ` · ${o.phone}` : ''}
                                {` · ${new Date(o.createdAt).toLocaleDateString('es-CO')}`}
                              </p>
                            </div>
                            <span className="shrink-0 text-[12.5px] font-bold text-slate-700 tabular-nums">{money(o.amount)}</span>
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500">{o.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
