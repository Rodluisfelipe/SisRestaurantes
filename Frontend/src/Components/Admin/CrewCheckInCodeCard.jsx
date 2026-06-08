/**
 * CrewCheckInCodeCard — muestra el código que el negocio enseña al worker
 * cuando llega físicamente al sitio. Sin código correcto, el worker no puede
 * marcar check-in en su app.
 *
 * Incluye un QR generado por servicio externo (api.qrserver.com) que
 * codifica el código tal cual, para que el worker pueda escanearlo con
 * cualquier cámara/lector y autorellene.
 *
 * Props:
 *   bookingId, businessId — para el endpoint de regenerar
 *   code: string (6 chars)
 *   onRegenerated(newCode): callback tras regenerar
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../../config';

export default function CrewCheckInCodeCard({ bookingId, businessId, code, onRegenerated }) {
  const [open, setOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const qrUrl = code
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(code)}&margin=12`
    : null;

  const copy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
  };

  const regenerate = async () => {
    if (!confirm('¿Regenerar el código? El código actual dejará de funcionar.')) return;
    setRegenerating(true);
    try {
      const r = await fetch(`${API_URL}/crew/businesses/bookings/${bookingId}/regenerate-checkin-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({ businessId }),
      });
      const data = await r.json();
      if (!r.ok) { alert(data.message || 'No se pudo regenerar'); return; }
      onRegenerated?.(data.checkInCode);
    } finally { setRegenerating(false); }
  };

  return (
    <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/[0.10] to-orange-500/[0.06] backdrop-blur-sm overflow-hidden">
      {/* Header compacto */}
      <button onClick={() => setOpen((o) => !o)} className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-base">🔐</span>
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-amber-200">Código de llegada</p>
            <p className="text-[18px] font-black text-white tabular-nums tracking-widest">{code || '------'}</p>
          </div>
        </div>
        <svg className={`w-4 h-4 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-white/[0.06]">
              <p className="text-[11px] text-white/60 leading-relaxed mb-3">
                Muéstrale este código al trabajador cuando llegue al sitio. Solo así puede marcar check-in en su app. <strong className="text-amber-200">No lo compartas antes de la hora del turno.</strong>
              </p>

              {qrUrl && (
                <div className="flex flex-col items-center gap-2 mb-3 p-3 rounded-xl bg-white">
                  <img src={qrUrl} alt={`QR ${code}`} className="w-44 h-44" />
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    También escaneable con la cámara
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={copy}
                  className="flex-1 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white text-[11px] font-extrabold uppercase tracking-wider border border-white/[0.08] transition"
                >
                  Copiar
                </button>
                <button
                  onClick={regenerate}
                  disabled={regenerating}
                  className="flex-1 px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 text-[11px] font-extrabold uppercase tracking-wider border border-rose-400/30 transition disabled:opacity-50"
                >
                  {regenerating ? '…' : 'Regenerar'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
