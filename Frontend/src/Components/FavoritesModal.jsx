import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaHeart, FaTimes, FaShoppingCart, FaTrash, FaStar } from 'react-icons/fa';
import api from '../services/api';
import logger from '../utils/logger';

/**
 * Modal para mostrar y gestionar productos favoritos del cliente
 * Permite visualizar, agregar al carrito y eliminar favoritos
 */
const FavoritesModal = ({ show, onClose, businessId, customerPhone, onAddToCart, theme }) => {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Colores del tema con fallback
  const buttonColor = theme?.buttonColor || '#f97316';
  const buttonTextColor = theme?.buttonTextColor || '#ffffff';

  useEffect(() => {
    if (show && customerPhone && businessId) {
      loadFavorites();
    }
  }, [show, customerPhone, businessId]);

  const loadFavorites = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get(`/favorites?phone=${customerPhone}&businessId=${businessId}`);
      
      if (response.data.success) {
        setFavorites(response.data.favorites);
      }
    } catch (err) {
      logger.error('Error loading favorites:', err);
      setError('No se pudieron cargar los favoritos');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (favoriteId) => {
    try {
      const response = await api.delete(`/favorites/${favoriteId}?phone=${customerPhone}&businessId=${businessId}`);
      
      if (response.data.success) {
        setFavorites(prev => prev.filter(fav => fav._id !== favoriteId));
        logger.info('Favorite removed successfully');
      }
    } catch (err) {
      logger.error('Error removing favorite:', err);
      alert('No se pudo eliminar el favorito');
    }
  };

  const handleAddToCart = async (favorite) => {
    try {
      // Check if product is still available
      if (favorite.productId && !favorite.productId.available) {
        alert('Este producto ya no está disponible');
        return;
      }

      // Construct cart item from favorite
      const cartItem = {
        productId: favorite.productId?._id || favorite.productId,
        name: favorite.productName,
        price: favorite.productPrice,
        quantity: 1,
        selectedToppings: favorite.selectedToppings || [],
        selectedOptions: favorite.selectedOptions || [],
        notes: favorite.notes || '',
        image: favorite.productImage || ''
      };

      // Add to cart via parent callback
      onAddToCart(cartItem);

      // Record that this favorite was ordered
      await api.post(`/favorites/${favorite._id}/order`);

      logger.info('Favorite added to cart successfully');
      
      // Optional: close modal after adding
      // onClose();
    } catch (err) {
      logger.error('Error adding favorite to cart:', err);
      alert('No se pudo agregar al carrito');
    }
  };

  if (!show) return null;

  const calculateTotalPrice = (favorite) => {
    let total = favorite.productPrice;
    
    if (favorite.selectedToppings) {
      favorite.selectedToppings.forEach(group => {
        group.toppings?.forEach(topping => {
          total += topping.price || 0;
        });
      });
    }
    
    if (favorite.selectedOptions) {
      favorite.selectedOptions.forEach(group => {
        if (group.option) {
          total += group.option.price || 0;
        }
      });
    }
    
    return total;
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 25 }}
          className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div 
            className="p-6 text-white"
            style={{ backgroundColor: buttonColor }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FaHeart className="text-3xl animate-pulse" />
                <div>
                  <h2 className="text-2xl font-bold">Mis Favoritos</h2>
                  <p className="text-sm opacity-80">Tus productos preferidos</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <FaTimes className="text-xl" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
                <p className="mt-4 text-gray-600">Cargando favoritos...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-500 mb-4">{error}</p>
                <button
                  onClick={loadFavorites}
                  className="px-4 py-2 rounded-lg transition-colors hover:opacity-90"
                  style={{ 
                    backgroundColor: buttonColor,
                    color: buttonTextColor
                  }}
                >
                  Reintentar
                </button>
              </div>
            ) : favorites.length === 0 ? (
              <div className="text-center py-12">
                <FaHeart className="text-6xl text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">Aún no tienes favoritos</p>
                <p className="text-sm text-gray-400">
                  Guarda tus productos preferidos para ordenarlos más rápido
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {favorites.map((favorite, index) => (
                  <motion.div
                    key={favorite._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-gray-50 rounded-xl p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex gap-4">
                      {/* Product Image */}
                      {favorite.productImage && (
                        <div className="w-24 h-24 flex-shrink-0">
                          <img
                            src={favorite.productImage}
                            alt={favorite.productName}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        </div>
                      )}

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-bold text-lg text-gray-800 truncate">
                              {favorite.productName}
                            </h3>
                            {favorite.timesOrdered > 0 && (
                              <div className="flex items-center text-xs text-yellow-600 mt-1">
                                <FaStar className="mr-1" />
                                <span>Ordenado {favorite.timesOrdered} {favorite.timesOrdered === 1 ? 'vez' : 'veces'}</span>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemoveFavorite(favorite._id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                            title="Eliminar favorito"
                          >
                            <FaTrash />
                          </button>
                        </div>

                        {/* Toppings & Options */}
                        {(favorite.selectedToppings?.length > 0 || favorite.selectedOptions?.length > 0) && (
                          <div className="text-sm text-gray-600 mb-2 space-y-1">
                            {favorite.selectedToppings?.map((group, idx) => (
                              <div key={idx}>
                                <span className="font-medium">{group.groupName}: </span>
                                <span>{group.toppings?.map(t => t.name).join(', ')}</span>
                              </div>
                            ))}
                            {favorite.selectedOptions?.map((group, idx) => (
                              <div key={idx}>
                                <span className="font-medium">{group.groupName}: </span>
                                <span>{group.option?.name}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Notes */}
                        {favorite.notes && (
                          <p className="text-sm text-gray-500 italic mb-2">
                            Nota: {favorite.notes}
                          </p>
                        )}

                        {/* Price & Add to Cart */}
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xl font-bold text-green-600">
                            ${calculateTotalPrice(favorite).toLocaleString()}
                          </span>
                          <button
                            onClick={() => handleAddToCart(favorite)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all shadow-md hover:shadow-lg hover:opacity-90"
                            style={{ 
                              backgroundColor: buttonColor,
                              color: buttonTextColor
                            }}
                          >
                            <FaShoppingCart />
                            <span>Agregar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default FavoritesModal;
