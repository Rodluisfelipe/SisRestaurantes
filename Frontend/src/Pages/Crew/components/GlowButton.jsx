/**
 * GlowButton — el CTA principal del Crew.
 *
 * Es el botón al que tu pulgar quiere ir: gradient vivo, glow exterior,
 * un highlight superior tipo "vidrio", spring tap, y un brillo
 * que se desliza al hover (shine).
 *
 * Props:
 *   variant: 'primary' (rojo→naranja), 'accent' (violeta→fuchsia), 'ghost'
 *   size: 'lg' (default, hero) | 'md' | 'sm'
 *   loading: muestra spinner inline en lugar del label
 *   icon, iconRight: nodes opcionales
 *   fullWidth
 */
import { motion } from 'framer-motion';

const VARIANTS = {
  primary: 'from-red-600 via-red-500 to-red-500 shadow-red-500/40 hover:shadow-red-500/60',
  accent: 'from-red-400 via-red-500 to-red-700 shadow-red-500/40 hover:shadow-red-500/60',
  ghost: 'from-white/10 to-white/5 shadow-black/20',
};

const SIZES = {
  lg: 'px-7 py-4 text-[15px] rounded-2xl',
  md: 'px-5 py-3 text-[14px] rounded-xl',
  sm: 'px-3.5 py-2 text-[12px] rounded-lg',
};

export default function GlowButton({
  children,
  variant = 'primary',
  size = 'lg',
  loading,
  disabled,
  icon,
  iconRight,
  fullWidth,
  className = '',
  onClick,
  type = 'button',
  ...rest
}) {
  const isGhost = variant === 'ghost';
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      whileTap={disabled || loading ? undefined : { scale: 0.97 }}
      whileHover={disabled || loading ? undefined : { y: -1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      className={`
        group relative inline-flex items-center justify-center gap-2 overflow-hidden font-extrabold
        bg-gradient-to-br ${VARIANTS[variant]} ${SIZES[size]}
        ${isGhost ? 'text-white border border-white/15' : 'text-white border border-white/20'}
        shadow-lg transition-all
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...rest}
    >
      {/* Highlight superior tipo vidrio */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-[inherit]"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 100%)',
        }}
      />

      {/* Shine que cruza en hover */}
      {!disabled && !loading && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-white/0 via-white/40 to-white/0 transition-transform duration-700 ease-out group-hover:translate-x-[400%]"
        />
      )}

      {/* Contenido */}
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span>Cargando…</span>
        </span>
      ) : (
        <>
          {icon && <span className="relative shrink-0">{icon}</span>}
          <span className="relative">{children}</span>
          {iconRight && <span className="relative shrink-0">{iconRight}</span>}
        </>
      )}
    </motion.button>
  );
}
