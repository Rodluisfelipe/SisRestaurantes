import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const AnimatedNotification = ({ 
  isVisible, 
  message, 
  type = 'success', 
  duration = 3000,
  onClose 
}) => {
  const notificationVariants = {
    hidden: { 
      opacity: 0, 
      y: -100,
      scale: 0.8
    },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        damping: 20,
        stiffness: 300
      }
    },
    exit: { 
      opacity: 0, 
      y: -100,
      scale: 0.8,
      transition: {
        duration: 0.3
      }
    }
  };

  const iconVariants = {
    hidden: { 
      scale: 0,
      rotate: -180
    },
    visible: { 
      scale: 1,
      rotate: 0,
      transition: {
        type: "spring",
        damping: 15,
        stiffness: 400,
        delay: 0.1
      }
    }
  };

  const progressVariants = {
    hidden: { 
      scaleX: 0
    },
    visible: { 
      scaleX: 1,
      transition: {
        duration: duration / 1000,
        ease: "linear"
      }
    }
  };

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-500',
          text: 'text-green-800',
          icon: '✅',
          border: 'border-green-200'
        };
      case 'error':
        return {
          bg: 'bg-red-500',
          text: 'text-red-800',
          icon: '❌',
          border: 'border-red-200'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-500',
          text: 'text-yellow-800',
          icon: '⚠️',
          border: 'border-yellow-200'
        };
      case 'info':
        return {
          bg: 'bg-blue-500',
          text: 'text-blue-800',
          icon: 'ℹ️',
          border: 'border-blue-200'
        };
      default:
        return {
          bg: 'bg-gray-500',
          text: 'text-gray-800',
          icon: '📢',
          border: 'border-gray-200'
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed top-4 right-4 z-50 max-w-sm w-full"
          variants={notificationVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <div className={`${styles.bg} rounded-xl shadow-2xl border ${styles.border} backdrop-blur-lg overflow-hidden`}>
            {/* Progress bar */}
            <motion.div
              className="h-1 bg-white/30 origin-left"
              variants={progressVariants}
              initial="hidden"
              animate="visible"
            />
            
            <div className="p-4 flex items-center space-x-3">
              {/* Icon */}
              <motion.div
                className="text-2xl"
                variants={iconVariants}
                initial="hidden"
                animate="visible"
              >
                {styles.icon}
              </motion.div>
              
              {/* Message */}
              <div className="flex-1">
                <p className={`font-semibold ${styles.text}`}>
                  {message}
                </p>
              </div>
              
              {/* Close button */}
              <motion.button
                onClick={onClose}
                className={`${styles.text} hover:opacity-70 transition-opacity`}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AnimatedNotification;
