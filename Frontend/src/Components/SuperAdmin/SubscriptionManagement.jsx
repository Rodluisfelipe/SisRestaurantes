import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaCrown, FaPlus, FaEdit, FaTrash, FaCalendarAlt, FaDollarSign } from 'react-icons/fa';
import superadminApi from '../../services/superadminApi';

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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [subscriptionsRes, businessesRes] = await Promise.all([
        superadminApi.get('/subscriptions'),
        superadminApi.get('/businesses')
      ]);
      
      setSubscriptions(subscriptionsRes.data.subscriptions || []);
      setBusinesses(businessesRes.data.businesses || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Auto-calcular fecha de fin basada en el tipo de plan
    if (name === 'planType' || name === 'startDate') {
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
    try {
      setLoading(true);
      
      const subscriptionData = {
        ...formData,
        price: parseFloat(formData.price)
      };

      if (editingSubscription) {
        await superadminApi.put(`/subscriptions/${editingSubscription._id}`, subscriptionData);
      } else {
        await superadminApi.post('/subscriptions', subscriptionData);
      }
      
      await loadData();
      resetForm();
    } catch (error) {
      console.error('Error saving subscription:', error);
    } finally {
      setLoading(false);
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
      await superadminApi.delete(`/subscriptions/${subscriptionId}`);
      await loadData();
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
    setEditingSubscription(null);
    setShowForm(false);
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Gestión de Suscripciones</h2>
          <p className="text-white/80">Administra los planes de suscripción de los negocios</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <FaPlus size={16} />
          <span>Nueva Suscripción</span>
        </button>
      </div>

      {/* Subscriptions List */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
        {subscriptions.length === 0 ? (
          <div className="text-center py-8">
            <FaCrown className="mx-auto text-4xl text-white/50 mb-4" />
            <p className="text-white/80">No hay suscripciones registradas</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {subscriptions.map((subscription) => (
              <motion.div
                key={subscription._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="text-2xl">
                      {getPlanIcon(subscription.planType)}
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">
                        {subscription.businessId?.businessName || 'Negocio no encontrado'}
                      </h3>
                      <p className="text-white/70 text-sm">
                        {getPlanText(subscription.planType)} • ${subscription.price}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(subscription.status)}`}>
                        {getStatusText(subscription.status)}
                      </div>
                      <p className="text-white/70 text-xs mt-1">
                        Hasta: {new Date(subscription.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(subscription)}
                        className="text-blue-400 hover:text-blue-300 p-2"
                        title="Editar"
                      >
                        <FaEdit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(subscription._id)}
                        className="text-red-400 hover:text-red-300 p-2"
                        title="Eliminar"
                      >
                        <FaTrash size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl p-6 max-w-md w-full"
          >
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              {editingSubscription ? 'Editar Suscripción' : 'Nueva Suscripción'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Negocio *
                </label>
                <select
                  name="businessId"
                  value={formData.businessId}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Seleccionar negocio</option>
                  {businesses.map(business => (
                    <option key={business._id} value={business._id}>
                      {business.businessName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Plan *
                </label>
                <select
                  name="planType"
                  value={formData.planType}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="monthly">Plan Mensual</option>
                  <option value="annual">Plan Anual</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Inicio *
                </label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Fin *
                </label>
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Precio *
                </label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  step="0.01"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Notas adicionales..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  disabled={loading}
                >
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionManagement;
