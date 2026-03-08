import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from 'react-router-dom';
import { useBusinessConfig } from "../Context/BusinessContext";
import BusinessSettings from "../Components/BusinessSettings";
import CategorySettings from "../Components/CategorySettings";
import ToppingGroupsManager from '../Components/ToppingGroupsManager';
import WhatsAppCustomizer from '../Components/WhatsAppCustomizer';
import ThemeSettings from '../Components/ThemeSettings';
import LocationSettings from '../Components/LocationSettings';
import BannerUpload from '../Components/Catalog/BannerUpload';
import RestaurantBannerView from '../Components/Catalog/RestaurantBannerView';
import ChangePassword from "../Components/ChangePassword";
import TableSettings from "../Components/TableSettings";
import ModernOrdersDashboard from "../Components/ModernOrdersDashboard";
import EnhancedCompletedOrders from "../Components/EnhancedCompletedOrders";
import ModernAdminSidebar from "../Components/ModernAdminSidebar";
import SubscriptionStatus from "../Components/SubscriptionStatus";
import CustomersManager from "../Components/CustomersManager";
import CouponsManager from "../Components/CouponsManager";
import MultiSessionWarning from "../Components/MultiSessionWarning";
import DeliveryZoneManager from "../Components/DeliveryZoneManager";
import PushNotificationToggle from "../Components/PushNotificationToggle";
import PaymentConfig from "../Components/Admin/PaymentConfig";
import PrinterSettings from "../Components/PrinterSettings";
import { motion, AnimatePresence } from "framer-motion";

// Componentes extraidos del monolito
import AdminDashboard from "../Components/Admin/AdminDashboard";
import AdminTabWrapper from "../Components/Admin/AdminTabWrapper";
import AdminHeader from "../Components/Admin/AdminHeader";
import AdminToasts from "../Components/Admin/AdminToasts";
import ProductManager from "../Components/Admin/ProductManager";
import FeaturedProductsManager from "../Components/Admin/FeaturedProductsManager";
import ConfirmationModal from "../Components/Admin/ConfirmationModal";
import DeleteConfirmationModal from "../Components/Admin/DeleteConfirmationModal";
import OrderNotificationBanner from "../Components/Admin/OrderNotificationBanner";
import SubscriptionPayment from "./SubscriptionPayment";
import AdminSectionErrorBoundary from "../Components/Admin/AdminSectionErrorBoundary";
import AnnouncementPopup from "../Components/Admin/AnnouncementPopup";
import WelcomeWizard from "../Components/Admin/WelcomeWizard";
import FloatingHelpChat from "../Components/Admin/FloatingHelpChat";
import AdminReviews from "../Components/Admin/AdminReviews";
import CashClosings from "../Components/Admin/CashClosings";

// Custom hooks
import useAdminAuth from "../hooks/useAdminAuth";
import useAdminData from "../hooks/useAdminData";
import useProductHandlers from "../hooks/useProductHandlers";
import useSubscriptionData from "../hooks/useSubscriptionData";
import useOnboarding from "../hooks/useOnboarding";

function Admin() {
  const { businessConfig } = useBusinessConfig();
  const { businessId: rawBusinessId } = useBusinessConfig();
  const businessId = useMemo(() => rawBusinessId, [rawBusinessId]);

  // --- Auth (SuperAdmin token, validacion, redirecciones) ---
  const { isAuthenticated, user, loading, logout, isSuperAdminMode } = useAdminAuth(businessId);

  // --- Subscription (una sola instancia, se pasa a sidebar + dashboard) ---
  const subscriptionData = useSubscriptionData(businessConfig?._id);

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
  const [activeTab, setActiveTab] = useState(() => {
    // Si viene de ePayco redirect con ?tab=subscription
    const tabParam = searchParams.get('tab');
    return tabParam || 'dashboard';
  });
  const [activeCatalogTab, setActiveCatalogTab] = useState('upload');
  const [showWelcome, setShowWelcome] = useState(false);

  // Limpiar params de URL después de leerlos (no mostrar ?tab=... en la barra)
  useEffect(() => {
    if (searchParams.has('tab')) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('tab');
      setSearchParams(newParams, { replace: true });
    }
  }, []);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pt-safe">
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

      {/* Popup de anuncios/novedades — solo para dueños, no superadmin */}
      {!isSuperAdminMode && <AnnouncementPopup />}

      {/* Welcome Wizard for new users */}
      {showWelcome && (
        <WelcomeWizard
          onClose={() => setShowWelcome(false)}
          onGoToTab={(tab) => { setActiveTab(tab); setShowWelcome(false); }}
        />
      )}

      <div className="flex min-h-screen">
        {/* Sidebar */}
        <ModernAdminSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          businessConfig={businessConfig}
          handleLogout={logout}
          pendingOrdersCount={pendingOrdersCount}
          subscriptionData={subscriptionData}
          onboarding={onboardingData}
        />

        {/* Main Content */}
        <div className="flex-1 w-full lg:ml-0">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="hidden md:block bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40"
          >
            <AdminHeader activeTab={activeTab} />
          </motion.div>

          {/* Audio para notificaciones */}
          <audio ref={notificationAudioRef} preload="auto">
            <source src="/audio/new-order-notification.mp3" type="audio/mpeg" />
          </audio>

          <div className="p-3 sm:p-4 md:p-6">
            {/* Banner de nuevo pedido */}
            <OrderNotificationBanner
              showOrderBanner={showOrderBanner}
              newOrderNotification={newOrderNotification}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              setShowOrderBanner={setShowOrderBanner}
            />

            {/* Subscription Status */}
            {businessConfig && businessConfig._id && (
              <div className="mb-6">
                <SubscriptionStatus
                  {...subscriptionData}
                  onNavigateToSubscription={() => setActiveTab('subscription')}
                  compact={false}
                />
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="w-full"
              >
                {activeTab === 'dashboard' && (
                  <AdminDashboard setActiveTab={setActiveTab} pendingOrdersCount={pendingOrdersCount} onboarding={onboardingData} />
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
                {activeTab === 'delivery-zones' && (
                  <AdminTabWrapper setActiveTab={setActiveTab}>
                    <AdminSectionErrorBoundary sectionName="Zonas de Entrega" onGoBack={() => setActiveTab('dashboard')}>
                      <DeliveryZoneManager />
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

      {/* Floating AI Help Chat */}
      <FloatingHelpChat />
    </div>
  );
}

export default Admin;
