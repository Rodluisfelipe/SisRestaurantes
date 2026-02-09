import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTicketAlt, FaCheckCircle, FaChartBar, FaDollarSign, FaSearch, FaPlus, FaEye, FaEdit, FaTrash, FaTimes, FaSyncAlt, FaBoxOpen, FaPercent, FaTruck, FaChevronLeft, FaChevronRight, FaDice, FaCalendarAlt, FaTag } from 'react-icons/fa';
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
      percentage: FaPercent,
      fixed: FaDollarSign,
      free_delivery: FaTruck
    };
    return icons[type] || FaPercent;
  };

  const discountIconColors = {
    percentage: 'text-blue-500 bg-blue-50',
    fixed: 'text-emerald-500 bg-emerald-50',
    free_delivery: 'text-orange-500 bg-orange-50'
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            resetForm();
            setEditingCoupon(null);
            setShowCreateModal(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors"
        >
          <FaPlus className="text-[9px]" /> Crear Cupón
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          { icon: FaTicketAlt, label: 'Total Cupones', value: stats.totalCoupons || 0, color: 'text-blue-500 bg-blue-50' },
          { icon: FaCheckCircle, label: 'Activos', value: stats.activeCoupons || 0, color: 'text-emerald-500 bg-emerald-50' },
          { icon: FaChartBar, label: 'Total Usos', value: stats.totalUsage || 0, color: 'text-purple-500 bg-purple-50' },
          { icon: FaDollarSign, label: 'Descuento Total', value: formatCurrency(stats.totalDiscountGiven || 0), color: 'text-amber-500 bg-amber-50' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
              <Icon className="text-xs" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-slate-400 font-medium">{label}</p>
              <p className="text-sm font-bold text-slate-800 truncate">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-3">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="flex-1 relative">
            <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por código, nombre o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 focus:border-slate-300 outline-none"
            />
          </div>
          <div className="flex gap-1.5">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 outline-none text-slate-600"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
              <option value="expired">Expirados</option>
            </select>
            <select
              value={discountTypeFilter}
              onChange={(e) => setDiscountTypeFilter(e.target.value)}
              className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 outline-none text-slate-600"
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
              className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 outline-none text-slate-600"
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
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-sm text-slate-400">
            <FaSyncAlt className="animate-spin mr-2 text-xs" /> Cargando cupones...
          </div>
        ) : coupons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <FaBoxOpen className="text-2xl text-slate-300 mb-2" />
            <p className="text-sm text-slate-500 font-medium">No se encontraron cupones</p>
            <p className="text-xs text-slate-400 mt-1">Crea tu primer cupón de descuento</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Cupón</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Descuento</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Condiciones</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Uso</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {coupons.map((coupon) => {
                    const DiscIcon = getDiscountIcon(coupon.discountType);
                    return (
                      <tr key={coupon._id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-2.5">
                          <p className="text-xs font-bold text-slate-800 font-mono tracking-wider">{coupon.code}</p>
                          <p className="text-[10px] text-slate-400">{coupon.name}</p>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded flex items-center justify-center ${discountIconColors[coupon.discountType] || 'text-slate-500 bg-slate-50'}`}>
                              <DiscIcon className="text-[9px]" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-800">
                                {coupon.discountType === 'percentage'
                                  ? `${coupon.discountValue}%`
                                  : coupon.discountType === 'fixed'
                                  ? formatCurrency(coupon.discountValue)
                                  : 'Envío gratis'}
                              </p>
                              {coupon.maxDiscountAmount && (
                                <p className="text-[10px] text-slate-400">Máx: {formatCurrency(coupon.maxDiscountAmount)}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="text-xs text-slate-700">Mín: {formatCurrency(coupon.minimumOrderAmount)}</p>
                          <p className="text-[10px] text-slate-400">{coupon.usageLimit ? `Límite: ${coupon.usageLimit}` : 'Sin límite'}</p>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${getStatusBadge(coupon)}`}>
                            {getStatusText(coupon)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="text-xs font-medium text-slate-700">{coupon.usageCount} usos</p>
                          <p className="text-[10px] text-emerald-600">{formatCurrency(coupon.totalDiscountGiven)}</p>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setSelectedCoupon(coupon); setShowCouponModal(true); }}
                              className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Ver"
                            >
                              <FaEye className="text-xs" />
                            </button>
                            <button
                              onClick={() => handleEdit(coupon)}
                              className="p-1.5 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <FaEdit className="text-xs" />
                            </button>
                            <button
                              onClick={() => handleDelete(coupon._id)}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-slate-100">
              {coupons.map((coupon) => {
                const DiscIcon = getDiscountIcon(coupon.discountType);
                return (
                  <div key={coupon._id} className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${discountIconColors[coupon.discountType] || 'text-slate-500 bg-slate-50'}`}>
                          <DiscIcon className="text-[10px]" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 font-mono">{coupon.code}</p>
                          <p className="text-[10px] text-slate-400">{coupon.name}</p>
                        </div>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getStatusBadge(coupon)}`}>
                        {getStatusText(coupon)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">
                        {coupon.discountType === 'percentage'
                          ? `${coupon.discountValue}%`
                          : coupon.discountType === 'fixed'
                          ? formatCurrency(coupon.discountValue)
                          : 'Envío gratis'}
                      </span>
                      <span className="text-slate-400">{coupon.usageCount} usos · {formatCurrency(coupon.totalDiscountGiven)}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => { setSelectedCoupon(coupon); setShowCouponModal(true); }} className="flex-1 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[11px] font-medium hover:bg-blue-100 transition-colors">Ver</button>
                      <button onClick={() => handleEdit(coupon)} className="flex-1 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[11px] font-medium hover:bg-emerald-100 transition-colors">Editar</button>
                      <button onClick={() => handleDelete(coupon._id)} className="py-1.5 px-3 bg-red-50 text-red-500 rounded-lg text-[11px] font-medium hover:bg-red-100 transition-colors"><FaTrash className="text-[10px]" /></button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="px-4 py-3 border-t border-slate-100">
                <div className="flex items-center justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg disabled:opacity-40 hover:bg-slate-200 transition-colors"
                  >
                    <FaChevronLeft className="text-[9px]" /> Anterior
                  </button>
                  <span className="text-xs text-slate-500">{currentPage} / {pagination.pages}</span>
                  <button
                    onClick={() => setCurrentPage(Math.min(pagination.pages, currentPage + 1))}
                    disabled={currentPage === pagination.pages}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg disabled:opacity-40 hover:bg-slate-200 transition-colors"
                  >
                    Siguiente <FaChevronRight className="text-[9px]" />
                  </button>
                </div>
                <div className="hidden sm:flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    Mostrando <span className="font-semibold text-slate-700">{((currentPage - 1) * 20) + 1}</span> a <span className="font-semibold text-slate-700">{Math.min(currentPage * 20, pagination.total)}</span> de <span className="font-semibold text-slate-700">{pagination.total}</span>
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                      <FaChevronLeft className="text-[10px]" />
                    </button>
                    {Array.from({ length: Math.min(pagination.pages, 7) }, (_, i) => {
                      let pageNum;
                      if (pagination.pages <= 7) pageNum = i + 1;
                      else if (currentPage <= 4) pageNum = i + 1;
                      else if (currentPage >= pagination.pages - 3) pageNum = pagination.pages - 6 + i;
                      else pageNum = currentPage - 3 + i;
                      return (
                        <button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${pageNum === currentPage ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                          {pageNum}
                        </button>
                      );
                    })}
                    <button onClick={() => setCurrentPage(Math.min(pagination.pages, currentPage + 1))} disabled={currentPage === pagination.pages} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                      <FaChevronRight className="text-[10px]" />
                    </button>
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
            className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
                    <FaTicketAlt className="text-xs text-blue-500" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {editingCoupon ? 'Editar Cupón' : 'Crear Nuevo Cupón'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <FaTimes className="text-xs" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {/* Code + Name */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Código</label>
                    <div className="flex">
                      <input
                        type="text"
                        value={formData.code}
                        onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                        className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-l-lg focus:ring-1 focus:ring-slate-300 outline-none font-mono"
                        placeholder="Ej: DESCUENTO20"
                        required
                      />
                      <button
                        type="button"
                        onClick={generateCode}
                        className="px-2 py-1.5 bg-slate-100 border border-l-0 border-slate-200 rounded-r-lg hover:bg-slate-200 transition-colors"
                        title="Generar código"
                      >
                        <FaDice className="text-xs text-slate-500" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Nombre</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 outline-none"
                      placeholder="Ej: Descuento del 20%"
                      required
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Descripción</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 outline-none resize-none"
                    rows="2"
                    placeholder="Descripción del cupón..."
                  />
                </div>

                {/* Discount Type + Value + Max */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Tipo</label>
                    <select
                      value={formData.discountType}
                      onChange={(e) => setFormData(prev => ({ ...prev, discountType: e.target.value }))}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 outline-none"
                    >
                      <option value="percentage">Porcentaje</option>
                      <option value="fixed">Monto fijo</option>
                      <option value="free_delivery">Envío gratis</option>
                    </select>
                  </div>
                  {formData.discountType !== 'free_delivery' && (
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Valor</label>
                      <input
                        type="number"
                        value={formData.discountValue}
                        onChange={(e) => setFormData(prev => ({ ...prev, discountValue: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 outline-none"
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>
                  )}
                  {formData.discountType === 'percentage' && (
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Desc. Máximo</label>
                      <input
                        type="number"
                        value={formData.maxDiscountAmount || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, maxDiscountAmount: parseFloat(e.target.value) || null }))}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 outline-none"
                        min="0"
                        step="0.01"
                        placeholder="Sin límite"
                      />
                    </div>
                  )}
                </div>

                {/* Min Order + Usage Limit */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Monto Mínimo</label>
                    <input
                      type="number"
                      value={formData.minimumOrderAmount}
                      onChange={(e) => setFormData(prev => ({ ...prev, minimumOrderAmount: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 outline-none"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Límite de Usos</label>
                    <input
                      type="number"
                      value={formData.usageLimit || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, usageLimit: parseInt(e.target.value) || null }))}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 outline-none"
                      min="1"
                      placeholder="Sin límite"
                    />
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Válido Desde</label>
                    <input
                      type="date"
                      value={formData.validFrom}
                      onChange={(e) => setFormData(prev => ({ ...prev, validFrom: e.target.value }))}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Válido Hasta</label>
                    <input
                      type="date"
                      value={formData.validUntil}
                      onChange={(e) => setFormData(prev => ({ ...prev, validUntil: e.target.value }))}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 outline-none"
                      required
                    />
                  </div>
                </div>

                {/* Active Toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="h-3.5 w-3.5 text-slate-800 focus:ring-slate-300 border-slate-300 rounded"
                  />
                  <span className="text-xs text-slate-700 font-medium">Cupón activo</span>
                </label>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
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
            className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
            onClick={() => setShowCouponModal(false)}
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              className="bg-white rounded-xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
                    <FaEye className="text-xs text-blue-500" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">Detalles del Cupón</h3>
                </div>
                <button
                  onClick={() => setShowCouponModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <FaTimes className="text-xs" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {/* Code + Name */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Código</p>
                    <p className="text-sm font-bold text-slate-800 font-mono">{selectedCoupon.code}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Nombre</p>
                    <p className="text-xs font-semibold text-slate-800">{selectedCoupon.name}</p>
                  </div>
                </div>

                {/* Discount + Status */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Descuento</p>
                    <p className="text-sm font-bold text-slate-800">
                      {selectedCoupon.discountType === 'percentage'
                        ? `${selectedCoupon.discountValue}%`
                        : selectedCoupon.discountType === 'fixed'
                        ? formatCurrency(selectedCoupon.discountValue)
                        : 'Envío gratis'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Estado</p>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${getStatusBadge(selectedCoupon)}`}>
                      {getStatusText(selectedCoupon)}
                    </span>
                  </div>
                </div>

                {/* Usage Stats */}
                <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <FaChartBar className="text-[8px]" /> Estadísticas de Uso
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                      <p className="text-[10px] text-slate-400">Total de Usos</p>
                      <p className="text-sm font-bold text-slate-800">{selectedCoupon.usageCount}</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                      <p className="text-[10px] text-slate-400">Descuento Dado</p>
                      <p className="text-xs font-bold text-emerald-600">{formatCurrency(selectedCoupon.totalDiscountGiven)}</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                      <p className="text-[10px] text-slate-400">Válido Desde</p>
                      <p className="text-xs font-semibold text-slate-700">{formatDate(selectedCoupon.validFrom)}</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                      <p className="text-[10px] text-slate-400">Válido Hasta</p>
                      <p className="text-xs font-semibold text-slate-700">{formatDate(selectedCoupon.validUntil)}</p>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {selectedCoupon.description && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Descripción</p>
                    <p className="text-xs text-slate-600">{selectedCoupon.description}</p>
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
