import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';
import { getBusinessSlug } from '../utils/getBusinessId';
import { logSystem } from '../utils/systemLogger';

const CustomersManager = () => {
  const { businessConfig } = useBusinessConfig();
  const [customers, setCustomers] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('lastOrderDate');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  // Fetch customers
  const fetchCustomers = async () => {
    // Try to get businessId from context first, then fallback to slug
    let businessId = businessConfig?.businessId;
    if (!businessId) {
      businessId = getBusinessSlug();
    }
    
    if (!businessId) {
      logSystem('Business ID no disponible aún', 'warning');
      return;
    }
    
    try {
      setLoading(true);
      const response = await api.get('/customers', {
        params: {
          businessId: businessId,
          page: currentPage,
          limit: 20,
          search: searchTerm,
          status: statusFilter,
          sortBy,
          sortOrder
        }
      });
      
      logSystem(`Clientes cargados: ${response.data.customers?.length || 0} encontrados`);
      
      setCustomers(response.data.customers);
      setStats(response.data.stats);
      setPagination(response.data.pagination);
    } catch (error) {
      logSystem(`Error al cargar clientes: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const businessId = businessConfig?.businessId || getBusinessSlug();
    if (businessId) {
      fetchCustomers();
    }
  }, [businessConfig?.businessId, currentPage, searchTerm, statusFilter, sortBy, sortOrder]);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return 'Nunca';
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const badges = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      vip: 'bg-purple-100 text-purple-800'
    };
    return badges[status] || badges.active;
  };

  // Get status icon
  const getStatusIcon = (status) => {
    const icons = {
      active: '🟢',
      inactive: '⚫',
      vip: '👑'
    };
    return icons[status] || icons.active;
  };

  // Handle customer edit
  const handleEditCustomer = async (customerData) => {
    try {
      const finalBusinessId = businessConfig?.businessId || getBusinessSlug();
      await api.put(`/customers/${selectedCustomer._id}?businessId=${finalBusinessId}`, customerData);
      fetchCustomers();
      setShowCustomerModal(false);
      setSelectedCustomer(null);
    } catch (error) {
      logSystem(`Error al actualizar cliente: ${error.message}`, 'error');
      alert('Error al actualizar el cliente');
    }
  };

  // Handle customer delete
  const handleDeleteCustomer = async (customerId) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este cliente? Esta acción no se puede deshacer.')) {
      return;
    }
    
    try {
      const finalBusinessId = businessConfig?.businessId || getBusinessSlug();
      await api.delete(`/customers/${customerId}?businessId=${finalBusinessId}`);
      fetchCustomers();
      alert('Cliente eliminado exitosamente');
    } catch (error) {
      logSystem(`Error al eliminar cliente: ${error.message}`, 'error');
      alert('Error al eliminar el cliente');
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Gestión de Clientes</h2>
        <p className="text-gray-600">Administra la información y estadísticas de tus clientes</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-4 rounded-lg shadow-sm border"
        >
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <span className="text-2xl">👥</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Total Clientes</p>
              <p className="text-xl font-semibold">{stats.totalCustomers || 0}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-4 rounded-lg shadow-sm border"
        >
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <span className="text-2xl">📦</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Total Pedidos</p>
              <p className="text-xl font-semibold">{stats.totalOrders || 0}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-4 rounded-lg shadow-sm border"
        >
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <span className="text-2xl">💰</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Ingresos Totales</p>
              <p className="text-xl font-semibold">{formatCurrency(stats.totalRevenue || 0)}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-4 rounded-lg shadow-sm border"
        >
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <span className="text-2xl">👑</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Clientes VIP</p>
              <p className="text-xl font-semibold">{stats.vipCustomers || 0}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Buscar por nombre, teléfono o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
              <option value="vip">VIP</option>
            </select>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field);
                setSortOrder(order);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="lastOrderDate-desc">Último pedido (reciente)</option>
              <option value="lastOrderDate-asc">Último pedido (antiguo)</option>
              <option value="totalOrders-desc">Más pedidos</option>
              <option value="totalSpent-desc">Mayor gasto</option>
              <option value="name-asc">Nombre A-Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Cargando clientes...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contacto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estadísticas
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Último Pedido
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <AnimatePresence>
                    {customers.map((customer, index) => (
                      <motion.tr
                        key={customer._id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.05 }}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <span className="text-sm font-medium text-blue-600">
                                  {customer.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {customer.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                ID: {customer._id.slice(-8)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{customer.phone}</div>
                          {customer.email && (
                            <div className="text-sm text-gray-500">{customer.email}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {customer.stats.totalOrders} pedidos
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatCurrency(customer.stats.totalSpent)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(customer.status)}`}>
                            {getStatusIcon(customer.status)} {customer.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(customer.stats.lastOrderDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                setSelectedCustomer(customer);
                                setShowCustomerModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Ver detalles
                            </button>
                            <button
                              onClick={() => handleDeleteCustomer(customer._id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(pagination.pages, currentPage + 1))}
                    disabled={currentPage === pagination.pages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Mostrando <span className="font-medium">{((currentPage - 1) * 20) + 1}</span> a{' '}
                      <span className="font-medium">
                        {Math.min(currentPage * 20, pagination.total)}
                      </span>{' '}
                      de <span className="font-medium">{pagination.total}</span> resultados
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            page === currentPage
                              ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Customer Detail Modal */}
      <AnimatePresence>
        {showCustomerModal && selectedCustomer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowCustomerModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Detalles del Cliente</h3>
                <button
                  onClick={() => setShowCustomerModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nombre</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedCustomer.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedCustomer.phone}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedCustomer.email || 'No especificado'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Estado</label>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(selectedCustomer.status)}`}>
                      {getStatusIcon(selectedCustomer.status)} {selectedCustomer.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Estadísticas</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Total Pedidos</label>
                      <p className="mt-1 text-lg font-semibold text-gray-900">{selectedCustomer.stats.totalOrders}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Total Gastado</label>
                      <p className="mt-1 text-lg font-semibold text-gray-900">{formatCurrency(selectedCustomer.stats.totalSpent)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Valor Promedio</label>
                      <p className="mt-1 text-lg font-semibold text-gray-900">{formatCurrency(selectedCustomer.stats.averageOrderValue)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Último Pedido</label>
                      <p className="mt-1 text-lg font-semibold text-gray-900">{formatDate(selectedCustomer.stats.lastOrderDate)}</p>
                    </div>
                  </div>
                </div>

                {selectedCustomer.preferences.notes && (
                  <div className="border-t pt-4">
                    <label className="block text-sm font-medium text-gray-700">Notas</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedCustomer.preferences.notes}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomersManager;
