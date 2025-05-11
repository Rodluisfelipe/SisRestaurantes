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
      setBusinesses(data);
    } catch (err) {
      setMessage("Error al cargar negocios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBusinesses();
    
    // Conectar al socket para escuchar actualizaciones
    if (!socket.connected) {
      socket.connect();
    }
    
    socket.emit('joinSuperAdmin');
    
    // Debounce para evitar bucles de peticiones
    const handler = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        loadBusinesses();
      }, 300); // 300ms de espera
    };
    
    socket.on('businesses-updated', handler);
    
    return () => {
      socket.off('businesses-updated', handler);
      socket.emit('leaveSuperAdmin');
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
    
    // Generate temporary auth token for direct admin access
    const tempAuthData = {
      accessToken: `temp_sa_token_${Date.now()}`,
      refreshToken: `temp_sa_refresh_${Date.now()}`,
      user: {
        _id: `temp_${Date.now()}`,
        username: 'superadmin_temp',
        businessId: b._id,
        role: 'superadmin'
      }
    };
    
    // Encode the auth data in the URL
    const encodedAuthData = encodeURIComponent(JSON.stringify(tempAuthData));
    const baseUrl = `${window.location.protocol}//${window.location.host}`;
    const url = `${baseUrl}/${b.slug}/admin?satoken=${encodedAuthData}&source=superadmin`;
    
    window.open(url, '_blank');
  };

  const handleOpenMenu = (b) => {
    if (!b.slug) {
      alert('Este negocio no tiene slug. Asígnale uno desde la base de datos.');
      return;
    }
    const baseUrl = `${window.location.protocol}//${window.location.host}`;
    const url = `${baseUrl}/${b.slug}`;
    window.open(url, '_blank');
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
      <div className="overflow-x-auto">
        <table className="w-full mt-4 border-separate border-spacing-y-2">
          <thead>
            <tr className="text-[#D1D9FF]">
              <th className="p-3">Logo</th>
              <th className="p-3">Nombre</th>
              <th className="p-3">Slug</th>
              <th className="p-3">WhatsApp</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b, idx) => (
              <motion.tr 
                key={b._id} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.05 }}
                className={`transition-colors bg-[#051C2C]/60 hover:bg-[#051C2C] border-b border-[#333F50]/30`}
              >
                <td className="p-3 text-center">
                  {b.logo ? (
                    <img src={b.logo} alt="Logo" className="w-10 h-10 rounded-full object-cover border border-[#5FF9B4] shadow-md mx-auto" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#333F50] flex items-center justify-center mx-auto">
                      <svg className="w-6 h-6 text-[#D1D9FF]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  )}
                </td>
                <td className="p-3 font-semibold text-white">{b.businessName}</td>
                <td className="p-3 text-[#D1D9FF] flex items-center gap-2">
                  <span className="font-mono bg-[#333F50] px-2 py-0.5 rounded text-xs">{b.slug}</span>
                  <button 
                    title="Copiar slug" 
                    onClick={() => {navigator.clipboard.writeText(b.slug); setMessage('Slug copiado');}} 
                    className="text-[#3A7AFF] hover:text-[#5FF9B4] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15V5a2 2 0 012-2h10" />
                    </svg>
                  </button>
                </td>
                <td className="p-3 text-[#D1D9FF]">{b.whatsappNumber}</td>
                <td className="p-3">
                  {b.isActive ? (
                    <span className="inline-block px-3 py-1 text-xs font-bold bg-green-500/20 text-green-300 rounded-full">Activo</span>
                  ) : (
                    <span className="inline-block px-3 py-1 text-xs font-bold bg-red-500/20 text-red-300 rounded-full">Inactivo</span>
                  )}
                </td>
                <td className="p-3 flex flex-wrap gap-2">
                  <button 
                    onClick={() => handleActivate(b)} 
                    title={b.isActive ? 'Desactivar' : 'Activar'} 
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium shadow-md transition-colors ${
                      b.isActive 
                        ? 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 border border-yellow-500/30' 
                        : 'bg-green-500/20 text-green-300 hover:bg-green-500/30 border border-green-500/30'
                    }`}
                  >
                    {b.isActive ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-1.414 1.414A9 9 0 105.636 18.364l1.414-1.414" />
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
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium bg-[#3A7AFF]/20 text-[#3A7AFF] hover:bg-[#3A7AFF]/30 shadow-md transition-colors border border-[#3A7AFF]/30"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 21l-2.25-4.5M14.25 17L15 21l2.25-4.5M12 3v18" />
                    </svg>
                    Panel Admin
                  </button>
                  <button 
                    onClick={() => handleOpenMenu(b)} 
                    title="Ver Menú" 
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium bg-[#5FF9B4]/20 text-[#5FF9B4] hover:bg-[#5FF9B4]/30 shadow-md transition-colors border border-[#5FF9B4]/30"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    Ver Menú
                  </button>
                  <button 
                    onClick={() => handleDelete(b)} 
                    title="Eliminar" 
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 shadow-md transition-colors border border-red-500/30"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Eliminar
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading && (
        <div className="mt-4 flex justify-center">
          <svg className="animate-spin h-10 w-10 text-[#3A7AFF]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}
    </div>
  );
} 