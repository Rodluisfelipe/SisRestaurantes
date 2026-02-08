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

// Exportar para uso en catálogo
export { useFavorites };

const RestaurantCard = ({ restaurant, userLocation, variant = 'default' }) => {
  const { businessStatus } = useBusinessStatus(restaurant._id);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [shareToast, setShareToast] = useState(false);
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

  // Favorito
  const handleFavorite = (e) => {
    e.preventDefault(); e.stopPropagation();
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
    if (restaurant.orderCount > 5) tags.push({ text: '🔥 Popular', color: 'from-orange-500 to-red-500' });
    if (restaurant.minPrice > 0 && restaurant.minPrice <= 8000) tags.push({ text: '💰 Económico', color: 'from-green-500 to-emerald-500' });
    if (restaurant.productCount >= 15) tags.push({ text: '📋 +15 platos', color: 'from-blue-500 to-indigo-500' });
    return tags.slice(0, 1); // Max 1 promo tag
  };

  const isOpen = restaurant.isCurrentlyOpen ?? businessStatus?.isOpen ?? restaurant.isOpen;
  const delivery = getDeliveryInfo();
  const schedule = getTodaySchedule();
  const promoTags = getPromoTags();

  // --- Variante compacta para secciones horizontales ---
  if (variant === 'compact') {
    return (
      <Link
        to={`/${restaurant.slug}`}
        onClick={handleRestaurantClick}
        className="flex-shrink-0 w-44 group"
      >
        <div className="relative h-32 rounded-2xl overflow-hidden shadow-md mb-2">
          {restaurant.coverImage && !imgError ? (
            <>
              {!imgLoaded && <div className="absolute inset-0 bg-gray-200 animate-pulse" />}
              <img
                src={restaurant.coverImage} alt={restaurant.businessName}
                className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setImgLoaded(true)} onError={() => setImgError(true)} loading="lazy"
              />
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center">
              <span className="text-white text-3xl font-bold">{restaurant.businessName.charAt(0)}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          {!isOpen && <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-[1px]" />}
          {restaurant.logo && (
            <div className="absolute bottom-2 left-2 w-8 h-8 bg-white rounded-lg overflow-hidden shadow-md">
              <img src={restaurant.logo} alt="" className="w-full h-full object-cover" loading="lazy" />
            </div>
          )}
          <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${isOpen ? 'bg-green-400 shadow-green-400/50 shadow-lg' : 'bg-gray-400'}`} />
          {promoTags.length > 0 && (
            <div className={`absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[9px] font-bold text-white bg-gradient-to-r ${promoTags[0].color}`}>
              {promoTags[0].text}
            </div>
          )}
        </div>
        <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-red-600 transition-colors">{restaurant.businessName}</p>
        <div className="flex items-center gap-2 text-[11px] text-gray-500">
          <span>🕐 {getDeliveryTime()} min</span>
          {delivery?.free && <span className="text-green-600 font-medium">Envío gratis</span>}
        </div>
      </Link>
    );
  }

  // --- Variante por defecto (card completa) ---
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -6, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
      className={`group relative bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-2xl transition-all duration-300 ${!isOpen ? 'opacity-80' : ''}`}
    >
      <Link to={`/${restaurant.slug}`} className="block" onClick={handleRestaurantClick}>
        {/* Imagen principal con shimmer */}
        <div className="relative h-44 overflow-hidden">
          {restaurant.coverImage && !imgError ? (
            <>
              {!imgLoaded && (
                <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
                </div>
              )}
              <img
                src={restaurant.coverImage} alt={restaurant.businessName}
                className={`w-full h-full object-cover group-hover:scale-110 transition-all duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setImgLoaded(true)} onError={() => setImgError(true)} loading="lazy"
              />
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-red-400 via-red-500 to-red-600 flex items-center justify-center">
              {restaurant.logo ? (
                <img src={restaurant.logo} alt={restaurant.businessName} className="w-20 h-20 object-cover rounded-full shadow-lg" />
              ) : (
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <span className="text-white font-bold text-3xl">{restaurant.businessName.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          {/* Overlay cerrado */}
          {!isOpen && (
            <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-[1px] flex items-center justify-center">
              <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full">
                <span className="text-white text-sm font-bold">Cerrado</span>
              </div>
            </div>
          )}

          {/* Logo */}
          <div className="absolute top-3 left-3 w-12 h-12 bg-white rounded-xl shadow-lg overflow-hidden ring-2 ring-white/50">
            {restaurant.logo ? (
              <img src={restaurant.logo} alt="" className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">{restaurant.businessName.charAt(0)}</span>
              </div>
            )}
          </div>

          {/* Acciones top-right: Favorito + Estado */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            <button
              onClick={handleFavorite}
              className={`p-1.5 rounded-full backdrop-blur-md transition-all duration-200 ${
                isFavorite ? 'bg-red-500 text-white scale-110' : 'bg-black/30 text-white hover:bg-red-500/80'
              }`}
              title={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            >
              <svg className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
            {isOpen && (
              <div className="px-2 py-1 rounded-full text-[10px] font-bold bg-green-500/90 text-white backdrop-blur-md">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  Abierto
                </div>
              </div>
            )}
          </div>

          {/* Promo tags + Nuevo */}
          <div className="absolute top-3 left-[68px] flex gap-1.5">
            {restaurant.isNew && (
              <div className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg">
                ✨ Nuevo
              </div>
            )}
            {promoTags.map((tag, i) => (
              <div key={i} className={`px-2 py-0.5 rounded-md text-[10px] font-bold text-white bg-gradient-to-r ${tag.color} shadow-lg`}>
                {tag.text}
              </div>
            ))}
          </div>

          {/* Bottom badges */}
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
            <div className="flex gap-1.5">
              {delivery?.free && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-green-500 text-white shadow-md">
                  🛵 Envío gratis
                </span>
              )}
              {restaurant.minPrice > 0 && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/90 backdrop-blur-sm text-gray-700 shadow-md">
                  Desde ${restaurant.minPrice.toLocaleString('es-CO')}
                </span>
              )}
            </div>
            {restaurant.categories?.length > 0 && (
              <div className="bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-md shadow-md">
                <span className="text-[10px] font-semibold text-gray-700">
                  {restaurant.categories.slice(0, 2).map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(' · ')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Contenido */}
        <div className="p-3.5">
          {/* Nombre + acciones */}
          <div className="flex items-start justify-between mb-0.5">
            <h3 className="font-bold text-base text-gray-900 group-hover:text-red-600 transition-colors leading-tight flex-1 mr-2 line-clamp-1">
              {restaurant.businessName}
            </h3>
            <div className="flex items-center gap-0.5">
              <button onClick={handleShare} className="relative p-1 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700" title="Compartir">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <AnimatePresence>
                  {shareToast && (
                    <motion.span
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: -4 }} exit={{ opacity: 0 }}
                      className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap"
                    >¡Copiado!</motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </div>

          {/* Descripción */}
          {restaurant.description && (
            <p className="text-gray-500 text-[11px] line-clamp-1 mb-1.5">{restaurant.description}</p>
          )}

          {/* Top products chips */}
          {restaurant.topProducts?.length > 0 && (
            <div className="flex items-center gap-1 mb-2 overflow-hidden">
              {restaurant.topProducts.slice(0, 3).map((p, i) => (
                <div key={i} className="flex items-center gap-1 bg-gray-50 rounded-md px-1.5 py-0.5 flex-shrink-0">
                  {p.image && <img src={p.image} alt="" className="w-5 h-5 rounded object-cover" loading="lazy" />}
                  <span className="text-[10px] text-gray-600 truncate max-w-[70px]">{p.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Productos que coinciden con búsqueda */}
          {restaurant.matchingProducts?.length > 0 && (
            <div className="mb-2 bg-amber-50 rounded-md px-2 py-1">
              <p className="text-[10px] text-amber-700 font-medium">
                🔍 Tiene: {restaurant.matchingProducts.slice(0, 3).map(p => p.name).join(', ')}
                {restaurant.matchCount > 3 && ` +${restaurant.matchCount - 3} más`}
              </p>
            </div>
          )}

          {/* Info row compacta */}
          <div className="flex items-center gap-2 text-[11px] text-gray-500 flex-wrap">
            {restaurant.distance != null && (
              <span className="flex items-center gap-0.5">
                📍 {restaurant.distance < 1 ? `${Math.round(restaurant.distance * 1000)}m` : `${restaurant.distance.toFixed(1)}km`}
              </span>
            )}
            <span className="flex items-center gap-0.5">🕐 {getDeliveryTime()} min</span>
            {delivery && !delivery.free && <span>🛵 {delivery.text}</span>}
            {restaurant.productCount > 0 && <span>🍽️ {restaurant.productCount}</span>}
            {restaurant.orderCount > 0 && (
              <span className="text-orange-600 font-medium">🔥 {restaurant.orderCount > 50 ? '50+' : restaurant.orderCount} pedidos</span>
            )}
          </div>

          {/* Horario */}
          {schedule && (
            <div className="mt-1.5 flex items-center gap-1 text-[10px] text-gray-400">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Hoy: {schedule}</span>
            </div>
          )}
        </div>
      </Link>

      {/* Shimmer hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none" />
    </motion.div>
  );
};

export default RestaurantCard;