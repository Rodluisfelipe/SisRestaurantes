import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaHistory, FaTimes, FaShoppingCart, FaHeart, FaClock, FaCheckCircle } from 'react-icons/fa';
import api from '../services/api';
import logger from '../utils/logger';

/**
 * Modal para mostrar historial de pedidos y permitir re-ordenar rápidamente
 */
const OrderHistoryModal = ({ show, onClose, businessId, customerPhone, onReorder, onAddToFavorites, theme }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  // Colores del tema con fallback
  const buttonColor = theme?.buttonColor || '#f97316';
  const buttonTextColor = theme?.buttonTextColor || '#ffffff';

  useEffect(() => {
    if (show && customerPhone && businessId) {
      loadOrderHistory();
    }
  }, [show, customerPhone, businessId]);

  const loadOrderHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('[OrderHistoryModal] Loading history for:', { businessId, customerPhone });
      
      // Load completed orders for this customer
      const completedResponse = await api.get(`/orders/completed?businessId=${businessId}`);
      const allCompleted = completedResponse.data || [];
      
      console.log('[OrderHistoryModal] All completed orders:', allCompleted.length);
      console.log('[OrderHistoryModal] First order sample:', allCompleted[0]);
      
      // Filter by customer phone
      const customerOrders = allCompleted
        .filter(order => {
          console.log('[OrderHistoryModal] Comparing:', { orderPhone: order.phone, customerPhone, match: order.phone === customerPhone });
          return order.phone === customerPhone;
        })
        .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt))
        .slice(0, 20); // Last 20 orders
      
      console.log('[OrderHistoryModal] Customer orders found:', customerOrders.length);
      setOrders(customerOrders);
    } catch (err) {
      logger.error('Error loading order history:', err);
      setError('No se pudo cargar el historial de pedidos');
    } finally {
      setLoading(false);
    }
  };

  const handleReorder = (order) => {
    if (onReorder) {
      console.log('[OrderHistoryModal] Original order items:', order.items);
      
      // Convert order items to cart format
      const cartItems = order.items.map(item => {
        console.log('[OrderHistoryModal] Processing item:', item);
        
        return {
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          selectedToppings: item.selectedToppings || [],
          selectedOptions: item.selectedOptions || {},
          notes: item.notes || '',
          image: item.image || item.productImage || ''
        };
      });

      console.log('[OrderHistoryModal] Cart items to reorder:', cartItems);
      onReorder(cartItems);
      logger.info('Order reordered successfully', { orderNumber: order.orderNumber });
      onClose();
    }
  };

  const handleAddItemToFavorites = async (item, orderInfo) => {
    try {
      const favoriteData = {
        phone: customerPhone,
        businessId,
        productId: item.productId,
        productName: item.name,
        productPrice: item.price,
        productImage: item.image || '',
        selectedToppings: item.selectedToppings || [],
        selectedOptions: item.selectedOptions || [],
        notes: item.notes || ''
      };

      const response = await api.post('/favorites', favoriteData);
      
      if (response.data.success) {
        alert(`✨ ${item.name} agregado a favoritos`);
        logger.info('Item added to favorites from order history');
      }
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.message?.includes('already in favorites')) {
        alert('Este producto ya está en tus favoritos');
      } else {
        logger.error('Error adding to favorites:', err);
        alert('No se pudo agregar a favoritos');
      }
    }
  };

  if (!show) return null;

  const getOrderTypeLabel = (orderType) => {
    const labels = {
      'inSite': 'En Sitio',
      'takeaway': 'Para Llevar',
      'delivery': 'Domicilio'
    };
    return labels[orderType] || orderType;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return `Hoy a las ${date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return 'Ayer';
    } else if (diffDays < 7) {
      return `Hace ${diffDays} días`;
    } else {
      return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    }
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
          className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div 
            className="p-6 text-white"
            style={{ backgroundColor: buttonColor }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FaHistory className="text-3xl" />
                <div>
                  <h2 className="text-2xl font-bold">Historial de Pedidos</h2>
                  <p className="text-sm text-white/80">Reordena tus favoritos en 1 clic</p>
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
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-red-500 animate-spin" />
                  <div className="absolute inset-2 rounded-full border-4 border-transparent border-b-red-600 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-lg animate-pulse" />
                  </div>
                </div>
                <p className="mt-4 text-slate-700 font-semibold">Cargando historial...</p>
                <div className="flex space-x-2 mt-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-red-500 animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-500 mb-4">{error}</p>
                <button
                  onClick={loadOrderHistory}
                  className="px-4 py-2 rounded-lg transition-colors hover:opacity-90"
                  style={{ 
                    backgroundColor: buttonColor,
                    color: buttonTextColor
                  }}
                >
                  Reintentar
                </button>
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12">
                <FaHistory className="text-6xl text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">No tienes pedidos anteriores</p>
                <p className="text-sm text-gray-400">
                  Tus pedidos completados aparecerán aquí
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order, index) => (
                  <motion.div
                    key={order._id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-5 hover:shadow-lg transition-all border border-gray-200"
                  >
                    {/* Order Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-lg font-bold text-purple-600">
                            #{order.orderNumber}
                          </span>
                          <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full flex items-center gap-1">
                            <FaCheckCircle />
                            Completado
                          </span>
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                            {getOrderTypeLabel(order.orderType)}
                          </span>
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <FaClock className="mr-2" />
                          {formatDate(order.completedAt || order.createdAt)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-800">
                          ${order.totalAmount.toLocaleString()}
                        </div>
                        <button
                          onClick={() => handleReorder(order)}
                          className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg transition-all shadow-md hover:shadow-lg text-sm font-semibold hover:opacity-90"
                          style={{ 
                            backgroundColor: buttonColor,
                            color: buttonTextColor
                          }}
                        >
                          <FaShoppingCart />
                          Repetir Pedido
                        </button>
                      </div>
                    </div>

                    {/* Order Items */}
                    <div className="space-y-2">
                      {order.items.map((item, itemIdx) => (
                        <div
                          key={itemIdx}
                          className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            {item.image && (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-12 h-12 object-cover rounded-lg"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-800">
                                  {item.quantity}x {item.name}
                                </span>
                              </div>
                              {(item.selectedToppings?.length > 0 || item.selectedOptions?.length > 0) && (
                                <p className="text-xs text-gray-500 truncate">
                                  {item.selectedToppings?.map(g => g.toppings?.map(t => t.name).join(', ')).join('; ')}
                                  {item.selectedOptions?.map(g => g.option?.name).join(', ')}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-700">
                              ${(item.price * item.quantity).toLocaleString()}
                            </span>
                            <button
                              onClick={() => handleAddItemToFavorites(item, order)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                              title="Agregar a favoritos"
                            >
                              <FaHeart />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Order Details Toggle */}
                    <button
                      onClick={() => setSelectedOrder(selectedOrder === order._id ? null : order._id)}
                      className="mt-3 text-sm text-purple-600 hover:text-purple-700 font-medium"
                    >
                      {selectedOrder === order._id ? '▲ Ocultar detalles' : '▼ Ver detalles'}
                    </button>

                    {/* Expanded Details */}
                    {selectedOrder === order._id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 pt-3 border-t border-gray-200 text-sm text-gray-600 space-y-1"
                      >
                        {order.tableNumber && (
                          <p><span className="font-medium">Mesa:</span> {order.tableNumber}</p>
                        )}
                        {order.address && (
                          <p><span className="font-medium">Dirección:</span> {order.address}</p>
                        )}
                        {order.deliveryFee > 0 && (
                          <p><span className="font-medium">Costo de envío:</span> ${order.deliveryFee.toLocaleString()}</p>
                        )}
                        {order.discountAmount > 0 && (
                          <p><span className="font-medium">Descuento aplicado:</span> -${order.discountAmount.toLocaleString()}</p>
                        )}
                      </motion.div>
                    )}
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

export default OrderHistoryModal;
