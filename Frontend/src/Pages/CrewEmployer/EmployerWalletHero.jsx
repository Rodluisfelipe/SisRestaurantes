/**
 * EmployerWalletHero — card de saldo para el dashboard del empleador.
 * Estilo claro (MenuBy light theme).
 */
import { motion } from 'framer-motion';

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
}

function AnimatedNumber({ value }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      {formatCOP(value)}
    </motion.span>
  );
}

export default function EmployerWalletHero({ wallet, loading, onRecharge }) {
  const balance = wallet?.balance || 0;
  const pending = wallet?.pendingBalance || 0;
  const lowBalance = balance < 50000;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
            Billetera Crew
          </p>
          <div className="flex items-center gap-2 mt-1">
            <h2 className="text-[14px] font-black text-slate-800">Saldo disponible</h2>
            {lowBalance && (
              <span className="px-2 py-0.5 text-[9px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 rounded-full uppercase tracking-wider">
                Saldo bajo
              </span>
            )}
          </div>
        </div>
        <div className="w-9 h-9 rounded-xl bg-red-500 flex items-center justify-center shadow-md shadow-red-500/25">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
          </svg>
        </div>
      </div>

      {/* Balance */}
      <div className="mb-4">
        {loading ? (
          <div className="h-10 w-44 bg-slate-100 rounded-xl animate-pulse" />
        ) : (
          <p className="text-[36px] font-black leading-none text-slate-900">
            <AnimatedNumber value={balance} />
          </p>
        )}
      </div>

      {/* Escrow pill */}
      {pending > 0 && (
        <div className="mb-4 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
          <span className="text-[11px] font-bold text-amber-700">En escrow (turnos activos)</span>
          <span className="text-[13px] font-black text-amber-700 tabular-nums">{formatCOP(pending)}</span>
        </div>
      )}

      {/* CTA */}
      <motion.button
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.97 }}
        onClick={onRecharge}
        className="w-full rounded-2xl px-5 py-3 font-extrabold text-[13px] text-white bg-red-500 hover:bg-red-600 shadow-md shadow-red-500/25 transition"
      >
        <span className="flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.6} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Recargar billetera
        </span>
      </motion.button>
    </div>
  );
}
