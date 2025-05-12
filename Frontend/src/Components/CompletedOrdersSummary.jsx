import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';
import { socket } from '../services/socket';

function CompletedOrdersSummary() {
  const [completedOrders, setCompletedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const { businessConfig, businessId } = useBusinessConfig();
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalAmount: 0,
    ordersByType: {
      inSite: { count: 0, total: 0 },
      takeaway: { count: 0, total: 0 },
      delivery: { count: 0, total: 0 }
    }
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [showNoOrdersModal, setShowNoOrdersModal] = useState(false);

  // Fetch completed orders for today
  const fetchCompletedOrders = async () => {
    setLoading(true);
    try {
      // Obtener la fecha de hoy en formato ISO (YYYY-MM-DD)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const response = await api.post('/orders/daily-closing', { 
        businessId: businessId
      });
      
      // Actualizar los pedidos y estadísticas
      if (response.data && response.data.orders) {
        setCompletedOrders(response.data.orders);
        
        // Actualizar estadísticas
        if (response.data.stats) {
          setStats(response.data.stats);
        }
      } else {
        setCompletedOrders([]);
        setStats({
          totalOrders: 0,
          totalAmount: 0,
          ordersByType: {
            inSite: { count: 0, total: 0 },
            takeaway: { count: 0, total: 0 },
            delivery: { count: 0, total: 0 }
          }
        });
      }
      
      setError(null);
    } catch (err) {
      console.error('Error fetching completed orders:', err);
      setError('No se pudieron cargar los pedidos completados');
      setCompletedOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // Calcular tiempo transcurrido desde la creación del pedido
  const calculateTimeElapsed = (createdAt, completedAt) => {
    const start = new Date(createdAt);
    const end = new Date(completedAt || Date.now());
    const diffMs = end - start;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);
    
    if (diffHrs > 0) {
      return `${diffHrs}h ${diffMins % 60}m`;
    }
    return `${diffMins}m`;
  };

  // Efecto para cargar los pedidos completados cuando cambia el businessId
  useEffect(() => {
    if (!businessId) return;
    
    fetchCompletedOrders();
    
    // Escuchar eventos de socket para actualizaciones de pedidos completados
    if (!socket.connected) {
      socket.connect();
    }
    
    socket.emit('joinBusiness', businessId);
    
    // Cuando un pedido cambia a completado, actualizar la lista
    socket.on('order_updated', (updatedOrder) => {
      if (updatedOrder.status === 'completed') {
        // Recargar todos los pedidos para tener estadísticas actualizadas
        fetchCompletedOrders();
      }
    });
    
    // Limpieza al desmontar
    return () => {
      socket.off('order_updated');
    };
  }, [businessId]);

  // Mostrar detalles de un pedido
  const showOrderDetails = (order) => {
    console.log('Mostrando detalles del pedido:', order); // Debug log
    setSelectedOrder(order);
    setOrderDetails(order);
  };

  // Modal de detalles del pedido
  const OrderDetailsModal = () => {
    if (!selectedOrder) return null;
    
    console.log('Renderizando modal con pedido:', selectedOrder); // Debug log
    
    // Formatear la fecha correctamente
    const formattedDate = selectedOrder.completedAt 
      ? new Date(selectedOrder.completedAt).toLocaleString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : new Date(selectedOrder.createdAt).toLocaleString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Detalles del Pedido #{selectedOrder.orderNumber}
                </h2>
                <p className="mt-1 text-gray-600">
                  {formattedDate}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedOrder(null);
                  setOrderDetails(null);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Información del Cliente</h3>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Nombre</p>
                    <p className="mt-1">{selectedOrder.customerName || 'No especificado'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Teléfono</p>
                    <p className="mt-1">{selectedOrder.phone || 'No especificado'}</p>
                  </div>
                  {selectedOrder.orderType === 'delivery' && (
                    <div className="sm:col-span-2">
                      <p className="text-sm font-medium text-gray-500">Dirección</p>
                      <p className="mt-1">{selectedOrder.address}</p>
                    </div>
                  )}
                  {selectedOrder.tableNumber && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Mesa</p>
                      <p className="mt-1">#{selectedOrder.tableNumber}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-500">Tipo de Pedido</p>
                    <p className="mt-1">
                      {selectedOrder.orderType === 'delivery' ? 'Delivery' :
                       selectedOrder.orderType === 'takeaway' ? 'Para llevar' : 'En sitio'}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900">Productos</h3>
                <div className="mt-4 space-y-4">
                  {selectedOrder.items && selectedOrder.items.map((item, index) => (
                    <div key={index} className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {item.quantity}x {item.name}
                          </p>
                          {item.selectedToppings && item.selectedToppings.length > 0 && (
                            <ul className="mt-1 space-y-1">
                              {item.selectedToppings.map((topping, idx) => (
                                <li key={idx} className="text-sm text-gray-500">
                                  • {topping.groupName}: {topping.optionName}
                                  {topping.price > 0 && ` (+$${topping.price.toFixed(2)})`}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-900">
                          ${(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex justify-between items-center border-t border-gray-200 pt-4">
                  <p className="text-base font-medium text-gray-900">Total</p>
                  <p className="text-lg font-bold text-gray-900">
                    ${selectedOrder.totalAmount.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Tarjeta de pedido
  const OrderCard = ({ order }) => {
    // Obtener el tipo de pedido en español
    const orderTypeLabels = {
      'inSite': 'En Sitio',
      'takeaway': 'Para Llevar',
      'delivery': 'A Domicilio'
    };
    
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
          <div className="text-sm font-medium">
            #{order.orderNumber}
          </div>
        </div>
        <div className="flex justify-between items-center mt-2">
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
              Completado
            </span>
            {order.includedInReport && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                En reporte
              </span>
            )}
            <span className="text-xs text-gray-500">
              {calculateTimeElapsed(order.createdAt, order.completedAt)}
            </span>
          </div>
          <div className="text-sm font-medium">
            ${order.totalAmount.toFixed(2)}
          </div>
        </div>
      </div>
    );
  };

  // Filtrar órdenes basado en el término de búsqueda
  const filteredOrders = completedOrders.filter(order => 
    searchTerm 
      ? order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.orderNumber.toString().includes(searchTerm)
      : true
  );

  // Nueva función para cierre del día (basada en OrdersDashboard)
  const generateDailyClosingReport = async () => {
    try {
      setGeneratingReport(true);
      const currentPath = window.location.pathname;
      const match = currentPath.match(/^\/([^/]+)/);
      const businessSlug = match ? match[1] : businessId;
      const response = await api.post('/orders/daily-closing', {
        businessId: businessSlug || businessId
      });
      setCompletedOrders(response.data.orders || []);
      if (response.data.stats) {
        setStats(response.data.stats);
      }
      alert('Cierre del día generado correctamente.');
    } catch (err) {
      console.error('Error generating daily closing report:', err);
      let errorMessage = 'Error al generar el reporte de cierre diario';
      if (err.response) {
        if (err.response.status === 404) {
          setShowNoOrdersModal(true);
          return;
        } else if (err.response.data && err.response.data.message) {
          errorMessage = `Error: ${err.response.data.message}`;
        }
      } else if (err.request) {
        errorMessage = 'No se recibió respuesta del servidor. Verifica tu conexión.';
      }
      alert(errorMessage);
    } finally {
      setGeneratingReport(false);
    }
  };

  // Renderizado del componente
  return (
    <div className="space-y-6">
      {/* Filtros y estadísticas */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-700">Total de Pedidos</h3>
            <p className="text-3xl font-bold text-blue-800 mt-2">{completedOrders.length}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-green-700">Ventas Totales</h3>
            <p className="text-3xl font-bold text-green-800 mt-2">
              ${completedOrders.reduce((sum, order) => sum + order.totalAmount, 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-purple-700">Promedio por Pedido</h3>
            <p className="text-3xl font-bold text-purple-800 mt-2">
              ${(completedOrders.reduce((sum, order) => sum + order.totalAmount, 0) / (completedOrders.length || 1)).toFixed(2)}
            </p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-yellow-700">Productos Vendidos</h3>
            <p className="text-3xl font-bold text-yellow-800 mt-2">
              {completedOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Tabla de pedidos completados */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Pedidos Completados del Día</h2>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <input
                  type="text"
                  placeholder="Buscar pedido..."
                  className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <svg className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              {/* Botón de cierre del día reemplazando al de generar reporte */}
              <button
                onClick={generateDailyClosingReport}
                disabled={generatingReport}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 w-full sm:w-auto"
              >
                {generatingReport ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    <span>Generando...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Cierre del Día</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Pedido #
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Cliente
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Tipo
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Mesa/Dirección
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Total
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Hora
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.map((order) => (
                <tr key={order._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    #{order.orderNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {order.customerName || 'Cliente sin nombre'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      order.orderType === 'delivery' 
                        ? 'bg-purple-100 text-purple-800'
                        : order.orderType === 'takeaway'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {order.orderType === 'delivery' 
                        ? 'Delivery'
                        : order.orderType === 'takeaway'
                        ? 'Para llevar'
                        : 'En sitio'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {order.orderType === 'delivery' 
                      ? order.address
                      : order.orderType === 'inSite'
                      ? `Mesa ${order.tableNumber}`
                      : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                    ${order.totalAmount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(order.completedAt).toLocaleTimeString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => showOrderDetails(order)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Ver detalles
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de detalles del pedido */}
      {selectedOrder && (
        <OrderDetailsModal />
      )}
      {/* Modal de no hay pedidos completados */}
      {showNoOrdersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-6 text-center">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">No hay pedidos completados</h3>
            <p className="text-gray-600 mb-6">No hay pedidos completados para generar el reporte de cierre del día.</p>
            <button
              onClick={() => setShowNoOrdersModal(false)}
              className="w-full py-2 rounded-lg text-white font-medium bg-blue-600 hover:bg-blue-700 shadow-sm"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Función auxiliar para calcular el tiempo promedio de preparación
function calculateAveragePreparationTime(orders) {
  if (!orders || orders.length === 0) return 'N/A';
  
  let totalMinutes = 0;
  const ordersWithComplete = orders.filter(order => order.completedAt && order.createdAt);
  
  if (ordersWithComplete.length === 0) return 'N/A';
  
  ordersWithComplete.forEach(order => {
    const start = new Date(order.createdAt);
    const end = new Date(order.completedAt);
    const diffMs = end - start;
    const diffMins = Math.floor(diffMs / 60000);
    totalMinutes += diffMins;
  });
  
  const avgMinutes = Math.floor(totalMinutes / ordersWithComplete.length);
  
  if (avgMinutes >= 60) {
    const hours = Math.floor(avgMinutes / 60);
    const minutes = avgMinutes % 60;
    return `${hours}h ${minutes}m`;
  }
  
  return `${avgMinutes}m`;
}

export default CompletedOrdersSummary; 