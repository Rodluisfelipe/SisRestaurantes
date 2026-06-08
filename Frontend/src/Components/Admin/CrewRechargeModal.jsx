/**
 * CrewRechargeModal — flujo de recarga manual para el negocio.
 *
 * Pasos:
 *   1. Elige monto (preset o custom).
 *   2. Elige método (Nequi, Breve, Transferencia) — muestra datos para pagar.
 *   3. Sube comprobante y envía.
 *   4. SuperAdmin aprueba → saldo acreditado.
 *
 * Mismo patrón que SubscriptionPayment pero con identidad Crew cosmic.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../../config';

const PRESETS = [
  { amount: 100000, label: '100K', hint: 'Alcanza para ~7 turnos básicos' },
  { amount: 250000, label: '250K', hint: 'Ideal para fines de semana', popular: true },
  { amount: 500000, label: '500K', hint: 'Para operación constante' },
  { amount: 1000000, label: '1M', hint: 'Saldo extendido sin preocupaciones' },
];

const PAYMENT_METHODS = [
  {
    id: 'Breve',
    label: 'Llave Breve',
    value: '@LRQ430',
    color: 'from-fuchsia-500 to-violet-500',
    icon: '🔑',
    note: 'Pago instantáneo desde tu banco o billetera.',
  },
  {
    id: 'Nequi',
    label: 'Nequi',
    value: '302 818 1520',
    color: 'from-pink-500 to-rose-500',
    icon: '📱',
    note: 'Envía desde la app Nequi al número indicado.',
  },
  {
    id: 'Transferencia',
    label: 'Bancolombia',
    value: 'Cuenta Ahorros 902-XXXXX-XXX',
    color: 'from-amber-500 to-yellow-500',
    icon: '🏦',
    note: 'Transferencia tradicional. Llega en 24-48h.',
  },
];

const MIN_AMOUNT = 50000;

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
}

export default function CrewRechargeModal({ open, businessId, onClose, onSuccess }) {
  const [step, setStep] = useState(1); // 1=monto, 2=pago+comprobante, 3=success
  const [amount, setAmount] = useState(250000);
  const [customAmount, setCustomAmount] = useState('');
  const [method, setMethod] = useState('Breve');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [copied, setCopied] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      setStep(1); setAmount(250000); setCustomAmount(''); setMethod('Breve');
      setFile(null); setPreview(null); setError(null); setSuccess(null);
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  if (!open) return null;

  const selectedMethod = PAYMENT_METHODS.find((m) => m.id === method);
  const finalAmount = customAmount ? Number(customAmount) : amount;

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError('El comprobante debe ser una imagen'); return; }
    if (f.size > 8 * 1024 * 1024) { setError('Imagen máx 8MB'); return; }
    setError(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const copyValue = (val, id) => {
    navigator.clipboard.writeText(val);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const submit = async () => {
    setError(null);
    if (finalAmount < MIN_AMOUNT) {
      setError(`Monto mínimo: ${formatCOP(MIN_AMOUNT)}`);
      return;
    }
    if (!file) { setError('Sube el comprobante de pago'); return; }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('proof', file);
      fd.append('amount', String(Math.round(finalAmount)));
      fd.append('paymentMethod', method);
      fd.append('businessId', businessId);

      const r = await fetch(`${API_URL}/crew/businesses/wallet/recharge-requests?businessId=${businessId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
        body: fd,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'Error al enviar solicitud');
      setSuccess(data.request);
      setStep(3);
      onSuccess?.(data.request);
    } catch (e) {
      setError(e.message);
    } finally { setSubmitting(false); }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm"
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full sm:max-w-[480px] max-h-[92vh] bg-[#0a0a14] border border-white/[0.08] sm:rounded-[28px] rounded-t-[28px] shadow-2xl text-white overflow-hidden flex flex-col"
        >
          {/* Aurora bg */}
          <div className="absolute -top-20 -right-10 w-72 h-72 bg-red-500/30 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-24 -left-12 w-72 h-72 bg-orange-500/20 rounded-full blur-[100px] pointer-events-none" />

          {/* Header */}
          <div className="relative flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/30">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/40">Crew · Recarga</p>
                <p className="text-[14px] font-black">{step === 3 ? '¡Listo!' : `Paso ${step} de 2`}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white transition" aria-label="Cerrar">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="relative flex-1 overflow-y-auto px-5 py-5">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h2 className="text-[22px] font-black tracking-tight mb-1">¿Cuánto quieres recargar?</h2>
                  <p className="text-[12px] text-white/50 mb-4">Tu saldo Crew se usa para reservar el pago de cada turno que publiques.</p>

                  {/* Presets */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {PRESETS.map((p) => {
                      const active = !customAmount && amount === p.amount;
                      return (
                        <motion.button
                          key={p.amount}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => { setAmount(p.amount); setCustomAmount(''); }}
                          className={`relative p-3 rounded-2xl border text-left transition-all ${
                            active
                              ? 'border-red-500/60 bg-gradient-to-br from-red-500/[0.18] to-orange-500/[0.10]'
                              : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.18]'
                          }`}
                        >
                          {p.popular && (
                            <span className="absolute -top-2 right-3 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded-full bg-amber-400 text-amber-950">
                              Popular
                            </span>
                          )}
                          <p className={`text-[20px] font-black leading-none ${active ? 'text-white' : 'text-white/85'}`}>
                            ${p.label}
                          </p>
                          <p className="text-[10px] text-white/40 mt-1.5">{p.hint}</p>
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Custom */}
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5">
                    <label className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/40 mb-1.5">
                      O ingresa un monto personalizado
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-white/60 font-bold">$</span>
                      <input
                        type="number"
                        min={MIN_AMOUNT}
                        step={10000}
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        placeholder="Mínimo 50.000"
                        className="flex-1 bg-transparent text-[18px] font-bold text-white placeholder-white/25 focus:outline-none tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="mt-5 p-3.5 rounded-2xl bg-emerald-500/[0.08] border border-emerald-400/20">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-200/80 uppercase tracking-wider">Vas a recargar</span>
                      <span className="text-[22px] font-black text-emerald-200 tabular-nums">{formatCOP(finalAmount)}</span>
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setStep(2)}
                    disabled={finalAmount < MIN_AMOUNT}
                    className="group relative w-full mt-4 overflow-hidden rounded-2xl px-5 py-3.5 font-extrabold text-white bg-gradient-to-r from-red-500 to-orange-500 shadow-lg shadow-red-500/40 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
                      style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 100%)' }} />
                    <span className="relative flex items-center justify-center gap-2">
                      Continuar al pago
                      <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 12h15" />
                      </svg>
                    </span>
                  </motion.button>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <div className="mb-4">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/40">Total a pagar</p>
                    <p className="text-[32px] font-black tabular-nums leading-tight">{formatCOP(finalAmount)}</p>
                  </div>

                  {/* Method tabs */}
                  <div className="flex gap-1 p-1 mb-3 rounded-2xl bg-black/40 border border-white/[0.06]">
                    {PAYMENT_METHODS.map((m) => {
                      const active = method === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setMethod(m.id)}
                          className={`relative flex-1 py-2 rounded-xl text-[11px] font-extrabold uppercase tracking-wider transition ${
                            active ? 'text-white' : 'text-white/40 hover:text-white/70'
                          }`}
                        >
                          {active && (
                            <motion.span
                              layoutId="crew-pay-tab"
                              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                              className={`absolute inset-0 rounded-xl bg-gradient-to-r ${m.color}/30 border border-white/10`}
                            />
                          )}
                          <span className="relative">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Method detail card */}
                  <motion.div
                    key={method}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`relative overflow-hidden rounded-2xl border border-white/[0.08] p-4 mb-3 bg-gradient-to-br ${selectedMethod.color}/[0.10]`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{selectedMethod.icon}</span>
                        <span className="text-[13px] font-bold text-white/80">{selectedMethod.label}</span>
                      </div>
                      <button
                        onClick={() => copyValue(selectedMethod.value, selectedMethod.id)}
                        className="text-[10px] font-extrabold px-2 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/80 uppercase tracking-wider"
                      >
                        {copied === selectedMethod.id ? '✓ Copiado' : 'Copiar'}
                      </button>
                    </div>
                    <p className="text-[24px] font-black text-white tabular-nums tracking-tight">{selectedMethod.value}</p>
                    <p className="text-[11px] text-white/50 mt-1.5 leading-relaxed">{selectedMethod.note}</p>
                  </motion.div>

                  {/* Instrucciones */}
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5 mb-3">
                    <p className="text-[11px] font-extrabold text-white/80 mb-2 uppercase tracking-wider">Cómo funciona</p>
                    <ol className="space-y-1.5 text-[12px] text-white/60">
                      <li className="flex gap-2"><span className="text-red-300 font-extrabold">1.</span> Paga <span className="font-bold text-white/80">{formatCOP(finalAmount)}</span> a {selectedMethod.label}.</li>
                      <li className="flex gap-2"><span className="text-red-300 font-extrabold">2.</span> Toma captura del comprobante.</li>
                      <li className="flex gap-2"><span className="text-red-300 font-extrabold">3.</span> Súbela acá abajo y envía.</li>
                      <li className="flex gap-2"><span className="text-red-300 font-extrabold">4.</span> En máx 30 min vemos el pago y acreditamos tu saldo.</li>
                    </ol>
                  </div>

                  {/* Comprobante */}
                  <div className="mb-3">
                    <label className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/40 mb-1.5">Comprobante de pago</label>
                    {!preview ? (
                      <label className="flex flex-col items-center justify-center gap-2 py-6 rounded-2xl border-2 border-dashed border-white/[0.12] bg-white/[0.02] hover:border-red-400/50 hover:bg-red-500/[0.04] transition cursor-pointer">
                        <svg className="w-7 h-7 text-white/30" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                        </svg>
                        <span className="text-[12px] font-bold text-white/70">Toca para subir la imagen</span>
                        <span className="text-[10px] text-white/30">JPG, PNG, WebP · máx 8MB</span>
                        <input type="file" accept="image/*" onChange={onFile} className="hidden" />
                      </label>
                    ) : (
                      <div className="relative rounded-2xl overflow-hidden border border-white/[0.08]">
                        <img src={preview} alt="Comprobante" className="w-full max-h-[200px] object-contain bg-black/40" />
                        <button
                          onClick={() => { setFile(null); setPreview(null); }}
                          className="absolute top-2 right-2 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-black/70 backdrop-blur-sm text-white border border-white/20 hover:bg-red-500"
                        >
                          Cambiar
                        </button>
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="mb-3 px-3.5 py-2.5 rounded-xl bg-red-500/[0.10] border border-red-400/30 text-[12px] text-red-200">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => setStep(1)}
                      disabled={submitting}
                      className="px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white/70 hover:text-white text-[12px] font-bold transition"
                    >
                      Atrás
                    </button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={submit}
                      disabled={submitting || !file}
                      className="group relative flex-1 overflow-hidden rounded-2xl px-5 py-3 font-extrabold text-white bg-gradient-to-r from-red-500 to-orange-500 shadow-lg shadow-red-500/40 disabled:opacity-40"
                    >
                      <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
                        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 100%)' }} />
                      <span className="relative flex items-center justify-center gap-2">
                        {submitting ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                            </svg>
                            Enviando…
                          </>
                        ) : 'Enviar solicitud'}
                      </span>
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.1 }}
                    className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-2xl shadow-emerald-500/40 mb-4"
                  >
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>
                  <h2 className="text-[24px] font-black mb-2">Solicitud enviada</h2>
                  <p className="text-[13px] text-white/60 leading-relaxed max-w-[280px] mx-auto">
                    Estamos verificando tu comprobante. En máximo 30 minutos vas a ver
                    <span className="font-bold text-emerald-300"> {formatCOP(finalAmount)}</span> en tu billetera Crew.
                  </p>
                  <button
                    onClick={onClose}
                    className="mt-6 px-6 py-3 rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-extrabold shadow-lg shadow-red-500/40"
                  >
                    Volver al panel
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
