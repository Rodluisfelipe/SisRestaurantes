import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { socket, joinBusiness, socketDiagnostic, forceReconnect } from '../services/socket';
import { useBusinessConfig } from '../Context/BusinessContext';
import { useNavigate } from 'react-router-dom';
import { generateDailyReportPDF } from './DailyReportPDF';
import { TIME_INTERVALS, SOCKET_EVENTS, ORDER_STATUS } from '../utils/constants';
import {
  FaClipboardList, FaSync, FaCircle, FaSearch, FaTh, FaList,
  FaUtensils, FaTv, FaShoppingBag, FaEye, FaPlay, FaCheck,
  FaUser, FaPhone, FaMapMarkerAlt, FaTruck, FaClock, FaTimes,
  FaChair, FaHome, FaTag, FaExclamationTriangle, FaWifi,
  FaMoneyBillWave, FaImage, FaTimesCircle, FaCheckCircle
} from 'react-icons/fa';

function ModernOrdersDashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const { businessConfig, businessId } = useBusinessConfig();
  const [pendingNotifications, setPendingNotifications] = useState([]);
  const notificationAudioRef = useRef(null);
  const notificationIntervalRef = useRef(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCompletedOrders, setShowCompletedOrders] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  
  // Calculate time elapsed since order creation
  const calculateTimeElapsed = (createdAt) => {
    const orderTime = new Date(createdAt);
    const now = new Date();
    const diffMs = now - orderTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);
    
    if (diffHrs > 0) {
      return `${diffHrs}h ${diffMins % 60}m`;
    }
    return `${diffMins}m`;
  };

  // Get order type icon and color
  const getOrderTypeInfo = (orderType) => {
    switch (orderType) {
      case 'inSite':
        return { Icon: FaChair, color: 'bg-blue-500', label: 'En mesa' };
      case 'takeaway':
        return { Icon: FaShoppingBag, color: 'bg-orange-500', label: 'Para llevar' };
      case 'delivery':
        return { Icon: FaTruck, color: 'bg-emerald-500', label: 'Delivery' };
      default:
        return { Icon: FaUtensils, color: 'bg-slate-500', label: 'Desconocido' };
    }
  };

  // Get status info
  const getStatusInfo = (status) => {
    switch (status) {
      case ORDER_STATUS.PENDING:
        return { 
          color: 'bg-yellow-500', 
          textColor: 'text-yellow-700',
          bgColor: 'bg-yellow-50',
          label: 'Pendiente',
          Icon: FaClock
        };
      case ORDER_STATUS.PENDING_PAYMENT:
        return { 
          color: 'bg-amber-500', 
          textColor: 'text-amber-700',
          bgColor: 'bg-amber-50',
          label: 'Pago pendiente',
          Icon: FaMoneyBillWave
        };
      case ORDER_STATUS.PAYMENT_UPLOADED:
        return { 
          color: 'bg-purple-500', 
          textColor: 'text-purple-700',
          bgColor: 'bg-purple-50',
          label: 'Comprobante recibido',
          Icon: FaImage
        };
      case ORDER_STATUS.PAYMENT_CONFIRMED:
        return { 
          color: 'bg-teal-500', 
          textColor: 'text-teal-700',
          bgColor: 'bg-teal-50',
          label: 'Pago confirmado',
          Icon: FaCheckCircle
        };
      case ORDER_STATUS.IN_PROGRESS:
        return { 
          color: 'bg-blue-500', 
          textColor: 'text-blue-700',
          bgColor: 'bg-blue-50',
          label: 'En progreso',
          Icon: FaUtensils
        };
      case ORDER_STATUS.COMPLETED:
        return { 
          color: 'bg-emerald-500', 
          textColor: 'text-emerald-700',
          bgColor: 'bg-emerald-50',
          label: 'Completado',
          Icon: FaCheck
        };
      default:
        return { 
          color: 'bg-slate-500', 
          textColor: 'text-slate-700',
          bgColor: 'bg-slate-50',
          label: 'Desconocido',
          Icon: FaClipboardList
        };
    }
  };

  // Fetch orders from the API
  const fetchOrders = async () => {
    setLoading(true);
    try {
      console.log('Fetching orders for business:', businessId);
      const response = await api.get(`/orders?businessId=${businessId}`);
      setOrders(response.data);
      
      // Check for pending orders that need notification
      const pendingOrders = response.data.filter(order => 
        order.status === ORDER_STATUS.PENDING || order.status === ORDER_STATUS.PAYMENT_UPLOADED
      );
      if (pendingOrders.length > 0) {
        setPendingNotifications(pendingOrders.map(order => order._id));
      }
      
      setError(null);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('No se pudieron cargar los pedidos');
    } finally {
      setLoading(false);
    }
  };

  // Initialize audio element
  useEffect(() => {
    if (notificationAudioRef.current) {
      const audio = notificationAudioRef.current;
      
      // Preload the audio
      audio.load();
      
      // Add event listeners for debugging
      const onLoadStart = () => console.log('Audio loading started');
      const onCanPlayThrough = () => console.log('Audio can play through');
      const onError = (e) => console.error('Audio error during load:', e);
      
      audio.addEventListener('loadstart', onLoadStart);
      audio.addEventListener('canplaythrough', onCanPlayThrough);
      audio.addEventListener('error', onError);
      
      return () => {
        audio.removeEventListener('loadstart', onLoadStart);
        audio.removeEventListener('canplaythrough', onCanPlayThrough);
        audio.removeEventListener('error', onError);
      };
    }
  }, []);

  // Play notification sound for pending orders
  useEffect(() => {
    // Clear any existing interval
    if (notificationIntervalRef.current) {
      clearInterval(notificationIntervalRef.current);
      notificationIntervalRef.current = null;
    }
    
    if (pendingNotifications.length > 0) {
      // Play sound and repeat until all notifications are handled
      const playSound = () => {
        if (notificationAudioRef.current) {
          const audio = notificationAudioRef.current;
          
          // Verificar si el audio está listo
          if (audio.readyState >= 2) { // HAVE_CURRENT_DATA
            audio.currentTime = 0; // Reiniciar desde el inicio
            audio.play().catch(e => {
              console.error('Error playing notification sound:', e);
              console.error('Audio readyState:', audio.readyState);
              console.error('Audio networkState:', audio.networkState);
              console.error('Audio error:', audio.error);
              
              // Fallback: usar un beep del sistema
              try {
                // Crear un beep simple usando Web Audio API
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.5);
                
                console.log('Using fallback beep sound');
              } catch (fallbackError) {
                console.error('Fallback sound also failed:', fallbackError);
              }
            });
          } else {
            console.warn('Audio not ready yet, readyState:', audio.readyState);
            // Intentar cargar el audio
            audio.load();
            
            // Si después de intentar cargar sigue sin estar listo, usar fallback
            setTimeout(() => {
              if (audio.readyState < 2) {
                console.warn('Audio still not ready, using fallback beep');
                try {
                  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                  const oscillator = audioContext.createOscillator();
                  const gainNode = audioContext.createGain();
                  
                  oscillator.connect(gainNode);
                  gainNode.connect(audioContext.destination);
                  
                  oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                  
                  oscillator.start(audioContext.currentTime);
                  oscillator.stop(audioContext.currentTime + 0.5);
                } catch (fallbackError) {
                  console.error('Fallback sound also failed:', fallbackError);
                }
              }
            }, 1000);
          }
        } else {
          console.warn('Audio ref not available');
        }
      };
      
      // Play immediately once
      playSound();
      
      // Set interval to play sound every 5 seconds
      notificationIntervalRef.current = setInterval(playSound, TIME_INTERVALS.NOTIFICATION_SOUND);
    }
    
    // Cleanup on unmount or when pendingNotifications changes
    return () => {
      if (notificationIntervalRef.current) {
        clearInterval(notificationIntervalRef.current);
      }
    };
  }, [pendingNotifications]);

  // Handle order status updates
  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const response = await api.patch(`/orders/${orderId}/status`, {
        status: newStatus
      });

      // Update local state
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order._id === orderId ? response.data : order
        )
      );

      // Remove from pending notifications if status changed from pending
      if (newStatus !== ORDER_STATUS.PENDING) {
        setPendingNotifications(prev => prev.filter(id => id !== orderId));
      }

      // Update details if the selected order was updated
      if (selectedOrder === orderId) {
        setOrderDetails(response.data);
      }

    } catch (error) {
      console.error('Error updating order status:', error);
      alert('Error al actualizar el estado del pedido');
    }
  };

  // Send order to kitchen
  const sendToKitchen = async (orderId) => {
    try {
      await api.patch(`/orders/${orderId}/send-to-kitchen`);
      
      // Update local state
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order._id === orderId ? { ...order, sentToKitchen: true } : order
        )
      );

    } catch (error) {
      console.error('Error sending order to kitchen:', error);
      alert('Error al enviar pedido a cocina');
    }
  };

  // Confirm payment for in-app orders
  const confirmPayment = async (orderId) => {
    try {
      const response = await api.patch(`/orders/${orderId}/confirm-payment`);
      
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order._id === orderId ? response.data.order : order
        )
      );

      if (selectedOrder === orderId) {
        setOrderDetails(response.data.order);
      }
    } catch (error) {
      console.error('Error confirming payment:', error);
      alert('Error al confirmar el pago');
    }
  };

  // Reject payment for in-app orders
  const rejectPayment = async (orderId) => {
    const reason = prompt('Razón del rechazo (opcional):');
    try {
      const response = await api.patch(`/orders/${orderId}/reject-payment`, { reason: reason || '' });
      
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order._id === orderId ? response.data.order : order
        )
      );

      if (selectedOrder === orderId) {
        setOrderDetails(response.data.order);
      }
    } catch (error) {
      console.error('Error rejecting payment:', error);
      alert('Error al rechazar el pago');
    }
  };

  // State for payment proof preview modal
  const [showProofModal, setShowProofModal] = useState(false);
  const [proofImageUrl, setProofImageUrl] = useState('');

  // Navigate to kitchen screen
  const goToKitchenScreen = () => {
    // Obtener el slug actual para mantener el mismo negocio
    const currentPath = window.location.pathname;
    const match = currentPath.match(/^\/([^/]+)/);
    const businessSlug = match ? match[1] : '';
    
    // Abrir en una nueva pestaña
    window.open(`/${businessSlug}/kitchen`, '_blank');
  };

  // Show order details
  const showOrderDetails = (order) => {
    setSelectedOrder(order._id);
    setOrderDetails(order);
  };

  // Set up socket connection for real-time updates
  useEffect(() => {
    if (!businessId) return;
    
    console.log('Connecting to socket for business:', businessId);
    
    // Run diagnostic first
    socketDiagnostic();
    
    // Use the improved joinBusiness function
    joinBusiness(businessId);
    
    // Listen for order events
    if (socket) {
      socket.on(SOCKET_EVENTS.ORDER_CREATED, (newOrder) => {
        console.log('New order received:', newOrder);
        setOrders(prevOrders => [newOrder, ...prevOrders]);
        
        // Add to pending notifications if status is 'pending'
        if (newOrder.status === ORDER_STATUS.PENDING) {
          setPendingNotifications(prev => [...prev, newOrder._id]);
        }
      });
    }
    
    if (socket) {
      socket.on(SOCKET_EVENTS.ORDER_UPDATED, (updatedOrder) => {
        console.log('Order updated:', updatedOrder);
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order._id === updatedOrder._id ? updatedOrder : order
          )
        );
        
        // Remove from pending notifications if status is changed from 'pending'
        if (updatedOrder.status !== ORDER_STATUS.PENDING) {
          setPendingNotifications(prev => prev.filter(id => id !== updatedOrder._id));
        }
        
        // Update details if the selected order was updated
        if (selectedOrder === updatedOrder._id) {
          setOrderDetails(updatedOrder);
        }
      });
      
      socket.on('order_deleted', (deletedOrder) => {
        console.log('Order deleted:', deletedOrder);
        setOrders(prevOrders => 
          prevOrders.filter(order => order._id !== deletedOrder._id)
        );
        
        // Remove from pending notifications
        setPendingNotifications(prev => prev.filter(id => id !== deletedOrder._id));
        
        // Close details if the deleted order was selected
        if (selectedOrder === deletedOrder._id) {
          setSelectedOrder(null);
          setOrderDetails(null);
        }
      });
    }

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.off(SOCKET_EVENTS.ORDER_CREATED);
        socket.off(SOCKET_EVENTS.ORDER_UPDATED);
        socket.off('order_deleted');
      }
    };
  }, [businessId, selectedOrder]);

  // Load orders on mount
  useEffect(() => {
    if (businessId) {
      fetchOrders();
    }
  }, [businessId]);

  // Filter orders based on search and status
  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
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
          <p className="text-slate-500 text-sm font-medium">Cargando pedidos...</p>
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
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Error al cargar pedidos</h3>
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
    { value: ORDER_STATUS.IN_PROGRESS, label: 'En curso', icon: FaUtensils },
    { value: ORDER_STATUS.COMPLETED, label: 'Listos', icon: FaCheck },
  ];

  const orderCounts = {
    all: filteredOrders.length,
    [ORDER_STATUS.PENDING]: orders.filter(o => o.status === ORDER_STATUS.PENDING).length,
    [ORDER_STATUS.IN_PROGRESS]: orders.filter(o => o.status === ORDER_STATUS.IN_PROGRESS).length,
    [ORDER_STATUS.COMPLETED]: orders.filter(o => o.status === ORDER_STATUS.COMPLETED).length,
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
          {/* Kitchen */}
          <button
            onClick={goToKitchenScreen}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100 transition-colors"
          >
            <FaUtensils className="text-[10px]" />
            <span className="hidden sm:inline">Cocina</span>
          </button>

          {/* Customer Display */}
          <button
            onClick={() => {
              const currentPath = window.location.pathname;
              const match = currentPath.match(/^\/([^/]+)/);
              const businessSlug = match ? match[1] : '';
              window.open(`/${businessSlug}/orders`, '_blank');
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors"
          >
            <FaTv className="text-[10px]" />
            <span className="hidden sm:inline">Pantalla</span>
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
        {/* Search */}
        <div className="relative">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-sm" />
          <input
            type="text"
            placeholder="Buscar por cliente o # de pedido..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
          />
        </div>

        {/* Status filter pills + View toggle */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
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

          {/* View toggle */}
          <div className="flex bg-slate-100 rounded-lg p-0.5 shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <FaTh className="text-xs" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-all ${
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
          <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
            <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <FaShoppingBag className="text-slate-300 text-xl" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700 mb-1">No hay pedidos</h3>
            <p className="text-xs text-slate-400">
              {searchTerm || statusFilter !== 'all' 
                ? 'No se encontraron pedidos con los filtros aplicados' 
                : 'Los nuevos pedidos aparecerán aquí en tiempo real'
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
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3'
                : 'space-y-2'
            }
          >
            <AnimatePresence>
              {filteredOrders.map((order) => {
                const orderTypeInfo = getOrderTypeInfo(order.orderType);
                const statusInfo = getStatusInfo(order.status);
                const StatusIcon = statusInfo.Icon;
                const TypeIcon = orderTypeInfo.Icon;
                const timeElapsed = calculateTimeElapsed(order.createdAt);
                const isPending = order.status === ORDER_STATUS.PENDING;

                return (
                  <motion.div
                    key={order._id}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className={`bg-white rounded-xl overflow-hidden transition-all duration-150 ${
                      isPending 
                        ? 'border border-yellow-300 ring-1 ring-yellow-100' 
                        : 'border border-slate-200 hover:border-slate-300'
                    } ${viewMode === 'list' ? 'p-3' : 'p-0'}`}
                  >
                    {viewMode === 'grid' ? (
                      <>
                        {/* Card Header */}
                        <div className={`px-3 py-2.5 ${
                          isPending 
                            ? 'bg-yellow-50/80 border-b border-yellow-200' 
                            : 'bg-slate-50/80 border-b border-slate-100'
                        }`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`w-8 h-8 ${orderTypeInfo.color} rounded-lg flex items-center justify-center shrink-0`}>
                                <TypeIcon className="text-white text-sm" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-bold text-slate-800 text-sm leading-tight">#{order.orderNumber}</h3>
                                <p className="text-[11px] text-slate-500">{orderTypeInfo.label}</p>
                              </div>
                            </div>
                            
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isPending 
                                  ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' 
                                  : statusInfo.bgColor + ' ' + statusInfo.textColor
                              }`}>
                                <StatusIcon className="text-[8px]" /> {statusInfo.label}
                              </span>
                              <span className={`text-[10px] font-medium tabular-nums ${
                                isPending ? 'text-yellow-600' : 'text-slate-400'
                              }`}>
                                {timeElapsed}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="p-3">
                          <div className="space-y-1.5 mb-3">
                            {/* Cliente + Teléfono inline */}
                            <div className="flex items-center gap-2 text-[13px]">
                              <FaUser className="text-[10px] text-slate-400 shrink-0" />
                              <span className="font-medium text-slate-700 truncate">{order.customerName}</span>
                            </div>
                            
                            {order.phone && (
                              <div className="flex items-center gap-2 text-[13px]">
                                <FaPhone className="text-[10px] text-slate-400 shrink-0" />
                                <a href={`tel:${order.phone}`} className="font-medium text-slate-600 hover:text-blue-600 truncate">
                                  {order.phone}
                                </a>
                              </div>
                            )}
                            
                            {/* Mesa */}
                            {order.tableNumber && (
                              <div className="flex items-center gap-2 text-[13px]">
                                <FaChair className="text-[10px] text-slate-400 shrink-0" />
                                <span className="font-medium text-slate-700">Mesa {order.tableNumber}</span>
                              </div>
                            )}
                            
                            {/* Dirección de delivery */}
                            {order.orderType === 'delivery' && order.address && (
                              <div className="flex items-start gap-2 text-[13px]">
                                <FaHome className="text-[10px] text-slate-400 shrink-0 mt-0.5" />
                                <span className="font-medium text-slate-600 leading-snug">{order.address}</span>
                              </div>
                            )}
                            
                            {/* Zona de delivery */}
                            {order.orderType === 'delivery' && order.deliveryZoneName && (
                              <div className="flex items-center gap-2 text-[13px]">
                                <FaMapMarkerAlt className="text-[10px] text-slate-400 shrink-0" />
                                <span className="font-medium text-slate-600">Zona: {order.deliveryZoneName}</span>
                              </div>
                            )}
                            
                            {/* Costo de envío */}
                            {order.orderType === 'delivery' && order.deliveryFee && (
                              <div className="flex items-center gap-2 text-[13px]">
                                <FaTruck className="text-[10px] text-slate-400 shrink-0" />
                                <span className="font-medium text-slate-700">Envío: ${order.deliveryFee.toLocaleString()}</span>
                              </div>
                            )}
                            
                            {/* Warning de confirmación */}
                            {order.orderType === 'delivery' && order.deliveryNeedsConfirmation && (
                              <div className="flex items-center gap-1.5 bg-amber-50 px-2 py-1.5 rounded-lg border border-amber-200">
                                <FaExclamationTriangle className="text-[10px] text-amber-500 shrink-0" />
                                <span className="text-[11px] font-semibold text-amber-700">Envío por confirmar</span>
                              </div>
                            )}
                          </div>
                            
                          {/* Total */}
                          <div className={`flex items-center justify-between py-2.5 border-t ${
                            isPending ? 'border-yellow-200' : 'border-slate-100'
                          }`}>
                            <span className="text-[11px] text-slate-500">{order.items?.length || 0} productos</span>
                            <div className="text-right">
                              {order.couponCode ? (
                                <div>
                                  <span className="text-sm font-bold text-emerald-600">${((order.totalAmount || 0) + (order.deliveryFee || 0) - (order.discountAmount || 0)).toLocaleString()}</span>
                                  <div className="text-[10px] text-slate-400">
                                    <span className="line-through">${((order.totalAmount || 0) + (order.deliveryFee || 0)).toLocaleString()}</span>
                                    <span className="ml-1 text-emerald-500 font-semibold">{order.couponCode}</span>
                                  </div>
                                </div>
                              ) : order.deliveryNeedsConfirmation ? (
                                <div>
                                  <span className="text-sm font-bold text-slate-800">${order.totalAmount.toLocaleString()}</span>
                                  <div className="text-[10px] text-amber-600 font-medium">+ envío</div>
                                </div>
                              ) : (
                                <span className="text-sm font-bold text-slate-800">
                                  ${((order.totalAmount || 0) + (order.deliveryFee || 0)).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => showOrderDetails(order)}
                              className="flex-1 flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-600 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 transition-colors"
                            >
                              <FaEye className="text-[10px]" />
                              <span>Detalles</span>
                            </button>
                            
                            {/* Payment proof thumbnail for in-app orders */}
                            {order.paymentProof && (
                              <button
                                onClick={() => {
                                  setProofImageUrl(`https://157-245-125-216.nip.io${order.paymentProof}`);
                                  setShowProofModal(true);
                                }}
                                className="flex items-center justify-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-600 px-3 py-2 rounded-lg text-xs font-semibold border border-purple-200 transition-colors"
                              >
                                <FaImage className="text-[10px]" />
                                <span>Comprobante</span>
                              </button>
                            )}

                            {/* Payment confirm/reject for uploaded proofs */}
                            {order.status === ORDER_STATUS.PAYMENT_UPLOADED && (
                              <>
                                <button
                                  onClick={() => confirmPayment(order._id)}
                                  className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                                >
                                  <FaCheckCircle className="text-[9px]" />
                                  <span>Confirmar</span>
                                </button>
                                <button
                                  onClick={() => rejectPayment(order._id)}
                                  className="flex items-center justify-center gap-1.5 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                                >
                                  <FaTimesCircle className="text-[9px]" />
                                </button>
                              </>
                            )}
                            
                            {/* Start preparation after payment confirmed */}
                            {order.status === ORDER_STATUS.PAYMENT_CONFIRMED && (
                              <button
                                onClick={() => updateOrderStatus(order._id, ORDER_STATUS.IN_PROGRESS)}
                                className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                              >
                                <FaPlay className="text-[9px]" />
                                <span>Iniciar</span>
                              </button>
                            )}

                            {order.status === ORDER_STATUS.PENDING && (
                              <button
                                onClick={() => updateOrderStatus(order._id, ORDER_STATUS.IN_PROGRESS)}
                                className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                              >
                                <FaPlay className="text-[9px]" />
                                <span>Iniciar</span>
                              </button>
                            )}
                            
                            {order.status === ORDER_STATUS.IN_PROGRESS && (
                              <button
                                onClick={() => updateOrderStatus(order._id, ORDER_STATUS.COMPLETED)}
                                className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                              >
                                <FaCheck className="text-[9px]" />
                                <span>Completar</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      // List view
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 ${orderTypeInfo.color} rounded-lg flex items-center justify-center shrink-0`}>
                            <TypeIcon className="text-white text-xs" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-slate-800 text-sm">#{order.orderNumber}</h3>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusInfo.textColor} ${statusInfo.bgColor}`}>
                                <StatusIcon className="text-[8px]" /> {statusInfo.label}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 truncate">
                              {order.customerName} · {orderTypeInfo.label} · {timeElapsed}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-bold text-slate-800">${((order.totalAmount || 0) + (order.deliveryFee || 0)).toLocaleString()}</p>
                            <p className="text-[10px] text-slate-400">{order.items?.length || 0} items</p>
                          </div>
                          
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => showOrderDetails(order)}
                              className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 transition-colors"
                            >
                              <FaEye className="text-xs" />
                            </button>

                            {order.paymentProof && (
                              <button
                                onClick={() => {
                                  setProofImageUrl(`https://157-245-125-216.nip.io${order.paymentProof}`);
                                  setShowProofModal(true);
                                }}
                                className="p-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-500 transition-colors"
                              >
                                <FaImage className="text-xs" />
                              </button>
                            )}
                            
                            {order.status === ORDER_STATUS.PAYMENT_UPLOADED && (
                              <>
                                <button
                                  onClick={() => confirmPayment(order._id)}
                                  className="p-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                                  title="Confirmar pago"
                                >
                                  <FaCheckCircle className="text-xs" />
                                </button>
                                <button
                                  onClick={() => rejectPayment(order._id)}
                                  className="p-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
                                  title="Rechazar pago"
                                >
                                  <FaTimesCircle className="text-xs" />
                                </button>
                              </>
                            )}

                            {order.status === ORDER_STATUS.PAYMENT_CONFIRMED && (
                              <button
                                onClick={() => updateOrderStatus(order._id, ORDER_STATUS.IN_PROGRESS)}
                                className="p-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                              >
                                <FaPlay className="text-xs" />
                              </button>
                            )}
                            
                            {order.status === ORDER_STATUS.PENDING && (
                              <button
                                onClick={() => updateOrderStatus(order._id, ORDER_STATUS.IN_PROGRESS)}
                                className="p-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                              >
                                <FaPlay className="text-xs" />
                              </button>
                            )}
                            
                            {order.status === ORDER_STATUS.IN_PROGRESS && (
                              <button
                                onClick={() => updateOrderStatus(order._id, ORDER_STATUS.COMPLETED)}
                                className="p-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                              >
                                <FaCheck className="text-xs" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Order Details Modal */}
      <AnimatePresence>
        {selectedOrder && orderDetails && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
            onClick={() => {
              setSelectedOrder(null);
              setOrderDetails(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-3 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {(() => { const ModalTypeIcon = getOrderTypeInfo(orderDetails.orderType).Icon; return (
                      <div className={`w-9 h-9 ${getOrderTypeInfo(orderDetails.orderType).color} rounded-lg flex items-center justify-center`}>
                        <ModalTypeIcon className="text-white text-sm" />
                      </div>
                    ); })()}
                    <div>
                      <h2 className="text-base font-bold text-slate-800">Pedido #{orderDetails.orderNumber}</h2>
                      <p className="text-xs text-slate-500">{getOrderTypeInfo(orderDetails.orderType).label} · {orderDetails._id?.slice(-6)}</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      setSelectedOrder(null);
                      setOrderDetails(null);
                    }}
                    className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center transition-colors"
                  >
                    <FaTimes className="text-slate-400 text-xs" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-5">
                {/* Order Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <FaUser className="text-xs text-slate-400" />
                      <span className="text-[13px] text-slate-500">Cliente:</span>
                      <span className="text-[13px] font-medium text-slate-800">{orderDetails.customerName}</span>
                    </div>
                    
                    {orderDetails.phone && (
                      <div className="flex items-center gap-2">
                        <FaPhone className="text-xs text-slate-400" />
                        <span className="text-[13px] text-slate-500">Teléfono:</span>
                        <span className="text-[13px] font-medium text-slate-800">{orderDetails.phone}</span>
                      </div>
                    )}
                    
                    {orderDetails.tableNumber && (
                      <div className="flex items-center gap-2">
                        <FaChair className="text-xs text-slate-400" />
                        <span className="text-[13px] text-slate-500">Mesa:</span>
                        <span className="text-[13px] font-medium text-slate-800">{orderDetails.tableNumber}</span>
                      </div>
                    )}
                    
                    {orderDetails.orderType === 'delivery' && orderDetails.address && (
                      <div className="flex items-start gap-2">
                        <FaHome className="text-xs text-slate-400 mt-0.5" />
                        <span className="text-[13px] text-slate-500">Dirección:</span>
                        <span className="text-[13px] font-medium text-slate-800 leading-snug">{orderDetails.address}</span>
                      </div>
                    )}
                    
                    {orderDetails.orderType === 'delivery' && orderDetails.deliveryZoneName && (
                      <div className="flex items-center gap-2">
                        <FaMapMarkerAlt className="text-xs text-slate-400" />
                        <span className="text-[13px] text-slate-500">Zona:</span>
                        <span className="text-[13px] font-medium text-slate-800">{orderDetails.deliveryZoneName}</span>
                      </div>
                    )}
                    
                    {orderDetails.orderType === 'delivery' && orderDetails.deliveryFee && (
                      <div className="flex items-center gap-2">
                        <FaTruck className="text-xs text-slate-400" />
                        <span className="text-[13px] text-slate-500">Costo de envío:</span>
                        <span className="text-[13px] font-medium text-slate-800">${orderDetails.deliveryFee.toLocaleString()}</span>
                      </div>
                    )}
                    
                    {orderDetails.orderType === 'delivery' && orderDetails.deliveryNeedsConfirmation && (
                      <div className="flex items-center gap-2 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                        <FaExclamationTriangle className="text-xs text-amber-500 shrink-0" />
                        <div className="flex-1">
                          <p className="text-[13px] font-semibold text-amber-800">Envío por confirmar</p>
                          <p className="text-[11px] text-amber-600">Fuera de zonas automáticas</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <FaClock className="text-xs text-slate-400" />
                      <span className="text-[13px] text-slate-500">Tiempo:</span>
                      <span className="text-[13px] font-medium text-slate-800">{calculateTimeElapsed(orderDetails.createdAt)}</span>
                    </div>
                    
                    {(() => { const ModalStatusIcon = getStatusInfo(orderDetails.status).Icon; return (
                      <div className="flex items-center gap-2">
                        <ModalStatusIcon className="text-xs text-slate-400" />
                        <span className="text-[13px] text-slate-500">Estado:</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${getStatusInfo(orderDetails.status).textColor} ${getStatusInfo(orderDetails.status).bgColor}`}>
                          {getStatusInfo(orderDetails.status).label}
                        </span>
                      </div>
                    ); })()}
                  </div>
                </div>

                {/* Order Items */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 mb-2">Productos</h3>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                    {orderDetails.items?.map((item, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-start px-3 py-2.5 bg-white"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-slate-800">{item.name}</span>
                            <span className="text-[11px] text-slate-400">x{item.quantity}</span>
                          </div>
                          
                          {item.selectedToppings && item.selectedToppings.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {item.selectedToppings.map((topping, toppingIndex) => (
                                <span key={toppingIndex} className="text-[11px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">
                                  + {topping.optionName} (${topping.price})
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <div className="text-right shrink-0 ml-3">
                          <p className="text-[13px] font-semibold text-slate-800">${(item.price * item.quantity).toLocaleString()}</p>
                          {item.quantity > 1 && <p className="text-[11px] text-slate-400">${item.price.toLocaleString()} c/u</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total */}
                <div className="bg-slate-50 rounded-lg px-3 py-3 space-y-1.5">
                  {orderDetails.couponCode ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-[13px] text-slate-500">Subtotal</span>
                        <span className="text-[13px] text-slate-700">${(orderDetails.totalAmount || 0).toLocaleString()}</span>
                      </div>
                      {orderDetails.deliveryFee && (
                        <div className="flex justify-between items-center">
                          <span className="text-[13px] text-slate-500">Envío</span>
                          <span className="text-[13px] text-slate-700">${orderDetails.deliveryFee.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-[13px] text-emerald-600">Cupón ({orderDetails.couponCode})</span>
                        <span className="text-[13px] text-emerald-600">-${(orderDetails.discountAmount || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-200 pt-2 mt-1">
                        <span className="text-sm font-bold text-slate-800">Total</span>
                        <span className="text-base font-bold text-emerald-600">${((orderDetails.totalAmount || 0) + (orderDetails.deliveryFee || 0) - (orderDetails.discountAmount || 0)).toLocaleString()}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      {orderDetails.deliveryFee ? (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-[13px] text-slate-500">Subtotal</span>
                            <span className="text-[13px] text-slate-700">${(orderDetails.totalAmount || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[13px] text-slate-500">Envío</span>
                            <span className="text-[13px] text-slate-700">${orderDetails.deliveryFee.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center border-t border-slate-200 pt-2 mt-1">
                            <span className="text-sm font-bold text-slate-800">Total</span>
                            <span className="text-base font-bold text-slate-800">${((orderDetails.totalAmount || 0) + (orderDetails.deliveryFee || 0)).toLocaleString()}</span>
                          </div>
                        </>
                      ) : orderDetails.deliveryNeedsConfirmation ? (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-[13px] text-slate-500">Subtotal</span>
                            <span className="text-[13px] text-slate-700">${(orderDetails.totalAmount || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[13px] text-amber-600 font-medium">Envío</span>
                            <span className="text-[13px] text-amber-600 font-medium">Por confirmar</span>
                          </div>
                          <div className="flex justify-between items-center border-t border-slate-200 pt-2 mt-1">
                            <span className="text-sm font-bold text-slate-800">Total estimado</span>
                            <span className="text-base font-bold text-slate-800">${(orderDetails.totalAmount || 0).toLocaleString()} + envío</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold text-slate-800">Total</span>
                          <span className="text-base font-bold text-slate-800">${(orderDetails.totalAmount || 0).toLocaleString()}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Payment Proof Section */}
                {orderDetails.paymentProof && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 mb-2">Comprobante de pago</h3>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <img 
                        src={`https://157-245-125-216.nip.io${orderDetails.paymentProof}`} 
                        alt="Comprobante de pago"
                        className="w-full max-h-64 object-contain bg-slate-50 cursor-pointer"
                        onClick={() => {
                          setProofImageUrl(`https://157-245-125-216.nip.io${orderDetails.paymentProof}`);
                          setShowProofModal(true);
                        }}
                      />
                      {orderDetails.paymentMethod && (
                        <div className="px-3 py-2 bg-slate-50 border-t border-slate-200">
                          <span className="text-[11px] text-slate-500">Método: </span>
                          <span className="text-[11px] font-semibold text-slate-700 capitalize">{orderDetails.paymentMethod}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Customer Notes */}
                {orderDetails.customerNotes && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <p className="text-[11px] font-semibold text-amber-700 mb-0.5">Nota del cliente:</p>
                    <p className="text-[13px] text-amber-800">{orderDetails.customerNotes}</p>
                  </div>
                )}

                {/* Order Channel Badge */}
                {orderDetails.orderChannel === 'inapp' && (
                  <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                    <FaMoneyBillWave className="text-indigo-500 text-xs" />
                    <span className="text-[12px] font-medium text-indigo-700">Pedido in-app (pago por transferencia)</span>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 flex-wrap">
                  {/* Payment confirm/reject for uploaded proofs */}
                  {orderDetails.status === ORDER_STATUS.PAYMENT_UPLOADED && (
                    <>
                      <button
                        onClick={() => confirmPayment(orderDetails._id)}
                        className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                      >
                        <FaCheckCircle className="text-xs" />
                        <span>Confirmar pago</span>
                      </button>
                      <button
                        onClick={() => rejectPayment(orderDetails._id)}
                        className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                      >
                        <FaTimesCircle className="text-xs" />
                        <span>Rechazar</span>
                      </button>
                    </>
                  )}

                  {/* Start preparation after payment confirmed */}
                  {orderDetails.status === ORDER_STATUS.PAYMENT_CONFIRMED && (
                    <button
                      onClick={() => updateOrderStatus(orderDetails._id, ORDER_STATUS.IN_PROGRESS)}
                      className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                    >
                      <FaPlay className="text-xs" />
                      <span>Iniciar preparación</span>
                    </button>
                  )}

                  {orderDetails.status === ORDER_STATUS.PENDING && (
                    <button
                      onClick={() => updateOrderStatus(orderDetails._id, ORDER_STATUS.IN_PROGRESS)}
                      className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                    >
                      <FaPlay className="text-xs" />
                      <span>Iniciar preparación</span>
                    </button>
                  )}
                  
                  {orderDetails.status === ORDER_STATUS.IN_PROGRESS && (
                    <button
                      onClick={() => updateOrderStatus(orderDetails._id, ORDER_STATUS.COMPLETED)}
                      className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                    >
                      <FaCheck className="text-xs" />
                      <span>Marcar como completado</span>
                    </button>
                  )}
                  
                  {!orderDetails.sentToKitchen && (
                    <button
                      onClick={() => sendToKitchen(orderDetails._id)}
                      className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                    >
                      <FaUtensils className="text-xs" />
                      <span>Enviar a cocina</span>
                    </button>
                  )}
                </div>
              </div>
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
              className="relative max-w-lg w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowProofModal(false)}
                className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg z-10"
              >
                <FaTimes className="text-slate-500 text-xs" />
              </button>
              <img
                src={proofImageUrl}
                alt="Comprobante de pago"
                className="w-full rounded-xl shadow-2xl"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ModernOrdersDashboard;
