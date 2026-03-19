import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { socket } from '../services/socket';
import logger from '../utils/logger';

const STATUS_LABELS = {
  pending: { label: 'Recibido', icon: '📋', bg: 'bg-blue-100', text: 'text-blue-700' },
  pending_payment: { label: 'Pendiente Pago', icon: '💳', bg: 'bg-amber-100', text: 'text-amber-700' },
  payment_uploaded: { label: 'Verificando', icon: '📤', bg: 'bg-purple-100', text: 'text-purple-700' },
  payment_confirmed: { label: 'Pago OK', icon: '✅', bg: 'bg-green-100', text: 'text-green-700' },
  confirmed: { label: 'Confirmado', icon: '✅', bg: 'bg-green-100', text: 'text-green-700' },
  preparing: { label: 'Preparando', icon: '👨‍🍳', bg: 'bg-orange-100', text: 'text-orange-700' },
  inProgress: { label: 'Preparando', icon: '👨‍🍳', bg: 'bg-orange-100', text: 'text-orange-700' },
  ready: { label: '¡Listo!', icon: '🎉', bg: 'bg-green-100', text: 'text-green-700' },
  completed: { label: 'Completado', icon: '✨', bg: 'bg-gray-100', text: 'text-gray-600' },
  delivered: { label: 'Entregado', icon: '🏠', bg: 'bg-gray-100', text: 'text-gray-600' },
  cancelled: { label: 'Cancelado', icon: '❌', bg: 'bg-red-100', text: 'text-red-700' }
};

const MyOrders = ({ businessId, phone, businessConfig, onTrackOrder, onClose }) => {
  const [orders, setOrders] = useState({ active: [], completed: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('active');

  const themeColor = businessConfig?.theme?.buttonColor || '#f97316';
  const textColor = businessConfig?.theme?.buttonTextColor || '#ffffff';
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);

  const fetchOrders = useCallback(async () => {
    if (!phone || !businessId) return;
    try {
      const response = await api.get(`/orders/my-orders?phone=${encodeURIComponent(phone)}&businessId=${businessId}`);
      setOrders(response.data);
    } catch (err) {
      logger.error('Error fetching my orders:', err);
    } finally {
      setLoading(false);
    }
  }, [phone, businessId]);

  useEffect(() => {
    fetchOrders();

    // Listen for real-time order updates via socket
    const handleOrderUpdate = (data) => {
      // Refresh orders when any order in our business gets updated
      fetchOrders();
    };
    if (socket) {
      socket.on('order_updated', handleOrderUpdate);
      socket.on('order_status_changed', handleOrderUpdate);
    }
    
    // Reduced fallback polling (30s instead of 10s since socket handles real-time)
    const interval = setInterval(fetchOrders, 30000);
    return () => {
      if (socket) {
        socket.off('order_updated', handleOrderUpdate);
        socket.off('order_status_changed', handleOrderUpdate);
      }
      clearInterval(interval);
    };
  }, [fetchOrders]);

  const formatPrice = (amount) => {
    if (!amount && amount !== 0) return '$0';
    return amount.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date) => {
    const d = new Date(date);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Hoy';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  };

  const currentOrders = tab === 'active' ? orders.active : orders.completed;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-hidden shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">{isService ? 'Mis Citas' : 'Mis Pedidos'}</h2>
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex bg-gray-100 rounded-xl p-1">
            {[
              { key: 'active', label: 'Activos', count: orders.active.length },
              { key: 'completed', label: 'Anteriores', count: orders.completed.length }
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  tab === t.key 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label} {t.count > 0 && (
                  <span className={`ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-xs px-1 ${
                    tab === t.key ? 'text-white' : 'bg-gray-300 text-gray-600'
                  }`} style={tab === t.key ? { backgroundColor: themeColor } : {}}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Orders List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-orange-500 rounded-full animate-spin" />
            </div>
          ) : currentOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <div className="text-4xl mb-3">{tab === 'active' ? '📋' : '📦'}</div>
              <h3 className="font-semibold text-gray-900 mb-1">
                {tab === 'active' ? (isService ? 'Sin citas activas' : 'Sin pedidos activos') : (isService ? 'Sin citas anteriores' : 'Sin pedidos anteriores')}
              </h3>
              <p className="text-sm text-gray-500">
                {tab === 'active' ? (isService ? 'Tus citas activas aparecerán aquí' : 'Tus pedidos activos aparecerán aquí') : (isService ? 'Tu historial de citas aparecerá aquí' : 'Tu historial de pedidos aparecerá aquí')}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {currentOrders.map((order) => {
                const statusInfo = STATUS_LABELS[order.status] || STATUS_LABELS.pending;
                return (
                  <button
                    key={order._id}
                    onClick={() => onTrackOrder(order)}
                    className="w-full p-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-gray-900 text-sm">
                            Pedido #{order.orderNumber}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}>
                            <span>{statusInfo.icon}</span>
                            {statusInfo.label}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mb-2">
                          {formatDate(order.createdAt || order.completedAt)} · {formatTime(order.createdAt || order.completedAt)}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-600">
                          <span>{order.items?.length || 0} productos</span>
                          <span className="font-semibold text-gray-900">
                            {formatPrice(order.finalAmount || order.totalAmount)}
                          </span>
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-gray-300 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default MyOrders;
