import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import RestaurantCard from '../../Components/Catalog/RestaurantCard';
import BannerCarousel from '../../Components/Catalog/BannerCarousel';
import { useBusinessStatus } from '../../hooks/useBusinessStatus';

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

  useEffect(() => {
    loadRestaurants();
  }, []);

  useEffect(() => {
    filterAndSortRestaurants();
  }, [restaurants, searchTerm, selectedCategory, sortBy]);

  const loadRestaurants = async () => {
    try {
      setLoading(true);
      const response = await api.get('/businesses');
      const data = response.data || [];
      
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
      case 'rating':
        filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'name':
        filtered.sort((a, b) => a.businessName.localeCompare(b.businessName));
        break;
      case 'delivery_time':
        filtered.sort((a, b) => (a.deliveryTime || 30) - (b.deliveryTime || 30));
        break;
      default:
        // Mantener orden original (popularidad)
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
                className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg"
              >
                <span className="text-white font-bold text-lg">M</span>
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">MenuBy</h1>
                <div className="flex items-center space-x-1 text-sm text-gray-600">
                  <LocationIcon />
                  <span>Chía, Cundinamarca</span>
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
        {/* Categorías con scroll horizontal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-8"
        >
          <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((category) => (
              <motion.button
                key={category}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedCategory(category)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-2xl font-medium whitespace-nowrap transition-all duration-200 ${
                  selectedCategory === category
                    ? 'bg-red-500 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-gray-50 shadow-sm'
                }`}
              >
                <span className="text-lg">{categoryIcons[category]}</span>
                <span>{categoryNames[category] || category}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Banner carousel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-8"
        >
          <BannerCarousel />
        </motion.div>

        {/* Contador de restaurantes */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                Restaurantes en Chía
              </h2>
              <p className="text-gray-600">
                {filteredRestaurants.length} restaurante{filteredRestaurants.length !== 1 ? 's' : ''} disponible{filteredRestaurants.length !== 1 ? 's' : ''}
              </p>
            </div>
            
            {/* Filtros */}
            <div className="flex items-center space-x-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="popularity">Más populares</option>
                <option value="rating">Mejor calificados</option>
                <option value="delivery_time">Tiempo de entrega</option>
                <option value="name">Nombre A-Z</option>
              </select>
            </div>
          </div>
        </motion.div>

        {/* Grid de restaurantes */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {loading ? (
            // Skeleton loading
            Array.from({ length: 6 }).map((_, index) => (
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
            ))
          ) : (
            <AnimatePresence>
              {filteredRestaurants.map((restaurant, index) => (
                <motion.div
                  key={restaurant._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <RestaurantCard restaurant={restaurant} />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </motion.div>

        {/* Estado vacío */}
        {!loading && filteredRestaurants.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center py-16"
          >
            <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <SearchIcon />
            </div>
            <h3 className="text-2xl font-bold text-gray-600 mb-3">
              No se encontraron restaurantes
            </h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Intenta con otros términos de búsqueda o explora nuestras categorías
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('todo');
              }}
              className="px-6 py-3 bg-red-500 text-white font-semibold rounded-2xl hover:bg-red-600 transition-colors shadow-lg"
            >
              Limpiar filtros
            </motion.button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default MenuByCatalog;