import React, { useState } from 'react';
import api from '../services/api';

const StoreStatusToggle = ({ initialIsOpen, onStatusChange }) => {
  const [isOpen, setIsOpen] = useState(initialIsOpen);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const toggleStatus = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const newStatus = !isOpen;
      
      // Usar la ruta principal para actualizar el estado del negocio
      // Enviando solo la información necesaria para evitar perder datos existentes
      const response = await api.put('/business-config', { isOpen: newStatus });
      
      console.log('Respuesta al cambiar estado:', response.data);
      
      // Actualizar el estado local después de confirmar que se guardó en el servidor
      setIsOpen(newStatus);
      
      // Notificar al componente padre
      if (onStatusChange) {
        onStatusChange(newStatus);
      }
    } catch (err) {
      console.error('Error al cambiar el estado del negocio:', err);
      setError('Error al cambiar el estado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Estado del Negocio:</span>
        <div className="flex items-center space-x-2">
          <span className={`text-sm font-medium ${isOpen ? 'text-green-600' : 'text-red-600'}`}>
            {isOpen ? 'Abierto' : 'Cerrado'}
          </span>
          <div className="relative inline-block w-12 align-middle select-none">
            <input 
              type="checkbox" 
              checked={isOpen} 
              onChange={toggleStatus}
              disabled={loading}
              className="sr-only"
              id="toggleStoreStatus"
            />
            <label 
              htmlFor="toggleStoreStatus"
              className={`block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-200 ease-in ${
                loading 
                  ? 'bg-gray-300' 
                  : isOpen 
                    ? 'bg-green-500' 
                    : 'bg-red-500'
              }`}
            >
              <span 
                className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform duration-200 ease-in ${
                  isOpen ? 'translate-x-6' : 'translate-x-0'
                }`}
              ></span>
            </label>
          </div>
        </div>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default StoreStatusToggle; 