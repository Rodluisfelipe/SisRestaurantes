import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { FaShoppingBag, FaArrowRight } from 'react-icons/fa';

const CartBar = ({ 
  cart, 
  totalItems, 
  totalAmount, 
  onShowCart, 
  businessConfig, 
  isSelectingToppings, 
  showCartSummary,
  subscriptionStatus
}) => {
  const buttonColor = businessConfig?.theme?.buttonColor || '#f97316';
  const buttonTextColor = businessConfig?.theme?.buttonTextColor || '#ffffff';
  const isSuspended = subscriptionStatus === 'suspended';

  // ── First-item entrance detection ──
  const [isFirstEntrance, setIsFirstEntrance] = useState(false);
  const prevCartLenRef = useRef(cart.length);

  useEffect(() => {
    // Went from 0 → 1+ items
    if (prevCartLenRef.current === 0 && cart.length > 0) {
      setIsFirstEntrance(true);
      // Reset after animation completes
      const t = setTimeout(() => setIsFirstEntrance(false), 900);
      return () => clearTimeout(t);
    }
    prevCartLenRef.current = cart.length;
  }, [cart.length]);

  // Enhanced bounce for count badge
  const countControls = useAnimation();
  const prevItemsRef = useRef(totalItems);
  useEffect(() => {
    if (totalItems !== prevItemsRef.current) {
      prevItemsRef.current = totalItems;
      countControls.start({
        scale: [1, 1.5, 0.85, 1.15, 1],
        transition: { duration: 0.5, times: [0, 0.2, 0.4, 0.7, 1] }
      });
    }
  }, [totalItems, countControls]);

  // Enhanced pulse for price
  const priceControls = useAnimation();
  const prevAmountRef = useRef(totalAmount);
  useEffect(() => {
    if (totalAmount !== prevAmountRef.current) {
      const grew = totalAmount > prevAmountRef.current;
      prevAmountRef.current = totalAmount;
      priceControls.start({
        scale: [1, grew ? 1.25 : 0.85, 1],
        y: [0, grew ? -6 : 4, 0],
        color: grew ? ['#ffffff', '#4ade80', '#ffffff'] : undefined,
        transition: { duration: 0.45, ease: 'easeOut' }
      });
    }
  }, [totalAmount, priceControls]);

  const shouldShow = cart.length > 0 && !isSelectingToppings && !showCartSummary;

  return (
    <AnimatePresence>
      {shouldShow && (
      <motion.div
        key="cartbar"
        initial={{ y: 120, opacity: 0, scale: 0.92 }}
        animate={
          isFirstEntrance
            ? { y: [120, -14, 5, 0], opacity: 1, scale: [0.92, 1.05, 0.97, 1] }
            : { y: 0, opacity: 1, scale: 1 }
        }
        exit={{ y: 80, opacity: 0, scale: 0.95 }}
        transition={
          isFirstEntrance
            ? { duration: 0.75, ease: [0.22, 1, 0.36, 1], times: [0, 0.45, 0.7, 1] }
            : { type: "spring", stiffness: 300, damping: 25 }
        }
        className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-3 sm:px-4 sm:pb-4"
      >
        <motion.button
          onClick={onShowCart}
          disabled={isSuspended}
          whileHover={!isSuspended ? { scale: 1.02, y: -2 } : {}}
          whileTap={!isSuspended ? { scale: 0.98 } : {}}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className={`w-full flex items-center justify-between px-5 py-3.5 sm:py-4 rounded-2xl shadow-2xl backdrop-blur-md transition-all duration-200 ${
            isSuspended ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          style={{
            backgroundColor: isSuspended ? '#6b7280' : buttonColor,
            color: buttonTextColor,
            boxShadow: isSuspended ? undefined : `0 8px 32px ${buttonColor}50`
          }}
        >
          {/* Left: bag icon + item count */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <FaShoppingBag className="text-lg sm:text-xl" style={{ color: buttonTextColor }} />
              <motion.span
                key={totalItems}
                animate={countControls}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shadow-sm"
                style={{ 
                  backgroundColor: buttonTextColor, 
                  color: buttonColor 
                }}
              >
                {totalItems}
              </motion.span>
            </div>
            <span className="text-sm font-medium opacity-90">
              {totalItems === 1 ? '1 producto' : `${totalItems} productos`}
            </span>
          </div>

          {/* Center: label */}
          <span className="font-bold text-base sm:text-lg tracking-wide">
            Ver Carrito
          </span>

          {/* Right: total + arrow */}
          <div className="flex items-center gap-2">
            <motion.span
              key={totalAmount}
              animate={priceControls}
              className="font-extrabold text-base sm:text-lg"
            >
              ${totalAmount.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </motion.span>
            <FaArrowRight className="text-sm opacity-70" />
          </div>
        </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CartBar;