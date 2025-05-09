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

  // Format time function
  const formatTime = (date) => {
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Fetch orders from the API
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/orders?businessId=${businessId}`);
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

  // Update order status
  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await api.put(`/orders/${orderId}/status`, { status: newStatus });
      setOrders(prevOrders => 
        prevOrders.filter(order => order._id !== orderId)
      );
    } catch (err) {
      console.error('Error updating order status:', err);
    }
  };

  // Set up socket connection for real-time updates
  useEffect(() => {
    if (!businessId) return;
    
    // Handle socket connection status
    const handleConnect = () => {
      console.log('Socket connected');
      setSocketConnected(true);
      socket.emit('joinBusiness', businessId);
    };
    
    const handleDisconnect = () => {
      console.log('Socket disconnected');
      setSocketConnected(false);
    };
    
    if (!socket.connected) {
      socket.connect();
    }
    
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setSocketConnected(false);
    });
    
    socket.on('order_created', (newOrder) => {
      if (newOrder.sentToKitchen && (newOrder.status === 'pending' || newOrder.status === 'inProgress')) {
        setOrders(prevOrders => [newOrder, ...prevOrders]);
        setLastUpdated(new Date());
      }
    });
    
    socket.on('order_updated', (updatedOrder) => {
      setOrders(prevOrders => {
        if (updatedOrder.sentToKitchen && (updatedOrder.status === 'pending' || updatedOrder.status === 'inProgress')) {
          return prevOrders.map(order => 
            order._id === updatedOrder._id ? updatedOrder : order
          );
        }
        return prevOrders.filter(order => order._id !== updatedOrder._id);
      });
      setLastUpdated(new Date());
    });
    
    socket.on('order_deleted', (deletedOrder) => {
      setOrders(prevOrders => 
        prevOrders.filter(order => order._id !== deletedOrder._id)
      );
      setLastUpdated(new Date());
    });
    
    fetchOrders();
    
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

  // Status styles and labels
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

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Pantalla de Cocina</h1>
            <p className="text-sm text-gray-600 mt-1">Solo se muestran pedidos enviados desde el panel de administración</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
            <div className="text-right">
              <div className="text-lg font-medium">{businessConfig.businessName}</div>
              <div className="text-sm text-gray-600">{formatTime(currentTime)}</div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className={`inline-block w-3 h-3 rounded-full ${socketConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span className="text-sm text-gray-600">{socketConnected ? 'Conectado' : 'Desconectado'}</span>
            </div>
            
            <button 
              onClick={fetchOrders}
              className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-lg flex items-center justify-center w-full sm:w-auto"
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

        {/* Orders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {orders.map(order => (
            <div
              key={order._id}
              className="bg-white rounded-xl shadow-md overflow-hidden border-t-4 border-yellow-400"
            >
              {/* Order Header */}
              <div className="p-4 bg-gray-50">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      Pedido #{order.orderNumber}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {new Date(order.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-gray-900">
                      ${order.total}
                    </span>
                  </div>
                </div>
                
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`px-2 py-1 rounded-full text-sm ${statusStyles[order.status]}`}>
                    {statusLabels[order.status]}
                  </span>
                  <span className="px-2 py-1 rounded-full text-sm bg-gray-100 text-gray-800">
                    {orderTypeEmojis[order.orderType]}
                    {order.tableNumber && ` - Mesa ${order.tableNumber}`}
                  </span>
                </div>
              </div>

              {/* Order Items */}
              <div className="p-4">
                <div className="space-y-3">
                  {order.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-start">
                          <span className="text-lg font-bold text-gray-900 mr-2">
                            {item.quantity}x
                          </span>
                          <div>
                            <p className="font-medium text-gray-900">{item.name}</p>
                            {item.notes && (
                              <p className="text-sm text-gray-600 mt-1">
                                Notas: {item.notes}
                              </p>
                            )}
                            {item.selectedToppings && Object.keys(item.selectedToppings).length > 0 && (
                              <div className="mt-1">
                                {Object.entries(item.selectedToppings).map(([group, toppings], idx) => (
                                  <p key={idx} className="text-sm text-gray-600">
                                    {group}: {Array.isArray(toppings) ? toppings.join(', ') : toppings}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Actions */}
              <div className="p-4 bg-gray-50 border-t">
                <div className="flex flex-col sm:flex-row gap-2">
                  {order.status === 'pending' && (
                    <button
                      onClick={() => updateOrderStatus(order._id, 'inProgress')}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Iniciar Preparación
                    </button>
                  )}
                  {order.status === 'inProgress' && (
                    <button
                      onClick={() => updateOrderStatus(order._id, 'completed')}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Marcar Completado
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {orders.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">👨‍🍳</div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">
              No hay pedidos pendientes
            </h3>
            <p className="text-gray-600">
              Los nuevos pedidos aparecerán aquí automáticamente
            </p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default Kitchen; 