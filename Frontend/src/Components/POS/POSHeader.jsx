import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import AI from '../Admin/AdminIcons';

export default function POSHeader({ businessConfig, cashRegister, user, pendingOrdersCount, showOrderBanner, newOrderNotification, onDismissBanner, onGoToOrders, onOpenMovements, onCloseCash, onNewOrder, onExit, offline }) {
  const [time, setTime] = useState(new Date());
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const themeColor = businessConfig?.theme?.buttonColor || '#3B82F6';
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);

  return (
    <div className="flex-shrink-0 z-20">
      {/* Main header bar */}
      <div className="h-12 lg:h-14 bg-slate-900 flex items-center justify-between px-3 lg:px-4">
        {/* Left: logo + name */}
        <div className="flex items-center gap-2 lg:gap-3">
          {businessConfig?.logo ? (
            <img src={businessConfig.logo} alt="" className="w-7 h-7 lg:w-8 lg:h-8 rounded-lg object-cover" />
          ) : (
            <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: themeColor }}>
              <svg className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            </div>
          )}
          <div className="hidden sm:block">
            <p className="text-white text-sm font-bold leading-tight">{businessConfig?.businessName || 'POS'}</p>
            <p className="text-slate-400 text-xs font-medium">Punto de Venta</p>
          </div>
        </div>

        {/* Center: clock — hidden on very small screens */}
        <div className="hidden sm:flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <span className="text-white text-lg font-mono font-bold tabular-nums tracking-wider">
            {time.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
          </span>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5 lg:gap-2">
          {/* New order button */}
          <button
            onClick={onNewOrder}
            className="flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-colors hover:brightness-110"
            style={{ backgroundColor: themeColor }}
            title="Nueva venta"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            <span className="hidden md:inline">Nueva</span>
          </button>

          {/* Pending web orders badge */}
          <button
            onClick={onGoToOrders}
            className="relative w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
            title={`${pendingOrdersCount} ${isService ? 'cita(s) pendiente(s)' : 'pedido(s) pendiente(s)'}`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg>
            {pendingOrdersCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse shadow-lg">
                {pendingOrdersCount > 99 ? '99+' : pendingOrdersCount}
              </span>
            )}
          </button>

          {/* Cash register status — compact on mobile */}
          <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${cashRegister ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
            <div className={`w-2 h-2 rounded-full ${cashRegister ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            {cashRegister ? 'Caja abierta' : 'Caja cerrada'}
          </div>
          {/* Mobile: just the dot */}
          <div className={`sm:hidden w-9 h-9 rounded-lg flex items-center justify-center ${cashRegister ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
            <div className={`w-2.5 h-2.5 rounded-full ${cashRegister ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
          </div>

          {/* Connection status — hidden on mobile */}
          {offline && (
            <div className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${offline.isOnline ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
              {offline.isSyncing ? (
                <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <div className={`w-2 h-2 rounded-full ${offline.isOnline ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
              )}
              {offline.isSyncing
                ? 'Sincronizando...'
                : offline.isOnline
                  ? (offline.pendingSyncCount > 0 ? `Online · ${offline.pendingSyncCount} pendiente${offline.pendingSyncCount > 1 ? 's' : ''}` : 'Online')
                  : 'Sin conexión'}
              {offline.pendingSyncCount > 0 && !offline.isSyncing && (
                <button
                  onClick={(e) => { e.stopPropagation(); offline.syncNow(); }}
                  className="ml-1 p-0.5 rounded hover:bg-white/10 transition-colors"
                  title="Sincronizar ahora"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
                </button>
              )}
            </div>
          )}

          {/* Cashier name — desktop only */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            {user?.name || user?.username || 'Cajero'}
          </div>

          {/* Desktop: individual buttons / Mobile: overflow menu */}
          {/* Desktop buttons */}
          {cashRegister && (
            <button onClick={onOpenMovements} className="hidden lg:flex w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white items-center justify-center transition-colors" title="Movimientos de caja">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20"/></svg>
            </button>
          )}
          {cashRegister && (
            <button onClick={onCloseCash} className="hidden lg:flex w-9 h-9 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 hover:text-amber-300 items-center justify-center transition-colors" title="Cerrar caja">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 10h20"/><circle cx="12" cy="15" r="1"/></svg>
            </button>
          )}
          <button onClick={onExit} className="hidden lg:flex w-9 h-9 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 items-center justify-center transition-colors" title="Volver al admin">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          </button>

          {/* Mobile: 3-dot overflow menu */}
          <div className="relative lg:hidden">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 w-48 z-50">
                  {user && (
                    <div className="px-3.5 py-2 text-xs text-slate-400 border-b border-slate-100">
                      <span className="font-semibold text-slate-600">{user.name || user.username || 'Cajero'}</span>
                    </div>
                  )}
                  {offline && !offline.isOnline && (
                    <div className="px-3.5 py-2.5 flex items-center gap-2 text-xs text-amber-600 font-bold border-b border-slate-100">
                      <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      Sin conexión
                    </div>
                  )}
                  {cashRegister && (
                    <button onClick={() => { onOpenMovements(); setShowMenu(false); }} className="w-full px-3.5 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2.5">
                      <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20"/></svg>
                      Movimientos
                    </button>
                  )}
                  {cashRegister && (
                    <button onClick={() => { onCloseCash(); setShowMenu(false); }} className="w-full px-3.5 py-2.5 text-left text-sm text-amber-600 hover:bg-amber-50 flex items-center gap-2.5">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 10h20"/><circle cx="12" cy="15" r="1"/></svg>
                      Cerrar caja
                    </button>
                  )}
                  <button onClick={() => { onExit(); setShowMenu(false); }} className="w-full px-3.5 py-2.5 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2.5">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                    Salir del POS
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Order notification banner */}
      <AnimatePresence>
        {showOrderBanner && newOrderNotification && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative"
          >
            <button
              onClick={() => { onDismissBanner(); onGoToOrders(); }}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 px-4 py-3 flex items-center gap-3 transition-all"
            >
              <motion.span
                animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
                className="text-2xl"
              >{AI.bell('w-6 h-6 text-white')}</motion.span>
              <div className="flex-1 text-left">
                <p className="text-white font-bold text-sm">{isService ? '¡Nueva Cita Web!' : '¡Nuevo Pedido Web!'}</p>
                <p className="text-white/80 text-xs">
                  {isService ? 'Cita' : 'Pedido'} #{newOrderNotification.orderNumber || newOrderNotification._id?.slice(-6)}
                  {newOrderNotification.customerName && ` - ${newOrderNotification.customerName}`}
                </p>
              </div>
              <motion.div animate={{ x: [0, 5, 0] }} transition={{ duration: 1, repeat: Infinity }}>
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </motion.div>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDismissBanner(); }}
              className="absolute top-1 right-1 w-6 h-6 bg-black/20 hover:bg-black/40 rounded-full flex items-center justify-center transition-colors"
            >
              <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
