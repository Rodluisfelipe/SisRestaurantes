import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, Star, Phone, Globe, Heart, Share2 } from 'lucide-react';
import api from '../../services/api';

const RestaurantDetail = () => {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    const loadRestaurant = async () => {
      try {
        setLoading(true);
        
        // Cargar información del restaurante
        const restaurantResponse = await api.get(`/businesses/${restaurantId}`);
        const restaurantData = restaurantResponse.data;
        
        // Cargar productos del restaurante
        const productsResponse = await api.get(`/products?businessId=${restaurantId}`);
        const productsData = productsResponse.data;
        
        // Categorizar productos
        const categorizedProducts = productsData.reduce((acc, product) => {
          const category = product.category || 'otros';
          if (!acc[category]) {
            acc[category] = [];
          }
          acc[category].push(product);
          return acc;
        }, {});

        setRestaurant({
          ...restaurantData,
          products: productsData,
          categorizedProducts
        });
        setProducts(productsData);
      } catch (error) {
        console.error('Error loading restaurant:', error);
        navigate('/catalog');
      } finally {
        setLoading(false);
      }
    };

    if (restaurantId) {
      loadRestaurant();
    }
  }, [restaurantId, navigate]);

  const getRestaurantStatus = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const openTime = 8 * 60; // 8:00 AM
    const closeTime = 22 * 60; // 10:00 PM

    if (currentTime >= openTime && currentTime <= closeTime) {
      return { isOpen: true, message: 'Abierto ahora', color: 'text-green-600' };
    } else {
      return { isOpen: false, message: 'Cerrado', color: 'text-red-600' };
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: restaurant.businessName,
          text: `Mira el menú de ${restaurant.businessName}`,
          url: window.location.href,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      // Fallback para navegadores que no soportan Web Share API
      navigator.clipboard.writeText(window.location.href);
      alert('Enlace copiado al portapapeles');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-600">Cargando restaurante...</p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Restaurante no encontrado</h2>
          <Link to="/catalog" className="text-blue-500 hover:text-blue-600">
            Volver al catálogo
          </Link>
        </div>
      </div>
    );
  }

  const status = getRestaurantStatus();
  const categories = Object.keys(restaurant.categorizedProducts || {});

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header con imagen */}
      <div className="relative h-64 md:h-80 bg-gradient-to-br from-slate-100 to-slate-200">
        {restaurant.logo ? (
          <img
            src={restaurant.logo}
            alt={restaurant.businessName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-lg">
              <span className="text-4xl font-bold text-slate-400">
                {restaurant.businessName.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        )}

        {/* Overlay con información */}
        <div className="absolute inset-0 bg-black/20">
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                {restaurant.businessName}
              </h1>
              {restaurant.description && (
                <p className="text-lg opacity-90 mb-4">
                  {restaurant.description}
                </p>
              )}
              <div className="flex items-center space-x-4">
                <div className={`flex items-center space-x-1 ${status.color}`}>
                  <Clock className="w-5 h-5" />
                  <span className="font-medium">{status.message}</span>
                </div>
                {restaurant.rating && (
                  <div className="flex items-center space-x-1">
                    <Star className="w-5 h-5 text-yellow-400 fill-current" />
                    <span className="font-medium">{restaurant.rating}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/catalog')}
            className="p-2 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-slate-700" />
          </motion.button>
          
          <div className="flex space-x-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsFavorite(!isFavorite)}
              className={`p-2 rounded-full backdrop-blur-sm transition-colors ${
                isFavorite 
                  ? 'bg-red-500 text-white' 
                  : 'bg-white/90 text-slate-700 hover:bg-white'
              }`}
            >
              <Heart className={`w-6 h-6 ${isFavorite ? 'fill-current' : ''}`} />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleShare}
              className="p-2 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-colors"
            >
              <Share2 className="w-6 h-6 text-slate-700" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Información del restaurante */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Información</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Clock className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="font-medium text-slate-800">Horarios</p>
                  <p className="text-slate-600">Lun - Dom: 8:00 AM - 10:00 PM</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <MapPin className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="font-medium text-slate-800">Ubicación</p>
                  <p className="text-slate-600">Ciudad, País</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Phone className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="font-medium text-slate-800">Teléfono</p>
                  <p className="text-slate-600">+1 (555) 123-4567</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Globe className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="font-medium text-slate-800">Sitio web</p>
                  <a href="#" className="text-blue-500 hover:text-blue-600">
                    www.restaurante.com
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Menú */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Menú</h2>
            <p className="text-slate-600">{products.length} productos</p>
          </div>

          {/* Filtros de categorías */}
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  selectedCategory === 'all'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    selectedCategory === category
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          )}

          {/* Lista de productos */}
          <div className="space-y-4">
            {(selectedCategory === 'all' ? products : restaurant.categorizedProducts[selectedCategory] || [])
              .map((product) => (
                <motion.div
                  key={product._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center space-x-4 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <div className="w-16 h-16 bg-white rounded-lg overflow-hidden flex-shrink-0">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                        <span className="text-slate-400 text-xs">Sin imagen</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-800 truncate">
                      {product.name}
                    </h3>
                    {product.description && (
                      <p className="text-slate-600 text-sm line-clamp-2">
                        {product.description}
                      </p>
                    )}
                    {product.toppingGroups && product.toppingGroups.length > 0 && (
                      <p className="text-blue-600 text-xs mt-1">
                        Personalizable
                      </p>
                    )}
                  </div>
                  
                  <div className="text-right">
                    <p className="font-bold text-slate-800">
                      ${product.price?.toLocaleString() || '0'}
                    </p>
                  </div>
                </motion.div>
              ))}
          </div>

          {products.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🍽️</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-600 mb-2">
                No hay productos disponibles
              </h3>
              <p className="text-slate-500">
                Este restaurante aún no ha agregado productos a su menú
              </p>
            </div>
          )}
        </div>

        {/* Botón para ver menú completo */}
        <div className="mt-8 text-center">
          <Link
            to={`/${restaurant.slug || restaurant._id}`}
            className="inline-flex items-center px-8 py-4 bg-blue-500 text-white font-semibold rounded-2xl hover:bg-blue-600 transition-colors shadow-lg hover:shadow-xl"
          >
            Ver menú completo
            <ArrowLeft className="w-5 h-5 ml-2 rotate-180" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RestaurantDetail;
