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
import ReferralManagement from "../../Components/SuperAdmin/ReferralManagement";
import AuditLogsPanel from "../../Components/SuperAdmin/AuditLogsPanel";
import TeamManagement from "../../Components/SuperAdmin/TeamManagement";
import CrewKYCManagement from "../../Components/SuperAdmin/CrewKYCManagement";
import CrewFinanceManagement from "../../Components/SuperAdmin/CrewFinanceManagement";
import CrewEmployersManagement from "../../Components/SuperAdmin/CrewEmployersManagement";
import CrewPeopleManagement from "../../Components/SuperAdmin/CrewPeopleManagement";
import CrewVacanciesManagement from "../../Components/SuperAdmin/CrewVacanciesManagement";
import Home from "./Home";
import { SAButton } from "../../Components/SuperAdmin/ui";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useSuperAdminTheme } from "./useSuperAdminTheme";
import { useTeamPermissions } from "./useTeamPermissions";
import { ROLE_INFO } from "./permissions";

const NAV_SECTIONS = [
  {
    title: 'General',
    items: [
      { id: 'home', label: 'Inicio', desc: 'Resumen y KPIs', icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12L12 2.25 21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      )},
      { id: 'businesses', label: 'Negocios', desc: 'Gestionar restaurantes registrados', icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72" />
        </svg>
      )},
      { id: 'orders', label: 'Pedidos', desc: 'Gestión global de pedidos', icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
        </svg>
      )},
    ]
  },
  {
    title: 'Contenido',
    items: [
      { id: 'banners', label: 'Banners', desc: 'Aprobar banners promocionales', icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V5.25a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
        </svg>
      )},
      { id: 'announcements', label: 'Anuncios', desc: 'Novedades para negocios', icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
      )},
    ]
  },
  {
    title: 'Finanzas',
    items: [
      { id: 'subscriptions', label: 'Suscripciones', desc: 'Pagos y gestión de planes', icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
        </svg>
      )},
      { id: 'referrals', label: 'Referidos', desc: 'Programa de referidos', icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      )},
    ]
  },
  {
    title: 'Crew',
    items: [
      { id: 'crew_people', label: 'Personas registradas', desc: 'Trabajadores + empleadores + negocios MenuBy con Crew', icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      )},
      { id: 'crew_kyc', label: 'Verificación KYC', desc: 'Aprobar o rechazar cédulas de trabajadores', icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
        </svg>
      )},
      { id: 'crew_vacancies', label: 'Vacantes', desc: 'Moderar ofertas laborales · ingresos por fees', icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
        </svg>
      )},
      { id: 'crew_employers', label: 'Empleadores', desc: 'Aprobar personas/negocios externos a MenuBy', icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      )},
      { id: 'crew_finance', label: 'Finanzas Crew', desc: 'Recargas, retiros y treasury', icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
        </svg>
      )},
    ]
  },
  {
    title: 'Sistema',
    items: [
      { id: 'team', label: 'Equipo', desc: 'Gestionar usuarios SuperAdmin', icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      )},
      { id: 'audit', label: 'Auditoría', desc: 'Registro de cambios', icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )},
    ]
  },
];

// Flatten for lookup
const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap(s => s.items);

function SuperAdminDashboard() {
  const [isLogged, setIsLogged] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [authView, setAuthView] = useState('login');
  const [currentView, setCurrentView] = useState('home');
  const [subscriptionSubTab, setSubscriptionSubTab] = useState('payments');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, toggleTheme] = useSuperAdminTheme();
  const perms = useTeamPermissions(isLogged);
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

  // Compute visible tabs based on permissions — must be before any early return
  // so the redirect-useEffect below is always called in the same order.
  const visibleSections = perms.loading || !perms.role
    ? NAV_SECTIONS
    : NAV_SECTIONS
        .map(s => ({ ...s, items: s.items.filter(i => perms.canAccessTab(i.id)) }))
        .filter(s => s.items.length > 0);
  const visibleIds = new Set(visibleSections.flatMap(s => s.items.map(i => i.id)));

  // If current view is not accessible (e.g. role changed), redirect to home.
  // IMPORTANT: keep this hook BEFORE any conditional return to satisfy Rules of Hooks.
  useEffect(() => {
    if (isLogged && !perms.loading && perms.role && !visibleIds.has(currentView)) {
      setCurrentView('home');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLogged, perms.loading, perms.role, currentView]);

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

  const currentNavItem = ALL_NAV_ITEMS.find(item => item.id === currentView);
  const roleInfo = perms.role ? ROLE_INFO[perms.role] : null;

  return (
    <div className="min-h-screen flex font-geist bg-slate-50 dark:bg-[#09090b] text-slate-900 dark:text-white transition-colors">

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-[2px] z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-[240px] flex flex-col
        bg-white dark:bg-[#0c0c0f] border-r border-slate-200 dark:border-white/[0.06]
        transition-transform duration-200 ease-out
        lg:translate-x-0 lg:static lg:z-auto
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-slate-200 dark:border-white/[0.06] shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
            <span className="text-[11px] font-bold text-white">M</span>
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[13px] font-semibold text-slate-900 dark:text-white tracking-tight">MenuBy</span>
            <span className="text-[10px] text-slate-500 dark:text-white/25 ml-1.5 font-medium">Admin</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 text-slate-500 dark:text-white/30 hover:text-slate-900 dark:hover:text-white/60 rounded transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav sections */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5">
          {visibleSections.map(section => (
            <div key={section.title} className="mb-4">
              <p className="px-2.5 mb-1.5 text-[10px] font-semibold text-slate-500 dark:text-white/20 uppercase tracking-[0.08em]">{section.title}</p>
              {section.items.map(item => {
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setCurrentView(item.id); setSidebarOpen(false); }}
                    className={`group w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-150 relative ${
                      isActive
                        ? 'bg-slate-100 dark:bg-white/[0.06] text-slate-900 dark:text-white'
                        : 'text-slate-600 dark:text-white/40 hover:text-slate-900 dark:hover:text-white/70 hover:bg-slate-100/60 dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-indicator"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-cyan-500 dark:bg-cyan-400"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className={`shrink-0 transition-colors ${isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-white/25 group-hover:text-slate-600 dark:group-hover:text-white/40'}`}>
                      {item.icon}
                    </span>
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="px-2.5 py-3 border-t border-slate-200 dark:border-white/[0.06] space-y-0.5 shrink-0">
          {/* Logged user + role chip */}
          {perms.me && (
            <div className="flex items-center gap-2 px-2.5 py-2 mb-1 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.04]">
              <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${
                roleInfo?.color === 'amber' ? 'from-amber-400 to-orange-500' :
                roleInfo?.color === 'violet' ? 'from-purple-400 to-violet-500' :
                roleInfo?.color === 'cyan' ? 'from-cyan-400 to-blue-500' :
                'from-slate-400 to-slate-500'
              } flex items-center justify-center text-[10px] font-bold text-white shrink-0`}>
                {String(perms.me.name || perms.me.email || '?').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-slate-900 dark:text-white truncate">{perms.me.name || (perms.me.email || '').split('@')[0] || 'SuperAdmin'}</p>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${
                  roleInfo?.color === 'amber' ? 'text-amber-700 dark:text-amber-400' :
                  roleInfo?.color === 'violet' ? 'text-violet-700 dark:text-violet-400' :
                  roleInfo?.color === 'cyan' ? 'text-cyan-700 dark:text-cyan-400' :
                  'text-slate-600 dark:text-slate-400'
                }`}>{roleInfo?.label || perms.role || '—'}</p>
              </div>
            </div>
          )}

          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] text-slate-600 dark:text-white/30 hover:text-slate-900 dark:hover:text-white/60 hover:bg-slate-100/60 dark:hover:bg-white/[0.03] transition-all"
            title={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
          >
            {theme === 'dark' ? (
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="4"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
              </svg>
            ) : (
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
              </svg>
            )}
            Modo {theme === 'dark' ? 'claro' : 'oscuro'}
          </button>
          <button
            onClick={() => setAuthView('change')}
            className="w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] text-slate-600 dark:text-white/30 hover:text-slate-900 dark:hover:text-white/60 hover:bg-slate-100/60 dark:hover:bg-white/[0.03] transition-all"
          >
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Configuración
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] text-red-600 dark:text-red-400/50 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/[0.06] transition-all"
          >
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 h-14 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/[0.06] transition-colors">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 -ml-1.5 text-slate-600 dark:text-white/40 hover:text-slate-900 dark:hover:text-white/70 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <h1 className="text-[15px] font-semibold text-slate-900 dark:text-white">{currentNavItem?.label}</h1>
            {currentNavItem?.desc && (
              <span className="hidden sm:inline text-xs text-slate-500 dark:text-white/25 font-normal">— {currentNavItem.desc}</span>
            )}
          </div>

          <div className="flex-1" />

          {/* Create CTA */}
          {currentView === 'businesses' && (
            <SAButton
              variant="filled"
              size="sm"
              onClick={() => setShowCreate(true)}
              icon={
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              }
            >
              <span className="hidden sm:inline">Nuevo negocio</span>
              <span className="sm:hidden">Nuevo</span>
            </SAButton>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          <AnimatePresence mode="wait">
            {currentView === 'home' && (
              <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <Home onNavigate={setCurrentView} userName={perms.me?.name || perms.me?.email?.split('@')[0]} />
              </motion.div>
            )}

            {currentView === 'businesses' && (
              <motion.div key="businesses" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <BusinessTable refreshTrigger={refresh} />
              </motion.div>
            )}

            {currentView === 'banners' && (
              <motion.div key="banners" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <SuperAdminBannerManagement />
              </motion.div>
            )}

            {currentView === 'subscriptions' && (
              <motion.div key="subscriptions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                {/* Sub-tabs */}
                <div className="flex gap-1 mb-6 p-1 bg-white/[0.03] border border-white/[0.06] rounded-lg w-fit">
                  <button
                    onClick={() => setSubscriptionSubTab('payments')}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                      subscriptionSubTab === 'payments'
                        ? 'bg-white/[0.08] text-white shadow-sm'
                        : 'text-white/40 hover:text-white/60'
                    }`}
                  >
                    Solicitudes de Pago
                  </button>
                  <button
                    onClick={() => setSubscriptionSubTab('management')}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                      subscriptionSubTab === 'management'
                        ? 'bg-white/[0.08] text-white shadow-sm'
                        : 'text-white/40 hover:text-white/60'
                    }`}
                  >
                    Gestión
                  </button>
                </div>

                {subscriptionSubTab === 'payments' ? (
                  <PaymentRequestsReview />
                ) : (
                  <SubscriptionManagement />
                )}
              </motion.div>
            )}

            {currentView === 'announcements' && (
              <motion.div key="announcements" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <AnnouncementManagement />
              </motion.div>
            )}

            {currentView === 'orders' && (
              <motion.div key="orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <OrderManagement />
              </motion.div>
            )}

            {currentView === 'referrals' && (
              <motion.div key="referrals" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <ReferralManagement />
              </motion.div>
            )}

            {currentView === 'crew_kyc' && (
              <motion.div key="crew_kyc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <CrewKYCManagement />
              </motion.div>
            )}

            {currentView === 'crew_people' && (
              <motion.div key="crew_people" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <CrewPeopleManagement />
              </motion.div>
            )}

            {currentView === 'crew_vacancies' && (
              <motion.div key="crew_vacancies" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <CrewVacanciesManagement />
              </motion.div>
            )}

            {currentView === 'crew_employers' && (
              <motion.div key="crew_employers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <CrewEmployersManagement />
              </motion.div>
            )}

            {currentView === 'crew_finance' && (
              <motion.div key="crew_finance" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <CrewFinanceManagement />
              </motion.div>
            )}

            {currentView === 'team' && (
              <motion.div key="team" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <TeamManagement />
              </motion.div>
            )}

            {currentView === 'audit' && (
              <motion.div key="audit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <AuditLogsPanel />
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
