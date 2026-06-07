import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import crewApi from '../../services/crewApi';
import { useCrew } from './useCrew';

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
}
function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' });
}

const ROLE_LABEL = {
  mesero: 'Mesero', cocinero: 'Cocinero', barista: 'Barista', cajero: 'Cajero',
  runner: 'Auxiliar de cocina', lavaplatos: 'Lavaplatos', host: 'Anfitrión',
  recepcionista: 'Recepcionista', bartender: 'Bartender', parrillero: 'Parrillero',
  panadero: 'Panadero', reposteria: 'Repostería', limpieza: 'Limpieza',
  eventos: 'Eventos', delivery: 'Domiciliario',
};

export default function CrewFeed() {
  const { worker, refreshMe } = useCrew();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(null);
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await crewApi.get('/shifts/feed');
      setShifts(data.shifts || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); refreshMe(); }, [load, refreshMe]);

  const apply = async (shiftId) => {
    setApplying(shiftId);
    try {
      await crewApi.post(`/shifts/${shiftId}/apply`);
      setShifts((prev) => prev.filter((s) => s._id !== shiftId));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (e) {
      alert(e?.response?.data?.message || 'No se pudo enviar la postulación');
    } finally {
      setApplying(null);
    }
  };

  const xpForLevel = (n) => Math.pow(n - 1, 2) * 50;
  const curr = xpForLevel(worker?.level || 1);
  const next = xpForLevel((worker?.level || 1) + 1);
  const pct = Math.min(100, (((worker?.xp || 0) - curr) / (next - curr)) * 100);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-geist pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-md mx-auto px-5 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hola</p>
              <p className="text-[18px] font-extrabold leading-tight">{worker?.name?.split(' ')[0] || 'Crew'}</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500">Nivel</span>
              <span className="text-[13px] font-extrabold text-red-600 tabular-nums">{worker?.level || 1}</span>
            </div>
          </div>

          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-slate-500">Progreso al siguiente nivel</span>
            <span className="text-[10px] font-bold text-slate-700 tabular-nums">{worker?.xp || 0} / {next} XP</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full"
            />
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-5 pt-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-extrabold text-slate-900">Turnos disponibles</h2>
          <button onClick={load} className="text-[12px] font-semibold text-red-600 hover:text-red-700 transition flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Actualizar
          </button>
        </div>

        {loading && (
          <div className="space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-44 bg-white border border-slate-200 rounded-2xl" />
            ))}
          </div>
        )}

        {!loading && shifts.length === 0 && (
          <div className="text-center py-12 px-6 bg-white border border-slate-200 rounded-2xl">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            </div>
            <p className="text-[14px] font-bold text-slate-700">No hay turnos disponibles por ahora</p>
            <p className="text-[12px] text-slate-500 mt-1">Vuelve a revisar más tarde. Te notificaremos cuando haya nuevas oportunidades.</p>
          </div>
        )}

        {!loading && shifts.length > 0 && (
          <div className="space-y-3">
            <AnimatePresence>
              {shifts.map((s, i) => (
                <ShiftCard
                  key={s._id}
                  shift={s}
                  index={i}
                  onApply={() => apply(s._id)}
                  applying={applying === s._id}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: 'spring', damping: 18 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl shadow-emerald-500/30 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
            <p className="text-[13px] font-bold">Postulación enviada</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ShiftCard({ shift, index, onApply, applying }) {
  const biz = shift.businessId || {};
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 200 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[12px] font-extrabold text-slate-700 shrink-0">
          {(biz.businessName || 'M').slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-extrabold text-slate-900 leading-tight">{shift.title}</h3>
          <p className="text-[12px] text-slate-500 truncate mt-0.5">{biz.businessName || 'Negocio MenuBy'}</p>
        </div>
        {shift.isSOS && (
          <span className="shrink-0 px-2 py-0.5 text-[10px] font-extrabold bg-red-100 text-red-700 border border-red-300 rounded-full">
            Urgente
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Stat label="Fecha" value={formatDate(shift.date)} />
        <Stat label="Duración" value={`${shift.hoursTotal} horas`} />
        <Stat label="Pago total" value={formatCOP(shift.totalPay)} accent />
      </div>

      {/* Role + Perks */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 rounded-full">
          {ROLE_LABEL[shift.role] || shift.role}
        </span>
        {(shift.perks || []).slice(0, 2).map((p) => (
          <span key={p} className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
            {p.replace(/_/g, ' ')}
          </span>
        ))}
        {(shift.perks || []).length > 2 && (
          <span className="text-[10px] font-bold text-slate-400">+{(shift.perks || []).length - 2}</span>
        )}
      </div>

      {/* Match score */}
      {shift.matchScore != null && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${shift.matchScore >= 70 ? 'bg-emerald-500' : shift.matchScore >= 50 ? 'bg-amber-500' : 'bg-slate-400'}`}
              style={{ width: `${shift.matchScore}%` }}
            />
          </div>
          <span className={`text-[10px] font-bold tabular-nums ${shift.matchScore >= 70 ? 'text-emerald-600' : 'text-slate-500'}`}>
            {shift.matchScore}% afinidad
          </span>
        </div>
      )}

      <button
        onClick={onApply}
        disabled={applying}
        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-bold text-[13px] shadow-md shadow-red-500/20 hover:shadow-lg hover:shadow-red-500/30 active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {applying ? 'Enviando…' : 'Postularme'}
      </button>
    </motion.div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg">
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-[12px] font-extrabold tabular-nums leading-tight mt-0.5 ${accent ? 'text-emerald-600' : 'text-slate-800'}`}>{value}</p>
    </div>
  );
}
