import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';
import { getBusinessSlug } from '../utils/getBusinessId';

const CouponsManager = () => {
  const { businessConfig } = useBusinessConfig();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [discountTypeFilter, setDiscountTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);

  // Get business ID
  const businessId = businessConfig?.businessId || getBusinessSlug();

  // Form state for creating/editing coupons
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    discountType: 'percentage',
    discountValue: 0,
    maxDiscountAmount: null,
    minimumOrderAmount: 0,
    usageLimit: null,
    usageLimitPerCustomer: 1,
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: '',
    applicableOrderTypes: ['inSite', 'takeaway', 'delivery'],
    isActive: true
  });

  // Fetch coupons
  const fetchCoupons = async () => {
    
    if (!businessId) {
      console.log('Business ID not available yet');
      return;
    }
    
    try {
      setLoading(true);
      const response = await api.get('/coupons', {
        params: {
          businessId: businessId,
          page: currentPage,
          limit: 20,
          search: searchTerm,
          status: statusFilter,
          discountType: discountTypeFilter,
          sortBy,
          sortOrder
        }
      });
      
      setCoupons(response.data.coupons);
      setStats(response.data.stats);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error fetching coupons:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const businessId = businessConfig?.businessId || getBusinessSlug();
    if (businessId) {
      fetchCoupons();
    }
  }, [businessConfig?.businessId, currentPage, searchTerm, statusFilter, discountTypeFilter, sortBy, sortOrder]);

  // Generate unique coupon code
  const generateCode = async () => {
    try {
      let businessId = businessConfig?.businessId;
      if (!businessId) {
        businessId = getBusinessSlug();
      }
      
      const response = await api.post('/coupons/generate-code', {
        businessId,
        length: 8
      });
      
      setFormData(prev => ({ ...prev, code: response.data.code }));
    } catch (error) {
      console.error('Error generating code:', error);
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const couponData = {
        ...formData,
        businessId,
        validFrom: new Date(formData.validFrom),
        validUntil: new Date(formData.validUntil)
      };
      
      if (editingCoupon) {
        await api.put(`/coupons/${editingCoupon._id}`, couponData);
      } else {
        await api.post('/coupons', couponData);
      }
      
      setShowCreateModal(false);
      setEditingCoupon(null);
      resetForm();
      fetchCoupons();
    } catch (error) {
      console.error('Error saving coupon:', error);
      alert('Error al guardar el cupón');
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      discountType: 'percentage',
      discountValue: 0,
      maxDiscountAmount: null,
      minimumOrderAmount: 0,
      usageLimit: null,
      usageLimitPerCustomer: 1,
      validFrom: new Date().toISOString().split('T')[0],
      validUntil: '',
      applicableOrderTypes: ['inSite', 'takeaway', 'delivery'],
      isActive: true
    });
  };

  // Edit coupon
  const handleEdit = (coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      name: coupon.name,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscountAmount: coupon.maxDiscountAmount,
      minimumOrderAmount: coupon.minimumOrderAmount,
      usageLimit: coupon.usageLimit,
      usageLimitPerCustomer: coupon.usageLimitPerCustomer,
      validFrom: new Date(coupon.validFrom).toISOString().split('T')[0],
      validUntil: new Date(coupon.validUntil).toISOString().split('T')[0],
      applicableOrderTypes: coupon.applicableOrderTypes,
      isActive: coupon.isActive
    });
    setShowCreateModal(true);
  };

  // Delete coupon
  const handleDelete = async (couponId) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este cupón?')) {
      return;
    }
    
    try {
      await api.delete(`/coupons/${couponId}?businessId=${businessId}`);
      fetchCoupons();
    } catch (error) {
      console.error('Error deleting coupon:', error);
      alert('Error al eliminar el cupón');
    }
  };

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
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get status badge
  const getStatusBadge = (coupon) => {
    const now = new Date();
    if (!coupon.isActive) {
      return 'bg-gray-100 text-gray-800';
    } else if (now > new Date(coupon.validUntil)) {
      return 'bg-red-100 text-red-800';
    } else if (now < new Date(coupon.validFrom)) {
      return 'bg-yellow-100 text-yellow-800';
    } else {
      return 'bg-green-100 text-green-800';
    }
  };

  // Get status text
  const getStatusText = (coupon) => {
    const now = new Date();
    if (!coupon.isActive) {
      return 'Inactivo';
    } else if (now > new Date(coupon.validUntil)) {
      return 'Expirado';
    } else if (now < new Date(coupon.validFrom)) {
      return 'Pendiente';
    } else {
      return 'Activo';
    }
  };

  // Get discount type icon
  const getDiscountIcon = (type) => {
    const icons = {
      percentage: '%',
      fixed: '$',
      free_delivery: '🚚'
    };
    return icons[type] || '%';
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Gestión de Cupones</h2>
          <p className="text-gray-600">Crea y administra cupones de descuento para tus clientes</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingCoupon(null);
            setShowCreateModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Crear Cupón
        </button>
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
              <span className="text-2xl">🎫</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Total Cupones</p>
              <p className="text-xl font-semibold">{stats.totalCoupons || 0}</p>
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
              <span className="text-2xl">✅</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Cupones Activos</p>
              <p className="text-xl font-semibold">{stats.activeCoupons || 0}</p>
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
            <div className="p-2 bg-purple-100 rounded-lg">
              <span className="text-2xl">📊</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Total Usos</p>
              <p className="text-xl font-semibold">{stats.totalUsage || 0}</p>
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
            <div className="p-2 bg-yellow-100 rounded-lg">
              <span className="text-2xl">💰</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Descuento Total</p>
              <p className="text-xl font-semibold">{formatCurrency(stats.totalDiscountGiven || 0)}</p>
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
              placeholder="Buscar por código, nombre o descripción..."
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
              <option value="expired">Expirados</option>
            </select>
            <select
              value={discountTypeFilter}
              onChange={(e) => setDiscountTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos los tipos</option>
              <option value="percentage">Porcentaje</option>
              <option value="fixed">Monto fijo</option>
              <option value="free_delivery">Envío gratis</option>
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
              <option value="createdAt-desc">Más recientes</option>
              <option value="createdAt-asc">Más antiguos</option>
              <option value="usageCount-desc">Más usados</option>
              <option value="validUntil-asc">Expiran pronto</option>
            </select>
          </div>
        </div>
      </div>

      {/* Coupons Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Cargando cupones...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cupón
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Descuento
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Condiciones
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Uso
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <AnimatePresence>
                    {coupons.map((coupon, index) => (
                      <motion.tr
                        key={coupon._id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.05 }}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {coupon.code}
                            </div>
                            <div className="text-sm text-gray-500">
                              {coupon.name}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-lg mr-1">{getDiscountIcon(coupon.discountType)}</span>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {coupon.discountType === 'percentage' 
                                  ? `${coupon.discountValue}%`
                                  : coupon.discountType === 'fixed'
                                  ? formatCurrency(coupon.discountValue)
                                  : 'Envío gratis'
                                }
                              </div>
                              {coupon.maxDiscountAmount && (
                                <div className="text-xs text-gray-500">
                                  Máx: {formatCurrency(coupon.maxDiscountAmount)}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            Mín: {formatCurrency(coupon.minimumOrderAmount)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {coupon.usageLimit ? `Límite: ${coupon.usageLimit}` : 'Sin límite'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(coupon)}`}>
                            {getStatusText(coupon)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div>{coupon.usageCount} usos</div>
                          <div>{formatCurrency(coupon.totalDiscountGiven)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                setSelectedCoupon(coupon);
                                setShowCouponModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Ver
                            </button>
                            <button
                              onClick={() => handleEdit(coupon)}
                              className="text-green-600 hover:text-green-900"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDelete(coupon._id)}
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

      {/* Create/Edit Coupon Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  {editingCoupon ? 'Editar Cupón' : 'Crear Nuevo Cupón'}
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Código del Cupón
                    </label>
                    <div className="flex">
                      <input
                        type="text"
                        value={formData.code}
                        onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ej: DESCUENTO20"
                        required
                      />
                      <button
                        type="button"
                        onClick={generateCode}
                        className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg hover:bg-gray-200"
                      >
                        Generar
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ej: Descuento del 20%"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows="2"
                    placeholder="Descripción del cupón..."
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo de Descuento
                    </label>
                    <select
                      value={formData.discountType}
                      onChange={(e) => setFormData(prev => ({ ...prev, discountType: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="percentage">Porcentaje</option>
                      <option value="fixed">Monto fijo</option>
                      <option value="free_delivery">Envío gratis</option>
                    </select>
                  </div>
                  
                  {formData.discountType !== 'free_delivery' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Valor del Descuento
                      </label>
                      <input
                        type="number"
                        value={formData.discountValue}
                        onChange={(e) => setFormData(prev => ({ ...prev, discountValue: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>
                  )}
                  
                  {formData.discountType === 'percentage' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Descuento Máximo
                      </label>
                      <input
                        type="number"
                        value={formData.maxDiscountAmount || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, maxDiscountAmount: parseFloat(e.target.value) || null }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="0"
                        step="0.01"
                        placeholder="Sin límite"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Monto Mínimo del Pedido
                    </label>
                    <input
                      type="number"
                      value={formData.minimumOrderAmount}
                      onChange={(e) => setFormData(prev => ({ ...prev, minimumOrderAmount: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Límite de Usos
                    </label>
                    <input
                      type="number"
                      value={formData.usageLimit || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, usageLimit: parseInt(e.target.value) || null }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="1"
                      placeholder="Sin límite"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Válido Desde
                    </label>
                    <input
                      type="date"
                      value={formData.validFrom}
                      onChange={(e) => setFormData(prev => ({ ...prev, validFrom: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Válido Hasta
                    </label>
                    <input
                      type="date"
                      value={formData.validUntil}
                      onChange={(e) => setFormData(prev => ({ ...prev, validUntil: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                    Cupón activo
                  </label>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700"
                  >
                    {editingCoupon ? 'Actualizar' : 'Crear'} Cupón
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Coupon Detail Modal */}
      <AnimatePresence>
        {showCouponModal && selectedCoupon && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowCouponModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Detalles del Cupón</h3>
                <button
                  onClick={() => setShowCouponModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Código</label>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{selectedCoupon.code}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nombre</label>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{selectedCoupon.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tipo de Descuento</label>
                    <p className="mt-1 text-lg font-semibold text-gray-900">
                      {selectedCoupon.discountType === 'percentage' 
                        ? `${selectedCoupon.discountValue}%`
                        : selectedCoupon.discountType === 'fixed'
                        ? formatCurrency(selectedCoupon.discountValue)
                        : 'Envío gratis'
                      }
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Estado</label>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(selectedCoupon)}`}>
                      {getStatusText(selectedCoupon)}
                    </span>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Estadísticas de Uso</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Total de Usos</label>
                      <p className="mt-1 text-lg font-semibold text-gray-900">{selectedCoupon.usageCount}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Descuento Total Dado</label>
                      <p className="mt-1 text-lg font-semibold text-gray-900">{formatCurrency(selectedCoupon.totalDiscountGiven)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Válido Desde</label>
                      <p className="mt-1 text-lg font-semibold text-gray-900">{formatDate(selectedCoupon.validFrom)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Válido Hasta</label>
                      <p className="mt-1 text-lg font-semibold text-gray-900">{formatDate(selectedCoupon.validUntil)}</p>
                    </div>
                  </div>
                </div>

                {selectedCoupon.description && (
                  <div className="border-t pt-4">
                    <label className="block text-sm font-medium text-gray-700">Descripción</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedCoupon.description}</p>
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

export default CouponsManager;
