const PRESETS = {
  success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  danger: 'bg-red-500/15 text-red-400 border-red-500/20',
  info: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  neutral: 'bg-white/[0.06] text-white/60 border-white/[0.08]',
  purple: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  blue: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
};

export default function SABadge({ children, variant = 'neutral', dot = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md border ${PRESETS[variant] || PRESETS.neutral} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full bg-current`} />}
      {children}
    </span>
  );
}
