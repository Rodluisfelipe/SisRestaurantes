import { useState, useRef, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';

const BOGOTA = { lat: 4.711, lng: -74.0721 };
const LABEL_OPTIONS = [
  { key: 'Casa', emoji: '🏠' },
  { key: 'Trabajo', emoji: '🏢' },
  { key: 'Otro', emoji: '📍' },
];

function MoveHandler({ onMoveStart, onMoveEnd }) {
  useMapEvents({
    movestart: () => onMoveStart(),
    moveend: (e) => {
      const c = e.target.getCenter();
      onMoveEnd(c.lat, c.lng);
    },
  });
  return null;
}

// Expone la instancia del mapa sin usarla en deps de useEffect del padre
function MapController({ onReadyRef }) {
  const map = useMap();
  useEffect(() => {
    onReadyRef.current?.(map);
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function MapPicker({ open, onClose, onConfirm, initialCoords, initialAddress }) {
  const startCenter = initialCoords || BOGOTA;
  const [coords, setCoords] = useState(startCenter);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [moving, setMoving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Guardar dirección
  const [wantSave, setWantSave] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');

  const debounceRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const onReadyRef = useRef(null);

  // ¿Viene del paso 1? Si es así, la dirección ya está escrita y no la sobreescribimos
  const fromStep1 = !!initialAddress;

  // Geocodificación inversa (solo se usa cuando el mapa abre sin dirección previa)
  const doReverseGeocode = useCallback(async (lat, lng) => {
    setLoading(true);
    try {
      const res = await api.get(`/delivery-zones/reverse-geocode?lat=${lat}&lon=${lng}`);
      const r = res.data?.result;
      if (r) {
        setAddress(r.displayName || '');
        setCity(r.address?.city || r.address?.town || r.address?.village || r.address?.municipality || '');
      }
    } catch {
      setAddress('');
    } finally {
      setLoading(false);
    }
  }, []);

  // Intenta ubicar al usuario con GPS y vuela el mapa ahí
  const doGPSLocate = useCallback((silent = false) => {
    if (!navigator.geolocation) return;
    if (!silent) setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        mapInstanceRef.current?.flyTo([lat, lng], 17, { animate: true, duration: 1.2 });
        setCoords({ lat, lng });
        setHasMoved(true);
        setGpsLoading(false);
      },
      () => { setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // Callback que se llama cuando el mapa está listo (MapController → onReadyRef)
  onReadyRef.current = (mapInstance) => {
    mapInstanceRef.current = mapInstance;
    // Auto-localizar cuando no hay coordenadas iniciales (viene de dirección manual)
    if (!initialCoords) {
      doGPSLocate(true);
    }
  };

  useEffect(() => {
    if (open) {
      setMapKey(k => k + 1);
      setHasMoved(false);
      setWantSave(false);
      setSaveLabel('');
      setGpsLoading(false);
      const c = initialCoords || BOGOTA;
      setCoords(c);

      if (fromStep1) {
        // Dirección escrita por el cliente — no la reemplazamos nunca
        setAddress(initialAddress);
        setCity('');
        setLoading(false);
      } else {
        setAddress('');
        setCity('');
        doReverseGeocode(c.lat, c.lng ?? c.lon ?? BOGOTA.lng);
      }
    }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMoveStart = () => {
    setMoving(true);
    setHasMoved(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!fromStep1) setAddress('');
  };

  const handleMoveEnd = (lat, lng) => {
    setMoving(false);
    setCoords({ lat, lng });
    if (!fromStep1) {
      debounceRef.current = setTimeout(() => doReverseGeocode(lat, lng), 600);
    }
  };

  const handleConfirm = () => {
    if (!address || loading || moving) return;
    onConfirm(
      { lat: coords.lat, lng: coords.lng, lon: coords.lng },
      address,
      city,
      wantSave ? (saveLabel || 'Mi dirección') : null
    );
  };

  const isReady = !moving && !!address && (fromStep1 || !loading);

  const zoom = initialCoords ? 16 : 13;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          className="fixed inset-0 z-[60] flex flex-col bg-white"
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 bg-white border-b border-gray-100 flex-shrink-0"
            style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0.75rem))', paddingBottom: '0.75rem' }}
          >
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-[16px] font-extrabold text-gray-900 tracking-tight">Ubica el pin en tu dirección</h2>
              {initialAddress && (
                <p className="text-[11px] text-red-500 font-semibold truncate mt-0.5">{initialAddress}</p>
              )}
            </div>
          </div>

          {/* Mapa */}
          <div className="flex-1 relative overflow-hidden">
            <MapContainer
              key={mapKey}
              center={[startCenter.lat, startCenter.lng ?? startCenter.lon ?? BOGOTA.lng]}
              zoom={zoom}
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
              attributionControl={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MoveHandler onMoveStart={handleMoveStart} onMoveEnd={handleMoveEnd} />
              <MapController onReadyRef={onReadyRef} />
            </MapContainer>

            {/* Chip de instrucción */}
            <div className="absolute top-4 inset-x-0 flex justify-center pointer-events-none z-[1000]">
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl px-4 py-2 shadow-lg shadow-black/10 flex items-center gap-2">
                {hasMoved ? (
                  <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                )}
                <p className="text-[12px] font-semibold text-gray-700">
                  {hasMoved ? 'Listo — confirma la ubicación abajo' : 'Mueve el mapa hasta tu punto exacto'}
                </p>
              </div>
            </div>

            {/* Botón GPS flotante — actualiza la vista a la ubicación real del usuario */}
            <button
              onClick={() => doGPSLocate(false)}
              disabled={gpsLoading}
              className="absolute bottom-5 right-4 z-[1001] bg-white rounded-full shadow-xl shadow-black/20 border border-gray-100 flex items-center gap-2.5 pl-3 pr-4 py-2.5 hover:bg-gray-50 active:scale-95 transition-all"
              title="Ir a mi ubicación actual"
            >
              {gpsLoading ? (
                <div className="w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              ) : (
                <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <circle cx="12" cy="12" r="8" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                  <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
                </svg>
              )}
              <span className="text-[12px] font-bold text-gray-700 whitespace-nowrap">
                {gpsLoading ? 'Localizando...' : 'Mi ubicación'}
              </span>
            </button>

            {/* Pin fijo en el centro */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
              <div className={`relative transition-transform duration-200 ease-out ${moving ? '-translate-y-5' : '-translate-y-1'}`}>
                <div className={`absolute left-1/2 -translate-x-1/2 rounded-full bg-black/20 blur-md transition-all duration-200 ${moving ? 'w-3 h-1.5 bottom-[-20px]' : 'w-6 h-2.5 bottom-[-5px]'}`} />
                <svg width="44" height="56" viewBox="0 0 44 56" fill="none">
                  <path d="M22 0C9.85 0 0 9.85 0 22C0 38.5 22 56 22 56C22 56 44 38.5 44 22C44 9.85 34.15 0 22 0Z" fill="#EF4444"/>
                  <circle cx="22" cy="21" r="10" fill="white" fillOpacity="0.95"/>
                  <circle cx="22" cy="21" r="4" fill="#EF4444"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Barra inferior */}
          <div
            className="bg-white px-4 pt-4 flex-shrink-0 shadow-[0_-8px_32px_rgba(0,0,0,0.09)]"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))' }}
          >
            {/* Vista previa de dirección */}
            <div className="flex items-start gap-3 mb-4">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${address ? 'bg-red-50' : 'bg-gray-100'}`}>
                <svg className={`w-4 h-4 transition-colors ${address ? 'text-red-500' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                {address && (
                  <p className="text-[13px] text-gray-800 leading-snug line-clamp-2 font-medium">{address}</p>
                )}
                <p className={`text-[11px] mt-0.5 font-medium transition-colors ${moving ? 'text-amber-500' : hasMoved ? 'text-green-600' : 'text-gray-400'}`}>
                  {moving
                    ? 'Ajustando coordenadas...'
                    : hasMoved
                      ? `📍 ${coords.lat.toFixed(5)}, ${(coords.lng ?? coords.lon ?? BOGOTA.lng).toFixed(5)}`
                      : fromStep1
                        ? 'Mueve el mapa al punto exacto o usa "Mi ubicación"'
                        : loading
                          ? 'Buscando dirección...'
                          : 'Mueve el mapa para seleccionar tu punto'}
                </p>
              </div>
            </div>

            {/* Toggle guardar */}
            {isReady && (
              <div className="mb-3">
                <button
                  onClick={() => { setWantSave(v => !v); setSaveLabel(''); }}
                  className="flex items-center gap-2 text-[13px] text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${wantSave ? 'bg-red-500 border-red-500' : 'border-gray-300'}`}>
                    {wantSave && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="font-semibold">Guardar esta dirección</span>
                </button>

                <AnimatePresence>
                  {wantSave && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex gap-2 mt-2.5">
                        {LABEL_OPTIONS.map(l => (
                          <button key={l.key} onClick={() => setSaveLabel(l.key)}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all flex-1 justify-center ${saveLabel === l.key ? 'bg-red-500 text-white shadow-md shadow-red-500/25' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                            <span>{l.emoji}</span>
                            <span>{l.key}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <button
              onClick={handleConfirm}
              disabled={!isReady}
              className="w-full py-3.5 bg-red-500 text-white text-[15px] font-bold rounded-2xl shadow-lg shadow-red-500/25 hover:bg-red-600 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              {wantSave && saveLabel
                ? `Guardar como "${saveLabel}" y confirmar`
                : 'Confirmar ubicación'}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
