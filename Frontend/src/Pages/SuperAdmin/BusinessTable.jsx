import React, { useEffect, useState, useRef } from "react";
import { fetchBusinesses, activateBusiness, deleteBusiness } from "../../services/superadminApi";
import { socket } from "../../services/socket";
import { motion } from "framer-motion";

export default function BusinessTable({ refreshTrigger }) {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const debounceRef = useRef(null);

  const loadBusinesses = async () => {
    setLoading(true);
    try {
      const data = await fetchBusinesses();
      setBusinesses(data.businesses || []);
    } catch (err) {
      setMessage("Error al cargar negocios");
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBusinesses();
    
    // Conectar al socket para escuchar actualizaciones
    if (socket && !socket.connected) {
      socket.connect();
    }
    
    if (socket) {
      socket.emit('joinSuperAdmin');
    }
    
    // Debounce para evitar bucles de peticiones
    const handler = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        loadBusinesses();
      }, 300); // 300ms de espera
    };
    
    if (socket) {
      socket.on('businesses-updated', handler);
    }
    
    return () => {
      if (socket) {
        socket.off('businesses-updated', handler);
        socket.emit('leaveSuperAdmin');
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [refreshTrigger]);

  const handleActivate = async (b) => {
    try {
      await activateBusiness(b._id, !b.isActive);
      setMessage(`Negocio ${b.isActive ? 'desactivado' : 'activado'} correctamente`);
      loadBusinesses();
    } catch (err) {
      setMessage("Error al cambiar el estado del negocio");
    }
  };

  const handleOpenAdmin = (b) => {
    if (!b.slug) {
      alert('Este negocio no tiene slug. Asígnale uno desde la base de datos.');
      return;
    }
    
    // Usar el token REAL del SuperAdmin almacenado en localStorage
    const superadminToken = localStorage.getItem('superadmin_token');
    
    if (!superadminToken) {
      alert('No tienes sesión activa como SuperAdmin. Por favor, inicia sesión de nuevo.');
      return;
    }
    
    const realAuthData = {
      accessToken: superadminToken,
      refreshToken: localStorage.getItem('superadmin_refreshToken') || null,
      user: {
        businessId: b._id,
        role: 'superadmin'
      }
    };
    
    // Store token data in localStorage for same-origin handoff with short TTL
    const handoffData = {
      ...realAuthData,
      _ts: Date.now(),       // creation timestamp for TTL check
      _ttl: 30000            // 30 second TTL
    };
    localStorage.setItem('sa_handoff', JSON.stringify(handoffData));
    const baseUrl = `${window.location.protocol}//${window.location.host}`;
    const url = `${baseUrl}/${b.slug}/admin?source=superadmin`;
    
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleOpenMenu = (b) => {
    if (!b.slug) {
      alert('Este negocio no tiene slug. Asígnale uno desde la base de datos.');
      return;
    }
    const baseUrl = `${window.location.protocol}//${window.location.host}`;
    const url = `${baseUrl}/${b.slug}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDelete = async (b) => {
    if (!window.confirm(`¿Seguro que quieres eliminar el negocio "${b.businessName}"? Esta acción no se puede deshacer.`)) return;
    setLoading(true);
    setMessage("");
    try {
      await deleteBusiness(b._id);
      setMessage('Negocio eliminado correctamente');
      loadBusinesses();
    } catch (err) {
      setMessage(err.response?.data?.message || err.message || 'Error al eliminar negocio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {message && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 bg-green-500/20 text-green-300 text-sm rounded-lg border border-green-500/30 text-center"
        >
          {message}
        </motion.div>
      )}
      
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#5FF9B4]"></div>
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full mt-4 border-separate border-spacing-y-2">
          <thead>
            <tr className="text-[#D1D9FF]">
              <th className="p-3 text-left">Logo</th>
              <th className="p-3 text-left">Nombre</th>
              <th className="p-3 text-left">Slug</th>
              <th className="p-3 text-left">WhatsApp</th>
              <th className="p-3 text-left">Estado</th>
              <th className="p-3 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(businesses || []).map((b, idx) => (
              <motion.tr 
                key={b._id} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.05 }}
                className={`transition-colors bg-[#051C2C]/60 hover:bg-[#051C2C] border-b border-[#333F50]/30`}
              >
                <td className="p-3">
                  {b.logo ? (
                    <img src={b.logo} alt="Logo" className="w-10 h-10 rounded-full object-cover border border-[#5FF9B4] shadow-md" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#333F50] flex items-center justify-center">
                      <svg className="w-6 h-6 text-[#D1D9FF]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  )}
                </td>
                <td className="p-3 font-semibold text-white">{b.businessName}</td>
                <td className="p-3 text-[#D1D9FF]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono bg-[#333F50] px-2 py-0.5 rounded text-xs">{b.slug}</span>
                    <button 
                      title="Copiar slug" 
                      onClick={() => {navigator.clipboard.writeText(b.slug); setMessage('Slug copiado');}} 
                      className="text-[#3A7AFF] hover:text-[#5FF9B4] transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </td>
                <td className="p-3 text-[#D1D9FF]">{b.whatsappNumber || 'N/A'}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${b.isActive ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                    {b.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button 
                      onClick={() => handleActivate(b)} 
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium text-xs shadow-md transition-colors border ${
                        b.isActive 
                          ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30 border-red-500/30' 
                          : 'bg-green-500/20 text-green-300 hover:bg-green-500/30 border-green-500/30'
                      }`}
                    >
                      {b.isActive ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )} 
                      {b.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                    <button 
                      onClick={() => handleOpenAdmin(b)} 
                      title="Panel Admin" 
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium bg-[#3A7AFF]/20 text-[#3A7AFF] hover:bg-[#3A7AFF]/30 shadow-md transition-colors border border-[#3A7AFF]/30 text-xs"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 21l-2.25-4.5M14.25 17L15 21l2.25-4.5M12 3v18" />
                      </svg>
                      Panel
                    </button>
                    <button 
                      onClick={() => handleOpenMenu(b)} 
                      title="Ver Menú" 
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium bg-[#5FF9B4]/20 text-[#5FF9B4] hover:bg-[#5FF9B4]/30 shadow-md transition-colors border border-[#5FF9B4]/30 text-xs"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                      Menú
                    </button>
                    <button 
                      onClick={() => handleDelete(b)} 
                      title="Eliminar" 
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 shadow-md transition-colors border border-red-500/30 text-xs"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Eliminar
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-4 mt-4">
        {(businesses || []).map((b, idx) => (
          <motion.div
            key={b._id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: idx * 0.05 }}
            className="bg-[#051C2C]/60 rounded-xl p-4 border border-[#333F50]/30"
          >
            {/* Header with Logo and Name */}
            <div className="flex items-center gap-3 mb-4">
              {b.logo ? (
                <img src={b.logo} alt="Logo" className="w-12 h-12 rounded-full object-cover border-2 border-[#5FF9B4] shadow-md" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#333F50] flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-[#D1D9FF]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white text-base truncate">{b.businessName}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${b.isActive ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                    {b.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
            </div>

            {/* Slug */}
            <div className="mb-3">
              <p className="text-xs text-[#D1D9FF] mb-1">Slug:</p>
              <div className="flex items-center gap-2">
                <span className="font-mono bg-[#333F50] px-2 py-1 rounded text-xs text-white break-all">{b.slug}</span>
                <button 
                  title="Copiar slug" 
                  onClick={() => {navigator.clipboard.writeText(b.slug); setMessage('Slug copiado');}} 
                  className="text-[#3A7AFF] hover:text-[#5FF9B4] transition-colors flex-shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* WhatsApp */}
            <div className="mb-4">
              <p className="text-xs text-[#D1D9FF] mb-1">WhatsApp:</p>
              <p className="text-sm text-white">{b.whatsappNumber || 'N/A'}</p>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => handleActivate(b)} 
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-medium text-xs shadow-md transition-colors border ${
                  b.isActive 
                    ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30 border-red-500/30' 
                    : 'bg-green-500/20 text-green-300 hover:bg-green-500/30 border-green-500/30'
                }`}
              >
                {b.isActive ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Desactivar
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Activar
                  </>
                )}
              </button>
              <button 
                onClick={() => handleOpenAdmin(b)} 
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-medium bg-[#3A7AFF]/20 text-[#3A7AFF] hover:bg-[#3A7AFF]/30 shadow-md transition-colors border border-[#3A7AFF]/30 text-xs"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 21l-2.25-4.5M14.25 17L15 21l2.25-4.5M12 3v18" />
                </svg>
                Panel Admin
              </button>
              <button 
                onClick={() => handleOpenMenu(b)} 
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-medium bg-[#5FF9B4]/20 text-[#5FF9B4] hover:bg-[#5FF9B4]/30 shadow-md transition-colors border border-[#5FF9B4]/30 text-xs"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                Ver Menú
              </button>
              <button 
                onClick={() => handleDelete(b)} 
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 shadow-md transition-colors border border-red-500/30 text-xs"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Eliminar
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
} 