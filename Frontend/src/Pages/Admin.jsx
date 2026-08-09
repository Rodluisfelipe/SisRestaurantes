import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from "react";
import { useSearchParams } from 'react-router-dom';
import { useBusinessConfig } from "../Context/BusinessContext";
import { motion, AnimatePresence } from "framer-motion";

// ── EAGER: estructura, siempre visibles, modales globales y pestaña por defecto ──
import ModernAdminSidebar from "../Components/ModernAdminSidebar";
import SubscriptionStatus from "../Components/SubscriptionStatus";
import MultiSessionWarning from "../Components/MultiSessionWarning";
import PushNotificationToggle from "../Components/PushNotificationToggle";
import AdminDashboard from "../Components/Admin/AdminDashboard";
import AdminTabWrapper from "../Components/Admin/AdminTabWrapper";
import AdminHeader from "../Components/Admin/AdminHeader";
import PanelesRapidos from "../Components/Admin/PanelesRapidos";
import AdminToasts from "../Components/Admin/AdminToasts";
import ConfirmationModal from "../Components/Admin/ConfirmationModal";
import DeleteConfirmationModal from "../Components/Admin/DeleteConfirmationModal";
import OrderNotificationBanner from "../Components/Admin/OrderNotificationBanner";
import AdminSectionErrorBoundary from "../Components/Admin/AdminSectionErrorBoundary";
import AnnouncementPopup from "../Components/Admin/AnnouncementPopup";
import WelcomeWizard from "../Components/Admin/WelcomeWizard";
import MobileBottomNav from "../Components/Admin/MobileBottomNav";
import ModoOperacion from "../Components/Admin/ModoOperacion";
import MobileHeader from "../Components/Admin/MobileHeader";
import { CalculatorLauncher } from "../Components/Admin/Calculator";
import DesktopNudge from "../Components/Admin/DesktopNudge";

// ── LAZY: cada pestaña carga su código bajo demanda (code-split del Admin) ──
const BusinessSettings = lazy(() => import("../Components/BusinessSettings"));
const CategorySettings = lazy(() => import("../Components/CategorySettings"));
const ToppingGroupsManager = lazy(() => import("../Components/ToppingGroupsManager"));
const WhatsAppCustomizer = lazy(() => import("../Components/WhatsAppCustomizer"));
const ThemeSettings = lazy(() => import("../Components/ThemeSettings"));
const LocationSettings = lazy(() => import("../Components/LocationSettings"));
const BannerUpload = lazy(() => import("../Components/Catalog/BannerUpload"));
const RestaurantBannerView = lazy(() => import("../Components/Catalog/RestaurantBannerView"));
const ChangePassword = lazy(() => import("../Components/ChangePassword"));
const TableSettings = lazy(() => import("../Components/TableSettings"));
const ModernOrdersDashboard = lazy(() => import("../Components/ModernOrdersDashboard"));
const EnhancedCompletedOrders = lazy(() => import("../Components/EnhancedCompletedOrders"));
const CustomersManager = lazy(() => import("../Components/CustomersManager"));
const CouponsManager = lazy(() => import("../Components/CouponsManager"));
const LoyaltyManager = lazy(() => import("../Components/LoyaltyManager"));
const DeliveryZoneManager = lazy(() => import("../Components/DeliveryZoneManager"));
const PaymentConfig = lazy(() => import("../Components/Admin/PaymentConfig"));
const PrinterSettings = lazy(() => import("../Components/PrinterSettings"));
const PrintAgentConfig = lazy(() => import("../Components/Admin/PrintAgentConfig"));
const DomiStats = lazy(() => import("../Components/Delivery/DomiStats"));
const ProductManager = lazy(() => import("../Components/Admin/ProductManager"));
const InventoryManager = lazy(() => import("../Components/Admin/InventoryManager"));
const WhatsAppInbox = lazy(() => import("../Components/Admin/WhatsAppInbox"));
const FeaturedProductsManager = lazy(() => import("../Components/Admin/FeaturedProductsManager"));
const SubscriptionPayment = lazy(() => import("./SubscriptionPayment"));
const AdminReviews = lazy(() => import("../Components/Admin/AdminReviews"));
const AdminPopups = lazy(() => import("../Components/Admin/AdminPopups"));
const StaffManager = lazy(() => import("../Components/Admin/StaffManager"));
const BookingsManager = lazy(() => import("../Components/Admin/BookingsManager"));
const CashClosings = lazy(() => import("../Components/Admin/CashClosings"));
const MonthlyClosing = lazy(() => import("../Components/Admin/MonthlyClosing"));
const ReferralsPanel = lazy(() => import("../Components/Admin/ReferralsPanel"));
const CrewPanel = lazy(() => import("../Components/Admin/CrewPanel"));
const DashboardMetrics = lazy(() => import("../Components/Admin/DashboardMetrics"));
const Marketplace = lazy(() => import("../Components/Admin/Marketplace"));
const SupplierOrders = lazy(() => import("../Components/Admin/SupplierOrders"));
const WhatsAppCampaign = lazy(() => import("../Components/Admin/WhatsAppCampaign"));
const ToolsPanel = lazy(() => import("../Components/Admin/ToolsPanel"));
const BranchManager = lazy(() => import("../Components/Admin/BranchManager"));
const LinkPageSettings = lazy(() => import("../Components/Admin/LinkPageSettings"));

// Custom hooks
import useAdminAuth from "../hooks/useAdminAuth";
import useAdminData from "../hooks/useAdminData";
import useProductHandlers from "../hooks/useProductHandlers";
import useSubscriptionData from "../hooks/useSubscriptionData";
import useWhatsAppUnread from "../hooks/useWhatsAppUnread";
import useOnboarding from "../hooks/useOnboarding";

function Admin() {
  const { businessConfig } = useBusinessConfig();
  const { businessId: rawBusinessId } = useBusinessConfig();
  const businessId = useMemo(() => rawBusinessId, [rawBusinessId]);

  // --- Auth (SuperAdmin token, validacion, redirecciones) ---
  const { isAuthenticated, user, loading, logout, isSuperAdminMode } = useAdminAuth(businessId);

  // --- Subscription (una sola instancia, se pasa a sidebar + dashboard) ---
  const subscriptionData = useSubscriptionData(businessConfig?._id);
  /* Mensajes de WhatsApp esperando respuesta. Sin este aviso el negocio no se
     entera de que llego uno y sigue atendiendo desde el celular. */
  const whatsappSinLeer = useWhatsAppUnread(businessConfig?._id);

  // --- Onboarding (progressive unlock + guide system) ---
  const onboardingHook = useOnboarding();
  // Merge raw API data with utility functions for easy prop passing
  const onboardingData = onboardingHook.onboarding ? {
    ...onboardingHook.onboarding,
    getUnlockMessage: onboardingHook.getUnlockMessage,
    isSectionUnlocked: onboardingHook.isSectionUnlocked,
    showGuide: onboardingHook.showGuide,
    isGuideShown: onboardingHook.isGuideShown,
    refreshOnboarding: onboardingHook.refreshOnboarding,
  } : null;

  // --- Data (productos, categorias, toppings, socket, SSE) ---
  const {
    products, setProducts,
    categories,
    toppingGroups,
    dataLoading,
    pendingOrdersCount,
    newOrderNotification,
    showOrderBanner, setShowOrderBanner,
    notificationAudioRef,
    loadData,
  } = useAdminData(businessId);

  // --- Product handlers (CRUD, toggle, drag, formulario) ---
  const {
    form, setForm,
    touchedFields, setTouchedFields,
    editingProduct, setEditingProduct,
    showConfirmModal,
    showDeleteModal,
    productToDelete,
    successMessage, setSuccessMessage,
    errorMessage, setErrorMessage,
    showProductModal, setShowProductModal,
    draggedFeaturedItem,
    handleSubmit, confirmEdit,
    handleChange, handleBlur, handlePriceChange, handleToppingGroupsChange,
    handleEdit, handleDelete, confirmDelete,
    handleToggleProduct, handleToggleFeatured,
    handleFeaturedDragStart, handleFeaturedDragOver, handleFeaturedDragEnd,
    editProduct, deleteProduct,
    cancelEdit, cancelDelete,
  } = useProductHandlers({ businessId, products, setProducts, toppingGroups, loadData });

  // --- UI local ---
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTabRaw] = useState(() => {
    // Si viene de ePayco redirect con ?tab=subscription
    const tabParam = searchParams.get('tab');
    return tabParam || 'dashboard';
  });
  // iOS push/pop direction: 1=forward (right), -1=back (left)
  const directionRef = useRef(1);
  const setActiveTab = useCallback((newTab) => {
    directionRef.current = newTab === 'dashboard' ? -1 : 1;
    setActiveTabRaw(newTab);
    if (window.innerWidth < 1024) window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  const [activeCatalogTab, setActiveCatalogTab] = useState('upload');
  const [showWelcome, setShowWelcome] = useState(false);
  const [modoOpOpen, setModoOpOpen] = useState(false);

  /* Menú lateral plegado. Se recuerda entre sesiones: quien lo pliega para
     trabajar los chats a pantalla ancha no quiere volver a plegarlo cada vez
     que entra. */
  const [sidebarColapsado, setSidebarColapsado] = useState(
    () => localStorage.getItem('menuby.sidebarColapsado') === '1'
  );
  const alternarSidebar = useCallback(() => {
    setSidebarColapsado((v) => {
      localStorage.setItem('menuby.sidebarColapsado', v ? '0' : '1');
      return !v;
    });
  }, []);

  /* Modo pantalla completa: la sección sola, sin menú lateral ni cabeceras,
     con la barra de los tres paneles arriba. Es como se atiende de verdad —
     los chats y el menú se trabajan a pantalla llena, no en una ventana con
     el panel alrededor. */
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const abrirPanel = useCallback((panel) => {
    // El POS no es una sección del panel, es su propia pantalla.
    if (panel.ruta) {
      window.location.href = `/${businessConfig?.slug || businessConfig?._id}/pos`;
      return;
    }
    setActiveTab(panel.id);
    setPantallaCompleta(true);
  }, [businessConfig?.slug, businessConfig?._id, setActiveTab]);

  /* Escape sale, como en cualquier pantalla completa. Sin esto, quien entra
     sin querer no sabe cómo volver. */
  useEffect(() => {
    if (!pantallaCompleta) return undefined;
    const alTeclear = (e) => { if (e.key === 'Escape') setPantallaCompleta(false); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [pantallaCompleta]);

  // Limpiar params de URL después de leerlos (no mostrar ?tab=... en la barra)
  useEffect(() => {
    if (searchParams.has('tab')) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('tab');
      setSearchParams(newParams, { replace: true });
    }
  }, []);

  // Staff role tab guard — restrict to allowed tabs only
  const STAFF_ALLOWED_TABS = ['orders', 'completed_orders', 'cash-closings', 'change-password'];
  useEffect(() => {
    if (user?.role === 'staff' && !STAFF_ALLOWED_TABS.includes(activeTab)) {
      setActiveTab('orders');
    }
    // Staff also blocked from team tab
    if (user?.role === 'staff' && activeTab === 'team') {
      setActiveTab('orders');
    }
  }, [activeTab, user?.role]);

  // Show welcome wizard for new users on first visit
  useEffect(() => {
    if (onboardingData && !onboardingData.isLegacy && onboardingData.level < 6) {
      const wizardKey = `welcome_wizard_shown_${businessId}`;
      if (!localStorage.getItem(wizardKey)) {
        setShowWelcome(true);
        localStorage.setItem(wizardKey, '1');
      }
    }
  }, [onboardingData, businessId]);

  // Listener para navegacion desde componentes (evento custom)
  useEffect(() => {
    const handleNavigateToTab = (event) => {
      const tabName = event.detail;
      if (tabName && typeof tabName === 'string') {
        setActiveTab(tabName);
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
      }
    };
    window.addEventListener('navigateToTab', handleNavigateToTab);
    return () => window.removeEventListener('navigateToTab', handleNavigateToTab);
  }, []);

  // --- Early returns ---
  if (user && user.mustChangePassword) {
    return (
      <div className="min-h-screen bg-[#051C2C] flex items-center justify-center py-8 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-md w-full bg-[#333F50]/80 rounded-2xl shadow-xl overflow-hidden border border-[#333F50] p-8"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-center mb-6"
          >
            <h2 className="text-2xl font-bold text-white">Cambiar contrasena</h2>
            <p className="mt-2 text-sm text-[#D1D9FF]">
              Por seguridad, debes establecer una nueva contrasena antes de continuar.
            </p>
          </motion.div>
          <ChangePassword forceNoOldPassword />
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            onClick={logout}
            className="mt-6 w-full bg-red-500 text-white py-3 rounded-lg hover:bg-red-600 transition-colors font-medium"
          >
            Salir
          </motion.button>
        </motion.div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-red-100" />
            <motion.div className="absolute inset-0 rounded-full border-4 border-transparent border-t-red-500" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
            <motion.div className="absolute inset-2 rounded-full border-4 border-transparent border-b-red-600" animate={{ rotate: -360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div className="w-5 h-5 rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-lg" animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
            </div>
          </div>
          <h2 className="text-xl font-bold text-red-600 mb-1">Panel de Administracion</h2>
          <p className="text-slate-600 text-sm font-medium">Cargando...</p>
          <div className="flex justify-center space-x-1.5 mt-4">
            {[0, 1, 2].map((i) => (
              <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-red-500" animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  if (businessConfig && businessConfig.isActive === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#051C2C]">
        <img src={businessConfig.logo || 'https://placehold.co/150x150?text=Logo'} alt="Logo" className="w-32 h-32 mb-6 rounded-full object-cover border-4 border-[#333F50]" />
        <h1 className="text-2xl font-bold text-white mb-2">Panel desactivado</h1>
        <p className="text-[#D1D9FF] text-center max-w-md">Este negocio ha sido desactivado. Por favor, contacte al administrador para reactivar su acceso.</p>
      </div>
    );
  }

  // --- Main render ---
  return (
    <div className="min-h-screen bg-[#f5f5f7] lg:bg-gradient-to-br lg:from-slate-50 lg:to-slate-100 pt-safe">
      {/* SuperAdmin Badge */}
      {isSuperAdminMode && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="fixed top-4 right-4 z-[60] group"
          title="Modo SuperAdmin - Visualizacion del panel de administracion"
        >
          <div className="relative">
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-2 rounded-full shadow-lg flex items-center space-x-2 cursor-help">
              <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-xs sm:text-sm font-semibold hidden sm:inline">SuperAdmin</span>
            </div>
            <div className="hidden group-hover:block absolute top-full right-0 mt-2 w-64 bg-slate-900 text-white text-xs p-3 rounded-lg shadow-xl">
              <div className="flex items-start space-x-2">
                <svg className="h-4 w-4 mt-0.5 shrink-0 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>Estas viendo el panel como SuperAdmin. Los cambios aqui son solo de visualizacion.</p>
              </div>
              <div className="absolute -top-1 right-4 w-2 h-2 bg-slate-900 transform rotate-45"></div>
            </div>
          </div>
        </motion.div>
      )}

      <MultiSessionWarning />

      {/* Anuncios/novedades: ahora se muestran como barra inline en el AdminDashboard
          (Components/Admin/AnnouncementInlineBar.jsx), no como modal. */}
      {/* {!isSuperAdminMode && <AnnouncementPopup />} */}

      {/* Welcome Wizard for new users */}
      {showWelcome && (
        <WelcomeWizard
          onClose={() => setShowWelcome(false)}
          onGoToTab={(tab) => { setActiveTab(tab); setShowWelcome(false); }}
        />
      )}

      <div className={`flex ${pantallaCompleta ? 'h-dvh overflow-hidden' : 'min-h-screen'}`}>
        {/* Sidebar — en pantalla completa no va: es justo lo que estorba */}
        {!pantallaCompleta && (
          <ModernAdminSidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            businessConfig={businessConfig}
            handleLogout={logout}
            pendingOrdersCount={pendingOrdersCount}
            whatsappSinLeer={whatsappSinLeer}
            subscriptionData={subscriptionData}
            onboarding={onboardingData}
            userRole={user?.role}
            colapsado={sidebarColapsado}
            onAlternar={alternarSidebar}
          />
        )}

        {/* Main Content */}
        <div className={`flex-1 w-full lg:ml-0 ${pantallaCompleta ? 'flex flex-col min-w-0' : ''}`}>
          {pantallaCompleta ? (
            <PanelesRapidos
              variante="pleno"
              activo={activeTab}
              onIr={abrirPanel}
              onSalir={() => setPantallaCompleta(false)}
              whatsappSinLeer={whatsappSinLeer}
              posDisponible={!!businessConfig?.features?.posBetaEnabled}
            />
          ) : (
            /* Mobile Header — iOS nav bar style */
            <MobileHeader activeTab={activeTab} setActiveTab={setActiveTab} />
          )}

          {!pantallaCompleta && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="hidden lg:block bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40"
            >
              <AdminHeader
                activeTab={activeTab}
                onAbrirPanel={abrirPanel}
                whatsappSinLeer={whatsappSinLeer}
                posDisponible={!!businessConfig?.features?.posBetaEnabled}
              />
            </motion.div>
          )}

          {/* Audio para notificaciones */}
          <audio ref={notificationAudioRef} preload="auto">
            <source src="/audio/new-order-notification.mp3" type="audio/mpeg" />
          </audio>

          <div className={pantallaCompleta
            ? 'flex-1 min-h-0 flex flex-col p-3 sm:p-4'
            : 'p-4 sm:p-4 md:p-6 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:pb-6'}
          >
            {/* Banner de nuevo pedido */}
            <OrderNotificationBanner
              showOrderBanner={showOrderBanner}
              newOrderNotification={newOrderNotification}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              setShowOrderBanner={setShowOrderBanner}
            />

            {/* Invitación a configurar desde un computador. Solo en el inicio
                y en pantallas chicas: en las demás pestañas ya está trabajando
                y meterle un aviso ahí es estorbar. */}
            {activeTab === 'dashboard' && !pantallaCompleta && <DesktopNudge />}

            {/* Subscription Status — only on dashboard in mobile, all tabs on desktop.
                En pantalla completa no va: se pidió la sección sola. */}
            {businessConfig && businessConfig._id && !pantallaCompleta && (
              <div className={`mb-6 ${activeTab !== 'dashboard' ? 'hidden lg:block' : ''}`}>
                <SubscriptionStatus
                  {...subscriptionData}
                  onNavigateToSubscription={() => setActiveTab('subscription')}
                  compact={false}
                />
              </div>
            )}

            <AnimatePresence mode="wait" custom={directionRef.current}>
              <motion.div
                key={activeTab}
                custom={directionRef.current}
                variants={{
                  enter: (d) => ({ x: d > 0 ? 50 : -50, opacity: 0 }),
                  center: { x: 0, opacity: 1 },
                  exit: (d) => ({ x: d > 0 ? -50 : 50, opacity: 0 }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                /* En pantalla completa la sección tiene que poder ocupar todo
                   el alto disponible; si no, queda flotando arriba. */
                className={pantallaCompleta ? 'w-full flex-1 min-h-0 flex flex-col overflow-y-auto' : 'w-full'}
              >
                <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>}>
                {activeTab === 'dashboard' && (
                  <AdminDashboard
                    setActiveTab={setActiveTab}
                    pendingOrdersCount={pendingOrdersCount}
          whatsappSinLeer={whatsappSinLeer}
                    onboarding={onboardingData}
                    onOpenModoOp={() => setModoOpOpen(true)}
                    products={products}
                    categories={categories}
                    toppingGroups={toppingGroups}
                  />
                )}
                {activeTab === 'business' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <BusinessSettings />
                    <PushNotificationToggle businessId={businessId} userId={null} />
                  </AdminTabWrapper>
                )}
                {activeTab === 'printer' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <PrinterSettings />
                    <PrintAgentConfig />
                  </AdminTabWrapper>
                )}
                {activeTab === 'categories' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <CategorySettings categories={categories} />
                  </AdminTabWrapper>
                )}
                {activeTab === 'toppings' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <ToppingGroupsManager />
                  </AdminTabWrapper>
                )}
                {activeTab === 'tables' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <TableSettings />
                  </AdminTabWrapper>
                )}
                {activeTab === 'theme' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <ThemeSettings />
                  </AdminTabWrapper>
                )}
                {activeTab === 'location' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <LocationSettings />
                  </AdminTabWrapper>
                )}
                {activeTab === 'catalog' && (
                  <div className="space-y-4 md:space-y-6">
                    <button onClick={() => setActiveTab('dashboard')} className="lg:hidden flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-4 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      <span className="font-medium">Volver al inicio</span>
                    </button>
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4 md:mb-6">
                      <button onClick={() => setActiveCatalogTab('upload')} className={`px-4 py-2 sm:py-2.5 rounded-lg font-medium transition-colors text-sm sm:text-base ${activeCatalogTab === 'upload' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Subir Banners</button>
                      <button onClick={() => setActiveCatalogTab('view')} className={`px-4 py-2 sm:py-2.5 rounded-lg font-medium transition-colors text-sm sm:text-base ${activeCatalogTab === 'view' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Mis Banners</button>
                    </div>
                    {activeCatalogTab === 'upload' ? <BannerUpload /> : <RestaurantBannerView />}
                  </div>
                )}
                {activeTab === 'change-password' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <ChangePassword />
                  </AdminTabWrapper>
                )}
                {activeTab === 'orders' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <AdminSectionErrorBoundary sectionName="Pedidos" onGoBack={() => setActiveTab('dashboard')}>
                      <ModernOrdersDashboard />
                    </AdminSectionErrorBoundary>
                  </AdminTabWrapper>
                )}
                {activeTab === 'completed_orders' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <AdminSectionErrorBoundary sectionName="Pedidos Completados" onGoBack={() => setActiveTab('dashboard')}>
                      <EnhancedCompletedOrders />
                    </AdminSectionErrorBoundary>
                  </AdminTabWrapper>
                )}
                {activeTab === 'inventory' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <AdminSectionErrorBoundary sectionName="Inventario" onGoBack={() => setActiveTab('dashboard')}>
                      <InventoryManager />
                    </AdminSectionErrorBoundary>
                  </AdminTabWrapper>
                )}
                {activeTab === 'whatsapp-inbox' && (
                  /* En pantalla completa se salta el envoltorio de pestaña: ese
                     añade el botón de volver y separación vertical, y la bandeja
                     necesita el alto entero. */
                  pantallaCompleta ? (
                    <AdminSectionErrorBoundary sectionName="Chats WhatsApp" onGoBack={() => setPantallaCompleta(false)}>
                      <WhatsAppInbox pleno />
                    </AdminSectionErrorBoundary>
                  ) : (
                    <AdminTabWrapper setActiveTab={setActiveTab}>
                      <AdminSectionErrorBoundary sectionName="Chats WhatsApp" onGoBack={() => setActiveTab('dashboard')}>
                        <WhatsAppInbox />
                      </AdminSectionErrorBoundary>
                    </AdminTabWrapper>
                  )
                )}
                {activeTab === 'monthly-closing' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <AdminSectionErrorBoundary sectionName="Cierre Mensual" onGoBack={() => setActiveTab('dashboard')}>
                      <MonthlyClosing />
                    </AdminSectionErrorBoundary>
                  </AdminTabWrapper>
                )}
                {activeTab === 'cash-closings' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <AdminSectionErrorBoundary sectionName="Cierres de Caja" onGoBack={() => setActiveTab('dashboard')}>
                      <CashClosings />
                    </AdminSectionErrorBoundary>
                  </AdminTabWrapper>
                )}
                {activeTab === 'customers' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <AdminSectionErrorBoundary sectionName="Clientes" onGoBack={() => setActiveTab('dashboard')}>
                      <CustomersManager />
                    </AdminSectionErrorBoundary>
                  </AdminTabWrapper>
                )}
                {activeTab === 'coupons' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <AdminSectionErrorBoundary sectionName="Cupones" onGoBack={() => setActiveTab('dashboard')}>
                      <CouponsManager />
                    </AdminSectionErrorBoundary>
                  </AdminTabWrapper>
                )}
                {activeTab === 'loyalty' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <AdminSectionErrorBoundary sectionName="Fidelidad" onGoBack={() => setActiveTab('dashboard')}>
                      <LoyaltyManager />
                    </AdminSectionErrorBoundary>
                  </AdminTabWrapper>
                )}
                {activeTab === 'delivery-zones' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <AdminSectionErrorBoundary sectionName="Zonas de Entrega" onGoBack={() => setActiveTab('dashboard')}>
                      <DeliveryZoneManager />
                    </AdminSectionErrorBoundary>
                  </AdminTabWrapper>
                )}
                {activeTab === 'delivery' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <AdminSectionErrorBoundary sectionName="Domicilios" onGoBack={() => setActiveTab('dashboard')}>
                      <DomiStats />
                    </AdminSectionErrorBoundary>
                  </AdminTabWrapper>
                )}
                {activeTab === 'subscription' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <SubscriptionPayment />
                  </AdminTabWrapper>
                )}
                {activeTab === 'products' && (
                  <ProductManager
                    products={products}
                    categories={categories}
                    toppingGroups={toppingGroups}
                    form={form}
                    setForm={setForm}
                    touchedFields={touchedFields}
                    setTouchedFields={setTouchedFields}
                    editingProduct={editingProduct}
                    setEditingProduct={setEditingProduct}
                    showProductModal={showProductModal}
                    setShowProductModal={setShowProductModal}
                    handleSubmit={handleSubmit}
                    handleChange={handleChange}
                    handleBlur={handleBlur}
                    handlePriceChange={handlePriceChange}
                    handleToppingGroupsChange={handleToppingGroupsChange}
                    editProduct={editProduct}
                    deleteProduct={deleteProduct}
                    handleToggleProduct={handleToggleProduct}
                    handleToggleFeatured={handleToggleFeatured}
                    setActiveTab={setActiveTab}
                    enableBookings={businessConfig?.enableBookings}
                  />
                )}
                {activeTab === 'product-order' && (
                  <FeaturedProductsManager
                    products={products}
                    categories={categories}
                    businessId={businessId}
                    setProducts={setProducts}
                    setActiveTab={setActiveTab}
                    handleToggleFeatured={handleToggleFeatured}
                    handleFeaturedDragStart={handleFeaturedDragStart}
                    handleFeaturedDragOver={handleFeaturedDragOver}
                    handleFeaturedDragEnd={handleFeaturedDragEnd}
                    draggedFeaturedItem={draggedFeaturedItem}
                  />
                )}
                {activeTab === 'whatsapp' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <WhatsAppCustomizer />
                  </AdminTabWrapper>
                )}
                {activeTab === 'payment-config' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <PaymentConfig />
                  </AdminTabWrapper>
                )}
                {activeTab === 'reviews' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <AdminSectionErrorBoundary sectionName="Reseñas" onGoBack={() => setActiveTab('dashboard')}>
                      <AdminReviews />
                    </AdminSectionErrorBoundary>
                  </AdminTabWrapper>
                )}
                {activeTab === 'popups' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <AdminSectionErrorBoundary sectionName="Anuncios" onGoBack={() => setActiveTab('dashboard')}>
                      <AdminPopups />
                    </AdminSectionErrorBoundary>
                  </AdminTabWrapper>
                )}
                {activeTab === 'branches' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <AdminSectionErrorBoundary sectionName="Sucursales" onGoBack={() => setActiveTab('dashboard')}>
                      <BranchManager businessId={businessId} />
                    </AdminSectionErrorBoundary>
                  </AdminTabWrapper>
                )}
                {activeTab === 'milink' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <AdminSectionErrorBoundary sectionName="Mi Link" onGoBack={() => setActiveTab('dashboard')}>
                      <LinkPageSettings businessId={businessId} />
                    </AdminSectionErrorBoundary>
                  </AdminTabWrapper>
                )}
                {activeTab === 'reports' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <AdminSectionErrorBoundary sectionName="Analítica" onGoBack={() => setActiveTab('dashboard')}>
                      <DashboardMetrics setActiveTab={setActiveTab} businessId={businessConfig?._id} businessConfig={businessConfig} />
                    </AdminSectionErrorBoundary>
                  </AdminTabWrapper>
                )}
                {activeTab === 'team' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <AdminSectionErrorBoundary sectionName="Equipo" onGoBack={() => setActiveTab('dashboard')}>
                      <StaffManager businessId={businessId} />
                    </AdminSectionErrorBoundary>
                  </AdminTabWrapper>
                )}
                {activeTab === 'bookings' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <AdminSectionErrorBoundary sectionName="Agenda" onGoBack={() => setActiveTab('dashboard')}>
                      <BookingsManager businessId={businessId} businessConfig={businessConfig} />
                    </AdminSectionErrorBoundary>
                  </AdminTabWrapper>
                )}
                {activeTab === 'referrals' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <AdminSectionErrorBoundary sectionName="Referidos" onGoBack={() => setActiveTab('dashboard')}>
                      <ReferralsPanel businessId={businessId} />
                    </AdminSectionErrorBoundary>
                  </AdminTabWrapper>
                )}
                {activeTab === 'crew' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <AdminSectionErrorBoundary sectionName="Crew" onGoBack={() => setActiveTab('dashboard')}>
                      <CrewPanel businessId={businessId} />
                    </AdminSectionErrorBoundary>
                  </AdminTabWrapper>
                )}
                {activeTab === 'marketplace' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <AdminSectionErrorBoundary sectionName="Marketplace" onGoBack={() => setActiveTab('dashboard')}>
                      <Marketplace businessId={businessId} businessName={businessConfig?.businessName} />
                    </AdminSectionErrorBoundary>
                  </AdminTabWrapper>
                )}
                {activeTab === 'supplier-orders' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <AdminSectionErrorBoundary sectionName="Pedidos Proveedor" onGoBack={() => setActiveTab('dashboard')}>
                      <SupplierOrders businessId={businessId} isSupplier={!!businessConfig?.isSupplier} />
                    </AdminSectionErrorBoundary>
                  </AdminTabWrapper>
                )}
                {activeTab === 'wa-campaign' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <AdminSectionErrorBoundary sectionName="Campaña WhatsApp" onGoBack={() => setActiveTab('dashboard')}>
                      <WhatsAppCampaign businessId={businessId} />
                    </AdminSectionErrorBoundary>
                  </AdminTabWrapper>
                )}
                {activeTab === 'tools' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <AdminSectionErrorBoundary sectionName="Herramientas" onGoBack={() => setActiveTab('dashboard')}>
                      <ToolsPanel />
                    </AdminSectionErrorBoundary>
                  </AdminTabWrapper>
                )}
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Toasts */}
      <AdminToasts
        successMessage={successMessage}
        setSuccessMessage={setSuccessMessage}
        errorMessage={errorMessage}
        setErrorMessage={setErrorMessage}
      />

      {/* Modals */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={cancelEdit}
        onConfirm={confirmEdit}
        product={editingProduct || {}}
        formData={form}
      />
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        product={productToDelete || {}}
      />

      {/* Floating AI Help Chat (Groq) */}

      {/* Modo Operación full-screen overlay */}
      <ModoOperacion isOpen={modoOpOpen} onClose={() => setModoOpOpen(false)} />

      {/* Mobile Bottom Navigation — fuera en pantalla completa */}
      {!pantallaCompleta && <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingOrdersCount={pendingOrdersCount}
          whatsappSinLeer={whatsappSinLeer}
        businessConfig={businessConfig}
        handleLogout={logout}
        userRole={user?.role}
        onOpenModoOp={() => setModoOpOpen(true)}
      />}

      {/* Varios negocios estaban usando la calculadora de Windows encima del
          panel. Esta vive dentro y responde al teclado (Alt+C para abrirla). */}
      <CalculatorLauncher />
    </div>
  );
}

export default Admin;
