import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ProductToppingsSelector from './ProductToppingsSelector';
import ErrorBoundary from './ErrorBoundary';
import { useBusinessConfig } from "../Context/BusinessContext";
import { useBusinessStatus } from '../hooks/useBusinessStatus';
import BusinessClosedModal from './BusinessClosedModal';
import { useFlyToCart } from './FlyToCart';
import ProductPeekWrapper from './ProductPeekWrapper';

/* ── SVG icons (stroke-based) ── */
const PCI = {
  plus: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  check: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>,
  sliders: (cls = 'w-3 h-3') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>,
  flame: (cls = 'w-3 h-3') => <svg className={cls} viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 23c-3.6 0-7-2.4-7-7 0-3.2 2.1-5.8 3.8-7.8L12 4l3.2 4.2C16.9 10.2 19 12.8 19 16c0 4.6-3.4 7-7 7zm0-15.5L9.8 10.4C8.4 12.1 7 14.1 7 16c0 3.3 2.2 5 5 5s5-1.7 5-5c0-1.9-1.4-3.9-2.8-5.6L12 7.5z"/></svg>,
  image: (cls = 'w-8 h-8') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>,
};

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
        whileHover={!isDisabled ? { y: -3 } : {}}
        whileTap={!isDisabled ? { scale: 0.98 } : {}}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className={`group relative bg-white rounded-2xl shadow-sm hover:shadow-lg border border-slate-100 overflow-hidden transition-shadow duration-300 ${
          isDisabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        {/* Product Image — aspect ratio based */}
        <div className="relative aspect-square overflow-hidden bg-slate-50">
          {product.image ? (
            <motion.img 
              src={product.image} 
              alt={product.name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div 
              className="w-full h-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${buttonColor}08, ${buttonColor}03)`
              }}
            >
              <span className="text-slate-200">{PCI.image('w-10 h-10 sm:w-12 sm:h-12')}</span>
            </div>
          )}

          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

          {/* "Personalizable" badge for products with toppings */}
          {hasToppings && (
            <div className="absolute top-2 left-2">
              <span 
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-semibold backdrop-blur-md shadow-sm bg-white/90 border border-white/50"
                style={{ color: buttonColor }}
              >
                {PCI.sliders('w-2.5 h-2.5 sm:w-3 sm:h-3')}
                <span className="hidden sm:inline">Personalizable</span>
              </span>
            </div>
          )}

          {/* "Favorito" badge */}
          {isFavorite && (
            <div className="absolute top-2 right-2">
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm backdrop-blur-md">
                {PCI.flame('w-2.5 h-2.5')}
                <span className="hidden sm:inline ml-0.5">Favorito</span>
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
                  className="w-12 h-12 rounded-full flex items-center justify-center shadow-xl"
                  style={{ backgroundColor: buttonColor, color: buttonTextColor }}
                >
                  {PCI.check('w-5 h-5')}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Product Info */}
        <div className="p-3 sm:p-3.5">
          <h3 className="text-[13px] sm:text-sm font-bold text-slate-800 leading-tight mb-0.5 line-clamp-2 group-hover:text-slate-900 transition-colors">
            {product.name}
          </h3>
          {product.description && (
            <p className="text-[10px] sm:text-[11px] text-slate-400 line-clamp-2 mb-2 leading-relaxed">
              {product.description}
            </p>
          )}
          
          <div className="flex items-end justify-between mt-auto">
            {/* Price */}
            <div>
              <span 
                className="text-base sm:text-lg font-extrabold tracking-tight"
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
              whileHover={!isDisabled ? { scale: 1.1 } : {}}
              whileTap={!isDisabled ? { scale: 0.88 } : {}}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shadow-sm transition-all duration-200 ${
                isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:shadow-md'
              }`}
              style={{
                backgroundColor: isDisabled ? '#e2e8f0' : buttonColor,
                color: buttonTextColor,
                boxShadow: isDisabled ? undefined : `0 2px 8px ${buttonColor}30`
              }}
              aria-label={isDisabled ? "No disponible" : "Agregar al carrito"}
              disabled={isDisabled}
            >
              {PCI.plus('w-3.5 h-3.5 sm:w-4 sm:h-4')}
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
  