import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { subscriptionApi } from '../../services/superadminApi';
import { SAModal, SAButton, SABadge } from '../../Components/SuperAdmin/ui';

// Helper: attach superadmin_token to requests (since these endpoints require protectSuperAdmin)
const saAuthHeader = () => {
  const token = localStorage.getItem('superadmin_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

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
        return { variant: 'warning', text: 'En Revisión' };
      case 'approved':
        return { variant: 'success', text: 'Aprobado' };
      case 'rejected':
        return { variant: 'danger', text: 'Rechazado' };
      default:
        return { variant: 'neutral', text: 'Desconocido' };
    }
  };

  const openProofInNewTab = async (proofUrl) => {
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
        <div className="w-8 h-8 border-2 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter tabs */}
      <div className="flex gap-1.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl p-1 w-fit">
        {[
          { id: 'pending', label: 'Pendientes', count: requests.filter(r => r.status === 'pending').length },
          { id: 'approved', label: 'Aprobadas', count: requests.filter(r => r.status === 'approved').length },
          { id: 'rejected', label: 'Rechazadas', count: requests.filter(r => r.status === 'rejected').length },
          { id: 'all', label: 'Todas', count: requests.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              filter === tab.id
                ? 'bg-slate-200 dark:bg-white/[0.08] text-slate-900 dark:text-white'
                : 'text-slate-500 dark:text-white/35 hover:text-slate-900 dark:hover:text-slate-600 dark:text-white/55'
            }`}
          >
            {tab.label}
            <span className={`text-[10px] tabular-nums ${filter === tab.id ? 'text-slate-600 dark:text-white/50' : 'text-slate-400 dark:text-white/20'}`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Empty state */}
      {requests.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] flex items-center justify-center">
            <svg className="w-6 h-6 text-slate-400 dark:text-white/20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
          </div>
          <p className="text-sm text-slate-500 dark:text-white/40 mb-1">No hay solicitudes de pago</p>
          <p className="text-xs text-slate-400 dark:text-white/25">
            {filter !== 'all'
              ? `No hay solicitudes ${filter === 'pending' ? 'pendientes' : filter === 'approved' ? 'aprobadas' : 'rechazadas'}`
              : 'Aún no se han recibido solicitudes'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((request) => {
            const badge = getStatusBadge(request.status);
            const relatedSub = getRelatedSubscription(request.businessId);

            return (
              <motion.div
                key={request._id || request.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-xl overflow-hidden hover:bg-slate-100 dark:hover:bg-slate-100 dark:bg-white/[0.04] transition-colors"
              >
                {/* Main row */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {request.businessName || request.businessId?.businessName || 'N/A'}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <SABadge variant={badge.variant} dot>{badge.text}</SABadge>
                        <span className="text-[11px] text-slate-400 dark:text-white/25">
                          {new Date(request.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-semibold text-slate-900 dark:text-white tabular-nums">${request.amount?.toLocaleString('es-CO')}</p>
                      <p className="text-[11px] text-slate-500 dark:text-white/30">{request.monthsPurchased} {request.monthsPurchased === 1 ? 'mes' : 'meses'} · {request.paymentMethod}</p>
                    </div>
                  </div>

                  {/* Related subscription info */}
                  {relatedSub && (
                    <div className={`rounded-lg px-3 py-2 mb-3 border-l-2 ${
                      relatedSub.status === 'active' ? 'bg-cyan-500/[0.04] border-cyan-200 dark:border-cyan-500/30' :
                      relatedSub.status === 'expired' ? 'bg-red-500/[0.04] border-red-200 dark:border-red-500/30' :
                      'bg-white dark:bg-white/[0.02] border-slate-300 dark:border-white/[0.1]'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[11px] text-slate-500 dark:text-white/40">Suscripción actual</p>
                          <p className={`text-xs font-medium ${
                            relatedSub.status === 'active' ? 'text-cyan-600 dark:text-cyan-400' :
                            relatedSub.status === 'expired' ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-white/50'
                          }`}>
                            {relatedSub.status === 'active' ? 'Activa' : relatedSub.status === 'expired' ? 'Expirada' : relatedSub.status}
                            {' · hasta '}
                            {new Date(relatedSub.endDate || relatedSub.periodEnd).toLocaleDateString('es-CO')}
                          </p>
                        </div>
                        {request.status === 'pending' && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400/70 bg-amber-500/[0.08] px-2 py-0.5 rounded">Extenderá</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <SAButton
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        const proofUrl = request.proofUrl || request.proof;
                        if (proofUrl) openProofInNewTab(proofUrl);
                        else alert('No hay comprobante disponible');
                      }}
                      icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                    >
                      Comprobante
                    </SAButton>

                    {request.status === 'pending' && (
                      <>
                        <SAButton
                          variant="filled"
                          size="xs"
                          onClick={() => {
                            const requestId = request._id || request.id;
                            if (requestId) handleApprove(requestId);
                            else alert('Error: No se pudo identificar la solicitud');
                          }}
                          disabled={processing}
                          icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                        >
                          Aprobar
                        </SAButton>
                        <SAButton
                          variant="danger"
                          size="xs"
                          onClick={() => { setSelectedRequest(request); setShowRejectModal(true); }}
                          disabled={processing}
                          icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>}
                        >
                          Rechazar
                        </SAButton>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      <SAModal
        isOpen={showRejectModal && !!selectedRequest}
        onClose={() => { setShowRejectModal(false); setSelectedRequest(null); setRejectionReason(''); }}
        title="Rechazar Solicitud"
        subtitle={selectedRequest ? `${selectedRequest.businessName || selectedRequest.businessId?.businessName || ''} · $${selectedRequest.amount?.toLocaleString('es-CO')} COP` : ''}
        width="max-w-md"
        footer={
          <>
            <SAButton variant="ghost" size="md" onClick={() => { setShowRejectModal(false); setSelectedRequest(null); setRejectionReason(''); }} disabled={processing}>
              Cancelar
            </SAButton>
            <SAButton variant="danger" size="md" onClick={handleReject} disabled={processing || !rejectionReason.trim()} loading={processing}>
              Rechazar
            </SAButton>
          </>
        }
      >
        <div className="space-y-4">
          {selectedRequest && (
            <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-lg p-3 space-y-1.5">
              <p className="text-xs text-slate-600 dark:text-white/50"><span className="text-slate-700 dark:text-white/70">Meses:</span> {selectedRequest.monthsPurchased}</p>
              <p className="text-xs text-slate-600 dark:text-white/50"><span className="text-slate-700 dark:text-white/70">Método:</span> {selectedRequest.paymentMethod}</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1.5">Motivo del rechazo <span className="text-red-600 dark:text-red-400">*</span></label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-900 dark:text-white text-sm outline-none focus:border-red-500/40 transition-all resize-none"
              rows="3"
              placeholder="Ej: Comprobante no válido, monto incorrecto..."
              required
            />
          </div>
        </div>
      </SAModal>
    </div>
  );
};

export default PaymentRequestsReview;
