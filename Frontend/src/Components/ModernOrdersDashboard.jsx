import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ORDER_STATUS } from '../utils/constants';
import AI from './Admin/AdminIcons';
import {
  FaClipboardList, FaSync, FaCircle, FaSearch, FaTh, FaList,
  FaUtensils, FaTv, FaShoppingBag, FaEye, FaPlay, FaCheck,
  FaUser, FaPhone, FaMapMarkerAlt, FaTruck, FaClock, FaTimes,
  FaChair, FaHome, FaTag, FaExclamationTriangle, FaWifi,
  FaMoneyBillWave, FaImage, FaTimesCircle, FaCheckCircle, FaPrint, FaMotorcycle,
  FaCreditCard, FaPlus, FaCommentDots
} from 'react-icons/fa';

const PAYMENT_LABELS = {
  cash: 'Efectivo', efectivo: 'Efectivo',
  nequi: 'Nequi', daviplata: 'Daviplata',
  transfer: 'Transferencia', transferencia: 'Transferencia',
  roomCharge: 'Cargo a habitación', other: 'Otro'
};

import { socket, socketDiagnostic, forceReconnect } from '../services/socket';
import AssignDeliveryModal from './Delivery/AssignDeliveryModal';
import AddItemsModal from './AddItemsModal';
import QuickOrderModal from './QuickOrderModal';
import OrderCard from './OrderCard';
import DeliveryLocationMap from './DeliveryLocationMap';
import useOrdersDashboard from '../hooks/useOrdersDashboard';
import api from '../services/api';

// Inline admin chat for order details
const AdminOrderChat = ({ orderId, messages: initialMessages, isOpen, onClose }) => {
  const [messages, setMessages] = useState(initialMessages || []);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  // Sync when orderDetails changes
  useEffect(() => { setMessages(initialMessages || []); }, [initialMessages]);

  // Listen for new messages via socket
  useEffect(() => {
    if (!socket || !orderId) return;
    const handler = (data) => {
      if (data.orderId?.toString() === orderId?.toString()) {
        setMessages(prev => {
          if (prev.some(m => m._id === data.message._id)) return prev;
          return [...prev, data.message];
        });
      }
    };
    socket.on('order_message', handler);
    return () => socket.off('order_message', handler);
  }, [orderId]);

  useEffect(() => {
    if (isOpen && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await api.post(`/orders/${orderId}/messages/business`, { text: text.trim() });
      setMessages(prev => [...prev, res.data]);
      setText('');
    } catch (err) { /* silent */ }
    finally { setSending(false); }
  };

  const formatTime = (ts) => new Date(ts).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="absolute bottom-0 right-0 left-0 lg:left-auto lg:right-4 lg:bottom-4 lg:w-80 z-30 bg-white rounded-t-2xl lg:rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
      style={{ maxHeight: '70vh' }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Chat header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-blue-500 text-white shrink-0">
        <div className="flex items-center gap-2">
          <FaCommentDots className="text-xs" />
          <span className="text-[13px] font-bold">Chat con cliente</span>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
          <FaTimes className="text-[10px]" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/50" style={{ minHeight: '200px', maxHeight: '50vh' }}>
        {messages.length === 0 && (
          <p className="text-[11px] text-slate-400 text-center py-8">Sin mensajes aún</p>
        )}
        {messages.map((m, i) => (
          <div key={m._id || i} className={`flex ${m.sender === 'business' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-3 py-2 text-[12px] leading-relaxed ${
              m.sender === 'business'
                ? 'bg-blue-500 text-white rounded-2xl rounded-br-md'
                : 'bg-white border border-slate-200 text-slate-700 rounded-2xl rounded-bl-md shadow-sm'
            }`}>
              <p className="break-words">{m.text}</p>
              <p className={`text-[9px] mt-0.5 ${m.sender === 'business' ? 'text-blue-200' : 'text-slate-400'}`}>{formatTime(m.timestamp)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 p-2.5 border-t border-slate-100 bg-white shrink-0">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 500))}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Escribe un mensaje..."
          className="flex-1 px-3 py-2 rounded-full bg-slate-100 border-0 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-200"
          maxLength={500}
          autoFocus
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="w-9 h-9 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-all active:scale-90 disabled:opacity-40 shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
        </button>
      </div>
    </motion.div>
  );
};

// Gift order panel — shows recipient info + ready-to-send message to forward to the recipient
const GiftPanel = ({ order, businessName }) => {
  const [copied, setCopied] = useState(false);
  if (!order?.isGift || !order?.gift) return null;
  const g = order.gift;
  const recipientMsg = `¡Hola ${g.recipientName || ''}! 🎁 Tienes un regalo en camino de parte de ${order.customerName || 'alguien especial'}.`
    + (g.message ? `\n\n💌 "${g.message}"` : '')
    + `\n\n— ${businessName || ''}`;
  const phoneDigits = (g.recipientPhone || '').replace(/\D/g, '');
  const waUrl = phoneDigits
    ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(recipientMsg)}`
    : `https://wa.me/?text=${encodeURIComponent(recipientMsg)}`;
  const copyMsg = async () => {
    try { await navigator.clipboard.writeText(recipientMsg); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* noop */ }
  };
  return (
    <div className="rounded-xl border border-pink-200 bg-pink-50/70 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-pink-100/70 border-b border-pink-200">
        {AI.gift('w-4 h-4 text-pink-700')}
        <span className="text-[13px] font-bold text-pink-800">Pedido de regalo</span>
      </div>
      <div className="p-3 space-y-2">
        <div className="text-[12px] text-pink-900 space-y-0.5">
          <p><span className="font-semibold">Destinatario:</span> {g.recipientName || '—'}</p>
          {g.recipientPhone && (
            <p><span className="font-semibold">Teléfono:</span> <a href={`tel:${g.recipientPhone}`} className="underline">{g.recipientPhone}</a></p>
          )}
          {order.address && <p><span className="font-semibold">Entregar en:</span> {order.address}</p>}
          <p><span className="font-semibold">De parte de:</span> {order.customerName}{order.phone ? ` (${order.phone})` : ''}</p>
        </div>
        {g.hidePrices && (
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-pink-700 bg-white border border-pink-200 rounded-lg px-2.5 py-1.5">
            <FaExclamationTriangle className="text-[10px] text-pink-500" /> No incluir factura ni precios en la entrega
          </div>
        )}
        <div className="bg-white border border-pink-200 rounded-lg p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-pink-400 font-bold mb-1">Mensaje para enviar al destinatario</p>
          <p className="text-[12px] text-slate-600 whitespace-pre-line mb-2">{recipientMsg}</p>
          <div className="grid grid-cols-2 gap-1.5">
            <a href={waUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-lg text-xs font-bold transition-colors active:scale-[0.97]">
              <FaCommentDots className="text-[11px]" /> Enviar por WhatsApp
            </a>
            <button onClick={copyMsg} className="flex items-center justify-center gap-1.5 bg-pink-100 hover:bg-pink-200 text-pink-700 py-2.5 rounded-lg text-xs font-bold transition-colors active:scale-[0.97]">
              {copied ? <><FaCheck className="text-[11px]" /> Copiado</> : 'Copiar mensaje'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function ModernOrdersDashboard() {
  const {
    orders, loading, error,
    selectedOrder, setSelectedOrder,
    orderDetails, setOrderDetails,
    pendingNotifications,
    generatingReport, setGeneratingReport,
    reportData, setReportData,
    showReportModal, setShowReportModal,
    notificationAudioRef,
    businessConfig, businessId, isService, navigate,
    handlePrintOrder, calculateTimeElapsed, getOrderTypeInfo, getStatusInfo,
    fetchOrders, updateOrderStatus, sendToKitchen,
    confirmPayment, rejectPayment,
    getProofUrl, goToKitchenScreen, showOrderDetails,
  } = useOrdersDashboard();

  const [assignDomiOrder, setAssignDomiOrder] = useState(null);
  const [addItemsOrder, setAddItemsOrder] = useState(null);
  const [showQuickOrder, setShowQuickOrder] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCompletedOrders, setShowCompletedOrders] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [showProofModal, setShowProofModal] = useState(false);
  const [proofImageUrl, setProofImageUrl] = useState('');

  // Stable callbacks for memoized modals — prevents re-renders from socket updates
  const closeAddItems = useCallback(() => setAddItemsOrder(null), []);
  const onItemsAdded = useCallback((updatedOrder) => setOrderDetails(updatedOrder), [setOrderDetails]);

  /* Cambiar cantidad o quitar una línea con el pedido ya tomado, para cuando
     el cliente cambia de opinión. Antes solo se podía agregar: quitar algo
     obligaba a cancelar el pedido entero y volver a montarlo. */
  const [itemBusy, setItemBusy] = useState(null);
  const changeItemQty = useCallback(async (order, item, nuevaCantidad) => {
    if (!order?._id || !item?._id || itemBusy) return;
    if (nuevaCantidad === 0 && !window.confirm(`¿Quitar "${item.name}" del pedido?`)) return;
    setItemBusy(item._id);
    try {
      const res = await api.patch(`/orders/${order._id}/items`, {
        businessId: order.businessId,
        itemId: item._id,
        quantity: nuevaCantidad,
      });
      setOrderDetails(res.data);
    } catch (err) {
      alert(err.response?.data?.message || 'No se pudo modificar el pedido');
    } finally {
      setItemBusy(null);
    }
  }, [itemBusy, setOrderDetails]);

  // Un pedido ya cerrado no se toca; para esos el detalle es solo de lectura.
  const puedeEditarItems = (o) => !!o && !['completed', 'cancelled', 'delivered'].includes(o.status);

  /* Los cambios se acumulan y se imprimen de una sola vez: una comanda por
     cada clic sería imposible de seguir en la cocina. */
  const [printingChanges, setPrintingChanges] = useState(false);
  const printPendingChanges = useCallback(async (order) => {
    if (!order?._id || printingChanges) return;
    setPrintingChanges(true);
    try {
      const res = await api.post(`/orders/${order._id}/print-changes`, { businessId: order.businessId });
      setOrderDetails(res.data.order);
    } catch (err) {
      alert(err.response?.data?.message || 'No se pudo enviar la comanda');
    } finally {
      setPrintingChanges(false);
    }
  }, [printingChanges, setOrderDetails]);
  const closeQuickOrder = useCallback(() => setShowQuickOrder(false), []);
  const onQuickOrderCreated = useCallback(() => {}, []);

  const VISIBLE_STATUSES = ['pending', 'pending_payment', 'payment_uploaded', 'payment_confirmed', 'confirmed', 'preparing', 'inProgress', 'ready', 'completed'];

  // Filter orders based on search and status
  const filteredOrders = orders.filter(order => {
    if (!order) return false;
    if (!VISIBLE_STATUSES.includes(order.status)) return false;
    const name = (order.customerName || '').toLowerCase();
    const number = (order.orderNumber || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    const matchesSearch = name.includes(search) || number.includes(search);
    
    let matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    // Group related statuses under the same filter tab
    if (statusFilter === ORDER_STATUS.PENDING) {
      matchesStatus = order.status === ORDER_STATUS.PENDING || order.status === ORDER_STATUS.PENDING_PAYMENT;
    } else if (statusFilter === ORDER_STATUS.PAYMENT_UPLOADED) {
      matchesStatus = order.status === ORDER_STATUS.PAYMENT_UPLOADED || order.status === ORDER_STATUS.PAYMENT_CONFIRMED;
    } else if (statusFilter === ORDER_STATUS.IN_PROGRESS) {
      matchesStatus = order.status === ORDER_STATUS.IN_PROGRESS || order.status === ORDER_STATUS.PREPARING || order.status === ORDER_STATUS.CONFIRMED;
    } else if (statusFilter === ORDER_STATUS.COMPLETED) {
      matchesStatus = order.status === ORDER_STATUS.COMPLETED || order.status === ORDER_STATUS.READY;
    }
    
    return matchesSearch && matchesStatus;
  });

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const cardVariants = {
    hidden: { 
      opacity: 0, 
      y: 20,
      scale: 0.95
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.4,
        ease: [0.4, 0.0, 0.2, 1]
      }
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: {
        duration: 0.2
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"
          />
          <p className="text-slate-500 text-sm font-medium">{isService ? 'Cargando citas...' : 'Cargando pedidos...'}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="bg-white p-6 rounded-xl border border-red-100 text-center max-w-sm">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <FaTimes className="text-red-400 text-lg" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800 mb-1">{isService ? 'Error al cargar citas' : 'Error al cargar pedidos'}</h3>
          <p className="text-slate-500 text-xs mb-4">{error}</p>
          <button
            onClick={fetchOrders}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  const statusFilters = [
    { value: 'all', label: 'Todos', icon: FaClipboardList },
    { value: ORDER_STATUS.PENDING, label: 'Pendientes', icon: FaClock },
    { value: ORDER_STATUS.PAYMENT_UPLOADED, label: 'Por cobrar', icon: FaImage },
    { value: ORDER_STATUS.IN_PROGRESS, label: 'En curso', icon: FaUtensils },
    { value: ORDER_STATUS.COMPLETED, label: 'Listos', icon: FaCheck },
  ];

  const orderCounts = {
    all: filteredOrders.length,
    [ORDER_STATUS.PENDING]: orders.filter(o => o?.status === ORDER_STATUS.PENDING || o?.status === ORDER_STATUS.PENDING_PAYMENT).length,
    [ORDER_STATUS.PAYMENT_UPLOADED]: orders.filter(o => o?.status === ORDER_STATUS.PAYMENT_UPLOADED || o?.status === ORDER_STATUS.PAYMENT_CONFIRMED).length,
    [ORDER_STATUS.IN_PROGRESS]: orders.filter(o => o?.status === ORDER_STATUS.IN_PROGRESS || o?.status === ORDER_STATUS.PREPARING).length,
    [ORDER_STATUS.COMPLETED]: orders.filter(o => o?.status === ORDER_STATUS.COMPLETED || o?.status === ORDER_STATUS.READY).length,
  };

  return (
    <div className="space-y-4">
      {/* Audio element for notifications */}
      <audio 
        ref={notificationAudioRef} 
        preload="auto"
        onError={(e) => {
          console.error('Audio loading error:', e);
        }}
        onCanPlay={() => {
          console.log('Audio ready to play');
        }}
      >
        <source src="/audio/new-order-notification.mp3" type="audio/mpeg" />
      </audio>

      {/* Top Bar — Actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Pending badge */}
          {pendingNotifications.length > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1.5 bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-full"
            >
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-red-500"
              />
              <span className="text-xs font-bold">{pendingNotifications.length} pendiente{pendingNotifications.length > 1 ? 's' : ''}</span>
            </motion.div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Kitchen — hide for service businesses */}
          {!isService && (
            <button
              onClick={goToKitchenScreen}
              className="hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100 transition-colors"
            >
              <FaUtensils className="text-[10px]" />
              <span className="hidden sm:inline">Cocina</span>
            </button>
          )}

          {/* Customer Display — hide for service businesses */}
          {!isService && (
            <button
              onClick={() => {
                const currentPath = window.location.pathname;
                const match = currentPath.match(/^\/([^/]+)/);
                const businessSlug = match ? match[1] : '';
                window.open(`/${businessSlug}/orders`, '_blank', 'noopener,noreferrer');
              }}
              className="hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors"
            >
              <FaTv className="text-[10px]" />
              <span className="hidden sm:inline">Pantalla</span>
            </button>
          )}

          {/* Quick Order */}
          <button
            onClick={() => setShowQuickOrder(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 transition-colors"
          >
            <FaPlus className="text-[10px]" />
            <span className="hidden sm:inline">Pedido</span>
          </button>

          {/* Refresh */}
          <motion.button
            whileTap={{ rotate: 180 }}
            onClick={fetchOrders}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Actualizar pedidos"
          >
            <FaSync className="text-sm" />
          </motion.button>

          {/* Socket status */}
          <button
            onClick={() => {
              socketDiagnostic();
              if (socket && !socket.connected) {
                forceReconnect();
              }
            }}
            className={`p-2 rounded-lg transition-colors ${
              socket && socket.connected
                ? 'text-emerald-500 hover:bg-emerald-50'
                : 'text-red-400 hover:bg-red-50'
            }`}
            title={socket && socket.connected ? 'Conectado en tiempo real' : 'Desconectado — Click para reconectar'}
          >
            <FaWifi className="text-sm" />
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        {/* Search — iOS pill style on mobile */}
        <div className="relative">
          <FaSearch className="absolute left-3 lg:left-3 top-1/2 -translate-y-1/2 text-slate-300 text-sm" />
          <input
            type="text"
            placeholder={isService ? "Buscar por cliente o # de cita..." : "Buscar por cliente o # de pedido..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label={isService ? "Buscar por cliente o número de cita" : "Buscar por cliente o número de pedido"}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-100/80 lg:bg-white border-0 lg:border lg:border-slate-200 rounded-xl lg:rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 lg:focus:ring-blue-500/20 focus:bg-white transition-all"
          />
        </div>

        {/* Status filter — iOS segmented control on mobile, pills on desktop */}
        <div className="flex items-center justify-between gap-3">
          {/* Mobile: segmented control */}
          <div className="flex lg:hidden items-center bg-slate-100/80 rounded-xl p-[3px] w-full overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {statusFilters.map(f => {
              const isActive = statusFilter === f.value;
              const count = orderCounts[f.value] || 0;
              return (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`relative flex-1 min-w-0 flex items-center justify-center gap-1 px-2 py-[7px] rounded-[10px] text-[11px] font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                      : 'text-slate-500'
                  }`}
                >
                  <span>{f.label}</span>
                  {count > 0 && (
                    <span className={`min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center leading-none ${
                      isActive ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Desktop: pills */}
          <div className="hidden lg:flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {statusFilters.map(f => {
              const isActive = statusFilter === f.value;
              const FilterIcon = f.icon;
              const count = orderCounts[f.value] || 0;
              return (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                  }`}
                >
                  <FilterIcon className="text-[10px]" />
                  <span>{f.label}</span>
                  {count > 0 && (
                    <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* View toggle — desktop only */}
          <div className="hidden lg:flex bg-slate-100 rounded-lg p-0.5 shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 rounded-md transition-all ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <FaTh className="text-xs" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2.5 rounded-md transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <FaList className="text-xs" />
            </button>
          </div>
        </div>
      </div>

      {/* Orders grid/list */}
      <div>
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl lg:rounded-xl border border-slate-100 lg:border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-none py-16 text-center">
            <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <FaShoppingBag className="text-slate-300 text-xl" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700 mb-1">{isService ? 'No hay citas' : 'No hay pedidos'}</h3>
            <p className="text-xs text-slate-400">
              {searchTerm || statusFilter !== 'all' 
                ? (isService ? 'No se encontraron citas con los filtros aplicados' : 'No se encontraron pedidos con los filtros aplicados')
                : (isService ? 'Las nuevas citas aparecerán aquí en tiempo real' : 'Los nuevos pedidos aparecerán aquí en tiempo real')
              }
            </p>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5 lg:gap-3'
                : 'space-y-2'
            }
          >
            <AnimatePresence>
              {filteredOrders.map((order) => {
                const orderTypeInfo = getOrderTypeInfo(order.orderType);
                const statusInfo = getStatusInfo(order.status);
                const timeElapsed = calculateTimeElapsed(order.createdAt);
                const isPending = order.status === ORDER_STATUS.PENDING;
                return (
                  <OrderCard
                    key={order._id}
                    order={order}
                    viewMode={viewMode}
                    cardVariants={cardVariants}
                    isService={isService}
                    businessType={businessConfig?.businessType}
                    orderTypeInfo={orderTypeInfo}
                    statusInfo={statusInfo}
                    timeElapsed={timeElapsed}
                    isPending={isPending}
                    onShowDetails={showOrderDetails}
                    onPrint={handlePrintOrder}
                    onShowProof={(proofPath) => { setProofImageUrl(getProofUrl(proofPath)); setShowProofModal(true); }}
                    onUpdateStatus={updateOrderStatus}
                    onConfirmPayment={confirmPayment}
                    onRejectPayment={rejectPayment}
                    onAssignDelivery={setAssignDomiOrder}
                    onOpenChat={(order) => { showOrderDetails(order); setTimeout(() => setShowChatModal(true), 100); }}
                  />
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Order Details Modal — bottom sheet on mobile, centered modal on desktop */}
      <AnimatePresence>
        {selectedOrder && orderDetails && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex lg:items-center items-end justify-center lg:p-4 z-50"
            onClick={() => {
              setSelectedOrder(null);
              setOrderDetails(null);
              setShowChatModal(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-2xl lg:rounded-xl border-0 lg:border lg:border-slate-200 w-full lg:max-w-2xl max-h-[92vh] lg:max-h-[90vh] overflow-y-auto"
            >
              {/* Drag handle — mobile only */}
              <div className="lg:hidden flex justify-center pt-2 pb-1">
                <div className="w-9 h-1 rounded-full bg-slate-300" />
              </div>
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 rounded-t-xl z-10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {(() => { const ModalTypeIcon = getOrderTypeInfo(orderDetails.orderType).Icon; return (
                      <div className={`w-8 h-8 ${getOrderTypeInfo(orderDetails.orderType).color} rounded-lg flex items-center justify-center`}>
                        <ModalTypeIcon className="text-white text-xs" />
                      </div>
                    ); })()}
                    <div>
                      <h2 className="text-base font-bold text-slate-800">Pedido #{orderDetails.orderNumber}</h2>
                      <p className="text-[11px] text-slate-400">{getOrderTypeInfo(orderDetails.orderType).label} · {orderDetails._id?.slice(-6)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {orderDetails.orderChannel === 'inapp' && !['completed', 'delivered', 'cancelled'].includes(orderDetails.status) && (
                      <button
                        onClick={() => setShowChatModal(prev => !prev)}
                        className="relative flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 px-2.5 py-2 rounded-lg text-[11px] font-semibold border border-blue-200/60 transition-colors"
                      >
                        <FaCommentDots className="text-[10px]" /> Chat
                        {(orderDetails.messages || []).filter(m => m.sender === 'customer').length > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                            {(orderDetails.messages || []).filter(m => m.sender === 'customer').length}
                          </span>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => { setSelectedOrder(null); setOrderDetails(null); setShowChatModal(false); }}
                      className="w-9 h-9 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center transition-colors"
                    >
                      <FaTimes className="text-slate-400 text-xs" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-4 space-y-3">
                {/* ── Info Strip ── */}
                <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                  {/* Row 1: Customer + Phone */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <FaUser className="text-[10px] text-slate-400 shrink-0" />
                      <span className="text-[13px] font-semibold text-slate-800 truncate">{orderDetails.customerName}</span>
                    </div>
                    {orderDetails.phone && (
                      <a href={`tel:${orderDetails.phone}`} className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-blue-500 shrink-0 tabular-nums">
                        <FaPhone className="text-[9px]" /> {orderDetails.phone}
                      </a>
                    )}
                  </div>

                  {/* Row 2: Context tags */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-500">
                    {orderDetails.tableNumber && (
                      <span className="flex items-center gap-1">
                        <FaChair className="text-[9px] text-slate-300" /> {businessConfig?.businessType === 'hotel' ? 'Hab.' : 'Mesa'} {orderDetails.tableNumber}
                      </span>
                    )}
                    {orderDetails.orderType === 'delivery' && orderDetails.address && (
                      <span className="flex items-center gap-1">
                        <FaHome className="text-[9px] text-slate-300" /> {orderDetails.address}
                      </span>
                    )}
                  {orderDetails.orderType === 'delivery' && orderDetails.deliveryCoordinates?.lat && (
                      <a
                        href={`https://maps.google.com/?q=${orderDetails.deliveryCoordinates.lat},${orderDetails.deliveryCoordinates.lon}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-500 hover:text-blue-600 font-semibold"
                      >
                        <FaMapMarkerAlt className="text-[9px]" /> Ver en Maps
                      </a>
                    )}
                    {orderDetails.orderType === 'delivery' && orderDetails.deliveryZoneName && (
                      <span className="flex items-center gap-1">
                        <FaMapMarkerAlt className="text-[9px] text-slate-300" /> {orderDetails.deliveryZoneName}
                      </span>
                    )}
                    {orderDetails.orderType === 'delivery' && orderDetails.deliveryFee > 0 && (
                      <span className="flex items-center gap-1 font-semibold text-slate-600">
                        <FaTruck className="text-[9px] text-slate-300" /> Envío ${orderDetails.deliveryFee.toLocaleString()}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <FaClock className="text-[9px] text-slate-300" /> {calculateTimeElapsed(orderDetails.createdAt)}
                    </span>
                    {orderDetails.paymentMethod && (
                      <span className="flex items-center gap-1">
                        <FaCreditCard className="text-[9px] text-slate-300" /> {PAYMENT_LABELS[orderDetails.paymentMethod] || orderDetails.paymentMethod}
                      </span>
                    )}
                    {(() => { const si = getStatusInfo(orderDetails.status); return (
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${si.bgColor} ${si.textColor}`}>
                        <si.Icon className="text-[7px]" /> {si.label}
                      </span>
                    ); })()}
                  </div>

                  {orderDetails.orderType === 'delivery' && orderDetails.deliveryNeedsConfirmation && (
                    <div className="flex items-center gap-1.5 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                      <FaExclamationTriangle className="text-[10px] text-amber-500 shrink-0" />
                      <span className="text-[11px] font-semibold text-amber-700">Envío por confirmar — fuera de zonas automáticas</span>
                    </div>
                  )}

                  {orderDetails.customerNotes && (
                    <div className="flex items-start gap-1.5 bg-amber-50/60 px-2.5 py-1.5 rounded-lg">
                      <FaTag className="text-[9px] text-amber-400 mt-0.5 shrink-0" />
                      <p className="text-[12px] text-amber-700">{orderDetails.customerNotes}</p>
                    </div>
                  )}

                  {orderDetails.orderChannel === 'inapp' && (
                    <div className="flex items-center gap-1.5 text-[11px] text-indigo-600 font-medium">
                      <FaMoneyBillWave className="text-[9px]" /> Pedido in-app
                    </div>
                  )}
                </div>

                {/* ── Delivery location map ── */}
                {orderDetails.orderType === 'delivery' && orderDetails.deliveryCoordinates?.lat && (
                  <DeliveryLocationMap
                    lat={orderDetails.deliveryCoordinates.lat}
                    lon={orderDetails.deliveryCoordinates.lon}
                    address={orderDetails.address}
                  />
                )}

                {/* ── Gift panel ── */}
                {orderDetails.isGift && (
                  <GiftPanel order={orderDetails} businessName={businessConfig?.businessName} />
                )}

                {/* ── Action Buttons — TOP ── */}
                <div className="space-y-1.5">
                  {/* Primary actions */}
                  {orderDetails.status === ORDER_STATUS.PAYMENT_UPLOADED && (
                    <div className="flex gap-2">
                      <button onClick={() => confirmPayment(orderDetails._id)} className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl text-sm font-bold transition-colors active:scale-[0.98]">
                        <FaCheckCircle className="text-xs" /> Confirmar pago
                      </button>
                      <button onClick={() => rejectPayment(orderDetails._id)} className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-5 py-3 rounded-xl text-sm font-bold transition-colors active:scale-[0.98]">
                        <FaTimesCircle className="text-xs" /> Rechazar
                      </button>
                    </div>
                  )}

                  {orderDetails.status === ORDER_STATUS.PAYMENT_CONFIRMED && (
                    <button onClick={() => updateOrderStatus(orderDetails._id, ORDER_STATUS.IN_PROGRESS)} className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl text-sm font-bold transition-colors active:scale-[0.98]">
                      <FaPlay className="text-xs" /> Iniciar preparación
                    </button>
                  )}

                  {orderDetails.status === ORDER_STATUS.PENDING_PAYMENT && (
                    <button onClick={() => updateOrderStatus(orderDetails._id, ORDER_STATUS.PAYMENT_CONFIRMED)} className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl text-sm font-bold transition-colors active:scale-[0.98]">
                      <FaCheckCircle className="text-xs" /> Confirmar pago
                    </button>
                  )}

                  {orderDetails.status === ORDER_STATUS.PENDING && (
                    <button onClick={() => updateOrderStatus(orderDetails._id, ORDER_STATUS.IN_PROGRESS)} className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl text-sm font-bold transition-colors active:scale-[0.98]">
                      <FaPlay className="text-xs" /> Iniciar preparación
                    </button>
                  )}

                  {orderDetails.status === ORDER_STATUS.IN_PROGRESS && (
                    <div className="space-y-1.5">
                      {orderDetails.orderType === 'delivery' && !orderDetails.deliveryToken && !orderDetails.deliveryPersonId && !orderDetails.confirmationCode && (
                        <button onClick={() => setAssignDomiOrder(orderDetails)} className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl text-sm font-bold transition-colors active:scale-[0.98]">
                          <FaMotorcycle className="text-sm" /> Asignar domiciliario
                        </button>
                      )}
                      <button onClick={() => updateOrderStatus(orderDetails._id, ORDER_STATUS.COMPLETED)} className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl text-sm font-bold transition-colors active:scale-[0.98]">
                        <FaCheck className="text-xs" /> {orderDetails.orderType === 'delivery' ? 'Completar pedido' : 'Marcar como completado'}
                      </button>
                    </div>
                  )}

                  {/* Secondary actions row */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {!orderDetails.sentToKitchen && (
                      <button onClick={() => sendToKitchen(orderDetails._id)} className="flex items-center justify-center gap-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 py-2.5 rounded-xl text-xs font-semibold border border-orange-200/60 transition-colors active:scale-[0.97]">
                        <FaUtensils className="text-[10px]" /> Enviar a cocina
                      </button>
                    )}
                    {orderDetails.status !== ORDER_STATUS.COMPLETED && orderDetails.status !== ORDER_STATUS.CANCELLED && orderDetails.status !== ORDER_STATUS.DELIVERED && (
                      <button onClick={() => setAddItemsOrder(orderDetails)} className="flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 py-2.5 rounded-xl text-xs font-semibold border border-blue-200/60 transition-colors active:scale-[0.97]">
                        <FaPlus className="text-[10px]" /> Agregar productos
                      </button>
                    )}
                    {orderDetails.status !== ORDER_STATUS.COMPLETED && orderDetails.status !== ORDER_STATUS.CANCELLED && orderDetails.status !== ORDER_STATUS.DELIVERED && (
                      <button onClick={() => { if (window.confirm('¿Cancelar pedido #' + orderDetails.orderNumber + '?')) { updateOrderStatus(orderDetails._id, ORDER_STATUS.CANCELLED); setOrderDetails(null); } }} className="flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-500 py-2.5 rounded-xl text-xs font-semibold border border-red-200/60 transition-colors active:scale-[0.97]">
                        <FaTimes className="text-[9px]" /> Cancelar pedido
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Chat removed from body — now floating ── */}

                {/* Cambios que cocina todavía no tiene en papel. Se acumulan
                    para no sacar una comanda por cada ajuste. */}
                {orderDetails.pendingKitchenChanges?.length > 0 && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 overflow-hidden">
                    <div className="px-3 py-2 border-b border-amber-200 flex items-center gap-2">
                      <FaExclamationTriangle className="text-amber-500 text-[11px] shrink-0" />
                      <span className="text-[12px] font-bold text-amber-900">
                        Cocina aún no sabe {orderDetails.pendingKitchenChanges.length === 1 ? 'de 1 cambio' : `de ${orderDetails.pendingKitchenChanges.length} cambios`}
                      </span>
                    </div>
                    <div className="px-3 py-2 space-y-1">
                      {orderDetails.pendingKitchenChanges.map((c, i) => (
                        <p key={i} className="text-[11px] font-mono text-amber-900 leading-snug"><span className="font-bold">{c.qty || 1}x</span> {c.text}</p>
                      ))}
                    </div>
                    <button
                      onClick={() => printPendingChanges(orderDetails)}
                      disabled={printingChanges}
                      className="w-full flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white py-2.5 text-xs font-bold transition-colors active:scale-[0.98]"
                    >
                      <FaPrint className="text-[10px]" />
                      {printingChanges ? 'Enviando...' : 'Imprimir comanda de cambios'}
                    </button>
                  </div>
                )}

                {/* ── Products ── */}
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Productos</h3>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {orderDetails.items?.map((item, index) => (
                      <div key={item._id || index} className="flex justify-between items-start px-3 py-2 bg-white">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-slate-800">{item.name}</span>
                            <span className="text-[11px] text-slate-400">x{item.quantity}</span>
                            {item.isLoyaltyReward && (
                              <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold inline-flex items-center gap-0.5">{AI.gift('w-3 h-3')} Loyalty</span>
                            )}
                          </div>
                          {item.selectedToppings && item.selectedToppings.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {item.selectedToppings.flatMap((topping, toppingIndex) => {
                                const tags = [];
                                if (topping.optionName) {
                                  tags.push(
                                    <span key={`t-${toppingIndex}`} className="text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">
                                      + {topping.groupName && <>{topping.groupName}: </>}{topping.optionName}{topping.price > 0 && ` ($${topping.price.toLocaleString()})`}
                                    </span>
                                  );
                                }
                                if (topping.subGroups) {
                                  topping.subGroups.forEach((sg, si) => {
                                    tags.push(
                                      <span key={`s-${toppingIndex}-${si}`} className="text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                                        + {sg.subGroupTitle && <>{sg.subGroupTitle}: </>}{sg.optionName}{sg.price > 0 && ` ($${sg.price.toLocaleString()})`}
                                      </span>
                                    );
                                  });
                                }
                                return tags;
                              })}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="text-[13px] font-semibold text-slate-800">${(item.price * item.quantity).toLocaleString()}</p>
                          {item.quantity > 1 && <p className="text-[10px] text-slate-400">${item.price.toLocaleString()} c/u</p>}

                          {puedeEditarItems(orderDetails) && item._id && (
                            <div className="flex items-center justify-end gap-1 mt-1.5">
                              <button
                                onClick={() => changeItemQty(orderDetails, item, item.quantity - 1)}
                                disabled={itemBusy === item._id || item.quantity <= 1}
                                className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                                title="Quitar una unidad"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M5 12h14" /></svg>
                              </button>
                              <span className="w-6 text-center text-[12px] font-bold text-slate-700 tabular-nums">
                                {itemBusy === item._id ? '·' : item.quantity}
                              </span>
                              <button
                                onClick={() => changeItemQty(orderDetails, item, item.quantity + 1)}
                                disabled={itemBusy === item._id}
                                className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-colors flex items-center justify-center"
                                title="Agregar una unidad"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                              </button>
                              <button
                                onClick={() => changeItemQty(orderDetails, item, 0)}
                                disabled={itemBusy === item._id}
                                className="w-7 h-7 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-30 transition-colors flex items-center justify-center ml-0.5"
                                title="Quitar del pedido"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Total ── */}
                <div className="bg-slate-800 rounded-xl px-4 py-3 space-y-1">
                  {(orderDetails.deliveryFee > 0 || orderDetails.couponCode || orderDetails.deliveryNeedsConfirmation) && (
                    <div className="flex justify-between items-center text-slate-400 text-[12px]">
                      <span>Subtotal</span>
                      <span>${(orderDetails.totalAmount || 0).toLocaleString()}</span>
                    </div>
                  )}
                  {orderDetails.deliveryFee > 0 && (
                    <div className="flex justify-between items-center text-slate-400 text-[12px]">
                      <span>Envío</span>
                      <span>${orderDetails.deliveryFee.toLocaleString()}</span>
                    </div>
                  )}
                  {orderDetails.deliveryNeedsConfirmation && !orderDetails.deliveryFee && (
                    <div className="flex justify-between items-center text-amber-400 text-[12px]">
                      <span>Envío</span>
                      <span>Por confirmar</span>
                    </div>
                  )}
                  {orderDetails.couponCode && (
                    <div className="flex justify-between items-center text-emerald-400 text-[12px]">
                      <span>Cupón ({orderDetails.couponCode})</span>
                      <span>-${(orderDetails.discountAmount || 0).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-sm font-bold text-white">Total</span>
                    <span className="text-lg font-bold text-white">
                      {orderDetails.couponCode
                        ? `$${((orderDetails.totalAmount || 0) + (orderDetails.deliveryFee || 0) - (orderDetails.discountAmount || 0)).toLocaleString()}`
                        : orderDetails.deliveryNeedsConfirmation && !orderDetails.deliveryFee
                          ? `$${(orderDetails.totalAmount || 0).toLocaleString()} + envío`
                          : `$${((orderDetails.totalAmount || 0) + (orderDetails.deliveryFee || 0)).toLocaleString()}`
                      }
                    </span>
                  </div>
                </div>

                {/* ── Payment Proof ── */}
                {orderDetails.paymentProof && (
                  <div
                    className="flex items-center gap-3 bg-purple-50 rounded-xl px-3 py-2.5 border border-purple-200/60 cursor-pointer hover:bg-purple-100 transition-colors"
                    onClick={() => { setProofImageUrl(getProofUrl(orderDetails.paymentProof)); setShowProofModal(true); }}
                  >
                    <img src={getProofUrl(orderDetails.paymentProof)} alt="Comprobante" className="w-12 h-12 rounded-lg object-cover border border-purple-200" />
                    <div>
                      <p className="text-[12px] font-semibold text-purple-800">Comprobante de pago</p>
                      <p className="text-[11px] text-purple-600">Toca para ver completo</p>
                    </div>
                    <FaImage className="text-purple-400 text-sm ml-auto" />
                  </div>
                )}

                {/* ── Print row ── */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={async () => { try { await api.post(`/print-agent/print-comanda/${orderDetails._id}`); } catch { handlePrintOrder(orderDetails); } }}
                    className="flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 py-2.5 rounded-xl text-xs font-semibold border border-slate-200/60 transition-colors active:scale-[0.97]"
                  >
                    <FaPrint className="text-[10px]" /> Imprimir comanda
                  </button>
                  {orderDetails.status !== 'pending' && orderDetails.status !== 'pending_payment' && (
                    <button
                      onClick={async () => { try { await api.post(`/print-agent/print-receipt/${orderDetails._id}`); } catch { handlePrintOrder(orderDetails); } }}
                      className="flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 py-2.5 rounded-xl text-xs font-semibold border border-emerald-200/60 transition-colors active:scale-[0.97]"
                    >
                      <FaMoneyBillWave className="text-[10px]" /> Imprimir recibo
                    </button>
                  )}
                </div>
              </div>

              {/* Floating Chat Modal */}
              <AnimatePresence>
                {showChatModal && orderDetails.orderChannel === 'inapp' && (
                  <AdminOrderChat
                    orderId={orderDetails._id}
                    messages={orderDetails.messages || []}
                    isOpen={showChatModal}
                    onClose={() => setShowChatModal(false)}
                  />
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Proof Full-screen Modal */}
      <AnimatePresence>
        {showProofModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60]"
            onClick={() => setShowProofModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-lg w-full max-h-[90vh] flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowProofModal(false)}
                className="absolute -top-3 -right-3 w-11 h-11 bg-white rounded-full flex items-center justify-center shadow-lg z-10"
              >
                <FaTimes className="text-slate-500 text-xs" />
              </button>
              <img
                src={proofImageUrl}
                alt="Comprobante de pago"
                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AssignDeliveryModal 
        isOpen={!!assignDomiOrder}
        onClose={() => setAssignDomiOrder(null)}
        order={assignDomiOrder}
        businessId={businessId}
        onAssigned={(data) => {
          // You could optionally do something here, like optimistic update
          // updateOrderStatus(assignDomiOrder._id, ORDER_STATUS.IN_PROGRESS); 
          // Since it will be reflected via Socket anyway, doing nothing is also fine.
        }}
      />

      <AddItemsModal
        isOpen={!!addItemsOrder}
        onClose={closeAddItems}
        order={addItemsOrder}
        onItemsAdded={onItemsAdded}
      />

      <QuickOrderModal
        isOpen={showQuickOrder}
        onClose={closeQuickOrder}
        onOrderCreated={onQuickOrderCreated}
      />
    </div>
  );
}

export default ModernOrdersDashboard;
