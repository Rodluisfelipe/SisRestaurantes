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
  FaChair, FaHome, FaTag, FaExclamationTriangle, FaWifi
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
        return { icon: '🪑', color: 'bg-blue-500', label: 'En mesa' };
      case 'takeaway':
        return { icon: '🥡', color: 'bg-orange-500', label: 'Para llevar' };
      case 'delivery':
        return { icon: '🚚', color: 'bg-green-500', label: 'Delivery' };
      default:
        return { icon: '🍽️', color: 'bg-gray-500', label: 'Desconocido' };
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
          icon: '⏳'
        };
      case ORDER_STATUS.IN_PROGRESS:
        return { 
          color: 'bg-blue-500', 
          textColor: 'text-blue-700',
          bgColor: 'bg-blue-50',
          label: 'En progreso',
          icon: '👨‍🍳'
        };
      case ORDER_STATUS.COMPLETED:
        return { 
          color: 'bg-green-500', 
          textColor: 'text-green-700',
          bgColor: 'bg-green-50',
          label: 'Completado',
          icon: '✅'
        };
      default:
        return { 
          color: 'bg-gray-500', 
          textColor: 'text-gray-700',
          bgColor: 'bg-gray-50',
          label: 'Desconocido',
          icon: '❓'
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
      const pendingOrders = response.data.filter(order => order.status === ORDER_STATUS.PENDING);
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
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 lg:gap-8'
                : 'space-y-4'
            }
          >
            <AnimatePresence>
              {filteredOrders.map((order) => {
                const orderTypeInfo = getOrderTypeInfo(order.orderType);
                const statusInfo = getStatusInfo(order.status);
                const timeElapsed = calculateTimeElapsed(order.createdAt);
                const isPending = order.status === ORDER_STATUS.PENDING;

                return (
                  <motion.div
                    key={order._id}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    className={`bg-white rounded-xl overflow-hidden transition-all duration-200 ${
                      isPending 
                        ? 'border-2 border-yellow-300 shadow-md ring-1 ring-yellow-100' 
                        : 'border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300'
                    } ${viewMode === 'list' ? 'p-4' : 'p-0'}`}
                  >
                    {viewMode === 'grid' ? (
                      <>
                        {/* Card Header */}
                        <div className={`px-4 py-3 ${
                          isPending 
                            ? 'bg-yellow-50 border-b border-yellow-200' 
                            : 'bg-slate-50 border-b border-slate-100'
                        }`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-9 h-9 ${orderTypeInfo.color} rounded-lg flex items-center justify-center shrink-0`}>
                                <span className="text-base">{orderTypeInfo.icon}</span>
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-bold text-slate-800 text-sm">#{order.orderNumber}</h3>
                                <p className="text-[11px] text-slate-500">{orderTypeInfo.label}</p>
                              </div>
                            </div>
                            
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isPending 
                                  ? 'bg-yellow-400 text-yellow-900' 
                                  : statusInfo.textColor + ' ' + statusInfo.bgColor
                              }`}>
                                {statusInfo.icon} {statusInfo.label}
                              </span>
                              <span className={`text-[10px] font-semibold ${
                                isPending ? 'text-yellow-600' : 'text-slate-400'
                              }`}>
                                {timeElapsed}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="p-4">
                          <div className="space-y-2 mb-4">
                            {/* Cliente */}
                            <div className="flex items-center gap-2.5 px-2.5 py-2 bg-slate-50 rounded-lg">
                              <FaUser className="text-xs text-slate-400 shrink-0" />
                              <span className="text-sm font-medium text-slate-700 truncate">{order.customerName}</span>
                            </div>
                            
                            {/* Teléfono */}
                            {order.phone && (
                              <div className="flex items-center gap-2.5 px-2.5 py-2 bg-slate-50 rounded-lg">
                                <FaPhone className="text-xs text-slate-400 shrink-0" />
                                <a href={`tel:${order.phone}`} className="text-sm font-medium text-slate-600 hover:text-blue-600 truncate">
                                  {order.phone}
                                </a>
                              </div>
                            )}
                            
                            {/* Mesa */}
                            {order.tableNumber && (
                              <div className="flex items-center gap-2.5 px-2.5 py-2 bg-slate-50 rounded-lg">
                                <FaChair className="text-xs text-slate-400 shrink-0" />
                                <span className="text-sm font-medium text-slate-700">Mesa {order.tableNumber}</span>
                              </div>
                            )}
                            
                            {/* Dirección de delivery */}
                            {order.orderType === 'delivery' && order.address && (
                              <div className="flex items-start gap-2.5 px-2.5 py-2 bg-slate-50 rounded-lg">
                                <FaHome className="text-xs text-slate-400 shrink-0 mt-0.5" />
                                <span className="text-sm font-medium text-slate-600 leading-snug">{order.address}</span>
                              </div>
                            )}
                            
                            {/* Zona de delivery */}
                            {order.orderType === 'delivery' && order.deliveryZoneName && (
                              <div className="flex items-center gap-2.5 px-2.5 py-2 bg-slate-50 rounded-lg">
                                <FaMapMarkerAlt className="text-xs text-slate-400 shrink-0" />
                                <span className="text-sm font-medium text-slate-600">Zona: {order.deliveryZoneName}</span>
                              </div>
                            )}
                            
                            {/* Costo de envío */}
                            {order.orderType === 'delivery' && order.deliveryFee && (
                              <div className="flex items-center gap-2.5 px-2.5 py-2 bg-slate-50 rounded-lg">
                                <FaTruck className="text-xs text-slate-400 shrink-0" />
                                <span className="text-sm font-medium text-slate-700">Envío: ${order.deliveryFee.toLocaleString()}</span>
                              </div>
                            )}
                            
                            {/* Warning de confirmación */}
                            {order.orderType === 'delivery' && order.deliveryNeedsConfirmation && (
                              <div className="flex items-center gap-2 bg-amber-50 px-2.5 py-2 rounded-lg border border-amber-200">
                                <FaExclamationTriangle className="text-xs text-amber-500 shrink-0" />
                                <span className="text-xs font-semibold text-amber-700">Costo de envío por confirmar</span>
                              </div>
                            )}
                            
                            {/* Total */}
                            <div className={`flex items-center justify-between pt-3 mt-3 border-t ${
                              isPending ? 'border-yellow-200' : 'border-slate-100'
                            }`}>
                              <span className="text-xs text-slate-500">{order.items?.length || 0} productos</span>
                              <div className="text-right">
                                {order.couponCode ? (
                                  <div>
                                    <span className="text-base font-bold text-emerald-600">${((order.totalAmount || 0) + (order.deliveryFee || 0) - (order.discountAmount || 0)).toLocaleString()}</span>
                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                      <span className="line-through">${((order.totalAmount || 0) + (order.deliveryFee || 0)).toLocaleString()}</span>
                                      <span className="ml-1 text-emerald-500 font-semibold">{order.couponCode}</span>
                                    </div>
                                  </div>
                                ) : order.deliveryNeedsConfirmation ? (
                                  <div>
                                    <span className="text-base font-bold text-slate-800">${order.totalAmount.toLocaleString()}</span>
                                    <div className="text-[10px] text-amber-600 font-semibold mt-0.5">+ envío</div>
                                  </div>
                                ) : (
                                  <span className="text-base font-bold text-slate-800">
                                    ${((order.totalAmount || 0) + (order.deliveryFee || 0)).toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => showOrderDetails(order)}
                              className="flex-1 flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 px-3 py-2.5 rounded-lg text-xs font-semibold border border-slate-200 transition-colors"
                            >
                              <FaEye className="text-[10px]" />
                              <span>Detalles</span>
                            </button>
                            
                            {order.status === ORDER_STATUS.PENDING && (
                              <button
                                onClick={() => updateOrderStatus(order._id, ORDER_STATUS.IN_PROGRESS)}
                                className="flex-1 flex items-center justify-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors"
                              >
                                <FaPlay className="text-[10px]" />
                                <span>Iniciar</span>
                              </button>
                            )}
                            
                            {order.status === ORDER_STATUS.IN_PROGRESS && (
                              <button
                                onClick={() => updateOrderStatus(order._id, ORDER_STATUS.COMPLETED)}
                                className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors"
                              >
                                <FaCheck className="text-[10px]" />
                                <span>Completar</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      // List view
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 ${orderTypeInfo.color} rounded-lg flex items-center justify-center shrink-0`}>
                            <span className="text-base">{orderTypeInfo.icon}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-slate-800 text-sm">#{order.orderNumber}</h3>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusInfo.textColor} ${statusInfo.bgColor}`}>
                                {statusInfo.icon} {statusInfo.label}
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
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => {
              setSelectedOrder(null);
              setOrderDetails(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 ${getOrderTypeInfo(orderDetails.orderType).color} rounded-xl flex items-center justify-center`}>
                      <span className="text-lg">{getOrderTypeInfo(orderDetails.orderType).icon}</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Pedido #{orderDetails.orderNumber} ({orderDetails._id?.slice(-6)})</h2>
                      <p className="text-sm text-slate-600">{getOrderTypeInfo(orderDetails.orderType).label}</p>
                    </div>
                  </div>
                  
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      setSelectedOrder(null);
                      setOrderDetails(null);
                    }}
                    className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center transition-colors"
                  >
                    <span className="text-lg">❌</span>
                  </motion.button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">
                {/* Order Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-base">👤</span>
                      <span className="text-sm font-medium text-slate-700">Cliente:</span>
                      <span className="text-sm text-slate-900">{orderDetails.customerName}</span>
                    </div>
                    
                    {orderDetails.phone && (
                      <div className="flex items-center space-x-2">
                        <span className="text-base">📞</span>
                        <span className="text-sm font-medium text-slate-700">Teléfono:</span>
                        <span className="text-sm text-slate-900">{orderDetails.phone}</span>
                      </div>
                    )}
                    
                    {orderDetails.tableNumber && (
                      <div className="flex items-center space-x-2">
                        <span className="text-base">📍</span>
                        <span className="text-sm font-medium text-slate-700">Mesa:</span>
                        <span className="text-sm text-slate-900">{orderDetails.tableNumber}</span>
                      </div>
                    )}
                    
                    {orderDetails.orderType === 'delivery' && orderDetails.address && (
                      <div className="flex items-start space-x-2">
                        <span className="text-base">🏠</span>
                        <span className="text-sm font-medium text-slate-700">Dirección:</span>
                        <span className="text-sm text-slate-900 leading-relaxed">{orderDetails.address}</span>
                      </div>
                    )}
                    
                    {orderDetails.orderType === 'delivery' && orderDetails.deliveryZoneName && (
                      <div className="flex items-center space-x-2">
                        <span className="text-base">📍</span>
                        <span className="text-sm font-medium text-slate-700">Zona:</span>
                        <span className="text-sm text-slate-900">{orderDetails.deliveryZoneName}</span>
                      </div>
                    )}
                    
                    {orderDetails.orderType === 'delivery' && orderDetails.deliveryFee && (
                      <div className="flex items-center space-x-2">
                        <span className="text-base">🚚</span>
                        <span className="text-sm font-medium text-slate-700">Costo de envío:</span>
                        <span className="text-sm text-slate-900">${orderDetails.deliveryFee.toLocaleString()}</span>
                      </div>
                    )}
                    
                    {orderDetails.orderType === 'delivery' && orderDetails.deliveryNeedsConfirmation && (
                      <div className="flex items-start space-x-2 bg-amber-50 p-3 rounded-lg">
                        <span className="text-base">⚠️</span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-amber-900">Costo de envío por confirmar</p>
                          <p className="text-xs text-amber-700 mt-1">Cliente fuera de zonas automáticas</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-base">⏰</span>
                      <span className="text-sm font-medium text-slate-700">Tiempo:</span>
                      <span className="text-sm text-slate-900">{calculateTimeElapsed(orderDetails.createdAt)}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <span className="text-base">{getStatusInfo(orderDetails.status).icon}</span>
                      <span className="text-sm font-medium text-slate-700">Estado:</span>
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusInfo(orderDetails.status).textColor} ${getStatusInfo(orderDetails.status).bgColor}`}>
                        {getStatusInfo(orderDetails.status).label}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Productos del pedido</h3>
                  <div className="space-y-3">
                    {orderDetails.items?.map((item, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-slate-50 rounded-xl p-4"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium text-slate-900">{item.name}</h4>
                            <p className="text-sm text-slate-600">Cantidad: {item.quantity}</p>
                            
                            {item.selectedToppings && item.selectedToppings.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs font-medium text-slate-700 mb-1">Extras:</p>
                                <div className="space-y-1">
                                  {item.selectedToppings.map((topping, toppingIndex) => (
                                    <p key={toppingIndex} className="text-xs text-slate-600">
                                      • {topping.optionName} (+${topping.price})
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className="text-right">
                            <p className="font-semibold text-slate-900">${(item.price * item.quantity).toFixed(2)}</p>
                            <p className="text-sm text-slate-600">${item.price} c/u</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Total */}
                <div className="border-t border-slate-200 pt-4">
                  {orderDetails.couponCode ? (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Subtotal productos:</span>
                        <span className="text-sm text-slate-900">${orderDetails.totalAmount}</span>
                      </div>
                      {orderDetails.deliveryFee && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600">Costo de envío:</span>
                          <span className="text-sm text-slate-900">${orderDetails.deliveryFee.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Cupón aplicado ({orderDetails.couponCode}):</span>
                        <span className="text-sm text-green-600">-${orderDetails.discountAmount || 0}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-200 pt-2">
                        <span className="text-xl font-bold text-slate-900">Total:</span>
                        <span className="text-2xl font-bold text-green-600">${((orderDetails.totalAmount || 0) + (orderDetails.deliveryFee || 0) - (orderDetails.discountAmount || 0)).toLocaleString()}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {orderDetails.deliveryFee ? (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-600">Subtotal productos:</span>
                            <span className="text-sm text-slate-900">${orderDetails.totalAmount}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-600">Costo de envío:</span>
                            <span className="text-sm text-slate-900">${orderDetails.deliveryFee.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center border-t border-slate-200 pt-2">
                            <span className="text-xl font-bold text-slate-900">Total:</span>
                            <span className="text-2xl font-bold text-slate-900">${((orderDetails.totalAmount || 0) + (orderDetails.deliveryFee || 0)).toLocaleString()}</span>
                          </div>
                        </>
                      ) : orderDetails.deliveryNeedsConfirmation ? (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-600">Subtotal productos:</span>
                            <span className="text-sm text-slate-900">${orderDetails.totalAmount}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-amber-700 font-medium">Costo de envío:</span>
                            <span className="text-sm text-amber-700 font-medium">Por confirmar</span>
                          </div>
                          <div className="flex justify-between items-center border-t border-slate-200 pt-2">
                            <span className="text-xl font-bold text-slate-900">Total estimado:</span>
                            <span className="text-2xl font-bold text-slate-900">${orderDetails.totalAmount} + envío</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-semibold text-slate-900">Total:</span>
                          <span className="text-2xl font-bold text-slate-900">${orderDetails.totalAmount}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex space-x-3">
                  {orderDetails.status === ORDER_STATUS.PENDING && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => updateOrderStatus(orderDetails._id, ORDER_STATUS.IN_PROGRESS)}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
                    >
                      <span className="text-lg">▶️</span>
                      <span>Iniciar preparación</span>
                    </motion.button>
                  )}
                  
                  {orderDetails.status === ORDER_STATUS.IN_PROGRESS && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => updateOrderStatus(orderDetails._id, ORDER_STATUS.COMPLETED)}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
                    >
                      <span className="text-lg">✅</span>
                      <span>Marcar como completado</span>
                    </motion.button>
                  )}
                  
                  {!orderDetails.sentToKitchen && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => sendToKitchen(orderDetails._id)}
                      className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
                    >
                      <span className="text-lg">👨‍🍳</span>
                      <span>Enviar a cocina</span>
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ModernOrdersDashboard;
