import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

/* ── SVG Icons (stroke-based, matching admin design language) ── */
const ZI = {
  mapPin: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  clock: (cls = 'w-3.5 h-3.5') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  refresh: (cls = 'w-3.5 h-3.5') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
  check: (cls = 'w-3.5 h-3.5') => <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>,
  alert: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  spinner: (cls = 'w-4 h-4') => <svg className={`${cls} animate-spin`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/></svg>,
  gps: (cls = 'w-3.5 h-3.5') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/><circle cx="12" cy="12" r="8"/></svg>,
  truck: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
};

/**
 * DeliveryZoneSelector — Fallback UI when GPS fails / is denied.
 * Shows available delivery zone cards so the client can manually pick one.
 * Zone selection is MANDATORY to proceed with the order.
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
      const geoRes = await api.post('/delivery-zones/geocode', { address: addr, country: 'CO' });
      const results = geoRes.data?.results;
      
      if (results?.length > 0) {
        const { lat, lon } = results[0];
        const covRes = await api.post('/delivery-zones/check-coverage', {
          businessId, lat, lon, orderTotal
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
          return;
        }
      }
    } catch (err) {
      console.log('Geocode fallback failed, showing zone cards:', err.message);
    } finally {
      setGeocoding(false);
    }
  };

  const handleSelectZone = (zone) => {
    if (zone.pricing.minimumOrder > 0 && orderTotal < zone.pricing.minimumOrder) return;
    
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

  /* ── Loading ── */
  if (loading || geocoding) {
    return (
      <div className={compact ? "p-3 bg-slate-50/80 border border-slate-200 rounded-2xl" : "mt-3 p-5 bg-slate-50/80 border border-slate-200 rounded-2xl"}>
        <div className="flex items-center justify-center gap-2.5">
          <span className="text-slate-400">{ZI.spinner(compact ? 'w-4 h-4' : 'w-5 h-5')}</span>
          <p className={`${compact ? 'text-[11px]' : 'text-sm'} text-slate-500 font-medium`}>
            {geocoding ? 'Buscando tu dirección...' : 'Cargando zonas de entrega...'}
          </p>
        </div>
      </div>
    );
  }

  /* ── No zones configured — allow order, fee TBD ── */
  if (!error && zones.length === 0) {
    const noZoneInfo = { zoneName: 'Por definir con el negocio', noZonesConfigured: true };
    if (onZoneSelect) onZoneSelect({ fee: 0, zoneInfo: noZoneInfo });
    return (
      <div className={compact ? "p-3 bg-amber-50/80 border border-amber-200/60 rounded-2xl" : "mt-3 p-4 bg-amber-50/80 border border-amber-200/60 rounded-2xl"}>
        <div className="flex items-center gap-2.5">
          <span className="text-amber-500">{ZI.alert('w-4 h-4')}</span>
          <p className={`${compact ? 'text-[11px]' : 'text-xs'} text-amber-800 font-medium leading-snug`}>
            El costo de envío será confirmado por el negocio.
          </p>
        </div>
      </div>
    );
  }

  /* ── Error loading zones ── */
  if (error) {
    return (
      <div className={compact ? "p-3 bg-amber-50/80 border border-amber-200/60 rounded-2xl" : "mt-3 p-4 bg-amber-50/80 border border-amber-200/60 rounded-2xl"}>
        <div className="flex items-center gap-2.5">
          <span className="text-amber-500">{ZI.alert('w-4 h-4')}</span>
          <p className={`${compact ? 'text-[11px]' : 'text-xs'} text-amber-800 font-medium leading-snug`}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-2" : "mt-3 space-y-3"}>
      {/* ── Header card ── */}
      <div className={`${compact ? 'p-2.5' : 'p-3.5'} bg-blue-50/60 border border-blue-200/50 rounded-2xl`}>
        <div className="flex items-start gap-2.5">
          <span className="text-blue-500 mt-0.5 flex-shrink-0">{ZI.mapPin(compact ? 'w-4 h-4' : 'w-[18px] h-[18px]')}</span>
          <div className="flex-1 min-w-0">
            <p className={`${compact ? 'text-[11px]' : 'text-[13px]'} font-semibold text-blue-900`}>
              Selecciona tu zona de entrega
            </p>
            {!compact && (
              <p className="text-[11px] text-blue-600/80 mt-0.5 leading-snug">
                No pudimos detectar tu ubicación. Selecciona la zona que corresponda a tu dirección para calcular el envío.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Zone cards ── */}
      <div className={compact ? "space-y-1.5" : "space-y-2"}>
        <AnimatePresence>
          {zones.map((zone, index) => {
            const isSelected = selectedZoneId === zone.id;
            const meetsMinimum = zone.pricing.minimumOrder <= 0 || orderTotal >= zone.pricing.minimumOrder;
            const belowMinimum = !meetsMinimum;

            return (
              <motion.button
                key={zone.id}
                type="button"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.18 }}
                onClick={() => meetsMinimum && handleSelectZone(zone)}
                disabled={belowMinimum}
                className={`w-full text-left rounded-2xl border-2 ${compact ? 'px-3 py-2.5' : 'px-4 py-3.5'} transition-all duration-200 ${
                  isSelected 
                    ? 'shadow-md ring-1 ring-offset-1' 
                    : belowMinimum
                      ? 'border-slate-200 bg-slate-50/60 opacity-50 cursor-not-allowed'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm active:scale-[0.99]'
                }`}
                style={isSelected ? {
                  borderColor: btnColor,
                  backgroundColor: `${btnColor}0A`,
                  '--tw-ring-color': `${btnColor}40`,
                } : {}}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Left: zone info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Color dot + truck icon overlay */}
                    <div className="relative flex-shrink-0">
                      <div 
                        className={`${compact ? 'w-9 h-9' : 'w-10 h-10'} rounded-xl flex items-center justify-center`}
                        style={{ backgroundColor: `${zone.color || '#3B82F6'}15` }}
                      >
                        <span style={{ color: zone.color || '#3B82F6' }}>{ZI.truck(compact ? 'w-4 h-4' : 'w-[18px] h-[18px]')}</span>
                      </div>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center shadow-sm"
                          style={{ backgroundColor: btnColor }}
                        >
                          <svg className="w-2.5 h-2.5" fill="none" stroke={btnTextColor} strokeWidth={3} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </motion.div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className={`${compact ? 'text-[12px]' : 'text-[13px]'} font-semibold truncate ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                        {zone.name}
                      </p>
                      
                      <div className={`flex items-center gap-2 ${compact ? 'mt-0' : 'mt-0.5'}`}>
                        {/* Estimated time */}
                        {zone.estimatedTime && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            {ZI.clock('w-3 h-3')}
                            {zone.estimatedTime.min}-{zone.estimatedTime.max} min
                          </span>
                        )}
                        
                        {/* Minimum order warning */}
                        {belowMinimum && (
                          <span className="text-[10px] text-red-500 font-medium">
                            Min. ${zone.pricing.minimumOrder.toLocaleString('es-CO')}
                          </span>
                        )}

                        {/* Description */}
                        {zone.description && !belowMinimum && !compact && (
                          <span className="text-[10px] text-slate-400 truncate">
                            {zone.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: price badge */}
                  <div className="flex-shrink-0">
                    <div 
                      className={`${compact ? 'px-2.5 py-1' : 'px-3 py-1.5'} rounded-lg text-right`}
                      style={isSelected 
                        ? { backgroundColor: `${btnColor}15`, color: btnColor }
                        : { backgroundColor: '#f1f5f9' }
                      }
                    >
                      <p className={`${compact ? 'text-[12px]' : 'text-[13px]'} font-bold ${isSelected ? '' : 'text-slate-700'}`}>
                        {zone.pricing.priceLabel}
                      </p>
                      {zone.pricing.mode !== 'fixed' && (
                        <p className="text-[9px] text-slate-400 uppercase tracking-wider font-medium">
                          {zone.pricing.mode === 'distance' ? 'aprox.' : 'rango'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ── Footer: retry GPS ── */}
      <div className="flex items-center justify-center pt-1">
        <button
          type="button"
          onClick={onRetryGPS}
          className={`inline-flex items-center gap-1.5 ${compact ? 'px-3 py-1.5' : 'px-4 py-2'} rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors`}
        >
          <span className="text-slate-500">{ZI.gps(compact ? 'w-3 h-3' : 'w-3.5 h-3.5')}</span>
          <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} font-medium text-slate-600`}>Reintentar con GPS</span>
        </button>
      </div>
    </div>
  );
}

export default DeliveryZoneSelector;
