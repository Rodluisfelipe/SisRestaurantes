import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBusinessConfig } from '../Context/BusinessContext';
import { colombiaData } from '../data/colombia-locations';

const LocationSettings = () => {
  const { businessConfig, updateConfig } = useBusinessConfig();
  const businessId = businessConfig._id || businessConfig.businessId;
  
  const [location, setLocation] = useState({
    department: '',
    city: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [availableCities, setAvailableCities] = useState([]);

  useEffect(() => {
    if (businessConfig) {
      setLocation({
        department: businessConfig.department || '',
        city: businessConfig.city || ''
      });
    }
  }, [businessConfig]);

  // Actualizar ciudades disponibles cuando cambie el departamento
  useEffect(() => {
    if (location.department) {
      const cities = colombiaData[location.department] || [];
      setAvailableCities(cities);
      
      // Si la ciudad actual no está en el nuevo departamento, limpiarla
      if (location.city && !cities.includes(location.city)) {
        setLocation(prev => ({ ...prev, city: '' }));
      }
    } else {
      setAvailableCities([]);
    }
  }, [location.department]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setLocation(prev => ({
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
        department: location.department,
        city: location.city,
        businessId
      });
      
      setMessage({
        text: 'Ubicación actualizada correctamente',
        type: 'success'
      });
    } catch (error) {
      setMessage({
        text: 'Error al actualizar la ubicación',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const departments = Object.keys(colombiaData);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-lg p-4 lg:p-6 border border-slate-100 lg:border-transparent"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg lg:text-2xl font-bold text-slate-800">Ubicación</h2>
          <p className="hidden lg:block text-slate-600 mt-1">
            Configura tu departamento y ciudad para aparecer en el catálogo
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Departamento */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Departamento
          </label>
          <select
            name="department"
            value={location.department}
            onChange={handleInputChange}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl lg:rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 lg:focus:ring-blue-500 focus:border-transparent bg-slate-50/50 lg:bg-white"
            required
          >
            <option value="">Selecciona un departamento</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        {/* Ciudad */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Ciudad
          </label>
          <select
            name="city"
            value={location.city}
            onChange={handleInputChange}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl lg:rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 lg:focus:ring-blue-500 focus:border-transparent bg-slate-50/50 lg:bg-white"
            required
            disabled={!location.department}
          >
            <option value="">
              {location.department ? 'Selecciona una ciudad' : 'Primero selecciona un departamento'}
            </option>
            {availableCities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>

        {/* Información sobre el catálogo */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl lg:rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-medium text-blue-800">Información del Catálogo</h4>
              <p className="text-sm text-blue-700 mt-1">
                Actualmente el catálogo está disponible solo en <strong>Chía, Cundinamarca</strong>. 
                Si seleccionas esta ubicación, tu negocio aparecerá en el catálogo público.
              </p>
            </div>
          </div>
        </div>

        {/* Mensaje de estado */}
        <AnimatePresence>
          {message.text && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-4 rounded-lg ${
                message.type === 'success' 
                  ? 'bg-green-50 border border-green-200 text-green-800' 
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}
            >
              {message.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Botón de guardar */}
        <div className="flex justify-end">
          <motion.button
            type="submit"
            disabled={loading || !location.department || !location.city}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              loading || !location.department || !location.city
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg hover:shadow-xl'
            }`}
          >
            {loading ? 'Guardando...' : 'Guardar Ubicación'}
          </motion.button>
        </div>
      </form>
    </motion.div>
  );
};

export default LocationSettings;
