import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CartBar = ({ 
  cart, 
  totalItems, 
  totalAmount, 
  onShowCart, 
  businessConfig, 
  isSelectingToppings, 
  showCartSummary 
}) => {
  if (cart.length === 0 || isSelectingToppings || showCartSummary) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t-2 border-orange-200 shadow-2xl z-50"
      >
        <div className="container mx-auto p-4">
          <motion.div 
            className="flex items-center justify-between"
            whileHover={{ scale: 1.02 }}
          >
            {/* Cart Info */}
            <div className="flex items-center space-x-4">
              <motion.div 
                className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
                style={{
                  backgroundColor: businessConfig?.theme?.buttonColor || '#f97316'
                }}
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.5 }}
              >
                <span className="text-xl text-white font-bold">🛒</span>
              </motion.div>
              
              <div>
                <motion.p 
                  className="text-sm font-semibold text-slate-600"
                  initial={{ x: -20 }}
                  animate={{ x: 0 }}
                >
                  {totalItems} {totalItems === 1 ? 'producto' : 'productos'}
                </motion.p>
                <motion.p 
                  className="text-2xl font-bold"
                  style={{
                    color: businessConfig?.theme?.buttonColor || '#f97316'
                  }}
                  initial={{ x: -20 }}
                  animate={{ x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  ${totalAmount.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </motion.p>
              </div>
            </div>
            
            {/* Cart Button */}
            <motion.button
              onClick={onShowCart}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 rounded-2xl font-bold shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center space-x-2"
              style={{
                backgroundColor: businessConfig?.theme?.buttonColor || '#f97316',
                color: businessConfig?.theme?.buttonTextColor || '#ffffff'
              }}
            >
              <span>Ver Carrito</span>
              <motion.div
                animate={{ x: [0, 5, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <span>➤</span>
              </motion.div>
            </motion.button>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CartBar; 