import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaStar, FaShoppingCart } from 'react-icons/fa';
import api from '../services/api';
import logger from '../utils/logger';
import ProductToppingsSelector from './ProductToppingsSelector';

/**
 * Componente para mostrar productos destacados del negocio
 * Estos son seleccionados por el administrador, no son favoritos personales
 */
const FeaturedProducts = ({ businessId, onAddToCart, theme, onToppingsOpen, onToppingsClose }) => {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showToppings, setShowToppings] = useState(false);

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
    console.log('FeaturedProducts - Product clicked:', product.name);
    console.log('FeaturedProducts - ToppingGroups:', product.toppingGroups);
    const hasToppings = product.toppingGroups && product.toppingGroups.length > 0;
    console.log('FeaturedProducts - Has toppings:', hasToppings);
    
    if (hasToppings) {
      // Si tiene toppings, abrir selector
      console.log('FeaturedProducts - Opening toppings selector');
      setSelectedProduct(product);
      setShowToppings(true);
      if (onToppingsOpen) onToppingsOpen();
    } else {
      // Si no tiene toppings, agregar directamente
      console.log('FeaturedProducts - Adding directly to cart');
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

  if (loading || featuredProducts.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-orange-50 to-yellow-50 border-b border-orange-200 py-3 px-4"
    >
      <div className="container mx-auto">
        {/* Header compacto */}
        <div className="flex items-center gap-2 mb-2">
          <div 
            className="p-1.5 rounded-lg"
            style={{ backgroundColor: buttonColor }}
          >
            <FaStar className="text-base" style={{ color: buttonTextColor }} />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-800">Destacados</h3>
            <p className="text-xs text-gray-500">Los favoritos de la casa</p>
          </div>
        </div>

        {/* Horizontal scroll de productos - más compacto */}
        <div className="flex overflow-x-auto gap-3 pb-2 snap-x snap-mandatory scrollbar-hide">
          {featuredProducts.map((product) => (
            <motion.div
              key={product._id}
              whileHover={{ scale: 1.02 }}
              className="flex-shrink-0 w-52 bg-white rounded-lg shadow-md overflow-hidden snap-start"
            >
              {/* Imagen más pequeña */}
              <div className="relative h-28 bg-gray-200 overflow-hidden">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <FaStar className="text-3xl" />
                  </div>
                )}
                <div className="absolute top-1.5 right-1.5 bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                  <FaStar className="text-xs" />
                  Destacado
                </div>
              </div>

              {/* Contenido compacto */}
              <div className="p-3">
                <h4 className="font-bold text-sm text-gray-800 mb-1 truncate">{product.name}</h4>
                {product.description && (
                  <p className="text-xs text-gray-500 mb-2 line-clamp-1">{product.description}</p>
                )}
                
                <div className="flex items-center justify-between">
                  <span 
                    className="text-lg font-bold"
                    style={{ color: buttonColor }}
                  >
                    ${product.price.toLocaleString()}
                  </span>
                  <button
                    onClick={() => handleProductClick(product)}
                    className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:shadow-md hover:opacity-90"
                    style={{
                      backgroundColor: buttonColor,
                      color: buttonTextColor
                    }}
                  >
                    {product.toppingGroups && product.toppingGroups.length > 0 ? (
                      <motion.span
                        className="text-base font-bold"
                        whileHover={{ scale: 1.2 }}
                        transition={{ duration: 0.3 }}
                      >
                        +
                      </motion.span>
                    ) : (
                      <>
                        <FaShoppingCart className="text-xs" />
                        <span>Agregar</span>
                      </>
                    )}
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
