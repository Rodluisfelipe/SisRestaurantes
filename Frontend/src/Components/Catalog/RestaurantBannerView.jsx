import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../../config';
import { useBusinessConfig } from '../../Context/BusinessContext';

const RestaurantBannerView = () => {
  const { businessConfig } = useBusinessConfig();
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [activeTab, setActiveTab] = useState('approved'); // 'approved', 'pending', 'rejected'

  useEffect(() => {
    loadBanners();
  }, [activeTab, businessConfig]);

  const loadBanners = async () => {
    setLoading(true);
    try {
      let businessId = null;
      
      // Priorizar businessConfig del contexto si está disponible
      if (businessConfig && businessConfig._id) {
        businessId = businessConfig._id;
      } else {
        // Fallback: intentar obtener del user data almacenado
        const userStr = localStorage.getItem('user');
        
        if (!userStr) {
          setMessage({
            text: 'No se pudo determinar el negocio. Asegúrate de estar en el contexto correcto.',
            type: 'error'
          });
          setBanners([]);
          return;
        }

        // Obtener businessId del user data
        try {
          const user = JSON.parse(userStr);
          businessId = user.businessId;
        } catch (e) {
          setMessage({
            text: 'Error al obtener información del negocio',
            type: 'error'
          });
          setBanners([]);
          return;
        }

        if (!businessId) {
          setMessage({
            text: 'No se pudo determinar el negocio',
            type: 'error'
          });
          setBanners([]);
          return;
        }
      }

      // Cargar banners específicos del negocio usando endpoint público
      const response = await fetch(`${API_URL}/banners/business/${businessId}/public`);
      
      if (response.ok) {
        const data = await response.json();
        let filteredBanners = data.banners || [];
        
        // Filtrar por estado según la pestaña activa
        if (activeTab !== 'all') {
          filteredBanners = filteredBanners.filter(banner => banner.status === activeTab);
        }
        
        setBanners(filteredBanners);
      } else {
        setBanners([]);
      }
    } catch (error) {
      console.error('Error loading banners:', error);
      setBanners([]);
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
      case 'approved': return 'Aprobado y Activo';
      case 'rejected': return 'Rechazado';
      case 'pending': return 'Pendiente de Aprobación';
      default: return 'Desconocido';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return '✅';
      case 'rejected': return '❌';
      case 'pending': return '⏳';
      default: return '❓';
    }
  };

  const getTabCount = (status) => {
    return banners.filter(banner => banner.status === status).length;
  };

  return (
    <div className="space-y-6">
      {/* Header con información */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-xl">📢</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-blue-900">Mis Banners Promocionales</h3>
            <p className="text-sm text-blue-700">
              Gestiona y visualiza el estado de tus banners en el catálogo MenuBy
            </p>
          </div>
        </div>
      </div>

      {/* Tabs de navegación */}
      <div className="flex space-x-2 bg-slate-100 p-1 rounded-lg">
        {[
          { id: 'approved', label: 'Aprobados', count: getTabCount('approved') },
          { id: 'pending', label: 'Pendientes', count: getTabCount('pending') },
          { id: 'rejected', label: 'Rechazados', count: getTabCount('rejected') }
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
            <p className="text-slate-600 mt-4">Cargando tus banners...</p>
          </div>
        ) : banners.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📢</span>
            </div>
            <p className="text-lg font-medium">
              {activeTab === 'approved' && 'No tienes banners aprobados'}
              {activeTab === 'pending' && 'No tienes banners pendientes'}
              {activeTab === 'rejected' && 'No tienes banners rechazados'}
            </p>
            <p className="text-sm">
              {activeTab === 'approved' && 'Los banners aprobados aparecen en el catálogo MenuBy'}
              {activeTab === 'pending' && 'Los banners pendientes están esperando aprobación del administrador'}
              {activeTab === 'rejected' && 'Los banners rechazados no aparecen en el catálogo'}
            </p>
          </div>
        ) : (
          banners.map((banner) => (
            <motion.div
              key={banner._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
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
                        <span className={`px-3 py-1 rounded-full text-sm font-medium border flex items-center space-x-1 ${getStatusColor(banner.status)}`}>
                          <span>{getStatusIcon(banner.status)}</span>
                          <span>{getStatusText(banner.status)}</span>
                        </span>
                      </div>
                      
                      {banner.description && (
                        <p className="text-slate-600 mb-3">{banner.description}</p>
                      )}
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-slate-500">Fecha de fin:</span>
                          <p className="font-medium text-slate-800">
                            {new Date(banner.endDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500">Prioridad:</span>
                          <p className="font-medium text-slate-800">{banner.priority}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Clicks:</span>
                          <p className="font-medium text-slate-800">{banner.clicks}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Creado:</span>
                          <p className="font-medium text-slate-800">
                            {new Date(banner.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      {banner.rejectionReason && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-red-700">
                            <strong>Motivo de rechazo:</strong> {banner.rejectionReason}
                          </p>
                        </div>
                      )}

                      {banner.status === 'approved' && (
                        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-sm text-green-700">
                            <strong>¡Tu banner está activo!</strong> Aparece en el catálogo MenuBy y los usuarios pueden verlo.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Información adicional */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h4 className="font-semibold text-slate-800 mb-2">Información sobre los banners:</h4>
        <ul className="text-sm text-slate-600 space-y-1">
          <li>• <strong>Aprobados:</strong> Aparecen en el catálogo MenuBy y son visibles para los usuarios</li>
          <li>• <strong>Pendientes:</strong> Están esperando la aprobación del administrador</li>
          <li>• <strong>Rechazados:</strong> No aparecen en el catálogo, revisa el motivo de rechazo</li>
          <li>• Los banners se muestran en orden de prioridad (mayor número = mayor prioridad)</li>
        </ul>
      </div>
    </div>
  );
};

export default RestaurantBannerView;
