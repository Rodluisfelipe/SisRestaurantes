import { useEffect } from 'react';

const SITE_ORIGIN = 'https://menuby.tech';

/**
 * SEO hook for landing pages.
 * Updates document title, meta description, canonical, and OG tags per page.
 * This ensures each landing route has unique SEO signals instead of sharing index.html defaults.
 */
const useLandingSEO = ({ title, description, canonical, keywords, type = 'website' }) => {
  useEffect(() => {
    // Update document title
    if (title) {
      document.title = title;
    }

    const fullCanonical = canonical ? `${SITE_ORIGIN}${canonical}` : SITE_ORIGIN;

    // Meta tags to update
    const metaTags = [
      { name: 'description', content: description },
      { name: 'keywords', content: keywords },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: type },
      { property: 'og:url', content: fullCanonical },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
    ];

    metaTags.forEach(({ name, property, content }) => {
      if (!content) return;
      const selector = name ? `meta[name="${name}"]` : `meta[property="${property}"]`;
      let meta = document.querySelector(selector);
      if (meta) {
        meta.setAttribute('content', content);
      } else {
        meta = document.createElement('meta');
        if (name) meta.setAttribute('name', name);
        if (property) meta.setAttribute('property', property);
        meta.setAttribute('content', content);
        document.head.appendChild(meta);
      }
    });

    // Update canonical URL
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.setAttribute('href', fullCanonical);
    } else {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      canonicalLink.setAttribute('href', fullCanonical);
      document.head.appendChild(canonicalLink);
    }

    // Cleanup: restore defaults when unmounting
    return () => {
      document.title = 'Crear Menú Digital para Restaurantes | Menuby Colombia - Sin Comisiones';
      const defaultCanonical = document.querySelector('link[rel="canonical"]');
      if (defaultCanonical) defaultCanonical.setAttribute('href', SITE_ORIGIN);
    };
  }, [title, description, canonical, keywords, type]);
};

export default useLandingSEO;
