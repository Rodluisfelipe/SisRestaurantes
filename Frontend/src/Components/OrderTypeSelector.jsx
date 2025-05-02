import React, { useState, useEffect } from 'react';
import api from '../services/api';

function OrderTypeSelector({ onComplete }) {
  const [orderInfo, setOrderInfo] = useState(() => {
    const savedOrderInfo = localStorage.getItem('orderInfo');
    return savedOrderInfo ? JSON.parse(savedOrderInfo) : {
      customerName: '',
      orderType: 'viewOnly'
    };
  });

  const [businessConfig, setBusinessConfig] = useState({
    businessName: '',
    logo: ''
  });

  useEffect(() => {
    const fetchBusinessConfig = async () => {
      try {
        const response = await api.get('/business-config');
        if (response.data) {
          setBusinessConfig(response.data);
        }
      } catch (error) {
        console.error('Error fetching business config:', error);
      }
    };

    fetchBusinessConfig();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (orderInfo.customerName.trim()) {
      localStorage.setItem('orderInfo', JSON.stringify(orderInfo));
      onComplete(orderInfo);
    }
  };

  const defaultLogo = 'https://via.placeholder.com/150?text=Logo';

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
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors duration-300"
          >
            Ver Menú
          </button>
        </form>
      </div>
    </div>
  );
}

export default OrderTypeSelector; 