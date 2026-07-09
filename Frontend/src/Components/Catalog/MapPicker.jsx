import { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';

const BOGOTA = { lat: 4.711, lng: -74.0721 };

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

export default function MapPicker({ open, onClose, onSelect, initialCoords }) {
  const startCenter = initialCoords || BOGOTA;
  const [coords, setCoords] = useState(startCenter);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [moving, setMoving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (open) {
      setMapKey(k => k + 1);
      setAddress('');
      setCity('');
      const c = initialCoords || BOGOTA;
      setCoords(c);
      doReverseGeocode(c.lat, c.lng ?? c.lon);
    }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [open]);

  const doReverseGeocode = async (lat, lng) => {
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
  };

  const handleMoveStart = () => {
    setMoving(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setAddress('');
  };

  const handleMoveEnd = (lat, lng) => {
    setMoving(false);
    setCoords({ lat, lng });
    debounceRef.current = setTimeout(() => doReverseGeocode(lat, lng), 600);
  };

  const handleConfirm = () => {
    if (!address && !loading) return;
    onSelect({ lat: coords.lat, lng: coords.lng, lon: coords.lng }, address, city);
    onClose();
  };

  const isReady = !moving && !loading && !!address;

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
            className="flex items-center gap-3 px-4 bg-white border-b border-gray-100 flex-shrink-0 z-10"
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
            <h2 className="text-[16px] font-bold text-gray-900">Seleccionar en el mapa</h2>
          </div>

          {/* Map area */}
          <div className="flex-1 relative overflow-hidden">
            <MapContainer
              key={mapKey}
              center={[startCenter.lat, startCenter.lng ?? startCenter.lon ?? -74.0721]}
              zoom={15}
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
              attributionControl={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MoveHandler onMoveStart={handleMoveStart} onMoveEnd={handleMoveEnd} />
            </MapContainer>

            {/* Instruction chip */}
            <div className="absolute top-4 inset-x-0 flex justify-center pointer-events-none z-[1000]">
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl px-4 py-2 shadow-lg shadow-black/10">
                <p className="text-[12px] font-semibold text-gray-700">Mueve el mapa para ajustar la ubicación</p>
              </div>
            </div>

            {/* Fixed center pin */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
              {/* Offset the pin upward so the needle tip sits at map center */}
              <div className={`relative transition-transform duration-200 ease-out ${moving ? '-translate-y-5' : '-translate-y-1'}`}>
                {/* Shadow on map — shrinks when pin lifts */}
                <div
                  className={`absolute left-1/2 -translate-x-1/2 rounded-full bg-black/25 blur-md transition-all duration-200 ${
                    moving ? 'w-4 h-2 bottom-[-18px]' : 'w-7 h-3 bottom-[-4px]'
                  }`}
                />
                {/* Pin teardrop */}
                <svg width="44" height="56" viewBox="0 0 44 56" fill="none">
                  <path d="M22 0C9.85 0 0 9.85 0 22C0 38.5 22 56 22 56C22 56 44 38.5 44 22C44 9.85 34.15 0 22 0Z" fill="#EF4444"/>
                  <circle cx="22" cy="21" r="9" fill="white" fillOpacity="0.9"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div
            className="bg-white px-4 pt-4 flex-shrink-0 shadow-[0_-8px_32px_rgba(0,0,0,0.09)]"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))' }}
          >
            {/* Address preview */}
            <div className="flex items-start gap-3 mb-4 min-h-[48px]">
              <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1 min-w-0 pt-1">
                {moving ? (
                  <p className="text-[13px] text-gray-400 font-medium">Ajustando ubicación...</p>
                ) : loading ? (
                  <div className="space-y-2">
                    <div className="h-3.5 bg-gray-100 rounded-lg animate-pulse w-4/5" />
                    <div className="h-3 bg-gray-100 rounded-lg animate-pulse w-1/2" />
                  </div>
                ) : address ? (
                  <p className="text-[13px] text-gray-800 leading-snug line-clamp-3">{address}</p>
                ) : (
                  <p className="text-[13px] text-gray-400">Mueve el mapa para seleccionar</p>
                )}
              </div>
            </div>

            <button
              onClick={handleConfirm}
              disabled={!isReady}
              className="w-full py-3.5 bg-red-500 text-white text-[15px] font-bold rounded-2xl shadow-lg shadow-red-500/25 hover:bg-red-600 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              Confirmar ubicación
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
