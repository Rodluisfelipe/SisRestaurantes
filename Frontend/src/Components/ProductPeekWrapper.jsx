import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaSlidersH } from 'react-icons/fa';
import { UtensilsCrossed } from 'lucide-react';

/**
 * ProductPeek — iOS-style long-press "peek" overlay.
 * Wrap any product card; on long-press (400ms) shows a larger detail card.
 */

const LONG_PRESS_MS = 400;

const ProductPeekWrapper = ({ children, product, buttonColor, buttonTextColor }) => {
  const [peeking, setPeeking] = useState(false);
  const timerRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const didPeekRef = useRef(false);

  const startPress = useCallback((clientX, clientY) => {
    touchStartRef.current = { x: clientX, y: clientY };
    didPeekRef.current = false;
    timerRef.current = setTimeout(() => {
      didPeekRef.current = true;
      setPeeking(true);
      // Gentle haptic if available
      if (navigator.vibrate) navigator.vibrate(15);
    }, LONG_PRESS_MS);
  }, []);

  const cancelPress = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const endPress = useCallback(() => {
    cancelPress();
    // Don't close if peek is open — user will close with button/backdrop
  }, [cancelPress]);

  const handleTouchStart = useCallback((e) => {
    const t = e.touches[0];
    startPress(t.clientX, t.clientY);
  }, [startPress]);

  const handleTouchMove = useCallback((e) => {
    // Cancel if finger moves more than 10px
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - touchStartRef.current.x);
    const dy = Math.abs(t.clientY - touchStartRef.current.y);
    if (dx > 10 || dy > 10) cancelPress();
  }, [cancelPress]);

  const handleMouseDown = useCallback((e) => {
    startPress(e.clientX, e.clientY);
  }, [startPress]);

  const hasToppings = product.toppingGroups && product.toppingGroups.length > 0;
  const price = Number(product.price);
  const formatted = price.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={endPress}
        onTouchCancel={cancelPress}
        onMouseDown={handleMouseDown}
        onMouseUp={endPress}
        onMouseLeave={cancelPress}
        onContextMenu={(e) => {
          if (didPeekRef.current) e.preventDefault();
        }}
      >
        {children}
      </div>

      {/* Peek overlay */}
      <AnimatePresence>
        {peeking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9990] flex items-center justify-center p-5"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
            onClick={() => setPeeking(false)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-sm w-full max-h-[80vh] relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setPeeking(false)}
                aria-label="Cerrar vista previa"
                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/50 transition-colors"
              >
                <FaTimes className="text-sm" />
              </button>

              {/* Image */}
              <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${buttonColor}20, ${buttonColor}08)` }}
                  >
                    <UtensilsCrossed className="w-16 h-16 opacity-30" style={{ color: buttonColor }} />
                  </div>
                )}

                {hasToppings && (
                  <div className="absolute bottom-3 left-3">
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md shadow-sm"
                      style={{ backgroundColor: `${buttonColor}e6`, color: buttonTextColor }}
                    >
                      <FaSlidersH className="text-[10px]" />
                      Personalizable
                    </span>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="p-5 space-y-3">
                <h3 className="text-xl font-bold text-gray-900 leading-tight">
                  {product.name}
                </h3>

                {product.description && (
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {product.description}
                  </p>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span
                    className="text-2xl font-extrabold"
                    style={{ color: buttonColor }}
                  >
                    ${formatted}
                  </span>

                  {product.category && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                      {typeof product.categoryName === 'string' ? product.categoryName : ''}
                    </span>
                  )}
                </div>

                {hasToppings && product.toppingGroups && (
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-400 font-medium mb-1.5 uppercase tracking-wider">
                      Personalización
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {product.toppingGroups.slice(0, 4).map((group, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-100"
                        >
                          {group.name || group.groupName}
                        </span>
                      ))}
                      {product.toppingGroups.length > 4 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-400">
                          +{product.toppingGroups.length - 4} más
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom hint */}
              <div className="px-5 pb-4">
                <p className="text-center text-xs text-gray-400">
                  Toca fuera para cerrar · Toca el producto para agregar
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ProductPeekWrapper;
