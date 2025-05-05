import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { socket } from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';

function OrdersDashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const { businessConfig, businessId } = useBusinessConfig();
  
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
  
  // Fetch orders from the API
  const fetchOrders = async () => {
    setLoading(true);
    try {
      console.log('Fetching orders for business:', businessId);
      const response = await api.get(`/orders?businessId=${businessId}`);
      setOrders(response.data);
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
      // The socket will automatically update the orders list
      setSelectedOrder(null);
      setOrderDetails(null);
    } catch (err) {
      console.error('Error updating order status:', err);
      alert('Error al actualizar el estado del pedido');
    }
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
    
    // Connect to socket if not already connected
    if (!socket.connected) {
      socket.connect();
    }
    
    // Join the business room
    socket.emit('joinBusiness', businessId);
    
    // Listen for order events
    socket.on('order_created', (newOrder) => {
      console.log('New order received:', newOrder);
      setOrders(prevOrders => [newOrder, ...prevOrders]);
    });
    
    socket.on('order_updated', (updatedOrder) => {
      console.log('Order updated:', updatedOrder);
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order._id === updatedOrder._id ? updatedOrder : order
        )
      );
      
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
      
      // Close details if the deleted order was selected
      if (selectedOrder === deletedOrder._id) {
        setSelectedOrder(null);
        setOrderDetails(null);
      }
    });
    
    // Fetch initial orders
    fetchOrders();
    
    // Cleanup on unmount
    return () => {
      socket.off('order_created');
      socket.off('order_updated');
      socket.off('order_deleted');
      socket.emit('leaveBusiness', businessId);
      // Don't disconnect as other components might be using the socket
    };
  }, [businessId, selectedOrder]);
  
  // Status label styles
  const statusStyles = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    inProgress: 'bg-blue-100 text-blue-800 border-blue-200',
    completed: 'bg-green-100 text-green-800 border-green-200'
  };
  
  // Status labels
  const statusLabels = {
    pending: 'Pendiente',
    inProgress: 'En Proceso',
    completed: 'Finalizado'
  };
  
  // Group orders by status
  const ordersByStatus = {
    pending: orders.filter(order => order.status === 'pending'),
    inProgress: orders.filter(order => order.status === 'inProgress'),
    completed: orders.filter(order => order.status === 'completed')
  };
  
  if (loading) {
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
  
  // Order details modal
  const OrderDetailsModal = () => {
    if (!orderDetails) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="border-b p-4 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold">
                Orden #{orderDetails.orderNumber}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${statusStyles[orderDetails.status]}`}>
                  {statusLabels[orderDetails.status]}
                </span>
                <span className="text-sm text-gray-500">
                  Tiempo: {calculateTimeElapsed(orderDetails.createdAt)}
                </span>
              </div>
            </div>
            <button 
              onClick={() => {
                setSelectedOrder(null);
                setOrderDetails(null);
              }}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Customer info */}
          <div className="p-4 border-b">
            <h4 className="font-medium mb-2">Información del Cliente</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600">Cliente:</span> {orderDetails.customerName}
              </div>
              {orderDetails.orderType === 'inSite' && (
                <div>
                  <span className="text-gray-600">Mesa:</span> {orderDetails.tableNumber}
                </div>
              )}
              {orderDetails.orderType === 'delivery' && (
                <>
                  <div>
                    <span className="text-gray-600">Teléfono:</span> {orderDetails.phone}
                  </div>
                  <div>
                    <span className="text-gray-600">Dirección:</span> {orderDetails.address}
                  </div>
                </>
              )}
              <div>
                <span className="text-gray-600">Tipo:</span> {
                  {
                    'inSite': 'En Sitio',
                    'takeaway': 'Para Llevar',
                    'delivery': 'A Domicilio'
                  }[orderDetails.orderType]
                }
              </div>
            </div>
          </div>
          
          {/* Items */}
          <div className="p-4 border-b">
            <h4 className="font-medium mb-2">Productos</h4>
            <div className="space-y-2">
              {orderDetails.items.map((item, index) => (
                <div key={index} className="border rounded-md p-2">
                  <div className="flex justify-between">
                    <span className="font-medium">{item.quantity}x {item.name}</span>
                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                  
                  {/* Toppings */}
                  {item.selectedToppings && item.selectedToppings.length > 0 && (
                    <div className="mt-1 pl-4 text-sm text-gray-600">
                      {item.selectedToppings.map((topping, idx) => (
                        <div key={idx}>
                          <div className="flex flex-wrap">
                            <span className="font-medium">{topping.groupName}</span>
                            {topping.basePrice > 0 && 
                              <span className="text-gray-500 ml-1">
                                (+${Number(topping.basePrice).toFixed(2)})
                              </span>
                            }:
                            {topping.optionName && (
                              <span className="ml-1">
                                {topping.optionName}
                                {topping.price > 0 && 
                                  <span className="text-gray-500 ml-1">
                                    (+${Number(topping.price).toFixed(2)})
                                  </span>
                                }
                              </span>
                            )}
                          </div>
                          
                          {/* Subgroups */}
                          {topping.subGroups && topping.subGroups.length > 0 && (
                            <div className="pl-4 mt-1">
                              {topping.subGroups.map((sub, subIdx) => (
                                <div key={subIdx}>
                                  <span className="font-medium">{sub.subGroupTitle}:</span>
                                  <span className="ml-1">
                                    {sub.optionName}
                                    {sub.price > 0 && 
                                      <span className="text-gray-500 ml-1">
                                        (+${Number(sub.price).toFixed(2)})
                                      </span>
                                    }
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Total */}
          <div className="p-4 border-b">
            <div className="flex justify-between items-center">
              <span className="font-medium text-lg">Total:</span>
              <span className="font-bold text-xl">${Number(orderDetails.totalAmount).toFixed(2)}</span>
            </div>
          </div>
          
          {/* Actions */}
          <div className="p-4 flex justify-end gap-3">
            {orderDetails.status === 'pending' && (
              <button
                onClick={() => updateOrderStatus(orderDetails._id, 'inProgress')}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Iniciar Preparación
              </button>
            )}
            
            {orderDetails.status === 'inProgress' && (
              <button
                onClick={() => updateOrderStatus(orderDetails._id, 'completed')}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
              >
                Marcar como Finalizado
              </button>
            )}
            
            <button
              onClick={() => {
                setSelectedOrder(null);
                setOrderDetails(null);
              }}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  // Order card
  const OrderCard = ({ order }) => {
    return (
      <div 
        className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => showOrderDetails(order)}
      >
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-medium">{order.customerName}</h3>
            <div className="text-sm text-gray-500 mt-1">
              {order.orderType === 'inSite' && `Mesa: ${order.tableNumber}`}
              {order.orderType === 'takeaway' && 'Para llevar'}
              {order.orderType === 'delivery' && 'A domicilio'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium">#{order.orderNumber}</div>
            <div className="text-xs text-gray-500 mt-1">
              {calculateTimeElapsed(order.createdAt)}
            </div>
          </div>
        </div>
        
        <div className="mt-2">
          <div className="text-sm text-gray-600">
            {order.items.length} productos
          </div>
          <div className="font-medium text-right mt-2">
            ${Number(order.totalAmount).toFixed(2)}
          </div>
        </div>
        
        <div className="mt-3 pt-3 border-t flex justify-between">
          <button
            className="text-sm text-blue-600 hover:text-blue-800"
            onClick={(e) => {
              e.stopPropagation();
              showOrderDetails(order);
            }}
          >
            Ver detalles
          </button>
          
          {order.status === 'pending' && (
            <button
              className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full hover:bg-blue-200"
              onClick={(e) => {
                e.stopPropagation();
                updateOrderStatus(order._id, 'inProgress');
              }}
            >
              Iniciar
            </button>
          )}
          
          {order.status === 'inProgress' && (
            <button
              className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full hover:bg-green-200"
              onClick={(e) => {
                e.stopPropagation();
                updateOrderStatus(order._id, 'completed');
              }}
            >
              Finalizar
            </button>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-6">Pedidos en Tiempo Real</h2>
      
      {orders.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No hay pedidos activos</h3>
          <p className="text-gray-500">Los nuevos pedidos aparecerán aquí automáticamente</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pending orders */}
          <div className="space-y-4">
            <h3 className="font-medium text-lg flex items-center">
              <span className="w-3 h-3 bg-yellow-400 rounded-full mr-2"></span>
              Pendientes ({ordersByStatus.pending.length})
            </h3>
            <div className="space-y-3">
              {ordersByStatus.pending.map(order => (
                <OrderCard key={order._id} order={order} />
              ))}
              {ordersByStatus.pending.length === 0 && (
                <div className="text-center p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-gray-500">No hay pedidos pendientes</p>
                </div>
              )}
            </div>
          </div>
          
          {/* In progress orders */}
          <div className="space-y-4">
            <h3 className="font-medium text-lg flex items-center">
              <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
              En Proceso ({ordersByStatus.inProgress.length})
            </h3>
            <div className="space-y-3">
              {ordersByStatus.inProgress.map(order => (
                <OrderCard key={order._id} order={order} />
              ))}
              {ordersByStatus.inProgress.length === 0 && (
                <div className="text-center p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-gray-500">No hay pedidos en proceso</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Completed orders */}
          <div className="space-y-4">
            <h3 className="font-medium text-lg flex items-center">
              <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
              Finalizados ({ordersByStatus.completed.length})
            </h3>
            <div className="space-y-3">
              {ordersByStatus.completed.map(order => (
                <OrderCard key={order._id} order={order} />
              ))}
              {ordersByStatus.completed.length === 0 && (
                <div className="text-center p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-gray-500">No hay pedidos finalizados</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Order details modal */}
      {selectedOrder && <OrderDetailsModal />}
    </div>
  );
}

export default OrdersDashboard; 