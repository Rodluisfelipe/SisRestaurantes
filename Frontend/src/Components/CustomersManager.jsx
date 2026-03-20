import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaUsers, FaCrown, FaDollarSign, FaChartBar, FaSearch, FaWhatsapp, FaEye, FaTrash, FaTimes, FaPhone, FaEnvelope, FaMapMarkerAlt, FaCalendarAlt, FaBoxOpen, FaSyncAlt, FaChevronLeft, FaChevronRight, FaStar, FaPaperPlane, FaCommentDots, FaUtensils, FaPen, FaHandPeace, FaGift, FaSortAmountDown } from 'react-icons/fa';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';
import { getBusinessSlug } from '../utils/getBusinessId';
import { logSystem } from '../utils/systemLogger';

const CustomersManager = () => {
  const { businessConfig } = useBusinessConfig();
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);
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
    if (totalOrders >= 10) return { name: 'VIP', color: 'bg-purple-100 text-purple-700', dotColor: 'bg-purple-500' };
    if (totalOrders >= 6) return { name: 'Oro', color: 'bg-amber-100 text-amber-700', dotColor: 'bg-amber-500' };
    if (totalOrders >= 3) return { name: 'Plata', color: 'bg-slate-200 text-slate-700', dotColor: 'bg-slate-400' };
    return { name: 'Bronce', color: 'bg-orange-100 text-orange-700', dotColor: 'bg-orange-400' };
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

  // Get status icon - now unused, kept for compatibility
  const getStatusIcon = (status) => status;

  // Generar mensajes de WhatsApp personalizados
  const generateWhatsAppMessage = (customer, type) => {
    const restaurantName = businessConfig?.businessName || 'nuestro negocio';
    const customerName = customer.name.split(' ')[0]; // Primer nombre
    const isVIP = (customer.totalOrders || 0) >= 10;
    
    const messages = {
      greeting: `Hola ${customerName}! 👋 Soy del equipo de ${restaurantName}. ¿Cómo estás?`,
      
      promotion: isVIP 
        ? `Hola ${customerName}! 👑 Como cliente VIP de ${restaurantName}, tenemos una promoción exclusiva para ti. ¿Te gustaría conocerla?`
        : `Hola ${customerName}! 🎁 Tenemos una promoción especial en ${restaurantName} que te puede interesar. ¿Quieres conocerla?`,
      
      followup: customer.lastOrderDate 
        ? `Hola ${customerName}! Esperamos que hayas disfrutado tu última ${isService ? 'cita' : 'pedido'} en ${restaurantName}. ¿Todo estuvo bien? 😊`
        : `Hola ${customerName}! ¿Cómo estás? Te escribo desde ${restaurantName}`,
      
      reminder: isService
        ? `Hola ${customerName}! 💆 Te esperamos en ${restaurantName}. Agenda tu próxima cita y conéctate con tu bienestar.`
        : `Hola ${customerName}! 🍽️ Te extrañamos en ${restaurantName}. Tenemos el menú que tanto te gusta disponible hoy.`,
      
      feedback: `Hola ${customerName}! Tu opinión es muy importante para nosotros en ${restaurantName}. ¿Podrías compartir tu experiencia? 🌟`,
      
      custom: `Hola ${customerName}! Te escribo desde ${restaurantName}. `
    };

    return encodeURIComponent(messages[type] || messages.greeting);
  };

  const openWhatsAppWithMessage = (customer, messageType) => {
    const phone = customer.phone.replace(/\D/g, '');
    const message = generateWhatsAppMessage(customer, messageType);
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank', 'noopener,noreferrer');
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
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
              <FaUsers className="text-blue-500 text-xs" />
            </div>
            <span className="text-lg font-bold text-slate-800">{stats?.totalCustomers || 0}</span>
          </div>
          <p className="text-[11px] text-slate-500">Total Clientes</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 bg-purple-50 rounded-lg flex items-center justify-center">
              <FaCrown className="text-purple-500 text-xs" />
            </div>
            <span className="text-lg font-bold text-slate-800">{stats?.vipCustomers || 0}</span>
          </div>
          <p className="text-[11px] text-slate-500">Clientes VIP</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
              <FaDollarSign className="text-emerald-500 text-xs" />
            </div>
            <span className="text-lg font-bold text-slate-800">{formatCurrencyCompact(stats?.totalRevenue || 0)}</span>
          </div>
          <p className="text-[11px] text-slate-500">Ingresos Totales</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 bg-amber-50 rounded-lg flex items-center justify-center">
              <FaChartBar className="text-amber-500 text-xs" />
            </div>
            <span className="text-lg font-bold text-slate-800">{((stats?.totalOrders || 0) / (stats?.totalCustomers || 1)).toFixed(1)}</span>
          </div>
          <p className="text-[11px] text-slate-500">{isService ? 'Promedio Citas' : 'Promedio Pedidos'}</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-3">
        <div className="flex flex-col gap-3">
          {/* Search Bar */}
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input
              type="text"
              placeholder="Buscar por nombre, teléfono o email..."
              aria-label="Buscar clientes"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
            />
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({stats?.totalCustomers || 0})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                statusFilter === 'active'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span> Activos
            </button>
            <button
              onClick={() => setStatusFilter('vip')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                statusFilter === 'vip'
                  ? 'bg-purple-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FaCrown className="text-[9px]" /> VIP ({stats?.vipCustomers || 0})
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                statusFilter === 'inactive'
                  ? 'bg-slate-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50"></span> Inactivos
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
                className="px-2.5 py-1 border border-slate-200 rounded-lg text-xs text-slate-600 focus:ring-2 focus:ring-blue-500/20 bg-white"
              >
                <option value="lastOrderDate-desc">Última {isService ? 'cita' : 'pedido'} (reciente)</option>
                <option value="lastOrderDate-asc">Última {isService ? 'cita' : 'pedido'} (antiguo)</option>
                <option value="totalOrders-desc">{isService ? 'Más citas' : 'Más pedidos'}</option>
                <option value="totalSpent-desc">Mayor gasto</option>
                <option value="name-asc">Nombre A-Z</option>
              </select>
            </div>
          </div>

          {searchTerm && (
            <p className="text-[11px] text-slate-500">
              {customers.length} resultado{customers.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Customers Table/Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-sm text-slate-400">
          <FaSyncAlt className="animate-spin mr-2 text-xs" /> Cargando clientes...
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-10 text-center">
          <FaBoxOpen className="text-2xl text-slate-300 mb-2" />
          <p className="text-sm text-slate-500 font-medium">No se encontraron clientes</p>
          <p className="text-xs text-slate-400 mt-1">Intenta con otros filtros o búsqueda</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Contacto</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Nivel</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{isService ? 'Última Cita' : 'Último Pedido'}</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {customers.map((customer) => {
                    const level = getCustomerLevel(customer.totalOrders || 0);
                    const isVIP = (customer.totalOrders || 0) >= 10;

                    return (
                      <tr key={customer._id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="relative">
                              <div className={`w-8 h-8 rounded-lg ${level.color} flex items-center justify-center text-xs font-bold`}>
                                {customer.name.charAt(0).toUpperCase()}
                              </div>
                              {isVIP && (
                                <FaCrown className="absolute -top-1 -right-1 text-[8px] text-purple-500" />
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-800">{customer.name}</p>
                              <p className="text-[10px] text-slate-400">#{customer._id.slice(-6)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-xs text-slate-700">
                              <FaPhone className="text-[9px] text-slate-400" /> {customer.phone}
                            </div>
                            {customer.email && (
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                <FaEnvelope className="text-[8px]" /> <span className="truncate max-w-[160px]">{customer.email}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="space-y-1">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${level.color}`}>
                              {level.name}
                            </span>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                              <span className="font-medium">{customer.totalOrders || 0} ped.</span>
                              <span className="text-slate-300">·</span>
                              <span className="text-emerald-600 font-medium">${(customer.totalSpent || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="text-xs font-medium text-slate-700">{formatRelativeDate(customer.lastOrderDate)}</p>
                          <p className="text-[10px] text-slate-400">{formatDate(customer.lastOrderDate)}</p>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => handleWhatsAppClick(e, customer)}
                              className="p-2.5 min-h-[44px] text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="WhatsApp"
                            >
                              <FaWhatsapp className="text-xs" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedCustomer({
                                  ...customer,
                                  stats: {
                                    totalOrders: customer.totalOrders || 0,
                                    totalSpent: customer.totalSpent || 0,
                                    averageOrderValue: customer.totalOrders > 0 ? (customer.totalSpent / customer.totalOrders) : 0,
                                    lastOrderDate: customer.lastOrderDate
                                  }
                                });
                                setShowCustomerModal(true);
                              }}
                              className="p-2.5 min-h-[44px] text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Ver detalles"
                            >
                              <FaEye className="text-xs" />
                            </button>
                            <button
                              onClick={() => handleDeleteCustomer(customer._id)}
                              className="p-2.5 min-h-[44px] text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar"
                            >
                              <FaTrash className="text-xs" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-2">
            {customers.map((customer) => {
              const level = getCustomerLevel(customer.totalOrders || 0);
              const isVIP = (customer.totalOrders || 0) >= 10;

              return (
                <div key={customer._id} className="bg-white rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        <div className={`w-9 h-9 rounded-lg ${level.color} flex items-center justify-center text-xs font-bold`}>
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        {isVIP && <FaCrown className="absolute -top-1 -right-1 text-[7px] text-purple-500" />}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-800">{customer.name}</p>
                        <p className="text-[10px] text-slate-400">#{customer._id.slice(-6)}</p>
                      </div>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${level.color}`}>
                      {level.name}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="bg-slate-50 rounded-lg px-2 py-1.5">
                      <p className="text-[10px] text-slate-400">{isService ? 'Citas' : 'Pedidos'}</p>
                      <p className="text-sm font-bold text-slate-800">{customer.totalOrders || 0}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg px-2 py-1.5">
                      <p className="text-[10px] text-slate-400">Total</p>
                      <p className="text-xs font-bold text-emerald-600">${(customer.totalSpent || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })}</p>
                    </div>
                  </div>

                  <div className="mb-2 space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs text-slate-700">
                      <FaPhone className="text-[9px] text-slate-400" /> {customer.phone}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <FaCalendarAlt className="text-[8px]" /> {formatRelativeDate(customer.lastOrderDate)}
                    </div>
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      onClick={(e) => handleWhatsAppClick(e, customer)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors"
                    >
                      <FaWhatsapp className="text-xs" /> WhatsApp
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCustomer({
                          ...customer,
                          stats: {
                            totalOrders: customer.totalOrders || 0,
                            totalSpent: customer.totalSpent || 0,
                            averageOrderValue: customer.totalOrders > 0 ? (customer.totalSpent / customer.totalOrders) : 0,
                            lastOrderDate: customer.lastOrderDate
                          }
                        });
                        setShowCustomerModal(true);
                      }}
                      className="flex-1 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
                    >
                      Ver Detalles
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination.total > 1 && (
            <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 mt-3">
              {/* Mobile Pagination */}
              <div className="flex items-center justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-200 transition-colors"
                >
                  <FaChevronLeft className="text-[9px]" /> Anterior
                </button>
                <span className="text-xs text-slate-500">
                  {currentPage} / {pagination.total}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(pagination.total, currentPage + 1))}
                  disabled={currentPage === pagination.total}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-200 transition-colors"
                >
                  Siguiente <FaChevronRight className="text-[9px]" />
                </button>
              </div>

              {/* Desktop Pagination */}
              <div className="hidden sm:flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Mostrando <span className="font-semibold text-slate-700">{((currentPage - 1) * 20) + 1}</span> a <span className="font-semibold text-slate-700">{Math.min(currentPage * 20, pagination.totalCustomers)}</span> de <span className="font-semibold text-slate-700">{pagination.totalCustomers}</span> clientes
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <FaChevronLeft className="text-[10px]" />
                  </button>
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
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                          pageNum === currentPage
                            ? 'bg-slate-800 text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setCurrentPage(Math.min(pagination.total, currentPage + 1))}
                    disabled={currentPage === pagination.total}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <FaChevronRight className="text-[10px]" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Customer Detail Modal */}
      <AnimatePresence>
        {showCustomerModal && selectedCustomer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 overflow-y-auto"
            onClick={() => setShowCustomerModal(false)}
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col my-4 border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className={`w-10 h-10 rounded-lg ${getCustomerLevel(selectedCustomer.totalOrders || 0).color} flex items-center justify-center text-sm font-bold`}>
                      {selectedCustomer.name.charAt(0).toUpperCase()}
                    </div>
                    {(selectedCustomer.totalOrders || 0) >= 10 && (
                      <FaCrown className="absolute -top-1 -right-1 text-[8px] text-purple-500" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">{selectedCustomer.name}</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getCustomerLevel(selectedCustomer.totalOrders || 0).color}`}>
                        {getCustomerLevel(selectedCustomer.totalOrders || 0).name}
                      </span>
                      <span className="text-[10px] text-slate-400">{getCustomerAge(selectedCustomer.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowCustomerModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <FaTimes className="text-xs" />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="px-5 py-3 border-b border-slate-100 flex gap-2">
                <button
                  onClick={(e) => handleWhatsAppClick(e, selectedCustomer)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors"
                >
                  <FaWhatsapp className="text-xs" /> WhatsApp
                </button>
                <a
                  href={`tel:${selectedCustomer.phone}`}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
                >
                  <FaPhone className="text-xs" /> Llamar
                </a>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <div className="space-y-4">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                      <FaBoxOpen className="text-[10px] text-blue-500 mx-auto mb-1" />
                      <p className="text-sm font-bold text-slate-800">{selectedCustomer.totalOrders || 0}</p>
                      <p className="text-[10px] text-slate-400">{isService ? 'Citas' : 'Pedidos'}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
                      <FaDollarSign className="text-[10px] text-emerald-500 mx-auto mb-1" />
                      <p className="text-xs font-bold text-slate-800">${(selectedCustomer.totalSpent || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })}</p>
                      <p className="text-[10px] text-slate-400">Total</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-2.5 text-center">
                      <FaChartBar className="text-[10px] text-purple-500 mx-auto mb-1" />
                      <p className="text-xs font-bold text-slate-800">
                        ${((selectedCustomer.totalOrders || 0) > 0 ? (selectedCustomer.totalSpent / selectedCustomer.totalOrders) : 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })}
                      </p>
                      <p className="text-[10px] text-slate-400">Promedio</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-2.5 text-center">
                      <FaCalendarAlt className="text-[10px] text-orange-500 mx-auto mb-1" />
                      <p className="text-[11px] font-bold text-slate-800">{formatRelativeDate(selectedCustomer.lastOrderDate)}</p>
                      <p className="text-[10px] text-slate-400">Último</p>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <FaUsers className="text-[9px]" /> Información de Contacto
                    </h3>
                    <div className="grid md:grid-cols-2 gap-2">
                      <div className="bg-white p-3 rounded-lg border border-slate-100">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                          <FaPhone className="text-[8px]" /> Teléfono
                        </label>
                        <p className="text-xs font-semibold text-slate-800">{selectedCustomer.phone}</p>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-slate-100">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                          <FaEnvelope className="text-[8px]" /> Email
                        </label>
                        <p className="text-xs font-semibold text-slate-800">{selectedCustomer.email || 'No especificado'}</p>
                      </div>
                    </div>
                    {selectedCustomer.address && (
                      <div className="bg-white p-3 rounded-lg border border-slate-100">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                          <FaMapMarkerAlt className="text-[8px]" /> Dirección
                        </label>
                        <p className="text-xs font-semibold text-slate-800">{selectedCustomer.address}</p>
                      </div>
                    )}
                    <div className="bg-white p-3 rounded-lg border border-slate-100">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                        <FaCalendarAlt className="text-[8px]" /> Miembro desde
                      </label>
                      <p className="text-xs font-bold text-slate-800">
                        {selectedCustomer.createdAt ? new Date(selectedCustomer.createdAt).toLocaleDateString('es-ES', { 
                          day: 'numeric', 
                          month: 'long', 
                          year: 'numeric' 
                        }) : 'Fecha no disponible'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{getCustomerAge(selectedCustomer.createdAt)} como cliente</p>
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
            className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[60]"
            onClick={() => {
              setShowWhatsAppMenu(false);
              setWhatsappMenuCustomer(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              className="bg-white rounded-xl w-full max-w-sm border border-slate-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <FaWhatsapp className="text-xs text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Enviar WhatsApp</h3>
                    <p className="text-[10px] text-slate-400">a {whatsappMenuCustomer.name.split(' ')[0]}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowWhatsAppMenu(false);
                    setWhatsappMenuCustomer(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <FaTimes className="text-xs" />
                </button>
              </div>

              {/* Message Options */}
              <div className="p-3 space-y-1.5 max-h-[60vh] overflow-y-auto">
                {[
                  { type: 'greeting', icon: FaHandPeace, label: 'Saludo General', desc: 'Mensaje de bienvenida amigable', color: 'text-blue-500 bg-blue-50' },
                  { type: 'promotion', icon: FaGift, label: (whatsappMenuCustomer.totalOrders || 0) >= 10 ? 'Promoción VIP' : 'Promoción Especial', desc: 'Enviar oferta exclusiva', color: 'text-purple-500 bg-purple-50' },
                  { type: 'followup', icon: FaCommentDots, label: 'Seguimiento', desc: isService ? 'Preguntar sobre última cita' : 'Preguntar sobre último pedido', color: 'text-emerald-500 bg-emerald-50' },
                  { type: 'reminder', icon: isService ? FaCalendarAlt : FaUtensils, label: 'Recordatorio', desc: isService ? 'Invitar a agendar cita' : 'Invitar a hacer un pedido', color: 'text-orange-500 bg-orange-50' },
                  { type: 'feedback', icon: FaStar, label: 'Solicitar Feedback', desc: 'Pedir opinión del servicio', color: 'text-amber-500 bg-amber-50' },
                  { type: 'custom', icon: FaPen, label: 'Mensaje Personalizado', desc: 'Escribir tu propio mensaje', color: 'text-slate-500 bg-slate-50' },
                ].map(({ type, icon: Icon, label, desc, color }) => (
                  <button
                    key={type}
                    onClick={() => openWhatsAppWithMessage(whatsappMenuCustomer, type)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors text-left group"
                  >
                    <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="text-xs" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800">{label}</p>
                      <p className="text-[10px] text-slate-400">{desc}</p>
                    </div>
                    <FaChevronRight className="text-[8px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
                  <FaWhatsapp className="text-[8px]" /> Se abrirá WhatsApp con el mensaje pre-escrito
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
