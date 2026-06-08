/**
 * CrewEmployerPending — pantalla mostrada cuando la cuenta del empleador
 * está en revisión / rechazada / suspendida. No puede publicar hasta `approved`.
 */
import { motion } from 'framer-motion';
import { useCrewEmployer } from './useCrewEmployer';

const STATE_CARDS = {
  pending_approval: {
    emoji: '⏳',
    title: 'Tu cuenta está en revisión',
    body: 'Estamos revisando tus datos. En máximo 24 horas te avisamos cuando puedas empezar a publicar turnos.',
    cta: null,
    tone: 'amber',
  },
  rejected: {
    emoji: '🚫',
    title: 'Solicitud rechazada',
    body: 'Tu solicitud no pasó la revisión.',
    cta: { label: 'Contáctanos', action: 'whatsapp' },
    tone: 'red',
  },
  suspended: {
    emoji: '⏸️',
    title: 'Cuenta suspendida temporalmente',
    body: 'Hay algo que aclarar antes de seguir operando.',
    cta: { label: 'Contáctanos', action: 'whatsapp' },
    tone: 'amber',
  },
  banned: {
    emoji: '🛑',
    title: 'Cuenta bloqueada',
    body: 'No puedes seguir usando Crew con esta cuenta.',
    cta: null,
    tone: 'red',
  },
};

const TONES = {
  amber: 'bg-amber-50 border-amber-200',
  red: 'bg-red-50 border-red-200',
};

export default function CrewEmployerPending() {
  const { employer, logout, refreshMe } = useCrewEmployer();
  const state = STATE_CARDS[employer?.status] || STATE_CARDS.pending_approval;

  const contact = () => {
    window.open('https://wa.me/573028181520?text=' + encodeURIComponent(
      `Hola, soy ${employer?.name} (${employer?.phone}). Mi cuenta Crew aparece como ${employer?.status} y quisiera saber el siguiente paso.`
    ), '_blank');
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-800 font-geist flex flex-col">
      <header className="max-w-md mx-auto w-full px-5 pt-[max(1.5rem,env(safe-area-inset-top,0px))] pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-red-500 flex items-center justify-center shadow-md shadow-red-500/25">
            <span className="text-base font-black text-white">C</span>
          </div>
          <div>
            <p className="text-[9.5px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Crew · Empleador</p>
            <p className="text-[13px] font-black text-slate-800 truncate max-w-[200px]">{employer?.name}</p>
          </div>
        </div>
        <button onClick={logout} className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 hover:text-slate-700 transition">
          Salir
        </button>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full px-5 py-6 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className={`relative w-full overflow-hidden rounded-2xl p-7 text-center border ${TONES[state.tone]}`}
        >
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            className="text-6xl mb-4"
          >
            {state.emoji}
          </motion.div>
          <h1 className="text-[22px] font-black tracking-tight leading-tight text-slate-800 mb-2">{state.title}</h1>
          <p className="text-[13px] text-slate-500 leading-relaxed mb-4">{state.body}</p>

          {employer?.rejectionReason && (
            <div className="mt-3 mb-4 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-left">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Motivo</p>
              <p className="text-[12.5px] text-slate-700 leading-relaxed">{employer.rejectionReason}</p>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            {state.cta?.action === 'whatsapp' && (
              <button onClick={contact} className="flex-1 px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-[13px] shadow-md shadow-emerald-500/25 transition">
                {state.cta.label} por WhatsApp
              </button>
            )}
            <button onClick={refreshMe} className="px-4 py-3 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-[13px] border border-slate-200 transition">
              Refrescar estado
            </button>
          </div>
        </motion.div>

        <p className="mt-6 text-[11px] text-slate-400 text-center leading-relaxed">
          Te enviaremos un mensaje al teléfono que registraste cuando aprobemos tu cuenta.
        </p>
      </main>
    </div>
  );
}
