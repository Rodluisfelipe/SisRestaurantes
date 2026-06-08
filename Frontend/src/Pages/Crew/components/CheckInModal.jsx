/**
 * CheckInModal — el worker escribe el código de 6 caracteres que le mostró
 * el negocio al llegar al sitio. Sin código correcto no hay check-in,
 * así garantizamos presencia física.
 *
 * Props:
 *   open, booking (con shiftId.title, etc), onClose, onSuccess
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import crewApi from '../../../services/crewApi';

const CODE_LEN = 6;

export default function CheckInModal({ open, booking, onClose, onSuccess }) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const inputsRef = useRef([]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      setCode(''); setError(null);
      // focus al primer slot
      setTimeout(() => inputsRef.current[0]?.focus(), 50);
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  if (!open || !booking) return null;

  const submit = async (codeOverride) => {
    const finalCode = (codeOverride ?? code).toUpperCase().trim();
    if (finalCode.length !== CODE_LEN) {
      setError(`El código debe tener ${CODE_LEN} caracteres`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Capturamos ubicación opcional para auditoría
      let lat = null, lng = null;
      if (navigator.geolocation) {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => { lat = pos.coords.latitude; lng = pos.coords.longitude; resolve(); },
            () => resolve(),
            { timeout: 4000, maximumAge: 30000 },
          );
        });
      }

      const { data } = await crewApi.post(`/bookings/${booking._id}/checkin`, { code: finalCode, lat, lng });
      onSuccess?.(data);
    } catch (e) {
      const msg = e?.response?.data?.message || 'Error de conexión';
      setError(msg);
      // Limpiar input para reintentar
      setCode('');
      setTimeout(() => inputsRef.current[0]?.focus(), 60);
    } finally { setSubmitting(false); }
  };

  // Renderizamos un slot por carácter para que se sienta especial.
  // Pero por debajo es UN input controlado para soporte de pegado/teclado.
  const handleChange = (val) => {
    const clean = val.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, CODE_LEN);
    setCode(clean);
    setError(null);
    if (clean.length === CODE_LEN) {
      // Auto-submit al completar
      submit(clean);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center sm:p-4 bg-black/75 backdrop-blur-sm font-geist"
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full sm:max-w-[420px] bg-[#0a0a14] border border-white/[0.08] sm:rounded-[28px] rounded-t-[28px] shadow-2xl text-white overflow-hidden"
        >
          <motion.div
            animate={{ x: [0, 12, 0], y: [0, -6, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-20 -right-10 w-64 h-64 bg-amber-500/25 rounded-full blur-[100px] pointer-events-none"
          />

          {/* Header */}
          <div className="relative px-5 pt-5 pb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/40">Check-in</p>
              <p className="text-[14px] font-black truncate">{booking.shiftId?.title || 'Turno'}</p>
              <p className="text-[10.5px] text-white/40 truncate">{booking.businessId?.businessName}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white" aria-label="Cerrar">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="relative px-5 pb-5">
            <div className="text-center my-4">
              <div className="text-4xl mb-2">🔐</div>
              <p className="text-[13px] text-white/70 leading-relaxed">
                Pídele al empleador el <strong className="text-amber-300">código de llegada</strong> y escríbelo aquí.
              </p>
            </div>

            {/* Slots visuales — un input invisible por debajo */}
            <div className="relative">
              <input
                ref={(el) => (inputsRef.current[0] = el)}
                value={code}
                onChange={(e) => handleChange(e.target.value)}
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="one-time-code"
                maxLength={CODE_LEN}
                disabled={submitting}
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
                aria-label="Código de check-in"
              />
              <div className="grid grid-cols-6 gap-2 pointer-events-none">
                {Array.from({ length: CODE_LEN }).map((_, i) => {
                  const char = code[i] || '';
                  const isCurrent = !char && i === code.length;
                  return (
                    <div
                      key={i}
                      className={`aspect-square rounded-2xl border flex items-center justify-center text-[24px] font-black tabular-nums transition-all ${
                        char
                          ? 'border-amber-400/50 bg-amber-500/[0.10] text-white shadow-[0_0_0_2px_rgba(251,191,36,0.15)]'
                          : isCurrent
                            ? 'border-white/30 bg-white/[0.04] text-white animate-pulse'
                            : 'border-white/[0.08] bg-white/[0.02] text-white/30'
                      }`}
                    >
                      {char || '·'}
                    </div>
                  );
                })}
              </div>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-4 px-3.5 py-2.5 rounded-xl bg-red-500/[0.10] border border-red-400/30 text-[12px] text-red-200">
                {error}
              </motion.div>
            )}

            <div className="mt-5 space-y-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => submit()}
                disabled={submitting || code.length !== CODE_LEN}
                className="group relative w-full overflow-hidden rounded-2xl px-5 py-3.5 font-extrabold text-white bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg shadow-amber-500/40 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
                  style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 100%)' }} />
                <span className="relative">{submitting ? 'Verificando…' : 'Confirmar llegada'}</span>
              </motion.button>

              <p className="text-center text-[10.5px] text-white/30 leading-relaxed">
                Si tu app de cámara escanea el QR del empleador, el código se autocompleta. Si no, escríbelo letra por letra.
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
