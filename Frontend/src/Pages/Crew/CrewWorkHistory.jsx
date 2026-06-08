/**
 * CrewWorkHistory — hoja de vida automática generada desde turnos completados.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import crewApi from '../../services/crewApi';

const formatCOP = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

const ROLE_LABELS = {
  mesero: 'Mesero', cocinero: 'Cocinero', barista: 'Barista', cajero: 'Cajero', runner: 'Runner',
  lavaplatos: 'Lavaplatos', host: 'Host', recepcionista: 'Recepcionista', bartender: 'Bartender',
  parrillero: 'Parrillero', panadero: 'Panadero', reposteria: 'Repostería', limpieza: 'Limpieza',
  eventos: 'Eventos', delivery: 'Delivery',
};

export default function CrewWorkHistory({ onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data: res } = await crewApi.get('/workers/me/work-history');
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-[100dvh] bg-[#0a0a14] text-white font-geist pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
      <header className="sticky top-0 z-30 bg-[#0a0a14]/80 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="max-w-md mx-auto px-5 pt-[max(1.25rem,env(safe-area-inset-top,0px))] pb-4 flex items-center gap-3">
          <button onClick={onBack} className="text-white/50 hover:text-white transition" aria-label="Atrás">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div>
            <h1 className="text-[18px] font-extrabold text-white">Historial Laboral</h1>
            <p className="text-[11px] text-white/40">Tu hoja de vida Crew automática</p>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-5 pt-6 space-y-6">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-24 rounded-2xl bg-white/[0.04]" />
            <div className="h-32 rounded-2xl bg-white/[0.04]" />
          </div>
        ) : !data ? (
          <p className="text-center text-white/40 py-10">Error al cargar</p>
        ) : (
          <>
            {/* Summary stats */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-2 gap-3"
            >
              {[
                { label: 'Turnos', value: data.summary.totalShifts, icon: '📋' },
                { label: 'Horas', value: `${data.summary.totalHours}h`, icon: '⏱️' },
                { label: 'Ganado', value: formatCOP(data.summary.totalEarned), icon: '💰' },
                { label: 'Rating', value: data.summary.avgRating ? `${data.summary.avgRating}★` : '—', icon: '⭐' },
              ].map((stat) => (
                <div key={stat.label} className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
                  <span className="text-[18px]">{stat.icon}</span>
                  <p className="text-[16px] font-black text-white mt-1">{stat.value}</p>
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{stat.label}</p>
                </div>
              ))}
            </motion.div>

            {/* Negocios */}
            <div>
              <h2 className="text-[13px] font-bold text-white/50 uppercase tracking-wider mb-3">
                Experiencia en {data.summary.totalBusinesses} negocio{data.summary.totalBusinesses !== 1 ? 's' : ''}
              </h2>

              {data.history.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-[13px] text-white/40">Completa tu primer turno para comenzar tu historial.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.history.map((entry, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                          {entry.business?.logo ? (
                            <img src={entry.business.logo} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[14px] font-black text-white/40">{(entry.business?.businessName || 'R').charAt(0)}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-bold text-white truncate">{entry.business?.businessName || 'Negocio'}</p>
                          <p className="text-[11px] text-white/40">
                            {entry.roles.map((r) => ROLE_LABELS[r] || r).join(', ')}
                          </p>
                        </div>
                        {entry.avgRating && (
                          <span className="text-[12px] font-bold text-yellow-400/80">{entry.avgRating}★</span>
                        )}
                      </div>

                      <div className="mt-3 flex items-center gap-4 text-[11px] text-white/50">
                        <span>{entry.shiftsCount} turno{entry.shiftsCount > 1 ? 's' : ''}</span>
                        <span>{entry.totalHours}h trabajadas</span>
                        <span>{formatCOP(entry.totalEarned)}</span>
                      </div>

                      {entry.firstShift && (
                        <p className="mt-2 text-[10px] text-white/30">
                          {new Date(entry.firstShift).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })}
                          {' — '}
                          {new Date(entry.lastShift).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Member since */}
            {data.summary.memberSince && (
              <p className="text-center text-[11px] text-white/30 pt-4">
                Miembro Crew desde {new Date(data.summary.memberSince).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
