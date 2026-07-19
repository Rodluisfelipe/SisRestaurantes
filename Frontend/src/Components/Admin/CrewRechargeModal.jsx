/**
 * CrewRechargeModal — flujo de recarga manual para el negocio.
 *
 * Pasos:
 *   1. Elige monto (preset o custom).
 *   2. Elige método (Nequi, Breve, Transferencia) — muestra datos para pagar.
 *   3. Sube comprobante y envía.
 *   4. SuperAdmin aprueba → saldo acreditado.
 *
 * Mismo patrón que SubscriptionPayment pero con identidad clara MenuBy.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../../config';
import { Landmark, Check } from 'lucide-react';

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
    logo: '/payment-logos/breb.jpg',
    note: 'Pago instantáneo desde tu banco o billetera.',
  },
  {
    id: 'Nequi',
    label: 'Nequi',
    value: '302 818 1520',
    color: 'from-pink-500 to-rose-500',
    logo: '/payment-logos/nequi.svg',
    note: 'Envía desde la app Nequi al número indicado.',
  },
  {
    id: 'Transferencia',
    label: 'Bancolombia',
    value: 'Cuenta Ahorros 902-XXXXX-XXX',
    color: 'from-amber-500 to-yellow-500',
    Icon: Landmark,
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
          className="relative w-full sm:max-w-[480px] max-h-[92vh] bg-white border border-slate-200 sm:rounded-[28px] rounded-t-[28px] shadow-2xl text-slate-800 overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-red-500 flex items-center justify-center shadow-md shadow-red-500/25">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Crew · Recarga</p>
                <p className="text-[14px] font-black text-slate-800">{step === 3 ? '¡Listo!' : `Paso ${step} de 2`}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition" aria-label="Cerrar">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h2 className="text-[22px] font-black tracking-tight mb-1 text-slate-800">¿Cuánto quieres recargar?</h2>
                  <p className="text-[12px] text-slate-500 mb-4">Tu saldo Crew se usa para reservar el pago de cada turno que publiques.</p>

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
                              ? 'border-red-300 bg-red-50'
                              : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          {p.popular && (
                            <span className="absolute -top-2 right-3 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded-full bg-amber-400 text-amber-950">
                              Popular
                            </span>
                          )}
                          <p className={`text-[20px] font-black leading-none ${active ? 'text-red-600' : 'text-slate-700'}`}>
                            ${p.label}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-1.5">{p.hint}</p>
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Custom */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                    <label className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 mb-1.5">
                      O ingresa un monto personalizado
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-bold">$</span>
                      <input
                        type="number"
                        min={MIN_AMOUNT}
                        step={10000}
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        placeholder="Mínimo 50.000"
                        className="flex-1 bg-transparent text-[18px] font-bold text-slate-800 placeholder-slate-300 focus:outline-none tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="mt-5 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Vas a recargar</span>
                      <span className="text-[22px] font-black text-emerald-600 tabular-nums">{formatCOP(finalAmount)}</span>
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setStep(2)}
                    disabled={finalAmount < MIN_AMOUNT}
                    className="w-full mt-4 rounded-2xl px-5 py-3.5 font-extrabold text-white bg-red-500 hover:bg-red-600 shadow-md shadow-red-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <span className="flex items-center justify-center gap-2">
                      Continuar al pago
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 12h15" />
                      </svg>
                    </span>
                  </motion.button>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <div className="mb-4">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Total a pagar</p>
                    <p className="text-[32px] font-black tabular-nums leading-tight text-slate-900">{formatCOP(finalAmount)}</p>
                  </div>

                  {/* Method tabs */}
                  <div className="flex gap-1 p-1 mb-3 rounded-2xl bg-slate-100 border border-slate-200">
                    {PAYMENT_METHODS.map((m) => {
                      const active = method === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setMethod(m.id)}
                          className={`relative flex-1 py-2 rounded-xl text-[11px] font-extrabold uppercase tracking-wider transition ${
                            active ? 'text-white' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {active && (
                            <motion.span
                              layoutId="crew-pay-tab"
                              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                              className="absolute inset-0 rounded-xl bg-red-500 shadow-md shadow-red-500/25"
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
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 mb-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {selectedMethod.logo ? (
                          <span className="h-7 w-9 flex items-center justify-center shrink-0 rounded-md bg-white border border-slate-200 overflow-hidden">
                            <img src={selectedMethod.logo} alt={selectedMethod.label} className="max-h-6 max-w-8 object-contain" />
                          </span>
                        ) : (
                          <selectedMethod.Icon className="w-5 h-5 text-slate-600" />
                        )}
                        <span className="text-[13px] font-bold text-slate-700">{selectedMethod.label}</span>
                      </div>
                      <button
                        onClick={() => copyValue(selectedMethod.value, selectedMethod.id)}
                        className="text-[10px] font-extrabold px-2 py-1 rounded-full bg-white hover:bg-slate-100 text-slate-600 uppercase tracking-wider border border-slate-200 inline-flex items-center gap-1"
                      >
                        {copied === selectedMethod.id ? <><Check className="w-3 h-3" /> Copiado</> : 'Copiar'}
                      </button>
                    </div>
                    <p className="text-[24px] font-black text-slate-900 tabular-nums tracking-tight">{selectedMethod.value}</p>
                    <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{selectedMethod.note}</p>
                  </motion.div>

                  {/* Instrucciones */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 mb-3">
                    <p className="text-[11px] font-extrabold text-slate-700 mb-2 uppercase tracking-wider">Cómo funciona</p>
                    <ol className="space-y-1.5 text-[12px] text-slate-600">
                      <li className="flex gap-2"><span className="text-red-500 font-extrabold">1.</span> Paga <span className="font-bold text-slate-800">{formatCOP(finalAmount)}</span> a {selectedMethod.label}.</li>
                      <li className="flex gap-2"><span className="text-red-500 font-extrabold">2.</span> Toma captura del comprobante.</li>
                      <li className="flex gap-2"><span className="text-red-500 font-extrabold">3.</span> Súbela acá abajo y envía.</li>
                      <li className="flex gap-2"><span className="text-red-500 font-extrabold">4.</span> En máx 30 min vemos el pago y acreditamos tu saldo.</li>
                    </ol>
                  </div>

                  {/* Comprobante */}
                  <div className="mb-3">
                    <label className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 mb-1.5">Comprobante de pago</label>
                    {!preview ? (
                      <label className="flex flex-col items-center justify-center gap-2 py-6 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-red-300 hover:bg-red-50/50 transition cursor-pointer">
                        <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                        </svg>
                        <span className="text-[12px] font-bold text-slate-600">Toca para subir la imagen</span>
                        <span className="text-[10px] text-slate-400">JPG, PNG, WebP · máx 8MB</span>
                        <input type="file" accept="image/*" onChange={onFile} className="hidden" />
                      </label>
                    ) : (
                      <div className="relative rounded-2xl overflow-hidden border border-slate-200">
                        <img src={preview} alt="Comprobante" className="w-full max-h-[200px] object-contain bg-slate-50" />
                        <button
                          onClick={() => { setFile(null); setPreview(null); }}
                          className="absolute top-2 right-2 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-white text-slate-700 border border-slate-200 hover:bg-red-50 hover:text-red-600 transition"
                        >
                          Cambiar
                        </button>
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="mb-3 px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => setStep(1)}
                      disabled={submitting}
                      className="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-800 text-[12px] font-bold transition"
                    >
                      Atrás
                    </button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={submit}
                      disabled={submitting || !file}
                      className="flex-1 rounded-2xl px-5 py-3 font-extrabold text-white bg-red-500 hover:bg-red-600 shadow-md shadow-red-500/25 disabled:opacity-40 transition"
                    >
                      <span className="flex items-center justify-center gap-2">
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
                    className="w-20 h-20 mx-auto rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-4"
                  >
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>
                  <h2 className="text-[24px] font-black text-slate-800 mb-2">Solicitud enviada</h2>
                  <p className="text-[13px] text-slate-500 leading-relaxed max-w-[280px] mx-auto">
                    Estamos verificando tu comprobante. En máximo 30 minutos vas a ver
                    <span className="font-bold text-emerald-600"> {formatCOP(finalAmount)}</span> en tu billetera Crew.
                  </p>
                  <button
                    onClick={onClose}
                    className="mt-6 px-6 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-extrabold shadow-md shadow-red-500/25 transition"
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
