import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaChartBar, FaClipboardList, FaCheckCircle, FaHamburger,
  FaEllipsisH, FaCalendarAlt, FaTools
} from 'react-icons/fa';
import MobileNavDrawer from './MobileNavDrawer';

/**
 * MobileBottomNav — Fixed bottom navigation for mobile (<1024px).
 * 5 tabs: Dashboard, Pedidos (with badge), Completados, Menú, Más (drawer).
 */
export default function MobileBottomNav({ activeTab, setActiveTab, pendingOrdersCount, businessConfig, handleLogout, userRole }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);
  const isStaff = userRole === 'staff';

  // The 4 pinned tabs + "Más"
  const pinnedTabs = [
    { id: 'dashboard', label: 'Inicio', Icon: FaChartBar },
    { id: 'orders', label: isService ? 'Citas' : 'Pedidos', Icon: isService ? FaCalendarAlt : FaClipboardList, badge: pendingOrdersCount },
    { id: 'completed_orders', label: 'Listos', Icon: FaCheckCircle },
    { id: 'products', label: isService ? 'Servicios' : 'Menú', Icon: isService ? FaTools : FaHamburger },
  ];

  // Staff sees fewer tabs
  const visibleTabs = isStaff
    ? pinnedTabs.filter(t => ['orders', 'completed_orders'].includes(t.id))
    : pinnedTabs;

  // IDs that live in the bottom bar (not in drawer)
  const pinnedIds = new Set(visibleTabs.map(t => t.id));
  // "Más" is active when the current tab isn't one of the pinned ones
  const isMoreActive = !pinnedIds.has(activeTab);

  const handleTabPress = (tabId) => {
    setActiveTab(tabId);
    setDrawerOpen(false);
  };

  return (
    <>
      {/* Bottom Nav Bar */}
      <nav
        className="fixed bottom-0 inset-x-0 z-50 block lg:hidden bg-white border-t border-slate-200 shadow-[0_-1px_6px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-stretch justify-around h-16 max-w-lg mx-auto">
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const TabIcon = tab.Icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabPress(tab.id)}
                className="relative flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[48px] transition-colors"
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Active indicator pill */}
                {isActive && (
                  <motion.div
                    layoutId="mobileNavIndicator"
                    className="absolute top-1 w-8 h-1 rounded-full bg-blue-500"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}

                <div className="relative">
                  <TabIcon className={`text-lg transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  {/* Badge */}
                  {tab.badge > 0 && (
                    <motion.span
                      key={tab.badge}
                      initial={{ scale: 0.5 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1.5 -right-2.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-red-500 text-white leading-none"
                    >
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </motion.span>
                  )}
                </div>

                <span className={`text-[10px] font-medium leading-tight transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}

          {/* "Más" tab — opens drawer */}
          {!isStaff && (
            <button
              onClick={() => setDrawerOpen(true)}
              className="relative flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[48px] transition-colors"
              aria-label="Más opciones"
            >
              {isMoreActive && (
                <motion.div
                  layoutId="mobileNavIndicator"
                  className="absolute top-1 w-8 h-1 rounded-full bg-blue-500"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <FaEllipsisH className={`text-lg transition-colors ${isMoreActive ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className={`text-[10px] font-medium leading-tight transition-colors ${isMoreActive ? 'text-blue-600' : 'text-slate-400'}`}>
                Más
              </span>
            </button>
          )}
        </div>
      </nav>

      {/* Drawer with all sections */}
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
