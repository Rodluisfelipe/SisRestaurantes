import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { useSavedAddresses } from '../../hooks/useSavedAddresses';
import MapPicker from './MapPicker';

export default function LocationPicker({ open, onClose, onSelect, onRequestGPS, currentAddress, currentCoords }) {
  const { addresses, addAddress, removeAddress } = useSavedAddresses();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Map picker state
  const [showMap, setShowMap] = useState(false);
  const [mapInitialCoords, setMapInitialCoords] = useState(null);
  const [mapInitialAddress, setMapInitialAddress] = useState('');

  const timerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setShowMap(false);
      setMapInitialCoords(null);
      setMapInitialAddress('');
      setTimeout(() => inputRef.current?.focus(), 350);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [open]);

  // Debounced geocode search
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query || query.length < 4) { setResults([]); return; }
    setSearching(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await api.post('/delivery-zones/geocode', { address: query, country: 'CO' });
        setResults(res.data?.results?.slice(0, 5) || []);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 500);
  }, [query]);

  // Paso 1 → Paso 2: al seleccionar resultado abre mapa centrado ahí
  const handleSelectResult = (r) => {
    const coords = { lat: r.lat, lng: r.lon, lon: r.lon };
    setMapInitialCoords(coords);
    setMapInitialAddress(r.displayName || r.display_name || '');
    setResults([]);
    setShowMap(true);
  };

  const handleGPS = () => {
    setGpsLoading(true);
    onRequestGPS();
    setTimeout(() => { setGpsLoading(false); onClose(); }, 800);
  };

  const handleSavedSelect = (saved) => {
    onSelect(saved.coords, saved.address, saved.city);
    onClose();
  };

  // Confirmación desde el mapa
  const handleMapConfirm = (coords, addr, city, label) => {
    if (label) addAddress(addr, coords, city, label);
    onSelect(coords, addr, city);
    onClose();
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 z-50 backdrop-blur-[2px]"
              onClick={onClose}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl max-h-[90vh] flex flex-col shadow-2xl"
              style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))' }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-9 h-1 bg-gray-200 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-2 pb-4 flex-shrink-0">
                <div>
                  <h2 className="text-[17px] font-extrabold text-gray-900 tracking-tight">¿Dónde entregamos?</h2>
                  <p className="text-[12px] text-gray-400 mt-0.5">Busca tu dirección o usa el GPS</p>
                </div>
                <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors flex-shrink-0">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="overflow-y-auto flex-1 px-5 pb-2 space-y-4">

                {/* ── Paso 1: Busca tu dirección ── */}
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-extrabold flex items-center justify-center flex-shrink-0">1</div>
                    <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">Busca tu dirección</p>
                  </div>
                  <div className="relative">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      ref={inputRef}
                      type="text"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="Ej: Calle 100 #15-20, Bogotá"
                      className="w-full pl-10 pr-10 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-2xl text-[14px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0 focus:border-red-300 transition-all"
                    />
                    {searching && (
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    {query && !searching && (
                      <button onClick={() => { setQuery(''); setResults([]); }}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center">
                        <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Hint below search */}
                  {!results.length && !searching && (
                    <p className="text-[11px] text-gray-400 mt-2 ml-1">
                      Al seleccionar un resultado podrás afinar el pin exacto en el mapa
                    </p>
                  )}

                  {/* Geocode results */}
                  <AnimatePresence>
                    {results.length > 0 && (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                        className="mt-2 bg-white border-2 border-gray-100 rounded-2xl overflow-hidden shadow-lg">
                        {results.map((r, i) => (
                          <button key={i} onClick={() => handleSelectResult(r)}
                            className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-red-50 active:bg-red-100 transition-colors border-b border-gray-50 last:border-0">
                            <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                              <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] text-gray-800 font-medium leading-tight line-clamp-2">{r.displayName || r.display_name}</p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0 text-[11px] font-semibold text-red-500 bg-red-50 px-2 py-1 rounded-lg">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                              </svg>
                              Afinar
                            </div>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-[11px] font-semibold text-gray-400">o también</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>

                {/* GPS button */}
                <button onClick={handleGPS} disabled={gpsLoading}
                  className="w-full flex items-center gap-3.5 p-4 bg-red-50 border-2 border-red-100 rounded-2xl hover:bg-red-100 active:scale-[0.98] transition-all">
                  <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-red-500/30">
                    {gpsLoading
                      ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                    }
                  </div>
                  <div className="text-left">
                    <p className="text-[14px] font-bold text-gray-900">Usar mi ubicación actual</p>
                    <p className="text-[12px] text-gray-500">Detectar automáticamente con GPS</p>
                  </div>
                </button>

                {/* Direct map button */}
                <button onClick={() => { setMapInitialCoords(currentCoords || null); setMapInitialAddress(''); setShowMap(true); }}
                  className="w-full flex items-center gap-3.5 p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl hover:bg-gray-100 active:scale-[0.98] transition-all">
                  <div className="w-10 h-10 rounded-xl bg-gray-700 flex items-center justify-center flex-shrink-0 shadow-md shadow-black/10">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-[14px] font-bold text-gray-900">Ir directo al mapa</p>
                    <p className="text-[12px] text-gray-500">Mueve el mapa hasta tu dirección exacta</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Saved addresses */}
                {addresses.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-[10px] font-extrabold flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                      </div>
                      <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wide">Guardadas</p>
                    </div>
                    <div className="space-y-2">
                      {addresses.map(saved => {
                        const isCurrent = saved.address === currentAddress;
                        return (
                          <div key={saved.id} className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${isCurrent ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-transparent hover:border-gray-200'}`}>
                            <button onClick={() => handleSavedSelect(saved)} className="flex items-center gap-3 flex-1 text-left">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isCurrent ? 'bg-red-500 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
                                <span className="text-base">{saved.label === 'Casa' ? '🏠' : saved.label === 'Trabajo' ? '🏢' : '📍'}</span>
                              </div>
                              <div className="min-w-0">
                                <p className={`text-[13px] font-bold truncate ${isCurrent ? 'text-red-600' : 'text-gray-800'}`}>{saved.label || 'Dirección'}</p>
                                <p className="text-[11px] text-gray-400 truncate">{saved.address}</p>
                              </div>
                            </button>
                            <button onClick={() => removeAddress(saved.id)} className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 hover:bg-red-50 hover:border-red-200 transition-colors">
                              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Paso 2: Mapa para afinar la ubicación */}
      <MapPicker
        open={showMap}
        onClose={() => setShowMap(false)}
        initialCoords={mapInitialCoords}
        initialAddress={mapInitialAddress}
        onConfirm={handleMapConfirm}
      />
    </>
  );
}
