import React, { useState, useEffect } from "react";
import LoginSuperAdmin from "./components/LoginSuperAdmin";
import BusinessTable from "./components/BusinessTable";
import CreateBusinessModal from "./components/CreateBusinessModal";
import ForgotPasswordSuperAdmin from "./components/ForgotPasswordSuperAdmin";
import ResetPasswordSuperAdmin from "./components/ResetPasswordSuperAdmin";

function getResetTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('token');
}

function App() {
  const [isLogged, setIsLogged] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [authView, setAuthView] = useState('login'); // 'login' | 'forgot'
  const [resetToken, setResetToken] = useState(getResetTokenFromUrl());

  useEffect(() => {
    // Mantener sesión si hay token
    const token = localStorage.getItem("superadmin_token");
    if (token) setIsLogged(true);
  }, []);

  useEffect(() => {
    // Detectar si hay token en la URL
    setResetToken(getResetTokenFromUrl());
  }, [window.location.search]);

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
      onSuccess={() => { setAuthView('login'); window.history.replaceState({}, '', window.location.pathname); setResetToken(null); }} 
      onBack={() => { setAuthView('login'); window.history.replaceState({}, '', window.location.pathname); setResetToken(null); }} 
    />;
  }
  if (!isLogged) {
    if (authView === 'forgot') {
      return <ForgotPasswordSuperAdmin onBack={() => setAuthView('login')} />;
    }
    return <LoginSuperAdmin onLogin={v => v === 'forgot' ? setAuthView('forgot') : setIsLogged(true)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 w-full h-16 bg-gradient-to-r from-indigo-700 to-blue-600 shadow-lg z-50 flex items-center justify-between px-6 border-b border-indigo-800">
        <div className="flex items-center space-x-3">
          <img src="/logo.png" alt="Logo" className="h-10 w-10 rounded-full object-cover border-2 border-white shadow" />
          <span className="text-lg font-bold text-white tracking-wide drop-shadow">Panel Súper Admin</span>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold shadow">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1" /></svg>
          Salir
        </button>
      </header>
      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-start pt-24 px-2 pb-8 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
        <div className="w-full max-w-5xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
            <h1 className="text-2xl font-bold text-gray-800 drop-shadow">Negocios registrados</h1>
            <button
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition-colors font-semibold flex items-center gap-2"
              onClick={() => setShowCreate(true)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Crear nuevo negocio
            </button>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-4 md:p-8 border border-indigo-100">
            <BusinessTable
              onActivate={b => {/* lógica para activar/desactivar */}}
              onResetPassword={b => {/* lógica para resetear clave */}}
              onCopyUrl={b => {/* lógica para copiar URL */}}
              refreshTrigger={refresh}
            />
          </div>
        </div>
        <CreateBusinessModal
          isOpen={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      </main>
    </div>
  );
}

export default App; 