import React, { useState, useEffect } from 'react';

export default function POSHeader({ businessConfig, cashRegister, user, onOpenMovements, onCloseCash, onExit }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const themeColor = businessConfig?.theme?.buttonColor || '#3B82F6';

  return (
    <div className="h-14 bg-slate-900 flex items-center justify-between px-4 flex-shrink-0 z-20">
      {/* Left: logo + name */}
      <div className="flex items-center gap-3">
        {businessConfig?.logo ? (
          <img src={businessConfig.logo} alt="" className="w-8 h-8 rounded-lg object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: themeColor }}>
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          </div>
        )}
        <div>
          <p className="text-white text-sm font-bold leading-tight">{businessConfig?.businessName || 'POS'}</p>
          <p className="text-slate-400 text-[10px] font-medium">Punto de Venta</p>
        </div>
      </div>

      {/* Center: clock */}
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        <span className="text-white text-lg font-mono font-bold tabular-nums tracking-wider">
          {time.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </span>
      </div>

      {/* Right: cash status + actions */}
      <div className="flex items-center gap-2">
        {/* Cash register status */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${cashRegister ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
          <div className={`w-2 h-2 rounded-full ${cashRegister ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
          {cashRegister ? 'Caja abierta' : 'Caja cerrada'}
        </div>

        {/* Cashier name */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          {user?.name || user?.username || 'Cajero'}
        </div>

        {/* Movements button */}
        {cashRegister && (
          <button
            onClick={onOpenMovements}
            className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
            title="Movimientos de caja"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20"/></svg>
          </button>
        )}

        {/* Close cash button */}
        {cashRegister && (
          <button
            onClick={onCloseCash}
            className="w-9 h-9 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 hover:text-amber-300 flex items-center justify-center transition-colors"
            title="Cerrar caja"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 10h20"/><circle cx="12" cy="15" r="1"/></svg>
          </button>
        )}

        {/* Exit */}
        <button
          onClick={onExit}
          className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 flex items-center justify-center transition-colors"
          title="Volver al admin"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
        </button>
      </div>
    </div>
  );
}
