import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MAP_ATTRIBUTION, MAP_TILE_URL } from '../../utils/mapTiles';
import { placesApi } from '../../services/repartoApi';

/**
 * Elegir un punto: se escribe la dirección (con sugerencias de Google) y se
 * ajusta el pin en el mapa. El pin manda: es lo que usa el domi para llegar,
 * y la dirección escrita va como referencia ("apto 301, timbre dañado").
 */
const pin = (color) => L.divIcon({
  className: '',
  html: `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,.3)"></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

function Clics({ alMarcar }) {
  useMapEvents({ click: (e) => alMarcar({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function Centrar({ punto }) {
  const map = useMap();
  useEffect(() => { if (punto) map.setView([punto.lat, punto.lng], Math.max(map.getZoom(), 16)); }, [punto?.lat, punto?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function SelectorPunto({ etiqueta, valor, alCambiar, color = '#E11D2A', centroInicial, prueba }) {
  const [texto, setTexto] = useState(valor?.direccion || '');
  const [sugerencias, setSugerencias] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const sesion = useMemo(() => Math.random().toString(36).slice(2), []);
  const esperar = useRef(null);
  const icono = useMemo(() => pin(color), [color]);
  const punto = valor?.ubicacion || null;

  useEffect(() => { setTexto(valor?.direccion || ''); }, [valor?.direccion]);

  const buscar = (t) => {
    setTexto(t);
    alCambiar({ ...valor, direccion: t });
    clearTimeout(esperar.current);
    if (t.trim().length < 4) { setSugerencias([]); return; }
    esperar.current = setTimeout(async () => {
      try {
        const { data } = await placesApi.get('/autocomplete', { params: { input: t, sessionToken: sesion } });
        setSugerencias(data.predictions || []);
        setAbierto(true);
      } catch { setSugerencias([]); }
    }, 300);
  };

  const elegir = async (s) => {
    setAbierto(false);
    setSugerencias([]);
    try {
      const { data } = await placesApi.get('/details', { params: { placeId: s.placeId, sessionToken: sesion } });
      const d = data.details || {};
      const direccion = d.address || s.description;
      setTexto(direccion);
      alCambiar({ ...valor, direccion, ubicacion: d.location || punto });
    } catch {
      setTexto(s.description);
      alCambiar({ ...valor, direccion: s.description });
    }
  };

  const miUbicacion = () => {
    navigator.geolocation?.getCurrentPosition(
      (p) => alCambiar({ ...valor, ubicacion: { lat: p.coords.latitude, lng: p.coords.longitude } }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const centro = punto || centroInicial || { lat: 4.711, lng: -74.0721 };

  return (
    <div className="space-y-2" data-testid={prueba}>
      {etiqueta && <p className="text-[13px] font-bold text-slate-700">{etiqueta}</p>}
      <div className="relative">
        <input
          value={texto}
          onChange={(e) => buscar(e.target.value)}
          onFocus={() => sugerencias.length && setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
          placeholder="Escribe la dirección (Calle 12 # 4-56, Chía)"
          className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-slate-400 outline-none text-[15px]"
          data-testid={prueba ? `${prueba}-direccion` : undefined}
        />
        {abierto && sugerencias.length > 0 && (
          <div className="absolute z-[1000] left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
            {sugerencias.slice(0, 5).map((s) => (
              <button key={s.placeId} type="button" onMouseDown={() => elegir(s)} className="w-full text-left px-4 py-2.5 hover:bg-slate-50">
                <p className="text-[14px] font-semibold text-slate-800">{s.mainText}</p>
                <p className="text-[12px] text-slate-400 truncate">{s.secondaryText}</p>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="relative h-52 rounded-xl overflow-hidden border-2 border-slate-200">
        <MapContainer center={[centro.lat, centro.lng]} zoom={punto ? 16 : 13} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer url={MAP_TILE_URL} attribution={MAP_ATTRIBUTION} />
          <Clics alMarcar={(u) => alCambiar({ ...valor, ubicacion: u })} />
          <Centrar punto={punto} />
          {punto && (
            <Marker
              position={[punto.lat, punto.lng]}
              icon={icono}
              draggable
              eventHandlers={{ dragend: (e) => { const ll = e.target.getLatLng(); alCambiar({ ...valor, ubicacion: { lat: ll.lat, lng: ll.lng } }); } }}
            />
          )}
        </MapContainer>
        <button type="button" onClick={miUbicacion} className="absolute z-[500] right-2 top-2 h-9 px-3 rounded-lg bg-white shadow text-[12px] font-bold text-slate-700">📍 Mi ubicación</button>
        {!punto && (
          <div className="absolute z-[500] inset-x-0 bottom-2 flex justify-center pointer-events-none">
            <span className="px-3 py-1.5 rounded-full bg-slate-900/85 text-white text-[12px] font-semibold">Toca el mapa para marcar el punto exacto</span>
          </div>
        )}
      </div>
    </div>
  );
}
