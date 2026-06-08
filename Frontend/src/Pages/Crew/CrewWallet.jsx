/**
 * CrewWallet — pantalla expandida de billetera.
 * Muestra saldo, pendiente, historial de movimientos, y placeholder de retiro.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import crewApi from '../../services/crewApi';

const formatCOP = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

export default function CrewWallet({ onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data: res } = await crewApi.get('/workers/me/wallet');
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-[100dvh] bg-[#0a0a14] text-white font-geist pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
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
              <p className="text-[32px] font-black text-white leading-tight">{formatCOP(data?.wallet?.balance)}</p>
              {data?.wallet?.pendingBalance > 0 && (
                <p className="text-[12px] text-white/50 mt-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-yellow-400/80 mr-1.5" />
                  Pendiente: {formatCOP(data.wallet.pendingBalance)}
                </p>
              )}
            </motion.div>

            {/* Withdraw button (placeholder) */}
            <motion.button
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="w-full py-3.5 rounded-2xl bg-white/[0.06] border border-white/[0.08] text-white/70 font-bold text-[14px] flex items-center justify-center gap-2 active:scale-[0.97] transition"
            >
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
              Retirar a cuenta bancaria
            </motion.button>

            {/* Movements */}
            <div>
              <h2 className="text-[13px] font-bold text-white/50 uppercase tracking-wider mb-3">Historial</h2>
              {(!data?.movements || data.movements.length === 0) ? (
                <div className="text-center py-10">
                  <div className="w-12 h-12 mx-auto rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-white/25" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  </div>
                  <p className="text-[13px] text-white/40">Aún no tienes movimientos</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {data.movements.map((m, i) => (
                      <motion.div
                        key={m._id}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                      >
                        <div className="w-9 h-9 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m0-16l-4 4m4-4l4 4"/></svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-white truncate">{m.description}</p>
                          <p className="text-[11px] text-white/40">{m.businessName} · {new Date(m.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</p>
                        </div>
                        <span className="text-[13px] font-extrabold text-green-400">+{formatCOP(m.amount)}</span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
