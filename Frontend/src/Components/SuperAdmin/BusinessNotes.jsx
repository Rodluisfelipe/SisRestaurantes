import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchBusinessNotes, createBusinessNote, pinBusinessNote, deleteBusinessNote } from '../../services/superadminApi';

const KINDS = [
  { id: 'call', label: 'Llamada', icon: '📞' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { id: 'email', label: 'Correo', icon: '✉️' },
  { id: 'note', label: 'Nota', icon: '📝' },
];

const when = (d) => {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)} d`;
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * BusinessNotes — historial de contacto con un negocio.
 * Lo que Salud no puede decir: qué se hizo y qué contestaron.
 */
export default function BusinessNotes({ business, onClose }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [kind, setKind] = useState('call');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetchBusinessNotes(business._id)
      .then((d) => setNotes(d.notes || []))
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, [business._id]);

  const save = async () => {
    const t = text.trim();
    if (!t || saving) return;
    setSaving(true);
    try {
      await createBusinessNote(business._id, { text: t, kind });
      setText('');
      load();
    } catch { /* el error se ve porque la nota no aparece */ }
    setSaving(false);
  };

  const togglePin = async (n) => {
    try { await pinBusinessNote(business._id, n._id, !n.pinned); load(); } catch {}
  };

  const remove = async (n) => {
    if (!window.confirm('¿Eliminar esta nota?')) return;
    try { await deleteBusinessNote(business._id, n._id); load(); } catch {}
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 max-h-[92vh] sm:max-h-[80vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-slate-800 truncate">Historial de contacto</h2>
            <p className="text-[12px] text-slate-400 truncate">{business.businessName}</p>
          </div>
          <button onClick={onClose} className="p-2 -mr-1 rounded-lg text-slate-400 hover:bg-slate-100">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Nueva nota */}
        <div className="px-5 py-3 border-b border-slate-100 shrink-0">
          <div className="flex gap-1.5 mb-2">
            {KINDS.map((k) => (
              <button
                key={k.id}
                onClick={() => setKind(k.id)}
                className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition-colors ${
                  kind === k.id ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {k.icon} {k.label}
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') save(); }}
            rows={2}
            maxLength={2000}
            placeholder="Qué pasó, qué dijeron, qué quedó pendiente…"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-slate-400">⌘+Enter para guardar</span>
            <button
              onClick={save}
              disabled={!text.trim() || saving}
              className="px-4 py-1.5 rounded-lg text-[13px] font-bold bg-slate-800 text-white disabled:opacity-40"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Historial */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <p className="py-10 text-center text-[13px] text-slate-400">Cargando…</p>
          ) : notes.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-[13.5px] font-semibold text-slate-600">Sin historial todavía</p>
              <p className="text-[12.5px] text-slate-400 mt-1">La primera nota que guardes quedará aquí para todo el equipo.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <AnimatePresence initial={false}>
                {notes.map((n) => {
                  const k = KINDS.find((x) => x.id === n.kind) || KINDS[3];
                  return (
                    <motion.div
                      key={n._id}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className={`rounded-xl border p-3 ${n.pinned ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[12px]">{k.icon}</span>
                        <span className="text-[11.5px] font-bold text-slate-500">{k.label}</span>
                        <span className="text-[11px] text-slate-400">· {when(n.createdAt)}</span>
                        <div className="ml-auto flex items-center gap-1">
                          <button
                            onClick={() => togglePin(n)}
                            className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${n.pinned ? 'text-amber-700 bg-amber-100' : 'text-slate-400 hover:bg-slate-100'}`}
                            title={n.pinned ? 'Quitar de arriba' : 'Fijar arriba'}
                          >
                            {n.pinned ? 'Fijada' : 'Fijar'}
                          </button>
                          <button onClick={() => remove(n)} className="px-1.5 py-0.5 rounded text-[11px] text-slate-400 hover:text-red-600 hover:bg-red-50">
                            Borrar
                          </button>
                        </div>
                      </div>
                      <p className="text-[13.5px] text-slate-700 whitespace-pre-wrap break-words">{n.text}</p>
                      {n.authorEmail && <p className="text-[11px] text-slate-400 mt-1.5">— {n.authorEmail}</p>}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
