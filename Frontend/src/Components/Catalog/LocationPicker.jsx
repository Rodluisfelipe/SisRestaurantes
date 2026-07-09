import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSavedAddresses } from '../../hooks/useSavedAddresses';
import MapPicker from './MapPicker';

export default function LocationPicker({ open, onClose, onSelect, currentAddress, currentCoords }) {
  const { addresses, addAddress, removeAddress } = useSavedAddresses();
  const [query, setQuery] = useState('');
  const [showMap, setShowMap] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery(currentAddress || '');
      setShowMap(false);
      setTimeout(() => inputRef.current?.focus(), 350);
    }
  }, [open]);

  const handleGoToMap = () => {
    if (!query.trim()) return;
    setShowMap(true);
  };

  const handleSavedSelect = (saved) => {
    onSelect(saved.coords, saved.address, saved.city);
    onClose();
  };

  // MapPicker confirma: usamos la dirección que el cliente escribió (no la del geocodificador)
  const handleMapConfirm = (coords, _geocodedAddr, city, label) => {
    const finalAddress = query.trim();
    if (label) addAddress(finalAddress, coords, city, label);
    onSelect(coords, finalAddress, city);
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
                  <p className="text-[12px] text-gray-400 mt-0.5">Escribe tu dirección tal como la conoces</p>
                </div>
                <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors flex-shrink-0">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="overflow-y-auto flex-1 px-5 pb-4 space-y-4">

                {/* ── Dirección manual (sin autocomplete) ── */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-extrabold flex items-center justify-center flex-shrink-0">1</div>
                    <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">Escribe tu dirección</p>
                  </div>

                  <div className="relative">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    <input
                      ref={inputRef}
                      type="text"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && query.trim()) handleGoToMap(); }}
                      placeholder="Ej: Cra 6 #3-139, Cajicá"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      className="w-full pl-10 pr-10 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-2xl text-[14px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0 focus:border-red-300 transition-all"
                    />
                    {query ? (
                      <button
                        onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center"
                      >
                        <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    ) : null}
                  </div>

                  <p className="text-[11px] text-gray-400 ml-1 leading-relaxed">
                    Escribe exactamente como conoces tu dirección — no usamos sugerencias automáticas que pueden estar desactualizadas.
                  </p>
                </div>

                {/* ── Botón "Ir al mapa" (aparece al escribir) ── */}
                <AnimatePresence>
                  {query.trim() && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                      transition={{ type: 'spring', damping: 24, stiffness: 300 }}
                    >
                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="w-5 h-5 rounded-full bg-gray-300 text-white text-[10px] font-extrabold flex items-center justify-center flex-shrink-0">2</div>
                        <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wide">Ubica el pin en el mapa</p>
                      </div>
                      <button
                        onClick={handleGoToMap}
                        className="w-full flex items-center gap-3.5 p-4 bg-red-500 rounded-2xl hover:bg-red-600 active:scale-[0.98] transition-all shadow-lg shadow-red-500/25"
                      >
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                          </svg>
                        </div>
                        <div className="text-left flex-1">
                          <p className="text-[14px] font-bold text-white">Ubicar en el mapa</p>
                          <p className="text-[12px] text-white/70 mt-0.5">Pon el pin en la entrada exacta</p>
                        </div>
                        <svg className="w-5 h-5 text-white/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── Direcciones guardadas ── */}
                {addresses.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
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

      {/* Paso 2: Mapa para afinar el pin */}
      <MapPicker
        open={showMap}
        onClose={() => setShowMap(false)}
        initialCoords={null}
        initialAddress={query}
        onConfirm={handleMapConfirm}
      />
    </>
  );
}
