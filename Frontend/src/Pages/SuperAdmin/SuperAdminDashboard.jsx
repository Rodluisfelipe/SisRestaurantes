import React, { useState, useEffect } from "react";
import LoginSuperAdmin from "./LoginSuperAdmin";
import BusinessTable from "./BusinessTable";
import CreateBusinessModal from "./CreateBusinessModal";
import ForgotPasswordSuperAdmin from "./ForgotPasswordSuperAdmin";
import ResetPasswordSuperAdmin from "./ResetPasswordSuperAdmin";
import ChangePasswordSuperAdmin from "./ChangePasswordSuperAdmin";
import SuperAdminBannerManagement from "../../Components/Catalog/SuperAdminBannerManagement";
import SubscriptionManagement from "../../Components/SuperAdmin/SubscriptionManagement";
import AnnouncementManagement from "../../Components/SuperAdmin/AnnouncementManagement";
import PaymentsDashboard from "./PaymentsDashboard";
import PaymentRequestsReview from "./PaymentRequestsReview";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

function SuperAdminDashboard() {
  const [isLogged, setIsLogged] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [authView, setAuthView] = useState('login'); // 'login' | 'forgot' | 'change'
  const [currentView, setCurrentView] = useState('businesses'); // 'businesses' | 'banners' | 'subscriptions' | 'announcements'
  const [subscriptionSubTab, setSubscriptionSubTab] = useState('payments'); // 'payments' | 'management'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const params = useParams();
  // Extraer token de parámetros y búsqueda de URL de forma segura
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const token = params.token || queryParams.get('token');
  const [resetToken, setResetToken] = useState(token || null);
  const navigate = useNavigate();

  // Log de depuración para verificar token
  useEffect(() => {
    // Validate stored token against server on mount
    const validateToken = async () => {
      const adminToken = localStorage.getItem("superadmin_token");
      if (!adminToken) return;
      
      try {
        const { default: superadminApi } = await import('../../services/superadminApi');
        await superadminApi.get('/auth/me');
        setIsLogged(true);
      } catch (error) {
        // Token is invalid or expired — force logout
        localStorage.removeItem("superadmin_token");
        setIsLogged(false);
      }
    };
    validateToken();
  }, []);

  useEffect(() => {
    // Actualizar estado del token si viene en la URL
    if (token) {
      setResetToken(token);
    }
  }, [token]);

  const handleCreated = () => {
    setShowCreate(false);
    setRefresh(r => r + 1);
  };

  const handleLogout = () => {
    localStorage.removeItem("superadmin_token");
    setIsLogged(false);
    setAuthView('login');
  };

  // Mostrar SIEMPRE el formulario de reset si hay token, aunque esté logueado
  if (resetToken) {
    return <ResetPasswordSuperAdmin 
      token={resetToken} 
      onSuccess={() => { 
        setAuthView('login'); 
        navigate('/superadmin', { replace: true });
        setResetToken(null); 
      }} 
      onBack={() => { 
        setAuthView('login'); 
        navigate('/superadmin', { replace: true });
        setResetToken(null); 
      }} 
    />;
  }
  
  if (!isLogged) {
    if (authView === 'forgot') {
      return <ForgotPasswordSuperAdmin onBack={() => setAuthView('login')} />;
    }
    return <LoginSuperAdmin onLogin={v => v === 'forgot' ? setAuthView('forgot') : setIsLogged(true)} />;
  }

  if (authView === 'change') {
    return <ChangePasswordSuperAdmin 
      onBack={() => setAuthView('dashboard')} 
      onSuccess={() => setAuthView('dashboard')} 
    />;
  }

  return (
    <div className="min-h-screen bg-[#051C2C] flex flex-col">
      <style>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      {/* Header */}
      <header className="fixed top-0 left-0 w-full bg-[#333F50] shadow-lg z-50 border-b border-[#333F50]/80">
        {/* Top bar - Logo and Mobile Menu Button */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
            className="flex items-center space-x-2 sm:space-x-3"
          >
            <img src="/logo.jpeg" alt="Menuby" className="h-8 w-8 sm:h-10 sm:w-10 rounded-full object-cover border-2 border-[#5FF9B4] shadow" />
            <span className="text-base sm:text-lg font-bold text-white tracking-wide hidden sm:inline">Panel SuperAdmin</span>
            <span className="text-base sm:text-lg font-bold text-white tracking-wide sm:hidden">SuperAdmin</span>
          </motion.div>
          
          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center gap-3">
            <motion.button
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              onClick={() => setAuthView('change')}
              className="flex items-center gap-2 px-4 py-2 bg-[#5FF9B4] text-[#051C2C] rounded-lg hover:bg-[#5FF9B4]/90 transition-colors font-semibold shadow-md text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span className="hidden xl:inline">Cambiar contraseña</span>
              <span className="xl:hidden">Contraseña</span>
            </motion.button>
            <motion.button 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              onClick={handleLogout} 
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold shadow-md text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1" />
              </svg>
              Salir
            </motion.button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-white hover:bg-[#333F50]/80 rounded-lg transition-colors"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
          </div>
          
        {/* Desktop Navigation Tabs */}
        <div className="hidden lg:flex space-x-2 px-6 pb-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setCurrentView('businesses')}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm ${
                currentView === 'businesses'
                  ? 'bg-[#5FF9B4] text-[#051C2C] shadow-lg'
                  : 'bg-[#333F50] text-white hover:bg-[#333F50]/80'
              }`}
            >
              🏢 Negocios
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setCurrentView('banners')}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm ${
                currentView === 'banners'
                  ? 'bg-[#5FF9B4] text-[#051C2C] shadow-lg'
                  : 'bg-[#333F50] text-white hover:bg-[#333F50]/80'
              }`}
            >
              📢 Banners
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setCurrentView('subscriptions')}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm ${
                currentView === 'subscriptions'
                  ? 'bg-[#5FF9B4] text-[#051C2C] shadow-lg'
                  : 'bg-[#333F50] text-white hover:bg-[#333F50]/80'
              }`}
            >
              👑 Suscripciones
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setCurrentView('announcements')}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm ${
                currentView === 'announcements'
                  ? 'bg-[#5FF9B4] text-[#051C2C] shadow-lg'
                  : 'bg-[#333F50] text-white hover:bg-[#333F50]/80'
              }`}
            >
              📋 Anuncios
            </motion.button>
          </div>

        {/* Mobile Navigation - Scrollable Tabs */}
        <div className="lg:hidden overflow-x-auto scrollbar-hide pb-3 px-4">
          <div className="flex space-x-2 min-w-max">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setCurrentView('businesses');
                setMobileMenuOpen(false);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 whitespace-nowrap text-sm ${
                currentView === 'businesses'
                  ? 'bg-[#5FF9B4] text-[#051C2C] shadow-lg'
                  : 'bg-[#333F50] text-white'
              }`}
            >
              🏢 Negocios
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setCurrentView('banners');
                setMobileMenuOpen(false);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 whitespace-nowrap text-sm ${
                currentView === 'banners'
                  ? 'bg-[#5FF9B4] text-[#051C2C] shadow-lg'
                  : 'bg-[#333F50] text-white'
              }`}
            >
              📢 Banners
            </motion.button>
          <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setCurrentView('subscriptions');
                setMobileMenuOpen(false);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 whitespace-nowrap text-sm ${
                currentView === 'subscriptions'
                  ? 'bg-[#5FF9B4] text-[#051C2C] shadow-lg'
                  : 'bg-[#333F50] text-white'
              }`}
            >
              👑 Suscripciones
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setCurrentView('announcements');
                setMobileMenuOpen(false);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 whitespace-nowrap text-sm ${
                currentView === 'announcements'
                  ? 'bg-[#5FF9B4] text-[#051C2C] shadow-lg'
                  : 'bg-[#333F50] text-white'
              }`}
            >
              📋 Anuncios
            </motion.button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden border-t border-[#333F50]/80 bg-[#333F50]"
            >
              <div className="px-4 py-3 space-y-2">
                <button
                  onClick={() => {
                    setAuthView('change');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 bg-[#5FF9B4] text-[#051C2C] rounded-lg hover:bg-[#5FF9B4]/90 transition-colors font-semibold"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Cambiar contraseña
                </button>
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1" />
            </svg>
            Salir
                </button>
        </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main content - Adjusted padding for mobile */}
      <main className="flex-1 flex flex-col items-center justify-start pt-20 sm:pt-24 px-3 sm:px-4 pb-6 sm:pb-8 min-h-screen">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-6xl"
        >
          {currentView === 'businesses' && (
            <>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
                <motion.h1 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-2xl font-bold text-white drop-shadow"
                >
                  Negocios registrados
                </motion.h1>
                <motion.button
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="px-3 sm:px-4 py-2 sm:py-2.5 bg-[#3A7AFF] text-white rounded-lg shadow-lg hover:bg-[#3A7AFF]/90 transition-colors font-semibold flex items-center justify-center gap-2 hover:shadow-[#3A7AFF]/20 text-sm sm:text-base w-full sm:w-auto"
                  onClick={() => setShowCreate(true)}
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden sm:inline">Crear nuevo negocio</span>
                  <span className="sm:hidden">Crear</span>
                </motion.button>
              </div>
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="bg-[#333F50]/80 rounded-2xl shadow-xl p-4 md:p-8 border border-[#333F50]"
              >
                <BusinessTable
                  refreshTrigger={refresh}
                />
              </motion.div>
            </>
          )}
          
          {currentView === 'banners' && (
            <>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
                <motion.h1 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-2xl font-bold text-white drop-shadow"
                >
                  Gestión de Banners
                </motion.h1>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="text-white/80 text-sm"
                >
                  Aprueba o rechaza banners promocionales
                </motion.div>
              </div>
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="bg-[#333F50]/80 rounded-2xl shadow-xl p-4 md:p-8 border border-[#333F50]"
              >
                <SuperAdminBannerManagement />
              </motion.div>
            </>
          )}
          
          {currentView === 'subscriptions' && (
            <>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
                <motion.h1 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-2xl font-bold text-white drop-shadow"
                >
                  Suscripciones y Pagos
                </motion.h1>
              </div>
              
              {/* Subtabs - Responsive */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 mb-6 overflow-x-auto">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSubscriptionSubTab('payments')}
                  className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium transition-all duration-200 whitespace-nowrap text-sm sm:text-base ${
                    subscriptionSubTab === 'payments'
                      ? 'bg-[#5FF9B4] text-[#051C2C] shadow-lg'
                      : 'bg-[#333F50] text-white hover:bg-[#333F50]/80'
                  }`}
                >
                  💳 <span className="hidden sm:inline">Dashboard de Pagos</span><span className="sm:hidden">Pagos</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSubscriptionSubTab('management')}
                  className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium transition-all duration-200 whitespace-nowrap text-sm sm:text-base ${
                    subscriptionSubTab === 'management'
                      ? 'bg-[#5FF9B4] text-[#051C2C] shadow-lg'
                      : 'bg-[#333F50] text-white hover:bg-[#333F50]/80'
                  }`}
                >
                  👑 <span className="hidden sm:inline">Gestión de Suscripciones</span><span className="sm:hidden">Suscripciones</span>
                </motion.button>
              </div>
              
              {/* Contenido según subtab */}
              {subscriptionSubTab === 'payments' ? (
                <PaymentRequestsReview />
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className="bg-[#333F50]/80 rounded-2xl shadow-xl p-4 md:p-8 border border-[#333F50]"
                >
                  <SubscriptionManagement />
                </motion.div>
              )}
            </>
          )}

          {currentView === 'announcements' && (
            <>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
                <motion.h1 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-2xl font-bold text-white drop-shadow"
                >
                  Gestión de Anuncios
                </motion.h1>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="text-white/80 text-sm"
                >
                  Novedades y avisos para los negocios
                </motion.div>
              </div>
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="bg-[#333F50]/80 rounded-2xl shadow-xl p-4 md:p-8 border border-[#333F50]"
              >
                <AnnouncementManagement />
              </motion.div>
            </>
          )}
        </motion.div>
        <CreateBusinessModal
          isOpen={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      </main>
    </div>
  );
}

export default SuperAdminDashboard; 