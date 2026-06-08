/**
 * CrewWithdrawModal — el worker pide retirar su saldo a Nequi/Daviplata/Bancolombia.
 *
 * Estética cosmic igual que el resto del Crew. Tres pasos:
 *   1. Monto + método.
 *   2. Datos de la cuenta destino.
 *   3. Éxito (solicitud en cola para SuperAdmin).
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import crewApi from '../../../services/crewApi';

const PAYOUT_METHODS = [
  { id: 'nequi', label: 'Nequi', icon: '📱', placeholder: 'Tu # de Nequi', color: 'from-pink-500 to-rose-500' },
  { id: 'daviplata', label: 'Daviplata', icon: '💜', placeholder: 'Tu # de Daviplata', color: 'from-violet-500 to-fuchsia-500' },
  { id: 'bancolombia', label: 'Bancolombia', icon: '🟡', placeholder: '# de cuenta de ahorros/corriente', color: 'from-amber-500 to-yellow-500' },
  { id: 'transfer', label: 'Otra transferencia', icon: '🏦', placeholder: 'Banco + # de cuenta', color: 'from-sky-500 to-cyan-500' },
];

const PRESETS = [20000, 50000, 100000, 200000];
const MIN = 20000;

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
}

export default function CrewWithdrawModal({ open, wallet, defaultPayoutMethod, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState('');
  const [methodId, setMethodId] = useState(defaultPayoutMethod?.type || 'nequi');
  const [accountInfo, setAccountInfo] = useState(defaultPayoutMethod?.accountInfo || '');
  const [holderName, setHolderName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const available = wallet?.balance || 0;
  const finalAmount = Number(amount) || 0;
  const method = PAYOUT_METHODS.find((m) => m.id === methodId);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      setStep(1); setAmount(''); setError(null);
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    setError(null);
    if (finalAmount < MIN) return setError(`Mínimo: ${formatCOP(MIN)}`);
    if (finalAmount > available) return setError('Excede tu saldo disponible');
    if (!accountInfo.trim()) return setError('Ingresa los datos de tu cuenta');

    setSubmitting(true);
    try {
      const { data } = await crewApi.post('/workers/me/wallet/withdraw', {
        amount: finalAmount,
        payoutMethod: {
          type: methodId,
          accountInfo: accountInfo.trim(),
          holderName: holderName.trim(),
        },
      });
      setStep(3);
      onSuccess?.(data);
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudo crear la solicitud');
    } finally { setSubmitting(false); }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm font-geist"
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full sm:max-w-[440px] max-h-[92vh] bg-[#0a0a14] border border-white/[0.08] sm:rounded-[28px] rounded-t-[28px] shadow-2xl text-white overflow-hidden flex flex-col"
        >
          <div className="absolute -top-20 -right-10 w-72 h-72 bg-red-500/20 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-24 -left-12 w-72 h-72 bg-emerald-500/15 rounded-full blur-[100px] pointer-events-none" />

          {/* Header */}
          <div className="relative flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/40">Retirar saldo</p>
                <p className="text-[14px] font-black">{step === 3 ? '¡Listo!' : `Paso ${step} de 2`}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white transition" aria-label="Cerrar">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="relative flex-1 overflow-y-auto px-5 py-5">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <div className="mb-4">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/40">Disponible</p>
                    <p className="text-[28px] font-black tabular-nums leading-tight">{formatCOP(available)}</p>
                  </div>

                  <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/40 mb-2">¿Cuánto retiras?</p>
                  <div className="grid grid-cols-4 gap-1.5 mb-3">
                    {PRESETS.filter(p => p <= available).map((p) => {
                      const active = Number(amount) === p;
                      return (
                        <motion.button
                          key={p}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setAmount(String(p))}
                          className={`py-2.5 rounded-xl text-[12.5px] font-extrabold transition ${
                            active
                              ? 'bg-gradient-to-r from-emerald-500/30 to-teal-500/20 text-emerald-200 border border-emerald-400/40'
                              : 'bg-white/[0.03] text-white/60 border border-white/[0.06] hover:border-white/[0.18]'
                          }`}
                        >
                          ${(p / 1000).toFixed(0)}K
                        </motion.button>
                      );
                    })}
                  </div>
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-white/50 font-bold">$</span>
                      <input
                        type="number"
                        min={MIN}
                        max={available}
                        step={5000}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder={`Mínimo ${formatCOP(MIN).replace(/\s/g, '')}`}
                        className="flex-1 bg-transparent text-[18px] font-bold text-white placeholder-white/25 focus:outline-none tabular-nums"
                      />
                      {amount && (
                        <button onClick={() => setAmount(String(available))} className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-full bg-white/10 text-white/70">
                          Todo
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/40 mb-2">¿A dónde lo recibes?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYOUT_METHODS.map((m) => {
                      const active = methodId === m.id;
                      return (
                        <motion.button
                          key={m.id}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setMethodId(m.id)}
                          className={`relative p-3 rounded-2xl border text-left transition ${
                            active
                              ? `border-white/40 bg-gradient-to-br ${m.color}/[0.18]`
                              : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.18]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{m.icon}</span>
                            <span className={`text-[12.5px] font-extrabold ${active ? 'text-white' : 'text-white/70'}`}>{m.label}</span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>

                  {error && (
                    <div className="mt-4 px-3.5 py-2.5 rounded-xl bg-red-500/[0.10] border border-red-400/30 text-[12px] text-red-200">{error}</div>
                  )}

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      if (finalAmount < MIN) return setError(`Mínimo: ${formatCOP(MIN)}`);
                      if (finalAmount > available) return setError('Excede tu saldo');
                      setError(null); setStep(2);
                    }}
                    disabled={finalAmount < MIN || finalAmount > available}
                    className="group relative w-full mt-5 overflow-hidden rounded-2xl px-5 py-3.5 font-extrabold text-white bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/40 disabled:opacity-40"
                  >
                    <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
                      style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 100%)' }} />
                    <span className="relative flex items-center justify-center gap-2">
                      Continuar
                      <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 12h15" /></svg>
                    </span>
                  </motion.button>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <div className="mb-4">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/40">Retirarás</p>
                    <p className="text-[28px] font-black tabular-nums leading-tight text-emerald-300">{formatCOP(finalAmount)}</p>
                    <p className="text-[11px] text-white/40 mt-0.5">a {method.label}</p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/40 mb-1.5">
                        {methodId === 'nequi' || methodId === 'daviplata' ? 'Número de celular' : 'Datos de la cuenta'}
                      </label>
                      <input
                        value={accountInfo}
                        onChange={(e) => setAccountInfo(e.target.value)}
                        placeholder={method.placeholder}
                        className="w-full px-4 py-3 rounded-2xl bg-black/40 border border-white/[0.08] text-[14px] text-white placeholder-white/25 focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/40 mb-1.5">Nombre del titular</label>
                      <input
                        value={holderName}
                        onChange={(e) => setHolderName(e.target.value)}
                        placeholder="Como aparece en tu cuenta"
                        className="w-full px-4 py-3 rounded-2xl bg-black/40 border border-white/[0.08] text-[14px] text-white placeholder-white/25 focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>

                  <div className="mt-4 p-3.5 rounded-2xl bg-emerald-500/[0.06] border border-emerald-400/20">
                    <p className="text-[11px] text-emerald-100/80 leading-relaxed">
                      <strong className="text-emerald-200">⏱ Tiempo promedio:</strong> en horario hábil, las solicitudes se pagan en menos de 1 hora. Fuera de horario, máximo 24h.
                    </p>
                  </div>

                  {error && (
                    <div className="mt-3 px-3.5 py-2.5 rounded-xl bg-red-500/[0.10] border border-red-400/30 text-[12px] text-red-200">{error}</div>
                  )}

                  <div className="flex gap-2 mt-4">
                    <button onClick={() => setStep(1)} disabled={submitting} className="px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white/70 text-[12px] font-bold transition">
                      Atrás
                    </button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={submit}
                      disabled={submitting}
                      className="group relative flex-1 overflow-hidden rounded-2xl px-5 py-3 font-extrabold text-white bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/40 disabled:opacity-40"
                    >
                      <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
                        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 100%)' }} />
                      <span className="relative">{submitting ? 'Enviando…' : 'Confirmar retiro'}</span>
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="s3" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.1 }}
                    className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-2xl shadow-emerald-500/40 mb-4"
                  >
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </motion.div>
                  <h2 className="text-[22px] font-black mb-2">Solicitud enviada</h2>
                  <p className="text-[12.5px] text-white/60 leading-relaxed max-w-[280px] mx-auto">
                    Vas a recibir <span className="font-bold text-emerald-300">{formatCOP(finalAmount)}</span> en tu {method.label}.
                    Te avisamos en cuanto se procese.
                  </p>
                  <button
                    onClick={onClose}
                    className="mt-6 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-extrabold shadow-lg shadow-emerald-500/40"
                  >
                    Volver a mi perfil
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
