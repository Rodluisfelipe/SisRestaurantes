import React, { useState } from 'react';
import { motion } from 'framer-motion';
import ProductToppingsSelector from './ProductToppingsSelector';
import ErrorBoundary from './ErrorBoundary';
import { useBusinessConfig } from "../Context/BusinessContext";
import { useBusinessStatus } from '../hooks/useBusinessStatus';
import BusinessClosedModal from './BusinessClosedModal';

function ProductCard({ product, addToCart, onToppingsOpen, onToppingsClose }) {
  const [showToppings, setShowToppings] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showClosedModal, setShowClosedModal] = useState(false);
  const { businessConfig, businessId } = useBusinessConfig();
  const { businessStatus, getStatusDisplay } = useBusinessStatus(businessId);

  const handleAddToCart = (productWithToppings) => {
    addToCart(productWithToppings);
    setShowToppings(false);
    onToppingsClose();
    document.body.classList.remove('modal-open'); // ✅ Restaurar scroll
  };

  const handleShowToppings = () => {
    // Verificar si el negocio está abierto
    if (!businessStatus?.isOpen) {
      setShowClosedModal(true);
      return;
    }
    
    setHasError(false); // Resetear error al abrir
    setShowToppings(true);
    onToppingsOpen();
    document.body.classList.add('modal-open');
  };

  const handleCloseToppings = () => {
    setShowToppings(false);
    onToppingsClose();
    document.body.classList.remove('modal-open');
  };

  const handleError = (error) => {
    console.error("Error en ProductCard:", error);
    setHasError(true);
    setShowToppings(false);
  };

  return (
    <>
      <motion.div 
        onClick={handleShowToppings}
        whileHover={{ y: -8, scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="group bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-500 border border-slate-200/50 overflow-hidden backdrop-blur-sm cursor-pointer"
      >
        {/* Premium Product Image */}
        <div className="relative w-full h-44 overflow-hidden bg-white">
          {product.image ? (
            <motion.img 
              src={product.image} 
              alt={product.name}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
              whileHover={{ scale: 1.1 }}
              onError={(e) => {
                // Si la imagen falla al cargar, ocultar y mostrar fallback
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <div 
              className="w-full h-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${businessConfig?.theme?.buttonColor || '#f97316'}20, ${businessConfig?.theme?.buttonColor || '#f97316'}10)`
              }}
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <span className="text-4xl opacity-60">🍽️</span>
              </motion.div>
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </div>

        {/* Premium Product Info */}
        <div className="p-3 sm:p-6">
          <div className="mb-3 sm:mb-4">
            <h3 
              className="text-sm sm:text-lg font-bold text-slate-800 mb-2 transition-colors duration-300 leading-tight"
              style={{
                '--hover-color': businessConfig?.theme?.buttonColor || '#f97316'
              }}
              onMouseEnter={(e) => {
                e.target.style.color = businessConfig?.theme?.buttonColor || '#f97316';
              }}
              onMouseLeave={(e) => {
                e.target.style.color = '#1e293b';
              }}
            >
              {product.name}
            </h3>
            {product.description && (
              <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 mb-2 sm:mb-3 leading-tight">
                {product.description}
              </p>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span 
                className="text-lg sm:text-2xl font-bold"
                style={{
                  color: businessConfig?.theme?.buttonColor || '#f97316'
                }}
              >
                ${(() => {
                  const price = Number(product.price);
                  const options = { minimumFractionDigits: 0, maximumFractionDigits: 0 };
                  return price.toLocaleString('es-CO', options);
                })()}
              </span>
            </div>
            
            <motion.button
              onClick={(e) => {
                e.stopPropagation(); // Evita que se propague al div padre
                handleShowToppings();
              }}
              whileHover={businessStatus?.isOpen ? { scale: 1.1 } : {}}
              whileTap={businessStatus?.isOpen ? { scale: 0.9 } : {}}
              className={`w-10 h-10 sm:w-12 sm:h-12 text-white rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300 relative z-10 ${
                businessStatus?.isOpen ? 'hover:shadow-xl cursor-pointer' : 'opacity-50 cursor-not-allowed'
              }`}
              style={{
                backgroundColor: businessStatus?.isOpen 
                  ? (businessConfig?.theme?.buttonColor || '#f97316')
                  : '#9ca3af',
                color: businessConfig?.theme?.buttonTextColor || '#ffffff',
                boxShadow: businessStatus?.isOpen 
                  ? `0 10px 25px ${businessConfig?.theme?.buttonColor || '#f97316'}25`
                  : '0 5px 15px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => {
                if (businessStatus?.isOpen) {
                  e.target.style.boxShadow = `0 15px 35px ${businessConfig?.theme?.buttonColor || '#f97316'}35`;
                }
              }}
              onMouseLeave={(e) => {
                if (businessStatus?.isOpen) {
                  e.target.style.boxShadow = `0 10px 25px ${businessConfig?.theme?.buttonColor || '#f97316'}25`;
                }
              }}
              aria-label={businessStatus?.isOpen ? "Agregar al carrito" : "Negocio cerrado"}
              disabled={!businessStatus?.isOpen}
            >
              <motion.span 
                className="text-lg sm:text-xl font-bold"
                whileHover={{ scale: 1.2 }}
                transition={{ duration: 0.3 }}
              >
                +
              </motion.span>
            </motion.button>
          </div>
        </div>
      </motion.div>

      {showToppings && (
        <div onClick={(e) => e.stopPropagation()} className="debugging-wrapper">
          <ProductToppingsSelector
            product={{
              ...product,
              toppingGroups: Array.isArray(product.toppingGroups) ? product.toppingGroups : []
            }}
            onAddToCart={(p) => {
              handleAddToCart(p);
            }}
            onClose={() => {
              handleCloseToppings();
            }}
          />
        </div>
      )}
      
      {hasError && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md mx-4">
            <h3 className="text-xl font-bold text-red-600 mb-4">Error</h3>
            <p className="mb-4">
              Ha ocurrido un problema al cargar las opciones del producto. Por favor, intenta de nuevo.
            </p>
            <div className="flex justify-end">
              <button
                onClick={handleCloseToppings}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de negocio cerrado */}
      <BusinessClosedModal
        isOpen={showClosedModal}
        onClose={() => setShowClosedModal(false)}
        businessStatus={businessStatus}
      />
    </>
  );
}


export default ProductCard;
  