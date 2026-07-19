import { useEffect } from 'react';
import { useBusinessConfig } from '../Context/BusinessContext';
import { useLocation } from 'react-router-dom';

const DynamicManifest = () => {
  const { businessConfig } = useBusinessConfig();
  const location = useLocation();

  useEffect(() => {
    if (businessConfig) {
      const slug = businessConfig.slug || '';
      const name = encodeURIComponent(businessConfig.businessName || 'MenuBy');
      const desc = encodeURIComponent(businessConfig.description || 'Menú digital');
      const theme = encodeURIComponent(businessConfig.accentColor || '#3A7AFF');
      const bg = encodeURIComponent(businessConfig.primaryColor || '#051C2C');
      const logo = businessConfig.logo ? encodeURIComponent(
        businessConfig.logo.startsWith('http') ? businessConfig.logo : window.location.origin + businessConfig.logo
      ) : '';

      // Use Cloudflare Pages Function for real HTTP manifest (iOS compatible)
      const manifestURL = `/manifest?slug=${slug}&name=${name}&desc=${desc}&theme=${theme}&bg=${bg}&logo=${logo}`;

      // Remove existing manifest link and create a fresh one
      const existingLink = document.querySelector('link[rel="manifest"]');
      if (existingLink) {
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

      // iOS "Agregar a inicio" usa el <link rel="apple-touch-icon">, NO el
      // manifest. Como es estático (logo de MenuBy), lo reemplazamos por el logo
      // del negocio para que el atajo del iPhone use su icono. También ponemos el
      // favicon de la pestaña al logo del negocio.
      if (businessConfig.logo) {
        const logoHref = businessConfig.logo.startsWith('http')
          ? businessConfig.logo
          : window.location.origin + businessConfig.logo;

        document
          .querySelectorAll('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]')
          .forEach((l) => l.remove());
        const appleIcon = document.createElement('link');
        appleIcon.rel = 'apple-touch-icon';
        appleIcon.href = logoHref;
        document.head.appendChild(appleIcon);

        document.querySelectorAll('link[rel="icon"]').forEach((l) => l.remove());
        const favIcon = document.createElement('link');
        favIcon.rel = 'icon';
        favIcon.href = logoHref;
        document.head.appendChild(favIcon);
      }
    }
  }, [businessConfig, location.pathname]);

  return null; // This component doesn't render anything
};

export default DynamicManifest;
