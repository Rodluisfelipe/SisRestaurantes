import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Context/AuthContext';
import { useBusinessConfig } from '../Context/BusinessContext';
import { useBusinessSocket } from '../hooks/useBusinessSocket';
import api from '../services/api';
import { motion } from 'framer-motion';
import { 
  FaCreditCard, 
  FaUpload, 
  FaCheckCircle, 
  FaTimes, 
  FaClock, 
  FaExclamationTriangle,
  FaCalendarAlt,
  FaMobile,
  FaWallet
} from 'react-icons/fa';

const SubscriptionPayment = () => {
  const { user } = useAuth();
  const { businessId } = useBusinessConfig();
  const navigate = useNavigate();
  const socket = useBusinessSocket(businessId);
  
  const [subscription, setSubscription] = useState(null);
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Formulario
  const [formData, setFormData] = useState({
    monthsPurchased: 1,
    amount: 27000,
    paymentMethod: 'Nequi',
    proof: null
  });
  
  const [errors, setErrors] = useState({});
  
  // Precios por meses
  const PRICING = {
    1: 27000,
    3: 81000,
    6: 162000,
    12: 308000
  };
  
  // Medios de pago
  const PAYMENT_METHODS = [
    { 
      value: 'Nequi', 
      label: 'Nequi', 
      icon: FaMobile, 
      logo: 'https://logos-world.net/wp-content/uploads/2021/03/Nequi-Logo.png',
      details: 'Número: 3028181520',
      code: '@LRQ430'
    },
    { 
      value: 'Daviplata', 
      label: 'Daviplata', 
      icon: FaWallet, 
      logo: 'https://logos-world.net/wp-content/uploads/2021/03/Daviplata-Logo.png',
      details: 'Número: 3028181520',
      code: '@LRQ430'
    },
    { 
      value: 'Transferencia', 
      label: 'Transferencia Bancaria', 
      icon: FaCreditCard, 
      logo: null,
      details: 'Banco: Bancolombia - Cuenta: XXX XXX XXX XXX'
    }
  ];

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // Escuchar eventos de socket para actualización en tiempo real
  useEffect(() => {
    if (!socket) return;
    
    const handleSubscriptionActivated = (data) => {
      console.log('Socket: Subscription activated', data);
      // Recargar suscripción y solicitudes
      loadData();
      // Mostrar notificación
      if (data.message) {
        alert(`✅ ${data.message}`);
      }
    };
    
    socket.on('subscription_activated', handleSubscriptionActivated);
    
    return () => {
      socket.off('subscription_activated', handleSubscriptionActivated);
    };
  }, [socket]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadSubscription(),
        loadPaymentRequests()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSubscription = async () => {
    try {
      // Intentar primero con /api/subscription/me (en paymentRequests.js)
      // Si falla, intentar con /api/subscriptions/me (en subscriptions.js)
      let res;
      try {
        res = await api.get('/subscription/me');
      } catch (error) {
        // Si falla, intentar con el otro endpoint
        if (error.response?.status === 404 || error.response?.status === 403) {
          console.warn('Intentando con /api/subscriptions/me...');
          res = await api.get('/subscriptions/me');
        } else {
          throw error;
        }
      }
      
      if (res.data.success) {
        if (res.data.subscription) {
          setSubscription(res.data.subscription);
        } else {
          // No hay suscripción, eso está bien
          setSubscription(null);
        }
      }
    } catch (error) {
      // Si es 403/401, probablemente el usuario no está autenticado
      // No mostrar error, solo dejar subscription como null
      if (error.response?.status === 403 || error.response?.status === 401) {
        console.warn('Usuario no autenticado o sin permisos para ver suscripción');
      } else {
        console.error('Error loading subscription:', error);
      }
      setSubscription(null);
    }
  };

  const loadPaymentRequests = async () => {
    try {
      const res = await api.get('/payments/manual/my-requests');
      if (res.data.success && res.data.requests) {
        setPaymentRequests(res.data.requests);
      } else {
        setPaymentRequests([]);
      }
    } catch (error) {
      // Si es 404, el endpoint no existe aún (servidor no reiniciado)
      // Si es 403/401, el usuario no está autenticado
      if (error.response?.status === 404) {
        console.warn('Endpoint /payments/manual/my-requests no encontrado. El servidor puede necesitar reiniciarse.');
      } else if (error.response?.status === 403 || error.response?.status === 401) {
        console.warn('Usuario no autenticado o sin permisos para ver solicitudes de pago');
      } else {
        console.error('Error loading payment requests:', error);
      }
      setPaymentRequests([]);
    }
  };

  const handleMonthsChange = (months) => {
    const amount = PRICING[months] || PRICING[1];
    setFormData({ ...formData, monthsPurchased: months, amount });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validar tipo
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        setErrors({ ...errors, proof: 'Solo se permiten imágenes (JPG, PNG) o PDF' });
        return;
      }
      // Validar tamaño (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors({ ...errors, proof: 'El archivo no debe superar 5MB' });
        return;
      }
      setFormData({ ...formData, proof: file });
      setErrors({ ...errors, proof: null });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validar
    if (!formData.proof) {
      setErrors({ ...errors, proof: 'Debes subir un comprobante de pago' });
      return;
    }
    
    // Verificar si hay solicitud pendiente
    const hasPending = paymentRequests.some(req => req.status === 'pending');
    if (hasPending) {
      alert('Ya tienes una solicitud de pago pendiente. Espera a que sea revisada.');
      return;
    }
    
          try {
        setSubmitting(true);
        setErrors({});
        
        const formDataToSend = new FormData();
        formDataToSend.append('monthsPurchased', formData.monthsPurchased);
        formDataToSend.append('amount', formData.amount);
        formDataToSend.append('paymentMethod', formData.paymentMethod);
        formDataToSend.append('proof', formData.proof);
        // Incluir businessId si está disponible (necesario para SuperAdmins)
        if (businessId) {
          formDataToSend.append('businessId', businessId);
        }
        
        const res = await api.post('/payments/manual/request', formDataToSend, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
      
      if (res.data.success) {
        alert('Solicitud de pago enviada correctamente. Será revisada por nuestro equipo.');
        setFormData({
          monthsPurchased: 1,
          amount: PRICING[1],
          paymentMethod: 'Nequi',
          proof: null
        });
        await loadPaymentRequests();
      }
    } catch (error) {
      console.error('Error submitting payment request:', error);
      const errorMsg = error.response?.data?.message || 'Error al enviar la solicitud';
      alert(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return { color: 'yellow', text: 'En Revisión', icon: FaClock };
      case 'approved':
        return { color: 'green', text: 'Aprobado', icon: FaCheckCircle };
      case 'rejected':
        return { color: 'red', text: 'Rechazado', icon: FaTimes };
      default:
        return { color: 'gray', text: 'Desconocido', icon: FaClock };
    }
  };

  const getSubscriptionStatus = () => {
    if (!subscription) return null;
    
    const now = new Date();
    const periodEnd = subscription.periodEnd ? new Date(subscription.periodEnd) : null;
    const graceUntil = subscription.graceUntil ? new Date(subscription.graceUntil) : null;
    
    if (periodEnd && graceUntil) {
      if (now > graceUntil) {
        return { status: 'suspended', text: 'MENÚ DESACTIVADO', color: 'red' };
      } else if (now > periodEnd) {
        return { status: 'grace', text: 'Período de Gracia', color: 'yellow' };
      }
    }
    return { status: 'active', text: 'Activo', color: 'green' };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const subStatus = getSubscriptionStatus();

  return (
    <div className="space-y-6">
      {/* Estado de Suscripción */}
      {subscription && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-6 rounded-lg border-2 ${
            subStatus?.color === 'red' 
              ? 'bg-red-50 border-red-200'
              : subStatus?.color === 'yellow'
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-green-50 border-green-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                Estado de Suscripción
              </h3>
              <p className={`text-sm font-medium ${
                subStatus?.color === 'red' ? 'text-red-700' :
                subStatus?.color === 'yellow' ? 'text-yellow-700' :
                'text-green-700'
              }`}>
                {subStatus?.text}
              </p>
              {subscription.periodEnd && (
                <p className="text-sm text-gray-600 mt-1">
                  {subStatus?.status === 'grace' && subscription.graceDaysRemaining > 0 ? (
                    <>Período de gracia: {subscription.graceDaysRemaining} días restantes</>
                  ) : (
                    <>Vence: {new Date(subscription.periodEnd).toLocaleDateString('es-CO')}</>
                  )}
                </p>
              )}
            </div>
            <FaCalendarAlt className={`text-3xl ${
              subStatus?.color === 'red' ? 'text-red-500' :
              subStatus?.color === 'yellow' ? 'text-yellow-500' :
              'text-green-500'
            }`} />
          </div>
        </motion.div>
      )}

      {/* Formulario de Pago */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow-lg p-6"
      >
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          Renovar Suscripción
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Selector de Meses */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Selecciona la duración
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 3, 6, 12].map(months => (
                <button
                  key={months}
                  type="button"
                  onClick={() => handleMonthsChange(months)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    formData.monthsPurchased === months
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-bold text-lg">{months}</div>
                  <div className="text-xs text-gray-600">
                    {months === 1 ? 'mes' : 'meses'}
                  </div>
                  <div className="text-sm font-semibold mt-1">
                    ${PRICING[months].toLocaleString('es-CO')}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Monto */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-gray-700 font-medium">Total a Pagar:</span>
              <span className="text-2xl font-bold text-gray-900">
                ${formData.amount.toLocaleString('es-CO')} COP
              </span>
            </div>
          </div>

          {/* Método de Pago */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Método de Pago
            </label>
            <select
              value={formData.paymentMethod}
              onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {PAYMENT_METHODS.map(method => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
            
            {/* Información del método seleccionado */}
            <div className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              {(() => {
                const selectedMethod = PAYMENT_METHODS.find(m => m.value === formData.paymentMethod);
                return (
                  <>
                    {selectedMethod?.logo && (
                      <div className="mb-3 flex justify-center">
                        <img 
                          src={selectedMethod.logo} 
                          alt={selectedMethod.label}
                          className="h-12 object-contain"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-800">
                        {selectedMethod?.label}
                      </p>
                      <p className="text-sm text-gray-700">
                        <strong>Número:</strong> {selectedMethod?.details?.replace('Número: ', '')}
                      </p>
                      {selectedMethod?.code && (
                        <p className="text-sm text-gray-700">
                          <strong>Llave:</strong> <span className="font-mono bg-white px-2 py-1 rounded">{selectedMethod.code}</span>
                        </p>
                      )}
                      <p className="text-xs text-gray-600 mt-2 italic">
                        Realiza el pago y luego sube el comprobante
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Subir Comprobante */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Comprobante de Pago *
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-gray-400 transition-colors">
              <div className="space-y-1 text-center">
                <FaUpload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600">
                  <label htmlFor="proof-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                    <span>Subir archivo</span>
                    <input
                      id="proof-upload"
                      name="proof-upload"
                      type="file"
                      className="sr-only"
                      accept="image/jpeg,image/jpg,image/png,application/pdf"
                      onChange={handleFileChange}
                    />
                  </label>
                  <p className="pl-1">o arrastra y suelta</p>
                </div>
                <p className="text-xs text-gray-500">
                  PNG, JPG, PDF hasta 5MB
                </p>
                {formData.proof && (
                  <p className="text-sm text-green-600 mt-2">
                    ✓ {formData.proof.name}
                  </p>
                )}
              </div>
            </div>
            {errors.proof && (
              <p className="mt-2 text-sm text-red-600">{errors.proof}</p>
            )}
          </div>

          {/* Botón Enviar */}
          <button
            type="submit"
            disabled={submitting || !formData.proof}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:transform-none"
          >
            {submitting ? 'Enviando...' : 'Enviar Comprobante'}
          </button>
        </form>
      </motion.div>

      {/* Historial de Solicitudes */}
      {paymentRequests.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-lg p-6"
        >
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Mis Solicitudes de Pago
          </h2>
          
          <div className="space-y-4">
            {paymentRequests.map((request) => {
              const badge = getStatusBadge(request.status);
              const BadgeIcon = badge.icon;
              
              return (
                <div
                  key={request._id}
                  className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <BadgeIcon className={`text-${badge.color}-500`} />
                        <span className={`text-sm font-semibold text-${badge.color}-700`}>
                          {badge.text}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {request.monthsPurchased} {request.monthsPurchased === 1 ? 'mes' : 'meses'} • 
                        ${request.amount?.toLocaleString('es-CO')} • 
                        {request.paymentMethod}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(request.createdAt).toLocaleString('es-CO')}
                      </p>
                      {request.status === 'rejected' && request.rejectionReason && (
                        <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                          <strong>Motivo:</strong> {request.rejectionReason}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default SubscriptionPayment;
