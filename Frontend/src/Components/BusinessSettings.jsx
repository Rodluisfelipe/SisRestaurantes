import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';
import { socket } from '../services/api';

const BusinessSettings = () => {
  const initialSettings = {
    businessName: '',
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [previewLogo, setPreviewLogo] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const { businessId } = useBusinessConfig();
  const [isEditingLogo, setIsEditingLogo] = useState(false);

  const fetchBusinessConfig = async () => {
    try {
      const response = await api.get(`/business-config?businessId=${businessId}`);
      if (response.data) {
        const data = {
          ...initialSettings,
          ...response.data,
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
        if (!isEditingLogo) setSettings(data);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = {
        businessId,
        businessName: settings.businessName || "Mi Restaurante",
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
      setSettings(prevSettings => ({
        ...prevSettings,
        ...response.data,
        // Asegurarse de que los nuevos campos estén presentes incluso si no vienen en la respuesta
        address: response.data.address || prevSettings.address || "",
        googleMapsUrl: response.data.googleMapsUrl || prevSettings.googleMapsUrl || ""
      }));
      
      setSuccessMessage(`Configuración actualizada correctamente. WhatsApp: ${response.data.whatsappNumber || 'no configurado'}`);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error('Error al actualizar la configuración:', error);
      setError('Error al actualizar la configuración');
      setTimeout(() => setError(null), 3000);
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
    <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Configuración del Negocio</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Información básica del negocio */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">Información básica</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Nombre del negocio</label>
              <input
                type="text"
                name="businessName"
                value={settings.businessName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">URL del Logo</label>
              <input
                type="url"
                name="logo"
                value={settings.logo}
                onChange={handleChange}
                onFocus={() => setIsEditingLogo(true)}
                onBlur={() => setIsEditingLogo(false)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="URL de la imagen del logo"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">URL de la Imagen de Portada</label>
              <input
                type="text"
                name="coverImage"
                value={settings.coverImage}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="URL de la imagen de portada"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Número de WhatsApp</label>
              <input
                type="text"
                name="whatsappNumber"
                value={settings.whatsappNumber}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Ej: +1234567890"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Dirección</label>
              <input
                type="text"
                name="address"
                value={settings.address}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Ej: Calle Principal #123, Ciudad"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">URL de Google Maps</label>
              <input
                type="text"
                name="googleMapsUrl"
                value={settings.googleMapsUrl}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Ej: https://maps.google.com/?q=..."
              />
              <p className="text-xs text-gray-500 mt-1">Ingresa el enlace de la ubicación del negocio en Google Maps</p>
            </div>
          </div>
        </div>

        {/* Estado del negocio */}
        <div className="p-4 border rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Estado del Negocio:</span>
            <div className="flex items-center space-x-2">
              <span className={`text-sm font-medium ${settings.isOpen ? 'text-green-600' : 'text-red-600'}`}>
                {settings.isOpen ? 'Abierto' : 'Cerrado'}
              </span>
              <button
                type="button"  // Importante: type="button" para que no envíe el formulario
                onClick={handleStoreStatusToggle}
                disabled={statusLoading}
                className={`px-4 py-2 rounded-md text-white font-medium ${
                  statusLoading 
                    ? 'bg-gray-400' 
                    : settings.isOpen 
                      ? 'bg-red-500 hover:bg-red-600' 
                      : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                {statusLoading 
                  ? 'Actualizando...' 
                  : settings.isOpen 
                    ? 'Cerrar Negocio' 
                    : 'Abrir Negocio'
                }
              </button>
            </div>
          </div>
        </div>

        {/* Redes Sociales */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Redes Sociales</h3>
          
          {/* Facebook */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Facebook</label>
            <div className="flex gap-4">
              <input
                type="url"
                value={settings.socialMedia.facebook.url}
                onChange={(e) => handleSocialMediaChange('facebook', 'url', e.target.value)}
                placeholder="URL de Facebook"
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Instagram</label>
            <div className="flex gap-4">
              <input
                type="url"
                value={settings.socialMedia.instagram.url}
                onChange={(e) => handleSocialMediaChange('instagram', 'url', e.target.value)}
                placeholder="URL de Instagram"
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => handleSocialMediaChange('instagram', 'isVisible', !settings.socialMedia.instagram.isVisible)}
                className={`px-4 py-2 rounded-md ${
                  settings.socialMedia.instagram.isVisible ? 'bg-green-500' : 'bg-gray-500'
                } text-white`}
              >
                {settings.socialMedia.instagram.isVisible ? 'Visible' : 'Oculto'}
              </button>
            </div>
          </div>

          {/* TikTok */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">TikTok</label>
            <div className="flex gap-4">
              <input
                type="url"
                value={settings.socialMedia.tiktok.url}
                onChange={(e) => handleSocialMediaChange('tiktok', 'url', e.target.value)}
                placeholder="URL de TikTok"
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => handleSocialMediaChange('tiktok', 'isVisible', !settings.socialMedia.tiktok.isVisible)}
                className={`px-4 py-2 rounded-md ${
                  settings.socialMedia.tiktok.isVisible ? 'bg-green-500' : 'bg-gray-500'
                } text-white`}
              >
                {settings.socialMedia.tiktok.isVisible ? 'Visible' : 'Oculto'}
              </button>
            </div>
          </div>

          {/* Enlace Extra */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Enlace Extra</label>
            <div className="flex gap-4">
              <input
                type="url"
                value={settings.extraLink.url}
                onChange={(e) => setSettings({
                  ...settings,
                  extraLink: { ...settings.extraLink, url: e.target.value }
                })}
                placeholder="URL del enlace extra"
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setSettings({
                  ...settings,
                  extraLink: { ...settings.extraLink, isVisible: !settings.extraLink.isVisible }
                })}
                className={`px-4 py-2 rounded-md ${
                  settings.extraLink.isVisible ? 'bg-green-500' : 'bg-gray-500'
                } text-white`}
              >
                {settings.extraLink.isVisible ? 'Visible' : 'Oculto'}
              </button>
            </div>
          </div>
        </div>

        <div className="pt-4 flex gap-3">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Guardar Cambios
          </button>
          
          <button
            type="button"
            onClick={handleFixSchema}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Reparar Configuración
          </button>
        </div>
      </form>

      {/* Preview del logo */}
      {previewLogo && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Vista previa del logo
          </label>
          <div className="flex justify-center">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-blue-500 shadow-lg">
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
    </div>
  );
};

export default BusinessSettings; 