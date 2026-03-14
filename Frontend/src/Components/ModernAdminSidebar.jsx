import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SubscriptionStatus from './SubscriptionStatus';
import GuideOverlay from './Admin/GuideOverlay';
import { 
  FaClipboardList, FaHamburger, FaSortAmountDown, FaFolderOpen, 
  FaCheese, FaUsers, FaTicketAlt, FaChair, FaMapMarkedAlt, FaMotorcycle,
  FaCheckCircle, FaBullhorn, FaWhatsapp, FaCreditCard,
  FaPalette, FaMapMarkerAlt, FaLock, FaSignOutAlt, FaChevronDown,
  FaShoppingBag, FaStore, FaTools, FaCog, FaMoneyBillWave, FaStar, FaGift,
  FaQuestionCircle, FaExternalLinkAlt, FaChartBar, FaPrint, FaCashRegister,
  FaCalendarAlt
} from 'react-icons/fa';

const ModernAdminSidebar = ({ activeTab, setActiveTab, businessConfig, handleLogout, pendingOrdersCount, subscriptionData, onboarding, userRole }) => {
  const isStaff = userRole === 'staff';
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);
  // Guide overlay state
  const [guideSection, setGuideSection] = useState(null);
  // Grouped menu sections — same items as original sidebar
  const menuSections = [
    {
      id: 'operations',
      label: 'Operaciones',
      items: [
        { id: 'orders', label: isService ? 'Citas' : 'Pedidos', Icon: isService ? FaCalendarAlt : FaClipboardList, badge: pendingOrdersCount },
        { id: 'completed_orders', label: 'Completados', Icon: FaCheckCircle, badge: null },
        ...(businessConfig?.features?.posBetaEnabled ? [{ id: 'cash-closings', label: 'Cierres de Caja', Icon: FaCashRegister, badge: null }] : []),
        ...(businessConfig?.enableBookings ? [{ id: 'bookings', label: 'Agenda', Icon: FaCalendarAlt, badge: null }] : []),
      ]
    },
    {
      id: 'menu',
      label: isService ? 'Servicios' : 'Menú',
      items: [
        { id: 'products', label: isService ? 'Servicios' : 'Productos', Icon: isService ? FaTools : FaHamburger, badge: null },
        { id: 'product-order', label: 'Orden', Icon: FaSortAmountDown, badge: null },
        { id: 'categories', label: 'Categorías', Icon: FaFolderOpen, badge: null },
        { id: 'toppings', label: isService ? 'Opciones' : 'Extras', Icon: isService ? FaCog : FaCheese, badge: null },
      ]
    },
    {
      id: 'clients',
      label: 'Clientes y Servicio',
      items: [
        { id: 'customers', label: 'Clientes', Icon: FaUsers, badge: null },
        { id: 'coupons', label: 'Cupones', Icon: FaTicketAlt, badge: null },
        { id: 'loyalty', label: 'Fidelidad', Icon: FaGift, badge: null, beta: true },
        { id: 'reviews', label: 'Reseñas', Icon: FaStar, badge: null },
        ...(!isService ? [{ id: 'tables', label: 'Mesas', Icon: FaChair, badge: null }] : []),
        ...(!isService ? [{ id: 'delivery-zones', label: 'Zonas', Icon: FaMapMarkedAlt, badge: null }] : []),
        ...(!isService ? [{ id: 'delivery', label: 'Domiciliarios', Icon: FaMotorcycle, badge: null }] : []),
      ]
    },
    {
      id: 'marketing',
      label: 'Marketing',
      items: [
        { id: 'catalog', label: 'Catálogo', Icon: FaBullhorn, badge: null },
        { id: 'whatsapp', label: 'WhatsApp', Icon: FaWhatsapp, badge: null },
        { id: 'payment-config', label: 'Pagos', Icon: FaMoneyBillWave, badge: null },
      ]
    },
    {
      id: 'settings',
      label: 'Configuración',
      items: [
        { id: 'subscription', label: 'Suscripción', Icon: FaCreditCard, badge: null },
        { id: 'team', label: 'Equipo', Icon: FaUsers, badge: null },
        { id: 'business', label: 'Negocio', Icon: FaStore, badge: null },
        { id: 'printer', label: 'Impresoras', Icon: FaPrint, badge: null },
        { id: 'theme', label: 'Tema', Icon: FaPalette, badge: null },
        { id: 'location', label: 'Ubicación', Icon: FaMapMarkerAlt, badge: null },
        { id: 'change-password', label: 'Contraseña', Icon: FaLock, badge: null },
      ]
    },
  ];

  // Staff tabs whitelist
  const STAFF_ALLOWED_TABS = ['orders', 'completed_orders', 'cash-closings', 'change-password'];
  const filteredSections = isStaff
    ? menuSections
        .map(section => ({
          ...section,
          items: section.items.filter(item => STAFF_ALLOWED_TABS.includes(item.id))
        }))
        .filter(section => section.items.length > 0)
    : menuSections;

  const [collapsedSections, setCollapsedSections] = useState({});

  const getActiveSectionId = useCallback(() => {
    for (const section of filteredSections) {
      if (section.items.some(item => item.id === activeTab)) {
        return section.id;
      }
    }
    return 'operations';
  }, [activeTab, filteredSections]);

  const toggleSection = (sectionId) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const isSectionCollapsed = (sectionId) => {
    if (getActiveSectionId() === sectionId) return false;
    return collapsedSections[sectionId] || false;
  };

  const sidebarContent = (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-md">
              {businessConfig?.logo ? (
                <img 
                  src={businessConfig.logo} 
                  alt={businessConfig?.businessName || 'Logo'} 
                  className="w-10 h-10 rounded-lg object-cover"
                />
              ) : (
                <FaHamburger className="text-white text-lg" />
              )}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold text-slate-800 truncate leading-tight">
              {businessConfig?.businessName || 'Mi Negocio'}
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">Sistema de gestión</p>
          </div>
        </div>
      </div>

      {/* Subscription Status */}
      {businessConfig && businessConfig._id && subscriptionData && !isStaff && (
        <div className="px-4 pb-3">
          <SubscriptionStatus 
            {...subscriptionData}
            onNavigateToSubscription={() => setActiveTab('subscription')}
            compact={true}
          />
        </div>
      )}

      {/* Dashboard Button */}
      {!isStaff && (
      <div className="px-4 pb-2">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all duration-200 ${
            activeTab === 'dashboard'
              ? 'bg-blue-50 border-blue-200/80 shadow-sm'
              : 'bg-white border-slate-200/80 hover:bg-slate-50'
          }`}
        >
          <FaChartBar className={`text-sm shrink-0 ${
            activeTab === 'dashboard' ? 'text-blue-600' : 'text-slate-400'
          }`} />
          <span className={`text-xs font-bold ${
            activeTab === 'dashboard' ? 'text-blue-700' : 'text-slate-600'
          }`}>Dashboard</span>
        </button>
      </div>
      )}

      {/* Orders Indicator Card */}
      <div className="px-4 pb-3">
        <button
          onClick={() => setActiveTab('orders')}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200 ${
            pendingOrdersCount > 0
              ? 'bg-red-50 border-red-200/80 hover:bg-red-100'
              : activeTab === 'orders'
                ? 'bg-blue-50 border-blue-200/80'
                : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100'
          }`}
        >
          <FaClipboardList className={`text-sm shrink-0 ${
            pendingOrdersCount > 0 ? 'text-red-500' : 'text-slate-400'
          }`} />
          <span className="text-[11px] font-semibold text-slate-700 flex-1 text-left">
            {isService ? 'Citas' : 'Pedidos'}
          </span>
          {pendingOrdersCount > 0 ? (
            <motion.span
              key={pendingOrdersCount}
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-red-500 text-white"
            >
              {pendingOrdersCount > 99 ? '99+' : pendingOrdersCount}
            </motion.span>
          ) : (
            <span className="text-[10px] font-medium text-slate-400">0</span>
          )}
        </button>
      </div>

      {/* Ver Menú Button */}
      {businessConfig?.slug && !isStaff && (
        <div className="px-4 pb-3">
          <a
            href={`https://menuby.tech/${businessConfig.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-200/80 bg-emerald-50 hover:bg-emerald-100 transition-all duration-200 group"
          >
            <FaExternalLinkAlt className="text-[11px] shrink-0 text-emerald-500" />
            <span className="text-[11px] font-semibold text-emerald-700 flex-1 text-left">
              {isService ? 'Ver Servicios' : 'Ver Menú'}
            </span>
            <span className="text-[9px] text-emerald-400 font-medium truncate max-w-[80px]">
              /{businessConfig.slug}
            </span>
          </a>
        </div>
      )}

      {/* Punto de Venta Button */}
      {businessConfig?._id && businessConfig?.features?.posBetaEnabled && (
        <div className="px-4 pb-3">
          <a
            href={`/${businessConfig.slug || businessConfig._id}/pos`}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-purple-200/80 bg-purple-50 hover:bg-purple-100 transition-all duration-200 group"
          >
            <FaShoppingBag className="text-[11px] shrink-0 text-purple-500" />
            <span className="text-[11px] font-semibold text-purple-700 flex-1 text-left">
              Punto de Venta
            </span>
            <FaExternalLinkAlt className="text-[9px] text-purple-300" />
          </a>
        </div>
      )}

      {/* Divider */}
      <div className="mx-4 border-t border-slate-100" />

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {filteredSections.map((section) => {
          const isCollapsed = isSectionCollapsed(section.id);
          const hasActiveItem = section.items.some(item => item.id === activeTab);
          const hasBadge = section.items.some(item => item.badge && item.badge > 0);

          return (
            <div key={section.id} className="mb-0.5">
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all duration-200 group"
              >
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${
                    hasActiveItem ? 'text-blue-600' : 'text-slate-400'
                  }`}>
                    {section.label}
                  </span>
                  {hasBadge && isCollapsed && (
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  )}
                </div>
                <motion.div
                  animate={{ rotate: isCollapsed ? -90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <FaChevronDown className="text-[9px] text-slate-300 group-hover:text-slate-500 transition-colors" />
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
                          <div key={item.id} className="flex items-center group/item">
                            <motion.button
                              whileTap={{ scale: 0.97 }}
                              onClick={() => setActiveTab(item.id)}
                              className={`flex-1 flex items-center justify-between pl-4 pr-3 py-2 rounded-lg text-left transition-all duration-150 group relative ${
                                isActive
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                              }`}
                            >
                            {/* Active indicator bar */}
                            {isActive && (
                              <motion.div
                                layoutId="activeIndicator"
                                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-500 rounded-full"
                                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                              />
                            )}

                            <div className="flex items-center gap-2.5 min-w-0">
                              <ItemIcon className={`text-sm shrink-0 transition-colors ${
                                isActive 
                                  ? 'text-blue-500' 
                                  : 'text-slate-400 group-hover:text-slate-600'
                              }`} />
                              <span className={`text-[13px] truncate transition-colors ${
                                isActive ? 'font-semibold' : 'font-medium'
                              }`}>
                                {item.label}
                              </span>
                              {item.beta && (
                                <span
                                  className="ml-1 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-full bg-amber-100 text-amber-600 border border-amber-200/80 cursor-default"
                                  title="Función en fase experimental. Puede presentar errores menores."
                                >
                                  Beta
                                </span>
                              )}
                            </div>

                            {/* Badge */}
                            {item.badge != null && item.badge > 0 && (
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-red-500 text-white shadow-sm"
                              >
                                {item.badge > 99 ? '99+' : item.badge}
                              </motion.span>
                            )}
                          </motion.button>

                            {/* Guide (?) button */}
                            <button
                              onClick={(e) => { e.stopPropagation(); setGuideSection(item.id); }}
                              className="shrink-0 p-1 rounded-md text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-colors opacity-0 group-hover/item:opacity-100"
                              title="¿Cómo funciona?"
                            >
                              <FaQuestionCircle className="text-xs" />
                            </button>
                          </div>
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

      {/* Footer — Logout */}
      <div className="p-3 pt-2 border-t border-slate-100">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200 group"
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
        className="hidden lg:block w-64 bg-white min-h-screen border-r border-slate-200 sticky top-0 shadow-sm"
      >
        {sidebarContent}
      </motion.div>

      {/* Guide Overlay */}
      <GuideOverlay
        sectionId={guideSection}
        isOpen={!!guideSection}
        onClose={() => setGuideSection(null)}
      />
    </>
  );
};

export default ModernAdminSidebar;
