/**
 * Cloudflare Pages Function — SEO pre-rendering for restaurant menus.
 * 
 * When search engine crawlers (Google, Facebook, Twitter) visit /{slug},
 * this function intercepts the request, fetches the business data from the API,
 * and returns an HTML page with proper meta tags, Open Graph, Twitter Cards,
 * and JSON-LD structured data.
 * 
 * For normal users (browsers), it passes through to the SPA.
 * 
 * Route: /:slug (catches all top-level paths that aren't static files)
 */

// NOTE: Cloudflare Pages Functions cannot use Vite imports.
// If the backend URL changes, update this fallback AND the VITE_API_URL env var.
const API_BASE = (typeof process !== 'undefined' && process.env?.API_BASE_URL) || 'https://157-245-125-216.nip.io/api';
const SITE_ORIGIN = 'https://menuby.tech';

// Known crawler user agents
const CRAWLER_PATTERNS = [
  'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider',
  'yandexbot', 'sogou', 'exabot', 'facebot', 'facebookexternalhit',
  'ia_archiver', 'twitterbot', 'linkedinbot', 'embedly', 'quora link preview',
  'showyoubot', 'outbrain', 'pinterest', 'slack', 'vkshare',
  'w3c_validator', 'whatsapp', 'telegrambot', 'rogerbot',
  'developers.google.com', 'redditbot', 'applebot', 'discordbot'
];

// Paths that should never be intercepted
const SKIP_PATHS = [
  '/admin', '/superadmin', '/login', '/register', '/api',
  '/manifest', '/sw.js', '/assets', '/favicon', '/logo',
  '/robots.txt', '/sitemap', '/_headers', '/_redirects'
];

function isCrawler(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_PATTERNS.some(bot => ua.includes(bot));
}

function shouldSkipPath(pathname) {
  return SKIP_PATHS.some(p => pathname.startsWith(p)) || 
         pathname.includes('.') || // Static files (.js, .css, .png, etc)
         pathname === '/';
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function formatHours(businessHours) {
  if (!businessHours) return '';
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  
  return days.map((day, i) => {
    const h = businessHours[day];
    if (!h || !h.isOpen) return `${dayNames[i]}: Cerrado`;
    return `${dayNames[i]}: ${h.openTime} - ${h.closeTime}`;
  }).join(' | ');
}

function buildOpeningHoursSpec(businessHours) {
  if (!businessHours) return [];
  const dayMap = {
    monday: 'Mo', tuesday: 'Tu', wednesday: 'We', 
    thursday: 'Th', friday: 'Fr', saturday: 'Sa', sunday: 'Su'
  };
  
  return Object.entries(dayMap).map(([day, abbr]) => {
    const h = businessHours[day];
    if (!h || !h.isOpen) return null;
    return {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${abbr === 'Mo' ? 'Monday' : abbr === 'Tu' ? 'Tuesday' : abbr === 'We' ? 'Wednesday' : abbr === 'Th' ? 'Thursday' : abbr === 'Fr' ? 'Friday' : abbr === 'Sa' ? 'Saturday' : 'Sunday'}`,
      opens: h.openTime || '08:00',
      closes: h.closeTime || '22:00'
    };
  }).filter(Boolean);
}

function buildMetaHtml(business, slug) {
  const name = escapeHtml(business.businessName || 'Restaurante');
  const description = escapeHtml(business.description || `Menú digital de ${name}. Pide online y disfruta de la mejor comida.`);
  const logo = business.logo || `${SITE_ORIGIN}/logo.jpeg`;
  const absoluteLogo = logo.startsWith('http') ? logo : `${SITE_ORIGIN}${logo}`;
  const url = `${SITE_ORIGIN}/${slug}`;
  const address = escapeHtml(business.address || '');
  const city = escapeHtml(business.city || '');
  const department = escapeHtml(business.department || '');
  const phone = business.whatsappNumber || '';
  const hours = formatHours(business.businessHours);

  // JSON-LD for Restaurant
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "name": business.businessName || 'Restaurante',
    "description": business.description || `Menú digital de ${business.businessName}`,
    "url": url,
    "logo": absoluteLogo,
    "image": business.coverImage || absoluteLogo,
    "servesCuisine": "Variada",
    "priceRange": "$$",
    ...(address && { 
      "address": {
        "@type": "PostalAddress",
        "streetAddress": address,
        ...(city && { "addressLocality": city }),
        ...(department && { "addressRegion": department }),
        "addressCountry": "CO"
      }
    }),
    ...(phone && { "telephone": phone }),
    "hasMenu": {
      "@type": "Menu",
      "url": url,
      "name": `Menú de ${business.businessName}`
    },
    "openingHoursSpecification": buildOpeningHoursSpec(business.businessHours),
    ...(business.location?.coordinates?.lat && {
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": business.location.coordinates.lat,
        "longitude": business.location.coordinates.lng
      }
    }),
    "potentialAction": {
      "@type": "OrderAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": url,
        "actionPlatform": ["http://schema.org/DesktopWebPlatform", "http://schema.org/MobileWebPlatform"]
      },
      "deliveryMethod": ["http://purl.org/goodrelations/v1#DeliveryModeOwnFleet"]
    }
  };

  // Social sharing links
  const socialLinks = [];
  if (business.socialMedia?.facebook?.url) socialLinks.push(`<link rel="me" href="${escapeHtml(business.socialMedia.facebook.url)}" />`);
  if (business.socialMedia?.instagram?.url) socialLinks.push(`<link rel="me" href="${escapeHtml(business.socialMedia.instagram.url)}" />`);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  
  <!-- Primary Meta Tags -->
  <title>${name} - Menú Digital | Pide Online</title>
  <meta name="title" content="${name} - Menú Digital | Pide Online" />
  <meta name="description" content="${description}" />
  <meta name="keywords" content="${name}, menú digital, pedidos online, ${city ? city + ', ' : ''}${department ? department + ', ' : ''}comida, delivery, restaurante" />
  <meta name="author" content="${name}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${url}" />
  
  <!-- Geo Tags -->
  <meta name="geo.region" content="CO" />
  ${city ? `<meta name="geo.placename" content="${city}" />` : ''}
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="restaurant" />
  <meta property="og:title" content="${name} - Menú Digital" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${escapeHtml(absoluteLogo)}" />
  <meta property="og:image:width" content="512" />
  <meta property="og:image:height" content="512" />
  <meta property="og:url" content="${url}" />
  <meta property="og:site_name" content="Menuby" />
  <meta property="og:locale" content="es_CO" />
  ${address ? `<meta property="og:street-address" content="${address}" />` : ''}
  ${city ? `<meta property="og:locality" content="${city}" />` : ''}
  ${phone ? `<meta property="og:phone_number" content="${phone}" />` : ''}
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${name} - Menú Digital" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${escapeHtml(absoluteLogo)}" />
  
  <!-- WhatsApp specific -->
  <meta property="og:image:alt" content="Logo de ${name}" />
  
  <!-- Structured Data -->
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  
  ${socialLinks.join('\n  ')}
  
  <!-- Theme -->
  <meta name="theme-color" content="${escapeHtml(business.theme?.buttonColor || '#E31E24')}" />
  <link rel="icon" href="${escapeHtml(absoluteLogo)}" />
  <link rel="apple-touch-icon" href="${escapeHtml(absoluteLogo)}" />
</head>
<body>
  <h1>${name}</h1>
  <p>${description}</p>
  ${address ? `<address>${address}${city ? `, ${city}` : ''}${department ? `, ${department}` : ''}</address>` : ''}
  ${phone ? `<p>Teléfono: <a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></p>` : ''}
  ${hours ? `<p>Horarios: ${escapeHtml(hours)}</p>` : ''}
  <p><a href="${url}">Ver menú completo</a></p>
  <noscript>
    <p>Este menú digital funciona mejor con JavaScript habilitado. 
    <a href="${url}">Visita ${name}</a> para ver el menú completo.</p>
  </noscript>
  <script>window.location.replace('${url}');</script>
</body>
</html>`;
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const pathname = url.pathname;
  const userAgent = context.request.headers.get('user-agent') || '';

  // Only intercept for crawlers on slug-like paths
  if (!isCrawler(userAgent) || shouldSkipPath(pathname)) {
    return context.next();
  }

  // Extract slug (first path segment)
  const slug = pathname.split('/').filter(Boolean)[0];
  if (!slug || slug.length < 2 || slug.length > 50) {
    return context.next();
  }

  try {
    // Fetch business data from API
    const apiResponse = await fetch(`${API_BASE}/business-config/by-slug/${slug}`, {
      headers: { 'Accept': 'application/json' },
      cf: { cacheTtl: 300 } // Cache in Cloudflare edge for 5 minutes
    });

    if (!apiResponse.ok) {
      // Not a valid business slug, let the SPA handle it
      return context.next();
    }

    const business = await apiResponse.json();
    const html = buildMetaHtml(business, slug);

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=300, s-maxage=600',
        'X-Robots-Tag': 'index, follow'
      }
    });
  } catch (error) {
    // If API fails, let the SPA handle it
    return context.next();
  }
}
