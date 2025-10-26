import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import RestaurantCard from '../../Components/Catalog/RestaurantCard';
import BannerCarousel from '../../Components/Catalog/BannerCarousel';
import { useBusinessStatus } from '../../hooks/useBusinessStatus';
import { useUserLocation } from '../../hooks/useUserLocation';

// Iconos SVG modernos
const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const FilterIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
  </svg>
);

const StarIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
);

const ClockIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const LocationIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const MenuByCatalog = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todo');
  const [sortBy, setSortBy] = useState('popularity');
  const [categories, setCategories] = useState([]);
  
  // Hook de ubicación dinámica
  const { location, updateLocation, hasLocation, isLoading: locationLoading } = useUserLocation();

  // Cargar restaurantes cuando la ubicación esté lista
  useEffect(() => {
    if (!locationLoading) {
      loadRestaurants();
    }
  }, [location.coordinates, locationLoading]);

  useEffect(() => {
    filterAndSortRestaurants();
  }, [restaurants, searchTerm, selectedCategory, sortBy]);
  
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
      
      // Si tenemos ubicación del usuario, enviarla para filtrar por cobertura
      let url = '/businesses';
      if (location.coordinates) {
        url += `?lat=${location.coordinates.lat}&lon=${location.coordinates.lng}`;
        console.log('🔍 Filtrando restaurantes por ubicación:', location.coordinates);
      } else {
        console.log('📍 Sin ubicación del usuario - mostrando todos los restaurantes');
      }
      
      const response = await api.get(url);
      let data = response.data || [];
      
      // Calcular distancias si hay ubicación
      if (location.coordinates) {
        data = data.map(restaurant => {
          if (restaurant.coordinates) {
            const distance = calculateDistance(
              location.coordinates,
              restaurant.coordinates
            );
            return { ...restaurant, distance };
          }
          return { ...restaurant, distance: null };
        });
      }
      
      // Generar categorías dinámicas basadas en los restaurantes
      const allCategories = new Set(['todo']); // Siempre incluir "Todo"
      
      data.forEach(restaurant => {
        if (restaurant.categories && restaurant.categories.length > 0) {
          restaurant.categories.forEach(category => {
            allCategories.add(category);
          });
        }
      });
      
      setCategories(Array.from(allCategories));
      setRestaurants(data);
      
      console.log(`✅ Cargados ${data.length} restaurantes con cobertura en tu área`);
    } catch (error) {
      console.error('Error loading restaurants:', error);
      // En caso de error, mostrar datos de ejemplo
      const fallbackData = [{
        _id: 'fallback-1',
        businessName: 'GO BURGER',
        slug: 'go-burger',
        logo: 'https://images.rappi.com/restaurants_logo/ad12613b-45af-444b-8cf6-055a4ed85aaf-1700338253532.png',
        coverImage: 'https://static.vecteezy.com/system/resources/previews/000/278/278/large_2x/textured-black-background-vector.jpg',
        description: 'Deliciosa comida casera con ingredientes frescos y servicio de calidad.',
        isOpen: true,
        rating: 5.0,
        address: 'Chía, Cundinamarca',
        whatsappNumber: '+57 300 123 4567',
        categories: ['hamburguesas', 'bebidas'] // Categorías de ejemplo
      }];
      setRestaurants(fallbackData);
      setCategories(['todo', 'hamburguesas', 'bebidas']);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortRestaurants = () => {
    let filtered = [...restaurants];

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
        // Ordenar por popularidad (rating como proxy, en el futuro usar número de pedidos)
        filtered.sort((a, b) => {
          const scoreA = (a.rating || 5.0) * 100 + (a.isOpen ? 50 : 0);
          const scoreB = (b.rating || 5.0) * 100 + (b.isOpen ? 50 : 0);
          return scoreB - scoreA;
        });
        break;
      case 'rating':
        filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
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
      default:
        // Por defecto: popularidad
        filtered.sort((a, b) => {
          const scoreA = (a.rating || 5.0) * 100 + (a.isOpen ? 50 : 0);
          const scoreB = (b.rating || 5.0) * 100 + (b.isOpen ? 50 : 0);
          return scoreB - scoreA;
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
    asiatica: '🍜',
    mexicana: '🌮'
  };

  const categoryNames = {
    todo: 'Todo',
    hamburguesas: 'Hamburguesas',
    pollo: 'Pollo',
    bebidas: 'Bebidas',
    pizza: 'Pizza',
    asiatica: 'Asiática',
    mexicana: 'Mexicana'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Header moderno */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Logo y ubicación */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1 }}
                className="w-12 h-12 rounded-2xl shadow-lg overflow-hidden bg-white"
              >
                <img 
                  src="/logo.jpeg" 
                  alt="MenuBy Logo" 
                  className="w-full h-full object-cover"
                />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">MenuBy</h1>
                <div className="flex items-center space-x-1 text-sm">
                  <LocationIcon />
                  {locationLoading ? (
                    <span className="text-gray-400 animate-pulse">
                      Detectando ubicación...
                    </span>
                  ) : (
                    <button
                      onClick={updateLocation}
                      className="text-gray-600 hover:text-red-600 transition-colors flex items-center space-x-1 group"
                      title="Click para actualizar ubicación"
                    >
                      <span className="max-w-[200px] truncate">{location.address}</span>
                      <svg className="w-3 h-3 text-gray-400 group-hover:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            {/* Badge BETA */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded-full shadow-lg"
            >
              BETA
            </motion.div>
          </div>

          {/* Barra de búsqueda moderna */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative mb-6"
          >
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <SearchIcon />
              </div>
              <input
                type="text"
                placeholder="Buscar restaurantes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-0 rounded-2xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all duration-200 shadow-sm"
              />
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Banner carousel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-8"
        >
          <BannerCarousel />
        </motion.div>

        {/* Categorías con scroll horizontal mejorado */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-8"
        >
          <h3 className="text-sm font-semibold text-gray-700 mb-3 px-1">Categorías</h3>
          <div className="flex space-x-3 overflow-x-auto pb-3 scrollbar-hide">
            {categories.map((category, index) => (
              <motion.button
                key={category}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.05 }}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedCategory(category)}
                className={`flex items-center space-x-2 px-5 py-3 rounded-2xl font-semibold whitespace-nowrap transition-all duration-200 ${
                  selectedCategory === category
                    ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/40 scale-105'
                    : 'bg-white text-gray-700 hover:bg-gray-50 shadow-md border border-gray-100 hover:shadow-lg'
                }`}
              >
                <span className="text-xl">{categoryIcons[category]}</span>
                <span className="text-sm">{categoryNames[category] || category}</span>
                {selectedCategory === category && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-2 h-2 bg-white rounded-full"
                  />
                )}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Contador de restaurantes y filtros modernos */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mb-8"
        >
          {/* Header con título */}
          <div className="mb-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              Restaurantes en {location.city || 'tu zona'}
            </h2>
            <p className="text-gray-600 text-sm md:text-base">
              {filteredRestaurants.length} {filteredRestaurants.length === 1 ? 'restaurante disponible' : 'restaurantes disponibles'}
            </p>
          </div>
          
          {/* Filtros modernos con chips (Desktop) y Dropdown (Móvil) */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center space-x-2 text-sm font-medium text-gray-700 flex-shrink-0">
              <FilterIcon />
              <span className="hidden md:inline">Ordenar por:</span>
              <span className="md:hidden">Ordenar:</span>
            </div>
            
            {/* Filtros para Desktop (md y superiores) */}
            <div className="hidden md:flex flex-wrap gap-2 justify-end">
              {hasLocation && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSortBy('distance')}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 shadow-sm ${
                    sortBy === 'distance'
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  <span className="text-base">📍</span>
                  <span>Cercanos</span>
                </motion.button>
              )}
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSortBy('popularity')}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 shadow-sm ${
                  sortBy === 'popularity'
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-red-500/30'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <span className="text-base">🔥</span>
                <span>Populares</span>
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSortBy('rating')}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 shadow-sm ${
                  sortBy === 'rating'
                    ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-lg shadow-yellow-500/30'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <span className="text-base">⭐</span>
                <span>Top Rated</span>
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSortBy('delivery_time')}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 shadow-sm ${
                  sortBy === 'delivery_time'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <span className="text-base">⚡</span>
                <span>Rápidos</span>
              </motion.button>
            </div>

            {/* Dropdown para Móvil (menores a md) */}
            <div className="md:hidden relative flex-1">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full appearance-none bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-3 pr-10 rounded-xl font-semibold text-sm shadow-lg shadow-red-500/30 focus:outline-none focus:ring-2 focus:ring-red-400 cursor-pointer transition-all duration-200"
              >
                {hasLocation && (
                  <option value="distance" className="bg-white text-gray-900 font-medium">📍 Más cercanos</option>
                )}
                <option value="popularity" className="bg-white text-gray-900 font-medium">🔥 Más populares</option>
                <option value="rating" className="bg-white text-gray-900 font-medium">⭐ Mejor calificados</option>
                <option value="delivery_time" className="bg-white text-gray-900 font-medium">⚡ Más rápidos</option>
              </select>
              {/* Icono de flecha personalizado */}
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <motion.svg 
                  animate={{ y: [0, 2, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-5 h-5 text-white" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </motion.svg>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Grid de restaurantes */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <motion.div
                key={`skeleton-${index}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-3xl shadow-lg overflow-hidden"
              >
                <div className="h-48 bg-gray-200 animate-pulse" />
                <div className="p-5">
                  <div className="h-6 bg-gray-200 rounded animate-pulse mb-2" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse mb-4" />
                  <div className="flex justify-between">
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-20" />
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-16" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : filteredRestaurants.length === 0 ? (
          // Estado vacío mejorado
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="col-span-full flex flex-col items-center justify-center py-20"
          >
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl p-12 text-center max-w-md">
              <motion.div
                animate={{ 
                  rotate: [0, -10, 10, -10, 0],
                  scale: [1, 1.1, 1.1, 1.1, 1]
                }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-7xl mb-6"
              >
                🔍
              </motion.div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                No encontramos restaurantes
              </h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                {searchTerm ? (
                  <>No hay resultados para "<span className="font-semibold">{searchTerm}</span>"</>
                ) : selectedCategory !== 'todo' ? (
                  <>No hay restaurantes en la categoría <span className="font-semibold">{categoryNames[selectedCategory]}</span></>
                ) : hasLocation ? (
                  <>No hay restaurantes con cobertura en tu ubicación actual</>
                ) : (
                  <>Pronto tendremos más restaurantes disponibles</>
                )}
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('todo');
                }}
                className="bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-red-500/30 hover:shadow-xl transition-all duration-200"
              >
                Ver todos los restaurantes
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <AnimatePresence>
              {filteredRestaurants.map((restaurant, index) => (
                <motion.div
                  key={restaurant._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <RestaurantCard 
                    restaurant={restaurant} 
                    userLocation={location.coordinates}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default MenuByCatalog;