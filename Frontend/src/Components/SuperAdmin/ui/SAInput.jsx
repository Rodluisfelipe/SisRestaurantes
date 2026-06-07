import { forwardRef } from 'react';

const SAInput = forwardRef(function SAInput({ label, icon, error, className = '', ...props }, ref) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && <label className="block text-xs font-medium text-slate-600 dark:text-white/50">{label}</label>}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/25 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          className={`w-full bg-white dark:bg-white/[0.03] border rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/25
            focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500/40 focus:bg-white dark:focus:bg-white/[0.05] transition-all duration-200
            ${icon ? 'pl-9' : ''}
            ${error ? 'border-red-400 dark:border-red-500/40' : 'border-slate-200 dark:border-white/[0.08]'}
          `}
          {...props}
        />
      </div>
      {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
});

export default SAInput;
