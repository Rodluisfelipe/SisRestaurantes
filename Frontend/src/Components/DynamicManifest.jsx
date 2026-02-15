import { useEffect } from 'react';
import { useBusinessConfig } from '../Context/BusinessContext';
import { useLocation } from 'react-router-dom';

const DynamicManifest = () => {
  const { businessConfig } = useBusinessConfig();
  const location = useLocation();

  useEffect(() => {
    if (businessConfig) {
      const origin = window.location.origin;
      const logoUrl = businessConfig.logo
        ? (businessConfig.logo.startsWith('http') ? businessConfig.logo : origin + businessConfig.logo)
        : origin + '/logo.jpeg';
      const logoType = businessConfig.logo ? 'image/png' : 'image/jpeg';
      const slug = businessConfig.slug || '';
      // Usar la ruta actual para que "Agregar a inicio" guarde la URL del menú específico
      const currentPath = location.pathname;
      const startUrl = origin + currentPath;

      const manifest = {
        name: businessConfig.businessName || 'MenuBy',
        short_name: businessConfig.businessName || 'MenuBy',
        description: businessConfig.description || `Menú digital de ${businessConfig.businessName || 'tu restaurante'}`,
        start_url: startUrl,
        display: 'standalone',
        background_color: businessConfig.primaryColor || '#051C2C',
        theme_color: businessConfig.accentColor || '#3A7AFF',
        orientation: 'portrait-primary',
        scope: origin + '/',
        lang: 'es',
        categories: ['business', 'food', 'productivity'],
        id: `${origin}/${slug}`,
        icons: [
          { src: logoUrl, sizes: '192x192', type: logoType, purpose: 'any' },
          { src: logoUrl, sizes: '512x512', type: logoType, purpose: 'any' },
          { src: logoUrl, sizes: '192x192', type: logoType, purpose: 'maskable' },
          { src: logoUrl, sizes: '180x180', type: logoType, purpose: 'any' },
          { src: logoUrl, sizes: '152x152', type: logoType, purpose: 'any' },
          { src: logoUrl, sizes: '120x120', type: logoType, purpose: 'any' }
        ],
        shortcuts: [
          {
            name: 'Panel Admin',
            short_name: 'Admin',
            description: 'Acceso directo al panel de administración',
            url: `${origin}/${slug}/admin`,
            icons: [{ src: logoUrl, sizes: '96x96', type: logoType }]
          },
          {
            name: 'Menú',
            short_name: 'Menú',
            description: 'Ver el menú del restaurante',
            url: `${origin}/${slug}`,
            icons: [{ src: logoUrl, sizes: '96x96', type: logoType }]
          }
        ]
      };

      // Create and update the manifest
      const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], {
        type: 'application/json'
      });
      const manifestURL = URL.createObjectURL(manifestBlob);

      // Remove existing manifest link and create a fresh one
      // (some browsers don't re-read the manifest if you just change href)
      const existingLink = document.querySelector('link[rel="manifest"]');
      if (existingLink) {
        // Revoke old blob URL to free memory
        if (existingLink.href.startsWith('blob:')) {
          URL.revokeObjectURL(existingLink.href);
        }
        existingLink.remove();
      }
      const newLink = document.createElement('link');
      newLink.rel = 'manifest';
      newLink.href = manifestURL;
      document.head.appendChild(newLink);

      // Update theme color meta tag
      let themeColorMeta = document.querySelector('meta[name="theme-color"]');
      if (themeColorMeta) {
        themeColorMeta.content = businessConfig.accentColor || '#3A7AFF';
      }

      // Update apple-mobile-web-app-title
      let appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (appleTitleMeta) {
        appleTitleMeta.content = businessConfig.businessName || 'MenuBy';
      }
    }
  }, [businessConfig, location.pathname]);

  return null; // This component doesn't render anything
};

export default DynamicManifest;
