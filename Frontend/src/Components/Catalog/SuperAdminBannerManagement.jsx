import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../../config';

// Helper: build auth headers for SuperAdmin requests
const saAuthHeaders = (extra = {}) => {
  const token = localStorage.getItem('superadmin_token');
  return {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...extra
  };
};

const SuperAdminBannerManagement = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [selectedBanner, setSelectedBanner] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'approved', 'rejected', 'all'

  useEffect(() => {
    loadBanners();
  }, [activeTab]);

  const loadBanners = async () => {
    setLoading(true);
    try {
      let endpoint = '';
      
      switch (activeTab) {
        case 'pending':
          endpoint = `${API_URL}/banners/pending/public`;
          break;
        case 'approved':
          endpoint = `${API_URL}/banners/approved/public`;
          break;
        case 'rejected':
          endpoint = `${API_URL}/banners/rejected/public`;
          break;
        case 'all':
          endpoint = `${API_URL}/banners/all/public`;
          break;
        default:
          endpoint = `${API_URL}/banners/pending/public`;
      }

      const response = await fetch(endpoint, { headers: saAuthHeaders() });
      
      if (response.ok) {
        const data = await response.json();
        setBanners(data.banners || []);
      } else {
        console.log('Error cargando banners');
        setBanners([]);
      }
    } catch (error) {
      console.error('Error loading banners:', error);
      setBanners([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (bannerId, priority = 1) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/banners/${bannerId}/approve/public`, {
        method: 'PUT',
        headers: saAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ priority })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          text: 'Banner aprobado exitosamente',
          type: 'success'
        });
        loadBanners();
      } else {
        setMessage({
          text: data.message || 'Error al aprobar banner',
          type: 'error'
        });
      }
    } catch (error) {
      setMessage({
        text: 'Error al aprobar banner',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedBanner || !rejectionReason.trim()) {
      setMessage({
        text: 'Por favor, proporciona un motivo de rechazo',
        type: 'error'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/banners/${selectedBanner._id}/reject/public`, {
        method: 'PUT',
        headers: saAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ reason: rejectionReason })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          text: 'Banner rechazado',
          type: 'success'
        });
        setShowRejectModal(false);
        setRejectionReason('');
        setSelectedBanner(null);
        loadBanners();
      } else {
        setMessage({
          text: data.message || 'Error al rechazar banner',
          type: 'error'
        });
      }
    } catch (error) {
      setMessage({
        text: 'Error al rechazar banner',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (bannerId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este banner permanentemente?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/banners/${bannerId}/delete/public`, {
        method: 'DELETE',
        headers: saAuthHeaders()
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          text: 'Banner eliminado exitosamente',
          type: 'success'
        });
        loadBanners();
      } else {
        setMessage({
          text: data.message || 'Error al eliminar banner',
          type: 'error'
        });
      }
    } catch (error) {
      setMessage({
        text: 'Error al eliminar banner',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (bannerId, currentStatus) => {
    const newStatus = currentStatus === 'approved' ? 'pending' : 'approved';
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/banners/${bannerId}/toggle-status/public`, {
        method: 'PUT',
        headers: saAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          text: `Banner ${newStatus === 'approved' ? 'activado' : 'desactivado'} exitosamente`,
          type: 'success'
        });
        loadBanners();
      } else {
        setMessage({
          text: data.message || 'Error al cambiar estado del banner',
          type: 'error'
        });
      }
    } catch (error) {
      setMessage({
        text: 'Error al cambiar estado del banner',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'approved': return 'Aprobado';
      case 'rejected': return 'Rechazado';
      case 'pending': return 'Pendiente';
      default: return 'Desconocido';
    }
  };

  const getTabCount = (status) => {
    return banners.filter(banner => banner.status === status).length;
  };

  return (
    <div className="space-y-6">
      {/* Tabs de navegación */}
      <div className="flex space-x-2 bg-slate-100 p-1 rounded-lg">
        {[
          { id: 'pending', label: 'Pendientes', count: getTabCount('pending') },
          { id: 'approved', label: 'Aprobados', count: getTabCount('approved') },
          { id: 'rejected', label: 'Rechazados', count: getTabCount('rejected') },
          { id: 'all', label: 'Todos', count: banners.length }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-2 rounded-md font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                activeTab === tab.id
                  ? 'bg-slate-200 text-slate-700'
                  : 'bg-slate-300 text-slate-600'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Mensaje de estado */}
      <AnimatePresence>
        {message.text && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-lg ${
              message.type === 'success' 
                ? 'bg-green-50 border border-green-200 text-green-800' 
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lista de banners */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-slate-600 mt-4">Cargando banners...</p>
          </div>
        ) : banners.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📢</span>
            </div>
            <p className="text-lg font-medium">No hay banners {activeTab === 'all' ? '' : activeTab}</p>
            <p className="text-sm">Los banners aparecerán aquí cuando estén disponibles</p>
          </div>
        ) : (
          banners.map((banner) => (
            <motion.div
              key={banner._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm"
            >
              <div className="flex items-start space-x-6">
                {/* Imagen del banner */}
                <div className="w-48 h-24 bg-slate-200 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    src={`${API_URL.replace('/api', '')}${banner.image}`}
                    alt={banner.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      console.log('Error loading image:', banner.image);
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
                
                {/* Información del banner */}
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-800">{banner.title}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(banner.status)}`}>
                          {getStatusText(banner.status)}
                        </span>
                      </div>
                      
                      {banner.description && (
                        <p className="text-slate-600 mb-2">{banner.description}</p>
                      )}
                      
                      <div className="flex items-center space-x-4 text-sm text-slate-500">
                        <span><strong>Negocio:</strong> {banner.businessName}</span>
                        <span><strong>Fin:</strong> {new Date(banner.endDate).toLocaleDateString()}</span>
                        <span><strong>Prioridad:</strong> {banner.priority}</span>
                        <span><strong>Clicks:</strong> {banner.clicks}</span>
                      </div>
                      
                      {banner.rejectionReason && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                          <strong>Motivo de rechazo:</strong> {banner.rejectionReason}
                        </div>
                      )}
                    </div>
                    
                    {/* Acciones */}
                    <div className="flex items-center space-x-2">
                      {banner.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(banner._id, banner.priority)}
                            disabled={loading}
                            className="px-3 py-1 bg-green-500 text-slate-900 dark:text-white rounded-md hover:bg-green-600 transition-colors text-sm font-medium disabled:opacity-50"
                          >
                            Aprobar
                          </button>
                          <button
                            onClick={() => {
                              setSelectedBanner(banner);
                              setShowRejectModal(true);
                            }}
                            disabled={loading}
                            className="px-3 py-1 bg-red-500 text-slate-900 dark:text-white rounded-md hover:bg-red-600 transition-colors text-sm font-medium disabled:opacity-50"
                          >
                            Rechazar
                          </button>
                        </>
                      )}
                      
                      {banner.status === 'approved' && (
                        <button
                          onClick={() => handleToggleStatus(banner._id, banner.status)}
                          disabled={loading}
                          className="px-3 py-1 bg-yellow-500 text-slate-900 dark:text-white rounded-md hover:bg-yellow-600 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                          Desactivar
                        </button>
                      )}
                      
                      {banner.status === 'pending' && (
                        <button
                          onClick={() => handleToggleStatus(banner._id, banner.status)}
                          disabled={loading}
                          className="px-3 py-1 bg-blue-500 text-slate-900 dark:text-white rounded-md hover:bg-blue-600 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                          Activar
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleDelete(banner._id)}
                        disabled={loading}
                        className="px-3 py-1 bg-red-600 text-slate-900 dark:text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Modal de rechazo */}
      <AnimatePresence>
        {showRejectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowRejectModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg p-6 w-full max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-slate-800 mb-4">
                Rechazar Banner
              </h3>
              <p className="text-slate-600 mb-4">
                ¿Por qué quieres rechazar este banner?
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Motivo del rechazo..."
                rows={3}
              />
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectionReason('');
                    setSelectedBanner(null);
                  }}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleReject}
                  disabled={loading || !rejectionReason.trim()}
                  className="px-4 py-2 bg-red-500 text-slate-900 dark:text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Rechazando...' : 'Rechazar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SuperAdminBannerManagement;
