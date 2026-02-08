import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import RestaurantCard, { useFavorites } from '../../Components/Catalog/RestaurantCard';
import BannerCarousel from '../../Components/Catalog/BannerCarousel';
import { useUserLocation } from '../../hooks/useUserLocation';

// Iconos SVG
const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const LocationIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

// Shimmer skeleton component
const CardSkeleton = () => (
  <div className="bg-white rounded-3xl shadow-lg overflow-hidden">
    <div className="h-44 bg-gray-200 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse" />
    </div>
    <div className="p-3.5">
      <div className="h-5 bg-gray-200 rounded-lg w-3/4 mb-2 animate-pulse" />
      <div className="h-3 bg-gray-100 rounded w-full mb-3 animate-pulse" />
      <div className="flex gap-2">
        <div className="h-3 bg-gray-100 rounded w-14 animate-pulse" />
        <div className="h-3 bg-gray-100 rounded w-16 animate-pulse" />
        <div className="h-3 bg-gray-100 rounded w-12 animate-pulse" />
      </div>
    </div>
  </div>
);

// Horizontal section component  
const HorizontalSection = ({ title, subtitle, icon, children, onSeeAll }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
    <div className="flex items-center justify-between mb-2.5 px-1">
      <div>
        <h3 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
          {icon} {title}
        </h3>
        {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {onSeeAll && (
        <button onClick={onSeeAll} className="text-xs text-red-500 font-semibold hover:text-red-600 transition-colors">
          Ver todos →
        </button>
      )}
    </div>
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">{children}</div>
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header sticky con colapso */}
      <div className={`sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-gray-200/50 shadow-sm transition-all duration-300 ${headerCompact ? 'py-2' : 'py-0'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Logo y ubicación */}
          <div className={`flex items-center justify-between transition-all duration-300 ${headerCompact ? 'py-1' : 'py-3'}`}>
            <div className="flex items-center space-x-3">
              <div className={`rounded-xl shadow-lg overflow-hidden bg-white transition-all duration-300 ${headerCompact ? 'w-8 h-8' : 'w-11 h-11'}`}>
                <img src="/logo.jpeg" alt="MenuBy" className="w-full h-full object-cover" />
              </div>
              <div>
                <h1 className={`font-bold text-gray-900 transition-all duration-300 ${headerCompact ? 'text-lg' : 'text-xl'}`}>
                  MenuBy
                </h1>
                {!headerCompact && (
                  <div className="flex items-center space-x-1 text-xs">
                    <LocationIcon />
                    {locationLoading ? (
                      <span className="text-gray-400 animate-pulse">Detectando...</span>
                    ) : (
                      <button onClick={updateLocation} className="text-gray-600 hover:text-red-600 transition-colors flex items-center gap-1 group">
                        <span className="max-w-[180px] truncate">{location.address}</span>
                        <svg className="w-3 h-3 text-gray-400 group-hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="px-2.5 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] font-bold rounded-full">BETA</div>
          </div>

          {/* Barra de búsqueda con sugerencias */}
          <div className="relative pb-3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <SearchIcon />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="¿Qué quieres comer hoy?"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="w-full pl-11 pr-10 py-3 bg-gray-100 border-0 rounded-2xl text-gray-900 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all duration-200"
              />
              {searchTerm && (
                <button
                  onClick={() => { setSearchTerm(''); searchInputRef.current?.focus(); }}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              {isSearchingProducts && (
                <div className="absolute inset-y-0 right-8 flex items-center">
                  <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Sugerencias dropdown */}
            <AnimatePresence>
              {showSuggestions && searchSuggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50"
                >
                  <div className="p-2">
                    <p className="text-[10px] text-gray-400 font-medium px-2 mb-1">PRODUCTOS ENCONTRADOS</p>
                    {searchSuggestions.map((s, i) => (
                      <button
                        key={i}
                        onMouseDown={(e) => { e.preventDefault(); setSearchTerm(s); setShowSuggestions(false); }}
                        className="w-full text-left px-2 py-1.5 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <span className="text-gray-400 text-xs">🔍</span>
                        {s}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Banner */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <BannerCarousel />
        </motion.div>

        {/* Sección: Favoritos */}
        {favoriteRestaurants.length > 0 && (
          <HorizontalSection title="Mis favoritos" subtitle={`${favoriteRestaurants.length} restaurantes`} icon="❤️">
            {favoriteRestaurants.map(r => (
              <RestaurantCard key={`fav-${r._id}`} restaurant={r} userLocation={location.coordinates} variant="compact" />
            ))}
          </HorizontalSection>
        )}

        {/* Sección: Trending (from featured API) */}
        {featuredSections?.trending?.data?.length > 0 && (
          <HorizontalSection title={featuredSections.trending.title} subtitle={featuredSections.trending.subtitle} icon="">
            {featuredSections.trending.data.map(r => (
              <RestaurantCard key={`trend-${r._id}`} restaurant={r} userLocation={location.coordinates} variant="compact" />
            ))}
          </HorizontalSection>
        )}

        {/* Sección: Nuevos */}
        {!loading && restaurants.filter(r => r.isNew).length > 0 && (
          <HorizontalSection title="Recién llegados" subtitle="Nuevos en MenuBy" icon="✨">
            {restaurants.filter(r => r.isNew).map(r => (
              <RestaurantCard key={`new-${r._id}`} restaurant={r} userLocation={location.coordinates} variant="compact" />
            ))}
          </HorizontalSection>
        )}

        {/* Sección: Comer barato (from featured API) */}
        {featuredSections?.cheapEats?.data?.length > 0 && (
          <HorizontalSection title={featuredSections.cheapEats.title} subtitle={featuredSections.cheapEats.subtitle} icon="">
            {featuredSections.cheapEats.data.map(r => (
              <RestaurantCard key={`cheap-${r._id}`} restaurant={r} userLocation={location.coordinates} variant="compact" />
            ))}
          </HorizontalSection>
        )}

        {/* Sección: Recién visitados */}
        {recentRestaurants.length > 0 && (
          <HorizontalSection title="Visitados recientemente" icon="🕐">
            {recentRestaurants.map((recent) => (
              <Link key={`recent-${recent._id}`} to={`/${recent.slug}`}
                className="flex-shrink-0 flex items-center gap-2 bg-white rounded-xl px-3 py-2 shadow-sm border border-gray-100 hover:shadow-md hover:border-red-200 transition-all group">
                <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100">
                  {recent.logo ? (
                    <img src={recent.logo} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-red-400 to-red-500 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{recent.businessName?.charAt(0)}</span>
                    </div>
                  )}
                </div>
                <span className="text-xs font-medium text-gray-700 group-hover:text-red-600 transition-colors whitespace-nowrap max-w-[90px] truncate">
                  {recent.businessName}
                </span>
              </Link>
            ))}
          </HorizontalSection>
        )}

        {/* Categorías */}
        <div className="mb-5">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold whitespace-nowrap text-sm transition-all duration-200 ${
                  selectedCategory === category
                    ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/30'
                    : 'bg-white text-gray-700 hover:bg-gray-50 shadow-sm border border-gray-100'
                }`}
              >
                <span className="text-base">{getCategoryIcon(category)}</span>
                <span>{getCategoryName(category)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Título + filtros + sort */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Restaurantes {location.city ? `en ${location.city}` : ''}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {filteredRestaurants.length} disponibles{totalCount > filteredRestaurants.length && ` de ${totalCount}`}
              </p>
            </div>
          </div>

          {/* Filtros rápidos */}
          <div className="flex flex-wrap gap-2 mb-3">
            {/* Abierto ahora */}
            <button
              onClick={() => setOnlyOpen(!onlyOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                onlyOpen ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${onlyOpen ? 'bg-white animate-pulse' : 'bg-green-500'}`} />
              Abierto ahora
            </button>
            {/* Envío gratis */}
            <button
              onClick={() => setOnlyFreeDelivery(!onlyFreeDelivery)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                onlyFreeDelivery ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              🛵 Envío gratis
            </button>
          </div>

          {/* Sort chips para desktop + dropdown para móvil */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium flex-shrink-0">Ordenar:</span>
            {/* Desktop chips */}
            <div className="hidden md:flex gap-1.5">
              {[
                ...(hasLocation ? [{ key: 'distance', label: '📍 Cercanos' }] : []),
                { key: 'popularity', label: '🔥 Populares' },
                { key: 'name', label: '🔤 A-Z' },
                { key: 'delivery_time', label: '⚡ Rápidos' },
                { key: 'delivery_price', label: '🛵 Envío bajo' },
                { key: 'min_price', label: '💰 Precio bajo' },
              ].map(opt => (
                <button key={opt.key} onClick={() => setSortBy(opt.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    sortBy === opt.key
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                >{opt.label}</button>
              ))}
            </div>
            {/* Mobile dropdown */}
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
              className="md:hidden flex-1 bg-gray-900 text-white px-3 py-2 pr-8 rounded-lg text-xs font-semibold appearance-none focus:outline-none"
            >
              {hasLocation && <option value="distance">📍 Más cercanos</option>}
              <option value="popularity">🔥 Más populares</option>
              <option value="name">🔤 Nombre A-Z</option>
              <option value="delivery_time">⚡ Más rápidos</option>
              <option value="delivery_price">🛵 Envío más bajo</option>
              <option value="min_price">💰 Precio más bajo</option>
            </select>
          </div>
        </div>

        {/* Resultados de búsqueda por producto */}
        {searchTerm && productSearchResults.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <h3 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
              🔍 Restaurantes con "{searchTerm}"
              <span className="text-xs font-normal text-gray-500">({productSearchResults.length})</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {productSearchResults.map((restaurant) => (
                <RestaurantCard key={`pm-${restaurant._id}`} restaurant={restaurant} userLocation={location.coordinates} />
              ))}
            </div>
            {filteredRestaurants.length > 0 && (
              <div className="mt-5 pt-5 border-t border-gray-200">
                <p className="text-sm text-gray-500">Todos los restaurantes</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Grid principal */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, index) => <CardSkeleton key={`sk-${index}`} />)}
          </div>
        ) : filteredRestaurants.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-16"
          >
            <div className="bg-white rounded-3xl p-10 text-center max-w-sm shadow-sm border border-gray-100">
              <motion.div animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.1, 1.1, 1.1, 1] }}
                transition={{ duration: 0.6, delay: 0.2 }} className="text-6xl mb-5">🔍</motion.div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No encontramos restaurantes</h3>
              <p className="text-gray-600 text-sm mb-5 leading-relaxed">
                {searchTerm ? (
                  productSearchResults.length > 0
                    ? <>No hay restaurantes con ese nombre, pero encontramos productos arriba ☝️</>
                    : <>No hay resultados para "<span className="font-semibold">{searchTerm}</span>". Prueba: pizza, hamburguesa, pollo...</>
                ) : onlyOpen
                  ? <>No hay restaurantes abiertos ahora. Intenta más tarde o quita el filtro.</>
                  : onlyFreeDelivery
                    ? <>No hay restaurantes con envío gratis. Quita el filtro para ver todos.</>
                    : selectedCategory !== 'todo'
                      ? <>No hay restaurantes en <span className="font-semibold">{getCategoryName(selectedCategory)}</span></>
                      : <>Pronto tendremos más restaurantes disponibles</>
                }
              </p>
              <button
                onClick={() => { setSearchTerm(''); setSelectedCategory('todo'); setOnlyOpen(false); setOnlyFreeDelivery(false); }}
                className="bg-gradient-to-r from-red-500 to-red-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-red-500/30 hover:shadow-xl transition-all"
              >Ver todos los restaurantes</button>
            </div>
          </motion.div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {visibleRestaurants.map((restaurant, index) => (
                  <motion.div key={restaurant._id}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }} transition={{ delay: Math.min(index * 0.05, 0.3) }}
                  >
                    <RestaurantCard restaurant={restaurant} userLocation={location.coordinates} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Load more / Infinite scroll trigger */}
            {hasMore && (
              <div ref={loadMoreRef} className="flex justify-center py-8">
                <button
                  onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}
                  className="flex items-center gap-2 px-6 py-3 bg-white text-gray-700 rounded-xl font-semibold text-sm shadow-sm border border-gray-200 hover:bg-gray-50 hover:shadow-md transition-all"
                >
                  <span>Cargar más restaurantes</span>
                  <span className="text-xs text-gray-400">({filteredRestaurants.length - visibleCount} restantes)</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-gray-200 pb-8">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg overflow-hidden">
                <img src="/logo.jpeg" alt="MenuBy" className="w-full h-full object-cover" />
              </div>
              <span className="text-lg font-bold text-gray-900">MenuBy</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">La mejor forma de pedir comida en tu ciudad</p>
            <div className="flex justify-center gap-4 text-xs text-gray-400">
              <span>🍽️ {totalCount || restaurants.length} restaurantes</span>
              <span>📍 {location.city || 'Colombia'}</span>
              <span>❤️ {favoriteRestaurants.length} favoritos</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-4">© {new Date().getFullYear()} MenuBy. Todos los derechos reservados.</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default MenuByCatalog;