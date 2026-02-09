import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SubscriptionStatus from './SubscriptionStatus';
import { 
  FaClipboardList, FaHamburger, FaSortAmountDown, FaFolderOpen, 
  FaCheese, FaUsers, FaTicketAlt, FaChair, FaMapMarkedAlt, 
  FaCheckCircle, FaBullhorn, FaWhatsapp, FaCreditCard, FaCog, 
  FaPalette, FaMapMarkerAlt, FaLock, FaSignOutAlt, FaChevronDown,
  FaHome, FaShoppingBag, FaStore, FaTools
} from 'react-icons/fa';

const ModernAdminSidebar = ({ activeTab, setActiveTab, businessConfig, handleLogout, pendingOrdersCount }) => {
  // Grouped menu sections
  const menuSections = [
    {
      id: 'main',
      label: 'Principal',
      icon: FaHome,
      items: [
        { id: 'dashboard', label: 'Dashboard', Icon: FaHome, badge: null },
        { id: 'orders', label: 'Pedidos', Icon: FaClipboardList, badge: pendingOrdersCount },
        { id: 'completed_orders', label: 'Completados', Icon: FaCheckCircle, badge: null },
      ]
    },
    {
      id: 'menu',
      label: 'Menú',
      icon: FaShoppingBag,
      items: [
        { id: 'products', label: 'Productos', Icon: FaHamburger, badge: null },
        { id: 'product-order', label: 'Orden', Icon: FaSortAmountDown, badge: null },
        { id: 'categories', label: 'Categorías', Icon: FaFolderOpen, badge: null },
        { id: 'toppings', label: 'Extras', Icon: FaCheese, badge: null },
      ]
    },
    {
      id: 'clients',
      label: 'Clientes',
      icon: FaUsers,
      items: [
        { id: 'customers', label: 'Clientes', Icon: FaUsers, badge: null },
        { id: 'coupons', label: 'Cupones', Icon: FaTicketAlt, badge: null },
        { id: 'tables', label: 'Mesas', Icon: FaChair, badge: null },
        { id: 'delivery-zones', label: 'Zonas de Entrega', Icon: FaMapMarkedAlt, badge: null },
      ]
    },
    {
      id: 'marketing',
      label: 'Marketing',
      icon: FaBullhorn,
      items: [
        { id: 'catalog', label: 'Catálogo', Icon: FaBullhorn, badge: null },
        { id: 'whatsapp', label: 'WhatsApp', Icon: FaWhatsapp, badge: null },
      ]
    },
    {
      id: 'settings',
      label: 'Configuración',
      icon: FaTools,
      items: [
        { id: 'subscription', label: 'Suscripción', Icon: FaCreditCard, badge: null },
        { id: 'business', label: 'Negocio', Icon: FaStore, badge: null },
        { id: 'theme', label: 'Tema', Icon: FaPalette, badge: null },
        { id: 'location', label: 'Ubicación', Icon: FaMapMarkerAlt, badge: null },
        { id: 'change-password', label: 'Contraseña', Icon: FaLock, badge: null },
      ]
    },
  ];

  // Track which sections are collapsed
  const [collapsedSections, setCollapsedSections] = useState({});

  // Determine which section the active tab belongs to
  const getActiveSectionId = useCallback(() => {
    for (const section of menuSections) {
      if (section.items.some(item => item.id === activeTab)) {
        return section.id;
      }
    }
    return 'main';
  }, [activeTab]);

  const toggleSection = (sectionId) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const isSectionCollapsed = (sectionId) => {
    // By default, all sections are expanded; active section is never collapsed
    if (getActiveSectionId() === sectionId) return false;
    return collapsedSections[sectionId] || false;
  };

  const SidebarContent = () => (
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="p-5 pb-3">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <div className="relative">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/20 ring-2 ring-white/10">
              {businessConfig?.logo ? (
                <img 
                  src={businessConfig.logo} 
                  alt={businessConfig?.businessName || 'Logo'} 
                  className="w-9 h-9 rounded-lg object-cover"
                />
              ) : (
                <FaHamburger className="text-white text-lg" />
              )}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-slate-900" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold text-white truncate leading-tight">
              {businessConfig?.businessName || 'Mi Restaurante'}
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">Panel de gestión</p>
          </div>
        </motion.div>
      </div>

      {/* Subscription Status */}
      {businessConfig && businessConfig._id && (
        <div className="px-4 pb-3">
          <SubscriptionStatus 
            businessId={businessConfig._id}
            onNavigateToSubscription={() => setActiveTab('subscription')}
            compact={true}
          />
        </div>
      )}

      {/* Divider */}
      <div className="mx-4 border-t border-white/5" />

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {menuSections.map((section) => {
          const isCollapsed = isSectionCollapsed(section.id);
          const SectionIcon = section.icon;
          const hasActiveItem = section.items.some(item => item.id === activeTab);
          const hasBadge = section.items.some(item => item.badge && item.badge > 0);

          return (
            <div key={section.id} className="mb-1">
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all duration-200 group ${
                  hasActiveItem 
                    ? 'text-white' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <SectionIcon className="text-[10px] opacity-60" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">{section.label}</span>
                  {hasBadge && !isCollapsed === false && (
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  )}
                </div>
                <motion.div
                  animate={{ rotate: isCollapsed ? -90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <FaChevronDown className="text-[9px] opacity-40 group-hover:opacity-70 transition-opacity" />
                </motion.div>
              </button>

              {/* Section items */}
              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-0.5 py-0.5">
                      {section.items.map((item) => {
                        const isActive = activeTab === item.id;
                        const ItemIcon = item.Icon;

                        return (
                          <motion.button
                            key={item.id}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center justify-between pl-5 pr-3 py-2 rounded-lg text-left transition-all duration-150 group relative ${
                              isActive
                                ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/10 text-white'
                                : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                            }`}
                          >
                            {/* Active indicator bar */}
                            {isActive && (
                              <motion.div
                                layoutId="activeIndicator"
                                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-gradient-to-b from-blue-400 to-purple-500 rounded-full"
                                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                              />
                            )}

                            <div className="flex items-center gap-2.5 min-w-0">
                              <ItemIcon className={`text-sm shrink-0 transition-colors ${
                                isActive 
                                  ? 'text-blue-400' 
                                  : 'text-slate-500 group-hover:text-slate-300'
                              }`} />
                              <span className={`text-[13px] truncate transition-colors ${
                                isActive ? 'font-semibold' : 'font-medium'
                              }`}>
                                {item.label}
                              </span>
                            </div>

                            {/* Badge */}
                            {item.badge != null && item.badge > 0 && (
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-red-500 text-white shadow-lg shadow-red-500/30"
                              >
                                {item.badge > 99 ? '99+' : item.badge}
                              </motion.span>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-3 pt-2 border-t border-white/5">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200 group"
        >
          <FaSignOutAlt className="text-sm group-hover:translate-x-0.5 transition-transform" />
          <span className="text-[13px] font-medium">Cerrar Sesión</span>
        </motion.button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.div 
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="hidden lg:block w-64 min-h-screen sticky top-0 shadow-2xl shadow-black/20"
      >
        <SidebarContent />
      </motion.div>
    </>
  );
};

export default ModernAdminSidebar;
