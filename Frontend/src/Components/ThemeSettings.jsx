import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
    <div className="space-y-8">
      {/* Modern Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl">
          <span className="text-2xl">🎨</span>
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Personalización de Tema</h2>
        <p className="text-slate-600">Personaliza la apariencia de tu restaurante</p>
      </motion.div>

      {/* Messages */}
      <AnimatePresence>
        {message.text && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className={`p-4 rounded-2xl border-2 flex items-center space-x-3 ${
              message.type === 'success' 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <span className="text-xl">
              {message.type === 'success' ? '✅' : '❌'}
            </span>
            <span className="font-medium">{message.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.form 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onSubmit={handleSubmit} 
        className="space-y-8"
      >
        {/* Color Customization Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-xl p-8 border border-slate-200/50"
        >
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
              <span className="text-xl">🎨</span>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Personalización de Botones</h3>
            <p className="text-slate-600">Configura los colores de los botones de tu sistema</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Button Color */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-3">
                <h4 className="text-lg font-semibold text-slate-900">Color de Botones</h4>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <input
                      type="color"
                      name="buttonColor"
                      value={theme.buttonColor}
                      onChange={handleInputChange}
                      className="w-16 h-16 rounded-2xl border-4 border-white shadow-xl cursor-pointer"
                      style={{ backgroundColor: theme.buttonColor }}
                    />
                    <div className="absolute inset-0 rounded-2xl border-2 border-slate-200 pointer-events-none"></div>
                  </div>
                  
                  <div className="flex-1">
                    <input
                      type="text"
                      name="buttonColor"
                      value={theme.buttonColor}
                      onChange={handleInputChange}
                      placeholder="#2563eb"
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all duration-200 font-mono text-slate-700"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Button Text Color */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-3">
                <span className="text-2xl">✏️</span>
                <h4 className="text-lg font-semibold text-slate-900">Color de Texto</h4>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <input
                      type="color"
                      name="buttonTextColor"
                      value={theme.buttonTextColor}
                      onChange={handleInputChange}
                      className="w-16 h-16 rounded-2xl border-4 border-white shadow-xl cursor-pointer"
                      style={{ backgroundColor: theme.buttonTextColor }}
                    />
                    <div className="absolute inset-0 rounded-2xl border-2 border-slate-200 pointer-events-none"></div>
                  </div>
                  
                  <div className="flex-1">
                    <input
                      type="text"
                      name="buttonTextColor"
                      value={theme.buttonTextColor}
                      onChange={handleInputChange}
                      placeholder="#ffffff"
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all duration-200 font-mono text-slate-700"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Preview Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-xl p-8 border border-slate-200/50"
        >
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
              <span className="text-xl">👁️</span>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Vista Previa</h3>
            <p className="text-slate-600">Así se verán tus botones personalizados</p>
          </div>

          <div className="flex justify-center space-x-4">
            <motion.button 
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{ 
                backgroundColor: theme.buttonColor,
                color: theme.buttonTextColor
              }}
              className="px-8 py-4 rounded-2xl font-semibold shadow-xl transition-all duration-200"
            >
              Botón de Ejemplo
            </motion.button>
            
            <motion.button 
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{ 
                backgroundColor: theme.buttonColor,
                color: theme.buttonTextColor,
                opacity: 0.8
              }}
              className="px-6 py-3 rounded-xl font-medium shadow-lg transition-all duration-200"
            >
              Secundario
            </motion.button>
          </div>
        </motion.div>

        {/* Action Button */}
        <div className="flex justify-center pt-4">
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            className={`px-12 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl font-semibold shadow-xl transition-all duration-200 flex items-center space-x-3 ${
              loading ? 'opacity-50 cursor-not-allowed' : 'hover:from-blue-600 hover:to-purple-700'
            }`}
          >
            <span className="text-xl">
              {loading ? '⏳' : '💾'}
            </span>
            <span>
              {loading ? 'Guardando Cambios...' : 'Guardar Cambios'}
            </span>
          </motion.button>
        </div>
      </motion.form>
    </div>
  );
};

export default ThemeSettings; 