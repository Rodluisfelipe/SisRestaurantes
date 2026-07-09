import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useBusinessStatus } from '../../hooks/useBusinessStatus';

// ── Favorites hook ──
const useFavorites = () => {
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('favoriteRestaurants') || '[]'); } catch { return []; }
  });
  const toggle = (id) => {
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
      localStorage.setItem('favoriteRestaurants', JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('favoritesChanged', { detail: next }));
      return next;
    });
  };
  const isFav = (id) => favorites.includes(id);
  useEffect(() => {
    const handler = (e) => setFavorites(e.detail);
    window.addEventListener('favoritesChanged', handler);
    return () => window.removeEventListener('favoritesChanged', handler);
  }, []);
  return { toggle, isFav };
};
export { useFavorites };

const RestaurantCard = ({ restaurant, userLocation, variant = 'default' }) => {
  const { businessStatus } = useBusinessStatus(restaurant._id);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [favBounce, setFavBounce] = useState(false);
  const { toggle, isFav } = useFavorites();
  const isFavorite = isFav(restaurant._id);

  const handleClick = () => {
    sessionStorage.setItem('fromCatalog', 'true');
    try {
      const recent = JSON.parse(localStorage.getItem('recentRestaurants') || '[]');
      const filtered = recent.filter(r => r._id !== restaurant._id);
      filtered.unshift({ _id: restaurant._id, slug: restaurant.slug, businessName: restaurant.businessName, logo: restaurant.logo, coverImage: restaurant.coverImage, timestamp: Date.now() });
      localStorage.setItem('recentRestaurants', JSON.stringify(filtered.slice(0, 10)));
    } catch {}
  };

  const handleFavorite = (e) => {
    e.preventDefault(); e.stopPropagation();
    try { navigator?.vibrate?.(10); } catch {}
    setFavBounce(true);
    setTimeout(() => setFavBounce(false), 400);
    toggle(restaurant._id);
  };

  const deliveryTime = (() => {
    if (restaurant.deliveryZone?.estimatedTime) { const { min, max } = restaurant.deliveryZone.estimatedTime; return `${min}-${max}`; }
    if (restaurant.distance != null) { const est = Math.round(15 + (restaurant.distance * 2)); return `${est}-${est + 10}`; }
    return '25-35';
  })();

  const delivery = (() => {
    if (!restaurant.deliveryZone?.pricing) return null;
    const { pricing } = restaurant.deliveryZone;
    let price = pricing.basePrice || 0;
    if (pricing.mode === 'distance' && price === 0 && pricing.pricePerKm > 0) return { text: `$${pricing.pricePerKm.toLocaleString('es-CO')}/km`, free: false };
    if (pricing.mode === 'tiered' && pricing.tiers?.length > 0) price = pricing.tiers[0].price || 0;
    if (price === 0) return { text: 'Envío gratis', free: true };
    return { text: `$${price.toLocaleString('es-CO')}`, free: false };
  })();

  const isOpen = restaurant.isCurrentlyOpen ?? businessStatus?.isOpen ?? restaurant.isOpen;
  const distanceText = restaurant.distance != null ? (restaurant.distance < 1 ? `${Math.round(restaurant.distance * 1000)} m` : `${restaurant.distance.toFixed(1)} km`) : null;

  const rating = restaurant.reviewStats?.averageRating > 0
    ? restaurant.reviewStats.averageRating.toFixed(1)
    : (restaurant.popularityScore ? Math.min(5, 3.5 + (restaurant.popularityScore / 100) * 1.5).toFixed(1) : null);

  // ═══ COMPACT ═══
  if (variant === 'compact') {
    return (
      <Link to={`/${restaurant.slug}`} onClick={handleClick} className="flex-shrink-0 w-[160px] snap-start group">
        <div className={`${!isOpen ? 'opacity-50' : ''}`}>
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-gray-100 shadow-sm border border-gray-100/80">
            {/* Cover as background */}
            {restaurant.coverImage && !imgError ? (
              <img src={restaurant.coverImage} alt="" className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${imgLoaded ? '' : 'opacity-0'}`}
                onLoad={() => setImgLoaded(true)} onError={() => setImgError(true)} loading="lazy" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-red-50 to-red-100" />
            )}
            {/* Dark overlay for contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />

            {/* Logo centered */}
            <div className="absolute inset-0 flex items-center justify-center">
              {restaurant.logo ? (
                <div className="w-[52px] h-[52px] rounded-xl overflow-hidden bg-white shadow-xl shadow-black/25 border-2 border-white ring-1 ring-black/5">
                  <img src={restaurant.logo} alt="" className="w-full h-full object-cover" loading="lazy" />
                </div>
              ) : (
                <div className="w-[52px] h-[52px] rounded-xl bg-white shadow-xl shadow-black/25 border-2 border-white ring-1 ring-black/5 flex items-center justify-center">
                  <span className="text-xl font-bold text-red-500">{restaurant.businessName.charAt(0)}</span>
                </div>
              )}
            </div>

            {/* Time badge */}
            <div className="absolute bottom-2 left-2 bg-white/95 backdrop-blur-sm rounded-lg px-2 py-0.5 shadow-sm">
              <span className="text-[10px] font-bold text-gray-800">{deliveryTime} min</span>
            </div>
            {delivery?.free && (
              <div className="absolute top-2 left-2 bg-red-500 rounded-lg px-1.5 py-0.5">
                <span className="text-[9px] font-bold text-white">GRATIS</span>
              </div>
            )}
            {!isOpen && <div className="absolute inset-0 bg-white/60 flex items-center justify-center"><span className="text-[10px] font-bold text-gray-500 bg-white px-2 py-0.5 rounded-full">Cerrado</span></div>}
          </div>
          <div className="mt-2 px-0.5">
            <p className="text-[13px] font-bold text-gray-900 truncate leading-tight">{restaurant.businessName}</p>
            <div className="flex items-center gap-1 mt-0.5">
              {rating && <span className="text-[11px] font-semibold text-gray-900">{rating}</span>}
              {rating && <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>}
              <span className="text-[11px] text-gray-400">{distanceText || ''}</span>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // ═══ DEFAULT ═══
  return (
    <Link to={`/${restaurant.slug}`} onClick={handleClick} className="block group">
      <div className={`bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm transition-all duration-200 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 ${!isOpen ? 'opacity-60' : ''}`}>
        {/* Image */}
        <div className="relative aspect-[16/9] overflow-hidden bg-gray-100">
          {restaurant.coverImage && !imgError ? (
            <>
              {!imgLoaded && <div className="absolute inset-0 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-gray-100 via-white to-gray-100" />}
              <img src={restaurant.coverImage} alt={restaurant.businessName}
                className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03] ${imgLoaded ? '' : 'opacity-0'}`}
                onLoad={() => setImgLoaded(true)} onError={() => setImgError(true)} loading="lazy" />
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
              {restaurant.logo ? <img src={restaurant.logo} alt="" className="w-14 h-14 object-contain rounded-xl" /> : <span className="text-4xl font-bold text-red-200">{restaurant.businessName.charAt(0)}</span>}
            </div>
          )}

          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 p-3 flex items-start justify-between">
            {/* Promo / Free delivery badge */}
            {delivery?.free ? (
              <div className="bg-red-500 text-white px-2.5 py-1 rounded-lg shadow-lg shadow-red-500/30">
                <span className="text-[11px] font-bold tracking-wide">ENVÍO GRATIS</span>
              </div>
            ) : <div />}
            {/* Favorite */}
            <motion.button onClick={handleFavorite}
              animate={favBounce ? { scale: [1, 1.3, 0.9, 1.05, 1] } : {}} transition={{ duration: 0.35 }}
              className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm transition-all ${isFavorite ? 'bg-red-500 text-white shadow-red-500/30' : 'bg-white/90 text-gray-500 hover:text-red-500 hover:bg-white'}`}>
              <svg className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </motion.button>
          </div>

          {/* Bottom bar */}
          <div className="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-between">
            {/* Time badge */}
            <div className="bg-white rounded-xl px-2.5 py-1 shadow-lg">
              <span className="text-[12px] font-bold text-gray-900">{deliveryTime} min</span>
            </div>
            {/* Rating badge */}
            {rating && (
              <div className="bg-white rounded-xl px-2 py-1 shadow-lg flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                <span className="text-[12px] font-bold text-gray-900">{rating}</span>
              </div>
            )}
          </div>

          {/* Closed overlay */}
          {!isOpen && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
              <span className="bg-white px-4 py-1.5 rounded-full text-[13px] font-bold text-gray-600 shadow-md">Cerrado ahora</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3.5">
          <div className="flex items-start gap-3">
            {/* Logo */}
            {restaurant.logo && (
              <div className="w-11 h-11 rounded-xl overflow-hidden bg-white border-2 border-red-50 flex-shrink-0 -mt-8 shadow-lg relative z-10">
                <img src={restaurant.logo} alt="" className="w-full h-full object-cover" loading="lazy" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[15px] font-bold text-gray-900 truncate">{restaurant.businessName}</h3>
              </div>

              {/* Meta */}
              <div className="flex items-center gap-1 mt-0.5 text-[12px] text-gray-500 flex-wrap">
                <span className="font-medium text-gray-700">{deliveryTime} min</span>
                {(delivery || distanceText) && <span className="text-gray-300">·</span>}
                {delivery && !delivery.free && <span>Envío {delivery.text}</span>}
                {delivery?.free && <span className="text-green-600 font-semibold">Envío gratis</span>}
                {distanceText && <><span className="text-gray-300">·</span><span>{distanceText}</span></>}
              </div>
            </div>
          </div>

          {/* Categories */}
          {restaurant.categories?.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
              {restaurant.categories.slice(0, 3).map(c => (
                <span key={c} className="text-[11px] font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </span>
              ))}
            </div>
          )}

          {/* Search match */}
          {restaurant.matchingProducts?.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 bg-red-50 rounded-lg px-2.5 py-1.5">
              <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-[11px] text-red-600 font-medium truncate">
                {restaurant.matchingProducts.slice(0, 2).map(p => p.name).join(', ')}
                {restaurant.matchCount > 2 && ` +${restaurant.matchCount - 2} más`}
              </p>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};

export default RestaurantCard;