import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

/**
 * DeliveryZoneSelector — Fallback UI when GPS fails / is denied.
 * Shows available delivery zone cards so the client can manually pick one.
 * Also offers an "auto-detect by address" option using the geocode endpoint.
 * 
 * Props:
 *   businessId   – Business ObjectId or slug
 *   address      – Current address the client typed (for geocode attempt)
 *   cart         – Cart array (to calculate orderTotal for minimumOrder validation)
 *   theme        – { buttonColor, buttonTextColor }
 *   onZoneSelect – callback({ fee, zoneInfo }) when a zone is chosen
 *   onRetryGPS   – callback to retry GPS detection
 *   compact      – (boolean) condensed layout for inline/small views
 */
function DeliveryZoneSelector({ businessId, address, cart, theme, onZoneSelect, onRetryGPS, compact = false }) {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeAttempted, setGeocodeAttempted] = useState(false);

  const btnColor = theme?.buttonColor || '#3B82F6';
  const btnTextColor = theme?.buttonTextColor || '#ffffff';

  const orderTotal = cart?.reduce((sum, item) => {
    const price = parseFloat(item.finalPrice || item.price || 0);
    const qty = parseInt(item.quantity || 0);
    let toppingSum = 0;
    if (item.selectedToppings?.length) {
      toppingSum = item.selectedToppings.reduce((ts, t) => {
        let tp = parseFloat(t.basePrice || 0) + parseFloat(t.price || 0);
        if (t.subGroups?.length) tp += t.subGroups.reduce((s, si) => s + parseFloat(si.price || 0), 0);
        return ts + tp;
      }, 0);
    }
    return sum + (price + toppingSum) * qty;
  }, 0) || 0;

  // Fetch public zones on mount
  useEffect(() => {
    const fetchZones = async () => {
      try {
        setLoading(true);
        const res = await api.get('/delivery-zones/public', { params: { businessId } });
        if (res.data?.success) {
          setZones(res.data.zones || []);
        }
      } catch (err) {
        console.error('Error fetching delivery zones:', err);
        setError('No se pudieron cargar las zonas de entrega');
      } finally {
        setLoading(false);
      }
    };
    if (businessId) fetchZones();
  }, [businessId]);

  // Auto-attempt geocode from typed address on mount
  useEffect(() => {
    if (address && address.trim().length >= 5 && !geocodeAttempted) {
      attemptGeocodeAddress(address.trim());
    }
  }, [address]); // eslint-disable-line react-hooks/exhaustive-deps

  const attemptGeocodeAddress = async (addr) => {
    if (!addr || addr.length < 5) return;
    setGeocoding(true);
    setGeocodeAttempted(true);
    try {
      // 1) Geocode the address to get coordinates
      const geoRes = await api.post('/delivery-zones/geocode', { address: addr, country: 'CO' });
      const results = geoRes.data?.results;
      
      if (results?.length > 0) {
        const { lat, lon } = results[0];
        
        // 2) Check coverage with those coordinates
        const covRes = await api.post('/delivery-zones/check-coverage', {
          businessId,
          lat,
          lon,
          orderTotal
        });
        
        const isValid = covRes.data?.valid && covRes.data?.coverage?.covered;
        if (isValid) {
          const { delivery, zone } = covRes.data.coverage;
          onZoneSelect({
            fee: delivery.price,
            zoneInfo: {
              zoneName: zone.name,
              estimatedTime: delivery.estimatedTime,
              distance: delivery.distance,
              coordinates: { lat, lon },
              manualSelection: false
            }
          });
          return; // Successfully resolved via geocode
        }
      }
    } catch (err) {
      console.log('Geocode fallback failed, showing zone cards:', err.message);
    } finally {
      setGeocoding(false);
    }
  };

  const handleSelectZone = (zone) => {
    // Validate minimum order
    if (zone.pricing.minimumOrder > 0 && orderTotal < zone.pricing.minimumOrder) {
      return; // Button will be disabled — this is just a safeguard
    }
    
    setSelectedZoneId(zone.id);
    onZoneSelect({
      fee: zone.pricing.displayPrice,
      zoneInfo: {
        zoneName: zone.name,
        estimatedTime: zone.estimatedTime,
        distance: null,
        coordinates: null,
        manualSelection: true
      }
    });
  };

  // Loading state
  if (loading || geocoding) {
    return (
      <div className={compact ? "p-2 bg-slate-50 border border-slate-200 rounded-xl" : "mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl"}>
        <div className="flex items-center justify-center gap-2">
          <span className={`${compact ? '' : ''} inline-block`}>
            <svg className={compact ? 'w-4 h-4 animate-spin text-slate-500' : 'w-5 h-5 animate-spin text-slate-500'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/></svg>
          </span>
          <p className={`${compact ? 'text-[11px]' : 'text-sm'} text-slate-600 font-medium`}>
            {geocoding ? 'Buscando tu dirección...' : 'Cargando zonas...'}
          </p>
        </div>
      </div>
    );
  }

  // Error or no zones
  if (error || zones.length === 0) {
    return (
      <div className={compact ? "p-2 bg-amber-50 border border-amber-200 rounded-xl" : "mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl"}>
        <div className="flex items-center gap-2">
          <span className="text-amber-500">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </span>
          <p className="text-[11px] text-amber-800 font-medium">
            {error || 'Sin zonas configuradas. El costo será confirmado.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-1.5" : "mt-3 space-y-2"}>
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <span className={`text-slate-500 ${compact ? '' : ''}`}>
          <svg className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
        </span>
        <p className={`${compact ? 'text-[10px]' : 'text-xs'} font-semibold text-slate-700`}>Selecciona tu zona de entrega</p>
      </div>

      {/* Zone Cards */}
      <div className={compact ? "space-y-1" : "space-y-2"}>
        <AnimatePresence>
          {zones.map((zone, index) => {
            const isSelected = selectedZoneId === zone.id;
            const meetsMinimum = zone.pricing.minimumOrder <= 0 || orderTotal >= zone.pricing.minimumOrder;
            const belowMinimum = !meetsMinimum;

            return (
              <motion.button
                key={zone.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06, duration: 0.2 }}
                onClick={() => meetsMinimum && handleSelectZone(zone)}
                disabled={belowMinimum}
                className={`w-full text-left rounded-xl border-2 ${compact ? 'p-2' : 'p-3'} transition-all duration-200 ${
                  isSelected 
                    ? 'shadow-md scale-[1.01]' 
                    : belowMinimum
                      ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm active:scale-[0.99]'
                }`}
                style={isSelected ? {
                  borderColor: btnColor,
                  backgroundColor: `${btnColor}08`,
                } : {}}
              >
                <div className="flex items-center justify-between">
                  {/* Left: zone info */}
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    {/* Color indicator */}
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-offset-1"
                      style={{ 
                        backgroundColor: zone.color || '#3B82F6',
                        ringColor: isSelected ? btnColor : 'transparent'
                      }}
                    />
                    
                    <div className="flex-1 min-w-0">
                      <p className={`${compact ? 'text-xs' : 'text-sm'} font-semibold truncate ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                        {zone.name}
                      </p>
                      
                      {!compact && (
                      <div className="flex items-center gap-2 mt-0.5">
                        {/* Estimated time */}
                        <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                          <svg className="w-3 h-3 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                          {zone.estimatedTime.min}-{zone.estimatedTime.max} min
                        </span>
                        
                        {/* Minimum order warning */}
                        {belowMinimum && (
                          <span className="text-[10px] text-red-500 font-medium">
                            Mín: ${zone.pricing.minimumOrder.toLocaleString('es-CO')}
                          </span>
                        )}

                        {/* Description if exists */}
                        {zone.description && !belowMinimum && (
                          <span className="text-[10px] text-slate-400 truncate">
                            {zone.description}
                          </span>
                        )}
                      </div>
                      )}
                    </div>
                  </div>

                  {/* Right: price */}
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <div className="text-right">
                      <p className={`${compact ? 'text-xs' : 'text-sm'} font-bold ${isSelected ? '' : 'text-slate-800'}`}
                        style={isSelected ? { color: btnColor } : {}}
                      >
                        {zone.pricing.priceLabel}
                      </p>
                      {zone.pricing.mode !== 'fixed' && (
                        <p className="text-[9px] text-slate-400 uppercase tracking-wide">
                          {zone.pricing.mode === 'distance' ? 'aprox.' : 'rango'}
                        </p>
                      )}
                    </div>

                    {/* Check icon when selected */}
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: btnColor }}
                      >
                        <svg className="w-3 h-3" fill="none" stroke={btnTextColor} strokeWidth={3} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Footer: retry GPS + info */}
      <div className="flex items-center justify-between px-1 pt-1">
        <button
          type="button"
          onClick={onRetryGPS}
          className="text-[10px] font-medium underline underline-offset-2 transition-colors"
          style={{ color: btnColor }}
        >
          <svg className="w-3 h-3 inline mr-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
          Reintentar con GPS
        </button>
        <p className="text-[9px] text-slate-400 italic">
          Selección manual · zona aprox.
        </p>
      </div>
    </div>
  );
}

export default DeliveryZoneSelector;
