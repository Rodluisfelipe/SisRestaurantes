import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { socket } from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';
import { useNavigate } from 'react-router-dom';
import { generateDailyReportPDF } from './DailyReportPDF';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

function OrdersDashboard() {
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
      
      // Check for pending orders that need notification
      const pendingOrders = response.data.filter(order => order.status === 'pending');
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
          notificationAudioRef.current.play().catch(e => {
            console.log('Error playing notification sound:', e);
          });
        }
      };
      
      // Play immediately once
      playSound();
      
      // Set interval to play sound every 5 seconds
      notificationIntervalRef.current = setInterval(playSound, 5000);
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
      await api.patch(`/orders/${orderId}/status`, { status: newStatus });
      
      // Remove from pending notifications if status changed from 'pending'
      if (newStatus !== 'pending') {
        setPendingNotifications(prev => prev.filter(id => id !== orderId));
      }
      
      // The socket will automatically update the orders list
      setSelectedOrder(null);
      setOrderDetails(null);
    } catch (err) {
      console.error('Error updating order status:', err);
      alert('Error al actualizar el estado del pedido');
    }
  };
  
  // Cancelar un pedido
  const cancelOrder = async (orderId) => {
    try {
      if (window.confirm('¿Estás seguro de que deseas cancelar este pedido? Esta acción no se puede deshacer.')) {
        await api.delete(`/orders/${orderId}`);
        console.log('Pedido cancelado exitosamente');
        
        // El socket automáticamente actualizará la lista de pedidos
        setSelectedOrder(null);
        setOrderDetails(null);
        
        // Mostrar mensaje de éxito
        alert('Pedido cancelado exitosamente');
      }
    } catch (err) {
      console.error('Error cancelando pedido:', err);
      alert('Error al cancelar el pedido');
    }
  };
  
  // Send order to kitchen without changing status
  const sendToKitchen = async (orderId) => {
    try {
      await api.patch(`/orders/${orderId}/send-to-kitchen`);
      
      // No need to dismiss notifications or close modal
      // The socket will automatically update the orders list
    } catch (err) {
      console.error('Error sending order to kitchen:', err);
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
    
    // Asegurarse de que el socket esté conectado
    if (!socket.connected) {
      socket.connect();
    }
    
    // Manejar reconexión
    const handleReconnect = () => {
      console.log('Socket reconnected - Refetching orders');
      fetchOrders(); // Recargar pedidos al reconectar
    };
    
    // Manejar conexión inicial
    const handleConnect = () => {
      console.log('Socket connected - Joining business room');
      socket.emit('joinBusiness', businessId);
      fetchOrders(); // Cargar pedidos al conectar
    };
    
    // Manejar desconexión
    const handleDisconnect = () => {
      console.log('Socket disconnected');
    };
    
    // Registrar manejadores de eventos
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('reconnect', handleReconnect);
    
    // Manejar eventos de pedidos
    socket.on('order_created', (newOrder) => {
      console.log('New order received:', newOrder);
      if (newOrder.businessId === businessId) {
        setOrders(prevOrders => [newOrder, ...prevOrders]);
        
        // Agregar a notificaciones pendientes si es necesario
        if (newOrder.status === 'pending') {
          setPendingNotifications(prev => [...prev, newOrder._id]);
        }
      }
    });
    
    socket.on('order_updated', (updatedOrder) => {
      console.log('Order updated:', updatedOrder);
      if (updatedOrder.businessId === businessId) {
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order._id === updatedOrder._id ? updatedOrder : order
          )
        );
        
        // Actualizar notificaciones pendientes
        if (updatedOrder.status !== 'pending') {
          setPendingNotifications(prev => prev.filter(id => id !== updatedOrder._id));
        }
        
        // Actualizar detalles si es el pedido seleccionado
        if (selectedOrder === updatedOrder._id) {
          setOrderDetails(updatedOrder);
        }
      }
    });
    
    socket.on('order_deleted', (deletedOrder) => {
      console.log('Order deleted:', deletedOrder);
      if (deletedOrder.businessId === businessId) {
        setOrders(prevOrders => 
          prevOrders.filter(order => order._id !== deletedOrder._id)
        );
        
        // Limpiar notificaciones pendientes
        setPendingNotifications(prev => prev.filter(id => id !== deletedOrder._id));
        
        // Cerrar detalles si es el pedido seleccionado
        if (selectedOrder === deletedOrder._id) {
          setSelectedOrder(null);
          setOrderDetails(null);
        }
      }
    });
    
    // Fetch initial orders
    fetchOrders();
    
    // Cleanup on unmount
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnect', handleReconnect);
      socket.off('order_created');
      socket.off('order_updated');
      socket.off('order_deleted');
      socket.emit('leaveBusiness', businessId);
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
  
  // Mute/unmute notification sounds
  const [isMuted, setIsMuted] = useState(false);
  
  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (notificationAudioRef.current) {
      notificationAudioRef.current.muted = !isMuted;
    }
  };
  
  // Generate daily closing report
  const generateDailyClosingReport = async () => {
    try {
      setGeneratingReport(true);
      
      // Get current business slug from path
      const currentPath = window.location.pathname;
      const match = currentPath.match(/^\/([^/]+)/);
      const businessSlug = match ? match[1] : businessId;
      
      // Make API request with business slug or ID
      const response = await api.post('/orders/daily-closing', { 
        businessId: businessSlug || businessId 
      });
      
      setReportData(response.data);
      setShowReportModal(true);
      
      // No longer automatically generating PDF here
    } catch (err) {
      console.error('Error generating daily closing report:', err);
      let errorMessage = 'Error al generar el reporte de cierre diario';
      
      if (err.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        if (err.response.status === 404) {
          errorMessage = 'No hay pedidos completados para generar el reporte';
        } else if (err.response.data && err.response.data.message) {
          errorMessage = `Error: ${err.response.data.message}`;
        }
      } else if (err.request) {
        // The request was made but no response was received
        errorMessage = 'No se recibió respuesta del servidor. Verifica tu conexión.';
      }
      
      alert(errorMessage);
    } finally {
      setGeneratingReport(false);
    }
  };
  
  // Delete completed orders that were included in the report
  const cleanupCompletedOrders = async () => {
    try {
      if (!reportData || !reportData.orders || reportData.orders.length === 0) {
        return;
      }
      
      // Get current business slug from path
      const currentPath = window.location.pathname;
      const match = currentPath.match(/^\/([^/]+)/);
      const businessSlug = match ? match[1] : businessId;
      
      // Call API to cleanup completed orders
      await api.post('/orders/cleanup-completed', {
        businessId: businessSlug || businessId,
        orderIds: reportData.orders.map(order => order._id)
      });
      
      console.log('Completed orders have been cleaned up');
    } catch (err) {
      console.error('Error cleaning up completed orders:', err);
    }
  };
  
  // Close report modal
  const closeReportModal = async () => {
    // Cleanup completed orders before closing modal
    await cleanupCompletedOrders();
    
    setShowReportModal(false);
    setReportData(null);
    
    // Fetch orders again to refresh the list
    fetchOrders();
  };
  
  // Filter orders based on search term and status
  const filterOrders = () => {
    let filteredOrders = orders;
    
    if (searchTerm) {
      filteredOrders = filteredOrders.filter(order =>
        order.customerName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (statusFilter !== 'all') {
      filteredOrders = filteredOrders.filter(order => order.status === statusFilter);
    }
    
    return filteredOrders;
  };
  
  const filteredOrders = filterOrders();
  
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
                {orderDetails.sentToKitchen && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-200">
                    Enviado a Cocina
                  </span>
                )}
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
            <div className="space-y-3">
              {orderDetails.items.map((item, idx) => (
                <div key={idx} className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                  <div className="flex justify-between">
                    <div className="flex items-start">
                      <span className="bg-gray-200 text-gray-800 w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2 flex-shrink-0">
                        {item.quantity}
                      </span>
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <span className="text-gray-700">${Number(item.price).toFixed(2)}</span>
                  </div>
                  
                  {/* Toppings si existen */}
                  {item.selectedToppings && item.selectedToppings.length > 0 && (
                    <div className="ml-8 mt-2 text-sm text-gray-600">
                      {item.selectedToppings.map((topping, toppingIdx) => (
                        <div key={toppingIdx} className="mb-1 last:mb-0">
                          <div className="flex justify-between">
                            <span className="font-medium">{topping.groupName}:</span>
                            <span className="text-gray-500">
                              {topping.price > 0 && `+$${Number(topping.price).toFixed(2)}`}
                              </span>
                          </div>
                          <span>{topping.optionName}</span>
                          
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
          <div className="p-4 border-t flex flex-wrap justify-end gap-2">
            <button
              onClick={() => {
                setSelectedOrder(null);
                setOrderDetails(null);
              }}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
            >
              Cerrar
            </button>
            
            {/* Botón para cancelar el pedido */}
            {(orderDetails.status === 'pending' || orderDetails.status === 'inProgress') && (
              <button
                onClick={() => cancelOrder(orderDetails._id)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Cancelar Pedido
              </button>
            )}
            
            {orderDetails.status === 'pending' && !orderDetails.sentToKitchen && (
              <button
                onClick={() => sendToKitchen(orderDetails._id)}
                className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
              >
                Enviar a Cocina
              </button>
            )}
            
            {orderDetails.status === 'pending' && (
              <button
                onClick={() => updateOrderStatus(orderDetails._id, 'inProgress')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Iniciar Preparación
              </button>
            )}
            
            {orderDetails.status === 'inProgress' && (
              <button
                onClick={() => updateOrderStatus(orderDetails._id, 'completed')}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Finalizar Pedido
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };
  
  // Report modal component
  const ReportModal = () => {
    if (!reportData) return null;
    
    const { stats, orders, reportDate } = reportData;
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = new Date(reportDate).toLocaleDateString('es-ES', dateOptions);
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="border-b p-4 flex justify-between items-center bg-gray-50">
          <div>
              <h3 className="text-xl font-bold">Reporte de Cierre Diario</h3>
              <p className="text-sm text-gray-600">Fecha: {formattedDate}</p>
            </div>
            <button 
              onClick={closeReportModal}
              className="p-2 rounded-full hover:bg-gray-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Summary */}
          <div className="p-6">
            <div className="mb-8">
              <h4 className="text-lg font-semibold mb-4">Resumen de Ventas</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <p className="text-sm text-blue-600">Total Pedidos</p>
                  <p className="text-2xl font-bold">{stats.totalOrders}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                  <p className="text-sm text-green-600">Ventas Totales</p>
                  <p className="text-2xl font-bold">${stats.totalSales.toFixed(2)}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                  <p className="text-sm text-purple-600">Pedidos Incluidos</p>
                  <p className="text-2xl font-bold">{orders.length}</p>
            </div>
          </div>
        </div>
        
            {/* Orders by type */}
            <div className="mb-8">
              <h4 className="text-lg font-semibold mb-4">Ventas por Tipo de Pedido</h4>
              <div className="bg-white border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap">En Sitio</td>
                      <td className="px-6 py-4 whitespace-nowrap">{stats.ordersByType.inSite.count}</td>
                      <td className="px-6 py-4 whitespace-nowrap">${stats.ordersByType.inSite.total.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap">Para Llevar</td>
                      <td className="px-6 py-4 whitespace-nowrap">{stats.ordersByType.takeaway.count}</td>
                      <td className="px-6 py-4 whitespace-nowrap">${stats.ordersByType.takeaway.total.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap">A Domicilio</td>
                      <td className="px-6 py-4 whitespace-nowrap">{stats.ordersByType.delivery.count}</td>
                      <td className="px-6 py-4 whitespace-nowrap">${stats.ordersByType.delivery.total.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
          </div>
        </div>
        
            {/* Top selling items */}
            {stats.topSellingItems && stats.topSellingItems.length > 0 && (
              <div className="mb-8">
                <h4 className="text-lg font-semibold mb-4">Productos Más Vendidos</h4>
                <div className="bg-white border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {stats.topSellingItems.map((item, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap">{item.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{item.count}</td>
                          <td className="px-6 py-4 whitespace-nowrap">${item.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* Actions */}
            <div className="mt-8 flex justify-end space-x-3">
            <button
                onClick={closeReportModal}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cerrar
            </button>
            <button
                onClick={async () => {
                  try {
                    await generateDailyReportPDF(reportData, businessConfig);
                    await cleanupCompletedOrders();
                    setShowReportModal(false);
                    setReportData(null);
                    fetchOrders();
                  } catch (error) {
                    console.error('Error al generar PDF:', error);
                    alert('Error al generar el PDF. Por favor intente nuevamente.');
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Descargar PDF
            </button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="w-full">
      {/* Header con controles */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="w-full md:w-auto">
          <h2 className="text-2xl font-bold text-gray-800">Pedidos</h2>
          <p className="text-sm text-gray-600">Gestiona los pedidos activos</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <button
            onClick={goToKitchenScreen}
            className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors w-full sm:w-auto"
          >
            <span className="mr-2">🖥️</span>
            Pantalla de Cocina
          </button>
          
          <button
            onClick={toggleMute}
            className="flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors w-full sm:w-auto"
          >
            {isMuted ? '🔇' : '🔊'} {isMuted ? 'Activar Sonido' : 'Silenciar'}
          </button>
        </div>
      </div>

      {/* Grid de estados de pedidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Columna de Pendientes */}
        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-yellow-800">
              Pendientes ({ordersByStatus.pending.length})
            </h3>
          </div>
          <div className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
            {ordersByStatus.pending.map(order => (
              <OrderCard
                key={order._id}
                order={order}
                onStatusChange={updateOrderStatus}
                onSelect={() => showOrderDetails(order)}
                isSelected={selectedOrder === order._id}
                statusStyles={statusStyles}
                statusLabels={statusLabels}
                className="hover:shadow-lg transition-shadow"
              />
            ))}
            {ordersByStatus.pending.length === 0 && (
              <p className="text-center text-gray-500 py-4">No hay pedidos pendientes</p>
            )}
          </div>
        </div>

        {/* Columna En Proceso */}
        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-blue-800">
              En Proceso ({ordersByStatus.inProgress.length})
            </h3>
          </div>
          <div className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
            {ordersByStatus.inProgress.map(order => (
              <OrderCard
                key={order._id}
                order={order}
                onStatusChange={updateOrderStatus}
                onSelect={() => showOrderDetails(order)}
                isSelected={selectedOrder === order._id}
                statusStyles={statusStyles}
                statusLabels={statusLabels}
                className="hover:shadow-lg transition-shadow"
              />
            ))}
            {ordersByStatus.inProgress.length === 0 && (
              <p className="text-center text-gray-500 py-4">No hay pedidos en proceso</p>
            )}
          </div>
        </div>

        {/* Columna Completados */}
        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-green-800">
              Completados ({ordersByStatus.completed.length})
            </h3>
          </div>
          <div className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
            {ordersByStatus.completed.map(order => (
              <OrderCard
                key={order._id}
                order={order}
                onStatusChange={updateOrderStatus}
                onSelect={() => showOrderDetails(order)}
                isSelected={selectedOrder === order._id}
                statusStyles={statusStyles}
                statusLabels={statusLabels}
                className="hover:shadow-lg transition-shadow"
              />
            ))}
            {ordersByStatus.completed.length === 0 && (
              <p className="text-center text-gray-500 py-4">No hay pedidos completados</p>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Detalles del Pedido */}
      {orderDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Detalles del Pedido
                  </h3>
                  <p className="text-sm text-gray-600">
                    ID: {orderDetails._id}
                  </p>
                </div>
                <button
                  onClick={() => setOrderDetails(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                {/* Información del Cliente */}
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Cliente</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">
                      Mesa: {orderDetails.tableNumber || 'N/A'}
                    </p>
                    <p className="text-sm text-gray-600">
                      Tipo: {
                        {
                          'inSite': 'En Sitio',
                          'takeaway': 'Para Llevar',
                          'delivery': 'A Domicilio'
                        }[orderDetails.orderType]
                      }
                    </p>
                  </div>
                </div>

                {/* Items del Pedido */}
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Items</h4>
                  <div className="space-y-3">
                    {orderDetails.items.map((item, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-800">{item.name}</p>
                            <p className="text-sm text-gray-600">
                              Cantidad: {item.quantity}
                            </p>
                            {item.notes && (
                              <p className="text-sm text-gray-600">
                                Notas: {item.notes}
                              </p>
                            )}
                          </div>
                          <p className="font-medium text-gray-800">
                            ${item.price * item.quantity}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total */}
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center">
                    <p className="font-semibold text-gray-800">Total</p>
                    <p className="font-bold text-xl text-gray-900">
                      ${orderDetails.total}
                    </p>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                  {orderDetails.status !== 'completed' && (
                    <button
                      onClick={() => updateOrderStatus(orderDetails._id, 'completed')}
                      className="w-full sm:w-auto px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Marcar como Completado
                    </button>
                  )}
                  <button
                    onClick={() => setOrderDetails(null)}
                    className="w-full sm:w-auto px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrdersDashboard; 