import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import MobileNavDrawer from './MobileNavDrawer';

/* ═══ SVG Icons — iOS SF Symbols style ═══ */
const NavIcons = {
  home: (active) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      {active
        ? <path d="M3 10.5L12 3l9 7.5V21a1 1 0 01-1 1H4a1 1 0 01-1-1V10.5z"/>
        : <><path d="M3 10.5L12 3l9 7.5V20a2 2 0 01-2 2H5a2 2 0 01-2-2V10.5z"/><path d="M9 22V12h6v10"/></>
      }
    </svg>
  ),
  orders: (active) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      {active
        ? <><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4" stroke="white" strokeWidth="2" fill="none"/></>
        : <><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></>
      }
    </svg>
  ),
  menu: (active) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      {active
        ? <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15"/>
        : <><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></>
      }
    </svg>
  ),
  servicio: (active, hasPending) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 10V3L4 14h7v7l9-11h-7z" fill={active ? 'currentColor' : 'none'} />
    </svg>
  ),
  more: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>
    </svg>
  ),
  calendar: (active) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      {active
        ? <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.5" fill="none"/></>
        : <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>
      }
    </svg>
  ),
  waiter: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><path d="M6 1v3M10 1v3M14 1v3"/>
    </svg>
  ),
  tools: (active) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  ),
};

/**
 * MobileBottomNav v4 — Native iOS tab bar.
 * Tab 4: "Servicio" (lightning bolt) opens ModoOperacion overlay directly.
 * Pulsing ring when pending orders exist.
 */
export default function MobileBottomNav({ activeTab, setActiveTab, pendingOrdersCount, businessConfig, handleLogout, userRole, onOpenModoOp }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const { businessId } = useParams();
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);
  const isStaff = userRole === 'staff';

  const pinnedTabs = [
    { id: 'dashboard',  label: 'Inicio',                         icon: NavIcons.home },
    { id: 'orders',     label: isService ? 'Citas' : 'Pedidos',  icon: isService ? NavIcons.calendar : NavIcons.orders, badge: pendingOrdersCount },
    { id: 'products',   label: isService ? 'Servicios' : 'Menú', icon: isService ? NavIcons.tools : NavIcons.menu },
    { id: '_servicio',  label: 'Servicio',                       icon: NavIcons.servicio },
  ];

  const visibleTabs = isStaff
    ? [
        ...pinnedTabs.filter(t => ['orders'].includes(t.id)),
        { id: 'completed_orders', label: 'Listos', icon: NavIcons.orders },
        { id: '_waiter', label: 'Comanda', icon: NavIcons.waiter },
      ]
    : pinnedTabs;

  const pinnedIds = new Set(visibleTabs.map(t => t.id).filter(id => !id.startsWith('_')));
  const isMoreActive = !pinnedIds.has(activeTab) && activeTab !== '_servicio';

  const handleTabPress = (tabId) => {
    if (tabId === '_waiter') {
      navigate(`/${businessId}/waiter`);
      return;
    }
    if (tabId === '_servicio') {
      onOpenModoOp?.();
      return;
    }
    setActiveTab(tabId);
    setDrawerOpen(false);
  };

  return (
    <>
      <nav
        className="fixed bottom-0 inset-x-0 z-40 block lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="absolute inset-0 bg-white border-t border-slate-200/60 shadow-[0_-1px_20px_rgba(0,0,0,0.06)]" />

        <div className="relative flex items-center justify-around h-[58px] max-w-lg mx-auto px-1">
          {visibleTabs.map((tab) => {
            const isServicioTab = tab.id === '_servicio';
            const isActive = !isServicioTab && activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabPress(tab.id)}
                className="relative flex flex-col items-center justify-center flex-1 h-full active:scale-95 transition-transform duration-100"
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Active pill background (non-servicio tabs) */}
                {!isServicioTab && (
                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        layoutId="activeTabPill"
                        className="absolute inset-x-2 top-1.5 bottom-1.5 bg-red-50 rounded-2xl"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                      />
                    )}
                  </AnimatePresence>
                )}

                {/* Servicio tab: special pill with gradient */}
                {isServicioTab && (
                  <div className={`absolute inset-x-1.5 top-1.5 bottom-1.5 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/30`} />
                )}

                <div className={`relative z-10 flex flex-col items-center gap-[3px]`}>
                  <div className="relative">
                    {/* Pulsing ring for Servicio when pending orders */}
                    {isServicioTab && pendingOrdersCount > 0 && (
                      <motion.div
                        animate={{ scale: [1, 1.6, 1], opacity: [0.7, 0, 0.7] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute inset-0 rounded-full bg-white/50 -m-1"
                      />
                    )}
                    <div className={`transition-colors duration-200 ${
                      isServicioTab ? 'text-white' : isActive ? 'text-red-500' : 'text-slate-400'
                    }`}>
                      {tab.icon(isActive)}
                    </div>
                    {/* Badge (non-servicio tabs) */}
                    {!isServicioTab && tab.badge > 0 && (
                      <motion.span
                        key={tab.badge}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                        className="absolute -top-1.5 -right-2.5 flex items-center justify-center min-w-[18px] h-[18px] px-[4px] rounded-full text-[10px] font-bold bg-red-500 text-white leading-none shadow-md shadow-red-500/30 ring-2 ring-white"
                      >
                        {tab.badge > 99 ? '99+' : tab.badge}
                      </motion.span>
                    )}
                    {/* Servicio pending dot */}
                    {isServicioTab && pendingOrdersCount > 0 && (
                      <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center ring-1 ring-white">
                        {pendingOrdersCount > 9 ? '9+' : pendingOrdersCount}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-semibold leading-none transition-colors duration-200 ${
                    isServicioTab ? 'text-white' : isActive ? 'text-red-500' : 'text-slate-400'
                  }`}>
                    {tab.label}
                  </span>
                </div>
              </button>
            );
          })}

          {/* Más button */}
          {!isStaff && (
            <button
              onClick={() => setDrawerOpen(true)}
              className="relative flex flex-col items-center justify-center flex-1 h-full active:scale-95 transition-transform duration-100"
              aria-label="Más opciones"
            >
              <AnimatePresence>
                {isMoreActive && (
                  <motion.div
                    layoutId="activeTabPill"
                    className="absolute inset-x-2 top-1.5 bottom-1.5 bg-red-50 rounded-2xl"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  />
                )}
              </AnimatePresence>
              <div className="relative z-10 flex flex-col items-center gap-[3px]">
                <div className={`transition-colors duration-200 ${isMoreActive ? 'text-red-500' : 'text-slate-400'}`}>
                  {NavIcons.more()}
                </div>
                <span className={`text-[10px] font-semibold leading-none transition-colors duration-200 ${isMoreActive ? 'text-red-500' : 'text-slate-400'}`}>
                  Más
                </span>
              </div>
            </button>
          )}
        </div>
      </nav>

      <MobileNavDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeTab={activeTab}
        setActiveTab={handleTabPress}
        businessConfig={businessConfig}
        handleLogout={handleLogout}
        userRole={userRole}
        pinnedIds={pinnedIds}
      />
    </>
  );
}
