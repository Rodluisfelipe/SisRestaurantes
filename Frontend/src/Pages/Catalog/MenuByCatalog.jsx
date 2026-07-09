import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import RestaurantCard, { useFavorites } from '../../Components/Catalog/RestaurantCard';
import BannerCarousel from '../../Components/Catalog/BannerCarousel';
import LocationPicker from '../../Components/Catalog/LocationPicker';
import { useUserLocation } from '../../hooks/useUserLocation';

// ─── Skeleton ──────────────────────────────────────
const CardSkeleton = () => (
  <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
    <div className="aspect-[16/9] bg-gray-100 relative overflow-hidden">
      <div className="absolute inset-0 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-gray-100 via-white to-gray-100" />
    </div>
    <div className="p-3.5">
      <div className="flex gap-3 items-start">
        <div className="w-11 h-11 rounded-xl bg-gray-100 flex-shrink-0 -mt-8 shadow-sm" />
        <div className="flex-1 space-y-2 pt-0.5">
          <div className="h-4 bg-gray-100 rounded-lg w-3/4 animate-pulse" />
          <div className="h-3 bg-gray-100 rounded-lg w-1/2 animate-pulse" />
        </div>
      </div>
    </div>
  </div>
);

// ─── Horizontal Scroll Section ─────────────────────
const HorizontalSection = ({ title, children, onSeeAll }) => (
  <div className="mb-7">
    <div className="flex items-center justify-between mb-3.5 px-0.5">
      <h3 className="text-[17px] font-extrabold text-gray-900 tracking-tight">{title}</h3>
      {onSeeAll && (
        <button onClick={onSeeAll} className="flex items-center gap-0.5 text-[12px] font-bold text-red-500 hover:text-red-600 active:scale-95 transition-all">
          Ver todos
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">{children}</div>
  </div>
);

const ITEMS_PER_PAGE = 12;

const MenuByCatalog = () => {
  const navigate = useNavigate();
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
  const [fetchError, setFetchError] = useState(false);
  const searchTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);
  const loadMoreRef = useRef(null);
  const { isFav } = useFavorites();

  // Hook de ubicación dinámica
  const { location, updateLocation, setManualLocation, hasLocation, isLoading: locationLoading } = useUserLocation();
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // Usar primitivos como dependencias para evitar comparación por referencia de objeto
  const coordLat = location.coordinates?.lat;
  const coordLng = location.coordinates?.lng;

  useEffect(() => {
    if (!locationLoading && coordLat && coordLng) {
      loadRestaurants();
      loadFeaturedSections();
    } else if (!locationLoading && !coordLat) {
      setRestaurants([]);
      setCategories([]);
      setLoading(false);
    }
  }, [coordLat, coordLng, locationLoading]);

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
      setFetchError(false);
    } catch (error) {
      console.error('Error loading restaurants:', error);
      setFetchError(true);
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

    // Filtrar por "Envío gratis" — solo negocios con basePrice explícitamente en 0
    if (onlyFreeDelivery) {
      filtered = filtered.filter(r => {
        const pricing = r.deliveryZone?.pricing;
        return pricing != null && pricing.basePrice === 0;
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ═══ HEADER ═══ */}
      <header className="sticky top-0 z-40">
        {/* Red top bar */}
        <div className={`transition-all duration-300 ${headerCompact ? 'bg-white border-b border-gray-100' : 'bg-gradient-to-b from-red-500 to-red-600'}`}>
          <div className="max-w-3xl mx-auto px-4">
            {/* Top row: Logo + Location + Avatar */}
            <div className={`flex items-center justify-between gap-3 transition-all ${headerCompact ? 'py-2' : 'pt-3.5 pb-2'}`}>
              {/* Left: Logo */}
              <div className={`flex-shrink-0 transition-all ${headerCompact ? 'w-7 h-7' : 'w-8 h-8'}`}>
                <img src="/logo.jpeg" alt="MenuBy" className="w-full h-full object-cover rounded-xl" />
              </div>

              {/* Center: Location */}
              <button onClick={() => setShowLocationPicker(true)} className="flex items-center gap-1.5 min-w-0 flex-1 justify-center group">
                <svg className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${headerCompact ? 'text-red-500' : 'text-white/80'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                <div className="flex flex-col items-start min-w-0">
                  {location.city && !locationLoading && (
                    <span className={`text-[10px] font-semibold uppercase tracking-wide leading-none mb-0.5 transition-colors ${headerCompact ? 'text-gray-400' : 'text-white/60'}`}>
                      Entregando en
                    </span>
                  )}
                  <span className={`text-[13px] font-bold truncate max-w-[180px] transition-colors leading-none ${headerCompact ? 'text-gray-900' : 'text-white'}`}>
                    {locationLoading ? 'Ubicando...' : (location.city || location.address || 'Seleccionar dirección')}
                  </span>
                </div>
                <svg className={`w-3.5 h-3.5 flex-shrink-0 transition-all group-hover:translate-y-0.5 ${headerCompact ? 'text-gray-400' : 'text-white/60'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Right: Notification-like icon */}
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${headerCompact ? 'bg-red-50' : 'bg-white/15'}`}>
                <svg className={`w-[18px] h-[18px] transition-colors ${headerCompact ? 'text-red-500' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
            </div>

            {/* Search bar */}
            <div className={`relative transition-all ${headerCompact ? 'pb-2' : 'pb-3.5'}`}>
              <div className="relative">
                <svg className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] pointer-events-none transition-colors ${headerCompact ? 'text-gray-400' : 'text-red-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="¿Qué se te antoja hoy?"
                  aria-label="Buscar restaurante o plato"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className={`w-full pl-11 pr-10 py-2.5 rounded-xl text-[14px] placeholder-gray-400 focus:outline-none transition-all ${
                    headerCompact
                      ? 'bg-gray-100 text-gray-900 focus:bg-white focus:ring-2 focus:ring-red-100 focus:shadow-md'
                      : 'bg-white/95 text-gray-900 shadow-lg shadow-black/5 focus:bg-white focus:ring-2 focus:ring-white/60'
                  }`}
                />
                {searchTerm && (
                  <button onClick={() => { setSearchTerm(''); searchInputRef.current?.focus(); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors">
                    <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                {isSearchingProducts && (
                  <div className="absolute right-10 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Suggestions */}
              <AnimatePresence>
                {showSuggestions && searchSuggestions.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-xl shadow-black/8 border border-gray-100/80 overflow-hidden z-50 py-1">
                    {searchSuggestions.map((s, i) => (
                      <button key={i} onMouseDown={(e) => { e.preventDefault(); setSearchTerm(s); setShowSuggestions(false); }}
                        className="w-full text-left px-4 py-2.5 text-[14px] text-gray-700 hover:bg-red-50 active:bg-red-100 transition-colors flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                          <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        <span className="font-medium">{s}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* ═══ CONTENT ═══ */}
      <main className="max-w-3xl mx-auto px-4 pb-10">
        {/* Banner */}
        <div className="mb-5 pt-4">
          <BannerCarousel />
        </div>

        {/* Categories */}
        {location.coordinates && categories.length > 0 && (
          <div className="mb-5 -mx-4 px-4">
            <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-hide">
              {categories.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-[13px] font-semibold whitespace-nowrap flex-shrink-0 transition-all duration-200 ${
                    selectedCategory === cat
                      ? 'bg-red-500 text-white shadow-md shadow-red-500/30 scale-[1.02]'
                      : 'bg-white text-gray-600 shadow-sm hover:shadow-md hover:text-gray-900'
                  }`}>
                  <span className="text-[15px] leading-none">{getCategoryIcon(cat)}</span>
                  <span>{getCategoryName(cat)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Featured sections */}
        {location.coordinates && favoriteRestaurants.length > 0 && (
          <HorizontalSection title="Tus favoritos ❤️">
            {favoriteRestaurants.map(r => <RestaurantCard key={`fav-${r._id}`} restaurant={r} userLocation={location.coordinates} variant="compact" />)}
          </HorizontalSection>
        )}

        {location.coordinates && featuredSections?.trending?.data?.length > 0 && (
          <HorizontalSection title="Populares 🔥" onSeeAll={() => { setSortBy('popularity'); document.getElementById('restaurants-list')?.scrollIntoView({ behavior: 'smooth' }); }}>
            {featuredSections.trending.data.map(r => <RestaurantCard key={`t-${r._id}`} restaurant={r} userLocation={location.coordinates} variant="compact" />)}
          </HorizontalSection>
        )}

        {location.coordinates && !loading && restaurants.filter(r => r.isNew).length > 0 && (
          <HorizontalSection title="Nuevos en MenuBy ✨" onSeeAll={() => document.getElementById('restaurants-list')?.scrollIntoView({ behavior: 'smooth' })}>
            {restaurants.filter(r => r.isNew).map(r => <RestaurantCard key={`n-${r._id}`} restaurant={r} userLocation={location.coordinates} variant="compact" />)}
          </HorizontalSection>
        )}

        {location.coordinates && featuredSections?.cheapEats?.data?.length > 0 && (
          <HorizontalSection title="Los más económicos 💰" onSeeAll={() => { setSortBy('min_price'); document.getElementById('restaurants-list')?.scrollIntoView({ behavior: 'smooth' }); }}>
            {featuredSections.cheapEats.data.map(r => <RestaurantCard key={`c-${r._id}`} restaurant={r} userLocation={location.coordinates} variant="compact" />)}
          </HorizontalSection>
        )}

        {location.coordinates && recentRestaurants.length > 0 && (
          <HorizontalSection title="Pediste hace poco">
            {recentRestaurants.map(r => (
              <Link key={`re-${r._id}`} to={`/${r.slug}`}
                className="flex-shrink-0 flex items-center gap-2.5 bg-white rounded-2xl pl-2 pr-4 py-2 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-red-50 flex-shrink-0 shadow-sm">
                  {r.logo
                    ? <img src={r.logo} alt="" className="w-full h-full object-cover" loading="lazy" />
                    : <div className="w-full h-full flex items-center justify-center text-[13px] text-red-400 font-bold">{r.businessName?.charAt(0)}</div>}
                </div>
                <span className="text-[13px] font-semibold text-gray-800 whitespace-nowrap">{r.businessName}</span>
              </Link>
            ))}
          </HorizontalSection>
        )}

        {/* Divider + title */}
        {location.coordinates && (
          <div id="restaurants-list" className="flex items-center justify-between mt-2 mb-4">
            <h2 className="text-[18px] font-extrabold text-gray-900 tracking-tight">Restaurantes</h2>
            <span className="text-[12px] font-bold text-red-500 bg-red-50 px-3 py-1 rounded-full">{filteredRestaurants.length} disponibles</span>
          </div>
        )}

        {/* Filter bar */}
        {location.coordinates && (
        <div className="mb-5 -mx-4 px-4">
          <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-hide">
            {[
              { id: 'popularity', label: '🔥 Populares', isSort: true },
              { id: 'open', label: '🟢 Abierto', isToggle: true, active: onlyOpen, onClick: () => setOnlyOpen(!onlyOpen) },
              { id: 'free', label: '🛵 Envío gratis', isToggle: true, active: onlyFreeDelivery, onClick: () => setOnlyFreeDelivery(!onlyFreeDelivery) },
              ...(hasLocation ? [{ id: 'distance', label: '📍 Cercanos', isSort: true }] : []),
              { id: 'delivery_time', label: '⚡ Rápido', isSort: true },
              { id: 'min_price', label: '💰 Precio ↓', isSort: true },
            ].map(f => {
              const isActive = f.isSort ? sortBy === f.id : f.active;
              return (
                <button key={f.id}
                  onClick={f.onClick || (() => setSortBy(f.id))}
                  className={`px-3.5 py-2 rounded-2xl text-[13px] font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                    isActive
                      ? 'bg-red-500 text-white shadow-md shadow-red-500/30'
                      : 'bg-white text-gray-600 shadow-sm hover:shadow-md hover:text-gray-900'
                  }`}>
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
        )}

        {/* Product search results */}
        {searchTerm && productSearchResults.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div>
                <p className="text-[14px] font-bold text-gray-900">Resultados para "{searchTerm}"</p>
                <p className="text-[11px] text-gray-400">{productSearchResults.length} restaurantes</p>
              </div>
            </div>
            <div className="space-y-4">
              {productSearchResults.map(r => <RestaurantCard key={`pm-${r._id}`} restaurant={r} userLocation={location.coordinates} />)}
            </div>
            {filteredRestaurants.length > 0 && <div className="border-t border-gray-200 mt-6 pt-4"><p className="text-[13px] text-gray-400 font-semibold">Todos los restaurantes</p></div>}
          </div>
        )}

        {/* No-location state */}
        {!locationLoading && !location.coordinates && (
          <div className="text-center py-16 px-4">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center mx-auto mb-5 shadow-sm">
              <svg className="w-9 h-9 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </div>
            <p className="text-[17px] font-extrabold text-gray-900 mb-1.5 tracking-tight">¿Dónde te entregamos?</p>
            <p className="text-[13px] text-gray-500 mb-6 max-w-[240px] mx-auto leading-relaxed">
              Necesitamos tu ubicación para mostrarte los restaurantes disponibles en tu zona
            </p>
            <div className="flex flex-col gap-2.5 items-center">
              <button onClick={updateLocation}
                className="px-6 py-3 bg-red-500 text-white text-[14px] font-bold rounded-2xl shadow-lg shadow-red-500/25 hover:bg-red-600 active:scale-95 transition-all flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                Usar mi GPS
              </button>
              <button onClick={() => setShowLocationPicker(true)}
                className="text-[13px] font-semibold text-red-500 hover:text-red-600 transition-colors">
                Ingresar dirección manualmente
              </button>
            </div>
          </div>
        )}

        {/* Error state */}
        {location.coordinates && fetchError && !loading && (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-3xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-9 h-9 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <p className="text-[16px] font-bold text-gray-900 mb-1">Error al cargar restaurantes</p>
            <p className="text-[13px] text-gray-500 mb-6 max-w-[260px] mx-auto">Verifica tu conexión a internet e inténtalo de nuevo.</p>
            <button onClick={loadRestaurants}
              className="px-6 py-2.5 bg-red-500 text-white text-[14px] font-bold rounded-2xl shadow-lg shadow-red-500/25 hover:bg-red-600 active:scale-95 transition-all">
              Reintentar
            </button>
          </div>
        )}

        {/* Main list */}
        {location.coordinates && loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : location.coordinates && !fetchError && filteredRestaurants.length === 0 ? (() => {
          const isFiltered = onlyOpen || onlyFreeDelivery || selectedCategory !== 'todo' || !!searchTerm;
          const emptyTitle = searchTerm
            ? `Sin resultados para "${searchTerm}"`
            : onlyOpen
            ? 'No hay abiertos ahora'
            : onlyFreeDelivery
            ? 'Sin envío gratis disponible'
            : selectedCategory !== 'todo'
            ? `Sin restaurantes en "${getCategoryName(selectedCategory)}"`
            : 'Sin cobertura en tu zona';
          const emptyDesc = searchTerm
            ? 'Intenta con otro nombre o revisa la ortografía.'
            : onlyOpen || onlyFreeDelivery || selectedCategory !== 'todo'
            ? 'Prueba quitando algún filtro para ver más opciones.'
            : 'No hay restaurantes con cobertura en tu ubicación actual. Prueba otra dirección.';
          return (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-3xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">{searchTerm ? '🔍' : isFiltered ? '🔎' : '📍'}</span>
              </div>
              <p className="text-[16px] font-bold text-gray-900 mb-1">{emptyTitle}</p>
              <p className="text-[13px] text-gray-500 mb-6 max-w-[260px] mx-auto">{emptyDesc}</p>
              {isFiltered && (
                <button onClick={() => { setSearchTerm(''); setSelectedCategory('todo'); setOnlyOpen(false); setOnlyFreeDelivery(false); }}
                  className="px-6 py-2.5 bg-white text-gray-700 text-[14px] font-bold rounded-2xl shadow-sm border border-gray-200 hover:bg-gray-50 active:scale-95 transition-all mr-2">
                  Limpiar filtros
                </button>
              )}
              <button onClick={updateLocation}
                className="px-6 py-2.5 bg-red-500 text-white text-[14px] font-bold rounded-2xl shadow-lg shadow-red-500/25 hover:bg-red-600 active:scale-95 transition-all">
                Cambiar ubicación
              </button>
            </div>
          );
        })() : (
          <div className="space-y-4">
            {visibleRestaurants.map((restaurant) => (
              <motion.div key={restaurant._id} layout transition={{ duration: 0.2 }}>
                <RestaurantCard restaurant={restaurant} userLocation={location.coordinates} />
              </motion.div>
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && (
          <div ref={loadMoreRef} className="flex justify-center py-10">
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-300 animate-bounce [animation-delay:0ms]" />
              <div className="w-2 h-2 rounded-full bg-red-400 animate-bounce [animation-delay:150ms]" />
              <div className="w-2 h-2 rounded-full bg-red-500 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        {!hasMore && filteredRestaurants.length > ITEMS_PER_PAGE && (
          <div className="text-center py-10">
            <p className="text-[12px] text-gray-400 font-medium">{filteredRestaurants.length} restaurantes</p>
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="mt-2 text-[12px] text-red-500 font-bold hover:text-red-600 transition-colors">↑ Volver arriba</button>
          </div>
        )}
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer className="bg-white border-t border-gray-100 py-6">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-center gap-2">
          <div className="w-6 h-6 rounded-lg overflow-hidden">
            <img src="/logo.jpeg" alt="MenuBy" className="w-full h-full object-cover" />
          </div>
          <span className="text-[13px] font-bold text-red-500">MenuBy</span>
          <span className="text-gray-300">·</span>
          <span className="text-[12px] text-gray-400">{location.city || 'Colombia'}</span>
        </div>
      </footer>

      {/* Location Picker Sheet */}
      <LocationPicker
        open={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSelect={(coords, address, city) => {
          setManualLocation(coords, address, city);
        }}
        onRequestGPS={() => {
          updateLocation();
          setShowLocationPicker(false);
        }}
        currentAddress={location.address}
        currentCoords={location.coordinates}
      />
    </div>
  );
};

export default MenuByCatalog;