// Cloudflare Pages Function — dynamic manifest.json
// Serves at: https://menuby.tech/manifest?slug=mcdonalds&name=McDonalds
// iOS Safari requires a real HTTP URL for the manifest (blob: URLs don't work)

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const slug = url.searchParams.get('slug') || '';
  const name = url.searchParams.get('name') || 'MenuBy';
  const description = url.searchParams.get('desc') || 'Menú digital';
  const themeColor = url.searchParams.get('theme') || '#E31E24';
  const bgColor = url.searchParams.get('bg') || '#051C2C';
  const logo = url.searchParams.get('logo') || '';
  const origin = url.origin;

  const logoUrl = logo || `${origin}/logo.jpeg`;
  const logoType = logo ? 'image/png' : 'image/jpeg';
  const startUrl = slug ? `${origin}/${slug}` : `${origin}/`;

  const manifest = {
    name: name,
    short_name: name,
    description: description,
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
      { src: logoUrl, sizes: '192x192', type: logoType, purpose: 'any' },
      { src: logoUrl, sizes: '512x512', type: logoType, purpose: 'any' },
      { src: logoUrl, sizes: '192x192', type: logoType, purpose: 'maskable' },
      { src: logoUrl, sizes: '180x180', type: logoType, purpose: 'any' },
      { src: logoUrl, sizes: '152x152', type: logoType, purpose: 'any' },
      { src: logoUrl, sizes: '120x120', type: logoType, purpose: 'any' }
    ],
    shortcuts: slug ? [
      {
        name: 'Menú',
        short_name: 'Menú',
        url: startUrl,
        icons: [{ src: logoUrl, sizes: '96x96', type: logoType }]
      }
    ] : []
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
