import { useEffect } from 'react';

const SITE_ORIGIN = 'https://menuby.tech';

/**
 * Ensures an image URL is absolute for OG/Twitter meta tags.
 * Relative paths won't resolve when crawlers parse <meta> tags.
 */
function absoluteImageUrl(src) {
  if (!src) return `${SITE_ORIGIN}/logo.jpeg`;
  if (src.startsWith('http')) return src;
  return `${SITE_ORIGIN}${src.startsWith('/') ? '' : '/'}${src}`;
}

/**
 * Build OpeningHoursSpecification array from businessHours object
 */
function buildOpeningHours(businessHours) {
  if (!businessHours) return [];
  const dayMap = {
    monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
    thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday'
  };
  return Object.entries(dayMap).map(([key, schemaDay]) => {
    const h = businessHours[key];
    if (!h || !h.isOpen) return null;
    return {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${schemaDay}`,
      opens: h.openTime || '08:00',
      closes: h.closeTime || '22:00'
    };
  }).filter(Boolean);
}

const useSEO = ({ 
  title, 
  description, 
  logo, 
  siteName, 
  url, 
  type = 'website',
  keywords,
  image,
  // Extended business data for richer SEO
  businessConfig
}) => {
  useEffect(() => {
    // Update document title
    if (title) {
      document.title = title;
    }

    const absoluteImage = absoluteImageUrl(image || logo);
    const themeColor = businessConfig?.theme?.buttonColor || '#E31E24';
    const city = businessConfig?.city || '';
    const department = businessConfig?.department || '';

    // Update meta tags
    const metaTags = [
      { name: 'description', content: description },
      { name: 'keywords', content: keywords },
      { name: 'author', content: siteName },
      
      // Open Graph tags
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: type === 'restaurant' ? 'restaurant' : 'website' },
      { property: 'og:url', content: url },
      { property: 'og:site_name', content: 'Menuby' },
      { property: 'og:image', content: absoluteImage },
      { property: 'og:image:alt', content: `Logo de ${siteName}` },
      { property: 'og:locale', content: 'es_CO' },
      
      // Twitter tags
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: absoluteImage },
      
      // Additional SEO tags
      { name: 'robots', content: 'index, follow' },
      { name: 'googlebot', content: 'index, follow' },
      { name: 'theme-color', content: themeColor },
      { name: 'msapplication-TileColor', content: themeColor },
      
      // Geo tags (restaurant-specific)
      ...(type === 'restaurant' ? [
        { name: 'geo.region', content: 'CO' },
        ...(city ? [{ name: 'geo.placename', content: city }] : [])
      ] : []),
      
      // Mobile app tags
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      { name: 'apple-mobile-web-app-title', content: siteName },
      { name: 'mobile-web-app-capable', content: 'yes' }
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

    // Update canonical URL per page
    let canonical = document.querySelector('link[rel="canonical"]');
    if (url) {
      if (canonical) {
        canonical.setAttribute('href', url);
      } else {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        canonical.setAttribute('href', url);
        document.head.appendChild(canonical);
      }
    }

    // Update favicon
    const iconUrl = logo || '/logo.jpeg';
    let favicon = document.querySelector('link[rel="icon"]');
    if (favicon) {
      favicon.setAttribute('href', iconUrl);
    } else {
      favicon = document.createElement('link');
      favicon.setAttribute('rel', 'icon');
      favicon.setAttribute('href', iconUrl);
      document.head.appendChild(favicon);
    }

    // Apple touch icon
    let appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (appleTouchIcon) {
      appleTouchIcon.setAttribute('href', iconUrl);
    } else {
      appleTouchIcon = document.createElement('link');
      appleTouchIcon.setAttribute('rel', 'apple-touch-icon');
      appleTouchIcon.setAttribute('href', iconUrl);
      document.head.appendChild(appleTouchIcon);
    }

    // Schema.org structured data for restaurants
    if (type === 'restaurant' && businessConfig) {
      const address = businessConfig.address || '';
      const phone = businessConfig.whatsappNumber || '';

      const structuredData = {
        "@context": "https://schema.org",
        "@type": "Restaurant",
        "name": siteName,
        "description": description,
        "url": url,
        "logo": absoluteImage,
        "image": absoluteImageUrl(businessConfig.coverImage) || absoluteImage,
        "servesCuisine": "Variada",
        "priceRange": "$$",
        ...(phone && { "telephone": phone }),
        ...(address && {
          "address": {
            "@type": "PostalAddress",
            "streetAddress": address,
            ...(city && { "addressLocality": city }),
            ...(department && { "addressRegion": department }),
            "addressCountry": "CO"
          }
        }),
        "hasMenu": {
          "@type": "Menu",
          "url": url,
          "name": `Menú de ${siteName}`
        },
        "openingHoursSpecification": buildOpeningHours(businessConfig.businessHours),
        ...(businessConfig.location?.coordinates?.lat && {
          "geo": {
            "@type": "GeoCoordinates",
            "latitude": businessConfig.location.coordinates.lat,
            "longitude": businessConfig.location.coordinates.lng
          }
        }),
        "potentialAction": {
          "@type": "OrderAction",
          "target": {
            "@type": "EntryPoint",
            "urlTemplate": url,
            "actionPlatform": [
              "http://schema.org/DesktopWebPlatform",
              "http://schema.org/MobileWebPlatform"
            ]
          }
        }
      };

      let scriptTag = document.querySelector('script[type="application/ld+json"]');
      if (scriptTag) {
        scriptTag.textContent = JSON.stringify(structuredData);
      } else {
        scriptTag = document.createElement('script');
        scriptTag.type = 'application/ld+json';
        scriptTag.textContent = JSON.stringify(structuredData);
        document.head.appendChild(scriptTag);
      }
    }

  }, [title, description, logo, siteName, url, type, keywords, image, businessConfig]);
};

export default useSEO;
