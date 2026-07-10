import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import api from '../../services/api';

/* State + event dictionaries (español) */
const STATE_LABEL = {
  created: 'Creado', ready: 'Listo para despacho', offered: 'Ofrecido', accepted: 'Asignado',
  at_store: 'En el local', picked_up: 'Recogido', en_route: 'En camino', at_customer: 'En la dirección',
  delivered: 'Entregado', no_courier: 'Sin domiciliario', failed: 'Fallido', returned: 'Devuelto', cancelled: 'Cancelado',
};
const STATE_TONE = {
  delivered: 'good', accepted: 'info', at_store: 'info', picked_up: 'info', en_route: 'info', at_customer: 'info',
  offered: 'amber', ready: 'amber', created: 'slate',
  no_courier: 'bad', failed: 'bad', returned: 'bad', cancelled: 'bad',
};
const EVENT_LABEL = {
  create: 'Pedido creado', ready: 'Listo en cocina', offer: 'Ofrecido a domiciliario/empresa',
  accept: 'Aceptado', assign: 'Asignado', arrive_store: 'Llegó al local', pickup: 'Recogió el pedido',
  depart: 'Salió a entregar', arrive_customer: 'Llegó al cliente', deliver: 'Entregado',
  no_courier: 'Nadie aceptó', fail: 'Falló la entrega', return: 'Devuelto', cancel: 'Cancelado',
  retry: 'Reintento', reject: 'Rechazado', reoffer: 'Reofrecido',
};
const ACTOR_LABEL = { system: 'Sistema', admin: 'Restaurante', driver: 'Domiciliario', partner: 'Empresa', customer: 'Cliente' };

const TONE_CLS = {
  good:  { dot: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-700' },
  info:  { dot: 'bg-blue-500', chip: 'bg-blue-100 text-blue-700' },
  amber: { dot: 'bg-amber-500', chip: 'bg-amber-100 text-amber-700' },
  bad:   { dot: 'bg-rose-500', chip: 'bg-rose-100 text-rose-700' },
  slate: { dot: 'bg-slate-400', chip: 'bg-slate-100 text-slate-600' },
};

const fmtDateTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function DeliveryTimeline({ slug, orderId, orderNumber, isOpen, onClose }) {
  const [loading, setLoading] = useState(true);
  const [delivery, setDelivery] = useState(null);
  const [events, setEvents] = useState([]);

  const load = useCallback(async () => {
    if (!slug || !orderId) return;
    setLoading(true);
    try {
      const res = await api.get(`/delivery-admin/restaurants/${slug}/orders/${orderId}/timeline`);
      setDelivery(res.data.delivery);
      setEvents(res.data.events || []);
    } catch {
      toast.error('No se pudo cargar el recorrido');
    } finally {
      setLoading(false);
    }
  }, [slug, orderId]);

  useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

  const currentTone = delivery ? (TONE_CLS[STATE_TONE[delivery.state]] || TONE_CLS.slate) : TONE_CLS.slate;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[88vh] overflow-hidden flex flex-col"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
          >
            {/* header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800">Recorrido del pedido</h3>
                <p className="text-[12px] text-slate-400">#{orderNumber || orderId?.slice(-6)}</p>
              </div>
              <div className="flex items-center gap-2">
                {delivery && (
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${currentTone.chip}`}>
                    {STATE_LABEL[delivery.state] || delivery.state}
                  </span>
                )}
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

            {/* body */}
            <div className="overflow-y-auto px-5 py-5">
              {loading ? (
                <div className="flex justify-center py-14"><div className="w-7 h-7 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>
              ) : !delivery ? (
                <div className="text-center py-12">
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3 text-slate-300">
                    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                  </div>
                  <p className="text-[14px] font-semibold text-slate-600">Aún sin recorrido</p>
                  <p className="text-[12px] text-slate-400 mt-1">El recorrido aparece cuando el pedido se asigna a un domiciliario.</p>
                </div>
              ) : (
                <>
                  {/* driver / partner summary */}
                  {(delivery.driverId || delivery.partnerId) && (
                    <div className="bg-slate-50 rounded-xl px-3.5 py-2.5 mb-4 flex items-center gap-2 text-[12px] text-slate-600">
                      <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0112 0v1"/></svg>
                      {delivery.partnerId ? 'Entrega por empresa externa' : 'Domiciliario propio'}
                      {delivery.cashToCollect > 0 && <span className="ml-auto font-bold text-slate-700">Cobrar ${delivery.cashToCollect.toLocaleString('es-CO')}</span>}
                    </div>
                  )}

                  {/* timeline */}
                  <div className="relative">
                    {events.map((ev, i) => {
                      const tone = TONE_CLS[STATE_TONE[ev.toState]] || TONE_CLS.slate;
                      const isLast = i === events.length - 1;
                      return (
                        <div key={ev._id || i} className="flex gap-3 pb-5 relative">
                          {/* line */}
                          {!isLast && <div className="absolute left-[7px] top-4 bottom-0 w-px bg-slate-200" />}
                          {/* dot */}
                          <div className={`w-3.5 h-3.5 rounded-full ${tone.dot} shrink-0 mt-0.5 ring-4 ring-white`} />
                          {/* content */}
                          <div className="flex-1 -mt-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[13.5px] font-bold text-slate-800">{EVENT_LABEL[ev.event] || ev.event}</p>
                              <span className="text-[11px] text-slate-400 whitespace-nowrap">{fmtDateTime(ev.createdAt)}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tone.chip}`}>
                                {STATE_LABEL[ev.toState] || ev.toState}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {ACTOR_LABEL[ev.actor] || ev.actor}{ev.actorName ? ` · ${ev.actorName}` : ''}
                              </span>
                            </div>
                            {ev.location?.lat && (
                              <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                {ev.location.lat.toFixed(4)}, {ev.location.lon.toFixed(4)}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
