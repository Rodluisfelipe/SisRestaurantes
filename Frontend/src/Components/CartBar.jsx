import React from 'react';

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
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
      <div className="container mx-auto flex items-center justify-between">
        <div>
          <span className="text-gray-600">{totalItems} productos</span>
          <p className="font-bold text-lg">${totalAmount.toFixed(2)}</p>
        </div>
        <button
          onClick={onShowCart}
          style={{ 
            backgroundColor: businessConfig.theme.buttonColor, 
            color: businessConfig.theme.buttonTextColor 
          }}
          className="px-6 py-2 rounded-lg transition-colors duration-300"
        >
          Ver Carrito
        </button>
      </div>
    </div>
  );
};

export default CartBar; 