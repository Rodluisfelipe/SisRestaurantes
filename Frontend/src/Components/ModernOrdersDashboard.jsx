import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { socket, joinBusiness, socketDiagnostic, forceReconnect } from '../services/socket';
import { useBusinessConfig } from '../Context/BusinessContext';
import { useNavigate } from 'react-router-dom';
import { generateDailyReportPDF } from './DailyReportPDF';
import { TIME_INTERVALS, SOCKET_EVENTS, ORDER_STATUS } from '../utils/constants';

// Iconos con emojis - más confiables y universales
const Icons = {
  Clock: ({ className }) => <span className={`${className} flex items-center justify-center`}>⏰</span>,
  User: ({ className }) => <span className={`${className} flex items-center justify-center`}>👤</span>,
  Phone: ({ className }) => <span className={`${className} flex items-center justify-center`}>📞</span>,
  MapPin: ({ className }) => <span className={`${className} flex items-center justify-center`}>📍</span>,
  ShoppingBag: ({ className }) => <span className={`${className} flex items-center justify-center`}>🛍️</span>,
  Truck: ({ className }) => <span className={`${className} flex items-center justify-center`}>🚚</span>,
  Kitchen: ({ className }) => <span className={`${className} flex items-center justify-center`}>👨‍🍳</span>,
  Eye: ({ className }) => <span className={`${className} flex items-center justify-center`}>👁️</span>,
  Check: ({ className }) => <span className={`${className} flex items-center justify-center`}>✅</span>,
  X: ({ className }) => <span className={`${className} flex items-center justify-center`}>❌</span>,
  Play: ({ className }) => <span className={`${className} flex items-center justify-center`}>▶️</span>,
  Refresh: ({ className }) => <span className={`${className} flex items-center justify-center`}>🔄</span>
};

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
    socket.on(SOCKET_EVENTS.ORDER_CREATED, (newOrder) => {
      console.log('New order received:', newOrder);
      setOrders(prevOrders => [newOrder, ...prevOrders]);
      
      // Add to pending notifications if status is 'pending'
      if (newOrder.status === ORDER_STATUS.PENDING) {
        setPendingNotifications(prev => [...prev, newOrder._id]);
      }
    });
    
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

    // Cleanup on unmount
    return () => {
      socket.off(SOCKET_EVENTS.ORDER_CREATED);
      socket.off(SOCKET_EVENTS.ORDER_UPDATED);
      socket.off('order_deleted');
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"
          />
          <p className="text-slate-600 text-lg font-medium">Cargando pedidos...</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center"
      >
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-red-200">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">❌</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Error al cargar pedidos</h3>
            <p className="text-slate-600 mb-6">{error}</p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={fetchOrders}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Intentar de nuevo
            </motion.button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Audio element for notifications */}
      <audio 
        ref={notificationAudioRef} 
        preload="auto"
        onError={(e) => {
          console.error('Audio loading error:', e);
          console.error('Audio element:', e.target);
          console.error('Audio src:', e.target.src);
        }}
        onCanPlay={() => {
          console.log('Audio ready to play');
        }}
      >
        <source src="/audio/new-order-notification.mp3" type="audio/mpeg" />
        Tu navegador no soporta el elemento de audio.
      </audio>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3 lg:space-x-4">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="flex items-center space-x-2"
              >
                <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <span className="text-sm lg:text-lg">👨‍🍳</span>
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-lg lg:text-xl font-bold text-slate-900">Panel de Pedidos</h1>
                  <p className="text-xs lg:text-sm text-slate-500">{businessConfig?.businessName}</p>
                </div>
              </motion.div>
            </div>

            <div className="flex items-center space-x-2 lg:space-x-3">
              {/* Pending notifications badge */}
              {pendingNotifications.length > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="relative"
                >
                  <motion.div
                    animate={{ 
                      scale: [1, 1.1, 1],
                      boxShadow: [
                        "0 0 0 0 rgba(239, 68, 68, 0.7)",
                        "0 0 0 10px rgba(239, 68, 68, 0)",
                        "0 0 0 0 rgba(239, 68, 68, 0)"
                      ]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold"
                  >
                    {pendingNotifications.length} pedidos pendientes
                  </motion.div>
                </motion.div>
              )}

              {/* Kitchen button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={goToKitchenScreen}
                className="text-white px-3 lg:px-4 py-2 rounded-lg font-medium flex items-center space-x-1 lg:space-x-2 shadow-lg"
                style={{
                  backgroundColor: businessConfig?.theme?.buttonColor || '#f97316',
                  color: businessConfig?.theme?.buttonTextColor || '#ffffff'
                }}
              >
                <span className="hidden sm:inline">Cocina</span>
              </motion.button>

              {/* Customer Display button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  const currentPath = window.location.pathname;
                  const match = currentPath.match(/^\/([^/]+)/);
                  const businessSlug = match ? match[1] : '';
                  window.open(`/${businessSlug}/orders`, '_blank');
                }}
                className="text-white px-3 lg:px-4 py-2 rounded-lg font-medium flex items-center space-x-1 lg:space-x-2 shadow-lg"
                style={{
                  backgroundColor: businessConfig?.theme?.buttonColor || '#f97316',
                  color: businessConfig?.theme?.buttonTextColor || '#ffffff'
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="hidden md:inline">Pantalla</span>
                <span className="hidden lg:inline">Cliente</span>
              </motion.button>

              {/* Refresh button */}
              <motion.button
                whileHover={{ scale: 1.05, rotate: 180 }}
                whileTap={{ scale: 0.95 }}
                onClick={fetchOrders}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg transition-colors"
              >
                <span className="text-lg">🔄</span>
              </motion.button>

              {/* Socket diagnostic button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  socketDiagnostic();
                  if (!socket.connected) {
                    forceReconnect();
                  }
                }}
                className={`p-2 rounded-lg transition-colors ${
                  socket.connected 
                    ? 'bg-green-100 hover:bg-green-200 text-green-700' 
                    : 'bg-red-100 hover:bg-red-200 text-red-700'
                }`}
                title={socket.connected ? 'Socket conectado - Click para diagnóstico' : 'Socket desconectado - Click para reconectar'}
              >
                <span className="text-lg">{socket.connected ? '🟢' : '🔴'}</span>
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Filters and controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6"
      >
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 lg:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 gap-4">
            {/* Search */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Buscar por cliente o número de pedido..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl leading-5 bg-white placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-slate-300 rounded-xl px-3 lg:px-4 py-2 lg:py-3 bg-white text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Todos</option>
                <option value={ORDER_STATUS.PENDING}>Pendientes</option>
                <option value={ORDER_STATUS.IN_PROGRESS}>En progreso</option>
                <option value={ORDER_STATUS.COMPLETED}>Completados</option>
              </select>

              {/* View mode toggle */}
              <div className="flex bg-slate-100 rounded-lg p-1 self-start">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setViewMode('grid')}
                  className={`px-2 lg:px-3 py-2 rounded-md text-xs lg:text-sm font-medium transition-colors ${
                    viewMode === 'grid' 
                      ? 'bg-white text-slate-900 shadow-sm' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Vista en cuadrícula"
                >
                  <svg className="w-4 h-4 lg:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  <span className="hidden lg:inline">Grid</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setViewMode('list')}
                  className={`px-2 lg:px-3 py-2 rounded-md text-xs lg:text-sm font-medium transition-colors ${
                    viewMode === 'list' 
                      ? 'bg-white text-slate-900 shadow-sm' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Vista en lista"
                >
                  <svg className="w-4 h-4 lg:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  <span className="hidden lg:inline">Lista</span>
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Orders grid/list */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {filteredOrders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center"
          >
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🛍️</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No hay pedidos</h3>
            <p className="text-slate-500">
              {searchTerm || statusFilter !== 'all' 
                ? 'No se encontraron pedidos con los filtros aplicados' 
                : 'Aún no hay pedidos para mostrar'
              }
            </p>
          </motion.div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 lg:gap-6'
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
                    className={`bg-white rounded-2xl shadow-sm border-2 transition-all duration-200 overflow-hidden ${
                      isPending 
                        ? 'border-yellow-200 shadow-yellow-100' 
                        : 'border-slate-200 hover:border-blue-200 hover:shadow-lg'
                    } ${viewMode === 'list' ? 'p-6' : 'p-0'}`}
                  >
                    {viewMode === 'grid' ? (
                      <>
                        {/* Card Header */}
                        <div className={`px-4 lg:px-6 py-3 lg:py-4 ${statusInfo.bgColor} border-b border-slate-100`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 lg:space-x-3 min-w-0 flex-1">
                              <div className={`w-8 h-8 lg:w-10 lg:h-10 ${orderTypeInfo.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                                <span className="text-sm lg:text-base">{orderTypeInfo.icon}</span>
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-bold text-slate-900 text-sm lg:text-base truncate">#{order.orderNumber}</h3>
                                <p className="text-xs lg:text-sm text-slate-600 truncate">{orderTypeInfo.label}</p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className={`inline-flex items-center px-2 lg:px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.textColor} ${statusInfo.bgColor}`}>
                                <span className="mr-1">{statusInfo.icon}</span>
                                <span className="hidden sm:inline">{statusInfo.label}</span>
                              </div>
                              <p className="text-xs text-slate-500 mt-1">{timeElapsed}</p>
                            </div>
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="p-4 lg:p-6">
                          <div className="space-y-2 lg:space-y-3 mb-3 lg:mb-4">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs lg:text-sm flex-shrink-0">👤</span>
                              <span className="text-xs lg:text-sm font-medium text-slate-700 truncate">{order.customerName}</span>
                            </div>
                            
                            {order.phone && (
                              <div className="flex items-center space-x-2">
                                <span className="text-xs lg:text-sm flex-shrink-0">📞</span>
                                <span className="text-xs lg:text-sm text-slate-600 truncate">{order.phone}</span>
                              </div>
                            )}
                            
                            {order.tableNumber && (
                              <div className="flex items-center space-x-2">
                                <span className="text-xs lg:text-sm flex-shrink-0">📍</span>
                                <span className="text-xs lg:text-sm text-slate-600">Mesa {order.tableNumber}</span>
                              </div>
                            )}
                            
                            {order.orderType === 'delivery' && order.address && (
                              <div className="flex items-start space-x-2">
                                <span className="text-xs lg:text-sm flex-shrink-0 mt-0.5">🏠</span>
                                <span className="text-xs lg:text-sm text-slate-600 leading-tight">{order.address}</span>
                              </div>
                            )}
                            
                            <div className="flex items-center justify-between">
                              <span className="text-xs lg:text-sm text-slate-600">{order.items?.length || 0} productos</span>
                              <span className="text-base lg:text-lg font-bold text-slate-900">${order.totalAmount}</span>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex space-x-2">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => showOrderDetails(order)}
                              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-1"
                            >
                              <span className="text-sm">👁️</span>
                              <span>Ver</span>
                            </motion.button>
                            
                            {order.status === ORDER_STATUS.PENDING && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => updateOrderStatus(order._id, ORDER_STATUS.IN_PROGRESS)}
                                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-1"
                              >
                                    <span className="text-sm">▶️</span>
                                <span>Iniciar</span>
                              </motion.button>
                            )}
                            
                            {order.status === ORDER_STATUS.IN_PROGRESS && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => updateOrderStatus(order._id, ORDER_STATUS.COMPLETED)}
                                className="flex-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-1"
                              >
                                    <span className="text-sm">✅</span>
                                <span>Completar</span>
                              </motion.button>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      // List view
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className={`w-12 h-12 ${orderTypeInfo.color} rounded-xl flex items-center justify-center`}>
                            <span className="text-xl">{orderTypeInfo.icon}</span>
                          </div>
                          <div>
                            <div className="flex items-center space-x-3">
                              <h3 className="font-bold text-slate-900">#{order.orderNumber}</h3>
                              <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.textColor} ${statusInfo.bgColor}`}>
                                <span className="mr-1">{statusInfo.icon}</span>
                                {statusInfo.label}
                              </div>
                            </div>
                            <p className="text-sm text-slate-600 mt-1">
                              {order.customerName} • {orderTypeInfo.label} • {timeElapsed}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="text-lg font-bold text-slate-900">${order.totalAmount}</p>
                            <p className="text-sm text-slate-600">{order.items?.length || 0} productos</p>
                          </div>
                          
                          <div className="flex space-x-2">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => showOrderDetails(order)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg transition-colors"
                            >
                              <span className="text-sm">👁️</span>
                            </motion.button>
                            
                            {order.status === ORDER_STATUS.PENDING && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => updateOrderStatus(order._id, ORDER_STATUS.IN_PROGRESS)}
                                className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg transition-colors"
                              >
                                    <span className="text-sm">▶️</span>
                              </motion.button>
                            )}
                            
                            {order.status === ORDER_STATUS.IN_PROGRESS && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => updateOrderStatus(order._id, ORDER_STATUS.COMPLETED)}
                                className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg transition-colors"
                              >
                                    <span className="text-sm">✅</span>
                              </motion.button>
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
                      <h2 className="text-xl font-bold text-slate-900">Pedido #{orderDetails.orderNumber}</h2>
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
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-slate-900">Total:</span>
                    <span className="text-2xl font-bold text-slate-900">${orderDetails.totalAmount}</span>
                  </div>
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
