/**
 * CrewWalletCard — la card hero del panel del negocio.
 *
 * Muestra el saldo, lo que está reservado en escrow, lo gastado histórico y
 * un botón gigantesco para recargar. Estética cosmic, gradient rojo, glow.
 */
import { motion } from 'framer-motion';

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
}

function AnimatedNumber({ value, prefix = '' }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="inline-block tabular-nums"
    >
      {prefix}{formatCOP(value)}
    </motion.span>
  );
}

export default function CrewWalletCard({ wallet, onRecharge, loading }) {
  const balance = wallet?.balance || 0;
  const pending = wallet?.pendingBalance || 0;
  const totalSpent = wallet?.totalSpent || 0;
  const totalCommission = wallet?.totalCommissionPaid || 0;
  const totalReserved = wallet?.totalReserved || 0;
  const lowBalance = balance < 50000;

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/[0.08]"
      style={{
        background: 'radial-gradient(140% 100% at 0% 0%, #1a0b18 0%, #0a0a14 60%, #0a0a14 100%)',
      }}
    >
      {/* Aurora blobs */}
      <motion.div
        animate={{ x: [0, 20, 0], y: [0, -10, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-20 -right-10 w-80 h-80 bg-red-500/30 rounded-full blur-[100px] pointer-events-none"
      />
      <motion.div
        animate={{ x: [0, -15, 0], y: [0, 15, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -bottom-24 -left-12 w-72 h-72 bg-orange-500/20 rounded-full blur-[100px] pointer-events-none"
      />

      {/* Grid sutil */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, black 30%, transparent 80%)',
        }}
      />

      <div className="relative p-6 sm:p-7">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/40">
              Billetera Crew
            </p>
            <div className="flex items-center gap-2 mt-1">
              <h2 className="text-[15px] font-black text-white">Saldo disponible</h2>
              {lowBalance && (
                <motion.span
                  animate={{ scale: [1, 1.04, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="px-2 py-0.5 text-[9px] font-extrabold bg-amber-500/15 text-amber-300 border border-amber-400/30 rounded-full uppercase tracking-wider"
                >
                  Saldo bajo
                </motion.span>
              )}
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-[0_8px_24px_-6px_rgba(239,68,68,0.6)]">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
          </div>
        </div>

        {/* Saldo gigante */}
        <div className="mb-5">
          {loading ? (
            <div className="h-12 w-48 bg-white/[0.06] rounded-xl animate-pulse" />
          ) : (
            <p className="text-[40px] sm:text-[48px] font-black leading-none text-white">
              <AnimatedNumber value={balance} />
            </p>
          )}
        </div>

        {/* CTA recargar */}
        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97 }}
          onClick={onRecharge}
          className="group relative w-full overflow-hidden rounded-2xl px-5 py-3.5 font-extrabold text-[14px] text-white bg-gradient-to-r from-red-500 via-red-500 to-orange-500 shadow-[0_12px_32px_-8px_rgba(239,68,68,0.55)] hover:shadow-[0_16px_40px_-8px_rgba(239,68,68,0.7)] transition-shadow"
        >
          {/* Highlight superior */}
          <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-[inherit]"
            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 100%)' }} />
          {/* Shine */}
          <span aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-white/0 via-white/40 to-white/0 transition-transform duration-700 ease-out group-hover:translate-x-[400%]" />
          <span className="relative flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.6} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Recargar billetera
          </span>
        </motion.button>

        {/* Stats grid */}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <StatBlock
            label="En escrow"
            value={pending}
            tone="amber"
            hint="Reservado en turnos activos"
            icon={
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            }
          />
          <StatBlock
            label="Pagado a trabajadores"
            value={totalSpent}
            tone="emerald"
            hint="Histórico"
            icon={
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatBlock
            label="Reservado total"
            value={totalReserved}
            tone="sky"
            hint="Histórico"
            icon={
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
              </svg>
            }
          />
          <StatBlock
            label="Comisión Crew"
            value={totalCommission}
            tone="violet"
            hint="Lo que has invertido en la plataforma"
            icon={
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l2 2 4-4m-9 7h12" />
              </svg>
            }
          />
        </div>
      </div>
    </div>
  );
}

function StatBlock({ label, value, hint, icon, tone }) {
  const tones = {
    amber: { text: 'text-amber-300', bg: 'bg-amber-500/[0.08]', border: 'border-amber-400/20' },
    emerald: { text: 'text-emerald-300', bg: 'bg-emerald-500/[0.08]', border: 'border-emerald-400/20' },
    sky: { text: 'text-sky-300', bg: 'bg-sky-500/[0.08]', border: 'border-sky-400/20' },
    violet: { text: 'text-violet-300', bg: 'bg-violet-500/[0.08]', border: 'border-violet-400/20' },
  };
  const t = tones[tone] || tones.sky;
  return (
    <div className={`relative rounded-2xl p-3 border ${t.border} ${t.bg} backdrop-blur-sm`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`flex items-center gap-1 text-[9.5px] font-extrabold uppercase tracking-wider ${t.text}`}>
          {icon}
          {label}
        </span>
      </div>
      <p className="text-[15px] font-black text-white tabular-nums leading-tight">
        {formatCOP(value)}
      </p>
      {hint && <p className="text-[9.5px] text-white/40 mt-0.5">{hint}</p>}
    </div>
  );
}
