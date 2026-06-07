import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import superadminApi, { subscriptionApi } from '../../services/superadminApi';
import { SAModal, SAButton, SABadge } from './ui';

const PLAN_PRICING = {
  free: { monthly: 0, annual: 0 },
  starter: { monthly: 39900, annual: 418800 },
  pro: { monthly: 59900, annual: 598800 },
  pro_max: { monthly: 89900, annual: 898800 }
};

const resolveLegacyPlanType = (billingCycle = 'monthly') => (
  billingCycle === 'annual' ? 'annual' : 'monthly'
);

const getSuggestedPrice = (commercialPlan, billingCycle) => {
  const normalizedPlan = commercialPlan || 'starter';
  const normalizedCycle = normalizedPlan === 'free' ? 'monthly' : (billingCycle || 'monthly');
  return PLAN_PRICING[normalizedPlan]?.[normalizedCycle] ?? 0;
};

const inferBillingCycle = (subscription = {}) => {
  if (subscription.billingCycle === 'monthly' || subscription.billingCycle === 'annual') {
    return subscription.billingCycle;
  }

  return subscription.planType === 'annual' ? 'annual' : 'monthly';
};

const inferCommercialPlan = (subscription = {}) => {
  if (subscription.commercialPlan === 'free' || subscription.commercialPlan === 'starter' || subscription.commercialPlan === 'pro' || subscription.commercialPlan === 'pro_max') {
    return subscription.commercialPlan;
  }

  const billingCycle = inferBillingCycle(subscription);
  const price = Number(subscription.price || 0);

  if (price <= 0) {
    return 'free';
  }

  const candidates = ['starter', 'pro', 'pro_max'];
  let closestPlan = 'starter';
  let closestDiff = Number.MAX_SAFE_INTEGER;

  candidates.forEach((candidate) => {
    const diff = Math.abs(price - getSuggestedPrice(candidate, billingCycle));
    if (diff < closestDiff) {
      closestDiff = diff;
      closestPlan = candidate;
    }
  });

  return closestPlan;
};

const formatDateForInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
};

const SubscriptionManagement = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState(null);
  const [formData, setFormData] = useState({
    businessId: '',
    planType: 'monthly',
    commercialPlan: 'starter',
    billingCycle: 'monthly',
    startDate: '',
    endDate: '',
    price: getSuggestedPrice('starter', 'monthly').toString(),
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

    if (!['free', 'starter', 'pro', 'pro_max'].includes(formData.commercialPlan)) {
      errors.commercialPlan = 'Selecciona un plan comercial válido';
    }

    if (!['monthly', 'annual'].includes(formData.billingCycle)) {
      errors.billingCycle = 'Selecciona un ciclo válido';
    }
    
    const parsedPrice = Number(formData.price);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      errors.price = 'El precio debe ser un número mayor o igual a 0';
    } else if (formData.commercialPlan === 'free' && parsedPrice !== 0) {
      errors.price = 'El plan Gratis debe tener precio 0';
    } else if (formData.commercialPlan !== 'free' && parsedPrice <= 0) {
      errors.price = 'El precio debe ser mayor a 0 para planes pagos';
    }
    
    if (formData.notes && formData.notes.length > 500) {
      errors.notes = 'Las notas no pueden exceder 500 caracteres';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const calculateEndDate = (startDateValue, planType) => {
    if (!startDateValue) return '';

    const startDate = new Date(startDateValue);
    if (Number.isNaN(startDate.getTime())) return '';

    const endDate = new Date(startDate);
    if (planType === 'annual') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else if (planType === 'semiannual') {
      endDate.setMonth(endDate.getMonth() + 6);
    } else if (planType === 'quarterly') {
      endDate.setMonth(endDate.getMonth() + 3);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    return endDate.toISOString().split('T')[0];
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

    if (name === 'commercialPlan') {
      setFormData(prev => {
        const nextCommercialPlan = value;
        const nextBillingCycle = nextCommercialPlan === 'free' ? 'monthly' : prev.billingCycle;
        const nextPlanType = resolveLegacyPlanType(nextBillingCycle);
        const nextEndDate = prev.startDate && !prev.endDate
          ? calculateEndDate(prev.startDate, nextPlanType)
          : prev.endDate;

        return {
          ...prev,
          commercialPlan: nextCommercialPlan,
          billingCycle: nextBillingCycle,
          planType: nextPlanType,
          price: getSuggestedPrice(nextCommercialPlan, nextBillingCycle).toString(),
          endDate: nextEndDate
        };
      });
      return;
    }

    if (name === 'billingCycle') {
      setFormData(prev => {
        const nextPlanType = resolveLegacyPlanType(value);
        const nextEndDate = prev.startDate && !prev.endDate
          ? calculateEndDate(prev.startDate, nextPlanType)
          : prev.endDate;

        return {
          ...prev,
          billingCycle: value,
          planType: nextPlanType,
          price: getSuggestedPrice(prev.commercialPlan, value).toString(),
          endDate: nextEndDate
        };
      });
      return;
    }

    setFormData(prev => {
      const nextData = {
        ...prev,
        [name]: value
      };

      // Auto-calcular fecha de fin si está vacía
      if (name === 'startDate' && !prev.endDate) {
        nextData.endDate = calculateEndDate(value, prev.planType);
      }

      return nextData;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setIsSubmitting(true);

      const normalizedBillingCycle = formData.commercialPlan === 'free'
        ? 'monthly'
        : formData.billingCycle;
      
      const subscriptionData = {
        ...formData,
        billingCycle: normalizedBillingCycle,
        planType: resolveLegacyPlanType(normalizedBillingCycle),
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
    const resolvedBillingCycle = inferBillingCycle(subscription);
    const resolvedCommercialPlan = inferCommercialPlan(subscription);
    setEditingSubscription(subscription);
    setFormData({
      businessId: subscription.businessId?._id || subscription.businessId || '',
      planType: subscription.planType || resolveLegacyPlanType(resolvedBillingCycle),
      commercialPlan: resolvedCommercialPlan,
      billingCycle: resolvedBillingCycle,
      startDate: formatDateForInput(subscription.startDate),
      endDate: formatDateForInput(subscription.endDate),
      price: (subscription.price ?? getSuggestedPrice(resolvedCommercialPlan, resolvedBillingCycle)).toString(),
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
      commercialPlan: 'starter',
      billingCycle: 'monthly',
      startDate: '',
      endDate: '',
      price: getSuggestedPrice('starter', 'monthly').toString(),
      notes: ''
    });
    setFormErrors({});
    setEditingSubscription(null);
    setShowForm(false);
    setIsSubmitting(false);
  };

  const getStatusVariant = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'expired': return 'danger';
      case 'cancelled': return 'neutral';
      case 'pending': return 'warning';
      default: return 'neutral';
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

  const getPlanIcon = (commercialPlan) => {
    switch (commercialPlan) {
      case 'free': return '🆓';
      case 'pro_max': return '💎';
      case 'pro': return '👑';
      default: return '🚀';
    }
  };

  const getPlanText = (commercialPlan) => {
    switch (commercialPlan) {
      case 'free': return 'Gratis';
      case 'pro_max': return 'Pro Max';
      case 'pro': return 'Pro';
      default: return 'Starter';
    }
  };

  const getBillingCycleText = (billingCycle) => (
    billingCycle === 'annual' ? 'Anual' : 'Mensual'
  );

  if (loading && subscriptions.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-2 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Suscripciones</h2>
          <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">Administra los planes de suscripción</p>
        </div>
        <SAButton
          variant="primary"
          size="md"
          onClick={() => setShowForm(true)}
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>}
        >
          Nueva Suscripción
        </SAButton>
      </div>

      {/* Subscriptions List */}
      {subscriptions.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] flex items-center justify-center">
            <span className="text-2xl">👑</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-white/40 mb-1">No hay suscripciones</p>
          <p className="text-xs text-slate-400 dark:text-white/25 mb-4">Crea la primera suscripción para comenzar</p>
          <SAButton variant="filled" size="sm" onClick={() => setShowForm(true)}>Crear Suscripción</SAButton>
        </div>
      ) : (
        <div className="space-y-2">
          {subscriptions.map((subscription, index) => {
            const commercialPlan = inferCommercialPlan(subscription);
            const billingCycle = inferBillingCycle(subscription);

            return (
              <motion.div
                key={subscription._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-xl p-4 hover:bg-slate-100 dark:hover:bg-slate-100 dark:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/[0.08] border border-cyan-500/[0.12] flex items-center justify-center shrink-0">
                      <span className="text-sm">{getPlanIcon(commercialPlan)}</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {subscription.businessId?.businessName || 'Negocio no encontrado'}
                      </h3>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-slate-500 dark:text-white/40">{getPlanText(commercialPlan)} - {getBillingCycleText(billingCycle)}</span>
                        <span className="text-xs font-medium text-slate-700 dark:text-white/70 tabular-nums">${subscription.price?.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <SABadge variant={getStatusVariant(subscription.status)} dot>{getStatusText(subscription.status)}</SABadge>
                      <p className="text-[11px] text-slate-500 dark:text-white/30 mt-1">Hasta {new Date(subscription.endDate).toLocaleDateString('es-ES')}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handleEdit(subscription)} className="p-2 rounded-lg text-slate-500 dark:text-white/30 hover:text-cyan-700 dark:hover:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-500/10 transition-all" title="Editar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                      </button>
                      <button onClick={() => handleDelete(subscription._id)} className="p-2 rounded-lg text-slate-500 dark:text-white/30 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/10 transition-all" title="Eliminar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
                {subscription.notes && (
                  <p className="text-xs text-slate-500 dark:text-white/30 mt-3 pt-3 border-t border-slate-100 dark:border-white/[0.04]">
                    <span className="text-slate-600 dark:text-white/50">Notas:</span> {subscription.notes}
                  </p>
                )}
                <div className="sm:hidden mt-2 flex items-center gap-2">
                  <SABadge variant={getStatusVariant(subscription.status)} dot>{getStatusText(subscription.status)}</SABadge>
                  <span className="text-[11px] text-slate-500 dark:text-white/30">Hasta {new Date(subscription.endDate).toLocaleDateString('es-ES')}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      <SAModal
        isOpen={showForm}
        onClose={resetForm}
        title={editingSubscription ? 'Editar Suscripción' : 'Nueva Suscripción'}
        subtitle="Gestiona el plan de un negocio"
        width="max-w-xl"
        footer={
          <>
            <SAButton variant="ghost" size="md" onClick={resetForm}>Cancelar</SAButton>
            <SAButton variant="primary" size="md" type="submit" form="sub-form" loading={isSubmitting}>
              {editingSubscription ? 'Actualizar' : 'Crear'}
            </SAButton>
          </>
        }
      >
        <form id="sub-form" onSubmit={handleSubmit} className="space-y-5">
          {/* Business */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1.5">Negocio <span className="text-red-600 dark:text-red-400">*</span></label>
            <select name="businessId" value={formData.businessId} onChange={handleInputChange}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-900 dark:text-white text-sm outline-none focus:border-cyan-500 dark:focus:border-cyan-500/40 transition-all [&>option]:bg-white dark:[&>option]:bg-[#141419]"
              required>
              <option value="">Selecciona un negocio</option>
              {businesses.map(business => (
                <option key={business._id} value={business._id}>{business.businessName}</option>
              ))}
            </select>
            {formErrors.businessId && <p className="text-red-600 dark:text-red-400 text-xs mt-1">{formErrors.businessId}</p>}
          </div>

          {/* Commercial plan and cycle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1.5">Plan Comercial <span className="text-red-600 dark:text-red-400">*</span></label>
              <select name="commercialPlan" value={formData.commercialPlan} onChange={handleInputChange}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-900 dark:text-white text-sm outline-none focus:border-cyan-500 dark:focus:border-cyan-500/40 transition-all [&>option]:bg-white dark:[&>option]:bg-[#141419]"
                required>
                <option value="free">Gratis</option>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="pro_max">Pro Max</option>
              </select>
              {formErrors.commercialPlan && <p className="text-red-600 dark:text-red-400 text-xs mt-1">{formErrors.commercialPlan}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1.5">Ciclo de Cobro <span className="text-red-600 dark:text-red-400">*</span></label>
              <select
                name="billingCycle"
                value={formData.billingCycle}
                onChange={handleInputChange}
                disabled={formData.commercialPlan === 'free'}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-900 dark:text-white text-sm outline-none focus:border-cyan-500 dark:focus:border-cyan-500/40 transition-all disabled:opacity-60 disabled:cursor-not-allowed [&>option]:bg-white dark:[&>option]:bg-[#141419]"
                required
              >
                <option value="monthly">Mensual</option>
                <option value="annual">Anual</option>
              </select>
              {formData.commercialPlan === 'free' && (
                <p className="text-[11px] text-slate-500 dark:text-white/35 mt-1">Gratis siempre usa ciclo mensual.</p>
              )}
              {formErrors.billingCycle && <p className="text-red-600 dark:text-red-400 text-xs mt-1">{formErrors.billingCycle}</p>}
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1.5">Precio <span className="text-red-600 dark:text-red-400">*</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-white/30 text-sm">$</span>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                className="w-full pl-7 pr-3 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-900 dark:text-white text-sm outline-none focus:border-cyan-500 dark:focus:border-cyan-500/40 transition-all"
                placeholder="0"
                step="0.01"
                min="0"
                readOnly={formData.commercialPlan === 'free'}
                required
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-white/35 mt-1">
              Valor sugerido: ${getSuggestedPrice(formData.commercialPlan, formData.billingCycle).toLocaleString()}
            </p>
            {formErrors.price && <p className="text-red-600 dark:text-red-400 text-xs mt-1">{formErrors.price}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1.5">Tipo de periodo (legacy)</label>
            <input
              type="text"
              value={formData.planType === 'annual' ? 'Anual' : 'Mensual'}
              readOnly
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-700 dark:text-white/70 text-sm outline-none"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1.5">Fecha Inicio <span className="text-red-600 dark:text-red-400">*</span></label>
              <input type="date" name="startDate" value={formData.startDate} onChange={handleInputChange}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-900 dark:text-white text-sm outline-none focus:border-cyan-500 dark:focus:border-cyan-500/40 transition-all [color-scheme:dark]"
                required />
              {formErrors.startDate && <p className="text-red-600 dark:text-red-400 text-xs mt-1">{formErrors.startDate}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1.5">Fecha Fin <span className="text-red-600 dark:text-red-400">*</span></label>
              <input type="date" name="endDate" value={formData.endDate} onChange={handleInputChange}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-900 dark:text-white text-sm outline-none focus:border-cyan-500 dark:focus:border-cyan-500/40 transition-all [color-scheme:dark]"
                required />
              {formErrors.endDate && <p className="text-red-600 dark:text-red-400 text-xs mt-1">{formErrors.endDate}</p>}
            </div>
          </div>

          {/* Duration info */}
          {formData.startDate && formData.endDate && (
            <div className="bg-cyan-500/[0.06] border border-cyan-200 dark:border-cyan-500/10 rounded-lg px-3 py-2.5 flex items-center gap-2">
              <svg className="w-4 h-4 text-cyan-600 dark:text-cyan-400/60 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <span className="text-xs text-cyan-600 dark:text-cyan-400/70">
                Duración: {Math.ceil((new Date(formData.endDate) - new Date(formData.startDate)) / (1000 * 60 * 60 * 24))} días
              </span>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1.5">Notas</label>
            <textarea name="notes" value={formData.notes} onChange={handleInputChange}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-900 dark:text-white text-sm outline-none focus:border-cyan-500 dark:focus:border-cyan-500/40 transition-all resize-none"
              rows="3" placeholder="Información adicional..." />
            <div className="flex justify-end mt-1">
              <p className={`text-[10px] ${formData.notes.length > 500 ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-white/20'}`}>
                {formData.notes.length}/500
              </p>
            </div>
            {formErrors.notes && <p className="text-red-600 dark:text-red-400 text-xs mt-1">{formErrors.notes}</p>}
          </div>
        </form>
      </SAModal>
    </div>
  );
};

export default SubscriptionManagement;
