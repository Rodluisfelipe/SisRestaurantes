import React, { useState } from 'react';
import { useBusinessConfig } from "../Context/BusinessContext";

function CartSummary({ cart, updateQuantity, removeFromCart, onClose, onOrder, orderInfo, updateOrderInfo, businessConfig: propBusinessConfig }) {
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderType, setOrderType] = useState('');
  const [deliveryInfo, setDeliveryInfo] = useState({
    phone: orderInfo?.phone || '',
    address: orderInfo?.address || ''
  });
  const [tableNumber, setTableNumber] = useState(orderInfo?.tableNumber || '');
  const { businessConfig } = useBusinessConfig();

  // Calcular totales correctamente
  const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalAmount = cart.reduce((sum, item) => {
    const itemPrice = parseFloat(item.finalPrice || item.price || 0);
    const quantity = parseInt(item.quantity || 0);
    return sum + (itemPrice * quantity);
  }, 0);

  const handleDeliverySubmit = () => {
    if (!deliveryInfo.phone || !deliveryInfo.address) {
      alert('Por favor completa todos los campos');
      return;
    }
    
    const updatedOrderInfo = {
      ...orderInfo,
      orderType: 'delivery',
      phone: deliveryInfo.phone,
      address: deliveryInfo.address,
      customerName: orderInfo.customerName
    };
    updateOrderInfo(updatedOrderInfo);
    closeOrderModal();
    onOrder();
  };

  const handleTableSubmit = () => {
    if (!tableNumber) {
      alert('Por favor ingresa el número de mesa');
      return;
    }
    
    const updatedOrderInfo = {
      ...orderInfo,
      orderType: 'inSite',
      tableNumber: tableNumber
    };
    updateOrderInfo(updatedOrderInfo);
    closeOrderModal();
    onOrder();
  };

  const openOrderModal = (type) => {
    setOrderType(type);
    setShowOrderModal(true);
    document.body.classList.add('modal-open'); // Prevenir scroll en el body
  };

  const closeOrderModal = () => {
    setShowOrderModal(false);
    document.body.classList.remove('modal-open');
  };

  // Renderizar el modal de forma condicional
  const OrderFormModal = () => {
    if (!showOrderModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-800">
              {orderType === 'inSite' ? 'Pedido en sitio' : 'Pedido a domicilio'}
            </h3>
            <button
              onClick={closeOrderModal}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {orderType === 'inSite' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Mesa
                </label>
                <input
                  type="number"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <button
                onClick={handleTableSubmit}
                style={{ backgroundColor: businessConfig.theme.buttonColor, color: businessConfig.theme.buttonTextColor }}
                className="w-full py-3 rounded-lg transition-colors duration-300"
              >
                Confirmar Pedido
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={deliveryInfo.phone}
                  onChange={(e) => setDeliveryInfo({...deliveryInfo, phone: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección
                </label>
                <textarea
                  value={deliveryInfo.address}
                  onChange={(e) => setDeliveryInfo({...deliveryInfo, address: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  rows="3"
                  required
                />
              </div>
              <button
                onClick={handleDeliverySubmit}
                style={{ backgroundColor: businessConfig.theme.buttonColor, color: businessConfig.theme.buttonTextColor }}
                className="w-full py-3 rounded-lg transition-colors duration-300"
              >
                Confirmar Pedido
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-40">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-900 scrollbar-track-gray-200">
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h2 className="text-xl font-bold text-gray-800">Resumen del Pedido</h2>
          <div className="w-6"></div>
        </div>

        <div className="p-4">
          {cart.map((item) => (
            <div key={item.uniqueId || item._id} className="flex flex-col py-4 border-b">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-800">{item.name}</h3>
                  
                  {/* Toppings */}
                  {item.selectedToppings && item.selectedToppings.length > 0 && (
                    <div className="pl-4 text-xs text-gray-600 mt-1">
                      {item.selectedToppings.map((topping, idx) => {
                        // Asegurar que basePrice sea un número o 0 - Movido fuera del JSX
                        const basePrice = Number(topping.basePrice || 0);
                        
                        return (
                          <div key={`${item.uniqueId || item._id}-topping-${idx}`}>
                            {/* Opción principal del grupo */}
                            <div>
                              {topping.optionName ? (
                                <span>
                                  {topping.groupName}{basePrice > 0 && ` (+$${basePrice.toFixed(2)})`}: {topping.optionName}
                                  {topping.price > 0 && ` (+$${topping.price.toFixed(2)})`}
                                </span>
                              ) : (
                                <span>
                                  {topping.groupName}{basePrice > 0 && ` (+$${basePrice.toFixed(2)})`}
                                </span>
                              )}
                            </div>
                            
                            {/* Subgrupos */}
                            {topping.subGroups && topping.subGroups.length > 0 && (
                              <div className="pl-2">
                                {topping.subGroups.map((subItem, subIdx) => (
                                  <div key={`${item.uniqueId || item._id}-subtopping-${subIdx}`}>
                                    <span>
                                      {subItem.subGroupTitle}: {subItem.optionName}
                                      {subItem.price > 0 && ` (+$${subItem.price.toFixed(2)})`}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  <p className="text-sm font-medium text-black mt-1">{(item.finalPrice || item.price || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} c/u</p>
                  <p className="text-sm text-gray-500">Subtotal: {((item.finalPrice || item.price || 0) * (item.quantity || 0)).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.uniqueId || item._id, (item.quantity || 0) - 1)}
                    className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full"
                  >
                    -
                  </button>
                  <span className="w-8 text-center">{item.quantity || 0}</span>
                  <button
                    onClick={() => updateQuantity(item.uniqueId || item._id, (item.quantity || 0) + 1)}
                    className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full"
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeFromCart(item.uniqueId || item._id)}
                    className="ml-2 text-red-600"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div className="mt-6 space-y-4">
            <div className="flex justify-between items-center text-lg">
              <span className="font-medium">Total ({totalItems} productos):</span>
              <span className="font-bold text-black">{totalAmount.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => openOrderModal('inSite')}
                style={{ backgroundColor: businessConfig.theme.buttonColor, color: businessConfig.theme.buttonTextColor }}
                className="w-full py-3 rounded-lg transition-colors duration-300"
              >
                En Sitio
              </button>
              <button
                onClick={() => openOrderModal('delivery')}
                style={{ backgroundColor: businessConfig.theme.buttonColor, color: businessConfig.theme.buttonTextColor }}
                className="w-full py-3 rounded-lg transition-colors duration-300"
              >
                A Domicilio
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Renderizar el modal para el formulario */}
      <OrderFormModal />
    </div>
  );
}

export default CartSummary; 