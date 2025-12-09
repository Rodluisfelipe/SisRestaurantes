import React from 'react';
import { motion } from 'framer-motion';

/**
 * Componente de Loading Spinner moderno y hermoso
 * @param {string} size - 'sm', 'md', 'lg', 'xl' (default: 'md')
 * @param {string} text - Texto a mostrar debajo del spinner
 * @param {string} variant - 'primary', 'white', 'gradient' (default: 'primary')
 */
const LoadingSpinner = ({ 
  size = 'md', 
  text = 'Cargando...', 
  variant = 'primary',
  fullScreen = false 
}) => {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg'
  };

  const variants = {
    primary: {
      gradient: 'from-blue-500 via-purple-500 to-pink-500',
      text: 'text-slate-700',
      glow: 'shadow-blue-500/50'
    },
    white: {
      gradient: 'from-white via-gray-100 to-white',
      text: 'text-white',
      glow: 'shadow-white/50'
    },
    gradient: {
      gradient: 'from-green-400 via-blue-500 to-purple-600',
      text: 'text-slate-700',
      glow: 'shadow-purple-500/50'
    }
  };

  const selectedVariant = variants[variant];
  const selectedSize = sizes[size];
  const selectedTextSize = textSizes[size];

  const containerClass = fullScreen
    ? 'fixed inset-0 bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center z-50'
    : 'flex flex-col items-center justify-center p-8';

  return (
    <div className={containerClass}>
      {/* Spinner animado con gradiente */}
      <motion.div
        className="relative"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Círculo exterior con gradiente giratorio */}
        <motion.div
          className={`${selectedSize} rounded-full bg-gradient-to-r ${selectedVariant.gradient} p-1`}
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "linear"
          }}
        >
          <div className="w-full h-full rounded-full bg-slate-50" />
        </motion.div>

        {/* Puntos decorativos que orbitan */}
        {[0, 120, 240].map((rotation, index) => (
          <motion.div
            key={index}
            className="absolute top-1/2 left-1/2 w-2 h-2 -ml-1 -mt-1"
            style={{
              transformOrigin: size === 'sm' ? '0 20px' : size === 'lg' ? '0 40px' : size === 'xl' ? '0 60px' : '0 30px'
            }}
            animate={{ rotate: [rotation, rotation + 360] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear",
              delay: index * 0.2
            }}
          >
            <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${selectedVariant.gradient} ${selectedVariant.glow} shadow-lg`} />
          </motion.div>
        ))}
      </motion.div>

      {/* Texto con animación */}
      {text && (
        <motion.p
          className={`mt-4 ${selectedTextSize} font-semibold ${selectedVariant.text}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {text}
        </motion.p>
      )}

      {/* Puntos animados */}
      <motion.div className="flex space-x-1 mt-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${selectedVariant.gradient}`}
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2
            }}
          />
        ))}
      </motion.div>
    </div>
  );
};

export default LoadingSpinner;
