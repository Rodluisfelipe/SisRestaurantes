import { useEffect } from 'react';
import { useBusinessConfig } from '../Context/BusinessContext';

const DynamicManifest = () => {
  const { businessConfig } = useBusinessConfig();

  useEffect(() => {
    if (businessConfig) {
      const manifest = {
        name: `${businessConfig.businessName || 'MenuBy'} - Sistema de Gestión`,
        short_name: businessConfig.businessName || 'MenuBy',
        description: businessConfig.description || `Sistema de gestión para ${businessConfig.businessName || 'tu restaurante'}. Crea tu menú digital, gestiona pedidos y mejora la experiencia de tus clientes.`,
        start_url: `/${businessConfig.slug || ''}`,
        display: 'standalone',
        background_color: businessConfig.primaryColor || '#051C2C',
        theme_color: businessConfig.accentColor || '#3A7AFF',
        orientation: 'portrait-primary',
        scope: '/',
        lang: 'es',
        categories: ['business', 'food', 'productivity'],
        icons: [
          {
            src: businessConfig.logo || '/icon.svg',
            sizes: '192x192',
            type: businessConfig.logo ? 'image/png' : 'image/svg+xml',
            purpose: 'maskable any'
          },
          {
            src: businessConfig.logo || '/icon.svg',
            sizes: '512x512',
            type: businessConfig.logo ? 'image/png' : 'image/svg+xml',
            purpose: 'maskable any'
          },
          {
            src: businessConfig.logo || '/icon.svg',
            sizes: '180x180',
            type: businessConfig.logo ? 'image/png' : 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: businessConfig.logo || '/icon.svg',
            sizes: '167x167',
            type: businessConfig.logo ? 'image/png' : 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: businessConfig.logo || '/icon.svg',
            sizes: '152x152',
            type: businessConfig.logo ? 'image/png' : 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: businessConfig.logo || '/icon.svg',
            sizes: '120x120',
            type: businessConfig.logo ? 'image/png' : 'image/svg+xml',
            purpose: 'any'
          }
        ],
        shortcuts: [
          {
            name: 'Panel Admin',
            short_name: 'Admin',
            description: 'Acceso directo al panel de administración',
            url: '/admin',
            icons: [
              {
                src: businessConfig.logo || '/icon.svg',
                sizes: '96x96'
              }
            ]
          },
          {
            name: 'Menú',
            short_name: 'Menú',
            description: 'Ver el menú del restaurante',
            url: `/${businessConfig.slug || ''}`,
            icons: [
              {
                src: businessConfig.logo || '/icon.svg',
                sizes: '96x96'
              }
            ]
          }
        ]
      };

      // Create and update the manifest
      const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], {
        type: 'application/json'
      });
      const manifestURL = URL.createObjectURL(manifestBlob);

      // Update or create manifest link
      let manifestLink = document.querySelector('link[rel="manifest"]');
      if (manifestLink) {
        manifestLink.href = manifestURL;
      } else {
        manifestLink = document.createElement('link');
        manifestLink.rel = 'manifest';
        manifestLink.href = manifestURL;
        document.head.appendChild(manifestLink);
      }

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
  }, [businessConfig]);

  return null; // This component doesn't render anything
};

export default DynamicManifest;
