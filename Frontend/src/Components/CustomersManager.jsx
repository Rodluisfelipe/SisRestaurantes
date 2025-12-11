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
  const [customerOrders, setCustomerOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [activeTab, setActiveTab] = useState('resumen');
  const [showWhatsAppMenu, setShowWhatsAppMenu] = useState(false);
  const [whatsappMenuCustomer, setWhatsappMenuCustomer] = useState(null);

  // Fetch customers
  const fetchCustomers = async () => {
    // Try to get businessId from context first, then fallback to slug
    let businessId = businessConfig?.businessId;
    if (!businessId) {
      businessId = getBusinessSlug();
    }
    
    console.log('[CustomersManager] fetchCustomers - businessId:', businessId);
    console.log('[CustomersManager] fetchCustomers - businessConfig:', businessConfig);
    
    if (!businessId) {
      logSystem('Business ID no disponible aún', 'warning');
      return;
    }
    
    try {
      setLoading(true);
      console.log('[CustomersManager] Haciendo solicitud a /customers con params:', {
        businessId: businessId,
        page: currentPage,
        limit: 20,
        search: searchTerm,
        status: statusFilter,
        sortBy,
        sortOrder
      });
      
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
      
      console.log('[CustomersManager] Respuesta de la API:', response.data);
      logSystem(`Clientes cargados: ${response.data.customers?.length || 0} encontrados`);
      
      setCustomers(response.data.customers || []);
      setStats(response.data.stats || {});
      setPagination(response.data.pagination || {});
    } catch (error) {
      console.error('[CustomersManager] Error completo:', error);
      console.error('[CustomersManager] Error response:', error.response?.data);
      logSystem(`Error al cargar clientes: ${error.message}`, 'error');
      setCustomers([]);
      setStats({});
      setPagination({});
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

  // Format relative date (for last order)
  const formatRelativeDate = (date) => {
    if (!date) return 'Nunca';
    
    const now = new Date();
    const orderDate = new Date(date);
    const diffTime = Math.abs(now - orderDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
    if (diffDays < 365) return `Hace ${Math.floor(diffDays / 30)} meses`;
    return formatDate(date);
  };

  // Format currency compact (104000 → 104K)
  const formatCurrencyCompact = (amount) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `$${Math.floor(amount / 1000)}K`;
    }
    return `$${amount}`;
  };

  // Get customer level based on orders
  const getCustomerLevel = (totalOrders) => {
    if (totalOrders >= 10) return { name: 'VIP', icon: '💎', color: 'from-purple-400 to-pink-600' };
    if (totalOrders >= 6) return { name: 'Oro', icon: '🥇', color: 'from-yellow-400 to-yellow-600' };
    if (totalOrders >= 3) return { name: 'Plata', icon: '🥈', color: 'from-gray-300 to-gray-500' };
    return { name: 'Bronce', icon: '🥉', color: 'from-orange-400 to-orange-600' };
  };

  // Fetch customer orders
  const fetchCustomerOrders = async (phone) => {
    const businessId = businessConfig?.businessId || getBusinessSlug();
    if (!businessId || !phone) return;

    try {
      setLoadingOrders(true);
      const response = await api.get(`/customers/${phone}/orders`, {
        params: { businessId, limit: 10 }
      });
      setCustomerOrders(response.data.orders || []);
    } catch (error) {
      console.error('Error al cargar pedidos del cliente:', error);
      setCustomerOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Calcular productos favoritos
  const getFavoriteProducts = (orders) => {
    const productCount = {};
    orders.forEach(order => {
      order.items?.forEach(item => {
        const productName = item.name || 'Producto';
        productCount[productName] = (productCount[productName] || 0) + (item.quantity || 1);
      });
    });
    
    return Object.entries(productCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  };

  // Calcular tipo de pedido preferido
  const getPreferredOrderType = (orders) => {
    const typeCount = { delivery: 0, takeaway: 0, inSite: 0 };
    orders.forEach(order => {
      if (order.orderType) typeCount[order.orderType]++;
    });
    
    const types = {
      delivery: '🚚 Domicilio',
      takeaway: '🥡 Para llevar',
      inSite: '🍽️ Mesa'
    };
    
    const preferred = Object.entries(typeCount).sort((a, b) => b[1] - a[1])[0];
    return preferred ? types[preferred[0]] : 'N/A';
  };

  // Calcular tiempo como cliente
  const getCustomerAge = (createdAt) => {
    if (!createdAt) return 'Reciente';
    const now = new Date();
    const registered = new Date(createdAt);
    const diffTime = Math.abs(now - registered);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffMonths / 12);

    if (diffYears >= 1) return `${diffYears} año${diffYears > 1 ? 's' : ''}`;
    if (diffMonths >= 1) return `${diffMonths} mes${diffMonths > 1 ? 'es' : ''}`;
    if (diffDays >= 1) return `${diffDays} día${diffDays > 1 ? 's' : ''}`;
    return 'Hoy';
  };

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

  // Generar mensajes de WhatsApp personalizados
  const generateWhatsAppMessage = (customer, type) => {
    const restaurantName = businessConfig?.businessName || 'nuestro restaurante';
    const customerName = customer.name.split(' ')[0]; // Primer nombre
    const isVIP = (customer.totalOrders || 0) >= 10;
    
    const messages = {
      greeting: `Hola ${customerName}! 👋 Soy del equipo de ${restaurantName}. ¿Cómo estás?`,
      
      promotion: isVIP 
        ? `Hola ${customerName}! 👑 Como cliente VIP de ${restaurantName}, tenemos una promoción exclusiva para ti. ¿Te gustaría conocerla?`
        : `Hola ${customerName}! 🎁 Tenemos una promoción especial en ${restaurantName} que te puede interesar. ¿Quieres conocerla?`,
      
      followup: customer.lastOrderDate 
        ? `Hola ${customerName}! Esperamos que hayas disfrutado tu último pedido en ${restaurantName}. ¿Todo estuvo bien? 😊`
        : `Hola ${customerName}! ¿Cómo estás? Te escribo desde ${restaurantName}`,
      
      reminder: `Hola ${customerName}! 🍽️ Te extrañamos en ${restaurantName}. Tenemos el menú que tanto te gusta disponible hoy.`,
      
      feedback: `Hola ${customerName}! Tu opinión es muy importante para nosotros en ${restaurantName}. ¿Podrías compartir tu experiencia? 🌟`,
      
      custom: `Hola ${customerName}! Te escribo desde ${restaurantName}. `
    };

    return encodeURIComponent(messages[type] || messages.greeting);
  };

  const openWhatsAppWithMessage = (customer, messageType) => {
    const phone = customer.phone.replace(/\D/g, '');
    const message = generateWhatsAppMessage(customer, messageType);
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    setShowWhatsAppMenu(false);
    setWhatsappMenuCustomer(null);
  };

  const handleWhatsAppClick = (e, customer) => {
    e.preventDefault();
    e.stopPropagation();
    setWhatsappMenuCustomer(customer);
    setShowWhatsAppMenu(true);
  };

  // Handle customer edit
  const handleEditCustomer = async (customerData) => {
    try {
      if (!selectedCustomer?._id) {
        console.error('No customer selected for editing');
        return;
      }
      
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
      console.log(`[CustomersManager] Deleting customer with ID: ${customerId}, businessId: ${finalBusinessId}`);
      await api.delete(`/customers/by-id/${customerId}?businessId=${finalBusinessId}`);
      fetchCustomers();
      alert('Cliente eliminado exitosamente');
    } catch (error) {
      console.error('[CustomersManager] Error deleting customer:', error);
      logSystem(`Error al eliminar cliente: ${error.message}`, 'error');
      alert('Error al eliminar el cliente');
    }
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
          Gestión de Clientes
        </h2>
        <p className="text-gray-600">Administra la información y estadísticas de tus clientes</p>
      </motion.div>

      {/* Enhanced Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-br from-blue-500 to-blue-600 p-5 rounded-2xl shadow-lg text-white relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-4xl">👥</span>
              <p className="text-3xl font-bold">{stats?.totalCustomers || 0}</p>
            </div>
            <p className="text-sm text-blue-100">Total Clientes</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-br from-purple-500 to-pink-600 p-5 rounded-2xl shadow-lg text-white relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <motion.span 
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                className="text-4xl"
              >
                👑
              </motion.span>
              <p className="text-3xl font-bold">{stats?.vipCustomers || 0}</p>
            </div>
            <p className="text-sm text-purple-100">Clientes VIP</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-br from-green-500 to-emerald-600 p-5 rounded-2xl shadow-lg text-white relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-4xl">💰</span>
              <p className="text-3xl font-bold">{formatCurrencyCompact(stats?.totalRevenue || 0)}</p>
            </div>
            <p className="text-sm text-green-100">Ingresos Totales</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-br from-orange-500 to-red-600 p-5 rounded-2xl shadow-lg text-white relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-4xl">📊</span>
              <p className="text-3xl font-bold">{((stats?.totalOrders || 0) / (stats?.totalCustomers || 1)).toFixed(1)}</p>
            </div>
            <p className="text-sm text-orange-100">Promedio Pedidos</p>
          </div>
        </motion.div>
      </div>

      {/* Enhanced Filters and Search */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="bg-white p-4 md:p-5 rounded-2xl shadow-md border border-gray-100 mb-6"
      >
        <div className="flex flex-col gap-4">
          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Buscar por nombre, teléfono o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap gap-2">
            {/* Status Filters as Chips */}
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                statusFilter === 'all'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todos ({stats?.totalCustomers || 0})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                statusFilter === 'active'
                  ? 'bg-green-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🟢 Activos
            </button>
            <button
              onClick={() => setStatusFilter('vip')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                statusFilter === 'vip'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              👑 VIP ({stats?.vipCustomers || 0})
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                statusFilter === 'inactive'
                  ? 'bg-gray-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ⚫ Inactivos
            </button>
            
            {/* Sort Dropdown */}
            <div className="ml-auto">
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field);
                  setSortOrder(order);
                }}
                className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white text-sm"
              >
                <option value="lastOrderDate-desc">📅 Último pedido (reciente)</option>
                <option value="lastOrderDate-asc">📅 Último pedido (antiguo)</option>
                <option value="totalOrders-desc">📊 Más pedidos</option>
                <option value="totalSpent-desc">💰 Mayor gasto</option>
                <option value="name-asc">🔤 Nombre A-Z</option>
              </select>
            </div>
          </div>

          {/* Results Counter */}
          {searchTerm && (
            <div className="text-sm text-gray-600">
              Mostrando {customers.length} resultado{customers.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </motion.div>

      {/* Enhanced Customers Table/Cards */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-md p-12 text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="inline-block"
          >
            <div className="h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          </motion.div>
          <p className="mt-4 text-gray-600 font-medium">Cargando clientes...</p>
        </div>
      ) : customers.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-md p-12 text-center"
        >
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No se encontraron clientes</h3>
          <p className="text-gray-600">Intenta con otros filtros o búsqueda</p>
        </motion.div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white rounded-2xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Contacto
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Nivel / Estadísticas
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Último Pedido
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  <AnimatePresence>
                    {customers.map((customer, index) => {
                      const level = getCustomerLevel(customer.totalOrders || 0);
                      const isVIP = (customer.totalOrders || 0) >= 10;
                      
                      return (
                        <motion.tr
                          key={customer._id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ delay: index * 0.03 }}
                          whileHover={{ backgroundColor: '#f9fafb', scale: 1.01 }}
                          className="cursor-pointer transition-all"
                        >
                          {/* Cliente Column */}
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className="relative">
                                <div className={`h-12 w-12 rounded-full bg-gradient-to-br ${level.color} flex items-center justify-center shadow-lg`}>
                                  <span className="text-lg font-bold text-white">
                                    {customer.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                {isVIP && (
                                  <motion.div
                                    animate={{ rotate: [0, 15, -15, 0] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="absolute -top-1 -right-1 text-xl"
                                  >
                                    👑
                                  </motion.div>
                                )}
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-bold text-gray-900">
                                  {customer.name}
                                </div>
                                <div className="text-xs text-gray-500">
                                  ID: {customer._id.slice(-8)}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Contacto Column */}
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2 text-sm text-gray-900">
                                <span>📱</span>
                                <span>{customer.phone}</span>
                              </div>
                              {customer.email && (
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <span>📧</span>
                                  <span className="truncate max-w-[180px]">{customer.email}</span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Nivel / Stats Column */}
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-2">
                              <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${level.color} text-white shadow-md w-fit`}>
                                <span>{level.icon}</span>
                                <span>{level.name}</span>
                              </div>
                              <div className="flex items-center gap-3 text-xs">
                                <span className="flex items-center gap-1 text-gray-700">
                                  <span className="font-semibold">{customer.totalOrders || 0}</span>
                                  <span className="text-gray-500">pedidos</span>
                                </span>
                                <span className="text-gray-300">•</span>
                                <span className="flex items-center gap-1 text-green-600 font-semibold">
                                  ${(customer.totalSpent || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Último Pedido Column */}
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-medium text-gray-900">
                                {formatRelativeDate(customer.lastOrderDate)}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatDate(customer.lastOrderDate)}
                              </span>
                            </div>
                          </td>

                          {/* Acciones Column */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {/* WhatsApp Button */}
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={(e) => handleWhatsAppClick(e, customer)}
                                className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors shadow-sm"
                                title="WhatsApp"
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                                </svg>
                              </motion.button>

                              {/* Ver Detalles Button */}
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => {
                                  const customerWithStats = {
                                    ...customer,
                                    stats: {
                                      totalOrders: customer.totalOrders || 0,
                                      totalSpent: customer.totalSpent || 0,
                                      averageOrderValue: customer.totalOrders > 0 ? (customer.totalSpent / customer.totalOrders) : 0,
                                      lastOrderDate: customer.lastOrderDate
                                    }
                                  };
                                  setSelectedCustomer(customerWithStats);
                                  setShowCustomerModal(true);
                                }}
                                className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm"
                                title="Ver detalles"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </motion.button>

                              {/* Delete Button */}
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleDeleteCustomer(customer._id)}
                                className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-sm"
                                title="Eliminar"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </motion.button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4">
            <AnimatePresence>
              {customers.map((customer, index) => {
                const level = getCustomerLevel(customer.totalOrders || 0);
                const isVIP = (customer.totalOrders || 0) >= 10;

                return (
                  <motion.div
                    key={customer._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white rounded-2xl shadow-md p-4 border border-gray-100"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className={`h-14 w-14 rounded-full bg-gradient-to-br ${level.color} flex items-center justify-center shadow-lg`}>
                            <span className="text-xl font-bold text-white">
                              {customer.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          {isVIP && (
                            <motion.div
                              animate={{ rotate: [0, 15, -15, 0] }}
                              transition={{ duration: 2, repeat: Infinity }}
                              className="absolute -top-1 -right-1 text-2xl"
                            >
                              👑
                            </motion.div>
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">{customer.name}</h3>
                          <p className="text-xs text-gray-500">ID: {customer._id.slice(-8)}</p>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${level.color} text-white shadow-md`}>
                        {level.icon} {level.name}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-xs text-gray-500">Pedidos</p>
                        <p className="text-lg font-bold text-gray-900">{customer.totalOrders || 0}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-xs text-gray-500">Total Gastado</p>
                        <p className="text-sm font-bold text-green-600">${(customer.totalSpent || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                      </div>
                    </div>

                    {/* Contact */}
                    <div className="mb-3 space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span>📱</span>
                        <span className="text-gray-700">{customer.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>📅</span>
                        <span>Último pedido: {formatRelativeDate(customer.lastOrderDate)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={(e) => handleWhatsAppClick(e, customer)}
                        className="flex-1 bg-green-500 text-white py-2 px-3 rounded-lg text-sm font-medium text-center hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                        </svg>
                        WhatsApp
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          const customerWithStats = {
                            ...customer,
                            stats: {
                              totalOrders: customer.totalOrders || 0,
                              totalSpent: customer.totalSpent || 0,
                              averageOrderValue: customer.totalOrders > 0 ? (customer.totalSpent / customer.totalOrders) : 0,
                              lastOrderDate: customer.lastOrderDate
                            }
                          };
                          setSelectedCustomer(customerWithStats);
                          setShowCustomerModal(true);
                        }}
                        className="flex-1 bg-blue-500 text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                      >
                        Ver Detalles
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Enhanced Pagination */}
          {pagination.total > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-md p-6 mt-6"
            >
              {/* Mobile Pagination */}
              <div className="flex items-center justify-between sm:hidden">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Anterior
                </motion.button>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">
                    Página {currentPage} de {pagination.total}
                  </span>
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCurrentPage(Math.min(pagination.total, currentPage + 1))}
                  disabled={currentPage === pagination.total}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  Siguiente
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </motion.button>
              </div>

              {/* Desktop Pagination */}
              <div className="hidden sm:flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    Mostrando
                  </span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-bold">
                    {((currentPage - 1) * 20) + 1}
                  </span>
                  <span className="text-sm text-gray-600">a</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-bold">
                    {Math.min(currentPage * 20, pagination.totalCustomers)}
                  </span>
                  <span className="text-sm text-gray-600">de</span>
                  <span className="px-2 py-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg text-sm font-bold">
                    {pagination.totalCustomers}
                  </span>
                  <span className="text-sm text-gray-600">clientes</span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Previous Button */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Página anterior"
                  >
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </motion.button>

                  {/* Page Numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(pagination.total, 7) }, (_, i) => {
                      let pageNum;
                      if (pagination.total <= 7) {
                        pageNum = i + 1;
                      } else if (currentPage <= 4) {
                        pageNum = i + 1;
                      } else if (currentPage >= pagination.total - 3) {
                        pageNum = pagination.total - 6 + i;
                      } else {
                        pageNum = currentPage - 3 + i;
                      }

                      return (
                        <motion.button
                          key={pageNum}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-10 h-10 rounded-lg font-bold text-sm transition-all ${
                            pageNum === currentPage
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {pageNum}
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Next Button */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setCurrentPage(Math.min(pagination.total, currentPage + 1))}
                    disabled={currentPage === pagination.total}
                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Página siguiente"
                  >
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* Enhanced Customer Detail Modal */}
      <AnimatePresence>
        {showCustomerModal && selectedCustomer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto"
            onClick={() => setShowCustomerModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col my-8 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header - Con gradiente sutil */}
              <div className="relative bg-gradient-to-br from-gray-50 to-white p-8 pb-6 border-b border-gray-100">
                {/* Decoración de fondo */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-50 to-purple-50 rounded-full blur-3xl opacity-40 -mr-32 -mt-32"></div>
                
                {/* Close Button */}
                <button
                  onClick={() => setShowCustomerModal(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-all z-10"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Customer Info */}
                <div className="flex items-start gap-4 mb-6 relative z-10">
                  <div className="relative">
                    <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${getCustomerLevel(selectedCustomer.totalOrders || 0).color} flex items-center justify-center shadow-lg ring-4 ring-white`}>
                      <span className="text-2xl font-bold text-white">
                        {selectedCustomer.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    {(selectedCustomer.totalOrders || 0) >= 10 && (
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute -top-1 -right-1 text-xl filter drop-shadow"
                      >
                        👑
                      </motion.div>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-1">{selectedCustomer.name}</h2>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="px-2.5 py-1 rounded-lg bg-gradient-to-r ${getCustomerLevel(selectedCustomer.totalOrders || 0).color} bg-opacity-10 text-gray-700 font-medium flex items-center gap-1.5">
                        <span>{getCustomerLevel(selectedCustomer.totalOrders || 0).icon}</span>
                        <span>Cliente {getCustomerLevel(selectedCustomer.totalOrders || 0).name}</span>
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 font-medium">{getCustomerAge(selectedCustomer.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 relative z-10">
                  <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={(e) => handleWhatsAppClick(e, selectedCustomer)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                    WhatsApp
                  </motion.button>
                  <motion.a
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    href={`tel:${selectedCustomer.phone}`}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    Llamar
                  </motion.a>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto px-8 pb-8">
                <div className="space-y-6">
                  {/* Stats - Con gradientes sutiles */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <motion.div
                      whileHover={{ scale: 1.05, y: -3 }}
                      className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-2xl text-center border border-blue-200 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="text-2xl mb-1">📦</div>
                      <div className="text-2xl font-bold text-blue-900 mb-0.5">{selectedCustomer.totalOrders || 0}</div>
                      <div className="text-xs text-blue-600 font-medium">Pedidos</div>
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.05, y: -3 }}
                      className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-2xl text-center border border-green-200 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="text-2xl mb-1">💰</div>
                      <div className="text-lg font-bold text-green-900 mb-0.5">${(selectedCustomer.totalSpent || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                      <div className="text-xs text-green-600 font-medium">Total</div>
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.05, y: -3 }}
                      className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-2xl text-center border border-purple-200 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="text-2xl mb-1">📊</div>
                      <div className="text-lg font-bold text-purple-900 mb-0.5">
                        ${((selectedCustomer.totalOrders || 0) > 0 ? (selectedCustomer.totalSpent / selectedCustomer.totalOrders) : 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </div>
                      <div className="text-xs text-purple-600 font-medium">Promedio</div>
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.05, y: -3 }}
                      className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-2xl text-center border border-orange-200 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="text-2xl mb-1">📅</div>
                      <div className="text-sm font-bold text-orange-900 mb-0.5">{formatRelativeDate(selectedCustomer.lastOrderDate)}</div>
                      <div className="text-xs text-orange-600 font-medium">Último</div>
                    </motion.div>
                  </div>

                  <div className="border-t border-gray-100"></div>

                  {/* Contact Info - Con diseño mejorado */}
                  <div className="bg-gradient-to-br from-gray-50 to-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-5">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      Información de Contacto
                    </h3>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded-xl border border-gray-100">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                          <span>📱</span> Teléfono
                        </label>
                        <p className="text-base font-semibold text-gray-900">{selectedCustomer.phone}</p>
                      </div>
                      
                      <div className="bg-white p-4 rounded-xl border border-gray-100">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                          <span>📧</span> Email
                        </label>
                        <p className="text-base font-semibold text-gray-900">{selectedCustomer.email || 'No especificado'}</p>
                      </div>
                    </div>
                    
                    {selectedCustomer.address && (
                      <div className="bg-white p-4 rounded-xl border border-gray-100">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                          <span>📍</span> Dirección
                        </label>
                        <p className="text-base font-semibold text-gray-900">{selectedCustomer.address}</p>
                      </div>
                    )}

                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100">
                      <label className="text-xs font-semibold text-indigo-600 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                        <span>🎉</span> Miembro desde
                      </label>
                      <p className="text-base font-bold text-indigo-900">
                        {selectedCustomer.createdAt ? new Date(selectedCustomer.createdAt).toLocaleDateString('es-ES', { 
                          day: 'numeric', 
                          month: 'long', 
                          year: 'numeric' 
                        }) : 'Fecha no disponible'}
                      </p>
                      <p className="text-sm text-indigo-600 mt-1">{getCustomerAge(selectedCustomer.createdAt)} como cliente</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WhatsApp Message Menu */}
      <AnimatePresence>
        {showWhatsAppMenu && whatsappMenuCustomer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]"
            onClick={() => {
              setShowWhatsAppMenu(false);
              setWhatsappMenuCustomer(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-bold">Enviar WhatsApp</h3>
                  <button
                    onClick={() => {
                      setShowWhatsAppMenu(false);
                      setWhatsappMenuCustomer(null);
                    }}
                    className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1.5 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-green-100 text-sm">
                  Selecciona el tipo de mensaje para {whatsappMenuCustomer.name.split(' ')[0]}
                </p>
              </div>

              {/* Message Options */}
              <div className="p-4 space-y-2 max-h-[70vh] overflow-y-auto">
                <motion.button
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => openWhatsAppWithMessage(whatsappMenuCustomer, 'greeting')}
                  className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-xl transition-all border border-blue-200 group"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <span className="text-2xl">👋</span>
                  </div>
                  <div className="text-left flex-1">
                    <h4 className="font-bold text-gray-900 mb-0.5">Saludo General</h4>
                    <p className="text-xs text-gray-600">Mensaje de bienvenida amigable</p>
                  </div>
                  <svg className="w-5 h-5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => openWhatsAppWithMessage(whatsappMenuCustomer, 'promotion')}
                  className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 rounded-xl transition-all border border-purple-200 group"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <span className="text-2xl">🎁</span>
                  </div>
                  <div className="text-left flex-1">
                    <h4 className="font-bold text-gray-900 mb-0.5">
                      {(whatsappMenuCustomer.totalOrders || 0) >= 10 ? 'Promoción VIP' : 'Promoción Especial'}
                    </h4>
                    <p className="text-xs text-gray-600">Enviar oferta exclusiva</p>
                  </div>
                  <svg className="w-5 h-5 text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => openWhatsAppWithMessage(whatsappMenuCustomer, 'followup')}
                  className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 rounded-xl transition-all border border-green-200 group"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <span className="text-2xl">💬</span>
                  </div>
                  <div className="text-left flex-1">
                    <h4 className="font-bold text-gray-900 mb-0.5">Seguimiento</h4>
                    <p className="text-xs text-gray-600">Preguntar sobre último pedido</p>
                  </div>
                  <svg className="w-5 h-5 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => openWhatsAppWithMessage(whatsappMenuCustomer, 'reminder')}
                  className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 rounded-xl transition-all border border-orange-200 group"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <span className="text-2xl">🍽️</span>
                  </div>
                  <div className="text-left flex-1">
                    <h4 className="font-bold text-gray-900 mb-0.5">Recordatorio</h4>
                    <p className="text-xs text-gray-600">Invitar a hacer un pedido</p>
                  </div>
                  <svg className="w-5 h-5 text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => openWhatsAppWithMessage(whatsappMenuCustomer, 'feedback')}
                  className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 hover:from-yellow-100 hover:to-yellow-200 rounded-xl transition-all border border-yellow-200 group"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <span className="text-2xl">⭐</span>
                  </div>
                  <div className="text-left flex-1">
                    <h4 className="font-bold text-gray-900 mb-0.5">Solicitar Feedback</h4>
                    <p className="text-xs text-gray-600">Pedir opinión del servicio</p>
                  </div>
                  <svg className="w-5 h-5 text-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => openWhatsAppWithMessage(whatsappMenuCustomer, 'custom')}
                  className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 rounded-xl transition-all border border-gray-200 group"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-gray-500 to-gray-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <span className="text-2xl">✍️</span>
                  </div>
                  <div className="text-left flex-1">
                    <h4 className="font-bold text-gray-900 mb-0.5">Mensaje Personalizado</h4>
                    <p className="text-xs text-gray-600">Escribir tu propio mensaje</p>
                  </div>
                  <svg className="w-5 h-5 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </motion.button>
              </div>

              {/* Footer */}
              <div className="p-4 bg-gray-50 border-t border-gray-200">
                <p className="text-xs text-gray-500 text-center">
                  📱 Se abrirá WhatsApp con el mensaje pre-escrito
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomersManager;
