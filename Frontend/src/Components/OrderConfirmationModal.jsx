import React, { useState, useEffect } from 'react';
import * as SessionManager from '../utils/sessionManager';
import logger from '../utils/logger';
import api from '../services/api';
import ConfettiBurst from './ConfettiBurst';
import { CheckCircle2, Armchair, XCircle } from 'lucide-react';

const CancelConfirmationModal = ({ onConfirm, onCancel, isLoading, isBooking }) => {
  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-[60]">
      <div className="bg-white rounded-xl sm:rounded-2xl max-w-xs sm:max-w-md w-full overflow-hidden shadow-2xl border border-red-100 transform transition-all">
        <div className="p-4 sm:p-6 text-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-red-50 to-red-100 mx-auto mb-4 sm:mb-6 flex items-center justify-center shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-8 sm:w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">¿Cancelar {isBooking ? 'Cita' : 'Pedido'}?</h3>
          <p className="text-gray-600 mb-4 sm:mb-6 text-xs sm:text-sm leading-relaxed">
            Esta acción {isBooking ? 'cancelará tu cita' : 'eliminará tu pedido'} inmediatamente y no se podrá deshacer. ¿Estás seguro?
          </p>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 px-4 sm:px-6 py-2 sm:py-3 text-gray-700 bg-gray-100 rounded-lg sm:rounded-xl hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all duration-200 font-medium border border-gray-200 hover:border-gray-300 text-xs sm:text-sm"
            >
              <span className="flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Mantener {isBooking ? 'Cita' : 'Pedido'}
              </span>
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 px-4 sm:px-6 py-2 sm:py-3 text-white bg-red-600 rounded-lg sm:rounded-xl hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-xl text-xs sm:text-sm"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Cancelando...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Sí, Cancelar {isBooking ? 'Cita' : 'Pedido'}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const OrderConfirmationModal = ({ 
  show, 
  onClose, 
  orderInfo, 
  orderConfirmationDetails, 
  businessConfig, 
  businessId, 
  setOrderInfo, 
  setCart, 
  setShowCartSummary 
}) => {
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [countdown, setCountdown] = useState(30);
  const [isCountdownActive, setIsCountdownActive] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    // Obtener el número de orden del sessionStorage cuando se muestra el modal
    if (show) {
      const lastOrderNumber = sessionStorage.getItem('lastOrderNumber');
      setOrderNumber(lastOrderNumber || '');
      // Iniciar countdown solo para el botón de cancelar (NO auto-dismiss)
      setCountdown(30);
      setIsCountdownActive(true);
      // Launch confetti
      setShowConfetti(true);
    } else {
      setIsCountdownActive(false);
    }
  }, [show]);

  // Efecto para el countdown — solo controla visibilidad del botón cancelar, NO auto-cierra
  useEffect(() => {
    let interval;
    if (isCountdownActive && countdown > 0) {
      interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            setIsCountdownActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCountdownActive, countdown]);

  if (!show) return null;
  
  const handleModalClose = () => {
    setIsCountdownActive(false);
    onClose();
    
    // Obtener tipo de pedido y mesa actual
    const orderType = orderInfo?.orderType || '';
    const currentTable = orderInfo?.tableNumber || '';
    
    // Guardar sólo el nombre del cliente para futuros pedidos en modo normal
    const customerName = orderInfo?.customerName || '';
    
    // Limpiar datos de la sesión actual
    SessionManager.clearCurrentSession();
    
    // Limpiar explícitamente el ID del último pedido
    sessionStorage.removeItem('lastOrderId');
    
    // Crear una nueva información limpia para el próximo pedido
    const cleanOrderInfo = {
      customerName: customerName,
      orderType: '',  // Resetear el tipo de pedido
      tableNumber: '' // Eliminar explícitamente el número de mesa
    };
    
    // Si estamos en un QR, redirigir a la misma mesa
    if (SessionManager.isQRMode()) {
      // Antes de redirigir, asegurar que la session está limpia pero preservar el modo QR
      sessionStorage.clear();
      // Redirigir a la misma mesa
      const tableFromUrl = SessionManager.getTableNumberFromURL();
      if (tableFromUrl) {
        window.location.href = `/${businessId}/mesa/${tableFromUrl}`;
      } else {
        window.location.href = `/${businessId}`;
      }
    }
    // Si estamos en normal, no redirigir, solo cerrar el modal y resetear estados
    else {
      // Actualizar estado local con información limpia
      setOrderInfo(cleanOrderInfo);
      
      // Guardar esta información limpia
      SessionManager.saveOrderInfo(cleanOrderInfo);
      
      // Resetear carrito y UI
      setCart([]);
      setShowCartSummary(false);
    }
  };

  const handleCancelOrder = async () => {
    const isBooking = orderConfirmationDetails?.isBooking;
    try {
      setIsCancelling(true);
      setIsCountdownActive(false);
      
      const lastOrderId = sessionStorage.getItem('lastOrderId');
      if (!lastOrderId) {
        logger.error('No se encontró el ID del último pedido');
        alert('No se puede cancelar el pedido: ID no encontrado');
        return;
      }

      // For bookings, use the booking cancellation endpoint (enforces policy)
      if (isBooking) {
        try {
          await api.patch(`/bookings/${lastOrderId}/status`, {
            bookingStatus: 'cancelled',
            isCustomer: true,
            reason: 'Cancelado por el cliente'
          });
        } catch (err) {
          if (err.response?.status === 403) {
            alert(err.response?.data?.message || 'No puedes cancelar esta cita');
            setIsCancelling(false);
            setShowCancelConfirmation(false);
            return;
          }
          throw err;
        }
      } else {
        await api.delete(`/orders/${lastOrderId}`);
      }
      logger.info('Pedido cancelado exitosamente');

      handleModalClose();
      
      const notification = document.createElement('div');
      notification.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg transform transition-all duration-500 ease-in-out z-50';
      notification.textContent = isBooking ? 'Cita cancelada exitosamente' : 'Pedido cancelado exitosamente';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 500);
      }, 3000);
    } catch (error) {
      logger.error('Error al cancelar el pedido:', error);
      setShowCancelConfirmation(false);
      alert(isBooking ? 'Error al cancelar la cita. Por favor, contacta al negocio.' : 'Error al cancelar el pedido. Por favor, contacta al negocio.');
    } finally {
      setIsCancelling(false);
      setShowCancelConfirmation(false);
    }
  };
  
  return (
    <>
      <ConfettiBurst show={showConfetti} onComplete={() => setShowConfetti(false)} />
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50">
        <div className="bg-white rounded-2xl w-full max-w-xs sm:max-w-sm mx-auto shadow-2xl border border-slate-200/50 transform transition-all overflow-hidden overflow-y-auto modal-h-full pb-safe">
          {/* Encabezado mejorado */}
          <div 
            className="relative p-4 sm:p-6 text-center overflow-hidden" 
            style={{ 
              background: `linear-gradient(135deg, ${businessConfig.theme.buttonColor || '#2563eb'} 0%, ${businessConfig.theme.buttonColor || '#2563eb'}dd 100%)`,
              color: businessConfig.theme.buttonTextColor || '#ffffff'
            }}
          >
            {/* Decoración de fondo */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -translate-y-16 translate-x-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full translate-y-12 -translate-x-12"></div>
            </div>
            
            {/* Contenido del header */}
            <div className="relative z-10">
              <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2 sm:mb-3 flex items-center justify-center bg-white/20 rounded-full backdrop-blur-sm">
                {businessConfig.logo ? (
                  <img 
                    src={businessConfig.logo} 
                    alt={businessConfig.businessName || 'Logo'} 
                    className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-8 sm:w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-bold mb-1">{orderConfirmationDetails?.isBooking ? '¡Cita Agendada!' : '¡Pedido Confirmado!'}</h2>
              <p className="text-sm sm:text-base opacity-90 mb-1">{businessConfig.businessName || 'Nuestro Negocio'}</p>
              {orderNumber && (
                <div className="inline-flex items-center justify-center px-3 py-1 bg-white/20 rounded-full backdrop-blur-sm">
                  <span className="text-xs sm:text-sm font-semibold">{orderConfirmationDetails?.isBooking ? 'Cita' : 'Orden'} #{orderNumber}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Contenido principal */}
          <div className="p-4 sm:p-6">
            {/* Info — sin auto-dismiss */}
            
            <div className="text-center mb-4">
              <div className="mb-3">
                <div className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-full mb-2">
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                </div>
                <p className="text-gray-800 text-sm sm:text-base leading-relaxed">{orderConfirmationDetails.message}</p>
              </div>
              
              {orderNumber && (
                <div className="mb-3">
                  <p className="text-gray-600 text-xs sm:text-sm mb-1 font-medium">Número de orden:</p>
                  <div className="inline-flex items-center justify-center w-16 h-16 sm:w-18 sm:h-18 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl shadow-md">
                    <span className="text-lg sm:text-xl font-bold text-slate-800">#{orderNumber}</span>
                  </div>
                </div>
              )}
              
              {orderConfirmationDetails.type === 'inSite' && orderInfo.tableNumber && !orderConfirmationDetails?.isBooking && (
                <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 bg-blue-50 rounded-full border border-blue-200">
                  <Armchair className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="text-blue-600 text-xs sm:text-sm font-medium">
                    Será servido en {businessConfig?.businessType === 'hotel' ? 'la' : 'la'} <span className="font-bold">{businessConfig?.businessType === 'hotel' ? 'Habitación' : 'Mesa'} {orderInfo.tableNumber}</span>
                  </span>
                </div>
              )}
            </div>
            {/* Botón ver ubicación en el mapa */}
            {(() => {
              const lat = businessConfig?.location?.coordinates?.lat;
              const lng = businessConfig?.location?.coordinates?.lng;
              const addr = businessConfig?.address;
              const googleMapsUrl = businessConfig?.googleMapsUrl;
              const hasLocation = googleMapsUrl || addr || (lat && lng);
              if (!hasLocation) return null;

              const openMaps = () => {
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

                const googleUrl = googleMapsUrl ||
                  (lat && lng
                    ? `https://maps.google.com/?q=${lat},${lng}`
                    : `https://maps.google.com/?q=${encodeURIComponent(addr)}`);

                if (isIOS) {
                  const appleUrl = lat && lng
                    ? `maps://?ll=${lat},${lng}&q=${encodeURIComponent(businessConfig.businessName || 'Restaurante')}`
                    : `maps://?q=${encodeURIComponent(addr)}`;
                  window.location.href = appleUrl;
                  setTimeout(() => window.open(googleUrl, '_blank'), 600);
                } else {
                  window.open(googleUrl, '_blank');
                }
              };

              const isPickup = orderInfo?.orderType === 'pickup' || orderInfo?.orderType === 'takeout';

              return (
                <button
                  onClick={openMaps}
                  className="w-full mb-2 flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 active:scale-[0.98] transition-all"
                >
                  <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-gray-800">
                      {isPickup ? 'Cómo llegar al restaurante' : 'Ver ubicación del restaurante'}
                    </p>
                    {addr && <p className="text-[11px] text-gray-400 truncate">{addr}</p>}
                  </div>
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
              );
            })()}

            {/* Botones mejorados */}
            <div className="flex flex-col space-y-2">
              <button
                onClick={handleModalClose}
                className="w-full py-3 sm:py-4 rounded-xl sm:rounded-2xl text-white text-sm sm:text-base font-semibold transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95"
                style={{
                  background: `linear-gradient(135deg, ${businessConfig.theme.buttonColor || '#2563eb'} 0%, ${businessConfig.theme.buttonColor || '#2563eb'}dd 100%)`,
                  boxShadow: `0 4px 15px ${businessConfig.theme.buttonColor || '#2563eb'}40`
                }}
              >
                <span className="flex items-center justify-center space-x-1 sm:space-x-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Entendido</span>
                </span>
              </button>

              {isCountdownActive && (
                <button
                  onClick={() => setShowCancelConfirmation(true)}
                  className="w-full py-2 sm:py-3 rounded-xl sm:rounded-2xl text-red-600 text-xs sm:text-sm font-medium bg-red-50 border-2 border-red-200 hover:bg-red-100 hover:border-red-300 transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  <span className="flex items-center justify-center space-x-1 sm:space-x-2">
                    <XCircle className="w-4 h-4" />
                    <span>Cancelar {orderConfirmationDetails?.isBooking ? 'Cita' : 'Pedido'} ({countdown}s)</span>
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de confirmación de cancelación */}
      {showCancelConfirmation && (
        <CancelConfirmationModal
          onConfirm={handleCancelOrder}
          onCancel={() => setShowCancelConfirmation(false)}
          isLoading={isCancelling}
          isBooking={orderConfirmationDetails?.isBooking}
        />
      )}
    </>
  );
};

export default OrderConfirmationModal; 