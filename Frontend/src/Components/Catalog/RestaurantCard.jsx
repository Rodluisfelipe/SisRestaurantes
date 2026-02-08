import React, { useState, useEffect, useRef } from 'react';
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
  const cardRef = useRef(null);

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

  // Horario de hoy
  const getTodaySchedule = () => {
    const hours = restaurant.todayHours;
    if (!hours) return null;
    if (!hours.isOpen) return 'Cerrado hoy';
    return `${hours.openTime} - ${hours.closeTime}`;
  };

  // Tags inteligentes
  const getPromoTags = () => {
    const tags = [];
    if (restaurant.orderCount > 5) tags.push({ text: '🔥 Popular', color: 'bg-orange-500' });
    if (restaurant.minPrice > 0 && restaurant.minPrice <= 8000) tags.push({ text: '💰 Económico', color: 'bg-emerald-500' });
    if (restaurant.productCount >= 15) tags.push({ text: '📋 Variado', color: 'bg-blue-500' });
    return tags.slice(0, 1);
  };

  const isOpen = restaurant.isCurrentlyOpen ?? businessStatus?.isOpen ?? restaurant.isOpen;
  const delivery = getDeliveryInfo();
  const schedule = getTodaySchedule();
  const promoTags = getPromoTags();
  const deliveryTime = getDeliveryTime();

  // ============ COMPACT VARIANT ============
  if (variant === 'compact') {
    return (
      <Link
        to={`/${restaurant.slug}`}
        onClick={handleRestaurantClick}
        className="flex-shrink-0 w-[156px] group active:scale-[0.97] transition-transform duration-150"
      >
        <div className="relative h-[120px] rounded-2xl overflow-hidden mb-1.5 shadow-sm group-hover:shadow-lg transition-shadow duration-300">
          {restaurant.coverImage && !imgError ? (
            <>
              {!imgLoaded && (
                <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200">
                  <div className="absolute inset-0 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                </div>
              )}
              <img
                src={restaurant.coverImage} alt={restaurant.businessName}
                className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setImgLoaded(true)} onError={() => setImgError(true)} loading="lazy"
              />
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center">
              <span className="text-white text-3xl font-bold">{restaurant.businessName.charAt(0)}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          {!isOpen && <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-[2px]" />}

          {/* Compact bottom overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-2">
            <div className="flex items-center gap-1.5">
              {restaurant.logo && (
                <div className="w-7 h-7 bg-white rounded-lg overflow-hidden shadow-md flex-shrink-0 ring-1 ring-white/30">
                  <img src={restaurant.logo} alt="" className="w-full h-full object-cover" loading="lazy" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-white text-xs font-bold truncate leading-tight drop-shadow-md">{restaurant.businessName}</p>
                <div className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOpen ? 'bg-green-400' : 'bg-red-400'}`} />
                  <span className="text-white/80 text-[9px] truncate">{deliveryTime} min</span>
                </div>
              </div>
            </div>
          </div>

          {/* Badges */}
          {promoTags.length > 0 && (
            <div className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold text-white ${promoTags[0].color} shadow-lg`}>
              {promoTags[0].text}
            </div>
          )}
          {delivery?.free && (
            <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold text-white bg-emerald-500 shadow-lg">
              Gratis
            </div>
          )}
        </div>
      </Link>
    );
  }

  // ============ DEFAULT / FULL CARD ============
  return (
    <motion.div
      ref={cardRef}
      layout
      className={`group relative bg-white rounded-2xl overflow-hidden transition-all duration-300
        shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]
        hover:shadow-[0_20px_40px_rgba(0,0,0,0.08),0_8px_16px_rgba(0,0,0,0.04)]
        active:scale-[0.98] active:shadow-sm
        ${!isOpen ? 'opacity-75 grayscale-[15%]' : ''}`}
    >
      <Link to={`/${restaurant.slug}`} className="block" onClick={handleRestaurantClick}>
        {/* HERO IMAGE */}
        <div className="relative h-[180px] overflow-hidden">
          {restaurant.coverImage && !imgError ? (
            <>
              {!imgLoaded && (
                <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200">
                  <div className="absolute inset-0 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                </div>
              )}
              <img
                src={restaurant.coverImage} alt={restaurant.businessName}
                className={`w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-700 ease-out ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setImgLoaded(true)} onError={() => setImgError(true)} loading="lazy"
              />
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-red-400 via-red-500 to-orange-500 flex items-center justify-center">
              {restaurant.logo ? (
                <img src={restaurant.logo} alt={restaurant.businessName} className="w-20 h-20 object-contain rounded-2xl shadow-2xl bg-white p-1" />
              ) : (
                <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <span className="text-white font-black text-4xl">{restaurant.businessName.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
          )}

          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />

          {/* Closed overlay */}
          {!isOpen && (
            <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-[2px] flex items-center justify-center">
              <div className="bg-black/70 backdrop-blur-md px-5 py-2 rounded-xl border border-white/10">
                <span className="text-white text-sm font-bold tracking-wide">Cerrado</span>
              </div>
            </div>
          )}

          {/* TOP ROW: Logo + Tags + Favorite */}
          <div className="absolute top-0 left-0 right-0 p-3 flex items-start justify-between">
            <div className="flex items-center gap-2">
              {/* Logo pill */}
              <div className="w-10 h-10 bg-white rounded-xl shadow-lg overflow-hidden ring-2 ring-white/50 flex-shrink-0">
                {restaurant.logo ? (
                  <img src={restaurant.logo} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">{restaurant.businessName.charAt(0)}</span>
                  </div>
                )}
              </div>
              {/* Badges */}
              <div className="flex flex-col gap-1">
                {restaurant.isNew && (
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg inline-flex items-center gap-0.5 w-fit">
                    <span className="animate-pulse">✨</span> Nuevo
                  </span>
                )}
                {promoTags.map((tag, i) => (
                  <span key={i} className={`px-2 py-0.5 rounded-lg text-[10px] font-bold text-white ${tag.color} shadow-lg w-fit`}>
                    {tag.text}
                  </span>
                ))}
              </div>
            </div>

            {/* Favorite button */}
            <motion.button
              onClick={handleFavorite}
              animate={favBounce ? { scale: [1, 1.3, 0.9, 1.1, 1] } : {}}
              transition={{ duration: 0.4 }}
              className={`p-2 rounded-full backdrop-blur-xl transition-all duration-200 shadow-lg
                ${isFavorite 
                  ? 'bg-red-500 text-white ring-2 ring-red-300/50' 
                  : 'bg-black/25 text-white/90 hover:bg-black/40 active:bg-red-500'
                }`}
            >
              <svg className="w-[18px] h-[18px]" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={isFavorite ? 0 : 2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </motion.button>
          </div>

          {/* BOTTOM ROW: Delivery info pill */}
          <div className="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-between">
            <div className="flex items-center gap-1.5">
              {delivery?.free ? (
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500 text-white shadow-lg flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Envío gratis
                </span>
              ) : delivery ? (
                <span className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-white/90 backdrop-blur-md text-gray-800 shadow-md">
                  Envío {delivery.text}
                </span>
              ) : null}
              {restaurant.minPrice > 0 && (
                <span className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-white/90 backdrop-blur-md text-gray-800 shadow-md">
                  Desde ${restaurant.minPrice.toLocaleString('es-CO')}
                </span>
              )}
            </div>
            {isOpen && (
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-green-500 text-white shadow-lg flex items-center gap-1">
                <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" /></span>
                Abierto
              </span>
            )}
          </div>
        </div>

        {/* CONTENT */}
        <div className="p-3.5 pb-3">
          {/* Name + Share */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-[15px] text-gray-900 group-hover:text-red-600 transition-colors leading-snug truncate">
                {restaurant.businessName}
              </h3>
              {restaurant.categories?.length > 0 && (
                <p className="text-[11px] text-gray-400 font-medium truncate mt-0.5">
                  {restaurant.categories.slice(0, 3).map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(' · ')}
                </p>
              )}
            </div>
            <button onClick={handleShare} className="relative p-1.5 -mr-1 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors text-gray-400 hover:text-gray-600 flex-shrink-0" title="Compartir">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <AnimatePresence>
                {shareToast && (
                  <motion.span
                    initial={{ opacity: 0, y: 4, scale: 0.8 }} animate={{ opacity: 1, y: -8, scale: 1 }} exit={{ opacity: 0, y: -16, scale: 0.8 }}
                    className="absolute -top-5 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] px-2 py-0.5 rounded-md whitespace-nowrap shadow-lg"
                  >¡Link copiado!</motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>

          {/* Description */}
          {restaurant.description && (
            <p className="text-gray-500 text-[11px] leading-relaxed line-clamp-1 mb-2">{restaurant.description}</p>
          )}

          {/* Top products chips */}
          {restaurant.topProducts?.length > 0 && (
            <div className="flex items-center gap-1.5 mb-2.5 overflow-hidden">
              {restaurant.topProducts.slice(0, 3).map((p, i) => (
                <div key={i} className="flex items-center gap-1 bg-gray-50 rounded-lg px-1.5 py-1 flex-shrink-0 border border-gray-100/80">
                  {p.image && <img src={p.image} alt="" className="w-5 h-5 rounded-md object-cover" loading="lazy" />}
                  <span className="text-[10px] text-gray-600 font-medium truncate max-w-[65px]">{p.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Matching search products */}
          {restaurant.matchingProducts?.length > 0 && (
            <div className="mb-2.5 bg-amber-50 rounded-lg px-2.5 py-1.5 border border-amber-100">
              <p className="text-[10px] text-amber-700 font-medium">
                🔍 Tiene: {restaurant.matchingProducts.slice(0, 3).map(p => p.name).join(', ')}
                {restaurant.matchCount > 3 && ` +${restaurant.matchCount - 3} más`}
              </p>
            </div>
          )}

          {/* Info pills - cleaner layout */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {restaurant.distance != null && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-50 text-[11px] text-gray-600 font-medium">
                <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                {restaurant.distance < 1 ? `${Math.round(restaurant.distance * 1000)}m` : `${restaurant.distance.toFixed(1)}km`}
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-50 text-[11px] text-gray-600 font-medium">
              <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {deliveryTime} min
            </span>
            {restaurant.productCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-50 text-[11px] text-gray-600 font-medium">
                🍽️ {restaurant.productCount}
              </span>
            )}
            {restaurant.orderCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-50 text-[11px] text-orange-600 font-semibold">
                🔥 {restaurant.orderCount > 50 ? '50+' : restaurant.orderCount} pedidos
              </span>
            )}
          </div>

          {/* Schedule */}
          {schedule && (
            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1.5 text-[10px] text-gray-400">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Hoy: {schedule}</span>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
};

export default RestaurantCard;