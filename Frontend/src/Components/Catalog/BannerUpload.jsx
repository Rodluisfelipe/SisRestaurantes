import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBusinessConfig } from '../../Context/BusinessContext';
import { API_URL } from '../../config';

const BannerUpload = () => {
  const { businessConfig } = useBusinessConfig();
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    endDate: '',
    priority: 1,
    image: null
  });

  // Cargar banners existentes
  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    try {
      // Si tenemos businessConfig, cargar banners específicos sin autenticación
      if (businessConfig && businessConfig._id) {
        console.log('Cargando banners para businessId del contexto:', businessConfig._id);
        
        try {
          const response = await fetch(`${API_URL}/banners/business/${businessConfig._id}/public`);
          
          if (response.ok) {
            const data = await response.json();
            setBanners(data.banners || []);
            return;
          } else {
            console.log('Error cargando banners específicos, intentando con autenticación');
          }
        } catch (error) {
          console.log('Error en endpoint sin autenticación:', error);
        }
      }

      // Fallback: intentar con autenticación si hay token
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        setBanners([]);
        return;
      }

      await loadBannersFromMy();
    } catch (error) {
      console.error('Error loading banners:', error);
      setBanners([]);
    }
  };

  const loadBannersFromMy = async () => {
    try {
      const token = localStorage.getItem('accessToken');

      const response = await fetch(`${API_URL}/banners/my`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('Response status en loadBanners:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        setBanners(data.banners || []);
      } else {
        const errorData = await response.json();
        console.log('Error response:', errorData);
      }
    } catch (error) {
      console.error('Error loading banners from /my:', error);
    }
  };


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validar tamaño (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setMessage({
          text: 'La imagen no puede ser mayor a 5MB',
          type: 'error'
        });
        return;
      }

      // Validar tipo de archivo
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setMessage({
          text: 'Solo se permiten archivos JPEG, JPG, PNG o WEBP',
          type: 'error'
        });
        return;
      }

      setFormData(prev => ({
        ...prev,
        image: file
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      // Determinar el contexto y businessId
      let businessId = null;
      let useSuperAdminEndpoint = false;
      let token = localStorage.getItem('accessToken');
      
      // Verificar si estamos en modo SuperAdmin (tiene businessConfig del contexto)
      const isSuperAdminMode = businessConfig && businessConfig._id;
      
      if (isSuperAdminMode) {
        // Modo SuperAdmin: usar businessId del contexto
        businessId = businessConfig._id;
        useSuperAdminEndpoint = true;
      } else {
        // Modo Admin normal: usar token de autenticación
        if (!token) {
          setMessage({
            text: 'No estás autenticado. Por favor, inicia sesión nuevamente.',
            type: 'error'
          });
          setLoading(false);
          return;
        }

        // Obtener businessId del user en localStorage (no decodificar JWT en el cliente)
        try {
          const userStr = localStorage.getItem('user');
          const user = userStr ? JSON.parse(userStr) : null;
          businessId = user?.businessId;
        } catch (e) {
          setMessage({
            text: 'Error al procesar la autenticación. Por favor, inicia sesión nuevamente.',
            type: 'error'
          });
          setLoading(false);
          return;
        }
      }

      if (!businessId) {
        setMessage({
          text: 'No se pudo determinar el negocio. Por favor, asegúrate de estar en el contexto correcto.',
          type: 'error'
        });
        setLoading(false);
        return;
      }

      const formDataToSend = new FormData();
      
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('endDate', formData.endDate);
      formDataToSend.append('priority', formData.priority);
      formDataToSend.append('image', formData.image);
      formDataToSend.append('businessId', businessId); // Agregar businessId al FormData

      // Determinar qué endpoint usar
      const endpoint = useSuperAdminEndpoint 
        ? `${API_URL}/banners/superadmin-create` 
        : `${API_URL}/banners`;

      console.log('Enviando request a:', endpoint);
      console.log('BusinessId:', businessId);
      console.log('UseSuperAdminEndpoint:', useSuperAdminEndpoint);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: useSuperAdminEndpoint 
          ? {} // No necesita Authorization para el endpoint temporal
          : {
              'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
            },
        body: formDataToSend
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      const data = await response.json();
      console.log('Response data:', data);

      if (response.ok) {
        setMessage({
          text: data.message,
          type: 'success'
        });
        setFormData({
          title: '',
          description: '',
          endDate: '',
          priority: 1,
          image: null
        });
        setShowForm(false);
        loadBanners();
      } else {
        setMessage({
          text: data.message || 'Error al crear banner',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error creating banner:', error);
      setMessage({
        text: 'Error al crear banner',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (bannerId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este banner?')) {
      return;
    }

    try {
      // Detectar si estamos en modo SuperAdmin temporal
      const isSuperAdminTemporary = window.location.pathname.includes('/superadmin');
      
      let endpoint = '';
      let headers = {};
      
      if (isSuperAdminTemporary) {
        // Usar endpoint público para SuperAdmin temporal — con auth
        endpoint = `${API_URL}/banners/${bannerId}/delete/public`;
        const saToken = localStorage.getItem('superadmin_token');
        if (saToken) headers['Authorization'] = `Bearer ${saToken}`;
      } else {
        // Usar endpoint para restaurantes — con admin auth
        endpoint = `${API_URL}/banners/${bannerId}/delete/restaurant`;
        const adminToken = localStorage.getItem('accessToken');
        if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
      }

      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers
      });

      if (response.ok) {
        setMessage({
          text: 'Banner eliminado exitosamente',
          type: 'success'
        });
        loadBanners();
      } else {
        const data = await response.json();
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
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-lg p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Banners Promocionales</h2>
          <p className="text-slate-600 mt-1">
            Crea banners para promocionar tu restaurante en el catálogo
          </p>
        </div>
        <div className="flex justify-end">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            {showForm ? 'Cancelar' : 'Nuevo Banner'}
          </motion.button>
        </div>
      </div>

      {/* Formulario de creación */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 p-6 bg-slate-50 rounded-lg border border-slate-200"
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Crear Nuevo Banner</h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Título del Banner *
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: ¡Oferta especial!"
                    required
                    maxLength={100}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Fecha de Fin *
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Descripción
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe tu promoción..."
                  rows={3}
                  maxLength={200}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Prioridad (1-10)
                  </label>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[1,2,3,4,5,6,7,8,9,10].map(num => (
                      <option key={num} value={num}>{num}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Imagen del Banner * (1200x300px recomendado)
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleImageChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-blue-800">Especificaciones del Banner</h4>
                    <ul className="text-sm text-blue-700 mt-1 space-y-1">
                      <li>• Dimensiones recomendadas: 1200x300 píxeles</li>
                      <li>• Formato: JPEG, PNG o WEBP</li>
                      <li>• Tamaño máximo: 5MB</li>
                      <li>• El banner será revisado antes de su publicación</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`px-6 py-2 rounded-lg font-medium transition-all ${
                    loading
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  {loading ? 'Creando...' : 'Crear Banner'}
                </motion.button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Lista de banners */}
      <div className="space-y-4">
        {banners.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📢</span>
            </div>
            <p>No tienes banners creados</p>
            <p className="text-sm">Crea tu primer banner para promocionar tu restaurante</p>
          </div>
        ) : (
          banners.map((banner) => (
            <motion.div
              key={banner._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-50 rounded-lg p-4 border border-slate-200"
            >
              <div className="flex items-start space-x-4">
                <div className="w-32 h-20 bg-slate-200 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    src={`${API_URL.replace('/api', '')}${banner.image}`}
                    alt={banner.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-800">{banner.title}</h3>
                      {banner.description && (
                        <p className="text-sm text-slate-600 mt-1">{banner.description}</p>
                      )}
                      <div className="flex items-center space-x-4 mt-2 text-sm text-slate-500">
                        <span>Fin: {new Date(banner.endDate).toLocaleDateString()}</span>
                        <span>Prioridad: {banner.priority}</span>
                        <span>Clicks: {banner.clicks}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(banner.status)}`}>
                        {getStatusText(banner.status)}
                      </span>
                      <button
                        onClick={() => handleDelete(banner._id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                        title="Eliminar banner"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  {banner.rejectionReason && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                      <strong>Motivo de rechazo:</strong> {banner.rejectionReason}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
};

export default BannerUpload;
