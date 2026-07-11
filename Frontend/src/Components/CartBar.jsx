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

  // Pedido mínimo
  const minOrder = Number(businessConfig?.minOrderAmount) || 0;
  const belowMin = minOrder > 0 && totalAmount < minOrder;
  const shortfall = Math.max(minOrder - totalAmount, 0);
  const blocked = isSuspended || belowMin;

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
        {/* Aviso de pedido mínimo */}
        <AnimatePresence>
          {belowMin && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mb-2 mx-1 flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 bg-slate-900 text-white shadow-lg"
            >
              <svg className="w-4 h-4 text-amber-400 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/></svg>
              <span className="text-[13px] font-semibold">
                Pedido mínimo {formatCurrency(minOrder, businessConfig?.currency)} · te faltan{' '}
                <span className="text-amber-300 font-bold">{formatCurrency(shortfall, businessConfig?.currency)}</span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          onClick={() => { if (!blocked) onShowCart(); }}
          disabled={blocked}
          whileHover={!blocked ? { scale: 1.02, y: -2 } : {}}
          whileTap={!blocked ? { scale: 0.97 } : {}}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className={`w-full flex items-center justify-between px-5 py-3.5 rounded-full ${
            blocked ? 'opacity-60 cursor-not-allowed' : ''
          }`}
          style={{
            backgroundColor: isSuspended ? '#1e293b' : belowMin ? '#475569' : buttonColor,
            color: buttonTextColor,
            boxShadow: blocked ? undefined : `0 8px 30px ${buttonColor}50, 0 0 0 1px rgba(255,255,255,0.1) inset`
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
              {belowMin ? 'Agrega más para pedir' : 'Ver carrito'}
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