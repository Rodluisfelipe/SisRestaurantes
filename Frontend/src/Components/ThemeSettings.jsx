import React, { useState, useEffect } from 'react';
import { useBusinessConfig } from '../Context/BusinessContext';

const ThemeSettings = () => {
  const { businessConfig, updateConfig } = useBusinessConfig();
  const businessId = businessConfig._id || businessConfig.businessId;
  
  const [theme, setTheme] = useState({
    buttonColor: '#2563eb',
    buttonTextColor: '#ffffff'
  });
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    if (businessConfig.theme) {
      setTheme(businessConfig.theme);
    }
  }, [businessConfig]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setTheme(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });
    
    try {
      await updateConfig({
        ...businessConfig,
        theme,
        businessId
      });
      
      setMessage({
        text: 'Tema actualizado correctamente',
        type: 'success'
      });
    } catch (error) {
      setMessage({
        text: 'Error al actualizar el tema',
        type: 'error'
      });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Personalización de Botones</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">
            Color de Botones
            <div className="flex items-center mt-1">
              <input
                type="color"
                name="buttonColor"
                value={theme.buttonColor}
                onChange={handleInputChange}
                className="h-10 w-10 rounded border border-gray-300 mr-2"
              />
              <input
                type="text"
                name="buttonColor"
                value={theme.buttonColor}
                onChange={handleInputChange}
                className="border border-gray-300 px-3 py-2 rounded"
              />
            </div>
          </label>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">
            Color de Texto de Botones
            <div className="flex items-center mt-1">
              <input
                type="color"
                name="buttonTextColor"
                value={theme.buttonTextColor}
                onChange={handleInputChange}
                className="h-10 w-10 rounded border border-gray-300 mr-2"
              />
              <input
                type="text"
                name="buttonTextColor"
                value={theme.buttonTextColor}
                onChange={handleInputChange}
                className="border border-gray-300 px-3 py-2 rounded"
              />
            </div>
          </label>
        </div>
        
        <div className="mt-6">
          <div className="mb-4">
            <h3 className="font-medium mb-2">Vista previa:</h3>
            <button 
              type="button"
              style={{ 
                backgroundColor: theme.buttonColor,
                color: theme.buttonTextColor
              }}
              className="px-4 py-2 rounded font-medium"
            >
              Botón de Ejemplo
            </button>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className={`px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
      
      {message.text && (
        <div className={`mt-4 p-3 rounded ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}
    </div>
  );
};

export default ThemeSettings; 