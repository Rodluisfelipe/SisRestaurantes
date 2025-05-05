import React, { useState } from 'react';
import { useBusinessConfig } from '../Context/BusinessContext';

function OrderTypeSelector({ onComplete }) {
  const [orderInfo, setOrderInfo] = useState(() => {
    const savedOrderInfo = localStorage.getItem('orderInfo');
    return savedOrderInfo ? JSON.parse(savedOrderInfo) : {
      customerName: '',
      orderType: 'viewOnly'
    };
  });

  const { businessConfig } = useBusinessConfig();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (orderInfo.customerName.trim()) {
      localStorage.setItem('orderInfo', JSON.stringify(orderInfo));
      onComplete(orderInfo);
    }
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

          <button
            type="submit"
            style={{ backgroundColor: businessConfig.theme.buttonColor, color: businessConfig.theme.buttonTextColor }}
            className="w-full py-3 rounded-lg transition-colors duration-300"
          >
            Ver Menú
          </button>
        </form>
      </div>
    </div>
  );
}

export default OrderTypeSelector; 