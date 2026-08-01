export default function SASelect({ label, children, className = '', ...props }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && <label className="block text-xs font-medium text-slate-600">{label}</label>}
      <select
        className={`w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900
 focus:outline-none focus:border-cyan-500 focus:bg-white transition-all duration-200
 [&>option]:bg-white [&>option]:text-slate-900`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
