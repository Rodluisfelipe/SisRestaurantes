import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import SubscriptionStatus from './SubscriptionStatus';
import GuideOverlay from './Admin/GuideOverlay';
import BranchSwitcher from './Admin/BranchSwitcher';
import {
  FaHamburger, FaTools, FaSignOutAlt, FaChevronDown, FaQuestionCircle, FaExternalLinkAlt,
  FaMotorcycle, FaShoppingBag, FaChevronLeft, FaPlus,
} from 'react-icons/fa';
import { seccionesDelPanel } from '../utils/navegacionAdmin';

const ModernAdminSidebar = ({ activeTab, setActiveTab, businessConfig, handleLogout, pendingOrdersCount, whatsappSinLeer, subscriptionData, onboarding, userRole, colapsado = false, onAlternar, onNuevoPedido }) => {
  const navigate = useNavigate();
  const isStaff = userRole === 'staff';
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);
  const isHotel = businessConfig?.businessType === 'hotel';
  // Guide overlay state
  const [guideSection, setGuideSection] = useState(null);

  // Daily pickup code — shown to the restaurant so they can give it to the domi
  const [pickupCode, setPickupCode] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  useEffect(() => {
    if (!businessConfig?.slug || isService || isHotel) return;
    let cancelled = false;
    const fetchCode = () => api.get(`/delivery-admin/restaurants/${businessConfig.slug}/daily-pickup-code`)
      .then(r => { if (!cancelled) setPickupCode(r.data?.code || null); })
      .catch(() => {});
    fetchCode();
    // refresh hourly so it rolls over at midnight without a reload
    const iv = setInterval(fetchCode, 60 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [businessConfig?.slug, isService, isHotel]);

  const copyPickupCode = () => {
    if (!pickupCode) return;
    navigator.clipboard?.writeText(pickupCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1500);
  };
  // Mismo menú que el celular (utils/navegacionAdmin), ordenado por uso real.
  const filteredSections = seccionesDelPanel({
    businessConfig,
    esPersonal: isStaff,
    pedidosPendientes: pendingOrdersCount,
    whatsappSinLeer,
  });

  // "Más herramientas" arranca plegada: es lo que casi nadie usa.
  const [collapsedSections, setCollapsedSections] = useState({ mas: true });

  const getActiveSectionId = useCallback(() => {
    for (const section of filteredSections) {
      if (section.items.some(item => item.id === activeTab)) {
        return section.id;
      }
    }
    return 'dia';
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
        {/* El logo y el nombre llevan a Inicio. */}
        <button
          type="button"
          onClick={() => !isStaff && setActiveTab('dashboard')}
          title={isStaff ? undefined : 'Ir a Inicio'}
          className="w-full flex items-center gap-3 text-left rounded-xl -m-1 p-1 hover:bg-slate-50 transition-colors">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-md">
              {businessConfig?.logo ? (
                <img 
                  src={businessConfig.logo} 
                  alt={businessConfig?.businessName || 'Logo'} 
                  className="w-10 h-10 rounded-lg object-cover"
                />
              ) : (
                isService ? <FaTools className="text-white text-lg" /> : <FaHamburger className="text-white text-lg" />
              )}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <h1 className="text-sm font-bold text-slate-800 break-words leading-tight">
                {businessConfig?.businessName || 'Mi Negocio'}
              </h1>
              {subscriptionData?.subscription?.planType === 'annual' && subscriptionData?.isActive && (
                <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-gradient-to-r from-violet-100 to-purple-100 border border-violet-200/60" title="Plan Anual PRO">
                  <svg className="w-2.5 h-2.5 text-violet-500" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 2l2.5 4 4.5-1.5-2 5L16 16H4l1-6.5-2-5L7.5 6z" />
                  </svg>
                  <span className="text-[7px] font-black text-violet-600 uppercase tracking-wider leading-none">PRO</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Sistema de gestión</p>
          </div>
        </button>
      </div>

      {/* Branch Switcher (brand_admin only) */}
      <BranchSwitcher />

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

      {/* Lo que más se hace en el panel, siempre a la vista: el 89 % de los
          pedidos se crean acá, a mano. */}
      <div className="px-4 pb-3 space-y-2">
        {onNuevoPedido && (
          <button
            onClick={onNuevoPedido}
            className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-red-600 text-white text-sm font-bold shadow-sm hover:bg-red-700 active:scale-[0.98] transition"
          >
            <FaPlus className="text-xs" />
            {isService ? 'Nueva cita' : 'Nuevo pedido'}
          </button>
        )}
      </div>

      {/* Daily pickup code — restaurant gives it to the domi on arrival */}
      {pickupCode && (
        <div className="px-4 pb-3">
          <button
            onClick={copyPickupCode}
            title="Código de recogida de hoy — clic para copiar"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200/80 bg-red-50 hover:bg-red-100 transition-all"
          >
            <FaMotorcycle className="text-[11px] shrink-0 text-red-500" />
            <span className="text-[11px] font-semibold text-red-700 flex-1 text-left">Código recogida</span>
            <span className="text-[13px] font-black text-red-600 tracking-wider tabular-nums">
              {copiedCode ? '¡copiado!' : pickupCode}
            </span>
          </button>
        </div>
      )}

      {/* Ver el menú como lo ve el cliente y abrir el POS, en una sola fila. */}
      {!isStaff && (businessConfig?.slug || businessConfig?.features?.posBetaEnabled) && (
        <div className="px-4 pb-3 grid grid-cols-2 gap-2">
          {businessConfig?.slug && (
            <a
              href={`https://menuby.tech/${businessConfig.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`menuby.tech/${businessConfig.slug}`}
              className="h-9 flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200/80 bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold text-emerald-700 transition-colors"
            >
              <FaExternalLinkAlt className="text-2xs" />
              {isService ? 'Ver servicios' : 'Ver menú'}
            </a>
          )}
          {businessConfig?._id && businessConfig?.features?.posBetaEnabled && (
            <a
              href={`/${businessConfig.slug || businessConfig._id}/pos`}
              title="Abrir el punto de venta para cobrar"
              className="h-9 flex items-center justify-center gap-1.5 rounded-lg border border-purple-200/80 bg-purple-50 hover:bg-purple-100 text-xs font-semibold text-purple-700 transition-colors"
            >
              <FaShoppingBag className="text-2xs" />
              Abrir POS
            </a>
          )}
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
                  <FaChevronDown className="text-2xs text-slate-300 group-hover:text-slate-500 transition-colors" />
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
                              onClick={() => {
                                // `navigate` y no `location.href`: no recarga la aplicación.
                                if (item.ruta) {
                                  navigate(`/${businessConfig?.slug || businessConfig?._id}/${item.ruta}`);
                                  return;
                                }
                                setActiveTab(item.id);
                              }}
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
                                  className="ml-1 px-1.5 py-0.5 text-2xs font-bold uppercase rounded-full bg-amber-100 text-amber-600 border border-amber-200/80 cursor-default"
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
                                className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-2xs font-bold bg-red-500 text-white shadow-sm"
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
      {/* Desktop Sidebar.
          Plegable: secciones como los chats o el POS se trabajan mucho mejor a
          ancho completo, y el menú son 256px que ahí no hacen falta. El ancho
          se anima en CSS y no con framer porque el contenido principal es
          `flex-1`: así crece a la par, sin dar un salto al terminar. */}
      <motion.div
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`hidden lg:block bg-white h-screen sticky top-0 shadow-sm overflow-hidden transition-[width] duration-300 ease-out ${
          colapsado ? 'w-0 border-r-0' : 'w-64 border-r border-slate-200'
        }`}
        aria-hidden={colapsado}
      >
        {sidebarContent}
      </motion.div>

      {/* La pestaña para plegarlo y desplegarlo. Va pegada al borde del menú y
          se mueve con él, así que al plegarlo queda en el filo de la pantalla:
          es la única forma de volver a abrirlo, y tiene que verse. */}
      {onAlternar && (
        <button
          onClick={onAlternar}
          title={colapsado ? 'Mostrar el menú' : 'Ocultar el menú'}
          aria-label={colapsado ? 'Mostrar el menú' : 'Ocultar el menú'}
          className={`hidden lg:flex fixed top-1/2 -translate-y-1/2 z-50 items-center justify-center w-5 h-20 rounded-r-xl bg-white border border-l-0 border-slate-200 shadow-md text-slate-400 hover:text-slate-800 hover:w-6 transition-all duration-300 ease-out ${
            colapsado ? 'left-0' : 'left-64'
          }`}
        >
          <FaChevronLeft className={`text-[11px] transition-transform duration-300 ${colapsado ? 'rotate-180' : ''}`} />
        </button>
      )}

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
