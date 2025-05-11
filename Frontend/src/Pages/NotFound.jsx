import React from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

const NotFound = () => {
  const { businessId } = useParams();
  const location = useLocation();
  
  // Determinar si estamos en un contexto de negocio o en la landing
  const isBusinessContext = Boolean(businessId);
  const path = location.pathname;
  
  return (
    <div className="min-h-screen bg-[#051C2C] flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full bg-[#333F50]/80 border border-[#333F50] rounded-2xl shadow-xl overflow-hidden p-8 text-center"
      >
        <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-[#3A7AFF]/10 mb-6">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-12 w-12 text-[#3A7AFF]" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
            />
          </svg>
        </div>
        
        <h1 className="text-4xl font-extrabold text-white mb-2">404</h1>
        <h2 className="text-2xl font-bold text-white mb-4">Página no encontrada</h2>
        
        {isBusinessContext ? (
          <p className="text-[#D1D9FF] mb-6">
            Lo sentimos, el negocio <span className="font-semibold text-white">"{businessId}"</span> no existe o la página que estás buscando no está disponible.
          </p>
        ) : (
          <p className="text-[#D1D9FF] mb-6">
            Lo sentimos, la página <span className="font-semibold text-white">"{path}"</span> no existe o no está disponible.
          </p>
        )}
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link 
              to="/" 
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-lg shadow-sm font-medium text-white bg-[#3A7AFF] hover:bg-[#3A7AFF]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3A7AFF]/50 w-full"
            >
              Volver al inicio
            </Link>
          </motion.div>
          
          {isBusinessContext && (
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link 
                to="/contact" 
                className="inline-flex items-center justify-center px-6 py-3 border border-[#5FF9B4]/30 rounded-lg shadow-sm font-medium text-[#5FF9B4] hover:bg-[#5FF9B4]/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#5FF9B4]/50 w-full"
              >
                Contactar soporte
              </Link>
            </motion.div>
          )}
        </div>
      </motion.div>
      
      <p className="mt-8 text-[#A5B9FF] text-sm">
        ¿Buscas crear tu propio menú digital? {' '}
        <Link to="/register" className="text-[#5FF9B4] hover:underline">
          Regístrate gratis
        </Link>
      </p>
    </div>
  );
};

export default NotFound; 