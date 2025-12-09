import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';
import { socket } from '../services/socket';
import BusinessHoursSettings from './BusinessHoursSettings';

const BusinessSettings = () => {
  const initialSettings = {
    businessName: '',
    description: '',
    logo: '',
    coverImage: '',
    isOpen: true,
    whatsappNumber: '',
    address: '',
    googleMapsUrl: '',
    socialMedia: {
      facebook: { url: '', isVisible: true },
      instagram: { url: '', isVisible: true },
      tiktok: { url: '', isVisible: true }
    },
    extraLink: { url: '', isVisible: true }
  };

  const [settings, setSettings] = useState(initialSettings);
  const [originalSettings, setOriginalSettings] = useState(initialSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [previewLogo, setPreviewLogo] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const { businessId } = useBusinessConfig();
  const [isEditingLogo, setIsEditingLogo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchBusinessConfig = async () => {
    try {
      const response = await api.get(`/business-config?businessId=${businessId}`);
      if (response.data) {
        const data = {
          ...initialSettings,
          ...response.data,
          description: response.data.description || 'Deliciosa comida casera con ingredientes frescos y servicio de calidad.',
          coverImage: response.data.coverImage || '',
          isOpen: response.data.isOpen !== undefined ? response.data.isOpen : true,
          whatsappNumber: response.data.whatsappNumber || '',
          address: response.data.address || '',
          googleMapsUrl: response.data.googleMapsUrl || '',
          socialMedia: {
            ...initialSettings.socialMedia,
            ...(response.data.socialMedia || {})
          },
          extraLink: {
            ...initialSettings.extraLink,
            ...(response.data.extraLink || {})
          }
        };
        console.log('Datos cargados:', data);
        if (!isEditingLogo) {
          setSettings(data);
          setOriginalSettings(data);
        }
        if (!isEditingLogo) setPreviewLogo(response.data?.logo || '');
      }
    } catch (error) {
      console.error('Error al cargar la configuración:', error);
      setError('Error al cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinessConfig();
    if (socket) {
      socket.connect();
      socket.emit('joinBusiness', businessId);

      // Debounce para evitar bucles si el backend emite muchos eventos
      let debounceTimeout = null;
      const handler = (data) => {
        if (debounceTimeout) clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
          if (!isEditingLogo) setSettings(prev => ({ ...prev, ...data }));
          if (!isEditingLogo) setPreviewLogo(data.logo || '');
        }, 300);
      };

      socket.on('business_config_update', handler);

      return () => {
        socket.emit('leaveBusiness', businessId);
        socket.off('business_config_update', handler);
        socket.disconnect();
        if (debounceTimeout) clearTimeout(debounceTimeout);
      };
    }
  }, [businessId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (name === 'logo') {
      setPreviewLogo(value);
    }
  };

  // Detectar si hay cambios pendientes
  const hasChanges = () => {
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  };

  // Calcular progreso del contador de descripción
  const getDescriptionProgress = () => {
    const length = settings.description.length;
    const percentage = (length / 300) * 100;
    if (percentage < 50) return { color: 'bg-green-500', textColor: 'text-green-600' };
    if (percentage < 80) return { color: 'bg-yellow-500', textColor: 'text-yellow-600' };
    return { color: 'bg-red-500', textColor: 'text-red-600' };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const dataToSend = {
        businessId,
        businessName: settings.businessName || "Mi Restaurante",
        description: settings.description || "Deliciosa comida casera con ingredientes frescos y servicio de calidad.",
        logo: settings.logo || "",
        coverImage: settings.coverImage || "",
        isOpen: settings.isOpen !== undefined ? settings.isOpen : true,
        whatsappNumber: settings.whatsappNumber || "",
        address: settings.address || "",
        googleMapsUrl: settings.googleMapsUrl || "",
        socialMedia: {
          facebook: {
            url: settings.socialMedia?.facebook?.url || "",
            isVisible: settings.socialMedia?.facebook?.isVisible || false
          },
          instagram: {
            url: settings.socialMedia?.instagram?.url || "",
            isVisible: settings.socialMedia?.instagram?.isVisible || false
          },
          tiktok: {
            url: settings.socialMedia?.tiktok?.url || "",
            isVisible: settings.socialMedia?.tiktok?.isVisible || false
          }
        },
        extraLink: {
          url: settings.extraLink?.url || "",
          isVisible: settings.extraLink?.isVisible || false
        }
      };
      console.log('Datos a enviar:', dataToSend);
      
      const response = await api.put('/business-config', dataToSend);
      console.log('Respuesta del servidor:', response.data);
      console.log('WhatsApp number recibido:', response.data.whatsappNumber);
      console.log('Dirección recibida:', response.data.address);
      console.log('URL de Google Maps recibida:', response.data.googleMapsUrl);
      
      // Actualizar el estado con los datos recibidos
      const updatedData = {
        ...settings,
        ...response.data,
        // Asegurarse de que los nuevos campos estén presentes incluso si no vienen en la respuesta
        address: response.data.address || settings.address || "",
        googleMapsUrl: response.data.googleMapsUrl || settings.googleMapsUrl || ""
      };
      setSettings(updatedData);
      setOriginalSettings(updatedData);
      
      setSuccessMessage('✅ Configuración guardada exitosamente');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error al actualizar la configuración:', error);
      setError('❌ Error al actualizar la configuración');
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSocialMediaChange = (platform, field, value) => {
    setSettings(prev => ({
      ...prev,
      socialMedia: {
        ...prev.socialMedia,
        [platform]: {
          ...prev.socialMedia[platform],
          [field]: value
        }
      }
    }));
  };

  // Actualizar directamente el estado del negocio
  const handleStoreStatusToggle = async () => {
    setStatusLoading(true);
    setError(null);
    
    try {
      // Si el documento actual no tiene isOpen (undefined), arreglar el esquema primero
      if (settings.isOpen === undefined) {
        console.log("El campo isOpen no existe, arreglando esquema...");
        await api.post('/business-config/fix-schema');
        await fetchBusinessConfig(); // Recargar con el esquema actualizado
        setSuccessMessage("Esquema actualizado. Intente cambiar el estado nuevamente.");
        setTimeout(() => setSuccessMessage(''), 3000);
        return;
      }
      
      const newStatus = !settings.isOpen;
      
      // Guardar directamente todo el objeto con el nuevo estado
      const dataToSend = {
        ...settings,
        isOpen: newStatus,
        businessId
      };
      
      console.log('Datos a enviar para cambiar estado:', dataToSend);
      
      const response = await api.put('/business-config', dataToSend);
      console.log('Respuesta del servidor:', response.data);
      
      // Verificar que el estado se guardó correctamente
      if (response.data.isOpen === newStatus) {
        setSettings(prev => ({
          ...prev,
          isOpen: newStatus
        }));
        
        setSuccessMessage(`Negocio ${newStatus ? 'abierto' : 'cerrado'} correctamente`);
      } else {
        setError("El estado no se actualizó correctamente. Por favor, intente nuevamente.");
      }
      
      setTimeout(() => {
        setSuccessMessage('');
        setError(null);
      }, 3000);
    } catch (error) {
      console.error('Error al actualizar el estado del negocio:', error);
      setError('Error al actualizar el estado del negocio');
      setTimeout(() => setError(null), 3000);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleFixSchema = async () => {
    try {
      setLoading(true);
      await api.post('/business-config/fix-schema');
      // Recargar los datos
      const response = await api.get('/business-config');
      if (response.data) {
        // Actualizar el estado con los datos recibidos
        const data = {
          ...initialSettings,
          ...response.data,
          whatsappNumber: response.data.whatsappNumber || '',
        };
        setSettings(data);
        setSuccessMessage('Esquema reparado correctamente');
      }
    } catch (error) {
      console.error('Error al reparar el esquema:', error);
      setError('Error al reparar el esquema');
    } finally {
      setLoading(false);
      setTimeout(() => {
        setSuccessMessage('');
        setError(null);
      }, 3000);
    }
  };

  if (loading) {
    return <div className="text-center py-4">Cargando configuración...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="text-2xl">⚙️</span>
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Configuración del Negocio</h2>
      </motion.div>
      
      {/* Los mensajes ahora se muestran como toasts flotantes */}

      <motion.form 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onSubmit={handleSubmit} 
        className="space-y-8"
      >
        {/* Basic Information Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-xl p-8 border border-slate-200/50"
        >
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
              <span className="text-xl">🏢</span>
            </div>
            <h3 className="text-2xl font-bold text-slate-900">Información Básica</h3>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Business Name */}
              <div className="group">
                <label className="flex items-center text-sm font-semibold text-slate-700 mb-3">
                  <span className="mr-2">🏪</span>
                  Nombre del Negocio
                </label>
                <input
                  type="text"
                  name="businessName"
                  value={settings.businessName}
                  onChange={handleChange}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder-slate-400 px-6 py-4 text-lg transition-all duration-200 group-hover:border-slate-300"
                  placeholder="Ej: GO BURGER"
                />
              </div>

              {/* Description */}
              <div className="group">
                <label className="flex items-center text-sm font-semibold text-slate-700 mb-3">
                  <span className="mr-2">📝</span>
                  Descripción del Negocio
                </label>
                <textarea
                  name="description"
                  value={settings.description}
                  onChange={handleChange}
                  rows={3}
                  maxLength={300}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder-slate-400 px-6 py-4 text-base transition-all duration-200 group-hover:border-slate-300 resize-none"
                  placeholder="Ej: Deliciosa comida casera con ingredientes frescos y servicio de calidad. Especialistas en hamburguesas gourmet y comida rápida."
                />
                <div className="mt-3 space-y-2">
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <motion.div
                      className={`h-full ${getDescriptionProgress().color} transition-all duration-300`}
                      initial={{ width: 0 }}
                      animate={{ width: `${(settings.description.length / 300) * 100}%` }}
                    />
                  </div>
                  <div className={`text-sm font-semibold ${getDescriptionProgress().textColor} text-right`}>
                    {settings.description.length}/300 caracteres
                  </div>
                </div>
              </div>

              {/* Logo URL */}
              <div className="group">
                <label className="flex items-center text-sm font-semibold text-slate-700 mb-3">
                  <span className="mr-2">🖼️</span>
                  URL del Logo
                </label>
                <input
                  type="url"
                  name="logo"
                  value={settings.logo}
                  onChange={handleChange}
                  onFocus={() => setIsEditingLogo(true)}
                  onBlur={() => setIsEditingLogo(false)}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder-slate-400 px-6 py-4 transition-all duration-200 group-hover:border-slate-300"
                  placeholder="https://ejemplo.com/logo.png"
                />
              </div>

              {/* Cover Image URL */}
              <div className="group">
                <label className="flex items-center text-sm font-semibold text-slate-700 mb-3">
                  <span className="mr-2">🌄</span>
                  URL de la Imagen de Portada
                </label>
                <input
                  type="text"
                  name="coverImage"
                  value={settings.coverImage}
                  onChange={handleChange}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder-slate-400 px-6 py-4 transition-all duration-200 group-hover:border-slate-300"
                  placeholder="https://ejemplo.com/portada.jpg"
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* WhatsApp Number */}
              <div className="group">
                <label className="flex items-center text-sm font-semibold text-slate-700 mb-3">
                  <span className="mr-2">📱</span>
                  Número de WhatsApp
                </label>
                <input
                  type="text"
                  name="whatsappNumber"
                  value={settings.whatsappNumber}
                  onChange={handleChange}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm focus:ring-4 focus:ring-green-500/20 focus:border-green-500 text-slate-900 placeholder-slate-400 px-6 py-4 transition-all duration-200 group-hover:border-slate-300"
                  placeholder="Ej: +1234567890"
                />
              </div>

              {/* Address */}
              <div className="group">
                <label className="flex items-center text-sm font-semibold text-slate-700 mb-3">
                  <span className="mr-2">📍</span>
                  Dirección
                </label>
                <input
                  type="text"
                  name="address"
                  value={settings.address}
                  onChange={handleChange}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder-slate-400 px-6 py-4 transition-all duration-200 group-hover:border-slate-300"
                  placeholder="Ej: Calle Principal #123, Ciudad"
                />
              </div>

              {/* Google Maps URL */}
              <div className="group">
                <label className="flex items-center text-sm font-semibold text-slate-700 mb-3">
                  <span className="mr-2">🗺️</span>
                  URL de Google Maps
                </label>
                <input
                  type="text"
                  name="googleMapsUrl"
                  value={settings.googleMapsUrl}
                  onChange={handleChange}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder-slate-400 px-6 py-4 transition-all duration-200 group-hover:border-slate-300"
                  placeholder="https://maps.google.com/?q=..."
                />
                <p className="mt-2 text-sm text-slate-500 flex items-center">
                  <span className="mr-1">💡</span>
                  Ingresa el enlace de la ubicación del negocio en Google Maps
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Horarios y Estado del Negocio */}
        <BusinessHoursSettings />

        {/* Social Media Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-xl p-8 border border-slate-200/50"
        >
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
              <span className="text-xl">📱</span>
            </div>
            <h3 className="text-2xl font-bold text-slate-900">Redes Sociales</h3>
          </div>
          
          <div className="space-y-6">
            {/* Facebook */}
            <div className="group">
              <label className="flex items-center text-sm font-semibold text-slate-700 mb-3">
                <span className="mr-2">📘</span>
                Facebook
              </label>
              <div className="flex gap-4">
                <input
                  type="url"
                  value={settings.socialMedia.facebook.url}
                  onChange={(e) => handleSocialMediaChange('facebook', 'url', e.target.value)}
                  placeholder="https://facebook.com/tu-negocio"
                  className="flex-1 rounded-2xl border-2 border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder-slate-400 px-6 py-4 transition-all duration-200 group-hover:border-slate-300"
                />
              <button
                type="button"
                onClick={() => handleSocialMediaChange('facebook', 'isVisible', !settings.socialMedia.facebook.isVisible)}
                className={`px-4 py-2 rounded-md ${
                  settings.socialMedia.facebook.isVisible ? 'bg-green-500' : 'bg-gray-500'
                } text-white`}
              >
                {settings.socialMedia.facebook.isVisible ? 'Visible' : 'Oculto'}
              </button>
            </div>
          </div>

            {/* Instagram */}
            <div className="group">
              <label className="flex items-center text-sm font-semibold text-slate-700 mb-3">
                <span className="mr-2">📸</span>
                Instagram
              </label>
              <div className="flex gap-4">
                <input
                  type="url"
                  value={settings.socialMedia.instagram.url}
                  onChange={(e) => handleSocialMediaChange('instagram', 'url', e.target.value)}
                  placeholder="https://instagram.com/tu-negocio"
                  className="flex-1 rounded-2xl border-2 border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder-slate-400 px-6 py-4 transition-all duration-200 group-hover:border-slate-300"
                />
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSocialMediaChange('instagram', 'isVisible', !settings.socialMedia.instagram.isVisible)}
                  className={`px-6 py-4 rounded-2xl font-semibold transition-all duration-200 ${
                    settings.socialMedia.instagram.isVisible 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg' 
                      : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white shadow-lg'
                  }`}
                >
                  {settings.socialMedia.instagram.isVisible ? '👁️ Visible' : '🙈 Oculto'}
                </motion.button>
              </div>
            </div>

            {/* TikTok */}
            <div className="group">
              <label className="flex items-center text-sm font-semibold text-slate-700 mb-3">
                <span className="mr-2">🎵</span>
                TikTok
              </label>
              <div className="flex gap-4">
                <input
                  type="url"
                  value={settings.socialMedia.tiktok.url}
                  onChange={(e) => handleSocialMediaChange('tiktok', 'url', e.target.value)}
                  placeholder="https://tiktok.com/@tu-negocio"
                  className="flex-1 rounded-2xl border-2 border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder-slate-400 px-6 py-4 transition-all duration-200 group-hover:border-slate-300"
                />
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSocialMediaChange('tiktok', 'isVisible', !settings.socialMedia.tiktok.isVisible)}
                  className={`px-6 py-4 rounded-2xl font-semibold transition-all duration-200 ${
                    settings.socialMedia.tiktok.isVisible 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg' 
                      : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white shadow-lg'
                  }`}
                >
                  {settings.socialMedia.tiktok.isVisible ? '👁️ Visible' : '🙈 Oculto'}
                </motion.button>
              </div>
            </div>

            {/* Enlace Extra */}
            <div className="group">
              <label className="flex items-center text-sm font-semibold text-slate-700 mb-3">
                <span className="mr-2">🔗</span>
                Enlace Extra
              </label>
              <div className="flex gap-4">
                <input
                  type="url"
                  value={settings.extraLink.url}
                  onChange={(e) => setSettings({
                    ...settings,
                    extraLink: { ...settings.extraLink, url: e.target.value }
                  })}
                  placeholder="https://tu-sitio-web.com"
                  className="flex-1 rounded-2xl border-2 border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder-slate-400 px-6 py-4 transition-all duration-200 group-hover:border-slate-300"
                />
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSettings({
                    ...settings,
                    extraLink: { ...settings.extraLink, isVisible: !settings.extraLink.isVisible }
                  })}
                  className={`px-6 py-4 rounded-2xl font-semibold transition-all duration-200 ${
                    settings.extraLink.isVisible 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg' 
                      : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white shadow-lg'
                  }`}
                >
                  {settings.extraLink.isVisible ? '👁️ Visible' : '🙈 Oculto'}
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Botón Reparar Configuración */}
        <div className="flex justify-center pt-4">
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleFixSchema}
            className="px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-2xl hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 font-semibold flex items-center space-x-2 shadow-lg"
          >
            <span>🔧</span>
            <span>Reparar Configuración</span>
          </motion.button>
        </div>
      </motion.form>

      {/* Modern Logo Preview */}
      {previewLogo && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-xl p-8 border border-slate-200/50"
        >
          <div className="text-center">
            <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-xl">👁️</span>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-6">Vista Previa del Logo</h3>
            
            <div className="flex justify-center">
              <div className="w-32 h-32 rounded-2xl overflow-hidden border-4 border-gradient-to-r from-blue-500 to-purple-600 shadow-2xl bg-white p-2">
                <img
                  src={previewLogo}
                  alt="Vista previa del logo"
                  className="w-full h-full object-cover rounded-xl"
                  onError={(e) => {
                    e.target.src = 'https://placehold.co/150x150?text=🏪';
                  }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Botón Flotante Sticky - Solo visible cuando hay cambios */}
      <AnimatePresence>
        {hasChanges() && (
          <motion.div
            initial={{ y: 100, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 100, opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50"
          >
            <motion.button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className={`
                relative overflow-hidden
                px-10 py-5 rounded-full font-bold text-base shadow-2xl
                flex items-center space-x-3
                ${
                  isSaving
                    ? 'bg-gradient-to-r from-gray-400 to-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:shadow-[0_0_30px_rgba(168,85,247,0.6)]'
                }
                text-white transition-all duration-300
                border-2 border-white/20
              `}
            >
              {/* Efecto de brillo animado */}
              {!isSaving && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />
              )}
              
              <div className="relative flex items-center space-x-3">
                {isSaving ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="text-xl"
                    >
                      ⏳
                    </motion.div>
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <motion.span
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 0.6, repeat: Infinity }}
                      className="text-xl"
                    >
                      💾
                    </motion.span>
                    <span>Guardar Cambios</span>
                    <motion.div
                      animate={{ 
                        scale: [1, 1.5, 1],
                        opacity: [1, 0.5, 1]
                      }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="w-2 h-2 bg-red-400 rounded-full"
                    />
                  </>
                )}
              </div>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast de Confirmación Mejorado */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="fixed top-24 right-8 z-50 max-w-sm"
          >
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-3 backdrop-blur-lg">
              <motion.span
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.5 }}
                className="text-2xl"
              >
                ✅
              </motion.span>
              <div>
                <p className="font-bold text-lg">¡Éxito!</p>
                <p className="text-sm text-green-50">{successMessage}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast de Error Mejorado */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="fixed top-24 right-8 z-50 max-w-sm"
          >
            <div className="bg-gradient-to-r from-red-500 to-rose-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-3 backdrop-blur-lg">
              <motion.span
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: 2 }}
                className="text-2xl"
              >
                ❌
              </motion.span>
              <div>
                <p className="font-bold text-lg">Error</p>
                <p className="text-sm text-red-50">{error}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BusinessSettings; 