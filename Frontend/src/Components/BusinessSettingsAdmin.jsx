import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';
import { socket } from '../services/socket';

const BusinessSettingsAdmin = () => {
  const [settings, setSettings] = useState({
    businessName: '',
    logo: '',
    coverImage: '',
    productUrl: { url: '', isVisible: true },
    address: '',
    googleMapsUrl: '',
    socialMedia: {
      facebook: { url: '', isVisible: true },
      instagram: { url: '', isVisible: true },
      tiktok: { url: '', isVisible: true }
    },
    extraLink: { url: '', isVisible: true }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewLogo, setPreviewLogo] = useState('');
  const [previewCover, setPreviewCover] = useState('');
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });
  const { businessId } = useBusinessConfig();

  // Logo por defecto
  const defaultLogo = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNlNWU3ZWIiLz48dGV4dCB4PSI1MCIgeT0iNTAiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiM5Y2EzYWYiPkxvZ288L3RleHQ+PC9zdmc+';

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/business-config?businessId=${businessId}`);
        if (response.data) {
          const data = response.data;
          setSettings(data);
          setPreviewLogo(data.logo || defaultLogo);
          setPreviewCover(data.coverImage);
        }
      } catch (error) {
        showNotification('error', 'Error al cargar la configuración');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
    // --- WebSocket: Conexión y listeners ---
    socket.connect();
    socket.emit('joinBusiness', businessId);
    socket.on('business_config_update', (data) => {
      setSettings(prev => ({ ...prev, ...data }));
      setPreviewLogo(data.logo || defaultLogo);
      setPreviewCover(data.coverImage);
    });
    return () => {
      socket.emit('leaveBusiness', businessId);
      socket.off('business_config_update');
      socket.disconnect();
    };
    // --- Fin WebSocket ---
  }, [businessId]);

  const showNotification = (type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => setNotification({ show: false, type: '', message: '' }), 3000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Asegurar que todos los campos estén incluidos en la petición
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
        },
        productUrl: {
          url: settings.productUrl?.url || "",
          isVisible: settings.productUrl?.isVisible || false
        }
      };

      console.log('Datos a enviar:', dataToSend);
      
      // Usar la ruta correcta para la API
      const response = await api.put('/business-config', dataToSend);
      console.log('Configuración actualizada:', response.data);
      console.log('Dirección guardada:', response.data.address);
      console.log('URL de Google Maps guardada:', response.data.googleMapsUrl);
      
      // Actualizar el estado con los datos recibidos
      setSettings(prevSettings => ({
        ...prevSettings,
        ...response.data,
        // Asegurarse de que los nuevos campos estén presentes incluso si no vienen en la respuesta
        address: response.data.address || prevSettings.address || "",
        googleMapsUrl: response.data.googleMapsUrl || prevSettings.googleMapsUrl || ""
      }));
      
      showNotification('success', '¡Configuración actualizada correctamente!');
    } catch (error) {
      console.error('Error al actualizar la configuración:', error);
      showNotification('error', 'Error al actualizar la configuración');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Notificación */}
      {notification.show && (
        <div className={`fixed top-4 right-4 z-50 rounded-lg shadow-lg px-6 py-4 transition-all transform ${
          notification.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
          'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <div className="flex items-center">
            {notification.type === 'success' ? (
              <svg className="h-5 w-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
            ) : (
              <svg className="h-5 w-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
              </svg>
            )}
            {notification.message}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="px-6 py-8 bg-gradient-to-r from-blue-600 to-blue-800 sm:px-10">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <svg className="h-8 w-8 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            Configuración del Negocio
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-8 sm:px-10 space-y-8">
          {/* Información Básica */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
          <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Negocio
                </label>
            <input
              type="text"
              value={settings.businessName}
              onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
              required
            />
          </div>

          <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL del Producto
                  <span className="ml-1 text-xs text-gray-500">(Opcional)</span>
                </label>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
        </div>
                <input
                  type="url"
                      value={settings.productUrl?.url || ''}
                      onChange={(e) => setSettings({ ...settings, productUrl: { ...settings.productUrl, url: e.target.value } })}
                      className="w-full pl-10 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                      placeholder="https://ejemplo.com/producto"
                />
              </div>
              <button
                type="button"
              onClick={() => setSettings({
                ...settings,
                      productUrl: { ...settings.productUrl, isVisible: !settings.productUrl?.isVisible }
                    })}
                    className={`px-4 py-2 rounded-lg transition-colors duration-200 whitespace-nowrap ${
                      settings.productUrl?.isVisible 
                        ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    {settings.productUrl?.isVisible ? 'Visible' : 'Oculto'}
              </button>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Ingresa la URL donde se puede encontrar más información sobre el producto
                </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dirección del Negocio
            </label>
            <input
              type="text"
              value={settings.address || ''}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
              placeholder="Ej: Calle Principal #123, Ciudad"
            />
            <p className="mt-1 text-sm text-gray-500">
              Ingresa la dirección física de tu negocio
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL de Google Maps
            </label>
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
              </div>
              <input
                type="url"
                value={settings.googleMapsUrl || ''}
                onChange={(e) => setSettings({ ...settings, googleMapsUrl: e.target.value })}
                className="w-full pl-10 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                placeholder="https://maps.google.com/?q=..."
              />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Ingresa el enlace de Google Maps a la ubicación de tu negocio
            </p>
          </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Logo del Negocio
                </label>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <input
                type="url"
                      value={settings.logo}
                      onChange={(e) => {
                  const newLogo = e.target.value.trim();
                  setSettings(prev => ({ ...prev, logo: newLogo }));
                  setPreviewLogo(newLogo || defaultLogo);
                      }}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                      placeholder="URL del logo"
                    />
                  </div>
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gray-200 flex items-center justify-center bg-gray-50">
                      <img
                        src={previewLogo}
                        alt="Preview"
                        className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.src = defaultLogo;
                  setPreviewLogo(defaultLogo);
                }}
              />
            </div>
                </div>
          <p className="mt-1 text-sm text-gray-500">
            Ingresa la URL de una imagen para usar como logo. Recomendamos usar una imagen cuadrada.
          </p>
        </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Imagen de Portada
                </label>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
                    <input
                      type="url"
                      value={settings.coverImage}
                      onChange={(e) => {
                        setSettings({ ...settings, coverImage: e.target.value });
                        setPreviewCover(e.target.value);
                      }}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                      placeholder="URL de la imagen de portada"
                    />
                  </div>
                  {previewCover && (
                    <div className="w-20 h-12 rounded-lg overflow-hidden border-2 border-gray-200">
                      <img
                        src={previewCover}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => e.target.src = 'https://via.placeholder.com/300x100?text=Cover'}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Redes Sociales */}
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <svg className="h-5 w-5 mr-2 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
                </svg>
                Redes Sociales
              </h3>

              {Object.entries(settings.socialMedia).map(([platform, data]) => (
                <div key={platform} className="flex items-center space-x-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
                      {platform}
                    </label>
                    <div className="flex space-x-2">
                <input
                type="url"
                        value={data.url}
                onChange={(e) => setSettings({
                  ...settings,
                  socialMedia: {
                    ...settings.socialMedia,
                            [platform]: { ...data, url: e.target.value }
                  }
                })}
                        className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                        placeholder={`URL de ${platform}`}
                />
            <button
              type="button"
              onClick={() => setSettings({
                ...settings,
                socialMedia: {
                  ...settings.socialMedia,
                            [platform]: { ...data, isVisible: !data.isVisible }
                          }
                        })}
                        className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
                          data.isVisible 
                            ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {data.isVisible ? 'Visible' : 'Oculto'}
            </button>
          </div>
                  </div>
                </div>
              ))}

              {/* Enlace Extra */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enlace Extra
                </label>
                <div className="flex space-x-2">
                <input
                  type="url"
                value={settings.extraLink.url}
                onChange={(e) => setSettings({
                  ...settings,
                  extraLink: { ...settings.extraLink, url: e.target.value }
                })}
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                    placeholder="URL del enlace extra"
                />
              <button
                type="button"
              onClick={() => setSettings({
                ...settings,
                extraLink: { ...settings.extraLink, isVisible: !settings.extraLink.isVisible }
              })}
                    className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
                      settings.extraLink.isVisible 
                        ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
              >
              {settings.extraLink.isVisible ? 'Visible' : 'Oculto'}
              </button>
                </div>
              </div>
            </div>
        </div>

          {/* Botón de Guardar */}
          <div className="pt-6">
        <button
          type="submit"
              disabled={saving}
              className={`w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200 flex items-center justify-center ${
                saving ? 'opacity-75 cursor-not-allowed' : ''
              }`}
            >
              {saving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Guardando...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  Guardar Cambios
                </>
              )}
        </button>
          </div>
      </form>
      </div>
    </div>
  );
};

export default BusinessSettingsAdmin; 