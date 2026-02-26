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
import OrderManagement from "./OrderManagement";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const NAV_ITEMS = [
  { id: 'businesses', label: 'Negocios', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  )},
  { id: 'banners', label: 'Banners', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V5.25a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
    </svg>
  )},
  { id: 'subscriptions', label: 'Suscripciones', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  )},
  { id: 'announcements', label: 'Anuncios', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
    </svg>
  )},
  { id: 'orders', label: 'Pedidos', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
    </svg>
  )},
];

function SuperAdminDashboard() {
  const [isLogged, setIsLogged] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [authView, setAuthView] = useState('login');
  const [currentView, setCurrentView] = useState('businesses');
  const [subscriptionSubTab, setSubscriptionSubTab] = useState('payments');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const params = useParams();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const token = params.token || queryParams.get('token');
  const [resetToken, setResetToken] = useState(token || null);
  const navigate = useNavigate();

  useEffect(() => {
    const validateToken = async () => {
      const adminToken = localStorage.getItem("superadmin_token");
      if (!adminToken) return;
      try {
        const { default: superadminApi } = await import('../../services/superadminApi');
        await superadminApi.get('/auth/me');
        setIsLogged(true);
      } catch (error) {
        localStorage.removeItem("superadmin_token");
        localStorage.removeItem("superadmin_refreshToken");
        setIsLogged(false);
      }
    };
    validateToken();
  }, []);

  useEffect(() => {
    if (token) setResetToken(token);
  }, [token]);

  const handleCreated = () => {
    setShowCreate(false);
    setRefresh(r => r + 1);
  };

  const handleLogout = () => {
    localStorage.removeItem("superadmin_token");
    localStorage.removeItem("superadmin_refreshToken");
    setIsLogged(false);
    setAuthView('login');
  };

  // Reset password view
  if (resetToken) {
    return <ResetPasswordSuperAdmin 
      token={resetToken} 
      onSuccess={() => { setAuthView('login'); navigate('/superadmin', { replace: true }); setResetToken(null); }} 
      onBack={() => { setAuthView('login'); navigate('/superadmin', { replace: true }); setResetToken(null); }} 
    />;
  }
  
  // Not logged in
  if (!isLogged) {
    if (authView === 'forgot') {
      return <ForgotPasswordSuperAdmin onBack={() => setAuthView('login')} />;
    }
    return <LoginSuperAdmin onLogin={v => v === 'forgot' ? setAuthView('forgot') : setIsLogged(true)} />;
  }

  // Change password view
  if (authView === 'change') {
    return <ChangePasswordSuperAdmin 
      onBack={() => setAuthView('dashboard')} 
      onSuccess={() => setAuthView('dashboard')} 
    />;
  }

  const currentNavItem = NAV_ITEMS.find(item => item.id === currentView);

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(145deg, #0a0a1a 0%, #0d1b2a 40%, #111827 100%)' }}>
      
      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-[260px] flex flex-col
        bg-white/[0.03] backdrop-blur-xl border-r border-white/[0.06]
        transition-transform duration-300 ease-out
        lg:translate-x-0 lg:static lg:z-auto
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Sidebar header */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/[0.06]">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/30 to-indigo-600/30 border border-white/10 flex items-center justify-center shadow-lg shadow-blue-500/10">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-white truncate">MenuBy</h2>
            <p className="text-[11px] text-white/30">Super Admin</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 text-white/40 hover:text-white/70 transition-colors rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="px-3 mb-2 text-[10px] font-semibold text-white/20 uppercase tracking-wider">Principal</p>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => { setCurrentView(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                currentView === item.id
                  ? 'bg-blue-500/15 text-blue-400 shadow-sm shadow-blue-500/5'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
              }`}
            >
              <span className={`transition-colors ${currentView === item.id ? 'text-blue-400' : 'text-white/30 group-hover:text-white/50'}`}>
                {item.icon}
              </span>
              {item.label}
              {currentView === item.id && (
                <motion.div layoutId="activeNav" className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />
              )}
            </button>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="p-3 border-t border-white/[0.06] space-y-1">
          <button
            onClick={() => setAuthView('change')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Cambiar contraseña
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-4 px-4 sm:px-6 lg:px-8 h-16 bg-white/[0.02] backdrop-blur-xl border-b border-white/[0.06]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 text-white/40 hover:text-white/70 hover:bg-white/[0.06] rounded-xl transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          <div className="flex items-center gap-3">
            <span className="text-white/30">{currentNavItem?.icon}</span>
            <h1 className="text-lg font-semibold text-white">{currentNavItem?.label}</h1>
          </div>

          <div className="flex-1" />

          {/* Create CTA in topbar for businesses */}
          {currentView === 'businesses' && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => setShowCreate(true)}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/20 transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nuevo negocio
            </motion.button>
          )}

          {/* User menu */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/30 to-indigo-600/30 border border-white/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <AnimatePresence mode="wait">
            {currentView === 'businesses' && (
              <motion.div
                key="businesses"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
              >
                {/* Mobile create button */}
                <div className="sm:hidden mb-4">
                  <button
                    onClick={() => setShowCreate(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/20 transition-all duration-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Crear nuevo negocio
                  </button>
                </div>

                <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl overflow-hidden">
                  <BusinessTable refreshTrigger={refresh} />
                </div>
              </motion.div>
            )}

            {currentView === 'banners' && (
              <motion.div
                key="banners"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
              >
                <p className="text-white/40 text-sm mb-6">Aprueba o rechaza banners promocionales de los negocios</p>
                <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-4 sm:p-6 lg:p-8">
                  <SuperAdminBannerManagement />
                </div>
              </motion.div>
            )}

            {currentView === 'subscriptions' && (
              <motion.div
                key="subscriptions"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
              >
                {/* Sub-tabs */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
                  <button
                    onClick={() => setSubscriptionSubTab('payments')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                      subscriptionSubTab === 'payments'
                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20 shadow-sm shadow-blue-500/5'
                        : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04] border border-transparent'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                    </svg>
                    Dashboard de Pagos
                  </button>
                  <button
                    onClick={() => setSubscriptionSubTab('management')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                      subscriptionSubTab === 'management'
                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20 shadow-sm shadow-blue-500/5'
                        : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04] border border-transparent'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    </svg>
                    Gestión
                  </button>
                </div>

                {subscriptionSubTab === 'payments' ? (
                  <PaymentRequestsReview />
                ) : (
                  <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-4 sm:p-6 lg:p-8">
                    <SubscriptionManagement />
                  </div>
                )}
              </motion.div>
            )}

            {currentView === 'announcements' && (
              <motion.div
                key="announcements"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
              >
                <p className="text-white/40 text-sm mb-6">Novedades y avisos para los negocios</p>
                <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-4 sm:p-6 lg:p-8">
                  <AnnouncementManagement />
                </div>
              </motion.div>
            )}

            {currentView === 'orders' && (
              <motion.div
                key="orders"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
              >
                <p className="text-white/40 text-sm mb-6">Gestión global de pedidos — cambia estados y mueve entre colecciones</p>
                <OrderManagement />
              </motion.div>
            )}
          </AnimatePresence>

          <CreateBusinessModal
            isOpen={showCreate}
            onClose={() => setShowCreate(false)}
            onCreated={handleCreated}
          />
        </main>
      </div>
    </div>
  );
}

export default SuperAdminDashboard;
