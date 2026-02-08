import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import RestaurantCard, { useFavorites } from '../../Components/Catalog/RestaurantCard';
import BannerCarousel from '../../Components/Catalog/BannerCarousel';
import { useUserLocation } from '../../hooks/useUserLocation';

// ─── Icons ─────────────────────────────────────────
const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const LocationIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

// ─── Skeleton ──────────────────────────────────────
const CardSkeleton = () => (
  <div className="bg-white rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
    <div className="h-[180px] bg-gray-100 relative overflow-hidden">
      <div className="absolute inset-0 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100" />
    </div>
    <div className="p-3.5">
      <div className="h-4 bg-gray-100 rounded-lg w-3/4 mb-2" />
      <div className="h-3 bg-gray-50 rounded-md w-full mb-3" />
      <div className="flex gap-2">
        <div className="h-5 bg-gray-50 rounded-md w-16" />
        <div className="h-5 bg-gray-50 rounded-md w-20" />
        <div className="h-5 bg-gray-50 rounded-md w-14" />
      </div>
    </div>
  </div>
);

// ─── Horizontal Scroll Section ─────────────────────
const HorizontalSection = ({ title, subtitle, icon, children, onSeeAll }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    className="mb-7"
  >
    <div className="flex items-center justify-between mb-3 px-0.5">
      <div>
        <h3 className="text-[15px] font-bold text-gray-900 flex items-center gap-1.5">
          {icon && <span className="text-base">{icon}</span>}
          {title}
        </h3>
        {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {onSeeAll && (
        <button onClick={onSeeAll} className="text-xs text-red-500 font-semibold hover:text-red-600 active:text-red-700 transition-colors px-2 py-1 -mr-2 rounded-lg hover:bg-red-50">
          Ver todos →
        </button>
      )}
    </div>
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1 snap-x snap-mandatory">
      {children}
    </div>
  </motion.div>
);

const ITEMS_PER_PAGE = 12;

const MenuByCatalog = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todo');
  const [sortBy, setSortBy] = useState('popularity');
  const [categories, setCategories] = useState([]);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlyFreeDelivery, setOnlyFreeDelivery] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [productSearchResults, setProductSearchResults] = useState([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [recentRestaurants, setRecentRestaurants] = useState([]);
  const [featuredSections, setFeaturedSections] = useState(null);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [headerCompact, setHeaderCompact] = useState(false);
  const searchTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);
  const loadMoreRef = useRef(null);
  const { isFav } = useFavorites();

  // Hook de ubicación dinámica
  const { location, updateLocation, hasLocation, isLoading: locationLoading } = useUserLocation();

  // Cargar restaurantes cuando la ubicación esté lista
  useEffect(() => {
    if (!locationLoading) {
      loadRestaurants();
      loadFeaturedSections();
    }
  }, [location.coordinates, locationLoading]);

  useEffect(() => {
    filterAndSortRestaurants();
  }, [restaurants, searchTerm, selectedCategory, sortBy, onlyOpen, onlyFreeDelivery]);

  // Header compacto al hacer scroll
  useEffect(() => {
    const handleScroll = () => setHeaderCompact(window.scrollY > 120);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Cargar restaurantes recientes desde localStorage
  useEffect(() => {
    try {
      const recent = JSON.parse(localStorage.getItem('recentRestaurants') || '[]');
      setRecentRestaurants(recent.filter(r => r._id && r.slug));
    } catch { /* ignore */ }
  }, []);

  // Búsqueda inteligente de productos (debounced)
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!searchTerm || searchTerm.length < 2) {
      setProductSearchResults([]);
      setIsSearchingProducts(false);
      setSearchSuggestions([]);
      return;
    }
    setIsSearchingProducts(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: searchTerm });
        if (location.coordinates) {
          params.set('lat', location.coordinates.lat);
          params.set('lon', location.coordinates.lng);
        }
        const res = await api.get(`/businesses/search/products?${params}`);
        const results = res.data?.data || [];
        if (location.coordinates && results.length > 0) {
          results.forEach(r => {
            if (r.coordinates) r.distance = calculateDistance(location.coordinates, r.coordinates);
          });
        }
        setProductSearchResults(results);
        // Generar sugerencias de búsqueda a partir de productos encontrados
        const productNames = new Set();
        results.forEach(r => r.matchingProducts?.forEach(p => productNames.add(p.name)));
        setSearchSuggestions(Array.from(productNames).slice(0, 5));
      } catch {
        setProductSearchResults([]);
      } finally {
        setIsSearchingProducts(false);
      }
    }, 400);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchTerm, location.coordinates]);

  // Infinite scroll: auto-load more when last card is visible
  useEffect(() => {
    if (!loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount(prev => prev + ITEMS_PER_PAGE); },
      { threshold: 0.1 }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [filteredRestaurants.length]);

  // Reset visible count on filter change
  useEffect(() => { setVisibleCount(ITEMS_PER_PAGE); }, [searchTerm, selectedCategory, sortBy, onlyOpen, onlyFreeDelivery]);
  
  // Función para calcular distancia usando fórmula Haversine
  const calculateDistance = (from, to) => {
    if (!from || !to) return null;
    
    const R = 6371; // Radio de la Tierra en km
    const dLat = toRad(to.lat - from.lat);
    const dLon = toRad(to.lng - from.lng);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return Math.round(distance * 10) / 10; // Redondear a 1 decimal
  };
  
  const toRad = (degrees) => degrees * (Math.PI / 180);

  const loadRestaurants = async () => {
    try {
      setLoading(true);
      
      // Construir URL con parámetros
      const params = new URLSearchParams();
      if (location.coordinates) {
        params.set('lat', location.coordinates.lat);
        params.set('lon', location.coordinates.lng);
      }
      
      const url = `/businesses${params.toString() ? '?' + params.toString() : ''}`;
      const response = await api.get(url);
      
      // Manejar nuevo formato {data, total} o array legacy
      let data = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      setTotalCount(response.data?.total ?? data.length);
      
      // Calcular distancias client-side si hay ubicación
      if (location.coordinates) {
        data = data.map(restaurant => {
          if (restaurant.coordinates) {
            const distance = calculateDistance(location.coordinates, restaurant.coordinates);
            return { ...restaurant, distance };
          }
          return { ...restaurant, distance: null };
        });
      }
      
      // Generar categorías dinámicas
      const categoriesWithRestaurants = new Set();
      data.forEach(restaurant => {
        restaurant.categories?.forEach(cat => categoriesWithRestaurants.add(cat));
      });
      
      const finalCategories = data.length > 0 
        ? ['todo', ...Array.from(categoriesWithRestaurants)]
        : [];
      
      setCategories(finalCategories);
      setRestaurants(data);
    } catch (error) {
      console.error('Error loading restaurants:', error);
      setRestaurants([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const loadFeaturedSections = async () => {
    try {
      const params = new URLSearchParams();
      if (location.coordinates) {
        params.set('lat', location.coordinates.lat);
        params.set('lon', location.coordinates.lng);
      }
      const res = await api.get(`/businesses/featured?${params}`);
      if (res.data?.sections) setFeaturedSections(res.data.sections);
    } catch { /* ignore */ }
  };

  const filterAndSortRestaurants = () => {
    let filtered = [...restaurants];

    // Filtrar por "Abierto ahora"
    if (onlyOpen) {
      filtered = filtered.filter(r => r.isCurrentlyOpen ?? r.isOpen);
    }

    // Filtrar por "Envío gratis"
    if (onlyFreeDelivery) {
      filtered = filtered.filter(r => {
        const pricing = r.deliveryZone?.pricing;
        if (!pricing) return false;
        return (pricing.basePrice === 0 || !pricing.basePrice);
      });
    }

    // Filtrar por término de búsqueda
    if (searchTerm) {
      filtered = filtered.filter(restaurant =>
        restaurant.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        restaurant.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtrar por categoría
    if (selectedCategory !== 'todo') {
      filtered = filtered.filter(restaurant =>
        restaurant.categories && restaurant.categories.includes(selectedCategory)
      );
    }

    // Ordenar
    switch (sortBy) {
      case 'distance':
        // Ordenar por cercanía (solo si hay ubicación)
        if (hasLocation) {
          filtered.sort((a, b) => {
            const distA = a.distance !== null ? a.distance : 999;
            const distB = b.distance !== null ? b.distance : 999;
            return distA - distB;
          });
        }
        break;
      case 'popularity':
        // Ordenar por popularidad real: abiertos primero, luego por popularityScore del backend
        filtered.sort((a, b) => {
          const openA = (a.isCurrentlyOpen ?? a.isOpen) ? 1000 : 0;
          const openB = (b.isCurrentlyOpen ?? b.isOpen) ? 1000 : 0;
          const scoreA = openA + (a.popularityScore || 0);
          const scoreB = openB + (b.popularityScore || 0);
          return scoreB - scoreA;
        });
        break;
      case 'name':
        filtered.sort((a, b) => a.businessName.localeCompare(b.businessName));
        break;
      case 'delivery_time':
        // Ordenar por tiempo estimado de entrega
        filtered.sort((a, b) => {
          const timeA = a.distance ? Math.round(15 + (a.distance * 2)) : 30;
          const timeB = b.distance ? Math.round(15 + (b.distance * 2)) : 30;
          return timeA - timeB;
        });
        break;
      case 'delivery_price':
        // Ordenar por costo de envío (menor a mayor)
        filtered.sort((a, b) => {
          const priceA = a.deliveryZone?.pricing?.basePrice ?? 999999;
          const priceB = b.deliveryZone?.pricing?.basePrice ?? 999999;
          return priceA - priceB;
        });
        break;
      case 'min_price':
        // Ordenar por precio mínimo de producto
        filtered.sort((a, b) => {
          const pA = a.minPrice || 999999;
          const pB = b.minPrice || 999999;
          return pA - pB;
        });
        break;
      default:
        // Por defecto: abiertos primero, luego por popularityScore
        filtered.sort((a, b) => {
          const openA = (a.isCurrentlyOpen ?? a.isOpen) ? 1000 : 0;
          const openB = (b.isCurrentlyOpen ?? b.isOpen) ? 1000 : 0;
          return (openB + (b.popularityScore || 0)) - (openA + (a.popularityScore || 0));
        });
        break;
    }

    setFilteredRestaurants(filtered);
  };

  const categoryIcons = {
    todo: '🍽️',
    hamburguesas: '🍔',
    pollo: '🍗',
    bebidas: '🥤',
    pizza: '🍕',
    postres: '🍰',
    sandwich: '🥪',
    papas: '🍟',
    ensaladas: '🥗',
    combos: '🎁',
    asiatica: '🍜',
    mexicana: '🌮',
    pasta: '🍝',
    mariscos: '🦐',
    carnes: '🥩'
  };

  const categoryNames = {
    todo: 'Todo',
    hamburguesas: 'Hamburguesas',
    pollo: 'Pollo',
    bebidas: 'Bebidas',
    pizza: 'Pizza',
    postres: 'Postres',
    sandwich: 'Sándwiches',
    papas: 'Papas',
    ensaladas: 'Ensaladas',
    combos: 'Combos',
    asiatica: 'Asiática',
    mexicana: 'Mexicana',
    pasta: 'Pasta',
    mariscos: 'Mariscos',
    carnes: 'Carnes'
  };
  
  // Función para obtener icono de una categoría (con fallback)
  const getCategoryIcon = (category) => {
    return categoryIcons[category?.toLowerCase()] || '🍴';
  };
  
  // Función para obtener nombre de una categoría (con fallback)
  const getCategoryName = (category) => {
    return categoryNames[category?.toLowerCase()] || 
           category?.charAt(0).toUpperCase() + category?.slice(1).replace(/_/g, ' ');
  };

  // Favoritos del usuario
  const favoriteRestaurants = useMemo(() => {
    return restaurants.filter(r => isFav(r._id));
  }, [restaurants, isFav]);

  // Restaurantes visibles (paginados)
  const visibleRestaurants = useMemo(() => {
    return filteredRestaurants.slice(0, visibleCount);
  }, [filteredRestaurants, visibleCount]);

  const hasMore = visibleCount < filteredRestaurants.length;

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'Buenos días';
    if (h >= 12 && h < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* ═══ STICKY HEADER ═══ */}
      <header className={`sticky top-0 z-40 transition-all duration-300 bg-white ${headerCompact ? 'shadow-sm' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Greeting + Location */}
          {!headerCompact ? (
            <div className="pt-4 pb-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-gray-400 font-medium">{getGreeting()} 👋</p>
                  <h1 className="text-[22px] font-extrabold text-gray-900 leading-tight mt-0.5">¿Qué quieres comer?</h1>
                </div>
                <div className="w-9 h-9 rounded-xl overflow-hidden ring-1 ring-gray-100 flex-shrink-0">
                  <img src="/logo.jpeg" alt="MenuBy" className="w-full h-full object-cover" />
                </div>
              </div>
              <button onClick={updateLocation} className="flex items-center gap-1 text-[12px] text-gray-500 hover:text-red-500 transition-colors mt-1">
                <LocationIcon />
                <span className="truncate max-w-[250px]">{locationLoading ? 'Detectando ubicación...' : location.address}</span>
                <svg className="w-2.5 h-2.5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between py-2">
              <button onClick={updateLocation} className="flex items-center gap-1 text-[13px] text-gray-600 font-medium truncate min-w-0">
                <LocationIcon />
                <span className="truncate max-w-[200px]">{locationLoading ? 'Detectando...' : location.address}</span>
              </button>
              <div className="w-7 h-7 rounded-lg overflow-hidden ring-1 ring-gray-100 flex-shrink-0 ml-3">
                <img src="/logo.jpeg" alt="MenuBy" className="w-full h-full object-cover" />
              </div>
            </div>
          )}

          {/* Search bar */}
          <div className={`relative transition-all duration-300 ${headerCompact ? 'pb-2' : 'pb-3'}`}>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <SearchIcon />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar restaurantes, platos, antojos..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className={`w-full pl-10 pr-10 bg-gray-100/80 border border-transparent rounded-xl text-gray-900 placeholder-gray-400 
                  focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-300 focus:bg-white focus:shadow-lg focus:shadow-red-500/5 
                  transition-all duration-200 ${headerCompact ? 'py-2 text-sm' : 'py-2.5 text-[15px]'}`}
              />
              {searchTerm && (
                <button
                  onClick={() => { setSearchTerm(''); searchInputRef.current?.focus(); }}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-300 hover:text-gray-500 active:text-gray-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              {isSearchingProducts && (
                <div className="absolute inset-y-0 right-8 flex items-center">
                  <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Suggestions dropdown */}
            <AnimatePresence>
              {showSuggestions && searchSuggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-2xl shadow-black/10 border border-gray-100 overflow-hidden z-50"
                >
                  <div className="p-1.5">
                    <p className="text-[9px] text-gray-400 font-semibold tracking-wider px-2.5 py-1 uppercase">Sugerencias</p>
                    {searchSuggestions.map((s, i) => (
                      <button
                        key={i}
                        onMouseDown={(e) => { e.preventDefault(); setSearchTerm(s); setShowSuggestions(false); }}
                        className="w-full text-left px-2.5 py-2 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 rounded-lg transition-colors flex items-center gap-2.5"
                      >
                        <span className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                          <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </span>
                        <span className="font-medium">{s}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8">
        {/* Banner */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-5">
          <BannerCarousel />
        </motion.div>

        {/* ─── DISCOVERY SECTIONS ─── */}

        {/* Favorites */}
        {favoriteRestaurants.length > 0 && (
          <HorizontalSection title="Mis favoritos" subtitle={`${favoriteRestaurants.length} restaurantes`} icon="❤️">
            {favoriteRestaurants.map(r => (
              <div key={`fav-${r._id}`} className="snap-start"><RestaurantCard restaurant={r} userLocation={location.coordinates} variant="compact" /></div>
            ))}
          </HorizontalSection>
        )}

        {/* Trending */}
        {featuredSections?.trending?.data?.length > 0 && (
          <HorizontalSection title={featuredSections.trending.title} subtitle={featuredSections.trending.subtitle}>
            {featuredSections.trending.data.map(r => (
              <div key={`trend-${r._id}`} className="snap-start"><RestaurantCard restaurant={r} userLocation={location.coordinates} variant="compact" /></div>
            ))}
          </HorizontalSection>
        )}

        {/* New arrivals */}
        {!loading && restaurants.filter(r => r.isNew).length > 0 && (
          <HorizontalSection title="Recién llegados" subtitle="Nuevos en MenuBy" icon="✨">
            {restaurants.filter(r => r.isNew).map(r => (
              <div key={`new-${r._id}`} className="snap-start"><RestaurantCard restaurant={r} userLocation={location.coordinates} variant="compact" /></div>
            ))}
          </HorizontalSection>
        )}

        {/* Cheap eats */}
        {featuredSections?.cheapEats?.data?.length > 0 && (
          <HorizontalSection title={featuredSections.cheapEats.title} subtitle={featuredSections.cheapEats.subtitle} icon="💰">
            {featuredSections.cheapEats.data.map(r => (
              <div key={`cheap-${r._id}`} className="snap-start"><RestaurantCard restaurant={r} userLocation={location.coordinates} variant="compact" /></div>
            ))}
          </HorizontalSection>
        )}

        {/* Recently visited */}
        {recentRestaurants.length > 0 && (
          <HorizontalSection title="Visitados recientemente" icon="🕐">
            {recentRestaurants.map((recent) => (
              <Link key={`recent-${recent._id}`} to={`/${recent.slug}`}
                className="snap-start flex-shrink-0 flex items-center gap-2 bg-white rounded-xl px-3 py-2 shadow-sm border border-gray-100/80 hover:shadow-md hover:border-red-200 active:scale-[0.97] transition-all group">
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  {recent.logo ? (
                    <img src={recent.logo} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-red-400 to-red-500 flex items-center justify-center">
                      <span className="text-white text-[10px] font-bold">{recent.businessName?.charAt(0)}</span>
                    </div>
                  )}
                </div>
                <span className="text-xs font-medium text-gray-600 group-hover:text-red-600 transition-colors whitespace-nowrap max-w-[80px] truncate">
                  {recent.businessName}
                </span>
              </Link>
            ))}
          </HorizontalSection>
        )}

        {/* ─── CATEGORIES ─── */}
        <div className="mb-5 -mx-4 px-4">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
              >
                <div className={`w-[56px] h-[56px] rounded-2xl flex items-center justify-center text-2xl transition-all duration-200 ${
                  selectedCategory === category
                    ? 'bg-red-50 ring-2 ring-red-500 shadow-sm shadow-red-500/10'
                    : 'bg-gray-50 group-hover:bg-gray-100 group-active:scale-95'
                }`}>
                  {getCategoryIcon(category)}
                </div>
                <span className={`text-[11px] font-medium transition-colors whitespace-nowrap ${
                  selectedCategory === category ? 'text-red-500' : 'text-gray-500'
                }`}>
                  {getCategoryName(category)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ─── FILTERS & SORT BAR ─── */}
        <div className="mb-5 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[17px] font-bold text-gray-900">Restaurantes</h2>
            <span className="text-[12px] text-gray-400">{filteredRestaurants.length} disponibles</span>
          </div>

          {/* Filter + Sort row */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-0.5 -mx-1 px-1">
            {/* Open now toggle */}
            <button
              onClick={() => setOnlyOpen(!onlyOpen)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all active:scale-95 flex-shrink-0 ${
                onlyOpen
                  ? 'bg-green-500 text-white shadow-md shadow-green-500/25'
                  : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-gray-300'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${onlyOpen ? 'bg-white' : 'bg-green-500'}`} />
              Abierto
            </button>

            {/* Free delivery toggle */}
            <button
              onClick={() => setOnlyFreeDelivery(!onlyFreeDelivery)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all active:scale-95 flex-shrink-0 ${
                onlyFreeDelivery
                  ? 'bg-blue-500 text-white shadow-md shadow-blue-500/25'
                  : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-gray-300'
              }`}
            >
              🛵 Envío gratis
            </button>

            {/* Divider */}
            <div className="w-px h-5 bg-gray-200 flex-shrink-0" />

            {/* Sort options */}
            {[
              ...(hasLocation ? [{ key: 'distance', label: '📍 Cercanos' }] : []),
              { key: 'popularity', label: '🔥 Populares' },
              { key: 'name', label: 'A-Z' },
              { key: 'delivery_time', label: '⚡ Rápidos' },
              { key: 'delivery_price', label: 'Envío ↓' },
              { key: 'min_price', label: '💰 Baratos' },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all active:scale-95 flex-shrink-0 ${
                  sortBy === opt.key
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'bg-white text-gray-500 ring-1 ring-gray-200 hover:ring-gray-300 hover:text-gray-700'
                }`}
              >{opt.label}</button>
            ))}
          </div>

          {/* Active filters summary */}
          {(onlyOpen || onlyFreeDelivery || selectedCategory !== 'todo') && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400">Filtros:</span>
              <div className="flex gap-1.5 flex-wrap">
                {onlyOpen && (
                  <button onClick={() => setOnlyOpen(false)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-50 text-green-700 text-[10px] font-medium hover:bg-green-100 transition-colors">
                    Abierto <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
                {onlyFreeDelivery && (
                  <button onClick={() => setOnlyFreeDelivery(false)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-medium hover:bg-blue-100 transition-colors">
                    Envío gratis <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
                {selectedCategory !== 'todo' && (
                  <button onClick={() => setSelectedCategory('todo')} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-medium hover:bg-gray-200 transition-colors">
                    {getCategoryName(selectedCategory)} <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
              <button
                onClick={() => { setOnlyOpen(false); setOnlyFreeDelivery(false); setSelectedCategory('todo'); setSearchTerm(''); }}
                className="text-[10px] text-red-500 font-medium hover:text-red-600 ml-auto"
              >
                Limpiar todo
              </button>
            </motion.div>
          )}
        </div>

        {/* ─── PRODUCT SEARCH RESULTS ─── */}
        {searchTerm && productSearchResults.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                <span className="text-sm">🔍</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Restaurantes con "{searchTerm}"</h3>
                <p className="text-[10px] text-gray-400">{productSearchResults.length} encontrados</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {productSearchResults.map((restaurant) => (
                <RestaurantCard key={`pm-${restaurant._id}`} restaurant={restaurant} userLocation={location.coordinates} />
              ))}
            </div>
            {filteredRestaurants.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 font-medium">Todos los restaurantes</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ═══ MAIN GRID ═══ */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={`sk-${i}`} />)}
          </div>
        ) : filteredRestaurants.length === 0 ? (
          /* ─── Empty State ─── */
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20 px-4"
          >
            <div className="bg-white rounded-2xl p-8 text-center max-w-xs shadow-sm border border-gray-100">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                <motion.span
                  animate={{ rotate: [0, -8, 8, -8, 0] }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="text-4xl"
                >
                  {searchTerm ? '🔍' : onlyOpen ? '🕐' : '🍽️'}
                </motion.span>
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1.5">No encontramos restaurantes</h3>
              <p className="text-gray-500 text-xs mb-5 leading-relaxed">
                {searchTerm ? (
                  productSearchResults.length > 0
                    ? <>Sin coincidencias por nombre, pero hay productos arriba ☝️</>
                    : <>No hay resultados para "<strong>{searchTerm}</strong>". Prueba: pizza, hamburguesa, pollo...</>
                ) : onlyOpen
                  ? <>No hay restaurantes abiertos ahora. Prueba más tarde.</>
                  : onlyFreeDelivery
                    ? <>Sin restaurantes con envío gratis actualmente.</>
                    : selectedCategory !== 'todo'
                      ? <>No hay restaurantes en <strong>{getCategoryName(selectedCategory)}</strong></>
                      : <>Pronto tendremos más restaurantes.</>
                }
              </p>
              <button
                onClick={() => { setSearchTerm(''); setSelectedCategory('todo'); setOnlyOpen(false); setOnlyFreeDelivery(false); }}
                className="w-full bg-gray-900 hover:bg-gray-800 active:bg-black text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >Ver todos</button>
            </div>
          </motion.div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleRestaurants.map((restaurant, index) => (
                <motion.div
                  key={restaurant._id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.04, 0.2), duration: 0.3 }}
                >
                  <RestaurantCard restaurant={restaurant} userLocation={location.coordinates} />
                </motion.div>
              ))}
            </div>

            {/* Load more trigger */}
            {hasMore && (
              <div ref={loadMoreRef} className="flex flex-col items-center py-10 gap-3">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:0ms]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:150ms]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:300ms]" />
                </div>
                <button
                  onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}
                  className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors"
                >
                  Cargar más ({filteredRestaurants.length - visibleCount} restantes)
                </button>
              </div>
            )}

            {/* End of list indicator */}
            {!hasMore && filteredRestaurants.length > ITEMS_PER_PAGE && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center py-8"
              >
                <p className="text-xs text-gray-400">Mostrando {filteredRestaurants.length} restaurantes</p>
                <button
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="mt-2 text-xs text-red-500 hover:text-red-600 font-medium transition-colors"
                >↑ Volver arriba</button>
              </motion.div>
            )}
          </>
        )}
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-gray-100 mt-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-center gap-2 text-[11px] text-gray-400">
            <div className="w-5 h-5 rounded-md overflow-hidden ring-1 ring-gray-100">
              <img src="/logo.jpeg" alt="MenuBy" className="w-full h-full object-cover" />
            </div>
            <span className="font-semibold text-gray-500">MenuBy</span>
            <span>·</span>
            <span>{totalCount || restaurants.length} restaurantes</span>
            <span>·</span>
            <span>{location.city || 'Colombia'}</span>
          </div>
          <p className="text-[9px] text-gray-300 text-center mt-3">© {new Date().getFullYear()} MenuBy</p>
        </div>
      </footer>
    </div>
  );
};

export default MenuByCatalog;