import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { socket } from '../services/socket';
import { useBusinessConfig } from '../Context/BusinessContext';

// Status configurations with animations
const getStatusConfig = (status) => {
  switch (status) {
    case 'pending':
      return {
        label: 'PEDIDO RECIBIDO',
        color: 'from-yellow-400 to-orange-500',
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-800',
        borderColor: 'border-yellow-300',
        icon: '📋',
        pulse: true,
        priority: 1
      };
    case 'inProgress':
    case 'preparing':
      return {
        label: 'PREPARANDO',
        color: 'from-blue-500 to-purple-600',
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-800',
        borderColor: 'border-blue-300',
        icon: '👨‍🍳',
        pulse: true,
        priority: 2
      };
    case 'confirmed':
      return {
        label: 'PEDIDO CONFIRMADO',
        color: 'from-indigo-500 to-blue-600',
        bgColor: 'bg-indigo-100',
        textColor: 'text-indigo-800',
        borderColor: 'border-indigo-300',
        icon: '✔️',
        pulse: true,
        priority: 1
      };
    case 'ready':
    case 'completed':
      return {
        label: '¡LISTO PARA RECOGER!',
        color: 'from-green-500 to-emerald-600',
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        borderColor: 'border-green-300',
        icon: '✅',
        pulse: false,
        priority: 3
      };
    default:
      return {
        label: 'PROCESANDO',
        color: 'from-gray-400 to-gray-600',
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-800',
        borderColor: 'border-gray-300',
        icon: '⏳',
        pulse: false,
        priority: 0
      };
  }
};

// Get order type display info
const getOrderTypeInfo = (orderType, tableNumber = null, isHotel = false) => {
  switch (orderType) {
    case 'inSite':
      return {
        label: tableNumber ? `${isHotel ? 'HAB' : 'MESA'} ${tableNumber}` : (isHotel ? 'EN HAB.' : 'EN MESA'),
        icon: '🪑',
        color: 'text-blue-600'
      };
    case 'takeaway':
      return {
        label: 'PARA LLEVAR',
        icon: '🥡',
        color: 'text-orange-600'
      };
    case 'delivery':
      return {
        label: 'DELIVERY',
        icon: '🚚',
        color: 'text-green-600'
      };
    default:
      return {
        label: 'PEDIDO',
        icon: '🍽️',
        color: 'text-gray-600'
      };
  }
};

// Calculate time elapsed
const calculateTimeElapsed = (createdAt) => {
  const orderTime = new Date(createdAt);
  const now = new Date();
  const diffMs = now - orderTime;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Recién creado';
  if (diffMins < 60) return `${diffMins} min`;
  
  const diffHrs = Math.floor(diffMins / 60);
  return `${diffHrs}h ${diffMins % 60}m`;
};

function CustomerOrderDisplay() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { businessConfig, businessId } = useBusinessConfig();
  const isHotel = businessConfig?.businessType === 'hotel';
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [products, setProducts] = useState([]);
  const [currentProductIndex, setCurrentProductIndex] = useState(0);

  // Update current time every second
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timeInterval);
  }, []);

  // Format time for display
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
      day: 'numeric',
      month: 'long'
    });
  };

  // Fetch orders from API
  const fetchOrders = async () => {
    try {
      const response = await api.get(`/orders?businessId=${businessId}`);
      // Show orders that are pending, in progress, or recently completed
      const ACTIVE_CUSTOMER_STATUSES = ['pending', 'confirmed', 'inProgress', 'preparing'];
      const DONE_CUSTOMER_STATUSES = ['ready', 'completed'];
      const activeOrders = response.data.filter(order => 
        ACTIVE_CUSTOMER_STATUSES.includes(order.status) || 
        (DONE_CUSTOMER_STATUSES.includes(order.status) && 
         new Date() - new Date(order.updatedAt) < 5 * 60 * 1000) // Show completed orders for 5 minutes
      );
      
      // Sort by priority (status) and then by creation time
      activeOrders.sort((a, b) => {
        const statusA = getStatusConfig(a.status).priority;
        const statusB = getStatusConfig(b.status).priority;
        
        if (statusA !== statusB) {
          return statusA - statusB; // Lower priority number = higher priority
        }
        
        return new Date(a.createdAt) - new Date(b.createdAt); // Older orders first
      });
      
      setOrders(activeOrders);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Error al cargar pedidos');
    } finally {
      setLoading(false);
    }
  };

  // Fetch products for promotional display
  const fetchProducts = async () => {
    try {
      const response = await api.get(`/products?businessId=${businessId}`);
      setProducts(response.data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  // Load orders and products on mount
  useEffect(() => {
    if (businessId) {
      fetchOrders();
      fetchProducts();
    }
  }, [businessId]);

  // Rotate products for promotional display
  useEffect(() => {
    if (products.length > 0) {
      const productRotationInterval = setInterval(() => {
        setCurrentProductIndex(prev => (prev + 1) % products.length);
      }, 4000); // Change product every 4 seconds
      
      return () => clearInterval(productRotationInterval);
    }
  }, [products.length]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!businessId) return;
    
    const refreshInterval = setInterval(() => {
      fetchOrders();
      fetchProducts(); // Refresh products too in case menu changes
    }, 30000);
    
    return () => clearInterval(refreshInterval);
  }, [businessId]);

  // Socket connection for real-time updates
  useEffect(() => {
    if (!businessId) return;
    
    if (socket && !socket.connected) {
      socket.connect();
    }
    
    if (socket) {
      socket.emit('joinBusiness', businessId);
    }
    
    // Listen for order events
    if (socket) {
      socket.on('order_created', (newOrder) => {
      console.log('New order received:', newOrder);
      setOrders(prevOrders => {
        const updatedOrders = [newOrder, ...prevOrders];
        return updatedOrders.sort((a, b) => {
          const statusA = getStatusConfig(a.status).priority;
          const statusB = getStatusConfig(b.status).priority;
          if (statusA !== statusB) return statusA - statusB;
          return new Date(a.createdAt) - new Date(b.createdAt);
        });
      });
      setLastUpdated(new Date());
    });
    
    socket.on('order_updated', (updatedOrder) => {
      console.log('Order updated:', updatedOrder);
      setOrders(prevOrders => {
        const newOrders = prevOrders.map(order => 
          order._id === updatedOrder._id ? updatedOrder : order
        ).filter(order => 
          order.status === 'pending' || 
          order.status === 'inProgress' || 
          (order.status === 'completed' && 
           new Date() - new Date(order.updatedAt) < 5 * 60 * 1000)
        );
        
        return newOrders.sort((a, b) => {
          const statusA = getStatusConfig(a.status).priority;
          const statusB = getStatusConfig(b.status).priority;
          if (statusA !== statusB) return statusA - statusB;
          return new Date(a.createdAt) - new Date(b.createdAt);
        });
      });
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
        socket.off('order_created');
        socket.off('order_updated');
        socket.off('order_deleted');
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
      scale: 0.9
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.5,
        ease: [0.4, 0.0, 0.2, 1]
      }
    },
    exit: {
      opacity: 0,
      scale: 0.8,
      y: -20,
      transition: {
        duration: 0.3
      }
    }
  };

  if (loading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{
          backgroundColor: businessConfig?.theme?.buttonColor || '#fb923c',
          backgroundImage: `linear-gradient(135deg, ${businessConfig?.theme?.buttonColor || '#fb923c'}ee, ${businessConfig?.theme?.buttonColor || '#f97316'}dd, ${businessConfig?.theme?.buttonColor || '#ea580c'}cc)`
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center text-white"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-20 h-20 border-4 border-white border-t-transparent rounded-full mx-auto mb-6"
          />
          <h2 className="text-3xl font-bold mb-2">Cargando pedidos...</h2>
          <p className="text-xl opacity-90">Preparando la pantalla para nuestros clientes</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{
          backgroundColor: businessConfig?.theme?.buttonColor || '#fb923c',
          backgroundImage: `linear-gradient(135deg, ${businessConfig?.theme?.buttonColor || '#fb923c'}ee, ${businessConfig?.theme?.buttonColor || '#f97316'}dd, ${businessConfig?.theme?.buttonColor || '#ea580c'}cc)`
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center text-white bg-white/10 backdrop-blur-md rounded-3xl p-12 border border-white/20"
        >
          <div className="text-6xl mb-6">⚠️</div>
          <h2 className="text-3xl font-bold mb-4">Error al cargar pedidos</h2>
          <p className="text-xl mb-6">{error}</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={fetchOrders}
            className="bg-white text-red-600 px-8 py-3 rounded-2xl font-bold text-lg hover:bg-gray-100 transition-colors"
          >
            Reintentar
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen relative overflow-hidden"
      style={{
        backgroundColor: businessConfig?.theme?.buttonColor || '#fb923c',
        backgroundImage: `linear-gradient(135deg, ${businessConfig?.theme?.buttonColor || '#fb923c'}ee, ${businessConfig?.theme?.buttonColor || '#f97316'}dd, ${businessConfig?.theme?.buttonColor || '#ea580c'}cc)`
      }}
    >
      {/* Subtle Floating Food Icons */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute opacity-[0.02]"
            animate={{
              y: [0, -15, 0],
              x: [0, Math.sin(i) * 8, 0],
              rotate: [0, Math.sin(i) * 5, 0],
              scale: [1, 1.05, 1]
            }}
            transition={{
              duration: 8 + Math.random() * 4, // 8-12 seconds
              repeat: Infinity,
              delay: Math.random() * 6,
              ease: "easeInOut"
            }}
            style={{
              left: `${15 + Math.random() * 70}%`, // Keep away from edges
              top: `${15 + Math.random() * 70}%`,
            }}
          >
            <div className="text-3xl">
              {['🍔', '🍕', '🍟', '🌭', '🌮', '🍗'][i]}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Compact Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 backdrop-blur-md border-b sticky top-0"
        style={{
          backgroundColor: `${businessConfig?.theme?.buttonColor || '#1e293b'}dd`,
          borderBottomColor: `${businessConfig?.theme?.buttonColor || '#ffffff'}40`,
          boxShadow: `0 4px 20px ${businessConfig?.theme?.buttonColor || '#1e293b'}50`
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* Logo del restaurante */}
              {businessConfig?.logo ? (
                <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg border-2 border-white/20">
                  <img 
                    src={businessConfig.logo} 
                    alt={businessConfig.businessName}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
                  style={{
                    backgroundColor: businessConfig?.theme?.buttonColor || '#f97316',
                    boxShadow: `0 8px 25px ${businessConfig?.theme?.buttonColor || '#f97316'}40`,
                    border: `2px solid ${businessConfig?.theme?.buttonTextColor || '#ffffff'}30`
                  }}
                >
                  <span 
                    className="text-xl"
                    style={{ color: businessConfig?.theme?.buttonTextColor || '#ffffff' }}
                  >
                    🍽️
                  </span>
                </div>
              )}
               <div>
                 <h1 
                   className="text-xl font-bold drop-shadow-lg"
                   style={{ color: businessConfig?.theme?.buttonTextColor || '#ffffff' }}
                 >
                   {businessConfig?.businessName || 'Mi Negocio'}
                 </h1>
                 <p 
                   className="text-xs"
                   style={{ color: `${businessConfig?.theme?.buttonTextColor || '#ffffff'}cc` }}
                 >
                   Pantalla de Pedidos
                 </p>
               </div>
            </div>
            
             <div className="flex items-center space-x-4 text-white/90">
               <div className="text-lg font-mono">{formatTime(currentTime)}</div>
               <div className="flex items-center space-x-1">
                 <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                 <span className="text-xs">VIVO</span>
               </div>
               
             </div>
          </div>
        </div>
      </motion.div>

      {/* Orders Display - Full Screen Priority */}
      <div className="relative z-10 px-3 py-2">
        {orders.length === 0 ? (
          /* Full Screen Promotional Products Grid */
          products.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3"
            >
              <AnimatePresence mode="wait">
                {products.map((product, index) => {
                    const isHighlighted = index === currentProductIndex % products.length;
                    
                    return (
                       <div className="relative">
                         <motion.div
                           key={product._id}
                           initial={{ opacity: 0, scale: 0.8 }}
                           animate={{ 
                             opacity: 1, 
                             scale: isHighlighted ? 1.05 : 1,
                             y: isHighlighted ? -5 : 0
                           }}
                           transition={{ 
                             duration: 0.5,
                             delay: index * 0.1 
                           }}
                           className={`rounded-2xl overflow-hidden transition-all duration-500 cursor-pointer ${
                             isHighlighted 
                               ? 'shadow-2xl shadow-yellow-200/50' 
                               : 'shadow-lg hover:shadow-xl'
                           }`}
                         >
                           {/* Pure Product Image - Completely clean */}
                           <div className="aspect-square overflow-hidden">
                             {product.image ? (
                               <motion.img
                                 src={product.image}
                                 alt={product.name}
                                 className="w-full h-full object-cover"
                                 whileHover={{ scale: 1.05 }}
                                 transition={{ duration: 0.3 }}
                                 onError={(e) => {
                                   e.target.style.display = 'none';
                                   e.target.nextSibling.style.display = 'flex';
                                 }}
                               />
                             ) : null}
                             <div 
                               className="w-full h-full bg-gradient-to-br from-orange-200 to-red-200 flex items-center justify-center"
                               style={{ display: product.image ? 'none' : 'flex' }}
                             >
                               <div className="text-8xl">
                                 {['🍔', '🍕', '🍟', '🌭', '🌮', '🍗', '🥪', '🍩'][index % 8]}
                               </div>
                             </div>
                           </div>
                         </motion.div>
                         
                         {/* Highlight Badge - In margin below image */}
                         {isHighlighted && (
                           <motion.div
                             initial={{ opacity: 0, scale: 0 }}
                             animate={{ opacity: 1, scale: 1 }}
                             exit={{ opacity: 0, scale: 0 }}
                             className="mt-3 flex justify-center"
                           >
                             <div 
                               className="px-3 py-2 rounded-full text-sm font-bold flex items-center space-x-1"
                               style={{
                                 backgroundColor: businessConfig?.theme?.buttonColor || '#fbbf24',
                                 color: businessConfig?.theme?.buttonTextColor || '#92400e',
                                 boxShadow: `0 8px 25px ${businessConfig?.theme?.buttonColor || '#fbbf24'}50`,
                                 border: `2px solid ${businessConfig?.theme?.buttonColor || '#fbbf24'}80`
                               }}
                             >
                               <span>⭐</span>
                               <span>DESTACADO</span>
                             </div>
                           </motion.div>
                         )}
                       </div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )
        ) : (
          <div>

            {/* TV-Optimized Kanban Style - 3 Columns by Status */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 gap-1 sm:gap-2 md:gap-2 lg:gap-3 xl:gap-4 px-1 sm:px-2 md:px-2 lg:px-3 xl:px-4 max-w-full mx-auto h-[calc(100vh-100px)] sm:h-[calc(100vh-110px)] md:h-[calc(100vh-120px)]"
              style={{
                // TV-specific optimizations
                fontSize: 'clamp(0.8rem, 2.5vw, 1.2rem)'
              }}
            >
              {/* Column 1: Pedidos Recibidos (Pending) */}
              <motion.div
                variants={cardVariants}
                className="bg-white/10 backdrop-blur-lg rounded-2xl p-2 flex flex-col"
                style={{
                  backgroundColor: `#fbbf2420`,
                  border: `1px solid #fbbf2440`,
                  boxShadow: `0 8px 20px #fbbf2420`
                }}
              >
                {/* Compact Header */}
                <div className="text-center mb-2 flex-shrink-0">
                  <div className="flex items-center justify-center space-x-2">
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{
                        backgroundColor: '#fbbf24',
                        boxShadow: `0 4px 12px #fbbf2440`
                      }}
                    >
                      <span className="text-lg">📋</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">RECIBIDOS</h3>
                      <span 
                        className="text-xs px-2 py-0.5 rounded-full font-bold"
                        style={{
                          backgroundColor: '#fbbf24',
                          color: '#92400e'
                        }}
                      >
                        {orders.filter(o => o.status === 'pending').length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* TV-Optimized Orders Grid - No Scroll */}
                <div className="flex-1 grid grid-cols-1 gap-1 auto-rows-min">
                  <AnimatePresence>
                    {orders.filter(order => order.status === 'pending').map((order) => {
                      const orderTypeInfo = getOrderTypeInfo(order.orderType, order.tableNumber, isHotel);

                      return (
                        <motion.div
                          key={order._id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="bg-white/95 backdrop-blur-xl rounded-lg shadow-md overflow-hidden"
                          style={{
                            border: '1px solid #fbbf24',
                            boxShadow: '0 2px 8px #fbbf2430',
                            minHeight: 'auto'
                          }}
                        >
                          {/* Ultra Compact Single Row - All Essential Info */}
                          <div 
                            className="px-2 py-2 flex items-center justify-between"
                            style={{
                              backgroundColor: '#fbbf24',
                              backgroundImage: 'linear-gradient(135deg, #fbbf24ee, #fbbf24cc)'
                            }}
                          >
                            {/* Order Number - EXTRA LARGE */}
                            <div className="flex items-center space-x-1">
                              <motion.span
                                animate={{ 
                                  scale: [1, 1.05, 1]
                                }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="text-sm"
                              >
                                📋
                              </motion.span>
                              <span 
                                className="font-black text-amber-900"
                                style={{ 
                                  fontSize: 'clamp(1.2rem, 3.5vw, 2.5rem)',
                                  lineHeight: '1'
                                }}
                              >
                                #{order.orderNumber} ({order._id?.slice(-6)})
                              </span>
                            </div>

                            {/* Customer Name - Center */}
                            <div className="flex-1 mx-2">
                              <p 
                                className="font-bold text-amber-900 truncate text-center"
                                style={{ 
                                  fontSize: 'clamp(0.9rem, 2.5vw, 1.5rem)',
                                  lineHeight: '1'
                                }}
                              >
                                {order.customerName}
                              </p>
                            </div>

                            {/* Mesa - LARGE */}
                            <div 
                              className="font-black text-amber-900"
                              style={{ 
                                fontSize: 'clamp(1rem, 3vw, 2rem)',
                                lineHeight: '1'
                              }}
                            >
                              {order.orderType === 'inSite' && order.tableNumber ? 
                                `MESA ${order.tableNumber}` : 
                                orderTypeInfo.label.toUpperCase()
                              }
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </motion.div>

              {/* Column 2: En Preparación (InProgress) */}
              <motion.div
                variants={cardVariants}
                className="bg-white/10 backdrop-blur-lg rounded-2xl p-2 flex flex-col"
                style={{
                  backgroundColor: `#3b82f620`,
                  border: `1px solid #3b82f640`,
                  boxShadow: `0 8px 20px #3b82f620`
                }}
              >
                {/* Compact Header */}
                <div className="text-center mb-2 flex-shrink-0">
                  <div className="flex items-center justify-center space-x-2">
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{
                        backgroundColor: '#3b82f6',
                        boxShadow: `0 4px 12px #3b82f640`
                      }}
                    >
                      <span className="text-lg">👨‍🍳</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">PREPARACIÓN</h3>
                      <span 
                        className="text-xs px-2 py-0.5 rounded-full font-bold"
                        style={{
                          backgroundColor: '#3b82f6',
                          color: '#1e40af'
                        }}
                      >
                        {orders.filter(o => o.status === 'inProgress').length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* TV-Optimized Orders Grid - No Scroll */}
                <div className="flex-1 grid grid-cols-1 gap-1 auto-rows-min">
                  <AnimatePresence>
                    {orders.filter(order => order.status === 'inProgress').map((order) => {
                      const orderTypeInfo = getOrderTypeInfo(order.orderType, order.tableNumber, isHotel);

                      return (
                        <motion.div
                          key={order._id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="bg-white/95 backdrop-blur-xl rounded-lg shadow-md overflow-hidden"
                          style={{
                            border: '1px solid #3b82f6',
                            boxShadow: '0 2px 8px #3b82f630',
                            minHeight: 'auto'
                          }}
                        >
                          {/* Ultra Compact Single Row - All Essential Info */}
                          <div 
                            className="px-2 py-2 flex items-center justify-between"
                            style={{
                              backgroundColor: '#3b82f6',
                              backgroundImage: 'linear-gradient(135deg, #3b82f6ee, #3b82f6cc)'
                            }}
                          >
                            {/* Order Number - EXTRA LARGE */}
                            <div className="flex items-center space-x-1">
                              <motion.span
                                animate={{ 
                                  scale: [1, 1.05, 1]
                                }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="text-sm"
                              >
                                👨‍🍳
                              </motion.span>
                              <span 
                                className="font-black text-blue-900"
                                style={{ 
                                  fontSize: 'clamp(1.2rem, 3.5vw, 2.5rem)',
                                  lineHeight: '1'
                                }}
                              >
                                #{order.orderNumber} ({order._id?.slice(-6)})
                              </span>
                            </div>

                            {/* Customer Name - Center */}
                            <div className="flex-1 mx-2">
                              <p 
                                className="font-bold text-blue-900 truncate text-center"
                                style={{ 
                                  fontSize: 'clamp(0.9rem, 2.5vw, 1.5rem)',
                                  lineHeight: '1'
                                }}
                              >
                                {order.customerName}
                              </p>
                            </div>

                            {/* Mesa - LARGE */}
                            <div 
                              className="font-black text-blue-900"
                              style={{ 
                                fontSize: 'clamp(1rem, 3vw, 2rem)',
                                lineHeight: '1'
                              }}
                            >
                              {order.orderType === 'inSite' && order.tableNumber ? 
                                `MESA ${order.tableNumber}` : 
                                orderTypeInfo.label.toUpperCase()
                              }
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </motion.div>

              {/* Column 3: Listos para Recoger (Completed) */}
              <motion.div
                variants={cardVariants}
                className="bg-white/10 backdrop-blur-lg rounded-2xl p-2 flex flex-col"
                style={{
                  backgroundColor: `#10b98120`,
                  border: `1px solid #10b98140`,
                  boxShadow: `0 8px 20px #10b98120`
                }}
              >
                {/* Compact Header */}
                <div className="text-center mb-2 flex-shrink-0">
                  <div className="flex items-center justify-center space-x-2">
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{
                        backgroundColor: '#10b981',
                        boxShadow: `0 4px 12px #10b98140`
                      }}
                    >
                      <span className="text-lg">✅</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">¡LISTOS!</h3>
                      <span 
                        className="text-xs px-2 py-0.5 rounded-full font-bold"
                        style={{
                          backgroundColor: '#10b981',
                          color: '#065f46'
                        }}
                      >
                        {orders.filter(o => o.status === 'completed').length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* TV-Optimized Orders Grid - No Scroll */}
                <div className="flex-1 grid grid-cols-1 gap-1 auto-rows-min">
                  <AnimatePresence>
                    {orders.filter(order => order.status === 'completed').map((order) => {
                      const orderTypeInfo = getOrderTypeInfo(order.orderType, order.tableNumber, isHotel);

                      return (
                        <motion.div
                          key={order._id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="bg-white/95 backdrop-blur-xl rounded-lg shadow-md overflow-hidden"
                          style={{
                            border: '1px solid #10b981',
                            boxShadow: '0 2px 8px #10b98130',
                            minHeight: 'auto'
                          }}
                        >
                          {/* Ultra Compact Single Row - All Essential Info */}
                          <div 
                            className="px-2 py-2 flex items-center justify-between"
                            style={{
                              backgroundColor: '#10b981',
                              backgroundImage: 'linear-gradient(135deg, #10b981ee, #10b981cc)'
                            }}
                          >
                            {/* Order Number - EXTRA LARGE */}
                            <div className="flex items-center space-x-1">
                              <motion.span
                                animate={{ 
                                  scale: [1, 1.1, 1],
                                  rotate: [0, 10, -10, 0]
                                }}
                                transition={{ duration: 3, repeat: Infinity }}
                                className="text-sm"
                              >
                                ✅
                              </motion.span>
                              <span 
                                className="font-black text-green-900"
                                style={{ 
                                  fontSize: 'clamp(1.2rem, 3.5vw, 2.5rem)',
                                  lineHeight: '1'
                                }}
                              >
                                #{order.orderNumber} ({order._id?.slice(-6)})
                              </span>
                            </div>

                            {/* Customer Name - Center */}
                            <div className="flex-1 mx-2">
                              <p 
                                className="font-bold text-green-900 truncate text-center"
                                style={{ 
                                  fontSize: 'clamp(0.9rem, 2.5vw, 1.5rem)',
                                  lineHeight: '1'
                                }}
                              >
                                {order.customerName}
                              </p>
                            </div>

                            {/* Mesa - LARGE */}
                            <div 
                              className="font-black text-green-900"
                              style={{ 
                                fontSize: 'clamp(1rem, 3vw, 2rem)',
                                lineHeight: '1'
                              }}
                            >
                              {order.orderType === 'inSite' && order.tableNumber ? 
                                `MESA ${order.tableNumber}` : 
                                orderTypeInfo.label.toUpperCase()
                              }
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </motion.div>
            </motion.div>
          </div>
        )}
      </div>

       {/* Minimal Footer */}
       <motion.div
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
         className="relative z-10 bg-white/5 backdrop-blur-sm border-t border-white/10 mt-6"
       >
         <div className="px-4 py-1">
           <div className="flex items-center justify-center text-white/40">
             <div className="text-xs">
               © {new Date().getFullYear()}
             </div>
           </div>
         </div>
       </motion.div>
    </div>
  );
}

export default CustomerOrderDisplay;