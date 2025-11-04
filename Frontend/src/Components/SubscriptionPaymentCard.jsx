import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../Context/AuthContext';
import { useBusinessConfig } from '../Context/BusinessContext';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCreditCard, FaExclamationTriangle, FaCalendarCheck, FaCheckCircle, FaTimes } from 'react-icons/fa';
import { useBusinessSocket } from '../hooks/useBusinessSocket';

const SubscriptionPaymentCard = () => {
  const { user } = useAuth();
  const { businessId: businessIdFromConfig } = useBusinessConfig();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [widgetConfig, setWidgetConfig] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null); // 'checking', 'success', 'failed'
  const [selectedPlanType, setSelectedPlanType] = useState('monthly'); // 'monthly' o 'annual'
  const widgetContainerRef = useRef(null);
  const wompiWidgetRef = useRef(null);
  
  // Conectar a socket para recibir actualizaciones en tiempo real
  const socket = useBusinessSocket(businessIdFromConfig || user?.businessId);

  // Preferir businessId del contexto, si no está disponible usar el del user (para SuperAdmin)
  const businessId = businessIdFromConfig || user?.businessId;

  useEffect(() => {
    if (businessId || user?.role === 'superadmin') {
      loadSubscription();
    }
    
    // Cleanup al desmontar
    return () => {
      // Limpiar widget de Wompi si existe
      if (wompiWidgetRef.current && window.WidgetCheckout) {
        try {
          if (wompiWidgetRef.current.destroy) {
            wompiWidgetRef.current.destroy();
          }
        } catch (e) {
          console.warn('Error destroying Wompi widget:', e);
        }
      }
    };
  }, [businessId, user]);
  
  // Escuchar eventos de socket para actualización en tiempo real
  useEffect(() => {
    if (!socket) return;
    
    const handleSubscriptionActivated = (data) => {
      console.log('Socket: Subscription activated', data);
      setPaymentStatus('success');
      setShowPaymentModal(false);
      // Recargar suscripción después de 1 segundo
      setTimeout(() => {
        loadSubscription();
      }, 1000);
    };
    
    const handlePaymentFailed = (data) => {
      console.log('Socket: Payment failed', data);
      setPaymentStatus('failed');
    };
    
    socket.on('subscription_activated', handleSubscriptionActivated);
    socket.on('subscription_payment_failed', handlePaymentFailed);
    
    return () => {
      socket.off('subscription_activated', handleSubscriptionActivated);
      socket.off('subscription_payment_failed', handlePaymentFailed);
    };
  }, [socket]);

  const loadSubscription = async () => {
    try {
      // Si es SuperAdmin y tenemos businessId, pasarlo como query param
      const url = user?.role === 'superadmin' && businessId 
        ? `/subscriptions/me?businessId=${businessId}`
        : '/subscriptions/me';
      
      const res = await api.get(url);
      if (res.data.success && res.data.subscription) {
        setSubscription(res.data.subscription);
      } else {
        setSubscription(null);
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
      // Si es 403, el usuario no tiene businessId válido - mostrar mensaje
      if (error.response?.status === 403) {
        console.error('No se pudo determinar el negocio. Por favor, cierra sesión y vuelve a iniciar sesión.');
      }
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  // Función para verificar el estado del pago
  const checkPaymentStatus = async (transactionId, reference) => {
    try {
      console.log('Checking payment status:', { transactionId, reference });
      const url = reference 
        ? `/webhooks/wompi/callback?transactionId=${transactionId}&reference=${encodeURIComponent(reference)}`
        : `/webhooks/wompi/callback?transactionId=${transactionId}`;
      console.log('Calling payment status URL:', url);
      const res = await api.get(url);
      console.log('Payment status response:', res.data);
      if (res.data.success) {
        if (res.data.transactionStatus === 'APPROVED' && res.data.subscriptionStatus === 'active') {
          console.log('Payment approved! Activating subscription...');
          setPaymentStatus('success');
          setShowPaymentModal(false);
          // Recargar inmediatamente y luego nuevamente después de un segundo para asegurar que se vea el cambio
          loadSubscription();
          setTimeout(() => {
            loadSubscription();
          }, 1000);
          // También recargar después de 2 segundos por si acaso hay un delay en la BD
          setTimeout(() => {
            loadSubscription();
          }, 2000);
          return true;
        } else if (res.data.transactionStatus === 'DECLINED' || res.data.transactionStatus === 'VOIDED') {
          console.log('Payment declined or voided');
          setPaymentStatus('failed');
          return false;
        } else {
          console.log('Payment still processing:', res.data.transactionStatus);
        }
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
      console.error('Error details:', error.response?.data || error.message);
      // No cambiar el estado a 'failed' aquí para permitir reintentos
    }
    return null; // Aún procesando
  };
  
  // Iniciar polling para verificar estado del pago
  const startPaymentPolling = (transactionId, reference = null) => {
    console.log('Starting payment polling:', { transactionId, reference });
    setPaymentStatus('checking');
    
    // Verificar inmediatamente
    checkPaymentStatus(transactionId, reference).catch(err => {
      console.error('Error in initial payment check:', err);
    });
    
    // Polling cada 3 segundos (máximo 2 minutos = 40 intentos)
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      console.log(`Payment polling attempt ${attempts}/${40}`);
      if (attempts > 40) {
        console.log('Payment polling timeout after 40 attempts');
        clearInterval(interval);
        setPaymentStatus('failed');
        return;
      }
      
      try {
        const result = await checkPaymentStatus(transactionId, reference);
        if (result !== null) {
          console.log('Payment status finalized, stopping polling');
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Error in payment polling:', err);
        // Continuar intentando
      }
    }, 3000);
    
    // Guardar el interval ID para poder limpiarlo si es necesario
    return interval;
  };
  
  const handlePayNow = async () => {
    console.log('handlePayNow called with planType:', selectedPlanType);
    setProcessing(true);
    setShowPaymentModal(true);
    setPaymentStatus(null);
    
    try {
      // Si es SuperAdmin, pasar businessId en el body
      const body = {
        planType: selectedPlanType, // Incluir el plan seleccionado
        ...(user?.role === 'superadmin' && businessId ? { businessId } : {})
      };
      
      console.log('Calling /subscriptions/checkout with body:', body);
      const res = await api.post('/subscriptions/checkout', body);
      console.log('Response received:', res.data);
      
      if (res.data.success && res.data.widgetConfig) {
        console.log('WidgetConfig received:', res.data.widgetConfig);
        setWidgetConfig(res.data.widgetConfig);
        
        // Cargar el script del Widget de Wompi dinámicamente
        loadWompiWidget(res.data.widgetConfig);
      } else {
        console.error('Response missing success or widgetConfig:', res.data);
        alert('Error al crear checkout. Por favor intenta nuevamente.');
        setProcessing(false);
        setShowPaymentModal(false);
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      console.error('Error response:', error.response?.data);
      alert(error.response?.data?.message || 'Error al crear checkout. Por favor intenta nuevamente.');
      setProcessing(false);
      setShowPaymentModal(false);
    } finally {
      setProcessing(false);
    }
  };

  const loadWompiWidget = (config) => {
    console.log('Loading Wompi widget with config:', config);
    
    // Limpiar widget anterior si existe
    if (wompiWidgetRef.current) {
      // Intentar destruir widget anterior
      try {
        if (window.WidgetCheckout && wompiWidgetRef.current.destroy) {
          wompiWidgetRef.current.destroy();
        }
      } catch (e) {
        console.warn('Error destroying previous widget:', e);
      }
    }

    // Cargar script del Widget de Wompi si no está ya cargado
    if (!window.WidgetCheckout) {
      console.log('WidgetCheckout not loaded, loading script...');
      const script = document.createElement('script');
      script.src = 'https://checkout.wompi.co/widget.js';
      script.async = true;
      script.onload = () => {
        console.log('Widget script loaded, initializing...');
        initializeWidget(config);
      };
      script.onerror = () => {
        console.error('Error loading widget script');
        alert('Error al cargar el widget de pagos. Por favor recarga la página.');
        setProcessing(false);
        setShowPaymentModal(false);
      };
      document.head.appendChild(script);
    } else {
      console.log('WidgetCheckout already loaded, initializing directly...');
      initializeWidget(config);
    }
  };

  const initializeWidget = (config) => {
    console.log('Initializing widget, checking prerequisites...');
    console.log('WidgetCheckout available:', !!window.WidgetCheckout);
    console.log('Config received:', config);
    
    if (!window.WidgetCheckout) {
      console.error('WidgetCheckout not available');
      alert('El widget de pagos no está disponible. Por favor recarga la página.');
      setProcessing(false);
      setShowPaymentModal(false);
      return;
    }

    // Validar que todos los campos requeridos estén presentes
    if (!config.publicKey || !config.amountInCents || !config.reference || !config.signature) {
      console.error('Missing required config fields:', {
        hasPublicKey: !!config.publicKey,
        hasAmount: !!config.amountInCents,
        hasReference: !!config.reference,
        hasSignature: !!config.signature
      });
      alert('Error: Configuración de pago incompleta. Por favor intenta nuevamente.');
      setProcessing(false);
      setShowPaymentModal(false);
      return;
    }

    try {
      console.log('Creating WidgetCheckout instance with config:', {
        currency: config.currency,
        amountInCents: config.amountInCents,
        reference: config.reference,
        publicKey: config.publicKey?.substring(0, 20) + '...',
        hasSignature: !!config.signature,
        redirectUrl: config.redirectUrl
      });
      
      // Crear instancia del Widget
      const checkout = new window.WidgetCheckout({
        currency: config.currency || 'COP',
        amountInCents: config.amountInCents,
        reference: config.reference,
        publicKey: config.publicKey,
        signature: {
          integrity: config.signature
        },
        redirectUrl: config.redirectUrl
      });

      console.log('Opening widget...');
      // Abrir el widget (el widget se abre como modal propio, no necesita contenedor)
      checkout.open((result) => {
        console.log('Widget callback invoked with result:', result);
        const transaction = result.transaction;
        console.log('Transaction from widget:', transaction);
        
        if (transaction && transaction.id) {
          console.log('Transaction ID received:', transaction.id);
          // Iniciar polling para verificar el estado (pasar también la reference si está disponible)
          const reference = transaction.reference || widgetConfig.reference;
          startPaymentPolling(transaction.id, reference);
        } else {
          // El usuario cerró el widget sin completar
          console.log('Widget closed without completion');
          setShowPaymentModal(false);
          setWidgetConfig(null);
          setProcessing(false);
        }
      });

      wompiWidgetRef.current = checkout;
      console.log('Widget opened successfully');
    } catch (error) {
      console.error('Error initializing Wompi widget:', error);
      alert('Error al inicializar el widget de pagos: ' + error.message);
      setProcessing(false);
      setShowPaymentModal(false);
    }
  };
  
  const handleCloseModal = () => {
    setShowPaymentModal(false);
    setPaymentStatus(null);
    setWidgetConfig(null);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-16 bg-gray-200 rounded mb-4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg shadow-lg p-6 border-2 border-gray-200"
      >
        <div className="flex items-center space-x-4">
          <div className="text-4xl">📋</div>
          <div>
            <h3 className="text-2xl font-bold text-gray-800">Sin Suscripción Activa</h3>
            <p className="text-gray-600 mt-1">Aún no tienes una suscripción activa.</p>
          </div>
        </div>
      </motion.div>
    );
  }

  const statusBadge = {
    'active': { color: 'green', text: 'Activa', icon: <FaCheckCircle /> },
    'past_due': { color: 'orange', text: 'Pago vencido', icon: <FaExclamationTriangle /> },
    'grace': { color: 'yellow', text: 'En periodo de gracia', icon: <FaCalendarCheck /> },
    'suspended': { color: 'red', text: 'Suspendida', icon: <FaExclamationTriangle /> },
    'canceled': { color: 'gray', text: 'Cancelada', icon: <FaCreditCard /> }
  };

  const badge = statusBadge[subscription.status] || statusBadge.active;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg shadow-lg p-6 border-2"
    >
      {/* Header con Badge */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
          <FaCreditCard className="mr-2 text-blue-600" />
          Mi Suscripción
        </h2>
        <span className={`px-4 py-2 rounded-full text-sm font-semibold flex items-center space-x-2 bg-${badge.color}-100 text-${badge.color}-800`}>
          {badge.icon}
          <span>{badge.text}</span>
        </span>
      </div>

      {/* Banner de Alerta (si aplica) */}
      {(subscription.status === 'past_due' || subscription.status === 'grace') && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 p-4 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-lg"
        >
          <div className="flex items-start space-x-3">
            <FaExclamationTriangle className="text-orange-600 text-xl flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-orange-900 font-medium">Tu suscripción está vencida</p>
              <p className="text-orange-700 text-sm mt-1">Mantén tu acceso renovando ahora.</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Fecha de Vencimiento */}
      <div className="mb-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-700 text-sm font-medium">
              {subscription.status === 'active' ? 'Vence el' : subscription.status === 'grace' ? 'Gracia hasta el' : 'Venció el'}
            </p>
            <p className="text-blue-900 text-xl font-bold mt-1">
              {new Date(subscription.periodEnd).toLocaleDateString('es-CO', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
              })}
            </p>
          </div>
          {subscription.daysRemaining !== undefined && (
            <div className="text-right">
              <p className="text-blue-600 text-3xl font-bold">{subscription.daysRemaining}</p>
              <p className="text-blue-700 text-xs">días restantes</p>
            </div>
          )}
        </div>
      </div>

      {/* Último Pago */}
      {subscription.lastPayment && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600 font-medium mb-2">Último pago</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-800 text-lg">
                ${subscription.lastPayment.amount.toLocaleString('es-CO')} <span className="text-sm text-gray-600">COP</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(subscription.lastPayment.date).toLocaleDateString('es-CO', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })} • {subscription.lastPayment.method}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              subscription.lastPayment.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
              subscription.lastPayment.status === 'DECLINED' ? 'bg-red-100 text-red-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {subscription.lastPayment.status}
            </span>
          </div>
        </div>
      )}

      {/* Selector de Plan (solo si está vencida) */}
      {(subscription.status === 'past_due' || subscription.status === 'grace' || subscription.status === 'suspended') && (
        <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
          <p className="text-sm font-semibold text-gray-700 mb-3 text-center">Selecciona tu plan de renovación:</p>
          <div className="grid grid-cols-2 gap-3">
            {/* Plan Mensual */}
            <motion.button
              onClick={() => setSelectedPlanType('monthly')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedPlanType === 'monthly'
                  ? 'border-blue-600 bg-blue-600 text-white shadow-lg'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400'
              }`}
            >
              <div className="text-center">
                <p className="font-bold text-lg">Mensual</p>
                <p className={`text-2xl font-extrabold mt-1 ${selectedPlanType === 'monthly' ? 'text-white' : 'text-blue-600'}`}>
                  $27.000
                </p>
                <p className="text-xs mt-1 opacity-80">Por mes</p>
              </div>
            </motion.button>

            {/* Plan Anual */}
            <motion.button
              onClick={() => setSelectedPlanType('annual')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`p-4 rounded-lg border-2 transition-all relative ${
                selectedPlanType === 'annual'
                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-indigo-400'
              }`}
            >
              <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                ¡Ahorra!
              </span>
              <div className="text-center">
                <p className="font-bold text-lg">Anual</p>
                <p className={`text-2xl font-extrabold mt-1 ${selectedPlanType === 'annual' ? 'text-white' : 'text-indigo-600'}`}>
                  $308.000
                </p>
                <p className="text-xs mt-1 opacity-80">Equivale a 11 meses</p>
              </div>
            </motion.button>
          </div>
        </div>
      )}

      {/* CTA Principal */}
      <button
        onClick={handlePayNow}
        disabled={processing || subscription.status === 'active'}
        className={`w-full py-4 rounded-lg font-semibold text-white transition-all duration-200 flex items-center justify-center space-x-2 ${
          subscription.status === 'active' 
            ? 'bg-gray-400 cursor-not-allowed opacity-60' 
            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
        }`}
      >
        {processing ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span>Redirigiendo a Wompi...</span>
          </>
        ) : subscription.status === 'active' ? (
          <>
            <FaCheckCircle />
            <span>Suscripción Activa</span>
          </>
        ) : (
          <>
            <FaCreditCard />
            <span>Pagar / Renovar ahora</span>
          </>
        )}
      </button>

      {subscription.status !== 'active' && (
        <p className="text-xs text-gray-500 text-center mt-3">
          Completa el pago de forma segura con Wompi
        </p>
      )}
      
      {/* Estados de pago sobrepuestos (el widget de Wompi se abre como modal propio) */}
      <AnimatePresence>
        {(paymentStatus === 'success' || paymentStatus === 'failed') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-2xl max-w-md w-full p-8"
            >
              {paymentStatus === 'success' && (
                <div className="text-center">
                  <FaCheckCircle className="text-green-600 text-6xl mx-auto mb-4" />
                  <p className="text-xl font-bold text-green-800 mb-2">¡Pago Confirmado!</p>
                  <p className="text-gray-600 mb-4">Tu suscripción ha sido activada exitosamente</p>
                  <button
                    onClick={() => {
                      handleCloseModal();
                      loadSubscription();
                    }}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Cerrar
                  </button>
                </div>
              )}
              
              {paymentStatus === 'failed' && (
                <div className="text-center">
                  <FaExclamationTriangle className="text-red-600 text-6xl mx-auto mb-4" />
                  <p className="text-xl font-bold text-red-800 mb-2">Pago No Completado</p>
                  <p className="text-gray-600 mb-4">El pago fue rechazado o cancelado</p>
                  <button
                    onClick={handleCloseModal}
                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Cerrar
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Mensaje de verificación si está checking */}
      {paymentStatus === 'checking' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-700 font-medium">Verificando pago...</p>
            <p className="text-sm text-gray-500 mt-2">Por favor espera un momento</p>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default SubscriptionPaymentCard;

