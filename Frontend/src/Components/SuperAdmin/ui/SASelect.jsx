export default function SASelect({ label, children, className = '', ...props }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && <label className="block text-xs font-medium text-white/50">{label}</label>}
      <select
        className={`w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white
          focus:outline-none focus:border-cyan-500/40 focus:bg-white/[0.05] transition-all duration-200
          [&>option]:bg-[#141419] [&>option]:text-white`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
