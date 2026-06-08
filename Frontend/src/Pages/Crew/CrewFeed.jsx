import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import crewApi from '../../services/crewApi';
import { useCrew } from './useCrew';
import { Toaster } from 'sonner';
import { crewToast } from './components/crewToast';
import { cannon } from './components/confettiBurst';
import TiltCard from './components/TiltCard';
import StreakFlame from './components/StreakFlame';
import AnimatedCounter from './components/AnimatedCounter';
import DailyQuests from './components/DailyQuests';
import GradientText from './components/GradientText';
import GlowButton from './components/GlowButton';
import CrewShiftDetail from './CrewShiftDetail';

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
}
function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
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
      cannon();
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
    <div className="min-h-screen bg-[#0a0a14] text-white font-geist pb-24">
      {/* Header — cosmic with aurora blobs */}
      <header className="sticky top-0 z-30 overflow-hidden">
        <div className="absolute inset-0 bg-[#0a0a14]/80 backdrop-blur-2xl" />
        <div className="absolute -top-20 -right-12 w-56 h-56 bg-red-500/20 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-16 -left-12 w-48 h-48 bg-red-400/15 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

        <div className="relative max-w-md mx-auto px-5 pt-5 pb-4">
          <div className="flex items-center justify-between mb-4 gap-2">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/40">Hola</p>
                <p className="text-[20px] font-black leading-tight tracking-tight">
                  {worker?.name?.split(' ')[0] || 'Crew'}
                </p>
              </div>
              {worker?.streakDays > 0 && <StreakFlame days={worker.streakDays} size="sm" />}
            </div>
            <motion.div
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-red-500/20 to-red-600/15 border border-red-500/30"
              style={{ boxShadow: '0 4px 20px -4px rgba(239,68,68,0.3)' }}
            >
              <svg className="w-3.5 h-3.5 text-red-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l2.4 7.2H22l-6 4.4 2.3 7.2L12 16.4 5.7 20.8 8 13.6 2 9.2h7.6L12 2z"/></svg>
              <span className="text-[11px] font-bold text-white/70">Nivel</span>
              <span className="text-[15px] font-black text-white tabular-nums">
                <AnimatedCounter value={worker?.level || 1} duration={0.6} />
              </span>
            </motion.div>
          </div>

          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-white/40">Progreso</span>
            <span className="text-[10px] font-bold text-white/60 tabular-nums">
              <AnimatedCounter value={worker?.xp || 0} /> / {next} XP
            </span>
          </div>
          <div className="relative h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-600 via-red-500 to-red-400 rounded-full"
              style={{ boxShadow: '0 0 12px rgba(239,68,68,0.5)' }}
            />
            <motion.div
              animate={{ x: ['-100%', '400%'] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-y-0 w-1/5 bg-gradient-to-r from-transparent via-white/50 to-transparent"
            />
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-5 pt-5 space-y-5">
        <DailyQuests onRewardClaimed={refreshMe} />

        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-black text-white">
            Turnos <GradientText variant="sunrise">disponibles</GradientText>
          </h2>
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={load}
            className="text-[12px] font-bold text-white/40 hover:text-white/70 transition flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.15]"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Actualizar
          </motion.button>
        </div>

        {loading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 rounded-2xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
            ))}
          </div>
        )}

        {!loading && shifts.length === 0 && (
          <div className="text-center py-14 px-6 rounded-[28px] border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-white/25" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            </div>
            <p className="text-[15px] font-bold text-white/80">No hay turnos disponibles</p>
            <p className="text-[12px] text-white/35 mt-1.5 leading-relaxed">Vuelve más tarde. Te avisaremos cuando haya nuevas oportunidades.</p>
          </div>
        )}

        {!loading && shifts.length > 0 && (
          <div className="space-y-3.5">
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 200 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-[22px] border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm overflow-hidden hover:border-white/[0.14] transition-all"
      style={{ boxShadow: '0 4px 30px -8px rgba(0,0,0,0.4)' }}
    >
      {/* Cover */}
      <button onClick={onOpen} className="relative w-full h-36 block overflow-hidden">
        {cover ? (
          <img src={cover} alt={biz.businessName} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] to-[#16162a]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a14] via-[#0a0a14]/40 to-transparent" />

        {shift.isSOS && (
          <span className="absolute top-3 right-3 px-2.5 py-1 text-[10px] font-extrabold bg-red-500 text-white rounded-full shadow-[0_4px_16px_-2px_rgba(239,68,68,0.6)] animate-pulse">
            ⚡ Urgente
          </span>
        )}

        <div className="absolute bottom-3 left-3.5 right-3.5 flex items-end gap-2.5">
          <div className="w-11 h-11 rounded-xl border-2 border-white/20 shadow-lg overflow-hidden shrink-0 bg-[#0a0a14]">
            {logo ? (
              <img src={logo} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-[13px] font-black text-white">
                {(biz.businessName || 'M').slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 pb-0.5">
            <p className="text-[13px] font-extrabold text-white truncate drop-shadow-lg">{biz.businessName || 'Negocio'}</p>
            <p className="text-[10px] text-white/60 font-bold uppercase tracking-wider">{biz.businessType || 'Restaurante'}</p>
          </div>
        </div>
      </button>

      {/* Body */}
      <div className="p-4">
        <h3 className="text-[15px] font-black text-white leading-tight">{shift.title}</h3>
        <p className="text-[11px] text-white/40 font-medium mt-0.5">{ROLE_LABEL[shift.role] || shift.role}</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <Stat label="Fecha" value={formatDate(shift.date)} />
          <Stat label="Duración" value={`${shift.hoursTotal}h`} />
          <Stat label="Pago" value={formatCOP(shift.totalPay)} accent />
        </div>

        {/* Perks */}
        {(shift.perks || []).length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {(shift.perks || []).slice(0, 3).map((p) => (
              <span key={p} className="px-2 py-0.5 text-[10px] font-bold bg-white/[0.06] text-white/70 border border-white/[0.10] rounded-full capitalize">
                {p.replace(/_/g, ' ')}
              </span>
            ))}
            {(shift.perks || []).length > 3 && (
              <span className="text-[10px] font-bold text-white/25">+{(shift.perks || []).length - 3}</span>
            )}
          </div>
        )}

        {/* Match score */}
        {shift.matchScore != null && (
          <div className="flex items-center gap-2 mt-3">
            <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${shift.matchScore}%` }}
                transition={{ duration: 0.6, delay: index * 0.05 }}
                className={`h-full rounded-full ${shift.matchScore >= 70 ? 'bg-red-400' : shift.matchScore >= 50 ? 'bg-red-500/60' : 'bg-white/30'}`}
                style={{ boxShadow: shift.matchScore >= 70 ? '0 0 8px rgba(239,68,68,0.5)' : 'none' }}
              />
            </div>
            <span className={`text-[10px] font-bold tabular-nums ${shift.matchScore >= 70 ? 'text-red-400' : 'text-white/40'}`}>
              {shift.matchScore}%
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onOpen}
            className="px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.10] hover:bg-white/[0.10] text-white/70 hover:text-white font-bold text-[12px] transition-all flex items-center gap-1.5"
          >
            Ver más
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
          </motion.button>
          <GlowButton
            size="md"
            variant="primary"
            onClick={onApply}
            disabled={applying}
            className="flex-1"
          >
            {applying ? 'Enviando…' : 'Postularme'}
          </GlowButton>
        </div>
      </div>
    </TiltCard>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="px-2.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
      <p className="text-[9px] font-extrabold text-white/30 uppercase tracking-wider">{label}</p>
      <p className={`text-[12px] font-extrabold tabular-nums leading-tight mt-0.5 ${accent ? 'text-red-400' : 'text-white/90'}`}>{value}</p>
    </div>
  );
}
