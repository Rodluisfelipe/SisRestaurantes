import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBusinessConfig } from '../Context/BusinessContext';
import { useBusinessStatus } from '../hooks/useBusinessStatus';

const BusinessClosedModal = ({ isOpen, onClose, businessStatus }) => {
  const { businessConfig } = useBusinessConfig();

  if (!isOpen) return null;

  const getStatusInfo = () => {
    if (!businessStatus) {
      return {
        title: 'Negocio Cerrado',
        message: 'El negocio no está disponible en este momento.',
        icon: '🔴',
        color: 'red'
      };
    }

    if (!businessStatus.isMenuActive) {
      return {
        title: 'Menú Pausado',
        message: 'El menú está temporalmente pausado. No se pueden realizar pedidos.',
        icon: '⏸️',
        color: 'orange'
      };
    }

    if (!businessStatus.isOpenByHours) {
      const nextOpen = businessStatus.nextOpenTime;
      if (nextOpen) {
        const dayNames = {
          'monday': 'Lunes', 'tuesday': 'Martes', 'wednesday': 'Miércoles',
          'thursday': 'Jueves', 'friday': 'Viernes', 'saturday': 'Sábado', 'sunday': 'Domingo'
        };
        return {
          title: 'Cerrado por Horario',
          message: `El negocio abre el ${dayNames[nextOpen.day]} a las ${nextOpen.time}`,
          icon: '🕐',
          color: 'blue'
        };
      }
      return {
        title: 'Cerrado por Horario',
        message: 'El negocio está cerrado según los horarios establecidos.',
        icon: '🕐',
        color: 'blue'
      };
    }

    return {
      title: 'Negocio Cerrado',
      message: 'El negocio no está disponible en este momento.',
      icon: '🔴',
      color: 'red'
    };
  };

  const statusInfo = getStatusInfo();

  const getColorClasses = (color) => {
    const buttonColor = businessConfig?.theme?.buttonColor || '#f97316';
    const buttonTextColor = businessConfig?.theme?.buttonTextColor || '#ffffff';
    
    switch (color) {
      case 'red':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          iconBg: 'bg-red-100',
          iconColor: 'text-red-600',
          buttonBg: buttonColor,
          buttonHover: 'hover:opacity-90',
          buttonText: buttonTextColor
        };
      case 'orange':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-200',
          iconBg: 'bg-orange-100',
          iconColor: 'text-orange-600',
          buttonBg: buttonColor,
          buttonHover: 'hover:opacity-90',
          buttonText: buttonTextColor
        };
      case 'blue':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          iconBg: 'bg-blue-100',
          iconColor: 'text-blue-600',
          buttonBg: buttonColor,
          buttonHover: 'hover:opacity-90',
          buttonText: buttonTextColor
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          iconBg: 'bg-gray-100',
          iconColor: 'text-gray-600',
          buttonBg: buttonColor,
          buttonHover: 'hover:opacity-90',
          buttonText: buttonTextColor
        };
    }
  };

  const colors = getColorClasses(statusInfo.color);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", duration: 0.5 }}
          className={`max-w-md w-full ${colors.bg} ${colors.border} border-2 rounded-2xl shadow-2xl overflow-hidden`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 text-center">
            <div className={`w-16 h-16 ${colors.iconBg} rounded-full flex items-center justify-center mx-auto mb-4`}>
              <span className={`text-2xl ${colors.iconColor}`}>{statusInfo.icon}</span>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {statusInfo.title}
            </h2>
            
            <p className="text-gray-600 mb-4">
              {statusInfo.message}
            </p>

            {/* Información adicional del negocio */}
            {businessConfig && (
              <div className="bg-white/50 rounded-lg p-3 mb-4">
                <p className="text-sm text-gray-700 font-medium">
                  {businessConfig.businessName}
                </p>
                {businessConfig.description && (
                  <p className="text-xs text-gray-600 mt-1">
                    {businessConfig.description}
                  </p>
                )}
              </div>
            )}

            {/* Botón de cerrar */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className={`w-full px-6 py-3 ${colors.buttonHover} font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl`}
              style={{
                backgroundColor: colors.buttonBg,
                color: colors.buttonText
              }}
            >
              Entendido
            </motion.button>
          </div>

          {/* Footer con información adicional */}
          <div className="px-6 pb-4">
            <div className="text-center">
              <p className="text-xs text-gray-500">
                Los horarios pueden cambiar. Consulta directamente con el negocio para más información.
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BusinessClosedModal;
