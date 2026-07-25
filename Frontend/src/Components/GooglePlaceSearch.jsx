import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

/**
 * Buscador de negocios con Google Places (autocompletado).
 * Al seleccionar, obtiene los detalles y llama onSelect(details).
 *
 * Props:
 *  - onSelect(details): { placeId, name, address, phone, location, rating, reviewCount, mapsUrl, reviewUrl, businessHours }
 *  - placeholder, accentColor, autoFocus, className
 */
const newSessionToken = () =>
  (window.crypto?.randomUUID?.() || `st-${Date.now()}-${Math.random().toString(36).slice(2)}`);

const GooglePlaceSearch = ({
  onSelect,
  placeholder = 'Busca tu negocio en Google…',
  accentColor = '#E8002D',
  autoFocus = false,
  className = '',
  fetchDetails = true, // si false, onSelect recibe solo { placeId, name } (útil cuando el backend re-consulta)
}) => {
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false); // trayendo detalles
  const [configured, setConfigured] = useState(true);
  const sessionToken = useRef(newSessionToken());
  const boxRef = useRef(null);
  const debounceRef = useRef(null);

  // Cerrar al hacer click afuera
  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Autocompletado con debounce
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query || query.trim().length < 3) {
      setPredictions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/places/autocomplete', {
          params: { input: query.trim(), sessionToken: sessionToken.current },
        });
        if (res.data.configured === false) {
          setConfigured(false);
          setPredictions([]);
        } else {
          setPredictions(res.data.predictions || []);
          setOpen(true);
        }
      } catch {
        setPredictions([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handlePick = useCallback(async (pred) => {
    setOpen(false);
    setQuery(pred.mainText || pred.description);
    if (!fetchDetails) {
      onSelect?.({ placeId: pred.placeId, name: pred.mainText });
      sessionToken.current = newSessionToken();
      return;
    }
    setFetching(true);
    try {
      const res = await api.get('/places/details', {
        params: { placeId: pred.placeId, sessionToken: sessionToken.current },
      });
      if (res.data.details) onSelect?.(res.data.details);
    } catch {
      /* silencioso: el usuario puede llenar a mano */
    } finally {
      setFetching(false);
      // Nueva sesión para la próxima búsqueda (facturación Places)
      sessionToken.current = newSessionToken();
    }
  }, [onSelect, fetchDetails]);

  if (!configured) return null;

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          {fetching ? (
            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
            </svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
          )}
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => predictions.length && setOpen(true)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:border-transparent transition-colors text-gray-900 bg-white placeholder-gray-400 outline-none"
          style={{ '--tw-ring-color': `${accentColor}55` }}
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" /></svg>
          </span>
        )}
      </div>

      <AnimatePresence>
        {open && predictions.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute z-50 mt-2 w-full bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden max-h-72 overflow-y-auto"
          >
            {predictions.map((p) => (
              <li key={p.placeId}>
                <button
                  type="button"
                  onClick={() => handlePick(p)}
                  className="w-full flex items-start gap-3 px-3.5 py-2.5 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="mt-0.5 text-slate-400 flex-shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-800 truncate">{p.mainText}</span>
                    {p.secondaryText && <span className="block text-xs text-slate-400 truncate">{p.secondaryText}</span>}
                  </span>
                </button>
              </li>
            ))}
            <li className="px-3.5 py-1.5 text-[10px] text-slate-300 text-right border-t border-slate-50">powered by Google</li>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GooglePlaceSearch;
