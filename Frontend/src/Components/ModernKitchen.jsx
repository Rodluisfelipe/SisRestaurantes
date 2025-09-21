import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { socket } from '../services/socket';
import { useBusinessConfig } from '../Context/BusinessContext';

// Modern Icons
const Icons = {
  Chef: () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  Clock: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  User: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  MapPin: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  ShoppingBag: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l-1 12H6L5 9z" />
    </svg>
  ),
  Truck: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Play: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293L12 11l.707-.707A1 1 0 0113.414 10H15M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Check: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  Refresh: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  Wifi: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
    </svg>
  ),
  WifiOff: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-12.728 12.728m0 0L12 12m-6.364 6.364L12 12m6.364-6.364L12 12" />
    </svg>
  ),
  Home: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
};

function ModernKitchen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { businessConfig, businessId } = useBusinessConfig();
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const refreshIntervalRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Time formatting
  const formatTime = (date) => {
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

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

  // Get order type info
  const getOrderTypeInfo = (orderType) => {
    switch (orderType) {
      case 'inSite':
        return { icon: Icons.User, color: 'bg-blue-500', label: 'Mesa', bgColor: 'bg-blue-50', textColor: 'text-blue-700' };
      case 'takeaway':
        return { icon: Icons.ShoppingBag, color: 'bg-orange-500', label: 'Para llevar', bgColor: 'bg-orange-50', textColor: 'text-orange-700' };
      case 'delivery':
        return { icon: Icons.Truck, color: 'bg-green-500', label: 'Delivery', bgColor: 'bg-green-50', textColor: 'text-green-700' };
      default:
        return { icon: Icons.User, color: 'bg-gray-500', label: 'Desconocido', bgColor: 'bg-gray-50', textColor: 'text-gray-700' };
    }
  };

  // Get status info
  const getStatusInfo = (status) => {
    switch (status) {
      case 'pending':
        return { 
          color: 'bg-yellow-500', 
          textColor: 'text-yellow-700',
          bgColor: 'bg-yellow-50',
          label: 'Pendiente',
          icon: Icons.Clock,
          pulse: true
        };
      case 'inProgress':
        return { 
          color: 'bg-blue-500', 
          textColor: 'text-blue-700',
          bgColor: 'bg-blue-50',
          label: 'Preparando',
          icon: Icons.Play,
          pulse: false
        };
      case 'completed':
        return { 
          color: 'bg-green-500', 
          textColor: 'text-green-700',
          bgColor: 'bg-green-50',
          label: 'Listo',
          icon: Icons.Check,
          pulse: false
        };
      default:
        return { 
          color: 'bg-gray-500', 
          textColor: 'text-gray-700',
          bgColor: 'bg-gray-50',
          label: 'Desconocido',
          icon: Icons.Clock,
          pulse: false
        };
    }
  };

  // Update current time
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timeInterval);
  }, []);

  // Fetch orders from the API
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/orders?businessId=${businessId}`);
      // Only show orders sent to kitchen and that are pending or in progress
      const filteredOrders = response.data.filter(order => 
        order.sentToKitchen && (order.status === 'pending' || order.status === 'inProgress')
      );
      setOrders(filteredOrders);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('No se pudieron cargar los pedidos');
    } finally {
      setLoading(false);
    }
  };

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
        ).filter(order => 
          // Keep only pending and inProgress orders
          order.status === 'pending' || order.status === 'inProgress'
        )
      );

    } catch (error) {
      console.error('Error updating order status:', error);
      // Show error notification
    }
  };

  // Load orders on mount
  useEffect(() => {
    if (businessId) {
      fetchOrders();
    }
  }, [businessId]);

  // Set up socket connection for real-time updates
  useEffect(() => {
    if (!businessId) return;
    
    const handleConnect = () => {
      console.log('Socket connected');
      setSocketConnected(true);
      socket.emit('joinBusiness', businessId);
    };
    
    const handleDisconnect = () => {
      console.log('Socket disconnected');
      setSocketConnected(false);
    };
    
    if (socket && !socket.connected) {
      console.log('Connecting to socket...');
      socket.connect();
    } else if (socket) {
      setSocketConnected(true);
      socket.emit('joinBusiness', businessId);
    }
    
    if (socket) {
      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('connect_error', (err) => {
        console.error('Socket connection error:', err);
        setSocketConnected(false);
      });
      
      // Listen for order events
      socket.on('order_created', (newOrder) => {
      console.log('New order received:', newOrder);
      setOrders(prevOrders => {
        if (newOrder.sentToKitchen && (newOrder.status === 'pending' || newOrder.status === 'inProgress')) {
          return [newOrder, ...prevOrders];
        }
        return prevOrders;
      });
      setLastUpdated(new Date());
    });
    
    socket.on('order_updated', (updatedOrder) => {
      console.log('Order updated:', updatedOrder);
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order._id === updatedOrder._id ? updatedOrder : order
        ).filter(order => 
          order.sentToKitchen && (order.status === 'pending' || order.status === 'inProgress')
        )
      );
      setLastUpdated(new Date());
    });
    
      socket.on('order_deleted', (deletedOrder) => {
        console.log('Order deleted:', deletedOrder);
        setOrders(prevOrders => 
          prevOrders.filter(order => order._id !== deletedOrder._id)
        );
        setLastUpdated(new Date());
      });
    }

    return () => {
      if (socket) {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('connect_error');
        socket.off('order_created');
        socket.off('order_updated');
        socket.off('order_deleted');
      }
    };
  }, [businessId]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (businessId) {
      refreshIntervalRef.current = setInterval(() => {
        fetchOrders();
      }, 30000);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [businessId]);

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
      x: -100,
      transition: {
        duration: 0.3
      }
    }
  };

  if (loading && orders.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"
          />
          <p className="text-slate-300 text-lg font-medium">Cargando pedidos...</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center"
      >
        <div className="bg-slate-800 p-8 rounded-2xl shadow-xl border border-red-500/20">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-200 mb-2">Error al cargar pedidos</h3>
            <p className="text-slate-400 mb-6">{error}</p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={fetchOrders}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Intentar de nuevo
            </motion.button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div 
      className="min-h-screen"
      style={{
        backgroundColor: businessConfig?.theme?.buttonColor || '#1e293b',
        backgroundImage: `linear-gradient(135deg, ${businessConfig?.theme?.buttonColor || '#1e293b'}ee, ${businessConfig?.theme?.buttonColor || '#1e293b'}cc)`
      }}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="backdrop-blur-sm border-b sticky top-0 z-40"
        style={{
          backgroundColor: `${businessConfig?.theme?.buttonColor || '#1e293b'}dd`,
          borderBottomColor: `${businessConfig?.theme?.buttonColor || '#334155'}80`,
          boxShadow: `0 4px 20px ${businessConfig?.theme?.buttonColor || '#1e293b'}40`
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="flex items-center space-x-3"
              >
                {/* Logo del restaurante */}
                {businessConfig?.logo ? (
                  <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg border-2 border-white/20">
                    <img 
                      src={businessConfig.logo} 
                      alt={businessConfig.businessName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div 
                    className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
                    style={{
                      backgroundColor: businessConfig?.theme?.buttonColor || '#f97316',
                      boxShadow: `0 8px 25px ${businessConfig?.theme?.buttonColor || '#f97316'}40`,
                      border: `2px solid ${businessConfig?.theme?.buttonTextColor || '#ffffff'}20`
                    }}
                  >
                    <Icons.Chef 
                      style={{ 
                        color: businessConfig?.theme?.buttonTextColor || '#ffffff' 
                      }} 
                    />
                  </div>
                )}
                <div>
                  <h1 
                    className="text-2xl font-bold"
                    style={{ 
                      color: businessConfig?.theme?.buttonTextColor || '#ffffff' 
                    }}
                  >
                    {businessConfig?.businessName || 'Pantalla de Cocina'}
                  </h1>
                  <p 
                    className="text-sm"
                    style={{ 
                      color: `${businessConfig?.theme?.buttonTextColor || '#ffffff'}cc` 
                    }}
                  >
                    🍳 Cocina • Pedidos en Tiempo Real
                  </p>
                </div>
              </motion.div>
            </div>

            <div className="flex items-center space-x-6">
              {/* Current Time */}
              <div className="text-right">
                <div className="text-xl font-mono text-slate-100">{formatTime(currentTime)}</div>
                <div className="text-sm text-slate-400 capitalize">{formatDate(currentTime)}</div>
              </div>

              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                <motion.div
                  animate={socketConnected ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                  className={`w-3 h-3 rounded-full ${socketConnected ? 'bg-green-400' : 'bg-red-400'}`}
                />
                <span className={`text-sm font-medium ${socketConnected ? 'text-green-400' : 'text-red-400'}`}>
                  {socketConnected ? 'En línea' : 'Desconectado'}
                </span>
                {socketConnected ? <Icons.Wifi className="text-green-400" /> : <Icons.WifiOff className="text-red-400" />}
              </div>

              {/* Refresh Button */}
              <motion.button
                whileHover={{ scale: 1.05, rotate: 180 }}
                whileTap={{ scale: 0.95 }}
                onClick={fetchOrders}
                disabled={loading}
                className="bg-slate-700 hover:bg-slate-600 text-slate-200 p-3 rounded-xl transition-colors disabled:opacity-50"
              >
                <Icons.Refresh />
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="max-w-7xl mx-auto px-6 py-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Pedidos Pendientes</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {orders.filter(order => order.status === 'pending').length}
                </p>
              </div>
              <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                <Icons.Clock className="text-yellow-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">En Preparación</p>
                <p className="text-2xl font-bold text-blue-400">
                  {orders.filter(order => order.status === 'inProgress').length}
                </p>
              </div>
              <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Icons.Play className="text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total Activos</p>
                <p className="text-2xl font-bold text-slate-200">{orders.length}</p>
              </div>
              <div className="w-10 h-10 bg-slate-600/50 rounded-xl flex items-center justify-center">
                <Icons.Chef className="text-slate-300" />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Orders Grid */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        {orders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-800/50 rounded-2xl p-12 text-center border border-slate-700"
          >
            <motion.div
              animate={{ 
                y: [0, -10, 0],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ 
                duration: 3, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="text-6xl mb-6"
            >
              👨‍🍳
            </motion.div>
            <h3 className="text-xl font-semibold text-slate-200 mb-2">Todo tranquilo por aquí</h3>
            <p className="text-slate-400 max-w-md mx-auto">
              Los pedidos aparecerán automáticamente cuando sean enviados desde el panel de administración
            </p>
            <div className="mt-6 text-sm text-slate-500">
              Última actualización: {formatTime(lastUpdated)}
            </div>
          </motion.div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6"
          >
            <AnimatePresence>
              {orders.map((order) => {
                const orderTypeInfo = getOrderTypeInfo(order.orderType);
                const statusInfo = getStatusInfo(order.status);
                const timeElapsed = calculateTimeElapsed(order.createdAt);
                const isPending = order.status === 'pending';

                return (
                  <motion.div
                    key={order._id}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    className={`bg-slate-800/70 backdrop-blur-sm rounded-2xl shadow-xl border transition-all duration-200 overflow-hidden ${
                      isPending 
                        ? 'border-yellow-500/50 shadow-yellow-500/10' 
                        : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    {/* Card Header */}
                    <div className={`px-6 py-4 ${statusInfo.bgColor}/10 border-b border-slate-700`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 ${orderTypeInfo.color} rounded-xl flex items-center justify-center`}>
                            {React.createElement(orderTypeInfo.icon, { className: "w-5 h-5 text-white" })}
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-100">#{order.orderNumber}</h3>
                            <p className="text-sm text-slate-400">{orderTypeInfo.label}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <motion.div 
                            animate={statusInfo.pulse ? { scale: [1, 1.05, 1] } : {}}
                            transition={{ duration: 2, repeat: Infinity }}
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.textColor} ${statusInfo.bgColor}/20 border border-current border-opacity-20`}
                          >
                            {React.createElement(statusInfo.icon, { className: "w-3 h-3 mr-1" })}
                            {statusInfo.label}
                          </motion.div>
                          <p className="text-xs text-slate-500 mt-1">{timeElapsed}</p>
                        </div>
                      </div>
                    </div>

                    {/* Customer Info */}
                    <div className="px-6 py-4 border-b border-slate-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Icons.User className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-medium text-slate-200">{order.customerName}</span>
                        </div>
                        {order.orderType === 'inSite' && order.tableNumber && (
                          <div className="flex items-center space-x-1">
                            <Icons.MapPin className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-400">Mesa {order.tableNumber}</span>
                          </div>
                        )}
                        {order.orderType === 'delivery' && order.address && (
                          <div className="flex items-center space-x-1 max-w-xs">
                            <Icons.Home className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <span className="text-sm text-slate-400 truncate">{order.address}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Order Items */}
                    <div className="px-6 py-4 max-h-48 overflow-y-auto custom-scrollbar">
                      <div className="space-y-3">
                        {order.items?.map((item, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="bg-slate-700/30 rounded-lg p-3"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h4 className="font-medium text-slate-200">{item.name}</h4>
                                <p className="text-sm text-slate-400">Cantidad: {item.quantity}</p>
                                
                                {item.selectedToppings && item.selectedToppings.length > 0 && (
                                  <div className="mt-2">
                                    <p className="text-xs font-medium text-slate-400 mb-1">Extras:</p>
                                    <div className="space-y-1">
                                      {item.selectedToppings.map((topping, toppingIndex) => (
                                        <p key={toppingIndex} className="text-xs text-slate-500">
                                          • {topping.optionName}
                                        </p>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              <div className="text-right ml-4">
                                <p className="font-semibold text-slate-200">${(item.price * item.quantity).toFixed(2)}</p>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Total */}
                    <div className="px-6 py-3 border-t border-slate-700">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-400">Total:</span>
                        <span className="text-lg font-bold text-slate-100">${order.totalAmount}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div 
                      className="px-6 py-4"
                      style={{
                        backgroundColor: `${businessConfig?.theme?.buttonColor || '#1e293b'}20`
                      }}
                    >
                      {order.status === 'pending' && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => updateOrderStatus(order._id, 'inProgress')}
                          className="w-full px-4 py-3 rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-2"
                          style={{
                            backgroundColor: businessConfig?.theme?.buttonColor || '#3b82f6',
                            color: businessConfig?.theme?.buttonTextColor || '#ffffff',
                            boxShadow: `0 8px 25px ${businessConfig?.theme?.buttonColor || '#3b82f6'}40`,
                            border: `1px solid ${businessConfig?.theme?.buttonColor || '#3b82f6'}80`
                          }}
                        >
                          <Icons.Play 
                            className="w-5 h-5" 
                            style={{ color: businessConfig?.theme?.buttonTextColor || '#ffffff' }}
                          />
                          <span>Iniciar Preparación</span>
                        </motion.button>
                      )}
                      
                      {order.status === 'inProgress' && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => updateOrderStatus(order._id, 'completed')}
                          className="w-full px-4 py-3 rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-2"
                          style={{
                            backgroundColor: '#10b981',
                            color: '#ffffff',
                            boxShadow: '0 8px 25px #10b98140',
                            border: '1px solid #10b98180'
                          }}
                        >
                          <Icons.Check className="w-5 h-5" />
                          <span>Pedido Listo</span>
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(71, 85, 105, 0.1);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.3);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.5);
        }
      `}</style>
    </div>
  );
}

export default ModernKitchen;
