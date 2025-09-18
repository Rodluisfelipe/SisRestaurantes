import { useEffect } from 'react';

const useSEO = ({ 
  title, 
  description, 
  logo, 
  siteName, 
  url, 
  type = 'website',
  keywords,
  image
}) => {
  useEffect(() => {
    // Update document title
    if (title) {
      document.title = title;
    }

    // Update meta tags
    const metaTags = [
      { name: 'description', content: description },
      { name: 'keywords', content: keywords },
      { name: 'author', content: siteName },
      
      // Open Graph tags
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: type },
      { property: 'og:url', content: url },
      { property: 'og:site_name', content: siteName },
      { property: 'og:image', content: image || logo || '/icon.svg' },
      
      // Twitter tags
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: image || logo || '/icon.svg' },
      
      // Additional SEO tags
      { name: 'robots', content: 'index, follow' },
      { name: 'googlebot', content: 'index, follow' },
      { name: 'theme-color', content: '#3A7AFF' },
      { name: 'msapplication-TileColor', content: '#3A7AFF' },
      
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

    // Update favicon
    const iconUrl = logo || '/icon.svg';
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
    if (type === 'restaurant') {
      const structuredData = {
        "@context": "https://schema.org",
        "@type": "Restaurant",
        "name": siteName,
        "description": description,
        "url": url,
        "logo": logo || '/icon.svg',
        "image": image || logo || '/icon.svg',
        "servesCuisine": "Internacional",
        "priceRange": "$$",
        "telephone": "+1234567890", // Placeholder
        "email": "info@" + (url ? new URL(url).hostname : 'restaurant.com'),
        "hasMenu": url + "#menu",
        "acceptsReservations": true
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

  }, [title, description, logo, siteName, url, type, keywords, image]);
};

export default useSEO;
