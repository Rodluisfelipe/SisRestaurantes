import React, { useState, useEffect } from 'react';
import * as SessionManager from '../utils/sessionManager';
import logger from '../utils/logger';
import api from '../services/api';

const CancelConfirmationModal = ({ onConfirm, onCancel, isLoading }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-lg max-w-md w-full overflow-hidden shadow-xl transform transition-all">
        <div className="p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 mx-auto mb-4 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">¿Cancelar Pedido?</h3>
          <p className="text-gray-500 mb-6">
            Esta acción eliminará tu pedido inmediatamente y no se podrá deshacer. ¿Estás seguro?
          </p>
          <div className="flex space-x-3">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors"
            >
              Mantener Pedido
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Cancelando...
                </span>
              ) : (
                'Sí, Cancelar Pedido'
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

  useEffect(() => {
    // Obtener el número de orden del sessionStorage cuando se muestra el modal
    if (show) {
      const lastOrderNumber = sessionStorage.getItem('lastOrderNumber');
      setOrderNumber(lastOrderNumber || '');
    }
  }, [show]);

  if (!show) return null;
  
  const handleModalClose = () => {
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
    try {
      setIsCancelling(true);
      
      // Obtener el ID del pedido del localStorage
      const lastOrderId = sessionStorage.getItem('lastOrderId');
      if (!lastOrderId) {
        logger.error('No se encontró el ID del último pedido');
        alert('No se puede cancelar el pedido: ID no encontrado');
        return;
      }

      // Llamar al endpoint para eliminar el pedido
      await api.delete(`/orders/${lastOrderId}`);
      logger.info('Pedido cancelado exitosamente');

      // Cerrar el modal y limpiar estados
      handleModalClose();
      
      // Mostrar mensaje de éxito en un toast o notificación más sutil
      const notification = document.createElement('div');
      notification.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg transform transition-all duration-500 ease-in-out z-50';
      notification.textContent = 'Pedido cancelado exitosamente';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 500);
      }, 3000);
    } catch (error) {
      logger.error('Error al cancelar el pedido:', error);
      setShowCancelConfirmation(false);
      alert('Error al cancelar el pedido. Por favor, contacta al restaurante.');
    } finally {
      setIsCancelling(false);
      setShowCancelConfirmation(false);
    }
  };
  
  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-md w-full overflow-hidden shadow-xl transform transition-all">
          {/* Encabezado con color según tipo de pedido */}
          <div 
            className="p-6 text-center" 
            style={{ 
              background: businessConfig.theme.buttonColor || '#2563eb',
              color: businessConfig.theme.buttonTextColor || '#ffffff'
            }}
          >
            <div className="w-20 h-20 bg-white rounded-full mx-auto mb-4 flex items-center justify-center">
              {orderConfirmationDetails.type === 'delivery' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" style={{ color: businessConfig.theme.buttonColor || '#2563eb' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              ) : orderConfirmationDetails.type === 'inSite' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" style={{ color: businessConfig.theme.buttonColor || '#2563eb' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" style={{ color: businessConfig.theme.buttonColor || '#2563eb' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <h2 className="text-2xl font-bold mb-2">¡Pedido Confirmado!</h2>
            <p className="text-lg opacity-90">{businessConfig.businessName || 'Nuestro Restaurante'}</p>
            {orderNumber && (
              <div className="mt-3 inline-flex items-center px-4 py-2 rounded-full bg-white bg-opacity-20">
                <span className="text-sm font-medium">
                  Orden #{orderNumber}
                </span>
              </div>
            )}
          </div>
          
          {/* Cuerpo del mensaje */}
          <div className="p-6">
            <div className="bg-green-50 border border-green-100 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500 mr-3 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-green-800">{orderConfirmationDetails.message}</p>
              </div>
            </div>

            {/* Número de orden destacado para fácil referencia */}
            {orderNumber && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-center text-gray-600">Guarda tu número de orden para hacer seguimiento:</p>
                <p className="text-center text-2xl font-bold text-gray-800 mt-2">#{orderNumber}</p>
              </div>
            )}
            
            {/* Detalles adicionales según tipo de pedido */}
            {orderConfirmationDetails.type === 'inSite' && (
              <div className="mb-6">
                <p className="text-gray-600 text-center">Tu pedido será servido en la <span className="font-bold">Mesa {orderInfo.tableNumber}</span></p>
              </div>
            )}
            
            {orderConfirmationDetails.type === 'delivery' && (
              <div className="mb-6">
                <p className="text-gray-600 text-center mb-1">Recibirás actualizaciones sobre tu pedido.</p>
                <p className="text-gray-600 text-center">Tiempo estimado de entrega: 30-45 min</p>
              </div>
            )}
            
            {/* Botones de acción */}
            <div className="flex flex-col space-y-3">
              {/* Botón de cancelar pedido */}
              <button
                onClick={() => setShowCancelConfirmation(true)}
                className="w-full py-3 rounded-lg text-white font-medium shadow-sm hover:shadow transition-shadow bg-red-600 hover:bg-red-700"
              >
                Cancelar Pedido
              </button>

              {/* Botón para cerrar */}
              <button
                onClick={handleModalClose}
                className="w-full py-3 rounded-lg text-white font-medium shadow-sm hover:shadow transition-shadow"
                style={{ 
                  backgroundColor: businessConfig.theme.buttonColor || '#2563eb'
                }}
              >
                Entendido
              </button>
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
        />
      )}
    </>
  );
};

export default OrderConfirmationModal; 