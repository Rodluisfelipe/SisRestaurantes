import React, { useState } from 'react';

const OrdersSidebar = ({ activeOrders, onUpdateStatus, onEditOrder }) => {
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  // Obtener pedido seleccionado
  const selectedOrder = activeOrders.find(order => order.id === selectedOrderId);

  // Agrupar pedidos por estado
  const pendingOrders = activeOrders.filter(order => order.status === 'pending' && order.type !== 'freeze');
  const inProgressOrders = activeOrders.filter(order => order.status === 'in_progress' && order.type !== 'freeze');
  const readyOrders = activeOrders.filter(order => order.status === 'ready' && order.type !== 'freeze');
  const frozenOrders = activeOrders.filter(order => order.type === 'freeze');

  // Manejar cambio de estado
  const handleStatusChange = (orderId, newStatus) => {
    onUpdateStatus(orderId, newStatus);
  };
  
  // Manejar finalización de pedido (solo si está pagado)
  const handleFinalizeOrder = (orderId) => {
    const orderToFinalize = activeOrders.find(order => order.id === orderId);
    if (orderToFinalize && orderToFinalize.isPaid) {
      onUpdateStatus(orderId, 'completed', 'finalize');
    }
  };
  
  // Manejar recuperación de pedido congelado al carrito
  const handleRecoverOrder = (orderId) => {
    onUpdateStatus(orderId, '', 'recover');
  };

  // Manejar edición de pedido congelado
  const handleEditOrder = (orderId) => {
    const orderToEdit = activeOrders.find(order => order.id === orderId);
    if (orderToEdit) {
      onEditOrder(orderToEdit);
    }
  };

  // Formatear hora
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Obtener clase según estado
  const getStatusClass = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ready': return 'bg-green-100 text-green-800 border-green-200';
      case 'freeze': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Obtener clase según estado de pago
  const getPaymentStatusClass = (isPaid) => {
    return isPaid 
      ? 'bg-green-100 text-green-800 border-green-200' 
      : 'bg-red-100 text-red-800 border-red-200';
  };

  // Obtener texto según estado
  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'in_progress': return 'En Preparación';
      case 'ready': return 'Listo';
      case 'freeze': return 'Congelado';
      case 'completed': return 'Completado';
      default: return status;
    }
  };

  // Obtener texto según tipo de orden
  const getOrderTypeText = (order) => {
    switch (order.type) {
      case 'dine_in': return `Mesa ${order.table}`;
      case 'takeaway': return 'Para Llevar';
      case 'delivery': return 'Delivery';
      case 'kitchen': return 'Sólo Cocina';
      case 'freeze': return 'Orden Congelada';
      default: return order.type;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gray-100 py-2 px-3 border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-800">Pedidos Activos</h2>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {activeOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-base">No hay pedidos activos</p>
            <p className="text-xs mt-1">Los pedidos procesados aparecerán aquí</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Pedidos congelados */}
            {frozenOrders.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-700 mb-1 text-sm">Congelados ({frozenOrders.length})</h3>
                <div className="space-y-2">
                  {frozenOrders.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      isSelected={order.id === selectedOrderId}
                      onSelect={() => setSelectedOrderId(order.id)}
                      onUpdateStatus={handleStatusChange}
                      onRecover={handleRecoverOrder}
                      onEdit={handleEditOrder}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* Pedidos pendientes */}
            {pendingOrders.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-700 mb-1 text-sm">Pendientes ({pendingOrders.length})</h3>
                <div className="space-y-2">
                  {pendingOrders.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      isSelected={order.id === selectedOrderId}
                      onSelect={() => setSelectedOrderId(order.id)}
                      onUpdateStatus={handleStatusChange}
                      onFinalize={handleFinalizeOrder}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Pedidos en preparación */}
            {inProgressOrders.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-700 mb-1 text-sm">En Preparación ({inProgressOrders.length})</h3>
                <div className="space-y-2">
                  {inProgressOrders.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      isSelected={order.id === selectedOrderId}
                      onSelect={() => setSelectedOrderId(order.id)}
                      onUpdateStatus={handleStatusChange}
                      onFinalize={handleFinalizeOrder}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Pedidos listos */}
            {readyOrders.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-700 mb-1 text-sm">Listos para Entregar ({readyOrders.length})</h3>
                <div className="space-y-2">
                  {readyOrders.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      isSelected={order.id === selectedOrderId}
                      onSelect={() => setSelectedOrderId(order.id)}
                      onUpdateStatus={handleStatusChange}
                      onFinalize={handleFinalizeOrder}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detalles de la orden seleccionada */}
      {selectedOrder && (
        <div className="border-t border-gray-200 p-3 bg-white max-h-72 overflow-auto">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="font-semibold text-gray-800">
                {getOrderTypeText(selectedOrder)}
              </h3>
              <p className="text-xs text-gray-500">
                {formatTime(selectedOrder.timestamp)}
                {selectedOrder.customer && ` • ${selectedOrder.customer}`}
              </p>
            </div>
            
            <div className="flex flex-col items-end space-y-1">
              <div className={`px-2 py-1 rounded-md text-xs font-medium ${getStatusClass(selectedOrder.status)}`}>
                {getStatusText(selectedOrder.status)}
              </div>
              
              <div className={`px-2 py-1 rounded-md text-xs font-medium ${getPaymentStatusClass(selectedOrder.isPaid)}`}>
                {selectedOrder.isPaid ? 'Pagado' : 'No pagado'}
              </div>
            </div>
          </div>
          
          <div className="space-y-1 mb-3">
            {selectedOrder.items.map((item) => (
              <div key={item.id} className="flex justify-between items-center text-xs py-1 border-b border-gray-100">
                <span>
                  <span className="font-medium">{item.quantity}x</span> {item.product.name}
                  {item.comment && (
                    <span className="text-gray-500 ml-1 italic">(Nota)</span>
                  )}
                </span>
                <span>${((item.product.finalPrice || item.product.price) * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            
            <div className="flex justify-between pt-1 font-bold">
              <span>Total:</span>
              <span>${selectedOrder.total.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="flex space-x-2">
            {/* Para pedidos congelados: editar o procesar */}
            {selectedOrder.type === 'freeze' && (
              <>
                <button
                  onClick={() => handleEditOrder(selectedOrder.id)}
                  className="flex-1 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
                >
                  Editar Pedido
                </button>
                
                <button
                  onClick={() => handleRecoverOrder(selectedOrder.id)}
                  className="flex-1 py-1.5 rounded-md bg-green-600 text-white text-xs font-medium hover:bg-green-700"
                >
                  Procesar Pago
                </button>
              </>
            )}
            
            {/* Botones según el estado para órdenes normales */}
            {selectedOrder.type !== 'freeze' && selectedOrder.status === 'pending' && (
              <button
                onClick={() => handleStatusChange(selectedOrder.id, 'in_progress')}
                className="flex-1 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
              >
                Iniciar Preparación
              </button>
            )}
            
            {selectedOrder.type !== 'freeze' && selectedOrder.status === 'in_progress' && (
              <button
                onClick={() => handleStatusChange(selectedOrder.id, 'ready')}
                className="flex-1 py-1.5 rounded-md bg-green-600 text-white text-xs font-medium hover:bg-green-700"
              >
                Marcar como Listo
              </button>
            )}
            
            {/* Botón para finalizar una orden, solo si está pagada */}
            {selectedOrder.type !== 'freeze' && selectedOrder.isPaid && (
              <button
                onClick={() => handleFinalizeOrder(selectedOrder.id)}
                className="flex-1 py-1.5 rounded-md bg-gray-800 text-white text-xs font-medium hover:bg-gray-900"
              >
                Finalizar Pedido
              </button>
            )}
            
            <button
              onClick={() => setSelectedOrderId(null)}
              className="py-1.5 px-4 rounded-md bg-gray-200 text-gray-800 text-xs font-medium hover:bg-gray-300"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente de tarjeta de orden
const OrderCard = ({ order, isSelected, onSelect, onUpdateStatus, onFinalize, onRecover, onEdit }) => {
  // Formatear hora
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Obtener clase según estado
  const getStatusClass = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'ready': return 'bg-green-100 text-green-800';
      case 'freeze': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  // Obtener clase de estado de pago
  const getPaymentClass = (isPaid) => {
    return isPaid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  // Calcular tiempo transcurrido en minutos
  const getElapsedMinutes = (timestamp) => {
    const now = new Date();
    const orderTime = new Date(timestamp);
    const diffMs = now - orderTime;
    return Math.floor(diffMs / 60000);
  };

  // Obtener texto según tipo de orden
  const getOrderTypeText = (order) => {
    switch (order.type) {
      case 'dine_in': return `Mesa ${order.table}`;
      case 'takeaway': return 'Para Llevar';
      case 'delivery': return 'Delivery';
      case 'kitchen': return 'Sólo Cocina';
      case 'freeze': return 'Orden Congelada';
      default: return order.type;
    }
  };

  const elapsedMinutes = getElapsedMinutes(order.timestamp);

  return (
    <div 
      className={`p-2 rounded-md border transition-colors ${
        isSelected 
          ? 'border-blue-500 bg-blue-50 cursor-default' 
          : 'border-gray-200 bg-white hover:bg-gray-50 cursor-pointer'
      }`}
      onClick={onSelect}
    >
      <div className="flex justify-between items-start mb-1">
        <div>
          <h4 className="font-medium text-gray-800 text-xs">
            {getOrderTypeText(order)}
          </h4>
          <p className="text-xs text-gray-500">
            {formatTime(order.timestamp)}
            {order.customer && ` • ${order.customer}`}
          </p>
        </div>
        
        <div className="flex flex-col items-end space-y-1">
          <div className={`px-2 py-0.5 rounded-md text-xs font-medium ${getStatusClass(order.status)}`}>
            {elapsedMinutes > 0 ? `${elapsedMinutes}m` : 'Nuevo'}
          </div>
          {order.isPaid !== undefined && (
            <div className={`px-2 py-0.5 rounded-md text-xs font-medium ${getPaymentClass(order.isPaid)}`}>
              {order.isPaid ? 'Pagado' : 'Pendiente'}
            </div>
          )}
        </div>
      </div>
      
      <div className="text-xs text-gray-600">
        {order.items.length} productos • ${order.total.toFixed(2)}
      </div>
      
      <div className="flex justify-end mt-1">
        {order.type === 'freeze' ? (
          // Para órdenes congeladas: botones de editar y procesar
          <div className="flex space-x-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(order.id);
              }}
              className="px-2 py-0.5 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-700"
              title="Añadir más productos"
            >
              Editar
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRecover(order.id);
              }}
              className="px-2 py-0.5 rounded text-xs font-medium bg-green-600 text-white hover:bg-green-700"
            >
              Procesar
            </button>
          </div>
        ) : (
          // Para órdenes normales: botones según estado
          <>
            {order.status === 'pending' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateStatus(order.id, 'in_progress');
                }}
                className="px-2 py-0.5 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-700"
              >
                Iniciar
              </button>
            )}
            
            {order.status === 'in_progress' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateStatus(order.id, 'ready');
                }}
                className="px-2 py-0.5 rounded text-xs font-medium bg-green-600 text-white hover:bg-green-700"
              >
                Listo
              </button>
            )}
            
            {/* Botón de finalizar solo si está pagado */}
            {order.isPaid && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFinalize(order.id);
                }}
                className="px-2 py-0.5 rounded text-xs font-medium bg-gray-800 text-white hover:bg-gray-900 ml-1"
              >
                Finalizar
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default OrdersSidebar;
