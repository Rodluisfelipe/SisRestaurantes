/**
 * CrewWallet — pantalla expandida de billetera del worker.
 *
 * El historial se construye desde el ledger real (`CrewWalletTxn`), no desde
 * `ShiftBooking.completed`. Así nunca muestra "ingresos fantasma" cuando un
 * turno se marca completed pero el release no terminó.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import crewApi from '../../services/crewApi';
import CrewWithdrawModal from './components/CrewWithdrawModal';
import { useCrew } from './useCrew';

const formatCOP = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

export default function CrewWallet({ onBack }) {
  const { refreshMe } = useCrew();
  const [wallet, setWallet] = useState(null);
  const [payoutMethod, setPayoutMethod] = useState(null);
  const [txns, setTxns] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [w, t, wd] = await Promise.all([
        crewApi.get('/workers/me/wallet'),
        crewApi.get('/workers/me/wallet/transactions?limit=50'),
        crewApi.get('/workers/me/wallet/withdrawals'),
      ]);
      setWallet(w.data?.wallet || null);
      setPayoutMethod(w.data?.payoutMethod || null);
      setTxns(t.data?.transactions || []);
      setWithdrawals(wd.data?.withdrawals || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pendingWithdrawals = withdrawals.filter((w) => w.status === 'pending');

  return (
    <div className="min-h-[100dvh] bg-[#0a0a14] text-white font-geist pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0a0a14]/80 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="max-w-md mx-auto px-5 pt-[max(1.25rem,env(safe-area-inset-top,0px))] pb-4 flex items-center gap-3">
          <button onClick={onBack} className="text-white/50 hover:text-white transition" aria-label="Atrás">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <h1 className="text-[18px] font-extrabold text-white">Mi Billetera</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-5 pt-6 space-y-6">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-32 rounded-2xl bg-white/[0.04]" />
            <div className="h-20 rounded-2xl bg-white/[0.04]" />
          </div>
        ) : (
          <>
            {/* Balance card */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-red-500/10 via-[#0f0f1a] to-[#0a0a14] p-6"
            >
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-red-500/20 rounded-full blur-[60px]" />
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/40 mb-1">Saldo disponible</p>
              <p className="text-[32px] font-black text-white leading-tight">{formatCOP(wallet?.balance)}</p>
              {wallet?.pendingBalance > 0 && (
                <p className="text-[12px] text-white/50 mt-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-yellow-400/80 mr-1.5" />
                  En proceso de retiro: {formatCOP(wallet.pendingBalance)}
                </p>
              )}
            </motion.div>

            {/* Withdraw button — real, conectado al modal */}
            <motion.button
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              onClick={() => setWithdrawOpen(true)}
              disabled={(wallet?.balance || 0) < 20000}
              className="group relative w-full overflow-hidden py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-extrabold text-[14px] shadow-lg shadow-emerald-500/40 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.97] transition"
            >
              <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
                style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 100%)' }} />
              <svg className="relative w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
              <span className="relative">{(wallet?.balance || 0) < 20000 ? 'Mínimo $20.000 para retirar' : 'Retirar saldo'}</span>
            </motion.button>

            {/* Withdrawals pendientes (info al worker) */}
            {pendingWithdrawals.length > 0 && (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-500/[0.08] p-4 space-y-2">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-amber-200">Retiros en proceso</p>
                {pendingWithdrawals.map((w) => (
                  <div key={w._id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-white capitalize">{w.payoutMethod?.type} · {w.payoutMethod?.accountInfo}</p>
                      <p className="text-[10px] text-white/40">Solicitado {new Date(w.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <span className="text-[14px] font-extrabold tabular-nums text-amber-200">{formatCOP(w.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Movimientos REALES desde el ledger */}
            <div>
              <h2 className="text-[13px] font-bold text-white/50 uppercase tracking-wider mb-3">Movimientos</h2>
              {txns.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-12 h-12 mx-auto rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-white/25" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  </div>
                  <p className="text-[13px] text-white/40">Aún no tienes movimientos</p>
                  <p className="text-[11px] text-white/25 mt-1">Cuando un negocio confirme un turno tuyo, el pago aparecerá acá.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {txns.map((t, i) => <TxnRow key={t._id} txn={t} index={i} />)}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <CrewWithdrawModal
        open={withdrawOpen}
        wallet={wallet}
        defaultPayoutMethod={payoutMethod}
        onClose={() => setWithdrawOpen(false)}
        onSuccess={() => { setWithdrawOpen(false); refreshMe(); load(); }}
      />
    </div>
  );
}

function TxnRow({ txn, index }) {
  const labels = {
    shift_release: { label: 'Pago de turno', emoji: '✅', tone: 'text-emerald-300', dot: 'bg-emerald-500/10 border-emerald-400/30' },
    withdrawal_request: { label: 'Retiro solicitado', emoji: '🔒', tone: 'text-amber-300', dot: 'bg-amber-500/10 border-amber-400/30' },
    withdrawal_paid: { label: 'Retiro pagado', emoji: '🏦', tone: 'text-sky-300', dot: 'bg-sky-500/10 border-sky-400/30' },
    withdrawal_rejected: { label: 'Retiro devuelto', emoji: '↩️', tone: 'text-violet-300', dot: 'bg-violet-500/10 border-violet-400/30' },
    adjustment: { label: 'Ajuste', emoji: '⚙️', tone: 'text-white/70', dot: 'bg-white/[0.06] border-white/[0.08]' },
  };
  const info = labels[txn.kind] || { label: txn.kind, emoji: '•', tone: 'text-white/70', dot: 'bg-white/[0.06] border-white/[0.08]' };
  const sign = txn.direction === 'in' ? '+' : '−';
  const counterpart = txn.counterpartId?.businessName;
  const subtitle = counterpart || txn.shiftId?.title || txn.note;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
    >
      <div className={`w-9 h-9 rounded-full border flex items-center justify-center flex-shrink-0 ${info.dot}`}>
        <span className="text-base">{info.emoji}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-white truncate">{info.label}</p>
        <p className="text-[11px] text-white/40 truncate">
          {subtitle && <>{subtitle} · </>}
          {new Date(txn.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
        </p>
      </div>
      <span className={`text-[13px] font-extrabold tabular-nums ${info.tone}`}>{sign}{formatCOP(txn.amount)}</span>
    </motion.div>
  );
}
