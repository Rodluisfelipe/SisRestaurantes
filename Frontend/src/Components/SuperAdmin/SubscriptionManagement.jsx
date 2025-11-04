import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { FaCrown, FaPlus, FaEdit, FaTrash, FaCalendarAlt, FaDollarSign } from 'react-icons/fa';
import superadminApi, { subscriptionApi } from '../../services/superadminApi';

const SubscriptionManagement = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState(null);
  const [formData, setFormData] = useState({
    businessId: '',
    planType: 'monthly',
    startDate: '',
    endDate: '',
    price: '',
    notes: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
    
    // Escuchar eventos de actualización desde PaymentRequestsReview
    const handleSubscriptionUpdate = () => {
      loadData();
    };
    
    const handlePaymentRequestUpdate = () => {
      loadData();
    };
    
    window.addEventListener('subscription-updated', handleSubscriptionUpdate);
    window.addEventListener('payment-request-updated', handlePaymentRequestUpdate);
    
    return () => {
      window.removeEventListener('subscription-updated', handleSubscriptionUpdate);
      window.removeEventListener('payment-request-updated', handlePaymentRequestUpdate);
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Debug: verificar token
      const token = localStorage.getItem('superadmin_token');
      console.log('Token de SuperAdmin:', token ? 'Presente' : 'Ausente');
      
      const [subscriptionsRes, businessesRes] = await Promise.all([
        subscriptionApi.get('/subscriptions'),
        superadminApi.get('/business')
      ]);
      
      console.log('Respuesta de suscripciones:', subscriptionsRes.data);
      console.log('Respuesta de negocios:', businessesRes.data);
      
      setSubscriptions(subscriptionsRes.data.subscriptions || []);
      setBusinesses(businessesRes.data.businesses || []);
    } catch (error) {
      console.error('Error loading data:', error);
      console.error('Error response:', error.response);
      
      // Mostrar error más específico
      if (error.response?.status === 401) {
        console.error('Error de autenticación - token inválido o expirado');
        alert('Error de autenticación. Por favor, inicia sesión nuevamente.');
      } else if (error.response?.status === 403) {
        console.error('Error de autorización - se requiere rol de superadmin');
        alert('Error de autorización. No tienes permisos para acceder a esta función.');
      } else {
        console.error('Error del servidor:', error.response?.data?.message || error.message);
        alert(`Error del servidor: ${error.response?.data?.message || error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.businessId) {
      errors.businessId = 'Debes seleccionar un negocio';
    }
    
    if (!formData.startDate) {
      errors.startDate = 'La fecha de inicio es requerida';
    }
    
    if (!formData.endDate) {
      errors.endDate = 'La fecha de fin es requerida';
    } else if (formData.startDate) {
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);
      
      if (endDate <= startDate) {
        errors.endDate = 'La fecha de fin debe ser posterior a la fecha de inicio';
      }
    }
    
    if (!formData.price || formData.price <= 0) {
      errors.price = 'El precio debe ser mayor a 0';
    }
    
    if (formData.notes && formData.notes.length > 500) {
      errors.notes = 'Las notas no pueden exceder 500 caracteres';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Limpiar error del campo cuando el usuario empiece a escribir
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Auto-calcular fecha de fin basada en el tipo de plan (solo si endDate está vacío o si el usuario quiere auto-calcular)
    // No sobrescribir si el usuario ya editó la fecha de fin manualmente
    if ((name === 'planType' || name === 'startDate') && !formData.endDate) {
      if (formData.startDate && value) {
        const startDate = new Date(name === 'startDate' ? value : formData.startDate);
        const planType = name === 'planType' ? value : formData.planType;
        
        const endDate = new Date(startDate);
        if (planType === 'monthly') {
          endDate.setMonth(endDate.getMonth() + 1);
        } else if (planType === 'annual') {
          endDate.setFullYear(endDate.getFullYear() + 1);
        }
        
        setFormData(prev => ({
          ...prev,
          endDate: endDate.toISOString().split('T')[0]
        }));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const subscriptionData = {
        ...formData,
        price: parseFloat(formData.price)
      };

      if (editingSubscription) {
        await subscriptionApi.put(`/subscriptions/${editingSubscription._id}`, subscriptionData);
      } else {
        await subscriptionApi.post('/subscriptions', subscriptionData);
      }
      
      await loadData();
      resetForm();
      
      // Notificar a otros componentes
      window.dispatchEvent(new CustomEvent('subscription-updated'));
    } catch (error) {
      console.error('Error saving subscription:', error);
      alert(`Error al guardar la suscripción: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (subscription) => {
    setEditingSubscription(subscription);
    setFormData({
      businessId: subscription.businessId._id,
      planType: subscription.planType,
      startDate: subscription.startDate.split('T')[0],
      endDate: subscription.endDate.split('T')[0],
      price: subscription.price.toString(),
      notes: subscription.notes || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (subscriptionId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta suscripción?')) {
      return;
    }

    try {
      setLoading(true);
      await subscriptionApi.delete(`/subscriptions/${subscriptionId}`);
      await loadData();
      
      // Notificar a otros componentes
      window.dispatchEvent(new CustomEvent('subscription-updated'));
    } catch (error) {
      console.error('Error deleting subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      businessId: '',
      planType: 'monthly',
      startDate: '',
      endDate: '',
      price: '',
      notes: ''
    });
    setFormErrors({});
    setEditingSubscription(null);
    setShowForm(false);
    setIsSubmitting(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'expired': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return 'Activo';
      case 'expired': return 'Expirado';
      case 'cancelled': return 'Cancelado';
      case 'pending': return 'Pendiente';
      default: return 'Desconocido';
    }
  };

  const getPlanIcon = (planType) => {
    return planType === 'annual' ? '👑' : '📅';
  };

  const getPlanText = (planType) => {
    return planType === 'annual' ? 'Plan Anual' : 'Plan Mensual';
  };

  if (loading && subscriptions.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <FaCrown className="text-white text-xl" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-white">Gestión de Suscripciones</h2>
              <p className="text-white/80 text-sm md:text-base">Administra los planes de suscripción de los negocios</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 flex items-center justify-center space-x-2 font-semibold shadow-lg"
        >
          <FaPlus size={16} />
          <span>Nueva Suscripción</span>
        </button>
      </div>

      {/* Subscriptions List */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-6">
        {subscriptions.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <FaCrown className="text-white text-3xl" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No hay suscripciones registradas</h3>
            <p className="text-white/70 mb-6">Crea la primera suscripción para comenzar a gestionar los planes de los negocios</p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-semibold"
            >
              <FaPlus size={16} />
              <span>Crear Primera Suscripción</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {subscriptions.map((subscription, index) => (
              <motion.div
                key={subscription._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white/5 backdrop-blur-sm rounded-xl p-4 md:p-6 border border-white/10 hover:bg-white/10 transition-all duration-200"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Business Info */}
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xl">
                        {getPlanIcon(subscription.planType)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-white font-semibold text-lg truncate">
                        {subscription.businessId?.businessName || 'Negocio no encontrado'}
                      </h3>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 text-white/70 text-sm">
                        <span className="flex items-center space-x-1">
                          <span>{getPlanText(subscription.planType)}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <FaDollarSign size={12} />
                          <span className="font-semibold text-white">{subscription.price.toLocaleString()}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Status and Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Status and Date */}
                    <div className="flex flex-col sm:items-end space-y-2">
                      <div className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(subscription.status)}`}>
                        {getStatusText(subscription.status)}
                      </div>
                      <div className="text-white/70 text-sm">
                        <div className="flex items-center space-x-1">
                          <FaCalendarAlt size={12} />
                          <span>Hasta: {new Date(subscription.endDate).toLocaleDateString('es-ES')}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(subscription)}
                        className="p-3 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 hover:text-blue-300 rounded-xl transition-all duration-200 flex items-center justify-center"
                        title="Editar suscripción"
                      >
                        <FaEdit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(subscription._id)}
                        className="p-3 bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 rounded-xl transition-all duration-200 flex items-center justify-center"
                        title="Eliminar suscripción"
                      >
                        <FaTrash size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Additional Info (Notes) */}
                {subscription.notes && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-white/60 text-sm">
                      <span className="font-medium text-white/80">Notas:</span> {subscription.notes}
                    </p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <FaCrown className="text-white text-lg" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {editingSubscription ? 'Editar Suscripción' : 'Nueva Suscripción'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {editingSubscription ? 'Modifica los datos de la suscripción' : 'Crea una nueva suscripción para un negocio'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Form Content */}
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Business Selection */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    <span className="flex items-center space-x-2">
                      <span>🏢</span>
                      <span>Negocio</span>
                      <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <select
                    name="businessId"
                    value={formData.businessId}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all duration-200 bg-white text-gray-900 ${
                      formErrors.businessId 
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                        : 'border-gray-200 focus:ring-blue-500 focus:border-transparent'
                    }`}
                    required
                  >
                    <option value="">Selecciona un negocio</option>
                    {businesses.map(business => (
                      <option key={business._id} value={business._id}>
                        {business.businessName}
                      </option>
                    ))}
                  </select>
                  {formErrors.businessId && (
                    <p className="text-red-500 text-sm flex items-center space-x-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span>{formErrors.businessId}</span>
                    </p>
                  )}
                </div>

                {/* Plan Type and Price Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      <span className="flex items-center space-x-2">
                        <span>📅</span>
                        <span>Tipo de Plan</span>
                        <span className="text-red-500">*</span>
                      </span>
                    </label>
                    <select
                      name="planType"
                      value={formData.planType}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white text-gray-900"
                      required
                    >
                      <option value="monthly">📅 Plan Mensual</option>
                      <option value="annual">👑 Plan Anual</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      <span className="flex items-center space-x-2">
                        <span>💰</span>
                        <span>Precio</span>
                        <span className="text-red-500">*</span>
                      </span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold">$</span>
                      <input
                        type="number"
                        name="price"
                        value={formData.price}
                        onChange={handleInputChange}
                        className={`w-full pl-8 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all duration-200 bg-white text-gray-900 ${
                          formErrors.price 
                            ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                            : 'border-gray-200 focus:ring-blue-500 focus:border-transparent'
                        }`}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        required
                      />
                    </div>
                    {formErrors.price && (
                      <p className="text-red-500 text-sm flex items-center space-x-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span>{formErrors.price}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Date Range */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
                    <FaCalendarAlt className="text-blue-500" />
                    <span>Período de Suscripción</span>
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700">
                        <span className="flex items-center space-x-2">
                          <span>📅</span>
                          <span>Fecha de Inicio</span>
                          <span className="text-red-500">*</span>
                        </span>
                      </label>
                      <input
                        type="date"
                        name="startDate"
                        value={formData.startDate}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all duration-200 bg-white text-gray-900 ${
                          formErrors.startDate 
                            ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                            : 'border-gray-200 focus:ring-blue-500 focus:border-transparent'
                        }`}
                        required
                      />
                      {formErrors.startDate && (
                        <p className="text-red-500 text-sm flex items-center space-x-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <span>{formErrors.startDate}</span>
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700">
                        <span className="flex items-center space-x-2">
                          <span>🏁</span>
                          <span>Fecha de Fin</span>
                          <span className="text-red-500">*</span>
                        </span>
                      </label>
                      <input
                        type="date"
                        name="endDate"
                        value={formData.endDate}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all duration-200 bg-white text-gray-900 ${
                          formErrors.endDate 
                            ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                            : 'border-gray-200 focus:ring-blue-500 focus:border-transparent'
                        }`}
                        required
                      />
                      {formErrors.endDate && (
                        <p className="text-red-500 text-sm flex items-center space-x-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <span>{formErrors.endDate}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Auto-calculated duration info */}
                  {formData.startDate && formData.endDate && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <div className="flex items-center space-x-2 text-blue-800">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" />
                        </svg>
                        <span className="text-sm font-medium">
                          Duración: {Math.ceil((new Date(formData.endDate) - new Date(formData.startDate)) / (1000 * 60 * 60 * 24))} días
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    <span className="flex items-center space-x-2">
                      <span>📝</span>
                      <span>Notas Adicionales</span>
                    </span>
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all duration-200 bg-white text-gray-900 resize-none ${
                      formErrors.notes 
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                        : 'border-gray-200 focus:ring-blue-500 focus:border-transparent'
                    }`}
                    rows="4"
                    placeholder="Agrega cualquier información adicional sobre esta suscripción..."
                  />
                  <div className="flex justify-between items-center">
                    <p className={`text-xs ${formData.notes.length > 500 ? 'text-red-500' : 'text-gray-500'}`}>
                      {formData.notes.length}/500 caracteres
                    </p>
                    {formErrors.notes && (
                      <p className="text-red-500 text-sm flex items-center space-x-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span>{formErrors.notes}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-200 font-semibold flex items-center justify-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span>Cancelar</span>
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-semibold flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{editingSubscription ? 'Actualizar' : 'Crear'} Suscripción</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionManagement;
