import { forwardRef } from 'react';

const SAInput = forwardRef(function SAInput({ label, icon, error, className = '', ...props }, ref) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && <label className="block text-xs font-medium text-slate-600">{label}</label>}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400
 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 transition-all duration-150 min-h-[40px]
 ${icon ? 'pl-9' : ''}
 ${error ? 'border-red-400' : 'border-slate-200'}
 `}
          {...props}
        />
      </div>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  );
});

export default SAInput;
