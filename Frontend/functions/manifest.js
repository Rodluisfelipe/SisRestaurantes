// Cloudflare Pages Function — dynamic manifest.json
// Serves at: https://menuby.tech/manifest?slug=mcdonalds
// iOS Safari requires a real HTTP URL for the manifest (blob: URLs don't work)
//
// Con solo el slug basta: si no vienen nombre o logo, se piden al API. Antes,
// sin `name`, respondía "MenuBy" con el logo de MenuBy, y como el index.html
// pone de entrada un enlace con solo el slug, el celular guardaba el acceso
// directo a inicio con el nombre y el ícono de MenuBy en vez de los del negocio.

const API_BASE = 'https://api.menuby.tech/api';
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

// El tipo real según la extensión: declarar png para un .webp o .jpg hace que
// algunos navegadores descarten el ícono.
function tipoDeImagen(url) {
  const ext = (String(url).split('?')[0].split('.').pop() || '').toLowerCase();
  return { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', gif: 'image/gif' }[ext] || null;
}

async function negocioPorSlug(slug) {
  if (!slug || !/^[a-z0-9-]{2,60}$/i.test(slug)) return null;
  try {
    const res = await fetch(`${API_BASE}/business-config/by-slug/${slug}`, {
      headers: { Accept: 'application/json' },
      cf: { cacheTtl: 300 },
    });
    if (!res.ok) return null;
    const b = await res.json();
    return b && b._id ? b : null;
  } catch {
    return null;
  }
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const slug = url.searchParams.get('slug') || '';
  let name = url.searchParams.get('name') || '';
  let description = url.searchParams.get('desc') || '';
  let themeColor = url.searchParams.get('theme') || '';
  const bgColor = url.searchParams.get('bg') || '#ffffff';
  let logo = url.searchParams.get('logo') || '';
  const origin = url.origin;

  // Lo que falte, del negocio
  if (slug && (!name || !logo)) {
    const b = await negocioPorSlug(slug);
    if (b) {
      name = name || b.businessName || '';
      description = description || b.description || '';
      themeColor = themeColor || b.theme?.buttonColor || '';
      logo = logo || b.logo || '';
    }
  }
  if (logo && !/^https?:\/\//i.test(logo)) logo = API_ORIGIN + logo;

  name = name || 'MenuBy';
  description = description || 'Menú digital';
  themeColor = /^#[0-9a-fA-F]{6}$/.test(themeColor) ? themeColor : '#E31E24';

  const logoUrl = logo || `${origin}/logo.jpeg`;
  const tipo = logo ? tipoDeImagen(logoUrl) : 'image/jpeg';
  const icono = (sizes, purpose = 'any') => ({ src: logoUrl, sizes, ...(tipo ? { type: tipo } : {}), purpose });
  const startUrl = slug ? `${origin}/${slug}` : `${origin}/`;

  const manifest = {
    name,
    short_name: name,
    description,
    start_url: startUrl,
    scope: `${origin}/`,
    display: 'standalone',
    background_color: bgColor,
    theme_color: themeColor,
    orientation: 'portrait-primary',
    lang: 'es',
    id: startUrl,
    categories: ['business', 'food'],
    icons: [
      icono('192x192'),
      icono('512x512'),
      icono('192x192', 'maskable'),
      icono('180x180'),
    ],
    shortcuts: slug ? [
      { name: 'Menú', short_name: 'Menú', url: startUrl, icons: [{ src: logoUrl, sizes: '96x96', ...(tipo ? { type: tipo } : {}) }] },
    ] : [],
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
