import { useState } from 'react';
import { motion } from 'framer-motion';
import { useCrew } from './useCrew';
import AnimatedCounter from './components/AnimatedCounter';
import StreakFlame from './components/StreakFlame';
import BadgeReveal from './components/BadgeReveal';

const BADGE_LABEL = {
  first_shift: 'Primer turno',
  '10_shifts': '10 turnos completados',
  '100_hours': '100 horas trabajadas',
  perfect_week: 'Semana sin faltas',
  night_owl: 'Turnos nocturnos',
  early_bird: 'Turnos matutinos',
  punctual: 'Puntualidad',
  team_player: 'Buen equipo',
  sos_hero: 'Disponibilidad inmediata',
  explorer: 'Múltiples negocios',
  loyal: 'Negocio recurrente',
};

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
}

function levelTier(level) {
  if (level >= 20) return 'Profesional Senior';
  if (level >= 10) return 'Profesional';
  if (level >= 4) return 'Trabajador activo';
  return 'Nuevo';
}

export default function CrewProfile({ onEdit }) {
  const { worker, logout } = useCrew();
  const [revealBadge, setRevealBadge] = useState(null);
  if (!worker) return null;

  const xpForLevel = (n) => Math.pow(n - 1, 2) * 50;
  const curr = xpForLevel(worker.level || 1);
  const next = xpForLevel((worker.level || 1) + 1);
  const pct = Math.min(100, ((worker.xp - curr) / (next - curr)) * 100);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-geist pb-24">
      {/* Hero */}
      <div className="bg-white border-b border-slate-200">
        <div className="relative max-w-md mx-auto px-5 pt-6 pb-5">
          {/* Edit button */}
          {onEdit && (
            <button
              onClick={onEdit}
              className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              Editar
            </button>
          )}

          <div className="flex items-start gap-4 mb-5">
            <div className="relative shrink-0">
              <svg className="w-20 h-20 -rotate-90 absolute inset-0" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="36" fill="none" stroke="#F1F5F9" strokeWidth="4"/>
                <motion.circle
                  cx="40" cy="40" r="36" fill="none"
                  stroke="url(#crew-ring-grad)" strokeWidth="4" strokeLinecap="round"
                  initial={{ strokeDasharray: 226, strokeDashoffset: 226 }}
                  animate={{ strokeDashoffset: 226 - (226 * pct / 100) }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
                <defs>
                  <linearGradient id="crew-ring-grad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#EF4444"/>
                    <stop offset="100%" stopColor="#DC2626"/>
                  </linearGradient>
                </defs>
              </svg>
              {worker.photo ? (
                <img src={worker.photo} alt="" className="w-20 h-20 rounded-full object-cover border border-slate-200" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[24px] font-extrabold text-slate-700">
                  {(worker.name || '?').slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-[18px] font-extrabold leading-tight truncate">{worker.name}</h1>
              <p className="text-[12px] text-slate-500 mt-0.5">{worker.phone}</p>
              <div className="mt-2 inline-flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-red-500 to-red-600 text-white text-[10px] font-bold uppercase tracking-wider shadow-md shadow-red-500/30">
                  Nivel {worker.level} · {levelTier(worker.level)}
                </span>
                {worker.streakDays > 0 && <StreakFlame days={worker.streakDays} size="sm" />}
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Próximo nivel</p>
              <p className="text-[11px] font-extrabold text-slate-800 tabular-nums">
                <AnimatedCounter value={worker.xp} /> / {next} XP
              </p>
            </div>
            <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-500 via-red-500 to-red-600 rounded-full"
              />
              <motion.div
                animate={{ x: ['-100%', '300%'] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-white/70 to-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 mt-5 space-y-5">
        {/* Stats */}
        <section>
          <h2 className="text-[12px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">Estadísticas</h2>
          <div className="grid grid-cols-3 gap-2">
            <StatBox
              label="Turnos"
              value={<AnimatedCounter value={worker.stats?.shiftsCompleted || 0} duration={1.4} />}
            />
            <StatBox
              label="Horas"
              value={<><AnimatedCounter value={worker.stats?.hoursWorked || 0} duration={1.4} /></>}
              suffix="h"
            />
            <StatBox
              label="Ingresos"
              value={formatCOP(worker.stats?.totalEarned || 0)}
              small
            />
          </div>
        </section>

        {/* Reconocimientos */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Reconocimientos</h2>
            <span className="text-[11px] text-slate-400 tabular-nums">{(worker.badgesEarned || []).length} obtenidos</span>
          </div>
          {(worker.badgesEarned || []).length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl py-8 text-center">
              <p className="text-[13px] font-bold text-slate-600">Aún no tienes reconocimientos</p>
              <p className="text-[11px] text-slate-400 mt-1">Completa tu primer turno para empezar a obtenerlos</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
              {(worker.badgesEarned || []).map((b, i) => (
                <motion.button
                  key={b.key}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setRevealBadge(b.key)}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 transition"
                >
                  <motion.div
                    whileHover={{ rotate: [0, -5, 5, 0] }}
                    transition={{ duration: 0.4 }}
                    className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0 shadow-md shadow-amber-500/25"
                  >
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l2.4 7.2H22l-6 4.4 2.3 7.2L12 16.4 5.7 20.8 8 13.6 2 9.2h7.6L12 2z"/></svg>
                  </motion.div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-slate-800">{BADGE_LABEL[b.key] || b.key}</p>
                    <p className="text-[10px] text-slate-400">
                      Obtenido el {new Date(b.earnedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <svg className="w-3.5 h-3.5 text-slate-300" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                </motion.button>
              ))}
            </div>
          )}
        </section>

        {/* Skills */}
        {worker.skills?.length > 0 && (
          <section>
            <h2 className="text-[12px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">Áreas de experiencia</h2>
            <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-wrap gap-1.5">
              {worker.skills.map((s) => (
                <span key={s.key} className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 rounded-full">
                  {s.key}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Wallet */}
        <section>
          <h2 className="text-[12px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">Saldo disponible</h2>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-slate-500">Saldo en wallet MenuBy</p>
                <p className="text-[22px] font-extrabold tabular-nums text-slate-900 mt-0.5">{formatCOP(worker.wallet?.balance || 0)}</p>
              </div>
              <button className="px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-[12px] font-bold text-slate-700 hover:bg-slate-200 transition">
                Retirar
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
              Usa tu saldo en restaurantes de la red MenuBy y recibe un 5% adicional como bonificación.
            </p>
          </div>
        </section>

        <button
          onClick={logout}
          className="w-full py-3 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold text-[13px] hover:bg-slate-50 hover:text-slate-900 transition"
        >
          Cerrar sesión
        </button>
      </div>

      {revealBadge && <BadgeReveal badgeKey={revealBadge} onClose={() => setRevealBadge(null)} />}
    </div>
  );
}

function StatBox({ label, value, suffix, small }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3 text-center">
      <p className={`font-extrabold tabular-nums text-slate-900 ${small ? 'text-[13px]' : 'text-[18px]'}`}>
        {value}{suffix && <span className="text-[12px] text-slate-500 ml-0.5">{suffix}</span>}
      </p>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}
