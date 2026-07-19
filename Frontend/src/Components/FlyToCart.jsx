import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UtensilsCrossed } from 'lucide-react';

/**
 * FlyToCart — renders a small thumbnail that "flies" from a product card
 * to the CartBar whenever the user adds an item to the cart.
 *
 * Usage: Wrap your menu tree with <FlyToCartProvider>, then call
 * triggerFly({ x, y, image, color }) from any child component.
 */
const FlyToCartContext = React.createContext(null);

export const useFlyToCart = () => React.useContext(FlyToCartContext);

let flyId = 0;

export const FlyToCartProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  const cartBarRef = useRef(null);

  // Called by ProductCard when an item is added
  const triggerFly = useCallback(({ x, y, image, color }) => {
    const id = ++flyId;

    // Target = center-bottom of viewport (CartBar lives at bottom)
    const targetX = window.innerWidth / 2;
    const targetY = window.innerHeight - 28; // middle of CartBar

    setItems(prev => [...prev, { id, startX: x, startY: y, targetX, targetY, image, color }]);

    // Auto-remove after animation
    setTimeout(() => {
      setItems(prev => prev.filter(i => i.id !== id));
    }, 750);
  }, []);

  return (
    <FlyToCartContext.Provider value={{ triggerFly, cartBarRef }}>
      {children}
      {/* Portal-like layer for flying items */}
      <AnimatePresence>
        {items.map(item => (
          <FlyingDot key={item.id} {...item} />
        ))}
      </AnimatePresence>
    </FlyToCartContext.Provider>
  );
};

/* ------------------------------------------------------------------ */
/*  FlyingDot — the actual animated element                            */
/* ------------------------------------------------------------------ */
const FlyingDot = ({ startX, startY, targetX, targetY, image, color }) => {
  // Mid-point with an arc (bezier-like feel via keyframes)
  const midX = (startX + targetX) / 2;
  const midY = Math.min(startY, targetY) - 80; // arc above

  return (
    <motion.div
      initial={{
        x: startX - 20,
        y: startY - 20,
        scale: 1,
        opacity: 1,
      }}
      animate={{
        x: [startX - 20, midX - 20, targetX - 20],
        y: [startY - 20, midY - 20, targetY - 20],
        scale: [1, 1.1, 0.4],
        opacity: [1, 1, 0.6],
      }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{
        duration: 0.6,
        ease: [0.45, 0, 0.15, 1], // custom cubic-bezier
        times: [0, 0.4, 1],
      }}
      className="fixed top-0 left-0 z-[9999] pointer-events-none"
    >
      <div
        className="w-10 h-10 rounded-full shadow-xl border-2 border-white overflow-hidden flex items-center justify-center"
        style={{
          backgroundColor: color || '#f97316',
        }}
      >
        {image ? (
          <img src={image} alt="" className="w-full h-full object-cover" loading="lazy" width="40" height="40" />
        ) : (
          <UtensilsCrossed className="w-4 h-4 text-white" />
        )}
      </div>
    </motion.div>
  );
};

export default FlyToCartProvider;
