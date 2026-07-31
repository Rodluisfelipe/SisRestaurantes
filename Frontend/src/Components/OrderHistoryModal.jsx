import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaHistory, FaTimes, FaShoppingCart, FaHeart, FaClock, FaCheckCircle, FaChevronDown, FaRedo, FaMapMarkerAlt, FaChair, FaTruck, FaBoxOpen, FaStar, FaUtensils } from 'react-icons/fa';
import api from '../services/api';
import logger from '../utils/logger';
import { useBusinessConfig } from '../Context/BusinessContext';

/**
 * Modal para mostrar historial de pedidos y permitir re-ordenar rápidamente
 */
/* fullScreen: en el menú V2 se abre como pantalla, no como hoja flotante. */
const OrderHistoryModal = ({ show, onClose, businessId, customerPhone, onReorder, onAddToFavorites, theme, onReview, fullScreen = false }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [addedFav, setAddedFav] = useState(null);
  const [reviewedOrderIds, setReviewedOrderIds] = useState(new Set());
  
  // Colores del tema con fallback
  const buttonColor = theme?.buttonColor || '#f97316';
  const buttonTextColor = theme?.buttonTextColor || '#ffffff';
  const { businessConfig } = useBusinessConfig();
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);

  useEffect(() => {
    if (show && customerPhone && businessId) {
      loadOrderHistory();
    }
  }, [show, customerPhone, businessId]);

  const loadOrderHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const completedResponse = await api.get(`/orders/completed?businessId=${businessId}`);
      const allCompleted = completedResponse.data || [];
      
      const customerOrders = allCompleted
        .filter(order => order.phone === customerPhone)
        .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt))
        .slice(0, 20);
      
      setOrders(customerOrders);
      
      // Fetch which orders have already been reviewed
      try {
        const reviewsRes = await api.get(`/reviews/${businessId}?phone=${customerPhone}`);
        const reviews = reviewsRes.data?.reviews || [];
        const ids = new Set(reviews.map(r => r.orderId?.toString()).filter(Boolean));
        setReviewedOrderIds(ids);
      } catch {
        // Non-critical — just can't show review status
      }
    } catch (err) {
      logger.error('Error loading order history:', err);
      setError('No se pudo cargar el historial');
    } finally {
      setLoading(false);
    }
  };

  const handleReorder = (order) => {
    if (onReorder) {
      const cartItems = order.items.map(item => ({
        productId: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        selectedToppings: item.selectedToppings || [],
        selectedOptions: item.selectedOptions || {},
        notes: item.notes || '',
        image: item.image || item.productImage || ''
      }));
      onReorder(cartItems);
      logger.info('Order reordered', { orderNumber: order.orderNumber });
      onClose();
    }
  };

  const handleAddItemToFavorites = async (item) => {
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
        setAddedFav(item.productId);
        setTimeout(() => setAddedFav(null), 2000);
        logger.info('Item added to favorites from order history');
      }
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.message?.includes('already in favorites')) {
        setAddedFav(item.productId);
        setTimeout(() => setAddedFav(null), 2000);
      } else {
        logger.error('Error adding to favorites:', err);
      }
    }
  };

  if (!show) return null;

  const orderTypeConfig = {
    'inSite':   { label: 'En sitio',    icon: FaChair,          bg: 'bg-blue-50',   text: 'text-blue-600' },
    'takeaway': { label: 'Para llevar',  icon: FaBoxOpen,        bg: 'bg-amber-50',  text: 'text-amber-600' },
    'delivery': { label: 'Domicilio',    icon: FaTruck,          bg: 'bg-emerald-50', text: 'text-emerald-600' },
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins}min`;
    if (diffHrs < 24) {
      const isToday = date.toDateString() === now.toDateString();
      if (isToday) return `Hoy ${date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`;
      return `Ayer ${date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (diffDays === 1) return `Ayer ${date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`;
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '$0';
    return '$' + Number(amount).toLocaleString('es-CO');
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed inset-0 z-50 ${fullScreen ? '' : 'bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center'}`}
        onClick={fullScreen ? undefined : onClose}
      >
        <motion.div
          initial={fullScreen ? { x: '100%' } : { y: '100%', opacity: 0 }}
          animate={fullScreen ? { x: 0 } : { y: 0, opacity: 1 }}
          exit={fullScreen ? { x: '100%' } : { y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className={fullScreen
            ? 'w-full h-full overflow-hidden flex flex-col'
            : 'bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[92vh] sm:max-h-[85vh] overflow-hidden flex flex-col shadow-2xl'}
          style={fullScreen ? { background: 'var(--mb-surface)' } : undefined}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header — compact */}
          <div
            className="relative shrink-0"
            style={fullScreen ? { background: 'var(--mb-card)', paddingTop: 'env(safe-area-inset-top, 0px)' } : undefined}
          >
            {/* Drag handle for mobile — en pantalla completa no aplica */}
            {!fullScreen && (
              <div className="flex justify-center pt-3 pb-1 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-slate-300" />
              </div>
            )}
            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
                  style={{ backgroundColor: buttonColor + '15' }}
                >
                  <FaHistory className="text-lg" style={{ color: buttonColor }} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">{isService ? 'Mis Citas' : 'Mis Pedidos'}</h2>
                  <p className="text-xs text-slate-400">
                    {loading ? 'Cargando...' : `${orders.length} ${isService ? (orders.length !== 1 ? 'citas' : 'cita') : (orders.length !== 1 ? 'pedidos' : 'pedido')}`}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-all"
              >
                <FaTimes className="text-sm" />
              </button>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <div className="relative w-14 h-14 mb-4">
                  <div className="absolute inset-0 rounded-full border-[3px] border-slate-100" />
                  <motion.div
                    className="absolute inset-0 rounded-full border-[3px] border-transparent"
                    style={{ borderTopColor: buttonColor }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  />
                </div>
                <p className="text-sm font-medium text-slate-500">Cargando historial...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
                  <FaTimes className="text-xl text-red-400" />
                </div>
                <p className="text-sm text-red-500 mb-4">{error}</p>
                <button
                  onClick={loadOrderHistory}
                  className="px-5 py-2 rounded-xl text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-all"
                  style={{ backgroundColor: buttonColor }}
                >
                  Reintentar
                </button>
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                  <FaHistory className="text-2xl text-slate-300" />
                </div>
                <p className="text-base font-semibold text-slate-600 mb-1">{isService ? 'Sin citas aún' : 'Sin pedidos aún'}</p>
                <p className="text-sm text-slate-400">
                  {isService ? 'Tu historial aparecerá aquí cuando agendes tu primera cita' : 'Tu historial aparecerá aquí cuando hagas tu primer pedido'}
                </p>
              </div>
            ) : (
              <div className="px-4 py-3 space-y-2.5">
                {orders.map((order, index) => {
                  const isExpanded = expandedOrder === order._id;
                  const typeConf = orderTypeConfig[order.orderType] || orderTypeConfig['inSite'];
                  const TypeIcon = typeConf.icon;
                  const itemCount = order.items?.reduce((sum, i) => sum + (i.quantity || 1), 0) || 0;
                  const firstItems = order.items?.slice(0, 2) || [];
                  const moreItems = (order.items?.length || 0) - 2;
                  const total = (order.totalAmount || 0) + (order.deliveryFee || 0);

                  return (
                    <motion.div
                      key={order._id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                    >
                      {/* Compact card */}
                      <button
                        onClick={() => setExpandedOrder(isExpanded ? null : order._id)}
                        className="w-full text-left p-4 focus:outline-none"
                      >
                        <div className="flex items-center gap-3">
                          {/* Order number indicator */}
                          <div 
                            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm"
                            style={{ backgroundColor: buttonColor + '12', color: buttonColor }}
                          >
                            #{order.orderNumber}
                          </div>
                          
                          {/* Order info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[13px] font-semibold text-slate-800 truncate">
                                {firstItems.map(i => i.name).join(', ')}
                                {moreItems > 0 && ` +${moreItems}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                              <span className="flex items-center gap-1">
                                <FaClock className="text-[9px]" />
                                {formatDate(order.completedAt || order.createdAt)}
                              </span>
                              <span>•</span>
                              <span className={`flex items-center gap-0.5 font-medium ${typeConf.text}`}>
                                <TypeIcon className="text-[9px]" />
                                {typeConf.label}
                              </span>
                              <span>•</span>
                              <span>{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
                            </div>
                          </div>
                          
                          {/* Price + chevron */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-bold text-slate-800">
                              {formatCurrency(total)}
                            </span>
                            <motion.div
                              animate={{ rotate: isExpanded ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <FaChevronDown className="text-[10px] text-slate-300" />
                            </motion.div>
                          </div>
                        </div>
                      </button>

                      {/* Expanded content */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: 'easeInOut' }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4">
                              {/* Divider */}
                              <div className="h-px bg-slate-100 mb-3" />

                              {/* Items list */}
                              <div className="space-y-2 mb-3">
                                {order.items.map((item, itemIdx) => (
                                  <div
                                    key={itemIdx}
                                    className="flex items-center gap-3 py-1.5"
                                  >
                                    {/* Item image or placeholder */}
                                    {item.image ? (
                                      <img
                                        src={item.image}
                                        alt={item.name}
                                        className="w-10 h-10 object-cover rounded-lg shrink-0"
                                      />
                                    ) : (
                                      <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                                        <FaUtensils className="text-slate-300 text-sm" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[13px] font-medium text-slate-700 truncate">
                                        <span className="text-slate-400 mr-1">{item.quantity}×</span>
                                        {item.name}
                                      </p>
                                      {item.selectedToppings?.length > 0 && (
                                        <p className="text-[11px] text-slate-400 truncate">
                                          {item.selectedToppings.map(g => g.toppings?.map(t => t.name).join(', ')).filter(Boolean).join(' · ')}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className="text-xs font-semibold text-slate-600">
                                        {formatCurrency(item.price * item.quantity)}
                                      </span>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleAddItemToFavorites(item); }}
                                        className={`w-7 h-7 flex items-center justify-center rounded-full transition-all ${
                                          addedFav === item.productId
                                            ? 'bg-red-500 text-white scale-110'
                                            : 'bg-slate-50 text-slate-300 hover:text-red-400 hover:bg-red-50'
                                        }`}
                                        title="Agregar a favoritos"
                                      >
                                        <FaHeart className="text-[10px]" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Order details */}
                              {(order.tableNumber || order.address || order.deliveryFee > 0 || order.discountAmount > 0) && (
                                <div className="bg-slate-50 rounded-xl p-3 mb-3 space-y-1.5">
                                  {order.tableNumber && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-slate-400">{isService ? 'Espacio' : 'Mesa'}</span>
                                      <span className="font-medium text-slate-600">{order.tableNumber}</span>
                                    </div>
                                  )}
                                  {order.address && (
                                    <div className="flex justify-between text-xs gap-4">
                                      <span className="text-slate-400 shrink-0">Dirección</span>
                                      <span className="font-medium text-slate-600 text-right truncate">{order.address}</span>
                                    </div>
                                  )}
                                  {order.deliveryFee > 0 && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-slate-400">Envío</span>
                                      <span className="font-medium text-slate-600">{formatCurrency(order.deliveryFee)}</span>
                                    </div>
                                  )}
                                  {order.discountAmount > 0 && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-slate-400">Descuento</span>
                                      <span className="font-medium text-emerald-600">-{formatCurrency(order.discountAmount)}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between text-xs pt-1.5 border-t border-slate-200">
                                    <span className="font-semibold text-slate-600">Total</span>
                                    <span className="font-bold text-slate-800">{formatCurrency(total)}</span>
                                  </div>
                                </div>
                              )}

                              {/* Action buttons */}
                              <div className="flex gap-2">
                                {/* Review button — show if not yet reviewed */}
                                {!reviewedOrderIds.has(order._id?.toString()) && onReview && (
                                  <motion.button
                                    whileTap={{ scale: 0.97 }}
                                    onClick={(e) => { e.stopPropagation(); onReview(order); onClose(); }}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold border-2 transition-all active:scale-[0.98]"
                                    style={{ borderColor: buttonColor, color: buttonColor, backgroundColor: buttonColor + '08' }}
                                  >
                                    <FaStar className="text-xs" />
                                    Calificar
                                  </motion.button>
                                )}
                                {reviewedOrderIds.has(order._id?.toString()) && (
                                  <div className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-medium text-emerald-600 bg-emerald-50">
                                    <FaCheckCircle className="text-xs" />
                                    Reseña enviada
                                  </div>
                                )}
                                <motion.button
                                  whileTap={{ scale: 0.97 }}
                                  onClick={(e) => { e.stopPropagation(); handleReorder(order); }}
                                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
                                  style={{ backgroundColor: buttonColor, color: buttonTextColor }}
                                >
                                  <FaRedo className="text-xs" />
                                  {isService ? 'Repetir cita' : 'Repetir pedido'}
                                </motion.button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default OrderHistoryModal;
