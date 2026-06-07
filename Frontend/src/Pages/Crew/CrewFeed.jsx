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
  return date.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
}

const SKILL_EMOJI = {
  mesero: '🍽️', cocinero: '👨‍🍳', barista: '☕', cajero: '💵', runner: '🏃',
  lavaplatos: '🧽', host: '🙋', recepcionista: '📋', bartender: '🍸', parrillero: '🔥',
  panadero: '🥖', reposteria: '🧁', limpieza: '✨', eventos: '🎉', delivery: '🛵',
};

export default function CrewFeed() {
  const { worker, logout, refreshMe } = useCrew();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(null);
  const [confetti, setConfetti] = useState(false);

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
      setConfetti(true);
      setTimeout(() => setConfetti(false), 1500);
    } catch (e) {
      alert(e?.response?.data?.message || 'Error al aplicar');
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A14] text-white font-geist pb-24">
      {/* Header con stats del worker */}
      <header className="sticky top-0 z-30 px-5 pt-5 pb-3 bg-[#0A0A14]/85 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">Hola</p>
            <p className="text-[20px] font-extrabold leading-tight">{worker?.name?.split(' ')[0] || 'Crew'} 👋</p>
          </div>
          <button
            onClick={logout}
            className="w-9 h-9 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-white/40 hover:text-white transition"
            aria-label="Logout"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"/></svg>
          </button>
        </div>

        {/* XP bar */}
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7B2FFF] to-[#FF6B35] flex items-center justify-center text-[11px] font-extrabold shadow-[0_4px_12px_rgba(123,47,255,0.4)]">
            {worker?.level || 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Nivel {worker?.level || 1}</span>
              <span className="text-[10px] font-bold text-[#4CFFB8] tabular-nums">{worker?.xp || 0} XP</span>
            </div>
            <XPBar xp={worker?.xp || 0} level={worker?.level || 1} />
          </div>
        </div>
      </header>

      <main className="px-5 pt-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[18px] font-extrabold">Turnos para ti 🎯</h2>
          <button onClick={load} className="text-[12px] font-bold text-[#7B2FFF] hover:text-[#FF6B35] transition">
            Refrescar
          </button>
        </div>

        {loading && (
          <div className="space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-44 bg-white/[0.03] border border-white/[0.06] rounded-2xl" />
            ))}
          </div>
        )}

        {!loading && shifts.length === 0 && (
          <div className="text-center py-16 px-6 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
            <p className="text-[40px] mb-2">😴</p>
            <p className="text-[15px] font-bold text-white/80">Capi está durmiendo</p>
            <p className="text-[12px] text-white/40 mt-1">No hay turnos cerca por ahora. Vuelve más tarde.</p>
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

      {/* Confetti on apply */}
      <AnimatePresence>
        {confetti && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            transition={{ type: 'spring', damping: 12 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <div className="text-center">
              <p className="text-[80px]">🎉</p>
              <p className="text-[18px] font-extrabold bg-gradient-to-r from-[#7B2FFF] to-[#FF6B35] bg-clip-text text-transparent">¡Aplicaste!</p>
              <p className="text-[12px] text-white/60 mt-1">Te avisaremos si te toman</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function XPBar({ xp, level }) {
  const xpForLevel = (n) => Math.pow(n - 1, 2) * 50;
  const curr = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const pct = Math.min(100, ((xp - curr) / (next - curr)) * 100);
  return (
    <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="h-full bg-gradient-to-r from-[#7B2FFF] to-[#FF6B35] rounded-full"
      />
    </div>
  );
}

function ShiftCard({ shift, index, onApply, applying }) {
  const emoji = SKILL_EMOJI[shift.role] || '💼';
  const biz = shift.businessId || {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 300 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="relative bg-gradient-to-br from-white/[0.04] to-white/[0.02] border border-white/[0.08] rounded-2xl p-4 overflow-hidden"
    >
      {/* SOS pill */}
      {shift.isSOS && (
        <span className="absolute top-3 right-3 px-2 py-0.5 text-[10px] font-extrabold bg-red-500 text-white rounded-full animate-pulse">
          🚨 SOS
        </span>
      )}

      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#7B2FFF]/30 to-[#FF6B35]/30 flex items-center justify-center text-[22px] shrink-0">
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-extrabold leading-tight truncate">{shift.title}</h3>
          <p className="text-[12px] text-white/50 truncate">{biz.businessName || 'Negocio'}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <Stat label="Cuándo" value={formatDate(shift.date)} />
        <Stat label="Horas" value={`${shift.hoursTotal}h`} />
        <Stat label="Pago" value={formatCOP(shift.totalPay)} highlight />
      </div>

      {/* Perks */}
      {shift.perks?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {shift.perks.slice(0, 3).map((p) => (
            <span key={p} className="px-2 py-0.5 text-[10px] font-bold text-[#4CFFB8] bg-[#4CFFB8]/10 border border-[#4CFFB8]/20 rounded-full">
              {p.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={onApply}
        disabled={applying}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-[#7B2FFF] to-[#FF6B35] text-white font-bold text-[14px] shadow-[0_6px_20px_rgba(123,47,255,0.3)] active:scale-95 transition-all disabled:opacity-50"
      >
        {applying ? 'Aplicando…' : 'Aplicar 🚀'}
      </button>

      {shift.matchScore != null && (
        <p className="text-center text-[10px] text-white/35 mt-2">
          Match contigo: <span className={`font-bold ${shift.matchScore >= 70 ? 'text-[#4CFFB8]' : 'text-white/60'}`}>{shift.matchScore}%</span>
        </p>
      )}
    </motion.div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className="px-2 py-2 bg-white/[0.04] border border-white/[0.06] rounded-lg">
      <p className="text-[9px] font-bold text-white/40 uppercase tracking-wider">{label}</p>
      <p className={`text-[12px] font-extrabold tabular-nums leading-tight mt-0.5 ${highlight ? 'text-[#4CFFB8]' : ''}`}>{value}</p>
    </div>
  );
}
