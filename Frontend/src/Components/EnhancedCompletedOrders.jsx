import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';
import { socket } from '../services/socket';
import { logSystem } from '../utils/systemLogger';

function EnhancedCompletedOrders() {
  const [completedOrders, setCompletedOrders] = useState([]);
  const [allTimeOrders, setAllTimeOrders] = useState([]);
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
  const [viewMode, setViewMode] = useState('today'); // 'today' or 'all'
  const [topSellingItems, setTopSellingItems] = useState([]);
  const [insights, setInsights] = useState([]);

  // Fetch completed orders for today
  const fetchCompletedOrders = async () => {
    setLoading(true);
    try {
      const response = await api.post('/orders/daily-closing', { 
        businessId: businessId
      });
      
      if (response.data && response.data.orders) {
        setCompletedOrders(response.data.orders);
        
        if (response.data.stats) {
          setStats(response.data.stats);
          setTopSellingItems(response.data.stats.topSellingItems || []);
          generateInsights(response.data.stats, response.data.orders);
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
        setTopSellingItems([]);
        setInsights([]);
      }
      
      setError(null);
    } catch (err) {
      logSystem('Error fetching completed orders: ' + err.message, 'error');
      setError('No se pudieron cargar los pedidos completados');
      setCompletedOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all completed orders (for historical view)
  const fetchAllCompletedOrders = async () => {
    try {
      const response = await api.get(`/orders/completed?businessId=${businessId}`);
      if (response.data) {
        setAllTimeOrders(response.data);
      }
    } catch (err) {
      logSystem('Error fetching all completed orders: ' + err.message, 'error');
    }
  };

  // Generate insights and recommendations
  const generateInsights = (stats, orders) => {
    const newInsights = [];
    
    // Insight 1: Total sales performance
    if (stats.totalSales > 0) {
      if (stats.totalSales > 1000000) { // > $1M COP
        newInsights.push({
          type: 'success',
          icon: '🎉',
          title: '¡Excelente día!',
          message: `Has generado $${stats.totalSales.toLocaleString()} en ventas. ¡Sigue así!`,
          recommendation: 'Considera ofrecer promociones especiales para mantener este momentum.'
        });
      } else if (stats.totalSales > 500000) { // > $500K COP
        newInsights.push({
          type: 'good',
          icon: '👍',
          title: 'Buen día de ventas',
          message: `Has generado $${stats.totalSales.toLocaleString()} en ventas.`,
          recommendation: 'Podrías mejorar promocionando tus productos más populares.'
        });
      } else {
        newInsights.push({
          type: 'info',
          icon: '💡',
          title: 'Oportunidad de mejora',
          message: `Has generado $${stats.totalSales.toLocaleString()} en ventas.`,
          recommendation: 'Considera ofrecer combos o promociones para aumentar el ticket promedio.'
        });
      }
    }

    // Insight 2: Order type analysis
    const totalOrders = stats.ordersByType.inSite.count + stats.ordersByType.takeaway.count + stats.ordersByType.delivery.count;
    if (totalOrders > 0) {
      const deliveryPercentage = (stats.ordersByType.delivery.count / totalOrders) * 100;
      if (deliveryPercentage > 60) {
        newInsights.push({
          type: 'info',
          icon: '🚚',
          title: 'Alto volumen de delivery',
          message: `${deliveryPercentage.toFixed(1)}% de tus pedidos son a domicilio.`,
          recommendation: 'Considera optimizar tus rutas de delivery o implementar un sistema de delivery propio.'
        });
      }
    }

    // Insight 3: Average order value
    const avgOrderValue = stats.totalSales / (stats.totalOrders || 1);
    if (avgOrderValue > 50000) {
      newInsights.push({
        type: 'success',
        icon: '💰',
        title: 'Ticket promedio excelente',
        message: `Tu ticket promedio es de $${avgOrderValue.toLocaleString()}.`,
        recommendation: '¡Excelente! Los clientes están comprando productos de alto valor.'
      });
    } else if (avgOrderValue < 25000) {
      newInsights.push({
        type: 'warning',
        icon: '📈',
        title: 'Oportunidad de aumentar ticket promedio',
        message: `Tu ticket promedio es de $${avgOrderValue.toLocaleString()}.`,
        recommendation: 'Ofrece combos, bebidas o postres para aumentar el valor por pedido.'
      });
    }

    // Insight 4: Top selling items
    if (topSellingItems.length > 0) {
      const topItem = topSellingItems[0];
      newInsights.push({
        type: 'success',
        icon: '🏆',
        title: 'Producto estrella',
        message: `"${topItem.name}" es tu producto más vendido con ${topItem.count} unidades.`,
        recommendation: 'Asegúrate de tener suficiente stock y considera crear variaciones de este producto.'
      });
    }

    // Insight 5: Time-based insights
    const now = new Date();
    const hour = now.getHours();
    if (hour >= 12 && hour <= 14) {
      newInsights.push({
        type: 'info',
        icon: '🍽️',
        title: 'Hora pico del almuerzo',
        message: 'Estás en la hora pico del almuerzo.',
        recommendation: 'Asegúrate de tener suficiente personal y productos preparados.'
      });
    } else if (hour >= 18 && hour <= 20) {
      newInsights.push({
        type: 'info',
        icon: '🌅',
        title: 'Hora pico de la cena',
        message: 'Estás en la hora pico de la cena.',
        recommendation: 'Prepara tu cocina para el aumento de pedidos.'
      });
    }

    setInsights(newInsights);
  };

  // Effect to load orders when businessId changes
  useEffect(() => {
    if (!businessId) return;
    
    fetchCompletedOrders();
    fetchAllCompletedOrders();
    
    // Socket connection for real-time updates
    if (socket && !socket.connected) {
      socket.connect();
    }
    
    if (socket) {
      socket.emit('joinBusiness', businessId);
      
      socket.on('order_updated', (updatedOrder) => {
        if (updatedOrder.status === 'completed') {
          fetchCompletedOrders();
          fetchAllCompletedOrders();
        }
      });
    }
    
    return () => {
      if (socket) {
        socket.off('order_updated');
      }
    };
  }, [businessId]);

  // Show order details
  const showOrderDetails = (order) => {
    setSelectedOrder(order);
    setOrderDetails(order);
  };

  // Generate daily closing report (view only, no deletion)
  const generateDailyClosingReport = async () => {
    try {
      setGeneratingReport(true);
      await fetchCompletedOrders();
      logSystem('Reporte de cierre del día generado correctamente', 'info');
    } catch (err) {
      logSystem('Error generating daily closing report: ' + err.message, 'error');
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

  // Filter orders based on search term and view mode
  const getFilteredOrders = () => {
    const ordersToFilter = viewMode === 'today' ? completedOrders : allTimeOrders;
    return ordersToFilter.filter(order => 
      searchTerm 
        ? order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.orderNumber.toString().includes(searchTerm)
        : true
    );
  };

  // Order Details Modal
  const OrderDetailsModal = () => {
    if (!selectedOrder) return null;
    
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

  // Top Selling Items Component
  const TopSellingItems = () => {
    if (topSellingItems.length === 0) return null;

    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-lg shadow-sm overflow-hidden"
      >
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <span className="mr-2">🏆</span>
            Productos Más Vendidos
          </h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {topSellingItems.slice(0, 5).map((item, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-900">{item.name}</p>
                    <p className="text-sm text-gray-500">{item.count} unidades vendidas</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">${item.total.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">en ventas</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    );
  };

  // Insights Component
  const InsightsSection = () => {
    if (insights.length === 0) return null;

    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="space-y-4"
      >
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <span className="mr-2">💡</span>
          Insights y Recomendaciones
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.map((insight, index) => (
            <div key={index} className={`p-4 rounded-lg border-l-4 ${
              insight.type === 'success' ? 'bg-green-50 border-green-400' :
              insight.type === 'warning' ? 'bg-yellow-50 border-yellow-400' :
              'bg-blue-50 border-blue-400'
            }`}>
              <div className="flex items-start">
                <span className="text-2xl mr-3">{insight.icon}</span>
                <div>
                  <h4 className="font-medium text-gray-900">{insight.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">{insight.message}</p>
                  <p className="text-xs text-gray-500 mt-2 italic">{insight.recommendation}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    );
  };

  const filteredOrders = getFilteredOrders();

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="text-2xl">✅</span>
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Pedidos Completados</h2>
        <p className="text-slate-600">Historial y análisis de ventas</p>
      </motion.div>

      {/* View Mode Toggle */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex justify-center"
      >
        <div className="bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('today')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'today' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📅 Cierre del Día
          </button>
          <button
            onClick={() => setViewMode('all')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'all' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📊 Historial Completo
          </button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <motion.div 
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-3xl text-white shadow-xl"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold opacity-90">Total de Pedidos</h3>
              <p className="text-3xl font-bold mt-2">{filteredOrders.length}</p>
            </div>
            <span className="text-3xl opacity-80">📋</span>
          </div>
        </motion.div>
        
        <motion.div 
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="bg-gradient-to-br from-green-500 to-emerald-600 p-6 rounded-3xl text-white shadow-xl"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold opacity-90">Total Ventas</h3>
              <p className="text-3xl font-bold mt-2">
                ${filteredOrders.reduce((sum, order) => sum + order.totalAmount, 0).toLocaleString()}
              </p>
            </div>
            <span className="text-3xl opacity-80">💰</span>
          </div>
        </motion.div>
        
        <motion.div 
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-3xl text-white shadow-xl"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold opacity-90">Promedio por Pedido</h3>
              <p className="text-3xl font-bold mt-2">
                ${(filteredOrders.reduce((sum, order) => sum + order.totalAmount, 0) / (filteredOrders.length || 1)).toLocaleString()}
              </p>
            </div>
            <span className="text-3xl opacity-80">📊</span>
          </div>
        </motion.div>
        
        <motion.div 
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="bg-gradient-to-br from-orange-500 to-red-500 p-6 rounded-3xl text-white shadow-xl"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold opacity-90">Productos Vendidos</h3>
              <p className="text-3xl font-bold mt-2">
                {filteredOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0)}
              </p>
            </div>
            <span className="text-3xl opacity-80">🍔</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Insights Section */}
      {viewMode === 'today' && <InsightsSection />}

      {/* Top Selling Items */}
      {viewMode === 'today' && <TopSellingItems />}

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {viewMode === 'today' ? 'Pedidos Completados del Día' : 'Historial Completo de Pedidos'}
            </h2>
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
              {viewMode === 'today' && (
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
                      <span>Actualizar Cierre</span>
                    </>
                  )}
                </button>
              )}
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
                  Fecha/Hora
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
                    ${order.totalAmount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(order.completedAt || order.createdAt).toLocaleString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
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

      {/* Modals */}
      {selectedOrder && <OrderDetailsModal />}
      
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

export default EnhancedCompletedOrders;
