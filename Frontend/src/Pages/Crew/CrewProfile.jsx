import { motion } from 'framer-motion';
import { useCrew } from './useCrew';

const BADGE_INFO = {
  first_shift: { label: 'First Shift', emoji: '🥇' },
  '10_shifts': { label: '10 Turnos', emoji: '🏃' },
  '100_hours': { label: '100 Horas', emoji: '💯' },
  perfect_week: { label: 'Perfect Week', emoji: '🎯' },
  night_owl: { label: 'Night Owl', emoji: '🌙' },
  early_bird: { label: 'Early Bird', emoji: '🌅' },
  punctual: { label: 'Puntual', emoji: '👼' },
  team_player: { label: 'Team Player', emoji: '🤝' },
  sos_hero: { label: 'SOS Hero', emoji: '🛟' },
  explorer: { label: 'Explorer', emoji: '🗺️' },
  loyal: { label: 'Loyal', emoji: '🏛️' },
};

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
}

function levelTier(level) {
  if (level >= 20) return { name: 'Legend', emoji: '👑' };
  if (level >= 10) return { name: 'Pro', emoji: '💎' };
  if (level >= 4) return { name: 'Crew', emoji: '🔥' };
  return { name: 'Rookie', emoji: '🐣' };
}

export default function CrewProfile() {
  const { worker, logout } = useCrew();
  if (!worker) return null;

  const xpForLevel = (n) => Math.pow(n - 1, 2) * 50;
  const curr = xpForLevel(worker.level || 1);
  const next = xpForLevel((worker.level || 1) + 1);
  const pct = Math.min(100, ((worker.xp - curr) / (next - curr)) * 100);
  const tier = levelTier(worker.level || 1);

  return (
    <div className="min-h-screen bg-[#0A0A14] text-white font-geist pb-24">
      {/* Hero */}
      <div className="relative px-5 pt-8 pb-6 overflow-hidden">
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#7B2FFF] opacity-20 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[260px] h-[260px] bg-[#FF6B35] opacity-15 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative flex items-start gap-4">
          {/* Avatar with ring */}
          <div className="relative shrink-0">
            <svg className="w-20 h-20 -rotate-90 absolute inset-0" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4"/>
              <motion.circle
                cx="40" cy="40" r="36" fill="none" stroke="url(#tier-grad)" strokeWidth="4" strokeLinecap="round"
                initial={{ strokeDasharray: 226, strokeDashoffset: 226 }}
                animate={{ strokeDashoffset: 226 - (226 * pct / 100) }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
              <defs>
                <linearGradient id="tier-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#7B2FFF"/>
                  <stop offset="100%" stopColor="#FF6B35"/>
                </linearGradient>
              </defs>
            </svg>
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#7B2FFF]/30 to-[#FF6B35]/30 flex items-center justify-center text-[28px] font-extrabold border border-white/[0.08]">
              {(worker.name || '?').slice(0, 1).toUpperCase()}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-[22px] font-extrabold leading-tight truncate">{worker.name}</h1>
            <p className="text-[12px] text-white/50">{worker.phone}</p>
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-[#7B2FFF]/25 to-[#FF6B35]/25 border border-[#7B2FFF]/30">
              <span>{tier.emoji}</span>
              <span className="text-[11px] font-extrabold">Nivel {worker.level} · {tier.name}</span>
            </div>
          </div>
        </div>

        {/* XP detail */}
        <div className="relative mt-5 p-4 bg-white/[0.04] border border-white/[0.06] rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-white/50 uppercase tracking-wider">Progreso a nivel {(worker.level || 1) + 1}</p>
            <p className="text-[12px] font-extrabold text-[#4CFFB8] tabular-nums">{worker.xp} / {next} XP</p>
          </div>
          <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-[#7B2FFF] to-[#FF6B35] rounded-full"
            />
          </div>
        </div>
      </div>

      <div className="px-5 space-y-5">
        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2.5">
          <StatBox label="Turnos" value={worker.stats?.shiftsCompleted || 0} emoji="🎯" />
          <StatBox label="Horas" value={`${worker.stats?.hoursWorked || 0}h`} emoji="⏱️" />
          <StatBox label="Ganado" value={formatCOP(worker.stats?.totalEarned || 0)} emoji="💰" small />
        </div>

        {/* Badges */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-extrabold">Badges</h2>
            <span className="text-[11px] text-white/40">{(worker.badgesEarned || []).length} desbloqueados</span>
          </div>
          {(worker.badgesEarned || []).length === 0 ? (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl py-6 text-center">
              <p className="text-[28px] mb-1">🔒</p>
              <p className="text-[12px] text-white/50">Completa tu primer turno para desbloquear</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2.5">
              {(worker.badgesEarned || []).map((b) => {
                const info = BADGE_INFO[b.key] || { label: b.key, emoji: '✨' };
                return (
                  <div key={b.key} className="aspect-square bg-gradient-to-br from-[#7B2FFF]/15 to-[#FF6B35]/15 border border-[#7B2FFF]/25 rounded-xl flex flex-col items-center justify-center p-1">
                    <span className="text-[24px]">{info.emoji}</span>
                    <p className="text-[9px] font-bold text-center mt-1 leading-tight">{info.label}</p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Skills */}
        {worker.skills?.length > 0 && (
          <section>
            <h2 className="text-[14px] font-extrabold mb-3">Mis skills</h2>
            <div className="flex flex-wrap gap-1.5">
              {worker.skills.map((s) => (
                <span key={s.key} className="px-2.5 py-1 text-[11px] font-bold bg-white/[0.05] border border-white/[0.08] rounded-full">
                  {s.key}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Wallet */}
        <section className="bg-gradient-to-br from-[#4CFFB8]/10 to-cyan-500/10 border border-[#4CFFB8]/25 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#4CFFB8]/80">Wallet MenuBy</p>
              <p className="text-[24px] font-extrabold tabular-nums mt-1">{formatCOP(worker.wallet?.balance || 0)}</p>
            </div>
            <span className="text-[40px]">💎</span>
          </div>
          <p className="text-[11px] text-white/50 mt-2 leading-relaxed">
            Gasta tu saldo en restaurantes MenuBy y recibe <strong>5% extra</strong>.
          </p>
        </section>

        <button
          onClick={logout}
          className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 font-bold text-[13px] hover:bg-red-500/20 transition mt-4"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

function StatBox({ label, value, emoji, small }) {
  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-3 text-center">
      <p className="text-[16px]">{emoji}</p>
      <p className={`font-extrabold tabular-nums mt-0.5 ${small ? 'text-[12px]' : 'text-[18px]'}`}>{value}</p>
      <p className="text-[9px] font-bold text-white/40 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}
