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
const API_BASE = (typeof process !== 'undefined' && process.env?.API_BASE_URL) || 'https://api.menuby.tech/api';
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');
const SITE_ORIGIN = 'https://menuby.tech';

/**
 * Verificación del dominio ante Meta.
 *
 * Va acá y no solo en index.html porque esta función genera el HTML desde cero
 * para los rastreadores, y `facebookexternalhit` —justo el que Meta usa para
 * verificar— es uno de ellos. Sin esto, la etiqueta se veía en el navegador
 * pero no en lo que recibía Meta, y la verificación fallaba sin decir por qué.
 *
 * Se declara una sola vez y se inserta en las cuatro plantillas: si mañana se
 * añade una quinta y se olvida, vuelve a pasar lo mismo.
 */
const META_DOMAIN_VERIFICATION = '<meta name="facebook-domain-verification" content="8jy1dd584k8q3xk0eotletfa6wej7u" />';

// Pre-render ligero del menú para USUARIOS (no solo bots): inyecta un splash con
// la marca del negocio en el HTML inicial para que pinte al instante; el SPA lo
// reemplaza al montar. Poner en false para desactivarlo por completo.
const PRERENDER_MENU_FOR_USERS = true;

// Rutas de un solo segmento que NO son negocios (evita un fetch innecesario).
// Si se escapa alguna, igual cae con gracia al SPA (el fetch del negocio da 404).
const RESERVED_SLUGS = new Set([
  'login', 'register', 'features', 'pricing', 'demo', 'contact', 'blog',
  'restaurantes', 'mesero', 'crew', 'favoritos', 'pedidos', 'checkout',
  'pago', 'payment', 'not-found', '404', 'terms', 'privacy',
  'terminos', 'privacidad', 'whatsapp-conectado',
]);

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
  '/admin', '/superadmin', '/api',
  '/manifest', '/sw.js', '/assets', '/favicon', '/logo',
  '/robots.txt', '/sitemap', '/_headers', '/_redirects'
];

// Landing pages with their SEO metadata (pre-rendered for crawlers)
const LANDING_PAGES = {
  '/': {
    title: 'Crear Menú Digital para Restaurantes Gratis | Menuby Colombia',
    /* Cifra verificable. Decía "500+ restaurantes en Colombia" con 28
       registrados; lo que Google promete tiene que aguantar que alguien
       pregunte. */
    description: 'Crea tu menú digital con código QR en 5 minutos. Recibe pedidos online por WhatsApp, gestiona cocina en tiempo real. Sin comisiones. Más de 6.000 pedidos gestionados en Colombia.',
    keywords: 'crear menú digital, menú digital restaurante, menú QR gratis, carta digital restaurante, pedidos online restaurante',
  },
  '/features': {
    title: 'Funcionalidades del Menú Digital para Restaurantes | Menuby',
    description: 'Menú QR, pedidos a domicilio, pantalla de cocina en tiempo real, múltiples métodos de pago, WhatsApp integrado. Todas las herramientas para tu restaurante.',
    keywords: 'funcionalidades menú digital, pedidos domicilio restaurante, pantalla cocina tiempo real, menú QR restaurante',
  },
  '/pricing': {
    /* El precio del resultado de Google tiene que ser el de la página. Decía
       $30.000 y el plan más barato cobra $39.900: quien llega sintiéndose
       engañado en los primeros diez segundos no se queda, y Google penaliza
       que el resultado prometa algo distinto de lo que hay. */
    title: 'Precios Menú Digital - Desde $39.900/mes | Menuby Colombia',
    description: 'Menú digital profesional desde $39.900 COP al mes. Plan gratis para empezar. Sin comisiones, sin contratos.',
    keywords: 'precio menú digital, menú digital barato, menú digital sin comisiones, menú QR precio',
  },
  '/demo': {
    title: 'Demo Menú Digital Interactivo para Restaurantes | Menuby',
    description: 'Explora la demo interactiva de Menuby. Mira cómo se ve un menú digital con QR para restaurante, cafetería y food truck.',
    keywords: 'demo menú digital, ejemplo menú QR restaurante, menú digital interactivo',
  },
  '/contact': {
    title: 'Contacto | Menuby - Menú Digital para Restaurantes en Colombia',
    description: 'Contáctanos por WhatsApp, email o teléfono. Soporte inmediato para configurar tu menú digital. +57 302 818 1520.',
    keywords: 'contacto menuby, soporte menú digital, menú digital Colombia contacto',
  },
  '/login': {
    title: 'Iniciar Sesión | Menuby - Menú Digital para Restaurantes',
    description: 'Inicia sesión en tu panel de control de Menuby para gestionar tu menú digital, pedidos y clientes.',
    keywords: 'menuby login, iniciar sesión menú digital',
  },
  '/register': {
    title: 'Crear Cuenta Gratis | Menuby - Menú Digital para Restaurantes',
    description: 'Regístrate gratis y crea tu menú digital con código QR en 5 minutos. Sin tarjeta de crédito. 7 días de prueba.',
    keywords: 'crear cuenta menú digital, registro menuby, menú digital gratis registro',
  },
  // ── Niche landing pages ──
  '/menu-digital-restaurante': {
    title: 'Menú Digital para Restaurantes | Código QR + Pedidos Online | Menuby',
    description: 'Crea tu menú digital para restaurante con código QR en 5 minutos. Recibe pedidos online, gestiona cocina en tiempo real. Sin comisiones. Prueba 7 días gratis.',
    keywords: 'menú digital restaurante, carta digital restaurante, menú QR restaurante, menú online restaurante',
  },
  '/menu-digital-bar': {
    title: 'Menú Digital para Bares | Carta Digital con QR | Menuby',
    description: 'Menú digital para bares con código QR. Tus clientes ven la carta de cócteles y snacks desde el celular y piden sin esperar.',
    keywords: 'menú digital bar, carta digital bar, menú QR bar, menú cócteles digital',
  },
  '/menu-digital-cafeteria': {
    title: 'Menú Digital para Cafeterías | QR + Pedidos Online | Menuby',
    description: 'Carta digital para cafeterías con QR. Muestra bebidas, postres y combos. Recibe pedidos para recoger o a domicilio.',
    keywords: 'menú digital cafetería, carta digital café, menú QR cafetería, menú online cafetería',
  },
  '/menu-digital-pizzeria': {
    title: 'Menú Digital para Pizzerías | Pedidos Online Sin Comisiones | Menuby',
    description: 'Sistema de menú digital para pizzerías. Personaliza tamaños, masas y toppings. Recibe pedidos a domicilio sin comisiones.',
    keywords: 'menú digital pizzería, carta digital pizzería, pedidos online pizza, menú QR pizzería',
  },
  '/menu-digital-hamburgueseria': {
    title: 'Menú Digital para Hamburgueserías | Pedidos Online | Menuby',
    description: 'Menú digital para hamburgueserías con QR. Combos, extras y adiciones configurables. Pedidos online sin intermediarios.',
    keywords: 'menú digital hamburguesería, carta digital hamburguesas, pedidos online hamburguesas',
  },
  '/menu-digital-hotel': {
    title: 'Menú Digital para Hoteles | Room Service Digital | Menuby',
    description: 'Sistema de menú digital para hoteles y room service. QR por habitación, pedidos al restaurante del hotel. Multi-idioma.',
    keywords: 'menú digital hotel, room service digital, menú QR hotel, carta digital hotel',
  },
  '/menu-digital-food-truck': {
    title: 'Menú Digital para Food Trucks | Carta QR Móvil | Menuby',
    description: 'Menú digital para food trucks. Comparte tu carta con QR portátil. Actualiza el menú del día al instante desde el celular.',
    keywords: 'menú digital food truck, carta digital food truck, menú QR food truck',
  },
  '/menu-digital-panaderia': {
    title: 'Menú Digital para Panaderías | Catálogo con QR | Menuby',
    description: 'Menú digital para panaderías y pastelerías. Muestra panes, tortas y productos del día con fotos y precios actualizados.',
    keywords: 'menú digital panadería, carta digital pastelería, menú QR panadería',
  },
  '/menu-digital-comida-rapida': {
    title: 'Menú Digital para Comida Rápida | Pedidos Express | Menuby',
    description: 'Sistema de menú digital para locales de comida rápida. Combos, promociones y pedidos rápidos desde el celular.',
    keywords: 'menú digital comida rápida, carta digital fast food, pedidos online comida rápida',
  },
  '/menu-digital-sushi': {
    title: 'Menú Digital para Restaurantes de Sushi | Menuby',
    description: 'Menú digital optimizado para sushi. Rolls, combos y tablas con fotos. Pedidos a domicilio sin comisiones.',
    keywords: 'menú digital sushi, carta digital sushi, pedidos online sushi, menú QR sushi',
  },
  '/menu-digital-asadero': {
    title: 'Menú Digital para Asaderos | Carta QR + Pedidos | Menuby',
    description: 'Menú digital para asaderos y restaurantes de carnes. Porciones, combos y bandejas. Pedidos sin intermediarios.',
    keywords: 'menú digital asadero, carta digital asadero, menú QR asadero, pedidos online asadero',
  },
  '/menu-digital-heladeria': {
    title: 'Menú Digital para Heladerías | Catálogo QR | Menuby',
    description: 'Menú digital para heladerías. Muestra sabores, conos, copas y combos familiares con fotos profesionales.',
    keywords: 'menú digital heladería, carta digital heladería, menú QR heladería',
  },
};

function isCrawler(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_PATTERNS.some(bot => ua.includes(bot));
}

function shouldSkipPath(pathname) {
  return SKIP_PATHS.some(p => pathname.startsWith(p)) || 
         pathname.includes('.'); // Static files (.js, .css, .png, etc)
}

function buildLandingPageHtml(page, pathname) {
  const url = `${SITE_ORIGIN}${pathname}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Menuby",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "url": SITE_ORIGIN,
    "description": page.description,
    "offers": {
      "@type": "Offer",
      "price": "30000",
      "priceCurrency": "COP",
      "priceValidUntil": "2026-12-31"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": "127",
      "bestRating": "5"
    }
  };

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  ${META_DOMAIN_VERIFICATION}
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(page.title)}</title>
  <meta name="description" content="${escapeHtml(page.description)}" />
  <meta name="keywords" content="${escapeHtml(page.keywords)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${url}" />
  <meta name="geo.region" content="CO" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(page.title)}" />
  <meta property="og:description" content="${escapeHtml(page.description)}" />
  <meta property="og:image" content="${SITE_ORIGIN}/og-image.jpg" />
  <meta property="og:url" content="${url}" />
  <meta property="og:site_name" content="Menuby" />
  <meta property="og:locale" content="es_CO" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(page.title)}" />
  <meta name="twitter:description" content="${escapeHtml(page.description)}" />
  <meta name="twitter:image" content="${SITE_ORIGIN}/og-image.jpg" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <meta name="theme-color" content="#E31E24" />
  <link rel="icon" href="${SITE_ORIGIN}/favicon.ico" sizes="any" />
  <link rel="icon" type="image/png" sizes="96x96" href="${SITE_ORIGIN}/favicon-96x96.png" />
</head>
<body>
  <h1>${escapeHtml(page.title.split('|')[0].trim())}</h1>
  <p>${escapeHtml(page.description)}</p>
  <nav>
    <a href="${SITE_ORIGIN}/">Inicio</a>
    <a href="${SITE_ORIGIN}/features">Funcionalidades</a>
    <a href="${SITE_ORIGIN}/pricing">Precios</a>
    <a href="${SITE_ORIGIN}/demo">Demo</a>
    <a href="${SITE_ORIGIN}/contact">Contacto</a>
    <a href="${SITE_ORIGIN}/blog">Blog</a>
    <a href="${SITE_ORIGIN}/register">Crear Cuenta Gratis</a>
    <a href="${SITE_ORIGIN}/menu-digital-restaurante">Menú Digital para Restaurantes</a>
    <a href="${SITE_ORIGIN}/menu-digital-bar">Menú Digital para Bares</a>
    <a href="${SITE_ORIGIN}/menu-digital-cafeteria">Menú Digital para Cafeterías</a>
    <a href="${SITE_ORIGIN}/menu-digital-pizzeria">Menú Digital para Pizzerías</a>
    <a href="${SITE_ORIGIN}/menu-digital-hamburgueseria">Menú Digital para Hamburgueserías</a>
    <a href="${SITE_ORIGIN}/menu-digital-hotel">Menú Digital para Hoteles</a>
    <a href="${SITE_ORIGIN}/menu-digital-food-truck">Menú Digital para Food Trucks</a>
    <a href="${SITE_ORIGIN}/menu-digital-panaderia">Menú Digital para Panaderías</a>
    <a href="${SITE_ORIGIN}/menu-digital-comida-rapida">Menú Digital para Comida Rápida</a>
    <a href="${SITE_ORIGIN}/menu-digital-sushi">Menú Digital para Sushi</a>
    <a href="${SITE_ORIGIN}/menu-digital-asadero">Menú Digital para Asaderos</a>
    <a href="${SITE_ORIGIN}/menu-digital-heladeria">Menú Digital para Heladerías</a>
  </nav>
  <script>window.location.replace('${url}');</script>
</body>
</html>`;
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

// Construye el menú completo (secciones + items con precio) para el JSON-LD
function buildMenuSchema(business, products, categories) {
  const url = `${SITE_ORIGIN}/${business.slug || ''}`;
  const base = { "@type": "Menu", "url": url, "name": `Menú de ${business.businessName || 'Restaurante'}` };
  if (!Array.isArray(products) || !Array.isArray(categories) || !products.length) return base;

  const currency = business.currency || 'COP';
  const active = products.filter(p => p && p.active !== false);
  const sorted = [...categories].sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));
  const sections = [];
  let count = 0;

  for (const cat of sorted) {
    const items = active
      .filter(p => p.category === cat._id)
      .slice(0, 30)
      .map(p => {
        const item = { "@type": "MenuItem", "name": p.name };
        if (p.description) item.description = String(p.description).slice(0, 300);
        if (p.image) item.image = p.image;
        if (typeof p.price === 'number' && p.price > 0) {
          item.offers = { "@type": "Offer", "price": String(p.price), "priceCurrency": currency };
        }
        return item;
      });
    if (items.length) {
      sections.push({ "@type": "MenuSection", "name": cat.name, "hasMenuItem": items });
      count += items.length;
    }
    if (count >= 120) break;
  }

  return sections.length ? { ...base, "hasMenuSection": sections } : base;
}

function priceRangeSymbol(products) {
  const prices = (products || []).map(p => p?.price).filter(n => typeof n === 'number' && n > 0);
  if (!prices.length) return '$$';
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  if (avg < 20000) return '$';
  if (avg < 45000) return '$$';
  return '$$$';
}

// Blog article metadata for crawler pre-rendering
const BLOG_ARTICLES = {
  'como-crear-menu-digital-restaurante': {
    title: 'Cómo Crear un Menú Digital para tu Restaurante en 5 Minutos',
    description: 'Guía paso a paso para crear tu menú digital con código QR. Aprende a digitalizar la carta de tu restaurante sin conocimientos técnicos.',
    keywords: 'crear menú digital, cómo hacer menú digital, menú digital restaurante paso a paso',
    date: '2025-06-01',
  },
  'ventajas-menu-digital-vs-menu-impreso': {
    title: '7 Ventajas del Menú Digital vs el Menú Impreso en Restaurantes',
    description: 'Descubre por qué los restaurantes están reemplazando sus cartas impresas por menús digitales con código QR.',
    keywords: 'ventajas menú digital, menú digital vs impreso, beneficios carta digital',
    date: '2025-05-28',
  },
  'como-recibir-pedidos-por-whatsapp': {
    title: 'Cómo Recibir Pedidos por WhatsApp en tu Restaurante (Guía 2025)',
    description: 'Configura un sistema de pedidos por WhatsApp para tu restaurante. Menú digital + WhatsApp = más ventas sin comisiones.',
    keywords: 'pedidos WhatsApp restaurante, recibir pedidos por WhatsApp, menú digital WhatsApp',
    date: '2025-05-25',
  },
  'codigo-qr-para-restaurantes': {
    title: 'Código QR para Restaurantes: Guía Completa para Implementarlo',
    description: 'Todo lo que necesitas saber sobre códigos QR para el menú de tu restaurante.',
    keywords: 'código QR restaurante, QR menú restaurante, crear QR para menú',
    date: '2025-05-20',
  },
  'pantalla-cocina-restaurante-tiempo-real': {
    title: 'Pantalla de Cocina para Restaurantes: Gestiona Pedidos en Tiempo Real',
    description: 'Cómo implementar una pantalla de cocina digital en tu restaurante.',
    keywords: 'pantalla cocina restaurante, sistema cocina tiempo real, KDS restaurante',
    date: '2025-05-15',
  },
  'como-aumentar-ventas-restaurante-menu-digital': {
    title: 'Cómo Aumentar las Ventas de tu Restaurante con un Menú Digital',
    description: '5 estrategias probadas para incrementar el ticket promedio y las ventas de tu restaurante.',
    keywords: 'aumentar ventas restaurante, menú digital más ventas, ticket promedio restaurante',
    date: '2025-05-10',
  },
  'menu-digital-sin-comisiones-colombia': {
    title: 'Menú Digital Sin Comisiones para Restaurantes en Colombia',
    description: 'Compara plataformas de menú digital en Colombia. Descubre cuál no cobra comisiones.',
    keywords: 'menú digital sin comisiones, menú digital Colombia precio, menuby vs rappi',
    date: '2025-05-05',
  },
  'tendencias-restaurantes-digitales-2025': {
    title: 'Tendencias de Restaurantes Digitales en Colombia 2025',
    description: 'Las 5 tendencias tecnológicas que están transformando los restaurantes en Colombia.',
    keywords: 'tendencias restaurantes 2025, restaurante digital Colombia, tecnología restaurantes',
    date: '2025-04-28',
  },
};

function buildBlogPostHtml(article, slug) {
  const url = `${SITE_ORIGIN}/blog/${slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.title,
    "description": article.description,
    "datePublished": article.date,
    "author": { "@type": "Organization", "name": "Menuby", "url": SITE_ORIGIN },
    "publisher": { "@type": "Organization", "name": "Menuby", "logo": { "@type": "ImageObject", "url": `${SITE_ORIGIN}/logo.jpeg` } },
    "mainEntityOfPage": { "@type": "WebPage", "@id": url },
    "keywords": article.keywords,
  };

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  ${META_DOMAIN_VERIFICATION}
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(article.title)} | Blog Menuby</title>
  <meta name="description" content="${escapeHtml(article.description)}" />
  <meta name="keywords" content="${escapeHtml(article.keywords)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(article.title)}" />
  <meta property="og:description" content="${escapeHtml(article.description)}" />
  <meta property="og:image" content="${SITE_ORIGIN}/og-image.jpg" />
  <meta property="og:url" content="${url}" />
  <meta property="og:site_name" content="Menuby" />
  <meta property="og:locale" content="es_CO" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(article.title)}" />
  <meta name="twitter:description" content="${escapeHtml(article.description)}" />
  <meta name="twitter:image" content="${SITE_ORIGIN}/og-image.jpg" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <meta name="theme-color" content="#E31E24" />
  <link rel="icon" href="${SITE_ORIGIN}/favicon.ico" sizes="any" />
  <link rel="icon" type="image/png" sizes="96x96" href="${SITE_ORIGIN}/favicon-96x96.png" />
</head>
<body>
  <h1>${escapeHtml(article.title)}</h1>
  <p>${escapeHtml(article.description)}</p>
  <nav>
    <a href="${SITE_ORIGIN}/">Inicio</a>
    <a href="${SITE_ORIGIN}/blog">Blog</a>
    <a href="${SITE_ORIGIN}/features">Funcionalidades</a>
    <a href="${SITE_ORIGIN}/pricing">Precios</a>
    <a href="${SITE_ORIGIN}/register">Crear Cuenta Gratis</a>
  </nav>
  <script>window.location.replace('${url}');</script>
</body>
</html>`;
}

function buildBlogIndexHtml() {
  const url = `${SITE_ORIGIN}/blog`;
  const articles = Object.entries(BLOG_ARTICLES);

  let articleLinks = articles.map(([slug, a]) => 
    `<li><a href="${SITE_ORIGIN}/blog/${slug}">${escapeHtml(a.title)}</a> — ${escapeHtml(a.description)}</li>`
  ).join('\n    ');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  ${META_DOMAIN_VERIFICATION}
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Blog de Menú Digital para Restaurantes | Menuby Colombia</title>
  <meta name="description" content="Guías, tendencias y consejos sobre menú digital, código QR, pedidos online y tecnología para restaurantes en Colombia." />
  <meta name="keywords" content="blog menú digital, guías restaurante digital, tendencias restaurantes Colombia" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Blog de Menú Digital para Restaurantes | Menuby" />
  <meta property="og:description" content="Guías, tendencias y consejos sobre menú digital para restaurantes en Colombia." />
  <meta property="og:image" content="${SITE_ORIGIN}/og-image.jpg" />
  <meta property="og:url" content="${url}" />
  <meta property="og:site_name" content="Menuby" />
  <meta property="og:locale" content="es_CO" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Blog de Menú Digital para Restaurantes | Menuby" />
  <meta name="twitter:description" content="Guías, tendencias y consejos sobre menú digital para restaurantes." />
  <meta name="twitter:image" content="${SITE_ORIGIN}/og-image.jpg" />
  <meta name="theme-color" content="#E31E24" />
  <link rel="icon" href="${SITE_ORIGIN}/favicon.ico" sizes="any" />
  <link rel="icon" type="image/png" sizes="96x96" href="${SITE_ORIGIN}/favicon-96x96.png" />
</head>
<body>
  <h1>Blog sobre Menú Digital para Restaurantes</h1>
  <p>Guías prácticas, tendencias y estrategias para digitalizar tu restaurante y vender más.</p>
  <ul>
    ${articleLinks}
  </ul>
  <nav>
    <a href="${SITE_ORIGIN}/">Inicio</a>
    <a href="${SITE_ORIGIN}/features">Funcionalidades</a>
    <a href="${SITE_ORIGIN}/pricing">Precios</a>
    <a href="${SITE_ORIGIN}/register">Crear Cuenta Gratis</a>
  </nav>
  <script>window.location.replace('${url}');</script>
</body>
</html>`;
}

function buildMetaHtml(business, slug, products, categories) {
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
    "priceRange": priceRangeSymbol(products),
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
    "hasMenu": buildMenuSchema(business, products, categories),
    ...(business.reviewStats?.totalReviews > 0 && business.reviewStats?.averageRating > 0 && {
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": Number(business.reviewStats.averageRating).toFixed(1),
        "reviewCount": business.reviewStats.totalReviews,
        "bestRating": 5,
        "worstRating": 1
      }
    }),
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
  ${META_DOMAIN_VERIFICATION}
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

// Splash con la marca del negocio (estilos inline: aún no cargó Tailwind).
// Imita a SplashScreen.jsx para que la transición al montar React sea fluida.
function buildSplashDiv(name, theme, logo) {
  const safeName = escapeHtml(name || '');
  const logoHtml = logo
    ? `<img src="${escapeHtml(logo)}" alt="${safeName}" style="width:100%;height:100%;object-fit:cover"/>`
    : `<span style="font-size:46px;line-height:1">🍽️</span>`;
  return `<div id="mb-splash" style="position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">`
    + `<div style="width:104px;height:104px;border-radius:22px;overflow:hidden;box-shadow:0 14px 44px -10px rgba(0,0,0,.22);border:2px solid ${theme}33;background:${theme}14;display:flex;align-items:center;justify-content:center">${logoHtml}</div>`
    + (safeName ? `<div style="margin-top:18px;font-weight:800;font-size:19px;color:#1f2937;letter-spacing:-.01em">${safeName}</div>` : '')
    + `<div style="margin-top:20px;width:32px;height:32px;border:3px solid ${theme}22;border-top-color:${theme};border-radius:50%;animation:mbspin .7s linear infinite"></div>`
    + `<style>@keyframes mbspin{to{transform:rotate(360deg)}}</style>`
    + `</div>`;
}

// Inyecta el splash + título/theme del negocio en el index.html del SPA.
// Devuelve null si no encuentra el punto de anclaje (para no romper nada).
function injectMenuShell(html, business) {
  try {
    const rootTag = '<div id="root"></div>';
    if (html.indexOf(rootTag) === -1) return null;
    const name = business.businessName || 'Menú';
    const rawTheme = (business.theme && business.theme.buttonColor) || '';
    const theme = /^#[0-9a-fA-F]{6}$/.test(rawTheme) ? rawTheme : '#E31E24';
    let logo = business.logo || '';
    if (logo && !/^https?:\/\//i.test(logo)) logo = API_ORIGIN + logo;

    let out = html.replace(rootTag, `<div id="root">${buildSplashDiv(name, theme, logo)}</div>`);
    out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(name)} — Menú</title>`);
    out = out.replace(/<meta name="theme-color" content="[^"]*"\s*\/>/, `<meta name="theme-color" content="${escapeHtml(theme)}" />`);
    return out;
  } catch (e) {
    return null;
  }
}

// Enhancer para usuarios en la página del menú: entrega el SPA con el splash
// de marca ya pintado. Ante cualquier duda o fallo, cae al SPA normal.
async function enhanceMenuForUser(context, pathname) {
  if (!PRERENDER_MENU_FOR_USERS) return context.next();

  const seg = pathname.split('/').filter(Boolean);
  if (seg.length !== 1) return context.next(); // solo la página del menú (/:slug)
  const slug = seg[0];
  if (slug.length < 2 || slug.length > 50) return context.next();
  if (RESERVED_SLUGS.has(slug) || LANDING_PAGES['/' + slug]) return context.next();

  try {
    const shellPromise = context.next(); // index.html del SPA (fallback de Pages)
    const bizRes = await fetch(`${API_BASE}/business-config/by-slug/${slug}`, {
      headers: { Accept: 'application/json' },
      cf: { cacheTtl: 300 },
    });
    const shell = await shellPromise;

    if (!bizRes.ok) return shell; // no es un negocio → SPA normal
    const ct = shell.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return shell;

    const business = await bizRes.json();
    if (!business || !business._id) return shell;

    const html = await shell.text();
    const enhanced = injectMenuShell(html, business);
    return new Response(enhanced || html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=0, s-maxage=60',
      },
    });
  } catch (e) {
    return context.next();
  }
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const pathname = url.pathname;
  const userAgent = context.request.headers.get('user-agent') || '';

  // Build assets (/assets/*.js|css con hash). Si el archivo exacto NO existe
  // —hash viejo tras un deploy, o request que llegó a mitad de un deploy—
  // Cloudflare Pages cae al SPA fallback y devuelve index.html (text/html).
  // Servir HTML ante un <script type=module> revienta con:
  //   "Expected a JavaScript module but the server responded with text/html".
  // En vez de eso devolvemos un 404 honesto: el navegador lanza un
  // "Failed to fetch dynamically imported module" limpio que el auto-recovery
  // de main.jsx detecta para recargar y traer el index.html + chunks nuevos.
  if (pathname.startsWith('/assets/')) {
    const res = await context.next();
    const ct = res.headers.get('content-type') || '';
    if (res.status === 200 && ct.includes('text/html')) {
      return new Response('Not found', {
        status: 404,
        headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' },
      });
    }
    return res;
  }

  // Skip static files and admin paths
  if (shouldSkipPath(pathname)) {
    return context.next();
  }

  // Usuarios (no bots): en la página del menú, servir el SPA con el splash de
  // marca ya pintado (pre-render ligero). El resto de rutas pasan directo.
  if (!isCrawler(userAgent)) {
    return enhanceMenuForUser(context, pathname);
  }

  // Pre-render landing pages for crawlers
  const landingPage = LANDING_PAGES[pathname];
  if (landingPage) {
    return new Response(buildLandingPageHtml(landingPage, pathname), {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=7200',
        'X-Robots-Tag': 'index, follow'
      }
    });
  }

  // Pre-render blog index page for crawlers
  if (pathname === '/blog') {
    const blogIndexHtml = buildBlogIndexHtml();
    return new Response(blogIndexHtml, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=7200',
        'X-Robots-Tag': 'index, follow'
      }
    });
  }

  // Pre-render blog article for crawlers
  if (pathname.startsWith('/blog/')) {
    const blogSlug = pathname.replace('/blog/', '');
    const article = BLOG_ARTICLES[blogSlug];
    if (article) {
      return new Response(buildBlogPostHtml(article, blogSlug), {
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
          'Cache-Control': 'public, max-age=3600, s-maxage=7200',
          'X-Robots-Tag': 'index, follow'
        }
      });
    }
  }

  // Extract slug (first path segment) for restaurant pages
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

    // Traer productos y categorías para el menú estructurado (tolerante a fallos)
    let products = [];
    let categories = [];
    try {
      const bid = business._id;
      if (bid) {
        const [pRes, cRes] = await Promise.all([
          fetch(`${API_BASE}/products?businessId=${bid}`, { headers: { 'Accept': 'application/json' }, cf: { cacheTtl: 300 } }),
          fetch(`${API_BASE}/categories?businessId=${bid}`, { headers: { 'Accept': 'application/json' }, cf: { cacheTtl: 300 } }),
        ]);
        if (pRes.ok) { const j = await pRes.json(); products = Array.isArray(j) ? j : (j.products || []); }
        if (cRes.ok) { const j = await cRes.json(); categories = Array.isArray(j) ? j : (j.categories || []); }
      }
    } catch (e) { /* seguimos con el menú básico */ }

    const html = buildMetaHtml(business, slug, products, categories);

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
