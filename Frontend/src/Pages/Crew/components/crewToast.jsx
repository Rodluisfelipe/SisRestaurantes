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
        background: 'white',
        border: '1px solid #BBF7D0',
        color: '#065F46',
        fontWeight: 600,
      },
      ...opts,
    }),
  error: (msg, opts = {}) =>
    toast.error(msg, {
      duration: 4000,
      style: {
        background: 'white',
        border: '1px solid #FECACA',
        color: '#991B1B',
        fontWeight: 600,
      },
      ...opts,
    }),
  info: (msg, opts = {}) =>
    toast(msg, {
      duration: 3000,
      style: {
        background: 'white',
        border: '1px solid #E2E8F0',
        color: '#0F172A',
        fontWeight: 600,
      },
      ...opts,
    }),
  achievement: (title, subtitle) =>
    toast.custom(
      () => (
        <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 rounded-xl shadow-2xl">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l2.4 7.2H22l-6 4.4 2.3 7.2L12 16.4 5.7 20.8 8 13.6 2 9.2h7.6L12 2z" />
            </svg>
          </div>
          <div>
            <p className="text-[12px] font-extrabold text-amber-900">{title}</p>
            {subtitle && <p className="text-[11px] text-amber-700">{subtitle}</p>}
          </div>
        </div>
      ),
      { duration: 5000 }
    ),
};
