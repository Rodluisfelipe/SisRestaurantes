import React, { useState } from 'react';
import ProductToppingsSelector from './ProductToppingsSelector';

function ProductCard({ product, addToCart, onToppingsOpen, onToppingsClose }) {
  const [showToppings, setShowToppings] = useState(false);

  const handleAddToCart = (productWithToppings) => {
    addToCart(productWithToppings);
    setShowToppings(false);
    onToppingsClose();
  };

  const handleShowToppings = () => {
    setShowToppings(true);
    onToppingsOpen();
  };

  const handleCloseToppings = () => {
    setShowToppings(false);
    onToppingsClose();
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100">
        {/* Imagen del producto */}
        <div className="w-full h-32 relative">
          {product.image ? (
            <img 
              src={product.image} 
              alt={product.name}
              className="w-full h-full object-cover rounded-t-lg"
            />
          ) : (
            <div className="w-full h-full bg-gray-200 rounded-t-lg flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* Información del producto y botón */}
        <div className="p-3 flex justify-between items-center">
          <div className="flex-1 min-w-0 mr-2">
            <h2 className="text-base font-semibold text-gray-800 truncate">
              {product.name}
            </h2>
            <span className="text-sm font-bold text-blue-600">
              ${product.price}
            </span>
          </div>

          <button
            onClick={() => {
              if (product.toppingGroups && product.toppingGroups.length > 0) {
                handleShowToppings();
              } else {
                handleAddToCart(product);
              }
            }}
            className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors duration-300"
            aria-label="Agregar al carrito"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {showToppings && (
        <ProductToppingsSelector
          product={product}
          onAddToCart={handleAddToCart}
          onClose={handleCloseToppings}
        />
      )}
    </>
  );
}

export default ProductCard;
  