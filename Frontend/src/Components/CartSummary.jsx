import React, { useState, useEffect } from 'react';
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
  
  // Determinar si el pedido viene de un QR de mesa
  const isFromTableQR = Boolean(tableNumber);
  
  // Comprobar si el usuario eligió inicialmente "En sitio" o "Para llevar" desde el QR de mesa
  const initialOrderTypeSelected = isFromTableQR && 
    (orderInfo.orderType === 'inSite' || orderInfo.orderType === 'takeaway');

  // Calcular totales correctamente
  const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalAmount = cart.reduce((sum, item) => {
    // Obtener el precio base del producto
    const itemPrice = parseFloat(item.finalPrice || item.price || 0);
    const quantity = parseInt(item.quantity || 0);
    
    // Calcular el precio total con toppings
    let toppingPriceSum = 0;
    
    // Sumar el precio de los toppings si existen
    if (item.selectedToppings && item.selectedToppings.length > 0) {
      toppingPriceSum = item.selectedToppings.reduce((toppingSum, topping) => {
        // Sumar el precio base del grupo de toppings si existe
        let toppingGroupPrice = parseFloat(topping.basePrice || 0);
        
        // Sumar el precio de la opción seleccionada si existe
        toppingGroupPrice += parseFloat(topping.price || 0);
        
        // Sumar precios de los subgrupos si existen
        if (topping.subGroups && topping.subGroups.length > 0) {
          const subGroupsPrice = topping.subGroups.reduce(
            (subSum, subItem) => subSum + parseFloat(subItem.price || 0),
            0
          );
          toppingGroupPrice += subGroupsPrice;
        }
        
        return toppingSum + toppingGroupPrice;
      }, 0);
    }
    
    // Precio total por item: precio base + toppings, multiplicado por la cantidad
    const totalItemPrice = (itemPrice + toppingPriceSum) * quantity;
    return sum + totalItemPrice;
  }, 0);

  // Use useEffect to synchronize deliveryInfo with orderInfo
  useEffect(() => {
    // Only update if orderInfo changes from external sources
    if (orderInfo?.phone || orderInfo?.address) {
      setDeliveryInfo({
        phone: orderInfo.phone || '',
        address: orderInfo.address || ''
      });
    }
  }, [orderInfo?.phone, orderInfo?.address]);

  // Add a ref to track if form is being submitted to prevent double submission
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDeliverySubmit = (e) => {
    // Prevent default form submission if called from a form
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    
    // Prevent multiple submissions
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    // Trim input values to check if they're empty after whitespace removal
    const trimmedPhone = deliveryInfo.phone.trim();
    const trimmedAddress = deliveryInfo.address.trim();
    
    if (!trimmedPhone || !trimmedAddress) {
      alert('Por favor completa todos los campos');
      setIsSubmitting(false);
      return;
    }
    
    const updatedOrderInfo = {
      ...orderInfo,
      orderType: 'delivery',
      phone: trimmedPhone,
      address: trimmedAddress,
      customerName: orderInfo.customerName
    };
    
    // Update order info before closing modal and triggering order submission
    updateOrderInfo(updatedOrderInfo);
    closeOrderModal();
    
    // Small delay to ensure state is fully updated before order submission
    setTimeout(() => {
      onOrder();
      setIsSubmitting(false);
    }, 100);
  };

  // Update input handlers to use functional state updates to prevent stale state issues
  const handlePhoneChange = (e) => {
    const phone = e.target.value;
    setDeliveryInfo(prev => ({...prev, phone}));
  };
  
  const handleAddressChange = (e) => {
    const address = e.target.value;
    setDeliveryInfo(prev => ({...prev, address}));
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
  
  // Función para enviar directamente cuando ya se seleccionó un tipo de pedido desde QR de mesa
  const handleDirectSubmit = () => {
    // Si viene de QR mesa y ya eligió En Sitio o Para llevar, usamos esa información
    const updatedOrderInfo = {
      ...orderInfo
    };
    
    updateOrderInfo(updatedOrderInfo);
    onOrder();
  };

  const openOrderModal = (type) => {
    setOrderType(type);
    
    // Reset delivery info with the latest data from orderInfo
    if (type === 'delivery') {
      setDeliveryInfo({
        phone: orderInfo?.phone || '',
        address: orderInfo?.address || ''
      });
    }
    
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
        <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-lg font-bold text-gray-800">
              {orderType === 'inSite' ? 'Pedido en sitio' : 'Pedido a domicilio'}
            </h3>
            <button
              onClick={closeOrderModal}
              className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {orderType === 'inSite' ? (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Mesa
                </label>
                <input
                  type="number"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50 transition-shadow"
                  style={{ focusRing: businessConfig.theme.buttonColor }}
                  required
                  // Deshabilitar input si viene de QR de mesa
                  disabled={isFromTableQR}
                  // Agregar estilo visual si está deshabilitado
                  readOnly={isFromTableQR}
                />
                {isFromTableQR && (
                  <p className="text-xs text-gray-500 mt-1">
                    El número de mesa no se puede cambiar cuando escaneas desde la mesa
                  </p>
                )}
              </div>
              <button
                onClick={handleTableSubmit}
                style={{ backgroundColor: businessConfig.theme.buttonColor, color: businessConfig.theme.buttonTextColor }}
                className="w-full py-3 rounded-lg transition-colors duration-300 font-medium shadow-sm hover:shadow"
              >
                Confirmar Pedido
              </button>
            </div>
          ) : (
            <form onSubmit={handleDeliverySubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="phone-input">
                  Teléfono
                </label>
                <input
                  id="phone-input"
                  type="tel"
                  value={deliveryInfo.phone}
                  onChange={handlePhoneChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50 transition-shadow"
                  style={{ focusRing: businessConfig.theme.buttonColor }}
                  required
                  autoComplete="tel"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="address-input">
                  Dirección
                </label>
                <textarea
                  id="address-input"
                  value={deliveryInfo.address}
                  onChange={handleAddressChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50 transition-shadow"
                  style={{ focusRing: businessConfig.theme.buttonColor }}
                  rows="3"
                  required
                  autoComplete="street-address"
                />
              </div>
              <button
                type="submit"
                style={{ backgroundColor: businessConfig.theme.buttonColor, color: businessConfig.theme.buttonTextColor }}
                className="w-full py-3 rounded-lg transition-colors duration-300 font-medium shadow-sm hover:shadow"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Procesando...' : 'Confirmar Pedido'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  };

  // Función para calcular el precio total de un item (incluyendo toppings)
  const calculateItemTotal = (item) => {
    // Precio base del producto
    const basePrice = parseFloat(item.finalPrice || item.price || 0);
    const quantity = parseInt(item.quantity || 0);
    
    // Calcular el precio de los toppings
    let toppingPriceSum = 0;
    
    if (item.selectedToppings && item.selectedToppings.length > 0) {
      toppingPriceSum = item.selectedToppings.reduce((toppingSum, topping) => {
        // Precio base del grupo de toppings
        let toppingGroupPrice = parseFloat(topping.basePrice || 0);
        
        // Precio de la opción seleccionada
        toppingGroupPrice += parseFloat(topping.price || 0);
        
        // Precios de subgrupos
        if (topping.subGroups && topping.subGroups.length > 0) {
          const subGroupsPrice = topping.subGroups.reduce(
            (subSum, subItem) => subSum + parseFloat(subItem.price || 0),
            0
          );
          toppingGroupPrice += subGroupsPrice;
        }
        
        return toppingSum + toppingGroupPrice;
      }, 0);
    }
    
    // Precio total: (base + toppings) * cantidad
    return (basePrice + toppingPriceSum) * quantity;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-40">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center z-10">
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800 transition-colors p-1 rounded-full hover:bg-gray-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h2 className="text-xl font-bold text-gray-800">Resumen del Pedido</h2>
          <div className="w-6"></div>
        </div>

        {/* Cart Items */}
        <div className="p-4">
          {cart.map((item) => (
            <div key={item.uniqueId || item._id} className="flex flex-col py-4 border-b last:border-b-0">
              <div className="flex justify-between items-start">
                {/* Item details */}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 text-base">{item.name}</h3>
                  
                  {/* Toppings */}
                  {item.selectedToppings && item.selectedToppings.length > 0 && (
                    <div className="pl-4 text-xs text-gray-600 mt-1 space-y-1 border-l-2 border-gray-200">
                      {item.selectedToppings.map((topping, idx) => {
                        // Asegurar que basePrice sea un número o 0 - Movido fuera del JSX
                        const basePrice = Number(topping.basePrice || 0);
                        
                        return (
                          <div key={`${item.uniqueId || item._id}-topping-${idx}`} className="py-0.5">
                            {/* Opción principal del grupo */}
                            <div>
                              {topping.optionName ? (
                                <span className="flex flex-wrap items-center">
                                  <span className="font-medium mr-1">{topping.groupName}</span>
                                  {basePrice > 0 && <span className="text-gray-500 mr-1">(+{basePrice.toLocaleString('es-CO')})</span>}: 
                                  <span className="ml-1">{topping.optionName}</span>
                                  {topping.price > 0 && <span className="text-gray-500 ml-1">(+{topping.price.toLocaleString('es-CO')})</span>}
                                </span>
                              ) : (
                                <span className="flex flex-wrap items-center">
                                  <span className="font-medium">{topping.groupName}</span>
                                  {basePrice > 0 && <span className="text-gray-500 ml-1">(+{basePrice.toLocaleString('es-CO')})</span>}
                                </span>
                              )}
                            </div>
                            
                            {/* Subgrupos */}
                            {topping.subGroups && topping.subGroups.length > 0 && (
                              <div className="pl-3 mt-1 space-y-0.5 border-l border-gray-200">
                                {topping.subGroups.map((subItem, subIdx) => (
                                  <div key={`${item.uniqueId || item._id}-subtopping-${subIdx}`}>
                                    <span className="flex flex-wrap items-center">
                                      <span className="font-medium text-gray-700 mr-1">{subItem.subGroupTitle}:</span>
                                      <span>{subItem.optionName}</span>
                                      {subItem.price > 0 && <span className="text-gray-500 ml-1">(+{subItem.price.toLocaleString('es-CO')})</span>}
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
                  
                  {/* Price information */}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-black px-2 py-0.5 bg-gray-100 rounded-full">
                      {(item.finalPrice || item.price || 0).toLocaleString('es-CO')} c/u
                    </p>
                    <p className="text-sm font-medium" style={{ color: businessConfig.theme.buttonColor }}>
                      Subtotal: {calculateItemTotal(item).toLocaleString('es-CO')}
                    </p>
                  </div>
                </div>

                {/* Quantity controls */}
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => updateQuantity(item.uniqueId || item._id, (item.quantity || 0) - 1)}
                    className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                    style={{ color: businessConfig.theme.buttonColor }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                    </svg>
                  </button>
                  <span className="w-8 text-center font-medium">{item.quantity || 0}</span>
                  <button
                    onClick={() => updateQuantity(item.uniqueId || item._id, (item.quantity || 0) + 1)}
                    className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                    style={{ color: businessConfig.theme.buttonColor }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => removeFromCart(item.uniqueId || item._id)}
                    className="ml-1 text-red-500 hover:text-red-600 transition-colors p-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Empty cart state */}
          {cart.length === 0 && (
            <div className="py-8 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-gray-500 mb-2">Tu carrito está vacío</p>
              <button
                onClick={onClose}
                className="text-sm px-4 py-2 rounded-lg transition-colors duration-300"
                style={{ backgroundColor: businessConfig.theme.buttonColor, color: businessConfig.theme.buttonTextColor }}
              >
                Continuar comprando
              </button>
            </div>
          )}

          {/* Total and action buttons */}
          {cart.length > 0 && (
            <div className="mt-6 space-y-6">
              {/* Total amount */}
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-800">Total ({totalItems} productos):</span>
                <span className="font-bold text-xl" style={{ color: businessConfig.theme.buttonColor }}>
                  {totalAmount.toLocaleString('es-CO')}
                </span>
              </div>

              {/* Mostrar información de la mesa si hay tableNumber */}
              {isFromTableQR && (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                  <p className="text-blue-700 font-medium">Mesa: {tableNumber}</p>
                </div>
              )}

              {/* Order type buttons */}
              <div className={initialOrderTypeSelected ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-2 gap-4'}>
                {initialOrderTypeSelected && orderInfo.orderType === 'inSite' ? (
                  <button
                    onClick={handleDirectSubmit}
                    style={{ backgroundColor: businessConfig.theme.buttonColor, color: businessConfig.theme.buttonTextColor }}
                    className="w-full py-3 rounded-lg transition-colors duration-300 font-medium flex items-center justify-center gap-2 shadow-sm hover:shadow"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Confirmar Pedido en Mesa {tableNumber}
                  </button>
                ) : initialOrderTypeSelected && orderInfo.orderType === 'takeaway' ? (
                  <button
                    onClick={handleDirectSubmit}
                    style={{ backgroundColor: businessConfig.theme.buttonColor, color: businessConfig.theme.buttonTextColor }}
                    className="w-full py-3 rounded-lg transition-colors duration-300 font-medium flex items-center justify-center gap-2 shadow-sm hover:shadow"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                    Confirmar Pedido Para Llevar
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => openOrderModal('inSite')}
                      style={{ backgroundColor: businessConfig.theme.buttonColor, color: businessConfig.theme.buttonTextColor }}
                      className="w-full py-3 rounded-lg transition-colors duration-300 font-medium flex items-center justify-center gap-2 shadow-sm hover:shadow"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      En Sitio
                    </button>
                    {!isFromTableQR ? (
                      <button
                        onClick={() => openOrderModal('delivery')}
                        style={{ backgroundColor: businessConfig.theme.buttonColor, color: businessConfig.theme.buttonTextColor }}
                        className="w-full py-3 rounded-lg transition-colors duration-300 font-medium flex items-center justify-center gap-2 shadow-sm hover:shadow"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        A Domicilio
                      </button>
                    ) : (
                      <button
                        onClick={() => openOrderModal('takeaway')}
                        style={{ backgroundColor: businessConfig.theme.buttonColor, color: businessConfig.theme.buttonTextColor }}
                        className="w-full py-3 rounded-lg transition-colors duration-300 font-medium flex items-center justify-center gap-2 shadow-sm hover:shadow"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                        Para Llevar
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Order form modal - improve styling */}
      {showOrderModal && (
        <OrderFormModal />
      )}
    </div>
  );
}

export default CartSummary; 