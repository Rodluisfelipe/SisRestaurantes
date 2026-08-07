import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';

/**
 * "Descubre más en MenuBy" — tira de descubrimiento al final del menú.
 * Muestra otros restaurantes de la red cerca del cliente (efecto red).
 */
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const isOpenNow = (businessHours) => {
  if (!businessHours) return null;
  const now = new Date();
  const d = businessHours[DAYS[now.getDay()]];
  if (!d || !d.isOpen) return false;
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return hm >= (d.openTime || '00:00') && hm <= (d.closeTime || '23:59');
};

const TYPE_EMOJI = {
  fast_food: '🍔', restaurant: '🍽️', cafe: '☕', bakery: '🧁', ice_cream: '🍦',
  bar: '🍸', food_truck: '🚚', salon: '💇', spa: '💆', clinic: '🏥', hotel: '🏨',
};

const DiscoverMore = () => {
  const { businessConfig } = useBusinessConfig();
  const slug = businessConfig?.slug;
  const themeColor = businessConfig?.theme?.buttonColor || '#f97316';
  const [items, setItems] = useState([]);
  // El servidor dice si lo que manda esta de verdad cerca; el titulo depende
  // de eso, porque llamar 'cerca de ti' a un negocio de otra ciudad no sirve.
  const [cercanos, setCercanos] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let done = false;
    const fetchWith = (coords) => {
      api.get('/business-config/discover', {
        params: { exclude: slug, limit: 10, ...(coords ? { lat: coords.lat, lng: coords.lng } : {}) },
      })
        .then(res => { if (!done) { setItems(res.data.businesses || []); setCercanos(!!res.data.cercanos); } })
        .catch(() => {})
        .finally(() => { if (!done) setLoading(false); });
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => fetchWith({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => fetchWith(null),
        { timeout: 3000, maximumAge: 600000 }
      );
    } else {
      fetchWith(null);
    }
    return () => { done = true; };
  }, [slug]);

  if (loading || items.length === 0) return null;

  return (
    <div className="container mx-auto px-3 sm:px-4 lg:px-6 mt-8 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🍴</span>
        <div>
          <h2 className="text-[15px] sm:text-base font-bold text-slate-800 leading-tight">Descubre más en MenuBy</h2>
          <p className="text-[11px] text-slate-400 leading-tight">{cercanos ? 'Otros lugares cerca de ti' : 'Otros lugares en MenuBy'}</p>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-3 px-3 sm:-mx-4 sm:px-4">
        {items.map((b) => {
          const open = isOpenNow(b.businessHours);
          return (
            <a
              key={b.slug}
              href={`/${b.slug}`}
              className="flex-shrink-0 w-40 sm:w-44 rounded-2xl bg-white border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden active:scale-[0.98] transition-transform"
            >
              {/* Cover / logo */}
              <div className="relative h-24 bg-slate-100 flex items-center justify-center overflow-hidden">
                {b.coverImage ? (
                  <img src={b.coverImage} alt={b.businessName} className="w-full h-full object-cover" loading="lazy" />
                ) : b.logo ? (
                  <img src={b.logo} alt={b.businessName} className="max-h-16 max-w-[70%] object-contain" loading="lazy" />
                ) : (
                  <span className="text-3xl">{TYPE_EMOJI[b.businessType] || '🍽️'}</span>
                )}
                {open !== null && (
                  <span
                    className={`absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      open ? 'bg-emerald-500 text-white' : 'bg-slate-700/80 text-white'
                    }`}
                  >
                    {open ? 'Abierto' : 'Cerrado'}
                  </span>
                )}
                {/* La distancia solo se muestra si de verdad está cerca: en el
                    modo de reserva serían cifras de cientos de kilómetros que
                    no le dicen nada útil al comensal. */}
                {cercanos && b.distanceKm != null && (
                  <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/90 text-slate-600">
                    {b.distanceKm < 1 ? `${Math.round(b.distanceKm * 1000)} m` : `${b.distanceKm} km`}
                  </span>
                )}
              </div>
              {/* Info */}
              <div className="p-2.5">
                <p className="text-[13px] font-bold text-slate-800 truncate">{b.businessName}</p>
                <div className="flex items-center gap-1 mt-0.5 h-4">
                  {b.rating > 0 ? (
                    <>
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="#FBBC05"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                      <span className="text-[11px] font-bold text-slate-600">{b.rating.toFixed(1)}</span>
                      {b.reviewCount > 0 && <span className="text-[10px] text-slate-400">({b.reviewCount})</span>}
                    </>
                  ) : (
                    <span className="text-[10px] text-slate-300">Nuevo en MenuBy</span>
                  )}
                </div>
              </div>
            </a>
          );
        })}

        {/* Ver todos */}
        <a
          href="/restaurantes"
          className="flex-shrink-0 w-28 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center gap-1.5 active:scale-[0.98] transition-transform"
          style={{ color: themeColor }}
        >
          <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: `${themeColor}15` }}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
          </span>
          <span className="text-[11px] font-bold">Ver todos</span>
        </a>
      </div>
    </div>
  );
};

export default DiscoverMore;
