import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useBusinessStatus } from '../../hooks/useBusinessStatus';

// Iconos SVG modernos
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

const DeliveryIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const RestaurantCard = ({ restaurant, userLocation }) => {
  // Obtener estado real del negocio
  const { businessStatus, getStatusDisplay } = useBusinessStatus(restaurant._id);
  
  // Marcar que el usuario viene del catálogo
  const handleRestaurantClick = () => {
    sessionStorage.setItem('fromCatalog', 'true');
  };
  
  // Calcular tiempo de entrega estimado
  const getDeliveryTime = () => {
    // 1. Prioridad: Si el restaurante tiene zona de entrega asignada, usar su tiempo configurado
    if (restaurant.deliveryZone?.estimatedTime) {
      const { min, max } = restaurant.deliveryZone.estimatedTime;
      return `${min}-${max} min`;
    }
    
    // 2. Fallback: Calcular basado en distancia si está disponible
    if (restaurant.distance !== null && restaurant.distance !== undefined) {
      // Fórmula: 15 min base + 2 min por km
      const estimatedMin = Math.round(15 + (restaurant.distance * 2));
      const estimatedMax = estimatedMin + 10;
      return `${estimatedMin}-${estimatedMax} min`;
    }
    
    // 3. Fallback final: tiempo genérico
    return '25-35 min';
  };

  // Usar el estado real del negocio o fallback al campo isOpen
  const isOpen = businessStatus?.isOpen ?? restaurant.isOpen;
  const statusMessage = businessStatus ? getStatusDisplay().text : (restaurant.isOpen ? 'Abierto' : 'Cerrado');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ 
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      whileHover={{ 
        y: -8,
        scale: 1.02,
        transition: { duration: 0.2 }
      }}
      whileTap={{ scale: 0.98 }}
      className="group relative bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-2xl transition-all duration-300 cursor-pointer"
    >
      <Link 
        to={`/${restaurant.slug}`} 
        className="block"
        onClick={handleRestaurantClick}
      >
        {/* Imagen principal con overlay */}
        <div className="relative h-48 overflow-hidden">
          {restaurant.coverImage ? (
            <img
              src={restaurant.coverImage}
              alt={restaurant.businessName}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
          ) : restaurant.logo ? (
            <div className="w-full h-full bg-gradient-to-br from-red-400 via-red-500 to-red-600 flex items-center justify-center">
              <img
                src={restaurant.logo}
                alt={restaurant.businessName}
                className="w-20 h-20 object-cover rounded-full shadow-lg"
              />
            </div>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-red-400 via-red-500 to-red-600 flex items-center justify-center">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <span className="text-white font-bold text-3xl">
                  {restaurant.businessName.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          )}
          
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          
          {/* Logo del restaurante */}
          <div className="absolute top-4 left-4 w-16 h-16 bg-white rounded-2xl shadow-lg overflow-hidden">
            {restaurant.logo ? (
              <img
                src={restaurant.logo}
                alt={restaurant.businessName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                <span className="text-white font-bold text-lg">
                  {restaurant.businessName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Estado del restaurante */}
          <div className="absolute top-4 right-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-sm ${
                isOpen 
                  ? 'bg-green-500/90 text-white shadow-lg' 
                  : 'bg-red-500/90 text-white shadow-lg'
              }`}
            >
              <div className="flex items-center space-x-1">
                <div className={`w-2 h-2 rounded-full ${
                  isOpen ? 'bg-white animate-pulse' : 'bg-white'
                }`} />
                <span>{statusMessage}</span>
              </div>
            </motion.div>
          </div>

          {/* Rating */}
          {restaurant.rating && (
            <div className="absolute bottom-4 right-4">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-center space-x-1 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg"
              >
                <StarIcon />
                <span className="text-sm font-bold text-gray-800">{restaurant.rating}</span>
              </motion.div>
            </div>
          )}
        </div>

        {/* Información del restaurante */}
        <div className="p-5">
          <div className="mb-3">
            <h3 className="font-bold text-xl text-gray-900 mb-1 group-hover:text-red-600 transition-colors">
              {restaurant.businessName}
            </h3>
            {restaurant.description && (
              <p className="text-gray-600 text-sm line-clamp-2 leading-relaxed">
                {restaurant.description}
              </p>
            )}
          </div>

          {/* Información adicional */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Distancia (si está disponible) */}
              {restaurant.distance !== null && restaurant.distance !== undefined && (
                <div className="flex items-center space-x-1.5 text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-sm font-medium">
                    {restaurant.distance < 1 
                      ? `${Math.round(restaurant.distance * 1000)}m`
                      : `${restaurant.distance.toFixed(1)}km`
                    }
                  </span>
                </div>
              )}
              
              {/* Tiempo de entrega dinámico */}
              <div className="flex items-center space-x-1.5 text-gray-600">
                <ClockIcon />
                <span className="text-sm font-medium">{getDeliveryTime()}</span>
              </div>
            </div>

            {/* Botón de acción */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center space-x-1 text-red-500 font-bold text-sm group-hover:text-red-600 transition-colors"
            >
              <span>Ver menú</span>
              <motion.span
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                →
              </motion.span>
            </motion.div>
          </div>
        </div>

        {/* Efecto de brillo en hover */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      </Link>
    </motion.div>
  );
};

export default RestaurantCard;