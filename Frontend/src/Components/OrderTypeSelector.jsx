import React, { useState, useEffect } from 'react';
import { useBusinessConfig } from '../Context/BusinessContext';
import * as SessionManager from '../utils/sessionManager';

function OrderTypeSelector({ onComplete, initialTableNumber }) {
  // Determinar si estamos en modo QR de mesa SOLO por el initialTableNumber
  const isQRMode = Boolean(initialTableNumber);
  
  const [orderInfo, setOrderInfo] = useState(() => {
    // Obtener información guardada de la sesión
    const savedOrderInfo = SessionManager.getFromSession('orderInfo');
    
    if (savedOrderInfo) {
      // Si hay información guardada, usarla
      // Si es modo QR, asegurarse de que el número de mesa sea el correcto
      if (isQRMode && initialTableNumber) {
        return { ...savedOrderInfo, tableNumber: initialTableNumber };
      }
      return savedOrderInfo;
    } 
    
    // Si no hay información guardada, crear nueva
    const baseInfo = {
      customerName: '',
      orderType: '', // No preseleccionar nada
      tableNumber: initialTableNumber || ''
    };
    
    // En modo normal, recuperar el nombre si está guardado
    if (!isQRMode) {
      const savedName = SessionManager.getSavedCustomerName();
      if (savedName) {
        baseInfo.customerName = savedName;
      }
    }
    
    return baseInfo;
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
      // En modo QR normal, mostrar selección de tipo de orden
      if (isQRMode) {
        if (showOrderTypes) {
          // Si ya se seleccionó el tipo de orden, guardar y completar
          if (!orderInfo.orderType) {
            // Asegurarse que se seleccionó un tipo de orden
            alert("Por favor selecciona el tipo de pedido");
            return;
          }
          
          // Verificar que si es inSite, tenga número de mesa
          if (orderInfo.orderType === 'inSite' && !isQRMode && (!orderInfo.tableNumber || orderInfo.tableNumber.trim() === '')) {
            alert("Por favor ingresa el número de mesa");
            return;
          }
          
          // Guardar información según el modo usando saveOrderInfo
          // En modo QR, asegurarnos de usar el número de mesa correcto
          const finalOrderInfo = {
            ...orderInfo,
            tableNumber: initialTableNumber || ''
          };
          console.log('Modo QR: usando mesa de URL: ' + initialTableNumber);
          
          // Usar la nueva función que maneja correctamente el almacenamiento
          SessionManager.saveOrderInfo(finalOrderInfo);
          onComplete(finalOrderInfo);
        } else {
          // Mostrar selección de tipo de orden
          setShowOrderTypes(true);
        }
      } else {
        // En modo normal, solo guardar el nombre y completar directamente
        // sin mostrar selección de tipo de pedido
        const normalModeInfo = {
          customerName: orderInfo.customerName.trim(),
          orderType: '', // No preseleccionar tipo de pedido
          tableNumber: '' // No incluir número de mesa por defecto
        };
        
        // Guardar nombre para futuras visitas
        SessionManager.saveCustomerName(normalModeInfo.customerName);
        
        // Guardar la información y continuar
        SessionManager.saveOrderInfo(normalModeInfo);
        onComplete(normalModeInfo);
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

        {/* Para modo normal, simplificado */}
        {!isQRMode && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ¿Cuál es tu nombre?
              </label>
              <input
                type="text"
                value={orderInfo.customerName}
                onChange={(e) => setOrderInfo({ ...orderInfo, customerName: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="Ingresa tu nombre"
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              style={{ backgroundColor: businessConfig.theme.buttonColor, color: businessConfig.theme.buttonTextColor }}
              className="w-full py-3 rounded-lg transition-colors duration-300"
            >
              Continuar
            </button>
          </form>
        )}

        {/* Para modo QR, con pasos */}
        {isQRMode && (
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
                ) : null}
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
        )}
      </div>
    </div>
  );
}

export default OrderTypeSelector; 