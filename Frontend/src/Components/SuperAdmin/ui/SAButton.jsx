import { motion } from 'framer-motion';

const VARIANTS = {
  ghost: 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent',
  filled: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200 border border-cyan-200',
  danger: 'bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border border-red-200',
  outline: 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-300',
  primary: 'bg-slate-900 text-white hover:bg-slate-800 border border-transparent font-medium',
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
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 focus-visible:ring-offset-1 min-h-[36px] sm:min-h-0
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
