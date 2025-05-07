import React, { useState } from 'react';
import ProductToppingsModal from './ProductToppingsModal';

const CartPanel = ({ 
  cart, 
  onUpdateQuantity, 
  onRemoveItem, 
  onProcessOrder, 
  onFreezeOrder, 
  onSendToKitchen,
  orderSentToKitchen,
  onUpdateItem,
  isEditingFrozenOrder = false
}) => {
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [orderType, setOrderType] = useState('dine_in');
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [checkoutStep, setCheckoutStep] = useState('cart'); // 'cart', 'details', 'payment', 'confirmation'
  const [editingItemId, setEditingItemId] = useState(null); // ID del producto que estamos editando

  // Calcular total del carrito (corregido para incluir toppings)
  const calculateTotal = () => {
    return cart.reduce((sum, item) => {
      // Usar finalPrice si existe (ya incluye toppings), de lo contrario usar precio base
      const itemPrice = item.product.finalPrice || item.product.price;
      return sum + (itemPrice * item.quantity);
    }, 0);
  };

  // Manejar inicio de checkout
  const handleStartCheckout = () => {
    if (cart.length === 0) return;
    setCheckoutStep('details');
  };

  // Manejar envío de detalles
  const handleDetailsSubmit = (e) => {
    e.preventDefault();
    setCheckoutStep('payment');
  };

  // Manejar selección de método de pago
  const handlePaymentSubmit = () => {
    setCheckoutStep('confirmation');
  };

  // Manejar confirmación y creación de orden
  const handleConfirmOrder = () => {
    onProcessOrder({
      type: orderType,
      table: tableNumber,
      customer: customerName,
      paymentMethod: paymentMethod
    });
    
    // Resetear estados
    setPaymentMethod('cash');
    setOrderType('dine_in');
    setTableNumber('');
    setCustomerName('');
    setCheckoutStep('cart');
  };
  
  // Manejar congelación de orden
  const handleFreezeOrder = () => {
    onFreezeOrder({
      table: tableNumber || '',
      customer: customerName || ''
    });
    
    // Resetear estados
    setPaymentMethod('cash');
    setOrderType('dine_in');
    setTableNumber('');
    setCustomerName('');
    setCheckoutStep('cart');
  };

  // Manejar envío a cocina (sin limpiar carrito)
  const handleSendToKitchen = () => {
    onSendToKitchen();
  };

  // Manejar cancelación y volver al carrito
  const handleCancelCheckout = () => {
    setCheckoutStep('cart');
  };

  // Obtener el item por su ID
  const getCartItemById = (itemId) => {
    return cart.find(item => item.id === itemId);
  };

  // Manejar actualización de un item del carrito (para comentarios o toppings)
  const handleUpdateItem = (itemId, updatedProperties) => {
    // Utilizamos la función onUpdateItem proporcionada desde POS.jsx
    onUpdateItem(itemId, updatedProperties);
  };

  // Cerrar modal de edición de toppings
  const handleCloseEditModal = () => {
    setEditingItemId(null);
  };

  // Cuando se añade el producto editado al carrito desde el modal
  const handleAddEditedProductToCart = (product, quantity, selectedToppings) => {
    const itemToUpdate = getCartItemById(editingItemId);
    
    if (itemToUpdate) {
      // Actualizar propiedades del producto, manteniendo la cantidad original
      const updatedProduct = {
        ...product,
        selectedToppings
      };
      
      // Preservar el comentario existente si existe
      handleUpdateItem(editingItemId, { 
        product: updatedProduct,
        comment: itemToUpdate.comment // Mantener el comentario existente
      });
    }
    
    // Cerrar el modal
    setEditingItemId(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gray-100 py-2 px-3 border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-800">
          {checkoutStep === 'cart' && 'Carrito'}
          {checkoutStep === 'details' && 'Detalles del Pedido'}
          {checkoutStep === 'payment' && 'Método de Pago'}
          {checkoutStep === 'confirmation' && 'Confirmar Pedido'}
        </h2>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {/* Vista del carrito */}
        {checkoutStep === 'cart' && (
          <>
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-base">El carrito está vacío</p>
                <p className="text-xs mt-1">Agrega productos desde la sección izquierda</p>
              </div>
            ) : (
              <div className="space-y-2">
                {isEditingFrozenOrder && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-2 mb-3">
                    <div className="flex items-center text-sm text-blue-700">
                      <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Editando pedido congelado
                    </div>
                  </div>
                )}
              
                {orderSentToKitchen && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-2 mb-3">
                    <div className="flex items-center text-sm text-green-700">
                      <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Pedido enviado a cocina
                    </div>
                  </div>
                )}
                
                {!orderSentToKitchen && cart.length > 0 && !isEditingFrozenOrder && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2 mb-3">
                    <div className="flex items-center text-sm text-yellow-700">
                      <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Debes enviar el pedido a cocina antes de procesarlo o congelarlo
                    </div>
                  </div>
                )}
                
                {cart.map((item) => (
                  <CartItem
                    key={item.id}
                    item={item}
                    onUpdateQuantity={onUpdateQuantity}
                    onRemoveItem={onRemoveItem}
                    onUpdateItem={handleUpdateItem}
                    onEditToppings={(itemId) => setEditingItemId(itemId)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Vista de detalles del pedido (versión más compacta) */}
        {checkoutStep === 'details' && (
          <form onSubmit={handleDetailsSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Pedido
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  className={`py-1.5 px-2 rounded-md text-sm font-medium ${
                    orderType === 'dine_in'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                  onClick={() => setOrderType('dine_in')}
                >
                  Para Comer Aquí
                </button>
                <button
                  type="button"
                  className={`py-1.5 px-2 rounded-md text-sm font-medium ${
                    orderType === 'takeaway'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                  onClick={() => setOrderType('takeaway')}
                >
                  Para Llevar
                </button>
                <button
                  type="button"
                  className={`py-1.5 px-2 rounded-md text-sm font-medium ${
                    orderType === 'delivery'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                  onClick={() => setOrderType('delivery')}
                >
                  Delivery
                </button>
              </div>
            </div>

            {orderType === 'dine_in' && (
              <div>
                <label htmlFor="table-number" className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Mesa
                </label>
                <input
                  type="text"
                  id="table-number"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            )}

            <div>
              <label htmlFor="customer-name" className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del Cliente {orderType !== 'dine_in' && '(Opcional)'}
              </label>
              <input
                type="text"
                id="customer-name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required={orderType !== 'dine_in'}
              />
            </div>

            <div className="pt-2">
              <h3 className="font-medium text-gray-700 mb-1 text-sm">Resumen del Pedido</h3>
              <div className="max-h-36 overflow-auto border border-gray-200 rounded-md p-2">
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-xs py-1 border-b border-gray-100">
                    <span>{item.quantity}x {item.product.name}</span>
                    <span>${((item.product.finalPrice || item.product.price) * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </form>
        )}

        {/* Vista de método de pago (más compacto) */}
        {checkoutStep === 'payment' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Selecciona el Método de Pago
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`py-2 px-3 border rounded-md flex items-center justify-center space-x-1 text-sm ${
                    paymentMethod === 'cash'
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={() => setPaymentMethod('cash')}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>Efectivo</span>
                </button>
                
                <button
                  type="button"
                  className={`py-2 px-3 border rounded-md flex items-center justify-center space-x-1 text-sm ${
                    paymentMethod === 'card'
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={() => setPaymentMethod('card')}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <span>Tarjeta</span>
                </button>
                
                <button
                  type="button"
                  className={`py-2 px-3 border rounded-md flex items-center justify-center space-x-1 text-sm ${
                    paymentMethod === 'qr'
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={() => setPaymentMethod('qr')}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  <span>Pago QR</span>
                </button>
                
                <button
                  type="button"
                  className={`py-2 px-3 border rounded-md flex items-center justify-center space-x-1 text-sm ${
                    paymentMethod === 'transfer'
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={() => setPaymentMethod('transfer')}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span>Transferencia</span>
                </button>
              </div>
            </div>

            <div className="mt-4 p-3 bg-gray-50 rounded-md">
              <h3 className="font-medium text-gray-700 mb-1 text-sm">Detalles del Pedido</h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">Tipo:</span>
                  <span className="font-medium">
                    {orderType === 'dine_in' && 'Para Comer Aquí'}
                    {orderType === 'takeaway' && 'Para Llevar'}
                    {orderType === 'delivery' && 'Delivery'}
                  </span>
                </div>
                
                {orderType === 'dine_in' && tableNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Mesa:</span>
                    <span className="font-medium">{tableNumber}</span>
                  </div>
                )}
                
                {customerName && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cliente:</span>
                    <span className="font-medium">{customerName}</span>
                  </div>
                )}
                
                <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
                  <span className="text-gray-600">Total:</span>
                  <span className="font-bold">${calculateTotal().toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Vista de confirmación (más compacta) */}
        {checkoutStep === 'confirmation' && (
          <div className="space-y-4">
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center space-x-2">
                <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="text-base font-medium text-green-800">¡Todo listo!</h3>
                  <p className="text-sm text-green-700">
                    {sessionStorage.getItem('frozenOrderId') 
                      ? "Confirma para procesar el pago y finalizar" 
                      : "Confirma para procesar el pago"}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-md p-3">
              <h3 className="font-medium text-gray-800 mb-2 text-sm">Resumen del Pedido</h3>
              
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tipo:</span>
                      <span className="font-medium">
                        {orderType === 'dine_in' && 'Para Comer Aquí'}
                        {orderType === 'takeaway' && 'Para Llevar'}
                        {orderType === 'delivery' && 'Delivery'}
                      </span>
                    </div>
                    
                    {orderType === 'dine_in' && tableNumber && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Mesa:</span>
                        <span className="font-medium">{tableNumber}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    {customerName && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Cliente:</span>
                        <span className="font-medium">{customerName}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">Pago:</span>
                      <span className="font-medium">
                        {paymentMethod === 'cash' && 'Efectivo'}
                        {paymentMethod === 'card' && 'Tarjeta'}
                        {paymentMethod === 'qr' && 'Pago QR'}
                        {paymentMethod === 'transfer' && 'Transferencia'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="border-t border-gray-200 pt-2 mt-1">
                  <h4 className="font-medium text-gray-700 mb-1 text-xs">Productos</h4>
                  <div className="space-y-1">
                    {cart.map((item) => (
                      <div key={item.id} className="flex justify-between items-center text-xs py-0.5">
                        <span>{item.quantity}x {item.product.name}</span>
                        <span>${((item.product.finalPrice || item.product.price) * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    
                    <div className="flex justify-between border-t border-gray-200 pt-1 mt-1 font-bold text-sm">
                      <span>Total:</span>
                      <span>${calculateTotal().toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 p-3 bg-white">
        {/* Botones para carrito */}
        {checkoutStep === 'cart' && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-700 font-medium">Total:</span>
              <span className="text-lg font-bold text-gray-900">${calculateTotal().toFixed(2)}</span>
            </div>
            
            <button
              onClick={handleStartCheckout}
              disabled={cart.length === 0 || !orderSentToKitchen}
              className={`w-full py-2 rounded-md font-medium ${
                cart.length === 0 || !orderSentToKitchen
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
              title={!orderSentToKitchen && cart.length > 0 ? "Debes enviar el pedido a cocina primero" : ""}
            >
              Procesar Pedido
            </button>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleSendToKitchen}
                disabled={cart.length === 0 || orderSentToKitchen}
                className={`w-full py-1.5 rounded-md text-xs font-medium flex items-center justify-center space-x-1 ${
                  cart.length === 0 || orderSentToKitchen
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                }`}
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span>Enviar a Cocina</span>
              </button>
              
              <button
                onClick={handleFreezeOrder}
                disabled={cart.length === 0 || !orderSentToKitchen}
                className={`w-full py-1.5 rounded-md text-xs font-medium ${
                  cart.length === 0 || !orderSentToKitchen
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : isEditingFrozenOrder 
                      ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-300'
                      : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border border-yellow-300'
                }`}
                title={!orderSentToKitchen && cart.length > 0 
                  ? "Debes enviar el pedido a cocina primero" 
                  : isEditingFrozenOrder 
                    ? "Guardar cambios en la orden congelada" 
                    : "Guardar orden para procesarla más tarde"}
              >
                <div className="flex items-center justify-center space-x-1">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  <span>{isEditingFrozenOrder ? 'Actualizar Orden' : 'Congelar Orden'}</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Botones para detalles */}
        {checkoutStep === 'details' && (
          <div className="flex space-x-2">
            <button
              onClick={handleCancelCheckout}
              className="w-1/3 py-2 rounded-md font-medium text-sm bg-gray-200 text-gray-800 hover:bg-gray-300"
            >
              Atrás
            </button>
            
            <button
              onClick={handleDetailsSubmit}
              className="w-2/3 py-2 rounded-md font-medium text-sm bg-blue-600 text-white hover:bg-blue-700"
            >
              Continuar
            </button>
          </div>
        )}

        {/* Botones para método de pago */}
        {checkoutStep === 'payment' && (
          <div className="flex space-x-2">
            <button
              onClick={() => setCheckoutStep('details')}
              className="w-1/3 py-2 rounded-md font-medium text-sm bg-gray-200 text-gray-800 hover:bg-gray-300"
            >
              Atrás
            </button>
            
            <button
              onClick={handlePaymentSubmit}
              className="w-2/3 py-2 rounded-md font-medium text-sm bg-blue-600 text-white hover:bg-blue-700"
            >
              Continuar
            </button>
          </div>
        )}

        {/* Botones para confirmación */}
        {checkoutStep === 'confirmation' && (
          <div className="flex space-x-2">
            <button
              onClick={() => setCheckoutStep('payment')}
              className="w-1/3 py-2 rounded-md font-medium text-sm bg-gray-200 text-gray-800 hover:bg-gray-300"
            >
              Atrás
            </button>
            
            <button
              onClick={handleConfirmOrder}
              className="w-2/3 py-2 rounded-md font-medium text-sm bg-green-600 text-white hover:bg-green-700"
            >
              Confirmar Pedido
            </button>
          </div>
        )}
      </div>

      {/* Modal para editar toppings */}
      {editingItemId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-screen overflow-auto">
            <ProductToppingsModal
              product={getCartItemById(editingItemId).product}
              onAddToCart={handleAddEditedProductToCart}
              onClose={handleCloseEditModal}
              isEditing={true}
              currentQuantity={getCartItemById(editingItemId).quantity}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Componente de item del carrito (más compacto)
const CartItem = ({ item, onUpdateQuantity, onRemoveItem, onUpdateItem, onEditToppings }) => {
  // Expandir/colapsar toppings
  const [showToppings, setShowToppings] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [comment, setComment] = useState(item.comment || '');
  
  // Verificar si el producto tiene toppings seleccionados
  const hasToppings = item.product.selectedToppings && 
                     Array.isArray(item.product.selectedToppings) && 
                     item.product.selectedToppings.length > 0;
  
  // Precio unitario final (incluyendo toppings)
  const unitPrice = item.product.finalPrice || item.product.price;
  
  // Precio total
  const totalPrice = unitPrice * item.quantity;
  
  // Manejar guardar comentario
  const handleSaveComment = () => {
    onUpdateItem(item.id, { comment: comment });
    setShowCommentInput(false);
  };
  
  // Manejar edición de toppings
  const handleEditToppings = () => {
    onEditToppings(item.id);
  };
  
  return (
    <div className="bg-white rounded-md shadow-sm border border-gray-200 p-2">
      <div className="flex justify-between">
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <h3 className="font-medium text-gray-800 text-sm">{item.product.name}</h3>
            <button
              onClick={() => onRemoveItem(item.id)}
              className="text-gray-400 hover:text-red-500"
              title="Eliminar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          <div className="flex mt-1 justify-between items-center">
            <div className="flex items-center border rounded-md">
              <button
                onClick={() => onUpdateQuantity(item.id, -1)}
                className="px-1.5 py-0.5 text-gray-600 hover:bg-gray-100 text-xs"
                disabled={item.quantity <= 1}
              >
                -
              </button>
              <span className="px-1.5 py-0.5 text-center w-6 text-xs">{item.quantity}</span>
              <button
                onClick={() => onUpdateQuantity(item.id, 1)}
                className="px-1.5 py-0.5 text-gray-600 hover:bg-gray-100 text-xs"
              >
                +
              </button>
            </div>
            <p className="font-semibold text-gray-800 text-sm">${totalPrice.toFixed(2)}</p>
          </div>
          
          {/* Acciones adicionales: comentarios y editar toppings */}
          <div className="flex mt-1 space-x-2 text-xs">
            <button
              onClick={() => setShowCommentInput(!showCommentInput)}
              className="text-blue-600 flex items-center"
              title="Añadir comentario para cocina"
            >
              <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              {item.comment ? 'Editar nota' : 'Añadir nota'}
            </button>
            
            {hasToppings && (
              <button
                onClick={handleEditToppings}
                className="text-blue-600 flex items-center"
                title="Editar toppings"
              >
                <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Editar extras
              </button>
            )}
          </div>
          
          {/* Input para comentario */}
          {showCommentInput && (
            <div className="mt-2">
              <div className="flex space-x-1">
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Nota para cocina..."
                  className="text-xs px-2 py-1 flex-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={handleSaveComment}
                  className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Guardar
                </button>
              </div>
            </div>
          )}
          
          {/* Mostrar comentario si existe */}
          {item.comment && !showCommentInput && (
            <div className="mt-1 text-xs text-gray-600 bg-gray-100 p-1 rounded flex items-start">
              <svg className="h-3 w-3 mr-1 text-gray-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              <span className="break-words">{item.comment}</span>
            </div>
          )}
          
          {/* Mostrar indicador de toppings y botón para expandir */}
          {hasToppings && (
            <div className="mt-1">
              <button
                onClick={() => setShowToppings(!showToppings)}
                className="text-xs text-blue-600 flex items-center"
              >
                <span>{showToppings ? 'Ocultar' : 'Mostrar'} extras</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className={`h-3 w-3 ml-1 transition-transform ${showToppings ? 'rotate-180' : ''}`} 
                  viewBox="0 0 20 20" 
                  fill="currentColor"
                >
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              
              {/* Lista de toppings */}
              {showToppings && (
                <div className="mt-1 pl-2 border-l-2 border-gray-200 text-xs text-gray-600">
                  {item.product.selectedToppings.map((group, idx) => (
                    <div key={idx} className="mb-0.5">
                      <div className="font-medium">{group.groupName}</div>
                      {group.options && group.options.map((option, optIdx) => (
                        <div key={optIdx} className="pl-1.5 flex justify-between">
                          <span>{option.name}</span>
                          {parseFloat(option.price) > 0 && (
                            <span>+${parseFloat(option.price).toFixed(2)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CartPanel;
