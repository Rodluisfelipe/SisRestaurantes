import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';
import { socket } from '../services/socket';
import {
  FaClock, FaPause, FaPlay, FaSave, FaSyncAlt,
  FaCheckCircle, FaExclamationCircle, FaCopy
} from 'react-icons/fa';

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
    if (businessStatus.isOpen) return 'Abierto';
    if (!businessStatus.isOpenByHours) return 'Cerrado';
    if (!businessStatus.isMenuActive) return 'Cerrado';
    return 'Cerrado';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-slate-400">
        <FaSyncAlt className="animate-spin mr-2 text-xs" /> Cargando horarios...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Estado Actual */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center">
            <FaClock className="text-[10px] text-slate-500" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Horarios y Estado del Negocio</h3>
        </div>
        
        <div className="p-4">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">Estado Actual</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-[10px] text-slate-400 mb-1">General</p>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${businessStatus.isOpen ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className={`text-xs font-semibold ${getStatusColor()}`}>{getStatusText()}</span>
              </div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-[10px] text-slate-400 mb-1">Horarios</p>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${businessStatus.isOpenByHours ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className={`text-xs font-semibold ${businessStatus.isOpenByHours ? 'text-emerald-600' : 'text-red-600'}`}>
                  {businessStatus.isOpenByHours ? 'Abierto' : 'Cerrado'}
                </span>
              </div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-[10px] text-slate-400 mb-1">Menú</p>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${businessStatus.isMenuActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className={`text-xs font-semibold ${businessStatus.isMenuActive ? 'text-emerald-600' : 'text-red-600'}`}>
                  {businessStatus.isMenuActive ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-[10px] text-slate-400 mb-1">Control</p>
              <button
                onClick={handleMenuStatusToggle}
                disabled={saving}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                  menuStatus === 'active' 
                    ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' 
                    : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
                } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {saving ? <FaSyncAlt className="animate-spin text-[9px]" /> : 
                 menuStatus === 'active' ? <><FaPause className="text-[9px]" /> Pausar</> : <><FaPlay className="text-[9px]" /> Activar</>}
              </button>
            </div>
          </div>

          {businessStatus.nextOpenTime && !businessStatus.isOpenByHours && (
            <div className="mt-2 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-[11px] text-slate-600">
                <span className="font-medium">Próxima apertura:</span> {dayNames[businessStatus.nextOpenTime.day]} a las {businessStatus.nextOpenTime.time}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white border border-red-200 text-red-600 px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs"
          >
            <FaExclamationCircle className="text-[10px] flex-shrink-0" />
            <span className="font-medium">{error}</span>
          </motion.div>
        )}
        
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white border border-emerald-200 text-emerald-600 px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs"
          >
            <FaCheckCircle className="text-[10px] flex-shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Horarios de Atención */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Horarios de Atención</p>
        </div>
        
        <div className="divide-y divide-slate-100">
          {Object.entries(dayNames).map(([dayKey, dayName]) => (
            <div key={dayKey} className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${businessHours[dayKey]?.isOpen ? 'bg-emerald-500' : 'bg-red-400'}`} />
                  <span className="text-xs font-semibold text-slate-700">{dayName}</span>
                </div>
                
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      const newHours = { ...businessHours };
                      newHours[dayKey] = { ...newHours[dayKey], isOpen: !newHours[dayKey]?.isOpen };
                      setBusinessHours(newHours);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                      businessHours[dayKey]?.isOpen
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-red-50 text-red-600 border border-red-200'
                    }`}
                  >
                    {businessHours[dayKey]?.isOpen ? 'Abierto' : 'Cerrado'}
                  </button>
                  
                  {businessHours[dayKey]?.isOpen && (
                    <button
                      onClick={() => {
                        const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
                        const weekends = ['saturday', 'sunday'];
                        if (weekdays.includes(dayKey)) copyDayHours(dayKey, weekdays);
                        else if (weekends.includes(dayKey)) copyDayHours(dayKey, weekends);
                      }}
                      className="px-2 py-1 bg-slate-50 text-slate-500 border border-slate-200 rounded-lg text-[10px] font-medium hover:bg-slate-100 transition-colors flex items-center gap-1"
                      title="Copiar horarios"
                    >
                      <FaCopy className="text-[8px]" /> Copiar
                    </button>
                  )}
                </div>
              </div>
              
              {businessHours[dayKey]?.isOpen && (
                <div className="flex items-center gap-3 pl-4">
                  <div className="flex-1">
                    <label className="block text-[10px] text-slate-400 mb-0.5">Apertura</label>
                    <input
                      type="time"
                      value={businessHours[dayKey]?.openTime || '08:00'}
                      onChange={(e) => {
                        const newHours = { ...businessHours };
                        newHours[dayKey] = { ...newHours[dayKey], openTime: e.target.value };
                        setBusinessHours(newHours);
                      }}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] text-slate-400 mb-0.5">Cierre</label>
                    <input
                      type="time"
                      value={businessHours[dayKey]?.closeTime || '22:00'}
                      onChange={(e) => {
                        const newHours = { ...businessHours };
                        newHours[dayKey] = { ...newHours[dayKey], closeTime: e.target.value };
                        setBusinessHours(newHours);
                      }}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="px-4 py-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={handleSaveHours}
            disabled={saving}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              saving
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-slate-800 hover:bg-slate-900 text-white'
            }`}
          >
            {saving ? <><FaSyncAlt className="animate-spin text-[10px]" /> Guardando...</> : <><FaSave className="text-[10px]" /> Guardar Horarios</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BusinessHoursSettings;
