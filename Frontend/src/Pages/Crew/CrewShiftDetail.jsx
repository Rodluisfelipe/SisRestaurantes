/**
 * CrewShiftDetail — pantalla de detalle de un turno para el worker.
 * Muestra:
 *   - Hero con cover image + logo
 *   - Info del negocio (descripción, dirección, WhatsApp)
 *   - Detalles del turno (fecha, horas, pago, perks)
 *   - Reviews previos de otros workers
 *   - Menú completo del negocio (read-only)
 *   - Botón Postularme
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import crewApi from '../../services/crewApi';
import { cannon } from './components/confettiBurst';
import { crewToast } from './components/crewToast';
import MagneticButton from './components/MagneticButton';

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
}
function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

const ROLE_LABEL = {
  mesero: 'Mesero', cocinero: 'Cocinero', barista: 'Barista', cajero: 'Cajero',
  runner: 'Auxiliar de cocina', lavaplatos: 'Lavaplatos', host: 'Anfitrión',
  recepcionista: 'Recepcionista', bartender: 'Bartender', parrillero: 'Parrillero',
  panadero: 'Panadero', reposteria: 'Repostería', limpieza: 'Limpieza',
  eventos: 'Eventos', delivery: 'Domiciliario',
};

export default function CrewShiftDetail({ shiftId, onBack, onApplied }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [applying, setApplying] = useState(false);
  const [expandedCat, setExpandedCat] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await crewApi.get(`/shifts/${shiftId}`);
      setData(data);
      // Auto-expand primera categoría
      if (data?.menu?.[0]) setExpandedCat(String(data.menu[0]._id));
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudo cargar el turno');
    } finally { setLoading(false); }
  }, [shiftId]);

  useEffect(() => { load(); }, [load]);

  const apply = async () => {
    setApplying(true);
    try {
      await crewApi.post(`/shifts/${shiftId}/apply`);
      cannon();
      crewToast.success('Postulación enviada — te avisaremos si te aceptan');
      onApplied?.();
    } catch (e) {
      crewToast.error(e?.response?.data?.message || 'No se pudo postular');
    } finally { setApplying(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 animate-pulse">
        <div className="h-56 bg-slate-200" />
        <div className="max-w-md mx-auto px-5 mt-5 space-y-3">
          <div className="h-24 bg-white border border-slate-200 rounded-2xl" />
          <div className="h-32 bg-white border border-slate-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-5">
        <div className="bg-white border border-red-200 rounded-2xl p-6 text-center max-w-md">
          <p className="text-[14px] font-bold text-red-700">{error || 'Sin datos'}</p>
          <button onClick={onBack} className="mt-3 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-bold text-[13px]">Volver</button>
        </div>
      </div>
    );
  }

  const { shift, transparency, menu, matchScore } = data;
  const biz = shift.businessId || {};
  const cover = biz.coverImage;
  const logo = biz.logo;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-geist pb-32">
      {/* Hero con cover + logo */}
      <div className="relative">
        {/* Cover image */}
        <div className="relative h-56 bg-gradient-to-br from-slate-300 to-slate-500 overflow-hidden">
          {cover && (
            <img src={cover} alt={biz.businessName} className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />

          {/* Back button */}
          <button
            onClick={onBack}
            className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-lg active:scale-95 transition"
            aria-label="Volver"
          >
            <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>

          {/* SOS pill */}
          {shift.isSOS && (
            <span className="absolute top-4 right-4 px-2.5 py-1 text-[11px] font-extrabold bg-red-500 text-white rounded-full shadow-lg animate-pulse">
              Urgente
            </span>
          )}

          {/* Logo + name floating at bottom of cover */}
          <div className="absolute -bottom-8 left-0 right-0 px-5">
            <div className="max-w-md mx-auto flex items-end gap-3">
              <div className="w-20 h-20 rounded-2xl bg-white border-4 border-white shadow-xl overflow-hidden shrink-0">
                {logo ? (
                  <img src={logo} alt={biz.businessName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-[24px] font-extrabold text-white">
                    {(biz.businessName || 'M').slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 pb-2 min-w-0">
                <p className="text-[18px] font-extrabold text-white truncate drop-shadow-lg">{biz.businessName || 'Negocio'}</p>
                {transparency?.scores?.avgRating && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l2.4 7.2H22l-6 4.4 2.3 7.2L12 16.4 5.7 20.8 8 13.6 2 9.2h7.6L12 2z"/></svg>
                    <span className="text-[11px] font-bold text-white">
                      {transparency.scores.avgRating.toFixed(1)} ({transparency.scores.reviewCount} reseñas)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-md mx-auto px-5 mt-12 space-y-4">
          {/* Shift info card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"
          >
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Turno disponible</p>
            <h1 className="text-[20px] font-extrabold leading-tight text-slate-900">{shift.title}</h1>
            <p className="text-[13px] text-slate-600 mt-1">{ROLE_LABEL[shift.role] || shift.role}</p>

            <div className="grid grid-cols-2 gap-2.5 mt-4">
              <InfoStat
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18"/></svg>
                }
                label="Cuándo"
                value={formatDate(shift.date)}
              />
              <InfoStat
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 6v6l4 2"/></svg>
                }
                label="Horario"
                value={`${shift.startTime} a ${shift.endTime}`}
              />
              <InfoStat
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M5 7v10M19 7v10M9 7h6"/><circle cx="12" cy="12" r="10"/></svg>
                }
                label="Duración"
                value={`${shift.hoursTotal} horas`}
              />
              <InfoStat
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6"/></svg>
                }
                label="Pago"
                value={formatCOP(shift.totalPay)}
                accent
              />
            </div>

            {(shift.perks || []).length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Beneficios</p>
                <div className="flex flex-wrap gap-1.5">
                  {shift.perks.map((p) => (
                    <span key={p} className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full capitalize">
                      {p.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {matchScore != null && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tu afinidad</span>
                  <span className={`text-[13px] font-extrabold tabular-nums ${matchScore >= 70 ? 'text-emerald-600' : matchScore >= 50 ? 'text-amber-600' : 'text-slate-500'}`}>
                    {matchScore}%
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${matchScore}%` }}
                    transition={{ duration: 0.9 }}
                    className={`h-full rounded-full ${matchScore >= 70 ? 'bg-emerald-500' : matchScore >= 50 ? 'bg-amber-500' : 'bg-slate-400'}`}
                  />
                </div>
              </div>
            )}
          </motion.div>

          {/* Sobre el negocio */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"
          >
            <h2 className="text-[13px] font-extrabold text-slate-900 mb-2">Sobre el negocio</h2>
            {biz.description && (
              <p className="text-[13px] text-slate-600 leading-relaxed mb-3">{biz.description}</p>
            )}

            <div className="space-y-2">
              {biz.address && (
                <div className="flex items-start gap-2.5 text-[12px] text-slate-700">
                  <svg className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3"/></svg>
                  <span>{typeof biz.address === 'string' ? biz.address : (biz.address?.full || JSON.stringify(biz.address))}</span>
                </div>
              )}
              {biz.whatsappNumber && (
                <a
                  href={`https://wa.me/${biz.whatsappNumber.replace(/\D/g, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-[12px] text-emerald-700 hover:text-emerald-800 transition"
                >
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.687 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp: {biz.whatsappNumber}
                </a>
              )}
              <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                <svg className="w-4 h-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 16h4"/></svg>
                <span className="capitalize">{biz.businessType || 'Restaurante'}</span>
              </div>
            </div>
          </motion.div>

          {/* Menú del negocio */}
          {menu?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
            >
              <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                <h2 className="text-[13px] font-extrabold text-slate-900">Lo que sirven en este lugar</h2>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Solo lectura</span>
              </div>

              {menu.map((cat) => {
                const isOpen = expandedCat === String(cat._id);
                return (
                  <div key={cat._id} className="border-t border-slate-100">
                    <button
                      onClick={() => setExpandedCat(isOpen ? null : String(cat._id))}
                      className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition"
                    >
                      <div className="text-left">
                        <p className="text-[13px] font-extrabold text-slate-800">{cat.name}</p>
                        <p className="text-[11px] text-slate-500">{cat.products.length} {cat.products.length === 1 ? 'producto' : 'productos'}</p>
                      </div>
                      <motion.svg
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        className="w-4 h-4 text-slate-400"
                        fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                      </motion.svg>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-3 space-y-2">
                            {cat.products.map((p) => (
                              <div key={p._id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border border-slate-100">
                                {p.image ? (
                                  <img src={p.image} alt="" className="w-12 h-12 rounded-lg object-cover bg-slate-200" />
                                ) : (
                                  <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14"/></svg>
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-[12px] font-bold text-slate-800 truncate">{p.name}</p>
                                  {p.description && <p className="text-[10px] text-slate-500 line-clamp-1">{p.description}</p>}
                                </div>
                                <p className="text-[12px] font-extrabold text-slate-900 tabular-nums shrink-0">{formatCOP(p.price)}</p>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </motion.div>
          )}

          {/* Reviews previos de workers */}
          {transparency?.recentReviews?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"
            >
              <h2 className="text-[13px] font-extrabold text-slate-900 mb-3">Lo que dicen otros workers</h2>
              <div className="space-y-3">
                {transparency.recentReviews.slice(0, 3).map((r, i) => (
                  <div key={i} className="border-l-2 border-slate-200 pl-3">
                    <div className="flex items-center gap-1 mb-1">
                      {[...Array(5)].map((_, j) => (
                        <svg key={j} className={`w-3 h-3 ${j < r.rating ? 'text-amber-400' : 'text-slate-200'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l2.4 7.2H22l-6 4.4 2.3 7.2L12 16.4 5.7 20.8 8 13.6 2 9.2h7.6L12 2z"/></svg>
                      ))}
                    </div>
                    {r.comment && <p className="text-[12px] text-slate-700 italic">"{r.comment}"</p>}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Sticky apply CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent pt-10 pb-4 px-5">
        <div className="max-w-md mx-auto">
          <MagneticButton
            onClick={apply}
            disabled={applying}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 text-white font-extrabold text-[15px] shadow-xl shadow-red-500/35 disabled:opacity-50"
          >
            <span className="flex items-center justify-center gap-2">
              {applying ? 'Enviando…' : 'Postularme a este turno'}
              <span className="text-white/80 font-bold text-[12px]">· {formatCOP(shift.totalPay)}</span>
            </span>
          </MagneticButton>
        </div>
      </div>
    </div>
  );
}

function InfoStat({ icon, label, value, accent }) {
  return (
    <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-slate-400">{icon}</span>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-[13px] font-extrabold tabular-nums leading-tight ${accent ? 'text-emerald-600' : 'text-slate-800'}`}>
        {value}
      </p>
    </div>
  );
}
