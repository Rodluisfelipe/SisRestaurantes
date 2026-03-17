import React, { useEffect, useState, useRef } from "react";
import { fetchBusinesses, activateBusiness, deleteBusiness, togglePosBeta } from "../../services/superadminApi";
import { socket } from "../../services/socket";
import { motion, AnimatePresence } from "framer-motion";

export default function BusinessTable({ refreshTrigger }) {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "success" });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // all | active | inactive
  const debounceRef = useRef(null);

  const loadBusinesses = async () => {
    setLoading(true);
    try {
      const data = await fetchBusinesses();
      setBusinesses(data.businesses || []);
    } catch (err) {
      showMessage("Error al cargar negocios", "error");
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "success" }), 3000);
  };

  useEffect(() => {
    loadBusinesses();
    if (socket && !socket.connected) socket.connect();
    if (socket) socket.emit('joinSuperAdmin');
    const handler = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => loadBusinesses(), 300);
    };
    if (socket) socket.on('businesses-updated', handler);
    return () => {
      if (socket) { socket.off('businesses-updated', handler); socket.emit('leaveSuperAdmin'); }
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [refreshTrigger]);

  const handleActivate = async (b) => {
    try {
      await activateBusiness(b._id, !b.isActive);
      showMessage(`Negocio ${b.isActive ? 'desactivado' : 'activado'} correctamente`);
      loadBusinesses();
    } catch (err) {
      showMessage("Error al cambiar el estado", "error");
    }
  };

  const handleTogglePos = async (b) => {
    const current = b.features?.posBetaEnabled || false;
    try {
      await togglePosBeta(b._id, !current);
      showMessage(`POS ${current ? 'desactivado' : 'activado'} para ${b.businessName}`);
      loadBusinesses();
    } catch (err) {
      showMessage("Error al cambiar POS beta", "error");
    }
  };

  const handleOpenAdmin = (b) => {
    if (!b.slug) { alert('Este negocio no tiene slug.'); return; }
    const superadminToken = localStorage.getItem('superadmin_token');
    if (!superadminToken) { alert('No tienes sesión activa.'); return; }
    const handoffData = {
      accessToken: superadminToken,
      refreshToken: localStorage.getItem('superadmin_refreshToken') || null,
      user: { businessId: b._id, role: 'superadmin' },
      _ts: Date.now(),
      _ttl: 30000
    };
    localStorage.setItem('sa_handoff', JSON.stringify(handoffData));
    const baseUrl = `${window.location.protocol}//${window.location.host}`;
    window.open(`${baseUrl}/${b.slug}/admin?source=superadmin`, '_blank', 'noopener,noreferrer');
  };

  const handleOpenMenu = (b) => {
    if (!b.slug) { alert('Este negocio no tiene slug.'); return; }
    const baseUrl = `${window.location.protocol}//${window.location.host}`;
    window.open(`${baseUrl}/${b.slug}`, '_blank', 'noopener,noreferrer');
  };

  const handleDelete = async (b) => {
    if (!window.confirm(`¿Eliminar "${b.businessName}"? Esta acción no se puede deshacer.`)) return;
    setLoading(true);
    try {
      await deleteBusiness(b._id);
      showMessage('Negocio eliminado correctamente');
      loadBusinesses();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Error al eliminar', "error");
    } finally {
      setLoading(false);
    }
  };

  const copySlug = (slug) => {
    navigator.clipboard.writeText(slug);
    showMessage('Slug copiado al portapapeles');
  };

  // Filter & search
  const filtered = businesses.filter(b => {
    const matchSearch = !searchTerm || 
      b.businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.slug?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && b.isActive) || 
      (filterStatus === 'inactive' && !b.isActive);
    return matchSearch && matchStatus;
  });

  const stats = {
    total: businesses.length,
    active: businesses.filter(b => b.isActive).length,
    inactive: businesses.filter(b => !b.isActive).length,
  };

  return (
    <div className="p-4 sm:p-6">
      {/* Toast message */}
      <AnimatePresence>
        {message.text && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl border backdrop-blur-xl shadow-xl flex items-center gap-2.5 text-sm ${
              message.type === 'error'
                ? 'bg-red-500/15 border-red-500/20 text-red-300'
                : 'bg-emerald-500/15 border-emerald-500/20 text-emerald-300'
            }`}
          >
            {message.type === 'error' ? (
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'blue' },
          { label: 'Activos', value: stats.active, color: 'emerald' },
          { label: 'Inactivos', value: stats.inactive, color: 'amber' },
        ].map(stat => (
          <div key={stat.label} className={`px-4 py-3 rounded-xl bg-${stat.color}-500/[0.06] border border-${stat.color}-500/10`}>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className={`text-xs text-${stat.color}-400/70`}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Search & Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre o slug..."
            aria-label="Buscar negocio"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 outline-none focus:border-blue-400/30 focus:ring-1 focus:ring-blue-400/10 transition-all"
          />
        </div>
        <div className="flex gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
          {['all', 'active', 'inactive'].map(f => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterStatus === f
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-white/35 hover:text-white/55'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'active' ? 'Activos' : 'Inactivos'}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-blue-400/20 border-t-blue-400 rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
            <svg className="w-8 h-8 text-white/15" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
          </div>
          <p className="text-white/30 text-sm">
            {searchTerm ? 'No se encontraron negocios' : 'No hay negocios registrados'}
          </p>
        </div>
      )}

      {/* Desktop Table */}
      {!loading && filtered.length > 0 && (
        <div className="hidden lg:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left py-3 px-4 text-xs font-medium text-white/30 uppercase tracking-wider">Negocio</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-white/30 uppercase tracking-wider">Slug</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-white/30 uppercase tracking-wider">WhatsApp</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-white/30 uppercase tracking-wider">Estado</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-white/30 uppercase tracking-wider">POS</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-white/30 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map((b, idx) => (
                <motion.tr
                  key={b._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.03 }}
                  className="group hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      {b.logo ? (
                        <img src={b.logo} alt="" className="w-9 h-9 rounded-xl object-cover border border-white/10" />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-white/10 flex items-center justify-center">
                          <span className="text-sm font-bold text-blue-400">{b.businessName?.charAt(0)?.toUpperCase()}</span>
                        </div>
                      )}
                      <span className="font-medium text-white text-sm">{b.businessName}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <button onClick={() => copySlug(b.slug)} className="inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/50 hover:text-white/80 hover:border-white/10 transition-all group/slug">
                      {b.slug}
                      <svg className="w-3 h-3 opacity-0 group-hover/slug:opacity-100 transition-opacity" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                      </svg>
                    </button>
                  </td>
                  <td className="py-3.5 px-4 text-sm text-white/40">{b.whatsappNumber || '—'}</td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      b.isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                        : 'bg-white/[0.04] text-white/30 border border-white/[0.06]'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${b.isActive ? 'bg-emerald-400' : 'bg-white/20'}`} />
                      {b.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <button
                      onClick={() => handleTogglePos(b)}
                      title={b.features?.posBetaEnabled ? 'Desactivar POS' : 'Activar POS'}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                        b.features?.posBetaEnabled
                          ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20 hover:bg-purple-500/25'
                          : 'bg-white/[0.04] text-white/25 border border-white/[0.06] hover:text-white/40 hover:border-white/10'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${b.features?.posBetaEnabled ? 'bg-purple-400' : 'bg-white/20'}`} />
                      {b.features?.posBetaEnabled ? 'POS ✓' : 'POS'}
                    </button>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center justify-end gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleActivate(b)}
                        title={b.isActive ? 'Desactivar' : 'Activar'}
                        className={`p-2 rounded-lg transition-all ${
                          b.isActive
                            ? 'text-amber-400/60 hover:text-amber-400 hover:bg-amber-500/10'
                            : 'text-emerald-400/60 hover:text-emerald-400 hover:bg-emerald-500/10'
                        }`}
                      >
                        {b.isActive ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => handleOpenAdmin(b)}
                        title="Panel Admin"
                        className="p-2 rounded-lg text-blue-400/60 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleOpenMenu(b)}
                        title="Ver Menú"
                        className="p-2 rounded-lg text-emerald-400/60 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(b)}
                        title="Eliminar"
                        className="p-2 rounded-lg text-red-400/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile Card View */}
      {!loading && filtered.length > 0 && (
        <div className="lg:hidden space-y-3">
          {filtered.map((b, idx) => (
            <motion.div
              key={b._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4"
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-3">
                {b.logo ? (
                  <img src={b.logo} alt="" className="w-11 h-11 rounded-xl object-cover border border-white/10" />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-base font-bold text-blue-400">{b.businessName?.charAt(0)?.toUpperCase()}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white text-sm truncate">{b.businessName}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      b.isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                        : 'bg-white/[0.04] text-white/30 border border-white/[0.06]'
                    }`}>
                      <span className={`w-1 h-1 rounded-full ${b.isActive ? 'bg-emerald-400' : 'bg-white/20'}`} />
                      {b.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                    <button onClick={() => copySlug(b.slug)} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/30 hover:text-white/60 transition-colors">
                      {b.slug}
                    </button>
                  </div>
                </div>
              </div>

              {b.whatsappNumber && (
                <p className="text-xs text-white/25 mb-3 ml-14">WhatsApp: {b.whatsappNumber}</p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1.5 ml-14">
                <button
                  onClick={() => handleTogglePos(b)}
                  className={`flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                    b.features?.posBetaEnabled
                      ? 'bg-purple-500/15 text-purple-400/90 border border-purple-500/15'
                      : 'bg-white/[0.03] text-white/25 border border-white/[0.06]'
                  }`}
                  title={b.features?.posBetaEnabled ? 'Desactivar POS' : 'Activar POS'}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                  </svg>
                  POS
                </button>
                <button
                  onClick={() => handleActivate(b)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    b.isActive
                      ? 'bg-amber-500/10 text-amber-400/80 border border-amber-500/10'
                      : 'bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/10'
                  }`}
                >
                  {b.isActive ? 'Desactivar' : 'Activar'}
                </button>
                <button
                  onClick={() => handleOpenAdmin(b)}
                  className="p-2 rounded-lg text-blue-400/60 hover:text-blue-400 bg-blue-500/10 border border-blue-500/10 transition-all"
                  title="Panel"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </button>
                <button
                  onClick={() => handleOpenMenu(b)}
                  className="p-2 rounded-lg text-emerald-400/60 hover:text-emerald-400 bg-emerald-500/10 border border-emerald-500/10 transition-all"
                  title="Menú"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(b)}
                  className="p-2 rounded-lg text-red-400/40 hover:text-red-400 bg-red-500/10 border border-red-500/10 transition-all"
                  title="Eliminar"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Count footer */}
      {!loading && filtered.length > 0 && (
        <div className="mt-4 text-center">
          <p className="text-xs text-white/20">
            {filtered.length} de {businesses.length} negocio{businesses.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
