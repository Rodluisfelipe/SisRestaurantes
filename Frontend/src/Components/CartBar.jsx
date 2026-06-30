import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { FaShoppingBag, FaArrowRight } from 'react-icons/fa';
import { formatCurrency } from '../utils/currency';

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
        className="fixed bottom-4 left-4 right-4 z-50"
      >
        <motion.button
          onClick={onShowCart}
          disabled={isSuspended}
          whileHover={!isSuspended ? { scale: 1.02, y: -2 } : {}}
          whileTap={!isSuspended ? { scale: 0.97 } : {}}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className={`w-full flex items-center justify-between px-5 py-3.5 rounded-full ${
            isSuspended ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          style={{
            backgroundColor: isSuspended ? '#1e293b' : buttonColor,
            color: buttonTextColor,
            boxShadow: isSuspended ? undefined : `0 8px 30px ${buttonColor}50, 0 0 0 1px rgba(255,255,255,0.1) inset`
          }}
        >
          {/* Left: item count badge */}
          <div className="flex items-center gap-2.5">
            <motion.span
              key={totalItems}
              animate={countControls}
              className="w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center bg-white/20"
              style={{ 
                color: buttonTextColor 
              }}
            >
              {totalItems}
            </motion.span>
            <span className="text-sm font-semibold text-white/80">
              Ver carrito
            </span>
          </div>

          {/* Right: total price */}
          <div className="flex items-center gap-2">
            <motion.span
              key={totalAmount}
              animate={priceControls}
              className="font-extrabold text-base tabular-nums"
            >
              {formatCurrency(totalAmount, businessConfig?.currency)}
            </motion.span>
            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
              <FaArrowRight className="text-[10px] text-white/70" />
            </div>
          </div>
        </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CartBar;