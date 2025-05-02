import React, { useState, useEffect } from 'react';
import api from '../services/api';

const BusinessSettings = () => {
  const initialSettings = {
    businessName: '',
    logo: '',
    coverImage: '',
    isOpen: true,
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

  useEffect(() => {
    const fetchBusinessConfig = async () => {
      try {
        const response = await api.get('/business-config');
        if (response.data) {
          // Asegurarse de que todos los campos necesarios existan
          const data = {
            ...initialSettings,
            ...response.data,
            coverImage: response.data.coverImage || '',
            isOpen: response.data.isOpen !== undefined ? response.data.isOpen : true,
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
          setSettings(data);
          setPreviewLogo(response.data?.logo || '');
        }
      } catch (error) {
        console.error('Error al cargar la configuración:', error);
        setError('Error al cargar la configuración');
      } finally {
        setLoading(false);
      }
    };

    fetchBusinessConfig();
  }, []);

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
      // Crear una copia profunda del estado actual
      const dataToSend = JSON.parse(JSON.stringify({
        businessName: settings.businessName,
        logo: settings.logo,
        coverImage: settings.coverImage,
        isOpen: settings.isOpen,
        socialMedia: settings.socialMedia,
        extraLink: settings.extraLink
      }));

      console.log('Datos a enviar:', dataToSend);
      
      const response = await api.put('/business-config', dataToSend);
      console.log('Respuesta del servidor:', response.data);
      
      // Actualizar el estado con los datos recibidos
      setSettings(prevSettings => ({
        ...prevSettings,
        ...response.data
      }));
      
      setSuccessMessage('Configuración actualizada correctamente');
      setTimeout(() => setSuccessMessage(''), 3000);
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
        isOpen: newStatus
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
        {/* Información básica */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nombre del Negocio
            </label>
            <input
              type="text"
              value={settings.businessName}
              onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              URL del Logo
            </label>
            <input
              type="url"
              value={settings.logo}
              onChange={(e) => setSettings({ ...settings, logo: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              URL de la Imagen de Portada
            </label>
            <input
              type="text"
              name="coverImage"
              value={settings.coverImage}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="URL de la imagen de portada"
            />
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

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Guardar Cambios
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
                  e.target.src = 'https://via.placeholder.com/150?text=Logo';
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