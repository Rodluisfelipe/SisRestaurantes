import React, { useState, useEffect } from "react";
import LoginSuperAdmin from "./LoginSuperAdmin";
import BusinessTable from "./BusinessTable";
import CreateBusinessModal from "./CreateBusinessModal";
import ForgotPasswordSuperAdmin from "./ForgotPasswordSuperAdmin";
import ResetPasswordSuperAdmin from "./ResetPasswordSuperAdmin";
import ChangePasswordSuperAdmin from "./ChangePasswordSuperAdmin";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { motion } from "framer-motion";

function SuperAdminDashboard() {
  const [isLogged, setIsLogged] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [authView, setAuthView] = useState('login'); // 'login' | 'forgot' | 'change'
  const params = useParams();
  const token = params.token; // Extraer token de los parámetros de ruta
  const [resetToken, setResetToken] = useState(token || null);
  const navigate = useNavigate();
  const location = useLocation();

  // Log de depuración para verificar token
  useEffect(() => {
    console.log("Detectado token en URL:", token);
    console.log("Parámetros detectados:", params);
    console.log("Ruta actual:", location.pathname);
  }, [token, params, location.pathname]);

  useEffect(() => {
    // Mantener sesión si hay token
    const adminToken = localStorage.getItem("superadmin_token");
    if (adminToken) setIsLogged(true);
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
      {/* Header */}
      <header className="fixed top-0 left-0 w-full bg-[#333F50] shadow-lg z-50 flex items-center justify-between px-6 py-3 border-b border-[#333F50]/80">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center space-x-3"
        >
          <img src="/logo.png" alt="Menuby" className="h-10 w-10 rounded-full object-cover border-2 border-[#5FF9B4] shadow" />
          <span className="text-lg font-bold text-white tracking-wide">Panel SuperAdmin</span>
        </motion.div>
        <div className="flex items-center gap-3">
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            onClick={() => setAuthView('change')}
            className="flex items-center gap-2 px-4 py-2 bg-[#5FF9B4] text-[#051C2C] rounded-lg hover:bg-[#5FF9B4]/90 transition-colors font-semibold shadow-md"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Cambiar contraseña
          </motion.button>
          <motion.button 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            onClick={handleLogout} 
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold shadow-md"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1" />
            </svg>
            Salir
          </motion.button>
        </div>
      </header>
      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-start pt-24 px-4 pb-8 min-h-screen">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-6xl"
        >
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
              className="px-4 py-2.5 bg-[#3A7AFF] text-white rounded-lg shadow-lg hover:bg-[#3A7AFF]/90 transition-colors font-semibold flex items-center gap-2 hover:shadow-[#3A7AFF]/20"
              onClick={() => setShowCreate(true)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Crear nuevo negocio
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