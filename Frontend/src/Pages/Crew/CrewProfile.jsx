import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useCrew } from './useCrew';
import AnimatedCounter from './components/AnimatedCounter';
import StreakFlame from './components/StreakFlame';
import BadgeReveal from './components/BadgeReveal';
import GradientText from './components/GradientText';
import CrewWithdrawModal from './components/CrewWithdrawModal';
import crewApi from '../../services/crewApi';

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
  if (level >= 20) return 'Senior';
  if (level >= 10) return 'Profesional';
  if (level >= 4) return 'Activo';
  return 'Nuevo';
}

export default function CrewProfile({ onEdit, onWallet, onFavorites, onHistory }) {
  const { worker, logout, refreshMe } = useCrew();
  const [revealBadge, setRevealBadge] = useState(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [txns, setTxns] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loadingFin, setLoadingFin] = useState(true);

  const loadFinance = useCallback(async () => {
    setLoadingFin(true);
    try {
      const [t, w] = await Promise.all([
        crewApi.get('/workers/me/wallet/transactions?limit=20'),
        crewApi.get('/workers/me/wallet/withdrawals'),
      ]);
      setTxns(t.data.transactions || []);
      setWithdrawals(w.data.withdrawals || []);
    } catch (e) { console.error(e); }
    finally { setLoadingFin(false); }
  }, []);

  useEffect(() => { loadFinance(); }, [loadFinance]);

  if (!worker) return null;

  const xpForLevel = (n) => Math.pow(n - 1, 2) * 50;
  const curr = xpForLevel(worker.level || 1);
  const next = xpForLevel((worker.level || 1) + 1);
  const pct = Math.min(100, ((worker.xp - curr) / (next - curr)) * 100);

  return (
    <div className="min-h-[100dvh] bg-[#0a0a14] text-white font-geist pb-[calc(7rem+env(safe-area-inset-bottom,0px))]">
      {/* Hero — cosmic with animated ring */}
      <div className="relative overflow-hidden">
        {/* Aurora blobs */}
        <div className="absolute -top-24 -left-16 w-64 h-64 bg-red-500/25 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -top-12 right-0 w-48 h-48 bg-red-400/15 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

        <div className="relative max-w-md mx-auto px-5 pt-[max(2rem,calc(0.5rem+env(safe-area-inset-top,0px)))] pb-6">
          {/* Edit button */}
          {onEdit && (
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={onEdit}
              className="absolute top-5 right-5 z-10 px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/[0.10] hover:bg-white/[0.10] text-white/60 hover:text-white text-[11px] font-bold transition-all flex items-center gap-1.5"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              Editar
            </motion.button>
          )}

          <div className="flex flex-col items-center text-center mb-5">
            {/* Avatar with animated ring */}
            <div className="relative w-24 h-24 mb-4">
              <svg className="w-24 h-24 -rotate-90 absolute inset-0" viewBox="0 0 96 96">
                <circle cx="48" cy="48" r="44" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4"/>
                <motion.circle
                  cx="48" cy="48" r="44" fill="none"
                  stroke="url(#crew-profile-ring)" strokeWidth="4" strokeLinecap="round"
                  initial={{ strokeDasharray: 276, strokeDashoffset: 276 }}
                  animate={{ strokeDashoffset: 276 - (276 * pct / 100) }}
                  transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                />
                <defs>
                  <linearGradient id="crew-profile-ring" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#EF4444"/>
                    <stop offset="50%" stopColor="#DC2626"/>
                    <stop offset="100%" stopColor="#FFFFFF"/>
                  </linearGradient>
                </defs>
              </svg>
              {/* Glow behind ring */}
              <div
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{ boxShadow: `0 0 ${20 + pct * 0.3}px -4px rgba(239,68,68,${0.15 + pct * 0.003})` }}
              />
              {worker.photo ? (
                <img src={worker.photo} alt="" className="absolute inset-[4px] w-[88px] h-[88px] rounded-full object-cover border-2 border-[#0a0a14]" />
              ) : (
                <div className="absolute inset-[4px] w-[88px] h-[88px] rounded-full bg-[#14142a] border-2 border-[#0a0a14] flex items-center justify-center text-[28px] font-black text-white/70">
                  {(worker.name || '?').slice(0, 1).toUpperCase()}
                </div>
              )}
              {/* Level badge floating */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.3 }}
                className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-red-500 to-red-600 text-[10px] font-black text-white shadow-[0_4px_12px_-2px_rgba(239,68,68,0.5)] border-2 border-[#0a0a14]"
              >
                {worker.level}
              </motion.div>
            </div>

            <h1 className="text-[22px] font-black leading-tight tracking-tight">{worker.name}</h1>
            <p className="text-[12px] text-white/40 mt-0.5">{worker.phone}</p>

            <div className="mt-3 flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-red-500/15 to-red-600/10 border border-red-500/30 text-[10px] font-extrabold text-white/80 uppercase tracking-wider">
                {levelTier(worker.level)}
              </span>
              {worker.streakDays > 0 && <StreakFlame days={worker.streakDays} size="sm" />}
            </div>
          </div>

          {/* XP bar */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-extrabold text-white/35 uppercase tracking-[0.12em]">Próximo nivel</p>
              <p className="text-[11px] font-bold text-white/60 tabular-nums">
                <AnimatedCounter value={worker.xp} /> / {next} XP
              </p>
            </div>
            <div className="relative h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
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
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 mt-5 space-y-5">
        {/* Stats */}
        <section>
          <h2 className="text-[10px] font-extrabold text-white/30 uppercase tracking-[0.15em] mb-2.5">Estadísticas</h2>
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
              label="Rating"
              value={worker.rating?.avg ? `${worker.rating.avg.toFixed(1)}★` : '—'}
              small
            />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <StatBox
              label="Ingresos"
              value={formatCOP(worker.stats?.totalEarned || 0)}
              small
            />
            <StatBox
              label="Puntualidad"
              value={`${worker.stats?.shiftsCompleted ? Math.max(0, Math.round(((worker.stats.shiftsCompleted - (worker.stats?.noShows || 0)) / worker.stats.shiftsCompleted) * 100)) : 100}%`}
              small
            />
            <StatBox
              label="Cancel."
              value={worker.stats?.cancellations || 0}
              small
            />
          </div>
        </section>

        {/* Reconocimientos */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-[10px] font-extrabold text-white/30 uppercase tracking-[0.15em]">Reconocimientos</h2>
            <span className="text-[11px] text-white/25 tabular-nums font-bold">{(worker.badgesEarned || []).length} obtenidos</span>
          </div>
          {(worker.badgesEarned || []).length === 0 ? (
            <div className="rounded-[22px] border border-white/[0.08] bg-white/[0.03] py-10 text-center backdrop-blur-sm">
              <p className="text-[13px] font-bold text-white/60">Aún no tienes reconocimientos</p>
              <p className="text-[11px] text-white/30 mt-1">Completa tu primer turno para empezar</p>
            </div>
          ) : (
            <div className="rounded-[22px] border border-white/[0.08] bg-white/[0.03] divide-y divide-white/[0.05] overflow-hidden backdrop-blur-sm">
              {(worker.badgesEarned || []).map((b, i) => (
                <motion.button
                  key={b.key}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setRevealBadge(b.key)}
                  className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-white/[0.04] transition"
                >
                  <motion.div
                    whileHover={{ rotate: [0, -5, 5, 0] }}
                    transition={{ duration: 0.4 }}
                    className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shrink-0"
                    style={{ boxShadow: '0 4px 16px -4px rgba(239,68,68,0.4)' }}
                  >
                    <svg className="w-4.5 h-4.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l2.4 7.2H22l-6 4.4 2.3 7.2L12 16.4 5.7 20.8 8 13.6 2 9.2h7.6L12 2z"/></svg>
                  </motion.div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-white/90">{BADGE_LABEL[b.key] || b.key}</p>
                    <p className="text-[10px] text-white/30">
                      {new Date(b.earnedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <svg className="w-3.5 h-3.5 text-white/15" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                </motion.button>
              ))}
            </div>
          )}
        </section>

        {/* Skills */}
        {worker.skills?.length > 0 && (
          <section>
            <h2 className="text-[10px] font-extrabold text-white/30 uppercase tracking-[0.15em] mb-2.5">Experiencia</h2>
            <div className="rounded-[22px] border border-white/[0.08] bg-white/[0.03] p-3.5 flex flex-wrap gap-1.5 backdrop-blur-sm">
              {worker.skills.map((s) => (
                <span key={s.key} className="px-2.5 py-1 text-[11px] font-bold bg-white/[0.06] text-white/70 border border-white/[0.08] rounded-full">
                  {s.key}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Wallet — saldo, escrow, retiro y movimientos */}
        <section>
          <h2 className="text-[10px] font-extrabold text-white/30 uppercase tracking-[0.15em] mb-2.5">Billetera Crew</h2>

          <div className="relative overflow-hidden rounded-[24px] border border-white/[0.08] p-5"
            style={{ background: 'radial-gradient(140% 100% at 0% 0%, rgba(16,185,129,0.18) 0%, rgba(10,10,20,0.6) 60%)' }}
          >
            <motion.div
              animate={{ x: [0, 20, 0], y: [0, -10, 0] }}
              transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-20 -right-10 w-72 h-72 bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none"
            />
            <div className="relative">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/40">Disponible para retirar</p>
              <p className="text-[34px] font-black tabular-nums leading-none mt-1">
                <GradientText variant="sunrise">{formatCOP(worker.wallet?.balance || 0)}</GradientText>
              </p>

              {(worker.wallet?.pendingBalance || 0) > 0 && (
                <p className="text-[11px] text-amber-200/70 mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/[0.12] border border-amber-400/30">
                  🔒 <span className="tabular-nums">{formatCOP(worker.wallet.pendingBalance)}</span> en proceso de retiro
                </p>
              )}

              <div className="mt-4 flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setWithdrawOpen(true)}
                  disabled={(worker.wallet?.balance || 0) < 20000}
                  className="group relative flex-1 overflow-hidden rounded-2xl px-5 py-3 font-extrabold text-white bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/40 disabled:opacity-40"
                >
                  <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
                    style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 100%)' }} />
                  <span className="relative text-[13px] flex items-center justify-center gap-2">
                    🏦 Retirar
                  </span>
                </motion.button>
                {onWallet && (
                  <button
                    onClick={onWallet}
                    className="px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/[0.08] text-white/70 hover:text-white text-[12px] font-bold transition"
                  >
                    Más
                  </button>
                )}
              </div>
              <p className="text-[10px] text-white/30 mt-3 leading-relaxed">
                Retiro mínimo $20.000. Llega a Nequi, Daviplata o tu cuenta bancaria en menos de 24h.
              </p>
            </div>
          </div>

          {/* Movimientos */}
          {(txns.length > 0 || withdrawals.length > 0) && (
            <div className="mt-3 rounded-[22px] border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm">
              <div className="px-4 pt-3.5 pb-2 flex items-center justify-between">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-white/40">Movimientos recientes</p>
                {loadingFin && <span className="text-[10px] text-white/30">Cargando…</span>}
              </div>
              <div className="px-3 pb-2">
                {withdrawals.filter(w => w.status === 'pending').slice(0, 2).map((w) => (
                  <WithdrawalRow key={w._id} req={w} />
                ))}
                {txns.slice(0, 8).map((t) => <WorkerTxnRow key={t._id} txn={t} />)}
              </div>
            </div>
          )}
        </section>

        {/* Quick access menu */}
        <section>
          <h2 className="text-[10px] font-extrabold text-white/30 uppercase tracking-[0.15em] mb-2.5">Accesos</h2>
          <div className="rounded-[22px] border border-white/[0.08] bg-white/[0.03] divide-y divide-white/[0.05] overflow-hidden backdrop-blur-sm">
            {[
              { label: 'Mis Favoritos', desc: 'Restaurantes guardados', icon: '❤️', action: onFavorites },
              { label: 'Historial Laboral', desc: 'Tu hoja de vida Crew', icon: '📋', action: onHistory },
            ].map((item) => (
              <motion.button
                key={item.label}
                whileTap={{ scale: 0.98 }}
                onClick={item.action}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-white/[0.04] transition"
              >
                <span className="text-[18px]">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-white/90">{item.label}</p>
                  <p className="text-[10px] text-white/30">{item.desc}</p>
                </div>
                <svg className="w-3.5 h-3.5 text-white/15" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </motion.button>
            ))}
          </div>
        </section>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={logout}
          className="w-full py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/40 font-bold text-[13px] hover:bg-white/[0.06] hover:text-white/60 transition-all"
        >
          Cerrar sesión
        </motion.button>
      </div>

      {revealBadge && <BadgeReveal badgeKey={revealBadge} onClose={() => setRevealBadge(null)} />}

      <CrewWithdrawModal
        open={withdrawOpen}
        wallet={worker.wallet}
        defaultPayoutMethod={worker.payoutMethod}
        onClose={() => setWithdrawOpen(false)}
        onSuccess={() => { setWithdrawOpen(false); refreshMe(); loadFinance(); }}
      />
    </div>
  );
}

function WorkerTxnRow({ txn }) {
  const labels = {
    shift_release: { label: 'Pago de turno', emoji: '✅', tone: 'text-emerald-300' },
    withdrawal_request: { label: 'Retiro solicitado', emoji: '🔒', tone: 'text-amber-300' },
    withdrawal_paid: { label: 'Retiro pagado', emoji: '🏦', tone: 'text-emerald-300' },
    withdrawal_rejected: { label: 'Retiro devuelto', emoji: '↩️', tone: 'text-sky-300' },
    adjustment: { label: 'Ajuste', emoji: '⚙️', tone: 'text-white/70' },
  };
  const info = labels[txn.kind] || { label: txn.kind, emoji: '•', tone: 'text-white/70' };
  const sign = txn.direction === 'in' ? '+' : '-';
  const date = new Date(txn.createdAt);
  const counterpart = txn.counterpartId?.businessName || txn.shiftId?.title;
  return (
    <div className="flex items-center justify-between gap-2 py-2 px-1 border-b border-white/[0.04] last:border-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-base">{info.emoji}</span>
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-white truncate">{info.label}</p>
          <p className="text-[10px] text-white/40 truncate">
            {counterpart ? counterpart : date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
          </p>
        </div>
      </div>
      <span className={`text-[12.5px] font-black tabular-nums ${info.tone}`}>{sign}{formatCOP(txn.amount)}</span>
    </div>
  );
}

function WithdrawalRow({ req }) {
  return (
    <div className="flex items-center justify-between gap-2 py-2 px-1 border-b border-white/[0.04]">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-base">⏳</span>
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-white truncate">Retiro en revisión</p>
          <p className="text-[10px] text-white/40 truncate capitalize">{req.payoutMethod?.type} · {req.payoutMethod?.accountInfo}</p>
        </div>
      </div>
      <span className="text-[12.5px] font-black tabular-nums text-amber-300">{formatCOP(req.amount)}</span>
    </div>
  );
}

function StatBox({ label, value, suffix, small }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5 text-center backdrop-blur-sm">
      <p className={`font-black tabular-nums text-white ${small ? 'text-[13px]' : 'text-[20px]'}`}>
        {value}{suffix && <span className="text-[12px] text-white/40 ml-0.5">{suffix}</span>}
      </p>
      <p className="text-[9px] font-extrabold text-white/25 uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}
