import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { socket } from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';

function Kitchen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { businessConfig, businessId } = useBusinessConfig();
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const refreshIntervalRef = useRef(null);
  
  // Show current time
  const [currentTime, setCurrentTime] = useState(new Date());
  
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
      // Solo mostrar pedidos enviados a cocina y que estén pendientes o en progreso
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
      await api.patch(`/orders/${orderId}/status`, { status: newStatus });
      // Refresh orders after status update to ensure UI is in sync
      fetchOrders();
    } catch (err) {
      console.error('Error updating order status:', err);
      alert('Error al actualizar el estado del pedido');
    }
  };
  
  // Set up automatic refresh interval (every 30 seconds)
  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      console.log('Auto-refreshing orders...');
      fetchOrders();
    }, 30000); // 30 seconds
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [businessId]);

  // Set up socket connection for real-time updates
  useEffect(() => {
    if (!businessId) return;
    
    // Handle socket connection status
    const handleConnect = () => {
      console.log('Socket connected');
      setSocketConnected(true);
      
      // Join the business room
      socket.emit('joinBusiness', businessId);
    };
    
    const handleDisconnect = () => {
      console.log('Socket disconnected');
      setSocketConnected(false);
    };
    
    // Connect to socket if not already connected
    if (!socket.connected) {
      console.log('Connecting to socket...');
      socket.connect();
    } else {
      setSocketConnected(true);
      // Make sure we're in the right room
      socket.emit('joinBusiness', businessId);
    }
    
    // Set up connection event listeners
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
        // Solo agregar si fue enviado a cocina y está pendiente o en progreso
        if (newOrder.sentToKitchen && (newOrder.status === 'pending' || newOrder.status === 'inProgress')) {
          return [newOrder, ...prevOrders];
        }
        return prevOrders;
      });
      setLastUpdated(new Date());
    });
    
    socket.on('order_updated', (updatedOrder) => {
      console.log('Order updated:', updatedOrder);
      setOrders(prevOrders => {
        // Si está enviado a cocina y pendiente/en progreso, actualizar
        if (updatedOrder.sentToKitchen && (updatedOrder.status === 'pending' || updatedOrder.status === 'inProgress')) {
          return prevOrders.map(order => 
            order._id === updatedOrder._id ? updatedOrder : order
          );
        } else {
          // Si ya no cumple las condiciones, quitarlo de la lista
          return prevOrders.filter(order => order._id !== updatedOrder._id);
        }
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
    
    // Fetch initial orders
    fetchOrders();
    
    // Cleanup on unmount
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error');
      socket.off('order_created');
      socket.off('order_updated');
      socket.off('order_deleted');
      socket.emit('leaveBusiness', businessId);
    };
  }, [businessId]);

  // Status styles, labels, and emojis
  const statusStyles = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    inProgress: 'bg-blue-100 text-blue-800 border-blue-200',
    completed: 'bg-green-100 text-green-800 border-green-200'
  };
  
  const statusLabels = {
    pending: 'Pendiente',
    inProgress: 'En Proceso',
    completed: 'Finalizado'
  };

  const orderTypeEmojis = {
    inSite: '🍽️ Mesa',
    takeaway: '🥡 Para llevar',
    delivery: '🛵 Delivery'
  };

  // Format time
  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading && orders.length === 0) {
    return (
      <div className="flex justify-center items-center h-full p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-800"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        <p>{error}</p>
        <button 
          onClick={fetchOrders} 
          className="mt-2 bg-red-100 px-3 py-1 rounded-md hover:bg-red-200"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Pantalla de Cocina</h1>
            <p className="text-sm text-gray-600 mt-1">Solo se muestran pedidos enviados desde el panel de administración</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-lg">{businessConfig.businessName}</div>
              <div className="text-sm text-gray-600">{formatTime(currentTime)}</div>
            </div>
            {/* Connection status indicator */}
            <div className="flex items-center">
              <span className={`inline-block w-3 h-3 rounded-full mr-2 ${socketConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span className="text-sm text-gray-600">{socketConnected ? 'Conectado' : 'Desconectado'}</span>
            </div>
            {/* Refresh button */}
            <button 
              onClick={fetchOrders}
              className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-md flex items-center"
              disabled={loading}
            >
              {loading ? (
                <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full mr-2"></div>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              Actualizar
            </button>
          </div>
        </div>
        
        {/* Last updated indicator */}
        <div className="text-sm text-gray-500 mb-4 text-right">
          Última actualización: {formatTime(lastUpdated)}
        </div>

        {orders.length === 0 ? (
          <div className="bg-white shadow-sm rounded-lg p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 text-5xl">👨‍🍳</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No hay pedidos en este momento</h2>
            <p className="text-gray-500">Los pedidos aparecerán aquí cuando se envíen desde el panel de administración</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {orders.map(order => (
              <div key={order._id} className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
                {/* Encabezado del pedido */}
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-lg font-bold text-gray-800">Orden #{order.orderNumber}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyles[order.status]}`}>
                        {statusLabels[order.status]}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-600">
                      {order.orderType === 'inSite' ? (
                        <span>{orderTypeEmojis.inSite} {order.tableNumber}</span>
                      ) : (
                        <span>{orderTypeEmojis[order.orderType]}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-800">{order.customerName}</p>
                  </div>
                </div>
                
                {/* Items del pedido */}
                <div className="p-4">
                  <ul className="space-y-2">
                    {order.items.map((item, index) => (
                      <li key={index} className="border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                        <div className="flex justify-between">
                          <div className="flex items-start">
                            <span className="inline-flex items-center justify-center w-6 h-6 mr-2 bg-gray-200 text-gray-700 rounded-full text-sm font-medium">
                              {item.quantity}
                            </span>
                            <span className="font-medium">{item.name}</span>
                          </div>
                        </div>
                        {/* Mostrar toppings si existen */}
                        {item.selectedToppings && item.selectedToppings.length > 0 && (
                          <ul className="ml-8 mt-1 text-sm text-gray-600 space-y-1">
                            {item.selectedToppings.map((topping, idx) => (
                              <li key={idx} className="flex">
                                <span className="text-gray-400 mr-1">•</span>
                                <span>{topping.optionName}</span>
                                {topping.subGroups && topping.subGroups.length > 0 && (
                                  <ul className="ml-4">
                                    {topping.subGroups.map((subTopping, subIdx) => (
                                      <li key={subIdx} className="flex">
                                        <span className="text-gray-400 mr-1">-</span>
                                        <span>{subTopping.optionName}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                
                {/* Botones de acción */}
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex space-x-2">
                  {order.status === 'pending' && (
                    <button
                      onClick={() => updateOrderStatus(order._id, 'inProgress')}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md transition-colors"
                    >
                      Iniciar Preparación
                    </button>
                  )}
                  {order.status === 'inProgress' && (
                    <button
                      onClick={() => updateOrderStatus(order._id, 'completed')}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md transition-colors"
                    >
                      Pedido Listo
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Kitchen; 