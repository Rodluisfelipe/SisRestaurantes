import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { API_URL } from '../config';
import { socket } from '../services/socket';
import logger from '../utils/logger';
import { isPushSupported, subscribeToPush, isIOS, isInstalledPWA } from '../utils/pushNotifications';

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
const BOOKING_STEPS = ['pending', 'confirmed', 'completed'];

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

  // Payment inline states
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [pushState, setPushState] = useState('checking'); // checking | idle | subscribed | dismissed | ios-not-pwa
  const proofInputRef = useRef(null);

  const themeColor = businessConfig?.theme?.buttonColor || '#f97316';
  const textColor = businessConfig?.theme?.buttonTextColor || '#ffffff';
  const paymentInfo = businessConfig?.paymentInfo || {};
  const businessId = businessConfig?.businessId || businessConfig?._id;

  // Check push notification status on mount
  useEffect(() => {
    const checkPush = async () => {
      // iOS without PWA install: push not supported
      if (isIOS() && !isInstalledPWA()) {
        setPushState('ios-not-pwa');
        return;
      }
      if (!isPushSupported()) {
        setPushState('dismissed');
        return;
      }
      if (Notification.permission === 'denied') {
        setPushState('dismissed');
        return;
      }
      // Check if there's already an active push subscription
      if (Notification.permission === 'granted') {
        try {
          const reg = await navigator.serviceWorker.ready;
          const existingSub = await reg.pushManager.getSubscription();
          if (existingSub) {
            // Already subscribed, but ensure backend knows about this customerToken
            setPushState('subscribed');
            // Re-register with current customerToken silently
            try {
              await subscribeToPush(businessId, null, customerToken);
            } catch (e) { /* silent */ }
            return;
          }
        } catch (e) { /* fall through to idle */ }
      }
      setPushState('idle');
    };
    checkPush();
  }, [businessId, customerToken]);

  // Handle enable notifications (user tap = user gesture → browser allows the prompt)
  const handleEnableNotifications = async () => {
    try {
      await subscribeToPush(businessId, null, customerToken);
      setPushState('subscribed');
      logger.info('Customer push subscription succeeded from OrderTracker');
    } catch (err) {
      logger.warn('Push subscription failed:', err.message);
      if (Notification.permission === 'denied') {
        setPushState('dismissed');
      }
    }
  };

  // Build available payment methods from config (respects paymentMethods per-mode toggles)
  const paymentMethods = (() => {
    const pm = businessConfig?.paymentMethods;
    const isEnabled = (id, fallback) => {
      if (!pm || !pm[id]) return fallback; // backward compat
      return pm[id].enabled && pm[id].modes?.inapp !== false;
    };
    return [
      isEnabled('nequi', !!paymentInfo.nequi) && paymentInfo.nequi && { id: 'nequi', label: 'Nequi', logo: 'https://cdn.prod.website-files.com/6317a229ebf7723658463b4b/663a6b0d43303ddf38035997_logo-nequi.svg', color: '#200020', bg: '#F3E8FF', number: paymentInfo.nequi },
      isEnabled('daviplata', !!paymentInfo.daviplata) && paymentInfo.daviplata && { id: 'daviplata', label: 'Daviplata', logo: 'https://play-lh.googleusercontent.com/bNPDiFqg28L6ckatfuP-WgrxDRDk0JEOkC6nUIQp7Q61RW78i1bw-ffMmEjyxl-qP6dv3ANDOQqmIbBtgJI3EA', color: '#DC2626', bg: '#FEF2F2', number: paymentInfo.daviplata },
      isEnabled('transferencia', !!paymentInfo.bankAccountNumber) && paymentInfo.bankAccountNumber && { id: 'bank', label: paymentInfo.bankName || 'Banco', icon: '🏦', color: '#1D4ED8', bg: '#EFF6FF',
        number: paymentInfo.bankAccountNumber, extra: `${paymentInfo.bankAccountType || 'Cuenta'}${paymentInfo.accountHolder ? ` · ${paymentInfo.accountHolder}` : ''}` },
    ].filter(Boolean);
  })();

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const handleProofSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { setUploadError('Máximo 25MB'); return; }
    setProofFile(file);
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = (ev) => setProofPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleProofUpload = async () => {
    if (!proofFile) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('proof', proofFile);
      formData.append('customerToken', customerToken);
      await api.post(`/orders/${orderId}/payment-proof`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });
      setProofFile(null);
      setProofPreview(null);
      fetchOrder(); // refresh status
    } catch (err) {
      setUploadError(err.response?.data?.message || 'Error al subir. Intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  // Fetch order status
  const fetchOrder = useCallback(async () => {
    if (!orderId || !customerToken) return;
    try {
      const response = await api.get(`/orders/track/${orderId}`, {
        headers: { 'X-Customer-Token': customerToken }
      });
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

  // Use socket for real-time updates, with polling as fallback (30s)
  useEffect(() => {
    fetchOrder();
    
    if (!polling) return;

    // Socket-based real-time tracking
    if (socket && orderId && customerToken) {
      if (!socket.connected) socket.connect();
      socket.emit('trackOrder', { orderId, customerToken });
      
      const handleStatusChange = (data) => {
        if (data.orderId === orderId || data.orderId?.toString() === orderId) {
          setOrder(prev => data.order || { ...prev, status: data.status });
          setError(null);
          if (['completed', 'cancelled', 'delivered'].includes(data.status)) {
            setPolling(false);
          }
        }
      };
      socket.on('order_status_changed', handleStatusChange);
      
      // Fallback polling at 30s (reduced from 5s since socket handles real-time)
      const interval = setInterval(fetchOrder, 30000);
      return () => {
        socket.off('order_status_changed', handleStatusChange);
        socket.emit('untrackOrder', orderId);
        clearInterval(interval);
      };
    }
    
    // Pure polling fallback if socket unavailable
    const interval = setInterval(fetchOrder, 5000);
    return () => clearInterval(interval);
  }, [fetchOrder, polling, orderId, customerToken]);

  // Determine step flow
  const isInApp = order?.orderChannel === 'inapp';
  const isBooking = order?.isBooking === true;
  const steps = isBooking ? BOOKING_STEPS : isInApp ? INAPP_STEPS : WHATSAPP_STEPS;
  
  // Find current step index
  const currentStepIndex = steps.indexOf(order?.status);

  // Override status labels for bookings
  const bookingStatusOverrides = isBooking ? {
    pending: { label: 'Cita Pendiente', shortLabel: 'Pendiente', icon: '📅', color: '#f59e0b', description: 'Tu cita está pendiente de confirmación' },
    confirmed: { label: 'Cita Confirmada', shortLabel: 'Confirmada', icon: '✅', color: '#10b981', description: 'Tu cita ha sido confirmada' },
    completed: { label: 'Cita Completada', shortLabel: 'Completada', icon: '✨', color: '#0ea5e9', description: 'Tu cita fue completada' },
    cancelled: { label: 'Cita Cancelada', shortLabel: 'Cancelada', icon: '❌', color: '#ef4444', description: 'Tu cita fue cancelada' },
  } : {};
  const rawStatus = bookingStatusOverrides[order?.status] || STATUS_CONFIG[order?.status] || STATUS_CONFIG.pending;
  // Adapt "restaurante" in descriptions based on businessType
  const businessLabel = (() => {
    const bt = businessConfig?.businessType;
    if (bt === 'hotel') return 'el hotel';
    if (['salon', 'spa', 'clinic', 'services'].includes(bt)) return 'el negocio';
    return 'el restaurante';
  })();
  const currentStatus = rawStatus.description?.includes('restaurante')
    ? { ...rawStatus, description: rawStatus.description.replace(/[Ee]l restaurante/, businessLabel) }
    : rawStatus;

  // Format booking date
  const formatBookingDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  };
  const formatBookingTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  };

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
        className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md overflow-hidden shadow-2xl flex flex-col modal-h-full pb-safe"
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
              <span className="text-sm font-semibold">{isBooking ? 'Cita' : 'Pedido'} #{order.orderNumber}</span>
            </div>
            {isBooking && order.bookingDate && (
              <div className="mt-2 inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1.5 backdrop-blur-sm">
                <span className="text-sm">📅 {formatBookingDate(order.bookingDate)} · {formatBookingTime(order.bookingDate)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Step Progress */}
          <div className="flex items-center justify-between px-2">
            {steps.map((step, index) => {
              const stepConfig = (isBooking && bookingStatusOverrides[step]) || STATUS_CONFIG[step];
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

          {/* Push notification banner */}
          {pushState === 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl"
            >
              <span className="text-xl flex-shrink-0">🔔</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-blue-800">¿Recibir notificaciones?</p>
                <p className="text-[10px] text-blue-600 mt-0.5">Te avisamos cuando tu pedido cambie de estado</p>
              </div>
              <button
                onClick={handleEnableNotifications}
                className="flex-shrink-0 px-3 py-1.5 bg-blue-600 text-white text-[11px] font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Activar
              </button>
              <button
                onClick={() => setPushState('dismissed')}
                className="flex-shrink-0 p-1 text-blue-400 hover:text-blue-600"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </motion.div>
          )}

          {/* iOS not-PWA hint */}
          {pushState === 'ios-not-pwa' && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl"
            >
              <span className="text-xl flex-shrink-0">📲</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-700">Recibe notificaciones</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Toca <span className="inline-flex items-center"><svg className="w-3 h-3 inline text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg></span> y luego <strong>"Añadir a inicio"</strong> para activar notificaciones
                </p>
              </div>
              <button
                onClick={() => setPushState('dismissed')}
                className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </motion.div>
          )}

          {/* Booking info card */}
          {isBooking && order.bookingDate && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">📅</div>
                <div>
                  <h4 className="font-semibold text-indigo-900 text-sm">Tu cita</h4>
                  <p className="text-indigo-700 text-xs mt-0.5">
                    {formatBookingDate(order.bookingDate)} a las {formatBookingTime(order.bookingDate)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Payment section - inline payment methods + upload */}
          {isInApp && !isBooking && order.status === 'pending_payment' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              {/* Payment method buttons */}
              {paymentMethods.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Medio de pago</p>
                  <div className={`grid gap-2 ${paymentMethods.length === 1 ? 'grid-cols-1' : paymentMethods.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                    {paymentMethods.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedPayment(selectedPayment === m.id ? null : m.id)}
                        className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all ${
                          selectedPayment === m.id
                            ? 'border-blue-500 bg-blue-50 shadow-sm'
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        {m.logo ? (
                          <img src={m.logo} alt={m.label} className="h-6 w-auto object-contain" />
                        ) : (
                          <span className="text-lg">{m.icon}</span>
                        )}
                        <span className={`text-[11px] font-semibold ${selectedPayment === m.id ? 'text-blue-700' : 'text-gray-500'}`}>{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected payment info card */}
              <AnimatePresence mode="wait">
                {selectedPayment && (() => {
                  const m = paymentMethods.find(p => p.id === selectedPayment);
                  if (!m) return null;
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-xl border p-3 space-y-1" style={{ backgroundColor: m.bg, borderColor: `${m.color}30` }}>
                        <div className="flex items-center gap-2">
                          {m.logo && <img src={m.logo} alt={m.label} className="h-4 w-auto object-contain" />}
                          <p className="text-[11px] font-medium" style={{ color: m.color }}>{m.label}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-base font-bold text-gray-900 tracking-wide">{m.number}</p>
                          <button
                            onClick={() => copyToClipboard(m.number)}
                            className="px-2 py-1 rounded-lg text-xs font-medium bg-white/80 border border-gray-200 active:scale-95 transition-all"
                          >
                            📋 Copiar
                          </button>
                        </div>
                        {m.extra && <p className="text-[11px] text-gray-500">{m.extra}</p>}
                        {paymentInfo.instructions && (
                          <p className="text-[11px] text-gray-500 mt-1">💡 {paymentInfo.instructions}</p>
                        )}
                        {/* Total to transfer */}
                        <div className="pt-2 mt-1 border-t" style={{ borderColor: `${m.color}20` }}>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500">Valor a transferir</span>
                            <span className="text-sm font-bold text-gray-900">{formatPrice(order.finalAmount || order.totalAmount)}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })()}
              </AnimatePresence>

              {/* Upload proof section */}
              <div className="space-y-2">
                <input
                  ref={proofInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
                  onChange={handleProofSelect}
                  className="hidden"
                />

                {!proofPreview ? (
                  <button
                    onClick={() => proofInputRef.current?.click()}
                    className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    style={{ backgroundColor: themeColor, color: textColor }}
                  >
                    📸 Subir Comprobante
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="relative rounded-xl overflow-hidden bg-gray-100">
                      <img src={proofPreview} alt="Comprobante" className="w-full h-36 object-contain" />
                      <button
                        onClick={() => { setProofFile(null); setProofPreview(null); if (proofInputRef.current) proofInputRef.current.value = ''; }}
                        className="absolute top-2 right-2 w-7 h-7 bg-black/50 text-white rounded-full flex items-center justify-center text-xs"
                      >
                        ✕
                      </button>
                    </div>
                    <button
                      onClick={handleProofUpload}
                      disabled={uploading}
                      className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{ backgroundColor: '#10b981' }}
                    >
                      {uploading ? (
                        <><span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Enviando...</>
                      ) : (
                        <>📤 Enviar Comprobante</>
                      )}
                    </button>
                  </div>
                )}

                {uploadError && (
                  <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">⚠️ {uploadError}</p>
                )}
              </div>

              {paymentMethods.length === 0 && (
                <p className="text-xs text-gray-400 text-center">No se han configurado medios de pago</p>
              )}
            </motion.div>
          )}

          {/* Payment uploaded - waiting for confirmation */}
          {isInApp && !isBooking && order.status === 'payment_uploaded' && (
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

          {/* Payment rejected notice */}
          {isInApp && !isBooking && order.status === 'pending_payment' && order.statusHistory?.some(h => h.note?.includes('rechazado')) && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2">
              <span className="text-sm">⚠️</span>
              <p className="text-xs text-red-700 font-medium">
                {order.statusHistory?.filter(h => h.note?.includes('rechazado')).pop()?.note || 'Comprobante rechazado — sube uno nuevo'}
              </p>
            </div>
          )}

          {/* Order ready celebration */}
          {(order.status === 'ready' || order.status === 'completed') && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center"
            >
              <div className="text-4xl mb-2">🎉</div>
              <h4 className="font-bold text-green-900">{isBooking ? '¡Tu cita fue completada!' : '¡Tu pedido está listo!'}</h4>
              <p className="text-green-700 text-sm mt-1">
                {isBooking ? '¡Gracias por tu visita!' :
                 order.orderType === 'delivery' ? 'Tu pedido va en camino' : 
                 order.orderType === 'takeaway' ? 'Puedes pasar a recogerlo' : 
                 businessConfig?.businessType === 'hotel' ? 'Será entregado en tu habitación' : 'Será servido en tu mesa'}
              </p>
            </motion.div>
          )}

          {/* Order Items */}
          <div className="bg-gray-50 rounded-2xl p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">{isBooking ? 'Tu Cita' : 'Tu Pedido'}</h4>
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
