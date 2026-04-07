import { motion } from 'framer-motion';

const VARIANTS = {
  ghost: 'bg-transparent text-white/60 hover:text-white hover:bg-white/[0.06] border border-transparent',
  filled: 'bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 border border-cyan-500/20',
  danger: 'bg-red-500/10 text-red-400/80 hover:bg-red-500/20 hover:text-red-400 border border-red-500/15',
  outline: 'bg-transparent text-white/60 hover:text-white hover:bg-white/[0.04] border border-white/[0.1]',
  primary: 'bg-white text-black hover:bg-white/90 border border-transparent font-medium',
};

const SIZES = {
  xs: 'text-[11px] px-2 py-1 gap-1',
  sm: 'text-xs px-2.5 py-1.5 gap-1.5',
  md: 'text-sm px-3.5 py-2 gap-2',
  lg: 'text-sm px-5 py-2.5 gap-2',
};

export default function SAButton({
  children, variant = 'ghost', size = 'sm', className = '',
  icon, iconRight, disabled, loading, onClick, type = 'button', ...props
}) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.01 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 
        ${VARIANTS[variant]} ${SIZES[size]} 
        ${disabled || loading ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} 
        ${className}`}
      {...props}
    >
      {loading && (
        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {!loading && icon && <span className="shrink-0">{icon}</span>}
      {children}
      {iconRight && <span className="shrink-0">{iconRight}</span>}
    </motion.button>
  );
}
