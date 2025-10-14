import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../Context/AuthContext';

/**
 * Componente que detecta múltiples sesiones de administración activas
 * y muestra una advertencia al usuario
 */
export default function MultiSessionWarning() {
  const { showMultiSessionWarning, cleanupOldSessions, checkMultipleSessions } = useAuth();

  const handleDismiss = () => {
    // No hacer nada, solo ocultar la advertencia temporalmente
  };

  const handleCleanup = () => {
    cleanupOldSessions();
  };

  return (
    <AnimatePresence>
      {showMultiSessionWarning && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4"
        >
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 shadow-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-yellow-800">
                  Múltiples sesiones detectadas
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    Se detectaron múltiples sesiones de administración activas. 
                    Esto puede causar conflictos y pantallas en blanco.
                  </p>
                </div>
                <div className="mt-3 flex space-x-3">
                  <button
                    onClick={handleCleanup}
                    className="text-sm bg-yellow-100 text-yellow-800 px-3 py-1 rounded hover:bg-yellow-200 transition-colors"
                  >
                    Limpiar sesiones antiguas
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="text-sm text-yellow-600 hover:text-yellow-800 transition-colors"
                  >
                    Ignorar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
