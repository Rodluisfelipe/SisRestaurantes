import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import crewApi from '../../services/crewApi';
import { useCrew } from './useCrew';
import { Toaster } from 'sonner';
import { crewToast } from './components/crewToast';
import { cannon } from './components/confettiBurst';
import MagneticButton from './components/MagneticButton';
import TiltCard from './components/TiltCard';
import StreakFlame from './components/StreakFlame';
import AnimatedCounter from './components/AnimatedCounter';
import DailyQuests from './components/DailyQuests';
import CrewShiftDetail from './CrewShiftDetail';

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
  const [openShift, setOpenShift] = useState(null);

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
      cannon(); // 🎉 confetti burst
      crewToast.success('Postulación enviada — te avisaremos si te aceptan');
    } catch (e) {
      crewToast.error(e?.response?.data?.message || 'No se pudo enviar la postulación');
    } finally {
      setApplying(null);
    }
  };

  const xpForLevel = (n) => Math.pow(n - 1, 2) * 50;
  const curr = xpForLevel(worker?.level || 1);
  const next = xpForLevel((worker?.level || 1) + 1);
  const pct = Math.min(100, (((worker?.xp || 0) - curr) / (next - curr)) * 100);

  // Si hay un shift abierto, mostrar el detalle full screen
  if (openShift) {
    return (
      <CrewShiftDetail
        shiftId={openShift}
        onBack={() => setOpenShift(null)}
        onApplied={() => {
          setShifts((prev) => prev.filter((s) => s._id !== openShift));
          setOpenShift(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-geist pb-24">
      {/* Header con gradient mesh sutil */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-slate-200 overflow-hidden">
        <div className="absolute -top-16 -right-10 w-48 h-48 bg-red-200/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-10 w-40 h-40 bg-amber-200/30 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-md mx-auto px-5 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hola</p>
                <p className="text-[18px] font-extrabold leading-tight">{worker?.name?.split(' ')[0] || 'Crew'}</p>
              </div>
              {worker?.streakDays > 0 && <StreakFlame days={worker.streakDays} size="sm" />}
            </div>
            <motion.div
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-red-500 to-red-600 shadow-lg shadow-red-500/30"
            >
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l2.4 7.2H22l-6 4.4 2.3 7.2L12 16.4 5.7 20.8 8 13.6 2 9.2h7.6L12 2z"/></svg>
              <span className="text-[11px] font-bold text-white">Nivel</span>
              <span className="text-[14px] font-extrabold text-white tabular-nums">
                <AnimatedCounter value={worker?.level || 1} duration={0.6} />
              </span>
            </motion.div>
          </div>

          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-slate-500">Progreso al siguiente nivel</span>
            <span className="text-[10px] font-bold text-slate-700 tabular-nums">
              <AnimatedCounter value={worker?.xp || 0} /> / {next} XP
            </span>
          </div>
          <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-500 via-red-500 to-red-600 rounded-full"
            />
            {/* Shimmer overlay */}
            <motion.div
              animate={{ x: ['-100%', '300%'] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-white/70 to-transparent"
            />
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-5 pt-5 space-y-5">
        <DailyQuests worker={worker} />

        <div className="flex items-center justify-between">
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
                  onOpen={() => setOpenShift(s._id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      <Toaster position="top-center" closeButton={false} />
    </div>
  );
}

function ShiftCard({ shift, index, onApply, applying, onOpen }) {
  const biz = shift.businessId || {};
  const cover = biz.coverImage;
  const logo = biz.logo;

  return (
    <TiltCard
      maxTilt={3}
      as={motion.div}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 200 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-lg hover:border-slate-300 transition-all overflow-hidden"
    >
      {/* Cover image como fondo del header */}
      <button onClick={onOpen} className="relative w-full h-32 block overflow-hidden bg-gradient-to-br from-slate-300 to-slate-500">
        {cover ? (
          <img src={cover} alt={biz.businessName} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />

        {/* SOS pill */}
        {shift.isSOS && (
          <span className="absolute top-2.5 right-2.5 px-2 py-0.5 text-[10px] font-extrabold bg-red-500 text-white rounded-full shadow-lg animate-pulse">
            Urgente
          </span>
        )}

        {/* Business name floating at bottom */}
        <div className="absolute bottom-2.5 left-3 right-3 flex items-end gap-2.5">
          <div className="w-11 h-11 rounded-xl bg-white border-2 border-white shadow-lg overflow-hidden shrink-0">
            {logo ? (
              <img src={logo} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-[13px] font-extrabold text-white">
                {(biz.businessName || 'M').slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 pb-0.5">
            <p className="text-[13px] font-extrabold text-white truncate drop-shadow-lg">{biz.businessName || 'Negocio'}</p>
            <p className="text-[10px] text-white/80 font-semibold uppercase tracking-wider">{biz.businessType || 'Restaurante'}</p>
          </div>
        </div>
      </button>

      {/* Body */}
      <div className="p-4">
        <h3 className="text-[14px] font-extrabold text-slate-900 leading-tight">{shift.title}</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">{ROLE_LABEL[shift.role] || shift.role}</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <Stat label="Fecha" value={formatDate(shift.date)} />
          <Stat label="Duración" value={`${shift.hoursTotal} horas`} />
          <Stat label="Pago total" value={formatCOP(shift.totalPay)} accent />
        </div>

        {/* Perks */}
        {(shift.perks || []).length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {(shift.perks || []).slice(0, 3).map((p) => (
              <span key={p} className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full capitalize">
                {p.replace(/_/g, ' ')}
              </span>
            ))}
            {(shift.perks || []).length > 3 && (
              <span className="text-[10px] font-bold text-slate-400">+{(shift.perks || []).length - 3}</span>
            )}
          </div>
        )}

        {/* Match score */}
        {shift.matchScore != null && (
          <div className="flex items-center gap-2 mt-3">
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

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={onOpen}
            className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[12px] transition flex items-center gap-1.5"
          >
            Ver detalle
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
          </button>
          <MagneticButton
            onClick={onApply}
            disabled={applying}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-bold text-[13px] shadow-md shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/35 transition-all disabled:opacity-50"
          >
            {applying ? 'Enviando…' : 'Postularme'}
          </MagneticButton>
        </div>
      </div>
    </TiltCard>
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
