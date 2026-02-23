import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaCheck, FaSlidersH } from 'react-icons/fa';
import ProductToppingsSelector from './ProductToppingsSelector';
import ErrorBoundary from './ErrorBoundary';
import { useBusinessConfig } from "../Context/BusinessContext";
import { useBusinessStatus } from '../hooks/useBusinessStatus';
import BusinessClosedModal from './BusinessClosedModal';
import { useFlyToCart } from './FlyToCart';
import ProductPeekWrapper from './ProductPeekWrapper';

function ProductCard({ product, addToCart, onToppingsOpen, onToppingsClose, subscriptionStatus }) {
  const [showToppings, setShowToppings] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showClosedModal, setShowClosedModal] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const { businessConfig, businessId } = useBusinessConfig();
  const { businessStatus, getStatusDisplay } = useBusinessStatus(businessId);
  const flyToCart = useFlyToCart();

  const buttonColor = businessConfig?.theme?.buttonColor || '#f97316';
  const buttonTextColor = businessConfig?.theme?.buttonTextColor || '#ffffff';
  const hasToppings = product.toppingGroups && product.toppingGroups.length > 0;
  const isDisabled = subscriptionStatus === 'suspended' || !businessStatus?.isOpen;
  const isFavorite = businessConfig?.reviewStats?.favoriteProductIds?.some(
    id => id === product._id || id?.toString() === product._id?.toString()
  );

  const flashAdded = useCallback(() => {
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  }, []);

  const handleAddToCart = (productWithToppings) => {
    addToCart(productWithToppings);
    setShowToppings(false);
    onToppingsClose();
    flashAdded();
    document.body.classList.remove('modal-open');
    // Fly animation for toppings products — launch from center of viewport
    if (flyToCart?.triggerFly) {
      flyToCart.triggerFly({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        image: productWithToppings.image,
        color: buttonColor
      });
    }
  };

  const handleShowToppings = () => {
    // Verificar si la suscripción está suspendida
    if (subscriptionStatus === 'suspended') {
      // Mensaje sutil - no mostrar alert, el botón ya está deshabilitado visualmente
      return;
    }
    
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
    <ProductPeekWrapper product={product} buttonColor={buttonColor} buttonTextColor={buttonTextColor}>
      <motion.div 
        onClick={() => {
          if (subscriptionStatus === 'suspended') return;
          handleShowToppings();
        }}
        whileHover={!isDisabled ? { y: -4, scale: 1.01 } : {}}
        whileTap={!isDisabled ? { scale: 0.97 } : {}}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className={`group relative bg-white rounded-2xl shadow-md hover:shadow-xl border border-gray-100 overflow-hidden ${
          isDisabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        {/* Product Image — aspect ratio based */}
        <div className="relative aspect-square overflow-hidden bg-gray-50">
          {product.image ? (
            <motion.img 
              src={product.image} 
              alt={product.name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div 
              className="w-full h-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${buttonColor}15, ${buttonColor}05)`
              }}
            >
              <span className="text-5xl opacity-40 group-hover:opacity-60 transition-opacity duration-300">🍽️</span>
            </div>
          )}

          {/* Hover gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

          {/* "Personalizable" badge for products with toppings */}
          {hasToppings && (
            <div className="absolute top-2 left-2">
              <span 
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold backdrop-blur-md shadow-sm"
                style={{ backgroundColor: `${buttonColor}e6`, color: buttonTextColor }}
              >
                <FaSlidersH className="text-[8px] sm:text-[10px]" />
                <span className="hidden sm:inline">Personalizable</span>
              </span>
            </div>
          )}

          {/* "Favorito 🔥" badge for popular products */}
          {isFavorite && (
            <div className="absolute top-2 right-2">
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm backdrop-blur-md">
                🔥
                <span className="hidden sm:inline">Favorito</span>
              </span>
            </div>
          )}

          {/* "Added" feedback overlay */}
          <AnimatePresence>
            {justAdded && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10 pointer-events-none"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.3, 1] }}
                  transition={{ duration: 0.5 }}
                  className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl"
                  style={{ backgroundColor: buttonColor }}
                >
                  <FaCheck className="text-xl" style={{ color: buttonTextColor }} />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Product Info */}
        <div className="p-3 sm:p-4">
          <h3 className="text-sm sm:text-base font-bold text-gray-800 leading-tight mb-1 line-clamp-2 group-hover:text-gray-900 transition-colors">
            {product.name}
          </h3>
          {product.description && (
            <p className="text-[11px] sm:text-xs text-gray-500 line-clamp-2 mb-2 leading-relaxed">
              {product.description}
            </p>
          )}
          
          <div className="flex items-end justify-between mt-auto">
            {/* Price */}
            <div>
              <span 
                className="text-lg sm:text-xl font-extrabold tracking-tight"
                style={{ color: buttonColor }}
              >
                ${(() => {
                  const price = Number(product.price);
                  return price.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                })()}
              </span>
            </div>
            
            {/* Add button */}
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                // Trigger fly-to-cart from the button position
                if (flyToCart?.triggerFly && !hasToppings) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  flyToCart.triggerFly({
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                    image: product.image,
                    color: buttonColor
                  });
                }
                handleShowToppings();
              }}
              whileHover={!isDisabled ? { scale: 1.15 } : {}}
              whileTap={!isDisabled ? { scale: 0.85 } : {}}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shadow-md transition-transform duration-200 ${
                isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:shadow-lg active:shadow-sm'
              }`}
              style={{
                backgroundColor: isDisabled ? '#d1d5db' : buttonColor,
                color: buttonTextColor,
                boxShadow: isDisabled ? undefined : `0 4px 14px ${buttonColor}40`
              }}
              aria-label={isDisabled ? "No disponible" : "Agregar al carrito"}
              disabled={isDisabled}
            >
              <FaPlus className="text-sm sm:text-base" />
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
    </ProductPeekWrapper>
  );
}


export default ProductCard;
  