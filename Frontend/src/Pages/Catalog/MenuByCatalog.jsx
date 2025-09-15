import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import RestaurantCard from '../../Components/Catalog/RestaurantCard';
import BannerCarousel from '../../Components/Catalog/BannerCarousel';

// Iconos SVG simples
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
  <svg className="w-4 h-4" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const MenuByCatalog = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
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
      const restaurantsData = response.data;
      
      // Cargar productos para cada restaurante y generar categorías
      const restaurantsWithProducts = await Promise.all(
        restaurantsData.map(async (restaurant) => {
          try {
            const productsResponse = await api.get(`/products?businessId=${restaurant._id}`);
            const products = productsResponse.data;
            
            // Extraer categorías de los productos basándose en nombres y categorías
            const productCategories = new Set();
            
            products.forEach(product => {
              const productName = product.name.toLowerCase();
              const categoryName = product.category?.name?.toLowerCase() || '';
              
              // Detectar categorías por nombre del producto
              if (productName.includes('hamburguesa') || productName.includes('burger') || productName.includes('combo')) {
                productCategories.add('Hamburguesas');
              }
              if (productName.includes('pizza') || productName.includes('pizzas')) {
                productCategories.add('Pizza');
              }
              if (productName.includes('pollo') || productName.includes('chicken')) {
                productCategories.add('Pollo');
              }
              if (productName.includes('pasta') || productName.includes('spaghetti') || productName.includes('lasagna')) {
                productCategories.add('Italiana');
              }
              if (productName.includes('taco') || productName.includes('burrito') || productName.includes('quesadilla')) {
                productCategories.add('Mexicana');
              }
              if (productName.includes('sushi') || productName.includes('ramen') || productName.includes('wok')) {
                productCategories.add('Asiática');
              }
              if (productName.includes('ensalada') || productName.includes('salad')) {
                productCategories.add('Ensaladas');
              }
              if (productName.includes('bebida') || productName.includes('jugo') || productName.includes('gaseosa') || productName.includes('refresco')) {
                productCategories.add('Bebidas');
              }
              if (productName.includes('postre') || productName.includes('helado') || productName.includes('torta') || productName.includes('dulce')) {
                productCategories.add('Postres');
              }
              if (productName.includes('pescado') || productName.includes('marisco') || productName.includes('camarón')) {
                productCategories.add('Pescados y Mariscos');
              }
              if (productName.includes('carne') || productName.includes('bistec') || productName.includes('lomo')) {
                productCategories.add('Carnes');
              }
              if (productName.includes('vegetariano') || productName.includes('vegano') || productName.includes('quinoa')) {
                productCategories.add('Vegetariano');
              }
              if (productName.includes('desayuno') || productName.includes('huevo') || productName.includes('pancake')) {
                productCategories.add('Desayunos');
              }
              if (productName.includes('sandwich') || productName.includes('wrap') || productName.includes('panini')) {
                productCategories.add('Sandwiches');
              }
              
              // También agregar la categoría asignada si existe
              if (product.category?.name) {
                productCategories.add(product.category.name);
              }
            });
            
            const productCategoriesArray = Array.from(productCategories);
            
            return {
              ...restaurant,
              products,
              categories: productCategoriesArray
            };
          } catch (error) {
            console.error(`Error loading products for ${restaurant.businessName}:`, error);
            return {
              ...restaurant,
              products: [],
              categories: []
            };
          }
        })
      );
      
      setRestaurants(restaurantsWithProducts);
      
      // Generar categorías dinámicamente basadas en todos los productos
      const allCategories = new Set();
      restaurantsWithProducts.forEach(restaurant => {
        restaurant.categories.forEach(category => {
          allCategories.add(category);
        });
      });
      
      const dynamicCategories = [
        { id: 'all', name: 'Todos', icon: '🍽️' },
        ...Array.from(allCategories).map(category => ({
          id: category.toLowerCase().replace(/\s+/g, '-'),
          name: category,
          icon: getCategoryIcon(category)
        }))
      ];
      
      setCategories(dynamicCategories);
    } catch (error) {
      console.error('Error loading restaurants:', error);
    } finally {
      setLoading(false);
    }
  };

  // Función para asignar iconos a categorías
  const getCategoryIcon = (categoryName) => {
    const name = categoryName.toLowerCase();
    if (name.includes('hamburguesa') || name.includes('burger')) return '🍔';
    if (name.includes('pizza')) return '🍕';
    if (name.includes('pollo') || name.includes('chicken')) return '🍗';
    if (name.includes('italiana') || name.includes('pasta')) return '🍝';
    if (name.includes('mexicana') || name.includes('taco') || name.includes('burrito')) return '🌮';
    if (name.includes('asiática') || name.includes('asiatica') || name.includes('sushi')) return '🍜';
    if (name.includes('ensalada') || name.includes('salad')) return '🥗';
    if (name.includes('bebida') || name.includes('jugo') || name.includes('gaseosa')) return '🥤';
    if (name.includes('postre') || name.includes('dulce') || name.includes('helado')) return '🍰';
    if (name.includes('pescado') || name.includes('marisco') || name.includes('camarón')) return '🐟';
    if (name.includes('carne') || name.includes('bistec') || name.includes('lomo')) return '🥩';
    if (name.includes('vegetariano') || name.includes('vegano')) return '🥬';
    if (name.includes('desayuno') || name.includes('huevo')) return '🍳';
    if (name.includes('sandwich') || name.includes('wrap') || name.includes('panini')) return '🥪';
    if (name.includes('comida rápida') || name.includes('rapida')) return '🍟';
    return '🍽️'; // Icono por defecto
  };

  const filterAndSortRestaurants = () => {
    let filtered = [...restaurants];

    // Filtrar por búsqueda
    if (searchTerm) {
      filtered = filtered.filter(restaurant =>
        restaurant.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        restaurant.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtrar por categoría
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(restaurant =>
        restaurant.categories?.some(category => 
          category.toLowerCase().replace(/\s+/g, '-') === selectedCategory
        )
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
      case 'newest':
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      default:
        // Popularidad (por defecto)
        filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    setFilteredRestaurants(filtered);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-red-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando restaurantes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header móvil optimizado */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-4 py-4">
          {/* Barra de búsqueda principal */}
          <div className="relative mb-4">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              <SearchIcon />
            </div>
            <input
              type="text"
              placeholder="Buscar restaurantes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filtros horizontales */}
          <div className="flex space-x-3 overflow-x-auto pb-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === category.id
                    ? 'bg-red-500 text-white shadow-lg'
                    : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                <span className="mr-1">{category.icon}</span>
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="px-4 py-6">
        {/* Banner promocional */}
        <BannerCarousel />
        
        {/* Header con información */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Restaurantes en Chía
          </h1>
          <p className="text-gray-600 text-sm">
            {filteredRestaurants.length} restaurantes disponibles
          </p>
        </div>

        {/* Filtros adicionales */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <FilterIcon />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-sm text-gray-600 bg-transparent border-0 focus:outline-none"
            >
              <option value="popularity">Más populares</option>
              <option value="rating">Mejor calificados</option>
              <option value="name">A-Z</option>
              <option value="newest">Más recientes</option>
            </select>
          </div>
        </div>

        {/* Lista de restaurantes */}
        <AnimatePresence>
          <div className="space-y-4">
            {filteredRestaurants.map((restaurant) => (
              <motion.div
                key={restaurant._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Link to={`/${restaurant.slug}`} className="block">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-200">
                    <div className="flex">
                      {/* Imagen del restaurante */}
                      <div className="w-24 h-24 bg-gray-100 relative overflow-hidden flex-shrink-0">
                        {restaurant.logo ? (
                          <img
                            src={restaurant.logo}
                            alt={restaurant.businessName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
                              <span className="text-white font-bold text-lg">
                                {restaurant.businessName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Información del restaurante */}
                      <div className="flex-1 p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-lg text-gray-900 line-clamp-1">
                            {restaurant.businessName}
                          </h3>
                          <div className="flex items-center space-x-2">
                            {/* Estado del restaurante */}
                            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                              restaurant.isOpen 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {restaurant.isOpen ? 'Abierto' : 'Cerrado'}
                            </div>
                            {restaurant.rating && (
                              <div className="flex items-center space-x-1 bg-gray-100 px-2 py-1 rounded-full">
                                <StarIcon />
                                <span className="text-sm font-medium">{restaurant.rating}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {restaurant.description && (
                          <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                            {restaurant.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1 text-sm text-gray-500">
                            <ClockIcon />
                            <span>25-35 min</span>
                          </div>
                          <div className="text-red-500 text-sm font-medium">
                            Ver menú →
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>

        {/* Estado vacío */}
        {filteredRestaurants.length === 0 && (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <SearchIcon />
            </div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">
              No se encontraron restaurantes
            </h3>
            <p className="text-gray-500">
              Intenta con otros términos de búsqueda o filtros
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MenuByCatalog;