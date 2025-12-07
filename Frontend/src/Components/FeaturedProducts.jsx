import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaStar, FaShoppingCart } from 'react-icons/fa';
import api from '../services/api';
import logger from '../utils/logger';

/**
 * Componente para mostrar productos destacados del negocio
 * Estos son seleccionados por el administrador, no son favoritos personales
 */
const FeaturedProducts = ({ businessId, onAddToCart, theme }) => {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const buttonColor = theme?.buttonColor || '#f97316';
  const buttonTextColor = theme?.buttonTextColor || '#ffffff';

  useEffect(() => {
    if (businessId) {
      loadFeaturedProducts();
    }
  }, [businessId]);

  const loadFeaturedProducts = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/products/featured?businessId=${businessId}`);
      setFeaturedProducts(response.data || []);
    } catch (err) {
      logger.error('Error loading featured products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product) => {
    if (onAddToCart) {
      onAddToCart({
        ...product,
        quantity: 1,
        selectedToppings: [],
        selectedOptions: {}
      });
    }
  };

  if (loading || featuredProducts.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-orange-50 to-yellow-50 border-b border-orange-200 py-6 px-4"
    >
      <div className="container mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div 
            className="p-2 rounded-lg"
            style={{ backgroundColor: buttonColor }}
          >
            <FaStar className="text-xl" style={{ color: buttonTextColor }} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-800">Productos Destacados</h3>
            <p className="text-sm text-gray-600">Los favoritos de la casa</p>
          </div>
        </div>

        {/* Horizontal scroll de productos */}
        <div className="flex overflow-x-auto gap-4 pb-2 snap-x snap-mandatory scrollbar-hide">
          {featuredProducts.map((product) => (
            <motion.div
              key={product._id}
              whileHover={{ scale: 1.02 }}
              className="flex-shrink-0 w-64 bg-white rounded-xl shadow-md overflow-hidden snap-start"
            >
              {/* Imagen */}
              <div className="relative h-40 bg-gray-200 overflow-hidden">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <FaStar className="text-4xl" />
                  </div>
                )}
                <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                  <FaStar className="text-xs" />
                  Destacado
                </div>
              </div>

              {/* Contenido */}
              <div className="p-4">
                <h4 className="font-bold text-gray-800 mb-1 truncate">{product.name}</h4>
                {product.description && (
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">{product.description}</p>
                )}
                
                <div className="flex items-center justify-between">
                  <span 
                    className="text-xl font-bold"
                    style={{ color: buttonColor }}
                  >
                    ${product.price.toLocaleString()}
                  </span>
                  <button
                    onClick={() => handleAddToCart(product)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all hover:shadow-md hover:opacity-90"
                    style={{
                      backgroundColor: buttonColor,
                      color: buttonTextColor
                    }}
                  >
                    <FaShoppingCart className="text-sm" />
                    Agregar
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* CSS para ocultar scrollbar */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </motion.div>
  );
};

export default FeaturedProducts;
