import { toast } from 'sonner';

/**
 * Helpers de toast con estilo MenuBy Crew.
 * Reemplazo de alert() para que se sienta moderno.
 */
export const crewToast = {
  success: (msg, opts = {}) =>
    toast.success(msg, {
      duration: 3000,
      style: {
        background: '#0f0f1a',
        border: '1px solid rgba(239,68,68,0.3)',
        color: '#ffffff',
        fontWeight: 600,
      },
      ...opts,
    }),
  error: (msg, opts = {}) =>
    toast.error(msg, {
      duration: 4000,
      style: {
        background: '#0f0f1a',
        border: '1px solid rgba(239,68,68,0.5)',
        color: '#fca5a5',
        fontWeight: 600,
      },
      ...opts,
    }),
  info: (msg, opts = {}) =>
    toast(msg, {
      duration: 3000,
      style: {
        background: '#0f0f1a',
        border: '1px solid rgba(255,255,255,0.1)',
        color: '#ffffff',
        fontWeight: 600,
      },
      ...opts,
    }),
  achievement: (title, subtitle) =>
    toast.custom(
      () => (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#0f0f1a] border border-red-500/30 rounded-xl shadow-2xl">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/30">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l2.4 7.2H22l-6 4.4 2.3 7.2L12 16.4 5.7 20.8 8 13.6 2 9.2h7.6L12 2z" />
            </svg>
          </div>
          <div>
            <p className="text-[12px] font-extrabold text-white">{title}</p>
            {subtitle && <p className="text-[11px] text-white/60">{subtitle}</p>}
          </div>
        </div>
      ),
      { duration: 5000 }
    ),
};
