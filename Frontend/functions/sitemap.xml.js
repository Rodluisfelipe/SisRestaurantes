/**
 * Cloudflare Pages Function — Dynamic sitemap.xml
 * 
 * Fetches all active businesses from the API and generates a sitemap
 * that includes all restaurant menu URLs plus static pages.
 * 
 * Route: /sitemap.xml
 */

// NOTE: Cloudflare Pages Functions cannot use Vite imports.
// If the backend URL changes, update this fallback AND the VITE_API_URL env var.
const API_BASE = (typeof process !== 'undefined' && process.env?.API_BASE_URL) || 'https://157-245-125-216.nip.io/api';
const SITE_ORIGIN = 'https://menuby.tech';

export async function onRequest(context) {
  try {
    // Fetch all active businesses
    const response = await fetch(`${API_BASE}/business-config/catalog`, {
      headers: { 'Accept': 'application/json' },
      cf: { cacheTtl: 3600 } // Cache 1 hour at edge
    });

    let businesses = [];
    if (response.ok) {
      const data = await response.json();
      businesses = Array.isArray(data) ? data : (data.businesses || data.data || []);
    }

    const today = new Date().toISOString().split('T')[0];

    // Static pages
    const staticPages = [
      { loc: '/', priority: '1.0', changefreq: 'weekly' },
      { loc: '/features', priority: '0.8', changefreq: 'monthly' },
      { loc: '/pricing', priority: '0.8', changefreq: 'monthly' },
      { loc: '/demo', priority: '0.7', changefreq: 'monthly' },
      { loc: '/contact', priority: '0.6', changefreq: 'monthly' },
      { loc: '/register', priority: '0.7', changefreq: 'yearly' },
      { loc: '/blog', priority: '0.8', changefreq: 'weekly' },
      { loc: '/restaurantes', priority: '0.7', changefreq: 'daily' },
      // Niche landing pages
      { loc: '/menu-digital-restaurante', priority: '0.9', changefreq: 'monthly' },
      { loc: '/menu-digital-bar', priority: '0.8', changefreq: 'monthly' },
      { loc: '/menu-digital-cafeteria', priority: '0.8', changefreq: 'monthly' },
      { loc: '/menu-digital-pizzeria', priority: '0.8', changefreq: 'monthly' },
      { loc: '/menu-digital-hamburgueseria', priority: '0.8', changefreq: 'monthly' },
      { loc: '/menu-digital-hotel', priority: '0.8', changefreq: 'monthly' },
      { loc: '/menu-digital-food-truck', priority: '0.8', changefreq: 'monthly' },
      { loc: '/menu-digital-panaderia', priority: '0.8', changefreq: 'monthly' },
      { loc: '/menu-digital-comida-rapida', priority: '0.8', changefreq: 'monthly' },
      { loc: '/menu-digital-sushi', priority: '0.8', changefreq: 'monthly' },
      { loc: '/menu-digital-asadero', priority: '0.8', changefreq: 'monthly' },
      { loc: '/menu-digital-heladeria', priority: '0.8', changefreq: 'monthly' },
    ];

    // Blog articles
    const blogPosts = [
      'como-crear-menu-digital-restaurante',
      'ventajas-menu-digital-vs-menu-impreso',
      'como-recibir-pedidos-por-whatsapp',
      'codigo-qr-para-restaurantes',
      'pantalla-cocina-restaurante-tiempo-real',
      'como-aumentar-ventas-restaurante-menu-digital',
      'menu-digital-sin-comisiones-colombia',
      'tendencias-restaurantes-digitales-2025',
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`;

    // Add static pages
    for (const page of staticPages) {
      xml += `  <url>
    <loc>${SITE_ORIGIN}${page.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
    }

    // Add blog posts
    for (const slug of blogPosts) {
      xml += `  <url>
    <loc>${SITE_ORIGIN}/blog/${slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
`;
    }

    // Add restaurant menu pages
    for (const biz of businesses) {
      if (!biz.slug) continue;
      
      const lastmod = biz.updatedAt ? new Date(biz.updatedAt).toISOString().split('T')[0] : today;
      
      xml += `  <url>
    <loc>${SITE_ORIGIN}/${biz.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>`;

      // Add image if logo exists
      if (biz.logo) {
        const logoUrl = biz.logo.startsWith('http') ? biz.logo : `${SITE_ORIGIN}${biz.logo}`;
        xml += `
    <image:image>
      <image:loc>${escapeXml(logoUrl)}</image:loc>
      <image:title>${escapeXml(biz.businessName || 'Restaurante')}</image:title>
      <image:caption>Menú digital de ${escapeXml(biz.businessName || 'Restaurante')}</image:caption>
    </image:image>`;
      }
      
      xml += `
  </url>
`;
    }

    xml += `</urlset>`;

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml;charset=UTF-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=7200',
        'X-Robots-Tag': 'noindex' // Sitemaps shouldn't be indexed themselves
      }
    });
  } catch (error) {
    // Fallback to static sitemap
    return context.next();
  }
}

function escapeXml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
