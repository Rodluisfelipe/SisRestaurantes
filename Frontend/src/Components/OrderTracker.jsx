import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { API_URL } from '../config';
import logger from '../utils/logger';

// Status configuration with labels, icons, colors
const STATUS_CONFIG = {
  pending_payment: {
    label: 'Pendiente de Pago',
    shortLabel: 'Pagar',
    icon: '💳',
    color: '#f59e0b',
    description: 'Realiza el pago y sube tu comprobante'
  },
  payment_uploaded: {
    label: 'Comprobante Enviado',
    shortLabel: 'Enviado',
    icon: '📤',
    color: '#8b5cf6',
    description: 'El restaurante está verificando tu pago'
  },
  payment_confirmed: {
    label: 'Pago Confirmado',
    shortLabel: 'Confirmado',
    icon: '✅',
    color: '#10b981',
    description: 'Tu pago ha sido confirmado'
  },
  pending: {
    label: 'Pedido Recibido',
    shortLabel: 'Recibido',
    icon: '📋',
    color: '#6366f1',
    description: 'Tu pedido fue recibido por el restaurante'
  },
  confirmed: {
    label: 'Confirmado',
    shortLabel: 'Confirmado',
    icon: '✅',
    color: '#10b981',
    description: 'El restaurante confirmó tu pedido'
  },
  preparing: {
    label: 'En Preparación',
    shortLabel: 'Preparando',
    icon: '👨‍🍳',
    color: '#f97316',
    description: 'Tu pedido se está preparando'
  },
  inProgress: {
    label: 'En Preparación',
    shortLabel: 'Preparando',
    icon: '👨‍🍳',
    color: '#f97316',
    description: 'Tu pedido se está preparando'
  },
  ready: {
    label: 'Listo',
    shortLabel: 'Listo',
    icon: '🎉',
    color: '#22c55e',
    description: '¡Tu pedido está listo!'
  },
  completed: {
    label: 'Completado',
    shortLabel: 'Completado',
    icon: '✨',
    color: '#0ea5e9',
    description: 'Pedido entregado'
  },
  delivered: {
    label: 'Entregado',
    shortLabel: 'Entregado',
    icon: '🏠',
    color: '#0ea5e9',
    description: 'Tu pedido ha sido entregado'
  },
  cancelled: {
    label: 'Cancelado',
    shortLabel: 'Cancelado',
    icon: '❌',
    color: '#ef4444',
    description: 'Este pedido fue cancelado'
  }
};

// Get the step sequence for in-app orders
const INAPP_STEPS = ['pending_payment', 'payment_uploaded', 'payment_confirmed', 'inProgress', 'completed'];
const WHATSAPP_STEPS = ['pending', 'inProgress', 'completed'];

const OrderTracker = ({ 
  orderId, 
  customerToken, 
  businessConfig, 
  onClose, 
  onUploadProof,
  initialOrder = null 
}) => {
  const [order, setOrder] = useState(initialOrder);
  const [loading, setLoading] = useState(!initialOrder);
  const [error, setError] = useState(null);
  const [polling, setPolling] = useState(true);

  const themeColor = businessConfig?.theme?.buttonColor || '#f97316';
  const textColor = businessConfig?.theme?.buttonTextColor || '#ffffff';

  // Fetch order status
  const fetchOrder = useCallback(async () => {
    if (!orderId || !customerToken) return;
    try {
      const response = await api.get(`/orders/track/${orderId}?token=${customerToken}`);
      setOrder(response.data);
      setError(null);

      // Stop polling if order is completed/cancelled/delivered
      if (['completed', 'cancelled', 'delivered'].includes(response.data.status)) {
        setPolling(false);
      }
    } catch (err) {
      logger.error('Error fetching order tracking:', err);
      if (err.response?.status === 404) {
        setError('Pedido no encontrado');
        setPolling(false);
      }
    } finally {
      setLoading(false);
    }
  }, [orderId, customerToken]);

  // Poll for updates every 5 seconds
  useEffect(() => {
    fetchOrder();
    
    if (!polling) return;
    
    const interval = setInterval(fetchOrder, 5000);
    return () => clearInterval(interval);
  }, [fetchOrder, polling]);

  // Determine step flow
  const isInApp = order?.orderChannel === 'inapp';
  const steps = isInApp ? INAPP_STEPS : WHATSAPP_STEPS;
  
  // Find current step index
  const currentStepIndex = steps.indexOf(order?.status);
  const currentStatus = STATUS_CONFIG[order?.status] || STATUS_CONFIG.pending;

  // Format price
  const formatPrice = (amount) => {
    if (!amount && amount !== 0) return '$0';
    return amount.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-gray-200 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-gray-600 text-sm">Cargando pedido...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
          <div className="text-4xl mb-3">😕</div>
          <h3 className="font-bold text-gray-900 mb-2">{error}</h3>
          <button
            onClick={onClose}
            className="mt-4 px-6 py-2 rounded-xl text-white text-sm font-medium"
            style={{ backgroundColor: themeColor }}
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div 
          className="p-5 text-center relative overflow-hidden"
          style={{ 
            background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}dd 100%)`,
            color: textColor
          }}
        >
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -translate-y-16 translate-x-16" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full translate-y-12 -translate-x-12" />
          </div>
          <div className="relative z-10">
            <button 
              onClick={onClose}
              className="absolute top-0 right-2 w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="text-3xl mb-2">{currentStatus.icon}</div>
            <h2 className="text-lg font-bold">{currentStatus.label}</h2>
            <p className="text-sm opacity-90 mt-1">{currentStatus.description}</p>
            <div className="mt-3 inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1.5 backdrop-blur-sm">
              <span className="text-sm font-semibold">Pedido #{order.orderNumber}</span>
            </div>
          </div>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Step Progress */}
          <div className="flex items-center justify-between px-2">
            {steps.map((step, index) => {
              const stepConfig = STATUS_CONFIG[step];
              const isComplete = currentStepIndex > index;
              const isCurrent = currentStepIndex === index;
              const isPending = currentStepIndex < index;

              return (
                <React.Fragment key={step}>
                  <div className="flex flex-col items-center gap-1">
                    <motion.div
                      initial={false}
                      animate={{
                        scale: isCurrent ? 1.15 : 1,
                        backgroundColor: isComplete || isCurrent ? themeColor : '#e5e7eb'
                      }}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm"
                      style={{ color: isComplete || isCurrent ? textColor : '#9ca3af' }}
                    >
                      {isComplete ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span>{stepConfig.icon}</span>
                      )}
                    </motion.div>
                    <span className={`text-[10px] font-medium text-center leading-tight ${isCurrent ? 'text-gray-900' : 'text-gray-400'}`}>
                      {stepConfig.shortLabel}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="flex-1 h-0.5 mx-1 rounded-full" style={{ backgroundColor: isComplete ? themeColor : '#e5e7eb' }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Payment Upload CTA - only show when pending payment */}
          {isInApp && order.status === 'pending_payment' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-50 border border-amber-200 rounded-2xl p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
                  💳
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-amber-900 text-sm">Realiza tu pago</h4>
                  <p className="text-amber-700 text-xs mt-1">
                    Transfiere a la cuenta indicada y sube el comprobante
                  </p>
                  <button
                    onClick={onUploadProof}
                    className="mt-3 w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:shadow-lg active:scale-95"
                    style={{ backgroundColor: themeColor }}
                  >
                    📸 Subir Comprobante de Pago
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Payment uploaded - waiting for confirmation */}
          {isInApp && order.status === 'payment_uploaded' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-purple-50 border border-purple-200 rounded-2xl p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <div className="w-5 h-5 border-2 border-purple-400 border-t-purple-600 rounded-full animate-spin" />
                </div>
                <div>
                  <h4 className="font-semibold text-purple-900 text-sm">Verificando pago</h4>
                  <p className="text-purple-700 text-xs mt-0.5">
                    El restaurante está revisando tu comprobante
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Payment rejected - show re-upload */}
          {isInApp && order.status === 'pending_payment' && order.statusHistory?.some(h => h.note?.includes('rechazado')) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 rounded-2xl p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
                  ⚠️
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-red-900 text-sm">Comprobante rechazado</h4>
                  <p className="text-red-700 text-xs mt-1">
                    {order.statusHistory?.filter(h => h.note?.includes('rechazado')).pop()?.note || 'Por favor sube un nuevo comprobante'}
                  </p>
                  <button
                    onClick={onUploadProof}
                    className="mt-3 w-full py-2.5 rounded-xl text-white text-sm font-semibold bg-red-500 hover:bg-red-600 transition-all active:scale-95"
                  >
                    📸 Subir Nuevo Comprobante
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Order ready celebration */}
          {(order.status === 'ready' || order.status === 'completed') && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center"
            >
              <div className="text-4xl mb-2">🎉</div>
              <h4 className="font-bold text-green-900">¡Tu pedido está listo!</h4>
              <p className="text-green-700 text-sm mt-1">
                {order.orderType === 'delivery' ? 'Tu pedido va en camino' : 
                 order.orderType === 'takeaway' ? 'Puedes pasar a recogerlo' : 
                 'Será servido en tu mesa'}
              </p>
            </motion.div>
          )}

          {/* Order Items */}
          <div className="bg-gray-50 rounded-2xl p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Tu Pedido</h4>
            <div className="space-y-2">
              {order.items?.map((item, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="text-gray-700">
                    <span className="font-medium">{item.quantity}x</span> {item.name}
                  </span>
                  <span className="text-gray-900 font-medium">{formatPrice(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            {order.deliveryFee > 0 && (
              <div className="flex justify-between items-center text-sm mt-2 pt-2 border-t border-gray-200">
                <span className="text-gray-500">Domicilio</span>
                <span className="text-gray-700">{formatPrice(order.deliveryFee)}</span>
              </div>
            )}
            {order.discountAmount > 0 && (
              <div className="flex justify-between items-center text-sm mt-1">
                <span className="text-green-600">Descuento</span>
                <span className="text-green-600">-{formatPrice(order.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
              <span className="font-bold text-gray-900">Total</span>
              <span className="font-bold text-gray-900 text-lg">{formatPrice(order.finalAmount || order.totalAmount)}</span>
            </div>
          </div>

          {/* Status History Timeline */}
          {order.statusHistory?.length > 0 && (
            <div className="bg-gray-50 rounded-2xl p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Historial</h4>
              <div className="space-y-3">
                {order.statusHistory.map((entry, i) => {
                  const config = STATUS_CONFIG[entry.status] || {};
                  const time = new Date(entry.timestamp).toLocaleTimeString('es-CO', { 
                    hour: '2-digit', minute: '2-digit' 
                  });
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: `${config.color}20`, color: config.color }}
                      >
                        {config.icon || '•'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">{config.label || entry.status}</span>
                          <span className="text-xs text-gray-400">{time}</span>
                        </div>
                        {entry.note && (
                          <p className="text-xs text-gray-500 mt-0.5">{entry.note}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Close button */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-all hover:shadow-lg active:scale-95"
            style={{ backgroundColor: themeColor }}
          >
            Cerrar
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default OrderTracker;
