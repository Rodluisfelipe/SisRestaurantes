import React, { useEffect, useState, useRef } from "react";
import api, { socket } from "../services/api";

export default function BusinessTable({ onCopyUrl, refreshTrigger }) {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const debounceRef = useRef(null);

  const fetchBusinesses = async () => {
    setLoading(true);
    try {
      const res = await api.get("/business");
      setBusinesses(res.data);
    } catch (err) {
      setMessage("Error al cargar negocios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinesses();
    if (!socket.connected) {
      socket.connect();
    }
    // Debounce para evitar bucles de peticiones
    const handler = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchBusinesses();
      }, 300); // 300ms de espera
    };
    socket.on('businesses_update', handler);
    return () => {
      socket.off('businesses_update', handler);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [refreshTrigger]);

  const handleActivate = async (b) => {
    try {
      await api.patch(`/business/${b._id}/activate`, { isActive: !b.isActive });
      setMessage(`Negocio ${b.isActive ? 'desactivado' : 'activado'} correctamente`);
      fetchBusinesses();
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
    
    // Try localStorage first (this will work in some environments)
    try {
      localStorage.setItem('temp_accessToken', tempAuthData.accessToken);
      localStorage.setItem('temp_refreshToken', tempAuthData.refreshToken);
      localStorage.setItem('temp_user', JSON.stringify(tempAuthData.user));
      localStorage.setItem('temp_businessSlug', b.slug);
    } catch (e) {
      console.warn('Could not access localStorage', e);
    }
    
    // Try setting cookies as well (these can work across same-origin domains with different ports)
    try {
      document.cookie = `sa_accessToken=${tempAuthData.accessToken}; path=/`;
      document.cookie = `sa_refreshToken=${tempAuthData.refreshToken}; path=/`;
      document.cookie = `sa_user=${encodeURIComponent(JSON.stringify(tempAuthData.user))}; path=/`;
      document.cookie = `sa_businessSlug=${b.slug}; path=/`;
    } catch (e) {
      console.warn('Could not set cookies', e);
    }
    
    // Also encode the auth data in the URL as fallback
    const encodedAuthData = encodeURIComponent(JSON.stringify(tempAuthData));
    const baseUrl = window.location.origin.replace('5174', '5173');
    const url = `${baseUrl}/${b.slug}/admin?satoken=${encodedAuthData}&source=superadmin`;
    
    window.open(url, '_blank');
  };

  const handleOpenMenu = (b) => {
    if (!b.slug) {
      alert('Este negocio no tiene slug. Asígnale uno desde la base de datos.');
      return;
    }
    const url = `${window.location.origin.replace('5174', '5173')}/${b.slug}`;
    window.open(url, '_blank');
  };

  const handleDelete = async (b) => {
    if (!window.confirm(`¿Seguro que quieres eliminar el negocio "${b.businessName}"? Esta acción no se puede deshacer.`)) return;
    setLoading(true);
    setMessage("");
    try {
      await api.delete(`/business/${b._id}`);
      setMessage('Negocio eliminado correctamente');
      fetchBusinesses();
    } catch (err) {
      setMessage(err.response?.data?.message || err.message || 'Error al eliminar negocio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {message && <div className="mb-4 text-green-700 bg-green-100 border border-green-300 rounded p-2 text-center font-medium">{message}</div>}
      <div className="overflow-x-auto">
        <table className="w-full mt-4 bg-white rounded-xl shadow border-separate border-spacing-y-2">
          <thead>
            <tr className="bg-indigo-50 text-indigo-800">
              <th className="p-3 rounded-l-xl">Logo</th>
              <th className="p-3">Nombre</th>
              <th className="p-3">Slug</th>
              <th className="p-3">WhatsApp</th>
              <th className="p-3">Estado</th>
              <th className="p-3 rounded-r-xl">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b, idx) => (
              <tr key={b._id} className={`transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-indigo-50'} hover:bg-indigo-100`}>
                <td className="p-3 text-center">
                  {b.logo ? (
                    <img src={b.logo} alt="Logo" className="w-10 h-10 rounded-full object-cover border shadow mx-auto" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center mx-auto">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                    </div>
                  )}
                </td>
                <td className="p-3 font-semibold text-gray-800">{b.businessName}</td>
                <td className="p-3 text-gray-600 flex items-center gap-2">
                  <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-xs">{b.slug}</span>
                  <button title="Copiar slug" onClick={() => {navigator.clipboard.writeText(b.slug); setMessage('Slug copiado');}} className="text-indigo-500 hover:text-indigo-700">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" /></svg>
                  </button>
                </td>
                <td className="p-3 text-gray-600">{b.whatsappNumber}</td>
                <td className="p-3">
                  {b.isActive ? (
                    <span className="inline-block px-3 py-1 text-xs font-bold bg-green-100 text-green-700 rounded-full">Activo</span>
                  ) : (
                    <span className="inline-block px-3 py-1 text-xs font-bold bg-red-100 text-red-700 rounded-full">Inactivo</span>
                  )}
                </td>
                <td className="p-3 flex flex-wrap gap-2">
                  <button onClick={() => handleActivate(b)} title={b.isActive ? 'Desactivar' : 'Activar'} className={`flex items-center gap-1 px-3 py-1 rounded font-semibold shadow transition-colors ${b.isActive ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : 'bg-green-100 text-green-800 hover:bg-green-200'}`}>{b.isActive ? (<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-1.414 1.414A9 9 0 105.636 18.364l1.414-1.414" /></svg>) : (<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>)} {b.isActive ? 'Desactivar' : 'Activar'}</button>
                  <button onClick={() => handleOpenAdmin(b)} title="Panel Admin" className="flex items-center gap-1 px-3 py-1 rounded font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200 shadow transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 21l-2.25-4.5M14.25 17L15 21l2.25-4.5M12 3v18" /></svg>Panel Admin</button>
                  <button onClick={() => {
                    if (!b.slug) {
                      alert('Este negocio no tiene slug. Asígnale uno desde la base de datos.');
                      return;
                    }
                    // Simplified approach that only uses URL parameter
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
                    const encodedAuthData = encodeURIComponent(JSON.stringify(tempAuthData));
                    const baseUrl = window.location.origin.replace('5174', '5173');
                    const url = `${baseUrl}/${b.slug}/admin?satoken=${encodedAuthData}`;
                    window.open(url, '_blank');
                  }} title="Acceso Directo" className="flex items-center gap-1 px-3 py-1 rounded font-semibold bg-purple-100 text-purple-700 hover:bg-purple-200 shadow transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Acceso Directo
                  </button>
                  <button onClick={() => handleOpenMenu(b)} title="Ver Menú" className="flex items-center gap-1 px-3 py-1 rounded font-semibold bg-green-100 text-green-700 hover:bg-green-200 shadow transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>Ver Menú</button>
                  <button onClick={() => handleDelete(b)} title="Eliminar" className="flex items-center gap-1 px-3 py-1 rounded font-semibold bg-red-100 text-red-700 hover:bg-red-200 shadow transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading && <div className="mt-4 flex justify-center"><span className="inline-block w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></span></div>}
    </div>
  );
} 