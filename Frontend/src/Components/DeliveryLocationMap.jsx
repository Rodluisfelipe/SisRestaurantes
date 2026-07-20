import { useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MAP_TILE_URL, MAP_ATTRIBUTION } from '../utils/mapTiles';

export default function DeliveryLocationMap({ lat, lon, address }) {
  const [copied, setCopied] = useState(false);
  const mapsUrl = `https://maps.google.com/?q=${lat},${lon}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mapsUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('Copia este enlace:', mapsUrl);
    }
  };

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 bg-white">
      {/* Mini map */}
      <div className="relative" style={{ height: 160 }}>
        <MapContainer
          center={[lat, lon]}
          zoom={16}
          scrollWheelZoom={false}
          dragging={false}
          zoomControl={false}
          attributionControl={false}
          doubleClickZoom={false}
          keyboard={false}
          touchZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer url={MAP_TILE_URL} attribution={MAP_ATTRIBUTION} />
        </MapContainer>

        {/* Center pin overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
          <div style={{ marginTop: -22 }}>
            <svg width="36" height="46" viewBox="0 0 44 56" fill="none">
              <path d="M22 0C9.85 0 0 9.85 0 22C0 38.5 22 56 22 56C22 56 44 38.5 44 22C44 9.85 34.15 0 22 0Z" fill="#EF4444"/>
              <circle cx="22" cy="21" r="10" fill="white" fillOpacity="0.95"/>
              <circle cx="22" cy="21" r="4" fill="#EF4444"/>
            </svg>
          </div>
        </div>

        {/* Dim overlay to signal non-interactive */}
        <div className="absolute inset-0 pointer-events-none z-[999]" style={{ background: 'transparent' }} />
      </div>

      {/* Bottom action bar */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-slate-100">
        <div className="flex-1 min-w-0">
          {address && (
            <p className="text-[12px] text-slate-700 font-medium leading-snug line-clamp-1">{address}</p>
          )}
          <p className="text-[10px] text-slate-400 font-mono tabular-nums mt-0.5">
            {lat.toFixed(5)}, {lon.toFixed(5)}
          </p>
        </div>

        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-[11px] font-semibold transition-colors shrink-0 active:scale-[0.97]"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
          Maps
        </a>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded-lg text-[11px] font-semibold transition-colors shrink-0 active:scale-[0.97]"
          title="Compartir ubicación"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-emerald-600">Copiado</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Compartir
            </>
          )}
        </button>
      </div>
    </div>
  );
}
