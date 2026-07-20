// Proveedor de tiles centralizado para TODOS los mapas (Leaflet).
// Cambiar de proveedor (Mapbox / MapTiler / Stadia / OSM) = editar SOLO este archivo.
//
// Usa Mapbox si hay VITE_MAPBOX_TOKEN; si no, cae a OpenStreetMap (p.ej. dev local
// sin token). El token público debe estar restringido por URL en el dashboard de
// Mapbox (menuby.tech) y con alertas de uso configuradas.

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

export const MAP_HAS_TOKEN = !!MAPBOX_TOKEN;

// Tiles 256@2x → drop-in del esquema {z}/{x}/{y} de Leaflet, en retina (crisp).
export const MAP_TILE_URL = MAPBOX_TOKEN
  ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`
  : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

// Atribución (requisito de términos de Mapbox cuando se usan sus tiles).
export const MAP_ATTRIBUTION = MAPBOX_TOKEN
  ? '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
