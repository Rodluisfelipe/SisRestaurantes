import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../../config';

const BannerApproval = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [selectedBanner, setSelectedBanner] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    loadPendingBanners();
  }, []);

  const loadPendingBanners = async () => {
    try {
      // Detectar si estamos en modo SuperAdmin temporal
      const isSuperAdminTemporary = window.location.pathname.includes('/superadmin');
      
      if (isSuperAdminTemporary) {
        // Usar endpoint público para SuperAdmin temporal
        const response = await fetch(`${API_URL}/banners/pending/public`);
        
        if (response.ok) {
          const data = await response.json();
          setBanners(data.banners || []);
        } else {
          console.log('Error cargando banners pendientes (público)');
        }
      } else {
        // Usar endpoint normal con autenticación
        const token = localStorage.getItem('accessToken');
        const response = await fetch(`${API_URL}/banners/pending`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setBanners(data.banners || []);
        } else {
          console.log('Error cargando banners pendientes (autenticado)');
        }
      }
    } catch (error) {
      console.error('Error loading pending banners:', error);
    }
  };

  const handleApprove = async (bannerId, priority = 1) => {
    setLoading(true);
    try {
      // Detectar si estamos en modo SuperAdmin temporal
      const isSuperAdminTemporary = window.location.pathname.includes('/superadmin');
      
      const endpoint = isSuperAdminTemporary 
        ? `${API_URL}/banners/${bannerId}/approve/public`
        : `${API_URL}/banners/${bannerId}/approve`;

      const headers = {
        'Content-Type': 'application/json'
      };

      // Solo agregar Authorization si no estamos en modo temporal
      if (!isSuperAdminTemporary) {
        const token = localStorage.getItem('accessToken');
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ priority })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          text: 'Banner aprobado exitosamente',
          type: 'success'
        });
        loadPendingBanners();
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
      // Detectar si estamos en modo SuperAdmin temporal
      const isSuperAdminTemporary = window.location.pathname.includes('/superadmin');
      
      const endpoint = isSuperAdminTemporary 
        ? `${API_URL}/banners/${selectedBanner._id}/reject/public`
        : `${API_URL}/banners/${selectedBanner._id}/reject`;

      const headers = {
        'Content-Type': 'application/json'
      };

      // Solo agregar Authorization si no estamos en modo temporal
      if (!isSuperAdminTemporary) {
        const token = localStorage.getItem('accessToken');
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers,
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
        loadPendingBanners();
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

  const openRejectModal = (banner) => {
    setSelectedBanner(banner);
    setShowRejectModal(true);
    setRejectionReason('');
  };

  const closeRejectModal = () => {
    setShowRejectModal(false);
    setSelectedBanner(null);
    setRejectionReason('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-lg p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Aprobación de Banners</h2>
          <p className="text-slate-600 mt-1">
            Revisa y aprueba los banners promocionales de los restaurantes
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
            {banners.length} Pendientes
          </span>
        </div>
      </div>

      {/* Mensaje de estado */}
      <AnimatePresence>
        {message.text && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-lg mb-6 ${
              message.type === 'success' 
                ? 'bg-green-50 border border-green-200 text-green-800' 
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lista de banners pendientes */}
      <div className="space-y-6">
        {banners.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✅</span>
            </div>
            <p className="text-lg font-medium">No hay banners pendientes</p>
            <p className="text-sm">Todos los banners han sido revisados</p>
          </div>
        ) : (
          banners.map((banner) => (
            <motion.div
              key={banner._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-50 rounded-lg p-6 border border-slate-200"
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
                      console.log('Full URL:', `${API_URL.replace('/api', '')}${banner.image}`);
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
                
                {/* Información del banner */}
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">{banner.title}</h3>
                      {banner.description && (
                        <p className="text-slate-600 mt-1">{banner.description}</p>
                      )}
                      
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center space-x-4 text-sm text-slate-500">
                          <span className="flex items-center space-x-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            <span>{banner.businessName}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>Fin: {new Date(banner.endDate).toLocaleDateString()}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span>Prioridad: {banner.priority}</span>
                          </span>
                        </div>
                        
                        <div className="text-xs text-slate-400">
                          Creado: {new Date(banner.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    
                    {/* Botones de acción */}
                    <div className="flex items-center space-x-3">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleApprove(banner._id, banner.priority)}
                        disabled={loading}
                        className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                      >
                        Aprobar
                      </motion.button>
                      
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => openRejectModal(banner)}
                        disabled={loading}
                        className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        Rechazar
                      </motion.button>
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
            onClick={closeRejectModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-slate-800 mb-4">
                Rechazar Banner
              </h3>
              
              <div className="mb-4">
                <p className="text-sm text-slate-600 mb-2">
                  Banner: <strong>{selectedBanner?.title}</strong>
                </p>
                <p className="text-sm text-slate-600">
                  Restaurante: <strong>{selectedBanner?.businessName}</strong>
                </p>
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Motivo del rechazo *
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  rows={4}
                  placeholder="Explica por qué se rechaza este banner..."
                  required
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={closeRejectModal}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleReject}
                  disabled={loading || !rejectionReason.trim()}
                  className={`px-6 py-2 rounded-lg font-medium transition-all ${
                    loading || !rejectionReason.trim()
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-red-500 text-white hover:bg-red-600'
                  }`}
                >
                  {loading ? 'Rechazando...' : 'Rechazar Banner'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default BannerApproval;
