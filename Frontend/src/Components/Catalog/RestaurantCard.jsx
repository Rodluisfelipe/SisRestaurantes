import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useBusinessStatus } from '../../hooks/useBusinessStatus';

// Hook para favoritos (localStorage)
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

// Haptic feedback helper
const haptic = () => { try { navigator?.vibrate?.(10); } catch {} };

const RestaurantCard = ({ restaurant, userLocation, variant = 'default' }) => {
  const { businessStatus } = useBusinessStatus(restaurant._id);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [favBounce, setFavBounce] = useState(false);
  const { toggle, isFav } = useFavorites();
  const isFavorite = isFav(restaurant._id);

  // Guardar en recientes al hacer click
  const handleRestaurantClick = () => {
    sessionStorage.setItem('fromCatalog', 'true');
    try {
      const recent = JSON.parse(localStorage.getItem('recentRestaurants') || '[]');
      const filtered = recent.filter(r => r._id !== restaurant._id);
      filtered.unshift({
        _id: restaurant._id, slug: restaurant.slug,
        businessName: restaurant.businessName, logo: restaurant.logo,
        coverImage: restaurant.coverImage, timestamp: Date.now()
      });
      localStorage.setItem('recentRestaurants', JSON.stringify(filtered.slice(0, 10)));
    } catch { /* ignore */ }
  };

  // Compartir
  const handleShare = async (e) => {
    e.preventDefault(); e.stopPropagation();
    haptic();
    const url = `${window.location.origin}/${restaurant.slug}`;
    const text = `¡Mira ${restaurant.businessName} en MenuBy! 🍽️`;
    if (navigator.share) {
      try { await navigator.share({ title: restaurant.businessName, text, url }); } catch { /* cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setShareToast(true);
        setTimeout(() => setShareToast(false), 2000);
      } catch { /* ignore */ }
    }
  };

  // Favorito con animación
  const handleFavorite = (e) => {
    e.preventDefault(); e.stopPropagation();
    haptic();
    setFavBounce(true);
    setTimeout(() => setFavBounce(false), 400);
    toggle(restaurant._id);
  };

  // Tiempo de entrega
  const getDeliveryTime = () => {
    if (restaurant.deliveryZone?.estimatedTime) {
      const { min, max } = restaurant.deliveryZone.estimatedTime;
      return `${min}-${max}`;
    }
    if (restaurant.distance != null) {
      const est = Math.round(15 + (restaurant.distance * 2));
      return `${est}-${est + 10}`;
    }
    return '25-35';
  };

  // Precio de envío
  const getDeliveryInfo = () => {
    if (!restaurant.deliveryZone?.pricing) return null;
    const { pricing } = restaurant.deliveryZone;
    let price = pricing.basePrice || 0;
    if (pricing.mode === 'distance' && price === 0 && pricing.pricePerKm > 0) {
      return { text: `$${pricing.pricePerKm.toLocaleString('es-CO')}/km`, free: false };
    }
    if (pricing.mode === 'tiered' && pricing.tiers?.length > 0) {
      price = pricing.tiers[0].price || 0;
    }
    if (price === 0) return { text: 'Gratis', free: true };
    return { text: `$${price.toLocaleString('es-CO')}`, free: false };
  };

  const isOpen = restaurant.isCurrentlyOpen ?? businessStatus?.isOpen ?? restaurant.isOpen;
  const delivery = getDeliveryInfo();
  const deliveryTime = getDeliveryTime();

  // ─── COMPACT ───
  if (variant === 'compact') {
    return (
      <Link to={`/${restaurant.slug}`} onClick={handleRestaurantClick}
        className="flex-shrink-0 w-[164px] active:scale-[0.97] transition-transform duration-150">
        <div className={`relative rounded-2xl overflow-hidden bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:shadow-md transition-shadow ${!isOpen ? 'opacity-50' : ''}`}>
          <div className="relative h-[130px]">
            {restaurant.coverImage && !imgError ? (
              <>
                {!imgLoaded && <div className="absolute inset-0 bg-gray-100 animate-pulse" />}
                <img src={restaurant.coverImage} alt={restaurant.businessName}
                  className={`w-full h-full object-cover transition-opacity ${imgLoaded ? '' : 'opacity-0'}`}
                  onLoad={() => setImgLoaded(true)} onError={() => setImgError(true)} loading="lazy" />
              </>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                <span className="text-2xl font-bold text-gray-300">{restaurant.businessName.charAt(0)}</span>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />
            {!isOpen && (
              <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-gray-900/80 backdrop-blur-sm rounded text-[10px] text-white font-medium">Cerrado</div>
            )}
            {delivery?.free && (
              <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-emerald-500 rounded text-[10px] text-white font-bold">Gratis</div>
            )}
            <div className="absolute bottom-2 left-2.5 right-2.5">
              <p className="text-white text-[13px] font-semibold truncate leading-tight drop-shadow-sm">{restaurant.businessName}</p>
              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-white/80">
                <span>{deliveryTime} min</span>
                {delivery && !delivery.free && <><span className="text-white/40">·</span><span>{delivery.text}</span></>}
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // ─── DEFAULT ───
  return (
    <Link to={`/${restaurant.slug}`} className="block group" onClick={handleRestaurantClick}>
      <div className={`bg-white rounded-2xl overflow-hidden transition-all duration-300 shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] ${!isOpen ? 'opacity-60' : ''}`}>
        {/* Image */}
        <div className="relative h-[195px] overflow-hidden bg-gray-100">
          {restaurant.coverImage && !imgError ? (
            <>
              {!imgLoaded && (
                <div className="absolute inset-0 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-gray-100 via-white/60 to-gray-100" />
              )}
              <img src={restaurant.coverImage} alt={restaurant.businessName}
                className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-[600ms] ease-out ${imgLoaded ? '' : 'opacity-0'}`}
                onLoad={() => setImgLoaded(true)} onError={() => setImgError(true)} loading="lazy" />
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
              {restaurant.logo ? (
                <img src={restaurant.logo} alt="" className="w-14 h-14 object-contain rounded-xl bg-white p-1 shadow-md" />
              ) : (
                <span className="text-4xl font-bold text-gray-300">{restaurant.businessName.charAt(0)}</span>
              )}
            </div>
          )}

          {/* Promo tag */}
          {restaurant.orderCount > 5 && (
            <div className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-orange-500 text-white text-[11px] font-bold shadow-md flex items-center gap-1">
              🔥 Popular
            </div>
          )}

          {/* Favorite */}
          <motion.button onClick={handleFavorite}
            animate={favBounce ? { scale: [1, 1.2, 0.95, 1.05, 1] } : {}}
            transition={{ duration: 0.35 }}
            className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all ${
              isFavorite ? 'bg-white text-red-500' : 'bg-black/20 backdrop-blur-sm text-white/90 hover:bg-black/30'
            }`}>
            <svg className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={isFavorite ? 0 : 2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </motion.button>

          {/* Free delivery badge */}
          {delivery?.free && (
            <div className="absolute bottom-3 left-3 px-2 py-1 rounded-md bg-emerald-500 text-white text-[11px] font-bold shadow-md">
              Envío gratis
            </div>
          )}

          {/* Closed */}
          {!isOpen && (
            <div className="absolute inset-0 bg-white/40 flex items-center justify-center">
              <span className="px-3.5 py-1 bg-gray-900/90 text-white text-xs font-semibold rounded-full">Cerrado</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-3.5 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-[15px] text-gray-900 truncate">{restaurant.businessName}</h3>
              {restaurant.categories?.length > 0 && (
                <p className="text-[12px] text-gray-400 truncate mt-0.5">
                  {restaurant.categories.slice(0, 3).map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(' · ')}
                </p>
              )}
            </div>
            <div className="relative flex-shrink-0">
              <button onClick={handleShare} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
              <AnimatePresence>
                {shareToast && (
                  <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: -6 }} exit={{ opacity: 0 }}
                    className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] px-2 py-0.5 rounded whitespace-nowrap">
                    ¡Copiado!
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Search match */}
          {restaurant.matchingProducts?.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1.5">
              <span>🔍</span>
              <span className="truncate">
                Tiene: {restaurant.matchingProducts.slice(0, 3).map(p => p.name).join(', ')}
                {restaurant.matchCount > 3 && ` +${restaurant.matchCount - 3}`}
              </span>
            </div>
          )}

          {/* Info row */}
          <div className="flex items-center gap-1 mt-2.5 text-[12px] text-gray-500 flex-wrap">
            {restaurant.orderCount > 0 && (
              <>
                <span className="text-orange-500 font-semibold">{restaurant.orderCount > 50 ? '50+' : restaurant.orderCount} pedidos</span>
                <span className="text-gray-200">·</span>
              </>
            )}
            <span className="flex items-center gap-0.5">
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {deliveryTime} min
            </span>
            {delivery && !delivery.free && (
              <><span className="text-gray-200">·</span><span>Envío {delivery.text}</span></>
            )}
            {restaurant.distance != null && (
              <><span className="text-gray-200">·</span><span>{restaurant.distance < 1 ? `${Math.round(restaurant.distance * 1000)}m` : `${restaurant.distance.toFixed(1)} km`}</span></>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default RestaurantCard;