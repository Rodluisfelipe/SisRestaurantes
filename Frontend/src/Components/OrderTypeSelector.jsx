import React, { useState, useEffect } from 'react';
import { useBusinessConfig } from '../Context/BusinessContext';

function OrderTypeSelector({ onComplete, initialTableNumber }) {
  const [orderInfo, setOrderInfo] = useState(() => {
    const savedOrderInfo = localStorage.getItem('orderInfo');
    return savedOrderInfo ? JSON.parse(savedOrderInfo) : {
      customerName: '',
      orderType: '', // No preseleccionar nada
      tableNumber: initialTableNumber || ''
    };
  });

  const [showOrderTypes, setShowOrderTypes] = useState(false);
  const { businessConfig } = useBusinessConfig();

  // Solo actualiza el número de mesa, pero no el tipo de orden
  useEffect(() => {
    if (initialTableNumber && (!orderInfo.tableNumber || orderInfo.tableNumber !== initialTableNumber)) {
      setOrderInfo(prevInfo => ({
        ...prevInfo,
        tableNumber: initialTableNumber
      }));
    }
  }, [initialTableNumber, orderInfo.tableNumber]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (orderInfo.customerName.trim()) {
      if (showOrderTypes) {
        // Si ya se seleccionó el tipo de orden, guardar y completar
        if (!orderInfo.orderType) {
          // Asegurarse que se seleccionó un tipo de orden
          alert("Por favor selecciona el tipo de pedido");
          return;
        }
        localStorage.setItem('orderInfo', JSON.stringify(orderInfo));
        // Guardar también el tiempo de inicio de la sesión
        localStorage.setItem('sessionStartTime', Date.now());
        onComplete(orderInfo);
      } else {
        // Mostrar selección de tipo de orden
        setShowOrderTypes(true);
      }
    }
  };

  const handleOrderTypeChange = (type) => {
    setOrderInfo({ ...orderInfo, orderType: type });
  };

  const defaultLogo = 'https://placehold.co/150x150?text=Logo';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">
          Bienvenid@ a {businessConfig.businessName || 'nuestro restaurante'}
        </h2>

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-blue-500 shadow-lg">
            <img
              src={businessConfig.logo || defaultLogo}
              alt="Logo del negocio"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.src = defaultLogo;
              }}
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!showOrderTypes ? (
            // First step: Ask for customer name
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tu nombre
              </label>
              <input
                type="text"
                value={orderInfo.customerName}
                onChange={(e) => setOrderInfo({ ...orderInfo, customerName: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="Ingresa tu nombre"
                required
              />
            </div>
          ) : (
            // Second step: Show appropriate options based on table number
            <div className="space-y-4">
              {initialTableNumber ? (
                // Si es un QR de mesa, mostrar opciones limitadas
                <div>
                  <p className="text-gray-700 text-center mb-4">
                    Hola {orderInfo.customerName}, estás en la mesa {initialTableNumber}.
                  </p>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de pedido
                  </label>
                  <div className="flex flex-col space-y-2">
                    <button
                      type="button"
                      onClick={() => handleOrderTypeChange('inSite')}
                      className={`w-full py-3 rounded-lg flex items-center justify-center transition-colors duration-300 ${
                        orderInfo.orderType === 'inSite'
                          ? 'bg-blue-100 border-blue-500 border text-blue-700'
                          : 'bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      En sitio
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOrderTypeChange('takeaway')}
                      className={`w-full py-3 rounded-lg flex items-center justify-center transition-colors duration-300 ${
                        orderInfo.orderType === 'takeaway'
                          ? 'bg-blue-100 border-blue-500 border text-blue-700'
                          : 'bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                      Para llevar
                    </button>
                  </div>
                </div>
              ) : (
                // Si no es QR de mesa, mostrar todas las opciones
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de pedido
                  </label>
                  <div className="flex flex-col space-y-2">
                    <button
                      type="button"
                      onClick={() => handleOrderTypeChange('viewOnly')}
                      className={`w-full py-3 rounded-lg flex items-center justify-center transition-colors duration-300 ${
                        orderInfo.orderType === 'viewOnly'
                          ? 'bg-blue-100 border-blue-500 border text-blue-700'
                          : 'bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Solo ver menú
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOrderTypeChange('inSite')}
                      className={`w-full py-3 rounded-lg flex items-center justify-center transition-colors duration-300 ${
                        orderInfo.orderType === 'inSite'
                          ? 'bg-blue-100 border-blue-500 border text-blue-700'
                          : 'bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      En sitio
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOrderTypeChange('delivery')}
                      className={`w-full py-3 rounded-lg flex items-center justify-center transition-colors duration-300 ${
                        orderInfo.orderType === 'delivery'
                          ? 'bg-blue-100 border-blue-500 border text-blue-700'
                          : 'bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      A domicilio
                    </button>
                  </div>
                  
                  {/* Show table input if 'inSite' is selected */}
                  {orderInfo.orderType === 'inSite' && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Número de mesa
                      </label>
                      <input
                        type="text"
                        value={orderInfo.tableNumber || ''}
                        onChange={(e) => setOrderInfo({ ...orderInfo, tableNumber: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="Ej: 5"
                        required={orderInfo.orderType === 'inSite'}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            style={{ backgroundColor: businessConfig.theme.buttonColor, color: businessConfig.theme.buttonTextColor }}
            className="w-full py-3 rounded-lg transition-colors duration-300"
          >
            {!showOrderTypes ? 'Continuar' : 'Ver Menú'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default OrderTypeSelector; 