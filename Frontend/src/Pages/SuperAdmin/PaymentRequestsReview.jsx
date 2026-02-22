import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import { subscriptionApi } from '../../services/superadminApi';

// Helper: attach superadmin_token to requests (since these endpoints require protectSuperAdmin)
const saAuthHeader = () => {
  const token = localStorage.getItem('superadmin_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};
import { 
  FaCheckCircle, 
  FaTimes, 
  FaClock, 
  FaEye, 
  FaDownload,
  FaStore,
  FaDollarSign,
  FaCalendarAlt
} from 'react-icons/fa';

const PaymentRequestsReview = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // pending, approved, rejected
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [subscriptions, setSubscriptions] = useState([]); // Suscripciones relacionadas

  useEffect(() => {
    loadRequests();
    loadSubscriptions(); // Cargar suscripciones también
  }, [filter]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? `?status=${filter}` : '';
      // Usar /api/admin/payment-requests (no /api/superadmin/admin/payment-requests)
      const res = await api.get(`/admin/payment-requests${params}`, { headers: saAuthHeader() });
      if (res.data.success && res.data.requests) {
        setRequests(res.data.requests);
      }
    } catch (error) {
      console.error('Error loading payment requests:', error);
      alert('Error al cargar solicitudes de pago');
    } finally {
      setLoading(false);
    }
  };

  const loadSubscriptions = async () => {
    try {
      // Cargar suscripciones para mostrar información relacionada
      const token = localStorage.getItem('superadmin_token');
      if (!token) return;
      
      // Usar la misma ruta que SubscriptionManagement
      const res = await subscriptionApi.get('/subscriptions');
      if (res.data && res.data.subscriptions) {
        setSubscriptions(res.data.subscriptions);
      }
    } catch (error) {
      // Silenciar error si no hay token o no está disponible
      console.log('No se pudieron cargar suscripciones:', error);
    }
  };

  // Función para obtener información de suscripción relacionada
  const getRelatedSubscription = (businessId) => {
    if (!businessId || !subscriptions.length) return null;
    const businessIdStr = typeof businessId === 'object' ? businessId.toString() : businessId;
    return subscriptions.find(sub => 
      sub.businessId?._id?.toString() === businessIdStr || 
      sub.businessId?.toString() === businessIdStr
    );
  };

  const handleApprove = async (requestId) => {
    if (!requestId) {
      console.error('Error: requestId is undefined', { requestId });
      alert('Error: No se pudo identificar la solicitud de pago');
      return;
    }
    
    if (!window.confirm('¿Estás seguro de aprobar esta solicitud de pago? La suscripción se activará inmediatamente.')) {
      return;
    }

    try {
      setProcessing(true);
      // Usar /api/admin/payment-requests/:id/approve
      const res = await api.post(`/admin/payment-requests/${requestId}/approve`, {}, { headers: saAuthHeader() });
      if (res.data.success) {
        const periodEnd = res.data.subscription?.periodEnd ? new Date(res.data.subscription.periodEnd).toLocaleDateString('es-CO') : 'N/A';
        alert(`✅ Solicitud aprobada correctamente.\n\nLa suscripción ha sido activada inmediatamente.\nVigencia hasta: ${periodEnd}\n\nEl menú está activo ahora mismo.`);
        
        // Recargar inmediatamente sin esperar
        loadRequests();
        loadSubscriptions(); // Recargar suscripciones también
        setSelectedRequest(null);
        
        // Disparar evento para notificar a otros componentes
        window.dispatchEvent(new CustomEvent('subscription-updated'));
        
        // Pequeño delay para asegurar que el backend procesó todo
        setTimeout(() => {
          loadRequests();
          loadSubscriptions();
        }, 500);
      }
    } catch (error) {
      console.error('Error approving request:', error);
      alert(error.response?.data?.message || 'Error al aprobar la solicitud');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Debes proporcionar un motivo de rechazo');
      return;
    }

    if (!window.confirm('¿Estás seguro de rechazar esta solicitud?')) {
      return;
    }

    try {
      setProcessing(true);
      // Usar /api/admin/payment-requests/:id/reject
      const requestId = selectedRequest._id || selectedRequest.id;
      if (!requestId) {
        alert('Error: No se pudo identificar la solicitud de pago');
        setProcessing(false);
        return;
      }
      
      const res = await api.post(`/admin/payment-requests/${requestId}/reject`, {
        rejectionReason: rejectionReason.trim()
      }, { headers: saAuthHeader() });
      if (res.data.success) {
        alert('Solicitud rechazada correctamente.');
        await loadRequests();
        loadSubscriptions(); // Recargar suscripciones también
        setSelectedRequest(null);
        setShowRejectModal(false);
        setRejectionReason('');
        
        // Disparar evento para notificar a otros componentes
        window.dispatchEvent(new CustomEvent('payment-request-updated'));
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert(error.response?.data?.message || 'Error al rechazar la solicitud');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return { color: 'yellow', text: 'En Revisión', icon: FaClock, bg: 'bg-yellow-100 text-yellow-800' };
      case 'approved':
        return { color: 'green', text: 'Aprobado', icon: FaCheckCircle, bg: 'bg-green-100 text-green-800' };
      case 'rejected':
        return { color: 'red', text: 'Rechazado', icon: FaTimes, bg: 'bg-red-100 text-red-800' };
      default:
        return { color: 'gray', text: 'Desconocido', icon: FaClock, bg: 'bg-gray-100 text-gray-800' };
    }
  };

  const openProofInNewTab = (proofUrl) => {
    if (!proofUrl) {
      alert('No hay comprobante disponible');
      return;
    }
    
    // Construir URL completa del comprobante
    const apiUrl = import.meta.env.VITE_API_URL || (await import('../../config')).BACKEND_URL;
    const fullUrl = proofUrl.startsWith('http') 
      ? proofUrl 
      : `${apiUrl}${proofUrl.startsWith('/') ? proofUrl : '/' + proofUrl}`;
    
    window.open(fullUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0 pb-6">
      {/* Filtros - Mobile responsive */}
      <div className="bg-white rounded-xl shadow-md p-3 sm:p-4 sticky top-0 z-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setFilter('pending')}
            className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm transition-all shadow-sm ${
              filter === 'pending'
                ? 'bg-yellow-500 text-white shadow-yellow-500/50'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
            }`}
          >
            <div className="flex items-center justify-center space-x-1">
              <FaClock className="text-xs sm:text-sm" />
              <span className="hidden sm:inline">Pendientes</span>
              <span className="sm:hidden">Pend.</span>
              <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-xs font-bold">
                {requests.filter(r => r.status === 'pending').length}
              </span>
            </div>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setFilter('approved')}
            className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm transition-all shadow-sm ${
              filter === 'approved'
                ? 'bg-green-500 text-white shadow-green-500/50'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
            }`}
          >
            <div className="flex items-center justify-center space-x-1">
              <FaCheckCircle className="text-xs sm:text-sm" />
              <span className="hidden sm:inline">Aprobadas</span>
              <span className="sm:hidden">Aprob.</span>
              <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-xs font-bold">
                {requests.filter(r => r.status === 'approved').length}
              </span>
            </div>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setFilter('rejected')}
            className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm transition-all shadow-sm ${
              filter === 'rejected'
                ? 'bg-red-500 text-white shadow-red-500/50'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
            }`}
          >
            <div className="flex items-center justify-center space-x-1">
              <FaTimes className="text-xs sm:text-sm" />
              <span className="hidden sm:inline">Rechazadas</span>
              <span className="sm:hidden">Rech.</span>
              <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-xs font-bold">
                {requests.filter(r => r.status === 'rejected').length}
              </span>
            </div>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setFilter('all')}
            className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm transition-all shadow-sm ${
              filter === 'all'
                ? 'bg-blue-500 text-white shadow-blue-500/50'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
            }`}
          >
            <div className="flex items-center justify-center space-x-1">
              <span className="hidden sm:inline">Todas</span>
              <span className="sm:hidden">Total</span>
              <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-xs font-bold">
                {requests.length}
              </span>
            </div>
          </motion.button>
        </div>
      </div>

      {/* Lista de Solicitudes - Cards responsive */}
      {requests.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-md p-8 sm:p-12 text-center"
        >
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-full flex items-center justify-center">
              <FaDollarSign className="text-4xl sm:text-5xl text-gray-400" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-2">
                No hay solicitudes de pago
              </h3>
              <p className="text-sm sm:text-base text-gray-500">
                {filter !== 'all' 
                  ? `No hay solicitudes ${filter === 'pending' ? 'pendientes' : filter === 'approved' ? 'aprobadas' : 'rechazadas'}`
                  : 'Aún no se han recibido solicitudes de pago'}
              </p>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {requests.map((request) => {
            const badge = getStatusBadge(request.status);
            const BadgeIcon = badge.icon;
            
            return (
              <motion.div
                key={request._id || request.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all overflow-hidden"
              >
                {/* Header con negocio y estado */}
                <div className={`px-4 sm:px-6 py-4 ${badge.bg} bg-opacity-10 border-l-4 ${
                  badge.color === 'yellow' ? 'border-yellow-500' :
                  badge.color === 'green' ? 'border-green-500' :
                  badge.color === 'red' ? 'border-red-500' : 'border-gray-500'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <FaStore className="text-gray-400 flex-shrink-0" />
                        <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                          {request.businessName || request.businessId?.businessName || request.businessId || 'N/A'}
                        </h3>
                      </div>
                      <div className="flex items-center space-x-2">
                        <BadgeIcon className={`text-sm ${
                          badge.color === 'yellow' ? 'text-yellow-600' :
                          badge.color === 'green' ? 'text-green-600' :
                          badge.color === 'red' ? 'text-red-600' : 'text-gray-600'
                        }`} />
                        <span className={`text-xs sm:text-sm font-semibold ${badge.bg} px-2.5 py-1 rounded-full`}>
                          {badge.text}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                  {/* Información principal */}
                <div className="px-4 sm:px-6 py-4 space-y-3">
                  {/* Información de suscripción relacionada */}
                  {(() => {
                    const relatedSub = getRelatedSubscription(request.businessId);
                    if (relatedSub) {
                      const isActive = relatedSub.status === 'active';
                      const isExpired = relatedSub.status === 'expired';
                      return (
                        <div className={`rounded-lg p-3 border-l-4 ${
                          isActive ? 'bg-blue-50 border-blue-500' : 
                          isExpired ? 'bg-red-50 border-red-500' : 
                          'bg-gray-50 border-gray-500'
                        }`}>
                          <p className="text-xs font-semibold text-gray-600 mb-1">Suscripción Actual:</p>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className={`text-sm font-bold ${
                                isActive ? 'text-blue-700' : 
                                isExpired ? 'text-red-700' : 
                                'text-gray-700'
                              }`}>
                                {isActive ? '✓ Activa' : isExpired ? '✗ Expirada' : relatedSub.status}
                              </p>
                              <p className="text-xs text-gray-600">
                                Hasta: {new Date(relatedSub.endDate || relatedSub.periodEnd).toLocaleDateString('es-CO')}
                              </p>
                            </div>
                            {request.status === 'pending' && (
                              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-semibold">
                                Aprobará extender
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Monto destacado */}
                  <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 sm:p-4">
                    <div className="flex items-center space-x-2">
                      <FaDollarSign className="text-green-600 text-xl sm:text-2xl" />
                      <div>
                        <p className="text-xs text-gray-600">Monto</p>
                        <p className="text-lg sm:text-xl font-bold text-gray-900">
                          ${request.amount?.toLocaleString('es-CO')} COP
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Detalles en grid */}
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Meses</p>
                      <p className="text-sm sm:text-base font-semibold text-gray-900">
                        {request.monthsPurchased} {request.monthsPurchased === 1 ? 'mes' : 'meses'}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Método</p>
                      <p className="text-sm sm:text-base font-semibold text-gray-900">
                        {request.paymentMethod}
                      </p>
                    </div>
                  </div>

                  {/* Fecha */}
                  <div className="flex items-center space-x-2 text-gray-600">
                    <FaCalendarAlt className="text-sm" />
                    <span className="text-xs sm:text-sm">
                      {new Date(request.createdAt).toLocaleDateString('es-CO', { 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>

                {/* Acciones - Botones grandes para móvil */}
                <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t border-gray-200">
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        const proofUrl = request.proofUrl || request.proof;
                        if (proofUrl) {
                          openProofInNewTab(proofUrl);
                        } else {
                          alert('No hay comprobante disponible');
                        }
                      }}
                      className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 sm:py-2.5 rounded-lg font-semibold text-sm sm:text-base transition-colors shadow-sm"
                    >
                      <FaEye />
                      <span>Ver Comprobante</span>
                    </motion.button>
                    
                    {request.status === 'pending' && (
                      <>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            const requestId = request._id || request.id;
                            if (requestId) {
                              handleApprove(requestId);
                            } else {
                              console.error('Error: request._id is undefined', request);
                              alert('Error: No se pudo identificar la solicitud de pago');
                            }
                          }}
                          disabled={processing}
                          className="flex-1 flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-3 sm:py-2.5 rounded-lg font-semibold text-sm sm:text-base transition-colors shadow-sm"
                        >
                          <FaCheckCircle />
                          <span>Aprobar</span>
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowRejectModal(true);
                          }}
                          disabled={processing}
                          className="flex-1 flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-3 sm:py-2.5 rounded-lg font-semibold text-sm sm:text-base transition-colors shadow-sm"
                        >
                          <FaTimes />
                          <span>Rechazar</span>
                        </motion.button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal de Rechazo - Responsive */}
      {showRejectModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center space-x-3 mb-4 pb-4 border-b border-gray-200">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <FaTimes className="text-red-600 text-xl" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                Rechazar Solicitud de Pago
              </h3>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-2">
              <p className="text-sm text-gray-600">
                <span className="font-semibold">Negocio:</span>{' '}
                <span className="text-gray-900">{selectedRequest.businessName || selectedRequest.businessId?.businessName || selectedRequest.businessId}</span>
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-semibold">Monto:</span>{' '}
                <span className="text-gray-900">${selectedRequest.amount?.toLocaleString('es-CO')} COP</span>
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-semibold">Meses:</span>{' '}
                <span className="text-gray-900">{selectedRequest.monthsPurchased}</span>
              </p>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Motivo del Rechazo <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full p-3 sm:p-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm sm:text-base resize-none"
                rows="4"
                placeholder="Ej: Comprobante no válido, monto incorrecto, información incompleta, etc."
                required
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedRequest(null);
                  setRejectionReason('');
                }}
                disabled={processing}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 disabled:opacity-50 font-semibold text-sm sm:text-base transition-colors"
              >
                Cancelar
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleReject}
                disabled={processing || !rejectionReason.trim()}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm sm:text-base transition-colors shadow-sm"
              >
                {processing ? 'Rechazando...' : 'Rechazar Solicitud'}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default PaymentRequestsReview;
