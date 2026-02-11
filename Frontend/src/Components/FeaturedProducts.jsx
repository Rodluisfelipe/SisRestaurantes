import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaStar, FaPlus, FaShoppingCart } from 'react-icons/fa';
import api from '../services/api';
import logger from '../utils/logger';
import ProductToppingsSelector from './ProductToppingsSelector';
import { FeaturedProductsSkeleton } from './MenuSkeletons';
import { useFlyToCart } from './FlyToCart';

/**
 * Componente para mostrar productos destacados del negocio
 * Estos son seleccionados por el administrador, no son favoritos personales
 */
const FeaturedProducts = ({ businessId, onAddToCart, theme, onToppingsOpen, onToppingsClose }) => {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showToppings, setShowToppings] = useState(false);
  const flyToCart = useFlyToCart();

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

  const handleProductClick = (product) => {
    const hasToppings = product.toppingGroups && product.toppingGroups.length > 0;
    
    if (hasToppings) {
      // Si tiene toppings, abrir selector
      setSelectedProduct(product);
      setShowToppings(true);
      if (onToppingsOpen) onToppingsOpen();
    } else {
      // Si no tiene toppings, agregar directamente
      handleAddToCart(product);
    }
  };

  const handleAddToCart = (product) => {
    if (onAddToCart) {
      onAddToCart({
        ...product,
        quantity: 1,
        selectedToppings: product.selectedToppings || [],
        selectedOptions: product.selectedOptions || {}
      });
    }
  };

  const handleCloseToppings = () => {
    setShowToppings(false);
    setSelectedProduct(null);
    if (onToppingsClose) onToppingsClose();
  };

  if (loading) {
    return <FeaturedProductsSkeleton />;
  }

  if (featuredProducts.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 sm:mb-5"
    >
      <div className="px-3 sm:px-4 lg:px-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div 
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${buttonColor}15` }}
          >
            <FaStar className="text-xs" style={{ color: buttonColor }} />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-gray-800">Destacados</h3>
        </div>

        {/* Horizontal scroll */}
        <div className="flex overflow-x-auto gap-3 pb-2 snap-x snap-mandatory scrollbar-hide -mx-3 px-3 sm:-mx-4 sm:px-4">
          {featuredProducts.map((product) => (
            <motion.div
              key={product._id}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleProductClick(product)}
              className="flex-shrink-0 w-40 sm:w-48 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden snap-start cursor-pointer hover:shadow-md transition-shadow duration-200"
            >
              {/* Image */}
              <div className="relative aspect-[4/3] bg-gray-50 overflow-hidden">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <FaStar className="text-2xl" />
                  </div>
                )}
                <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-400/90 text-amber-900 text-[10px] font-bold backdrop-blur-sm">
                  <FaStar className="text-[8px]" />
                  Destacado
                </span>
              </div>

              {/* Content */}
              <div className="p-2.5">
                <h4 className="font-bold text-xs sm:text-sm text-gray-800 truncate">{product.name}</h4>
                <div className="flex items-center justify-between mt-1.5">
                  <span 
                    className="text-sm sm:text-base font-extrabold"
                    style={{ color: buttonColor }}
                  >
                    ${product.price.toLocaleString()}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const hasToppings = product.toppingGroups && product.toppingGroups.length > 0;
                      // Fly-to-cart only for products WITHOUT toppings (instant add)
                      if (flyToCart?.triggerFly && !hasToppings) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        flyToCart.triggerFly({
                          x: rect.left + rect.width / 2,
                          y: rect.top + rect.height / 2,
                          image: product.image,
                          color: buttonColor
                        });
                      }
                      handleProductClick(product);
                    }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs shadow-sm transition-all hover:shadow-md"
                    style={{ backgroundColor: buttonColor, color: buttonTextColor }}
                  >
                    {product.toppingGroups && product.toppingGroups.length > 0 
                      ? <FaPlus className="text-[10px]" /> 
                      : <FaShoppingCart className="text-[10px]" />
                    }
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Modal de Toppings */}
      {showToppings && selectedProduct && (
        <div onClick={(e) => e.stopPropagation()}>
          <ProductToppingsSelector
            product={{
              ...selectedProduct,
              toppingGroups: Array.isArray(selectedProduct.toppingGroups) ? selectedProduct.toppingGroups : []
            }}
            onAddToCart={(p) => {
              // Fly animation after toppings are configured
              if (flyToCart?.triggerFly) {
                flyToCart.triggerFly({
                  x: window.innerWidth / 2,
                  y: window.innerHeight / 2,
                  image: p.image,
                  color: buttonColor
                });
              }
              handleAddToCart(p);
              handleCloseToppings();
            }}
            onClose={handleCloseToppings}
          />
        </div>
      )}

      {/* CSS para ocultar scrollbar */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .line-clamp-1 {
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </motion.div>
  );
};

export default FeaturedProducts;
