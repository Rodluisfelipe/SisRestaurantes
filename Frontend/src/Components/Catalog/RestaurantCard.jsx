import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

// Iconos SVG simples
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

const RestaurantCard = ({ restaurant }) => {
  // Crear el objeto status basado en los datos del restaurante
  const status = {
    isOpen: restaurant.isOpen,
    message: restaurant.isOpen ? 'Abierto' : 'Cerrado'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -2 }}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-200"
    >
      <Link to={`/${restaurant.slug}`} className="block">
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
                  status.isOpen 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {status.message}
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
      </Link>
    </motion.div>
  );
};

export default RestaurantCard;