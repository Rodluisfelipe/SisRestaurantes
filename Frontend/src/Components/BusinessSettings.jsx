import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';
import { socket } from '../services/socket';
import BusinessHoursSettings from './BusinessHoursSettings';
import ImageUploader from './Admin/ImageUploader';
import { 
  FaCog, FaStore, FaImage, FaWhatsapp, FaMapMarkerAlt, FaMap,
  FaInfoCircle, FaShareAlt, FaFacebook, FaInstagram, FaMusic, FaLink,
  FaEye, FaEyeSlash, FaWrench, FaSave, FaSyncAlt, FaCheckCircle,
  FaExclamationCircle, FaFileAlt, FaBell
} from 'react-icons/fa';

const BusinessSettings = () => {
  const initialSettings = {
    businessName: '',
    description: '',
    logo: '',
    coverImage: '',
    isOpen: true,
    whatsappNumber: '',
    address: '',
    nit: '',
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
          nit: response.data.nit || '',
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
        nit: settings.nit || "",
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
      
      setSuccessMessage('Configuración guardada exitosamente');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error al actualizar la configuración:', error);
      setError('Error al actualizar la configuración');
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
    return (
      <div className="flex items-center justify-center h-40 text-sm text-slate-400">
        <FaSyncAlt className="animate-spin mr-2 text-xs" /> Cargando configuración...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Información Básica */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center">
              <FaStore className="text-[10px] text-slate-500" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Información Básica</h3>
          </div>
          
          <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left Column */}
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Nombre del Negocio
                </label>
                <input
                  type="text"
                  name="businessName"
                  value={settings.businessName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
                  placeholder="Ej: GO BURGER"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Descripción del Negocio
                </label>
                <textarea
                  name="description"
                  value={settings.description}
                  onChange={handleChange}
                  rows={3}
                  maxLength={300}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 focus:border-slate-300 resize-none"
                  placeholder="Descripción de tu negocio..."
                />
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${getDescriptionProgress().color}`}
                      style={{ width: `${(settings.description.length / 300) * 100}%` }}
                    />
                  </div>
                  <span className={`text-[10px] font-medium ${getDescriptionProgress().textColor}`}>
                    {settings.description.length}/300
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Logo del Negocio
                </label>
                <ImageUploader
                  value={settings.logo}
                  onChange={(url) => {
                    setSettings(prev => ({ ...prev, logo: url }));
                    setPreviewLogo(url || '');
                  }}
                  folder="logos"
                  maxWidth={400}
                  quality={85}
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Imagen de Portada
                </label>
                <ImageUploader
                  value={settings.coverImage}
                  onChange={(url) => {
                    setSettings(prev => ({ ...prev, coverImage: url }));
                  }}
                  folder="covers"
                  maxWidth={1200}
                  quality={80}
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Número de WhatsApp
                </label>
                <input
                  type="text"
                  name="whatsappNumber"
                  value={settings.whatsappNumber}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
                  placeholder="Ej: +1234567890"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Dirección
                </label>
                <input
                  type="text"
                  name="address"
                  value={settings.address}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
                  placeholder="Ej: Calle Principal #123, Ciudad"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  NIT
                </label>
                <input
                  type="text"
                  name="nit"
                  value={settings.nit}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
                  placeholder="Ej: 900.123.456-7"
                />
                <p className="mt-1 text-[10px] text-slate-400 flex items-center gap-1">
                  <FaInfoCircle className="text-[8px]" />
                  Se mostrará en las comandas impresas
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  URL de Google Maps
                </label>
                <input
                  type="text"
                  name="googleMapsUrl"
                  value={settings.googleMapsUrl}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
                  placeholder="https://maps.google.com/?q=..."
                />
                <p className="mt-1 text-[10px] text-slate-400 flex items-center gap-1">
                  <FaInfoCircle className="text-[8px]" />
                  Enlace de ubicación en Google Maps
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Horarios y Estado del Negocio */}
        <BusinessHoursSettings />

        {/* Redes Sociales */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center">
              <FaShareAlt className="text-[10px] text-slate-500" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Redes Sociales</h3>
          </div>
          
          <div className="p-4 space-y-3">
            {/* Facebook */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Facebook
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={settings.socialMedia.facebook.url}
                  onChange={(e) => handleSocialMediaChange('facebook', 'url', e.target.value)}
                  placeholder="https://facebook.com/tu-negocio"
                  className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
                />
                <button
                  type="button"
                  onClick={() => handleSocialMediaChange('facebook', 'isVisible', !settings.socialMedia.facebook.isVisible)}
                  className={`px-3 py-2 rounded-lg text-[10px] font-medium flex items-center gap-1 transition-colors ${
                    settings.socialMedia.facebook.isVisible 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-slate-50 text-slate-500 border border-slate-200'
                  }`}
                >
                  {settings.socialMedia.facebook.isVisible ? <><FaEye className="text-[9px]" /> Visible</> : <><FaEyeSlash className="text-[9px]" /> Oculto</>}
                </button>
              </div>
            </div>

            {/* Instagram */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Instagram
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={settings.socialMedia.instagram.url}
                  onChange={(e) => handleSocialMediaChange('instagram', 'url', e.target.value)}
                  placeholder="https://instagram.com/tu-negocio"
                  className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
                />
                <button
                  type="button"
                  onClick={() => handleSocialMediaChange('instagram', 'isVisible', !settings.socialMedia.instagram.isVisible)}
                  className={`px-3 py-2 rounded-lg text-[10px] font-medium flex items-center gap-1 transition-colors ${
                    settings.socialMedia.instagram.isVisible 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-slate-50 text-slate-500 border border-slate-200'
                  }`}
                >
                  {settings.socialMedia.instagram.isVisible ? <><FaEye className="text-[9px]" /> Visible</> : <><FaEyeSlash className="text-[9px]" /> Oculto</>}
                </button>
              </div>
            </div>

            {/* TikTok */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                TikTok
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={settings.socialMedia.tiktok.url}
                  onChange={(e) => handleSocialMediaChange('tiktok', 'url', e.target.value)}
                  placeholder="https://tiktok.com/@tu-negocio"
                  className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
                />
                <button
                  type="button"
                  onClick={() => handleSocialMediaChange('tiktok', 'isVisible', !settings.socialMedia.tiktok.isVisible)}
                  className={`px-3 py-2 rounded-lg text-[10px] font-medium flex items-center gap-1 transition-colors ${
                    settings.socialMedia.tiktok.isVisible 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-slate-50 text-slate-500 border border-slate-200'
                  }`}
                >
                  {settings.socialMedia.tiktok.isVisible ? <><FaEye className="text-[9px]" /> Visible</> : <><FaEyeSlash className="text-[9px]" /> Oculto</>}
                </button>
              </div>
            </div>

            {/* Enlace Extra */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Enlace Extra
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={settings.extraLink.url}
                  onChange={(e) => setSettings({
                    ...settings,
                    extraLink: { ...settings.extraLink, url: e.target.value }
                  })}
                  placeholder="https://tu-sitio-web.com"
                  className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
                />
                <button
                  type="button"
                  onClick={() => setSettings({
                    ...settings,
                    extraLink: { ...settings.extraLink, isVisible: !settings.extraLink.isVisible }
                  })}
                  className={`px-3 py-2 rounded-lg text-[10px] font-medium flex items-center gap-1 transition-colors ${
                    settings.extraLink.isVisible 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-slate-50 text-slate-500 border border-slate-200'
                  }`}
                >
                  {settings.extraLink.isVisible ? <><FaEye className="text-[9px]" /> Visible</> : <><FaEyeSlash className="text-[9px]" /> Oculto</>}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Reparar Configuración */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleFixSchema}
            className="px-4 py-2 text-xs font-medium text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5"
          >
            <FaWrench className="text-[10px]" />
            Reparar Configuración
          </button>
        </div>
      </form>

      {/* Vista Previa del Logo */}
      {previewLogo && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center">
              <FaImage className="text-[10px] text-slate-500" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Vista Previa del Logo</h3>
          </div>
          <div className="p-4 flex justify-center">
            <div className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 bg-white">
              <img
                src={previewLogo}
                alt="Vista previa del logo"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.src = 'https://placehold.co/150x150?text=Logo';
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Botón Flotante Guardar */}
      <AnimatePresence>
        {hasChanges() && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50"
          >
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className={`px-6 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
                isSaving
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-800 hover:bg-slate-900 text-white'
              }`}
            >
              {isSaving ? (
                <><FaSyncAlt className="animate-spin text-[10px]" /> Guardando...</>
              ) : (
                <><FaSave className="text-[10px]" /> Guardar Cambios</>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast de Confirmación */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="fixed top-20 right-4 z-50"
          >
            <div className="bg-white border border-emerald-200 px-4 py-3 rounded-xl flex items-center gap-2">
              <FaCheckCircle className="text-xs text-emerald-500 flex-shrink-0" />
              <p className="text-xs font-medium text-slate-700">{successMessage}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast de Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="fixed top-20 right-4 z-50"
          >
            <div className="bg-white border border-red-200 px-4 py-3 rounded-xl flex items-center gap-2">
              <FaExclamationCircle className="text-xs text-red-500 flex-shrink-0" />
              <p className="text-xs font-medium text-slate-700">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BusinessSettings;