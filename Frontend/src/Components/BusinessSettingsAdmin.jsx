import React, { useEffect, useState } from 'react';
import api from '../services/api';

const BusinessSettingsAdmin = () => {
  const [settings, setSettings] = useState({
    businessName: '',
    logo: '',
    socialMedia: {
      facebook: { url: '', isVisible: true },
      instagram: { url: '', isVisible: true },
      tiktok: { url: '', isVisible: true }
    },
    extraLink: { url: '', isVisible: true }
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get('/business-settings');
        if (response.data) {
          setSettings(response.data);
        }
      } catch (error) {
        console.error('Error fetching business settings:', error);
      }
    };

    fetchSettings();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.put('/business-settings', settings);
      alert('Settings updated successfully!');
    } catch (error) {
      console.error('Error updating settings:', error);
      alert('Error updating settings');
    }
  };

  const handleSocialMediaChange = (index, field, value) => {
    const newSocialMedia = [...settings.socialMedia];
    newSocialMedia[index] = { ...newSocialMedia[index], [field]: value };
    setSettings({ ...settings, socialMedia: newSocialMedia });
  };

  const handleInterestButtonChange = (index, field, value) => {
    const newButtons = [...settings.interestButtons];
    newButtons[index] = { ...newButtons[index], [field]: value };
    setSettings({ ...settings, interestButtons: newButtons });
  };

  const toggleSocialMediaVisibility = async (platform) => {
    try {
      await api.patch(`/business-settings/social-media/${platform}/visibility`);
      const newSocialMedia = settings.socialMedia.map(sm =>
        sm.platform === platform ? { ...sm, isVisible: !sm.isVisible } : sm
      );
      setSettings({ ...settings, socialMedia: newSocialMedia });
    } catch (error) {
      console.error('Error toggling visibility:', error);
    }
  };

  const toggleInterestButtonVisibility = async (index) => {
    try {
      await api.patch(`/business-settings/interest-buttons/${index}/visibility`);
      const newButtons = [...settings.interestButtons];
      newButtons[index] = { ...newButtons[index], isVisible: !newButtons[index].isVisible };
      setSettings({ ...settings, interestButtons: newButtons });
    } catch (error) {
      console.error('Error toggling visibility:', error);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Configuración del Negocio</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Business Name and Logo */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre del Negocio</label>
            <input
              type="text"
              value={settings.businessName}
              onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">URL del Logo</label>
            <input
              type="url"
              value={settings.logo}
              onChange={(e) => setSettings({ ...settings, logo: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Social Media */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Redes Sociales</h3>
          
          {/* Facebook */}
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700">Facebook URL</label>
              <input
                type="url"
                value={settings.socialMedia.facebook.url}
                onChange={(e) => setSettings({
                  ...settings,
                  socialMedia: {
                    ...settings.socialMedia,
                    facebook: { ...settings.socialMedia.facebook, url: e.target.value }
                  }
                })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={() => setSettings({
                ...settings,
                socialMedia: {
                  ...settings.socialMedia,
                  facebook: { ...settings.socialMedia.facebook, isVisible: !settings.socialMedia.facebook.isVisible }
                }
              })}
              className={`px-3 py-2 rounded ${
                settings.socialMedia.facebook.isVisible ? 'bg-green-500' : 'bg-gray-500'
              } text-white`}
            >
              {settings.socialMedia.facebook.isVisible ? 'Visible' : 'Oculto'}
            </button>
          </div>

          {/* Instagram */}
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700">Instagram URL</label>
              <input
                type="url"
                value={settings.socialMedia.instagram.url}
                onChange={(e) => setSettings({
                  ...settings,
                  socialMedia: {
                    ...settings.socialMedia,
                    instagram: { ...settings.socialMedia.instagram, url: e.target.value }
                  }
                })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={() => setSettings({
                ...settings,
                socialMedia: {
                  ...settings.socialMedia,
                  instagram: { ...settings.socialMedia.instagram, isVisible: !settings.socialMedia.instagram.isVisible }
                }
              })}
              className={`px-3 py-2 rounded ${
                settings.socialMedia.instagram.isVisible ? 'bg-green-500' : 'bg-gray-500'
              } text-white`}
            >
              {settings.socialMedia.instagram.isVisible ? 'Visible' : 'Oculto'}
            </button>
          </div>

          {/* TikTok */}
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700">TikTok URL</label>
              <input
                type="url"
                value={settings.socialMedia.tiktok.url}
                onChange={(e) => setSettings({
                  ...settings,
                  socialMedia: {
                    ...settings.socialMedia,
                    tiktok: { ...settings.socialMedia.tiktok, url: e.target.value }
                  }
                })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={() => setSettings({
                ...settings,
                socialMedia: {
                  ...settings.socialMedia,
                  tiktok: { ...settings.socialMedia.tiktok, isVisible: !settings.socialMedia.tiktok.isVisible }
                }
              })}
              className={`px-3 py-2 rounded ${
                settings.socialMedia.tiktok.isVisible ? 'bg-green-500' : 'bg-gray-500'
              } text-white`}
            >
              {settings.socialMedia.tiktok.isVisible ? 'Visible' : 'Oculto'}
            </button>
          </div>

          {/* Extra Link */}
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700">Enlace Extra URL</label>
              <input
                type="url"
                value={settings.extraLink.url}
                onChange={(e) => setSettings({
                  ...settings,
                  extraLink: { ...settings.extraLink, url: e.target.value }
                })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={() => setSettings({
                ...settings,
                extraLink: { ...settings.extraLink, isVisible: !settings.extraLink.isVisible }
              })}
              className={`px-3 py-2 rounded ${
                settings.extraLink.isVisible ? 'bg-green-500' : 'bg-gray-500'
              } text-white`}
            >
              {settings.extraLink.isVisible ? 'Visible' : 'Oculto'}
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Guardar Configuración
        </button>
      </form>
    </div>
  );
};

export default BusinessSettingsAdmin; 