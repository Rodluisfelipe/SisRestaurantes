export default function SASelect({ label, children, className = '', ...props }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && <label className="block text-xs font-medium text-slate-600 dark:text-white/50">{label}</label>}
      <select
        className={`w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white
          focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500/40 focus:bg-white dark:focus:bg-white/[0.05] transition-all duration-200
          [&>option]:bg-white dark:[&>option]:bg-[#141419] [&>option]:text-slate-900 dark:[&>option]:text-white`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
