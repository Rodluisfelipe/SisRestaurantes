import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import api from '../../services/api';

const MODES = [
  { id: 'manual', title: 'Manual', desc: 'Tú asignas cada pedido a mano desde la cola.', icon: 'hand' },
  { id: 'auto_nearest', title: 'Automático — más cercano', desc: 'Asigna al domiciliario disponible más cercano al cliente.', icon: 'near' },
  { id: 'auto_scored', title: 'Automático — inteligente', desc: 'Puntúa por distancia, carga de trabajo y rating.', icon: 'brain' },
];

const ModeIcon = ({ type, active }) => {
  const cls = `w-5 h-5 ${active ? 'text-white' : 'text-slate-400'}`;
  if (type === 'hand') return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 00-4 0v5M14 10V4a2 2 0 00-4 0v6M10 10.5V6a2 2 0 00-4 0v8M18 8a2 2 0 114 0v6a8 8 0 01-8 8h-2a8 8 0 01-8-8v-1a2 2 0 114 0"/></svg>;
  if (type === 'near') return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>;
  return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 00-4 4 4 4 0 00-2 7 4 4 0 004 5 3 3 0 006 0 4 4 0 004-5 4 4 0 00-2-7 4 4 0 00-4-4z"/><path d="M12 2v20"/></svg>;
};

export default function DeliverySettingsModal({ slug, isOpen, onClose }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState('manual');
  const [usePartners, setUsePartners] = useState(false);
  const [radius, setRadius] = useState(8);
  const [partners, setPartners] = useState([]);        // associated {partnerId, enabled, priority, name}
  const [available, setAvailable] = useState([]);       // all active partners

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, aRes] = await Promise.all([
        api.get(`/delivery-admin/restaurants/${slug}/delivery-settings`),
        api.get(`/delivery-admin/restaurants/${slug}/available-partners`),
      ]);
      setMode(sRes.data.assignmentMode || 'manual');
      setUsePartners(!!sRes.data.usePartners);
      setRadius(sRes.data.maxAssignRadiusKm || 8);
      setPartners(sRes.data.partners || []);
      setAvailable(aRes.data || []);
    } catch {
      toast.error('Error cargando configuración');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

  const togglePartner = (p) => {
    setPartners(prev => {
      const exists = prev.find(x => String(x.partnerId) === String(p._id));
      if (exists) return prev.filter(x => String(x.partnerId) !== String(p._id));
      return [...prev, { partnerId: p._id, enabled: true, priority: prev.length + 1, name: p.name }];
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/delivery-admin/restaurants/${slug}/delivery-settings`, {
        assignmentMode: mode,
        usePartners,
        maxAssignRadiusKm: radius,
        partners: partners.map((p, i) => ({ partnerId: p.partnerId, enabled: p.enabled !== false, priority: i + 1 })),
      });
      toast.success('Configuración guardada');
      onClose(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const isAssociated = (id) => partners.some(x => String(x.partnerId) === String(id));

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => onClose(false)}
        >
          <motion.div
            className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-hidden flex flex-col"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
          >
            {/* header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">Asignación de domicilios</h3>
              <button onClick={() => onClose(false)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-slate-200 border-t-red-500 rounded-full animate-spin" /></div>
            ) : (
              <div className="overflow-y-auto px-5 py-4 space-y-6">
                {/* Mode selector */}
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Modo de asignación</p>
                  <div className="space-y-2.5">
                    {MODES.map(m => {
                      const active = mode === m.id;
                      return (
                        <button key={m.id} onClick={() => setMode(m.id)}
                          className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-colors ${active ? 'border-slate-900 bg-slate-900' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${active ? 'bg-white/10' : 'bg-slate-100'}`}>
                            <ModeIcon type={m.icon} active={active} />
                          </div>
                          <div className="flex-1">
                            <p className={`font-bold text-[14px] ${active ? 'text-white' : 'text-slate-800'}`}>{m.title}</p>
                            <p className={`text-[12px] mt-0.5 ${active ? 'text-slate-300' : 'text-slate-400'}`}>{m.desc}</p>
                          </div>
                          {active && <svg className="w-5 h-5 text-white shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Radius (only for auto modes) */}
                {mode !== 'manual' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Radio máximo</p>
                      <span className="text-[13px] font-bold text-slate-700">{radius} km</span>
                    </div>
                    <input type="range" min={1} max={30} value={radius} onChange={e => setRadius(Number(e.target.value))}
                      className="w-full accent-slate-900" />
                    <p className="text-[11px] text-slate-400 mt-1">Solo asigna domiciliarios dentro de este radio del cliente.</p>
                  </div>
                )}

                {/* Partners */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Empresas externas</p>
                    <button onClick={() => setUsePartners(v => !v)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${usePartners ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${usePartners ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                  <p className="text-[12px] text-slate-400 mb-3">Si no hay domi propio disponible, ofrece el pedido a estas empresas por orden de prioridad.</p>

                  {usePartners && (
                    available.length === 0 ? (
                      <div className="bg-slate-50 rounded-xl p-4 text-center text-[12px] text-slate-400">
                        No hay empresas de reparto disponibles. Contacta al administrador de la plataforma para asociarte con una.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {available.map(p => {
                          const on = isAssociated(p._id);
                          const idx = partners.findIndex(x => String(x.partnerId) === String(p._id));
                          return (
                            <button key={p._id} onClick={() => togglePartner(p)}
                              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${on ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-bold ${on ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                {on ? idx + 1 : ''}
                              </div>
                              <div className="flex-1 text-left">
                                <p className="font-bold text-[13px] text-slate-800">{p.name}</p>
                                {p.coverageAreas?.length > 0 && <p className="text-[11px] text-slate-400">{p.coverageAreas.join(', ')}</p>}
                              </div>
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${on ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                                {on && <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* footer */}
            <div className="px-5 py-4 border-t border-slate-100">
              <button onClick={save} disabled={saving || loading}
                className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 disabled:opacity-60 transition-colors">
                {saving ? 'Guardando…' : 'Guardar configuración'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
