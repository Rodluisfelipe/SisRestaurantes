import { MAP_HAS_TOKEN } from '../../utils/mapTiles';

/**
 * El punto de entrega en pequeño, como en Rappi: el cliente ve que su
 * dirección quedó donde es, y un toque lo lleva a ajustarla.
 *
 * Es una imagen, no un mapa interactivo: cargar Leaflet para mostrar un pin
 * costaba 45 KB y procesador en cada checkout. Con Mapbox es una sola imagen
 * estática; sin token (desarrollo local) se arma con 3×3 cuadros de OSM.
 */
const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';
const ZOOM = 16;

function cuadrosOsm(lat, lon) {
  const n = 2 ** ZOOM;
  const x = ((lon + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  // Desplazamiento (px) para que el punto quede en el centro del recuadro.
  return { tx, ty, dx: (x - tx) * 256, dy: (y - ty) * 256 };
}

export default function MapaPunto({ lat, lon, onAjustar, alto = 132, etiqueta = 'Ajustar punto de entrega' }) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;

  let fondo;
  if (MAP_HAS_TOKEN && TOKEN) {
    const url = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${lon},${lat},${ZOOM},0/600x${alto * 2}@2x?attribution=false&logo=false&access_token=${TOKEN}`;
    fondo = <img src={url} alt="" aria-hidden="true" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />;
  } else {
    const { tx, ty, dx, dy } = cuadrosOsm(lat, lon);
    const cuadros = [];
    for (let j = -1; j <= 1; j += 1) {
      for (let i = -1; i <= 1; i += 1) {
        cuadros.push(
          <img
            key={`${i}_${j}`}
            src={`https://tile.openstreetmap.org/${ZOOM}/${tx + i}/${ty + j}.png`}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="absolute w-64 h-64 max-w-none"
            style={{ left: `calc(50% + ${(i * 256) - dx}px)`, top: `calc(50% + ${(j * 256) - dy}px)` }}
          />,
        );
      }
    }
    fondo = <div className="absolute inset-0">{cuadros}</div>;
  }

  return (
    <button
      type="button"
      onClick={onAjustar}
      className="relative w-full overflow-hidden rounded-2xl bg-slate-100 border border-slate-200 block"
      style={{ height: alto }}
      aria-label={etiqueta}
    >
      {fondo}
      {/* El pin, con la punta en el centro exacto. */}
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full pointer-events-none">
        <svg width="34" height="42" viewBox="0 0 34 42" aria-hidden="true">
          <path d="M17 41s14-13.2 14-24A14 14 0 0 0 3 17c0 10.8 14 24 14 24z" fill="#0f172a" />
          <circle cx="17" cy="17" r="5.5" fill="#fff" />
        </svg>
      </span>
      <span className="absolute left-1/2 bottom-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-slate-800 shadow">
        {etiqueta}
      </span>
    </button>
  );
}
