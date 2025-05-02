import React, { useState } from 'react';

function CartSummary({ cart, updateQuantity, removeFromCart, onClose, createWhatsAppMessage, onOrder, orderInfo, updateOrderInfo }) {
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [showTableForm, setShowTableForm] = useState(false);
  const [deliveryInfo, setDeliveryInfo] = useState({
    phone: orderInfo?.phone || '',
    address: orderInfo?.address || ''
  });
  const [tableNumber, setTableNumber] = useState(orderInfo?.tableNumber || '');

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
    onOrder();
  };

  const handleDeliveryClick = () => {
    setShowTableForm(false);
    setShowDeliveryForm(!showDeliveryForm);
  };

  const handleTableClick = () => {
    setShowDeliveryForm(false);
    setShowTableForm(!showTableForm);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
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
            <div key={item._id + JSON.stringify(item.selectedToppings)} className="flex flex-col py-4 border-b">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-800">{item.name}</h3>
                  
                  {/* Mostrar toppings seleccionados */}
                  {item.selectedToppings && Object.values(item.selectedToppings).map(group => (
                    <div key={group.groupName} className="mt-1">
                      <p className="text-sm text-gray-600">{group.groupName}:</p>
                      <ul className="ml-2">
                        {group.options.map(option => (
                          <li key={option.id} className="text-sm text-gray-500">
                            {option.name}
                            {option.price > 0 && ` (+$${option.price.toFixed(2)})`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  
                  <p className="text-sm font-medium text-blue-600 mt-1">
                    ${(item.finalPrice || item.price || 0).toFixed(2)} c/u
                  </p>
                  <p className="text-sm text-gray-500">
                    Subtotal: ${((item.finalPrice || item.price || 0) * (item.quantity || 0)).toFixed(2)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item._id, (item.quantity || 0) - 1)}
                    className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full"
                    disabled={item.quantity <= 1}
                  >
                    -
                  </button>
                  <span className="w-8 text-center">{item.quantity || 0}</span>
                  <button
                    onClick={() => updateQuantity(item._id, (item.quantity || 0) + 1)}
                    className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full"
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeFromCart(item._id)}
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
              <span className="font-bold text-blue-600">${totalAmount.toFixed(2)}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleTableClick}
                className={`py-3 rounded-lg transition-colors duration-300 ${
                  showTableForm 
                    ? 'bg-blue-700 text-white' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                En Sitio
              </button>
              <button
                onClick={handleDeliveryClick}
                className={`py-3 rounded-lg transition-colors duration-300 ${
                  showDeliveryForm 
                    ? 'bg-green-700 text-white' 
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                A Domicilio
              </button>
            </div>

            {showTableForm && (
              <div className="mt-4 space-y-4">
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
                  className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors duration-300"
                >
                  Confirmar Pedido
                </button>
              </div>
            )}

            {showDeliveryForm && (
              <div className="mt-4 space-y-4">
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
                  className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors duration-300"
                >
                  Confirmar Pedido
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CartSummary; 