import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';
import { socket } from '../services/socket';

const BusinessHoursSettings = () => {
  const { businessId } = useBusinessConfig();
  
  const [businessHours, setBusinessHours] = useState({
    monday: { isOpen: true, openTime: "08:00", closeTime: "22:00" },
    tuesday: { isOpen: true, openTime: "08:00", closeTime: "22:00" },
    wednesday: { isOpen: true, openTime: "08:00", closeTime: "22:00" },
    thursday: { isOpen: true, openTime: "08:00", closeTime: "22:00" },
    friday: { isOpen: true, openTime: "08:00", closeTime: "22:00" },
    saturday: { isOpen: true, openTime: "08:00", closeTime: "22:00" },
    sunday: { isOpen: true, openTime: "08:00", closeTime: "22:00" }
  });
  
  const [menuStatus, setMenuStatus] = useState('active');
  const [businessStatus, setBusinessStatus] = useState({
    isOpen: true,
    isOpenByHours: true,
    isMenuActive: true,
    menuStatus: 'active',
    nextOpenTime: null
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');

  const dayNames = {
    monday: 'Lunes',
    tuesday: 'Martes',
    wednesday: 'Miércoles',
    thursday: 'Jueves',
    friday: 'Viernes',
    saturday: 'Sábado',
    sunday: 'Domingo'
  };


  // Función para copiar horarios de un día a otros
  const copyDayHours = (sourceDay, targetDays) => {
    const sourceHours = businessHours[sourceDay];
    const newHours = { ...businessHours };
    
    targetDays.forEach(day => {
      if (day !== sourceDay) {
        newHours[day] = { ...sourceHours };
      }
    });
    
    setBusinessHours(newHours);
    setSuccessMessage(`Horarios de ${dayNames[sourceDay]} copiados correctamente`);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const fetchBusinessConfig = async () => {
    try {
      const response = await api.get(`/business-config?businessId=${businessId}`);
      if (response.data) {
        // Cargar horarios si existen
        if (response.data.businessHours) {
          setBusinessHours(response.data.businessHours);
        }
        
        // Cargar estado del menú
        if (response.data.menuStatus) {
          setMenuStatus(response.data.menuStatus);
        }
      }
      
      // Obtener estado actual del negocio
      const statusResponse = await api.get(`/business-config/status/${businessId}`);
      setBusinessStatus(statusResponse.data);
      
    } catch (error) {
      console.error('Error al cargar la configuración:', error);
      setError('Error al cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinessConfig();
    
    if (socket) {
      socket.connect();
      socket.emit('joinBusiness', businessId);

      // Escuchar actualizaciones de horarios
      socket.on('business_hours_update', (data) => {
        setBusinessHours(data.businessHours);
      });

      // Escuchar actualizaciones de estado del menú
      socket.on('menu_status_update', (data) => {
        setMenuStatus(data.menuStatus);
      });

      return () => {
        socket.emit('leaveBusiness', businessId);
        socket.off('business_hours_update');
        socket.off('menu_status_update');
      };
    }
  }, [businessId]);

  const handleDayToggle = (day) => {
    setBusinessHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        isOpen: !prev[day].isOpen
      }
    }));
  };

  const handleTimeChange = (day, field, value) => {
    setBusinessHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  const handleSaveHours = async () => {
    setSaving(true);
    setError('');
    setSuccessMessage('');
    
    try {
      await api.put('/business-config/hours', {
        businessId,
        businessHours
      });
      
      setSuccessMessage('Horarios actualizados correctamente');
      
      // Actualizar estado del negocio
      const statusResponse = await api.get(`/business-config/status/${businessId}`);
      setBusinessStatus(statusResponse.data);
      
    } catch (error) {
      console.error('Error al guardar horarios:', error);
      setError('Error al guardar los horarios');
    } finally {
      setSaving(false);
    }
  };

  const handleMenuStatusToggle = async () => {
    const newStatus = menuStatus === 'active' ? 'paused' : 'active';
    setSaving(true);
    setError('');
    setSuccessMessage('');
    
    try {
      await api.put('/business-config/menu-status', {
        businessId,
        menuStatus: newStatus
      });
      
      setMenuStatus(newStatus);
      setSuccessMessage(`Menú ${newStatus === 'active' ? 'activado' : 'pausado'} correctamente`);
      
      // Actualizar estado del negocio
      const statusResponse = await api.get(`/business-config/status/${businessId}`);
      setBusinessStatus(statusResponse.data);
      
    } catch (error) {
      console.error('Error al cambiar estado del menú:', error);
      setError('Error al cambiar el estado del menú');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = () => {
    if (businessStatus.isOpen) return 'text-green-600';
    if (!businessStatus.isOpenByHours) return 'text-red-600';
    if (!businessStatus.isMenuActive) return 'text-red-600';
    return 'text-gray-600';
  };

  const getStatusText = () => {
    if (businessStatus.isOpen) return '🟢 Abierto';
    if (!businessStatus.isOpenByHours) return '🔴 Cerrado';
    if (!businessStatus.isMenuActive) return '🔴 Cerrado';
    return '🔴 Cerrado';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="text-2xl">🕒</span>
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Horarios y Estado del Negocio</h2>
        <p className="text-slate-600">Configura los horarios de atención y controla el estado del menú</p>
      </motion.div>

      {/* Estado Actual */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-lg p-6"
      >
        <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <span className="mr-2">📊</span>
          Estado Actual del Negocio
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <span className="font-medium text-gray-700">Estado General:</span>
              <span className={`font-semibold ${getStatusColor()}`}>
                {getStatusText()}
              </span>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <span className="font-medium text-gray-700">Horarios:</span>
              <span className={`font-semibold ${businessStatus.isOpenByHours ? 'text-green-600' : 'text-red-600'}`}>
                {businessStatus.isOpenByHours ? '🟢 Abierto' : '🔴 Cerrado'}
              </span>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <span className="font-medium text-gray-700">Menú:</span>
              <span className={`font-semibold ${businessStatus.isMenuActive ? 'text-green-600' : 'text-red-600'}`}>
                {businessStatus.isMenuActive ? '🟢 Activo' : '🔴 Cerrado'}
              </span>
            </div>
          </div>
          
          <div className="space-y-4">
            {businessStatus.nextOpenTime && !businessStatus.isOpenByHours && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Próxima Apertura:</h4>
                <p className="text-blue-700">
                  {dayNames[businessStatus.nextOpenTime.day]} a las {businessStatus.nextOpenTime.time}
                </p>
              </div>
            )}
            
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Control Rápido:</h4>
              <button
                onClick={handleMenuStatusToggle}
                disabled={saving}
                className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                  menuStatus === 'active' 
                    ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {saving ? 'Procesando...' : 
                 menuStatus === 'active' ? '⏸️ Pausar Menú' : '▶️ Activar Menú'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Messages */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-red-50 border-2 border-red-200 text-red-700 px-6 py-4 rounded-2xl flex items-center space-x-3"
          >
            <span className="text-xl">❌</span>
            <span className="font-medium">{error}</span>
          </motion.div>
        )}
        
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-green-50 border-2 border-green-200 text-green-700 px-6 py-4 rounded-2xl flex items-center space-x-3"
          >
            <span className="text-xl">✅</span>
            <span className="font-medium">{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Configuración Manual de Horarios */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-lg p-6"
      >
        <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
          <span className="mr-2">📅</span>
          Horarios de Atención
        </h3>
        
        <div className="space-y-4">
          {Object.entries(dayNames).map(([dayKey, dayName]) => (
            <motion.div
              key={dayKey}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Object.keys(dayNames).indexOf(dayKey) * 0.1 }}
              className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                businessHours[dayKey]?.isOpen
                  ? 'border-green-200 bg-green-50'
                  : 'border-red-200 bg-red-50'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className={`w-4 h-4 rounded-full ${
                    businessHours[dayKey]?.isOpen ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <h4 className="font-semibold text-gray-900">{dayName}</h4>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      const newHours = { ...businessHours };
                      newHours[dayKey] = {
                        ...newHours[dayKey],
                        isOpen: !newHours[dayKey]?.isOpen
                      };
                      setBusinessHours(newHours);
                    }}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      businessHours[dayKey]?.isOpen
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-red-100 text-red-800 hover:bg-red-200'
                    }`}
                  >
                    {businessHours[dayKey]?.isOpen ? 'Abierto' : 'Cerrado'}
                  </button>
                  
                  {businessHours[dayKey]?.isOpen && (
                    <button
                      onClick={() => {
                        const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
                        const weekends = ['saturday', 'sunday'];
                        
                        if (weekdays.includes(dayKey)) {
                          copyDayHours(dayKey, weekdays);
                        } else if (weekends.includes(dayKey)) {
                          copyDayHours(dayKey, weekends);
                        }
                      }}
                      className="px-2 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-medium hover:bg-blue-200 transition-colors"
                      title={`Copiar a ${dayKey === 'monday' ? 'todos los días laborales' : dayKey === 'saturday' ? 'domingo' : 'sábado'}`}
                    >
                      📋 Copiar
                    </button>
                  )}
                </div>
              </div>
              
              {businessHours[dayKey]?.isOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center space-x-4"
                >
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hora de Apertura
                    </label>
                    <input
                      type="time"
                      value={businessHours[dayKey]?.openTime || '08:00'}
                      onChange={(e) => {
                        const newHours = { ...businessHours };
                        newHours[dayKey] = {
                          ...newHours[dayKey],
                          openTime: e.target.value
                        };
                        setBusinessHours(newHours);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                  
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hora de Cierre
                    </label>
                    <input
                      type="time"
                      value={businessHours[dayKey]?.closeTime || '22:00'}
                      onChange={(e) => {
                        const newHours = { ...businessHours };
                        newHours[dayKey] = {
                          ...newHours[dayKey],
                          closeTime: e.target.value
                        };
                        setBusinessHours(newHours);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
        
        <div className="mt-6 flex justify-end">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSaveHours}
            disabled={saving}
            className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
              saving
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl'
            }`}
          >
            {saving ? '⏳ Guardando...' : '💾 Guardar Horarios'}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default BusinessHoursSettings;
