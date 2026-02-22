import { useState, useEffect, useCallback } from 'react';
import * as SessionManager from '../utils/sessionManager';
import logger from '../utils/logger';

/**
 * Custom hook for cart state management.
 * Handles cart persistence, add/update/remove, and price calculations with toppings.
 *
 * @param {string|null} subscriptionStatus - Current subscription status; blocks addToCart if 'suspended'
 * @returns {object} Cart state and operations
 */
export default function useCart(subscriptionStatus) {
  const [cart, setCart] = useState(() => {
    return SessionManager.getFromSession('cart', []);
  });

  // Persist cart to sessionStorage
  useEffect(() => {
    SessionManager.saveToSession('cart', cart);
  }, [cart]);

  // Listen for cross-tab storage changes
  useEffect(() => {
    const handleStorageChange = (event) => {
      if (!event.storageArea || event.storageArea !== sessionStorage) return;
      const prefix = SessionManager.getPrefix();
      if (event.key && event.key.startsWith(prefix)) {
        const actualKey = event.key.replace(prefix, '');
        if (actualKey === 'cart') {
          try {
            const newCart = event.newValue ? JSON.parse(event.newValue) : [];
            setCart(newCart);
          } catch (error) {
            logger.error('Error parsing cart from sessionStorage:', error);
          }
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const addToCart = useCallback((product) => {
    if (subscriptionStatus === 'suspended') {
      logger.warn('addToCart blocked: subscription suspended');
      return;
    }

    setCart(prevCart => {
      const toppingsString = JSON.stringify(product.selectedToppings || {});
      const uniqueId = `${product._id}-${toppingsString.replace(/[{}",:]/g, '')}`;
      const existingItemIndex = prevCart.findIndex(item => item.uniqueId === uniqueId);

      if (existingItemIndex >= 0) {
        const newCart = [...prevCart];
        newCart[existingItemIndex] = {
          ...newCart[existingItemIndex],
          quantity: (newCart[existingItemIndex].quantity || 0) + (product.quantity || 1)
        };
        return newCart;
      }

      return [...prevCart, {
        ...product,
        uniqueId,
        quantity: product.quantity || 1
      }];
    });
  }, [subscriptionStatus]);

  const updateQuantity = useCallback((uniqueId, newQuantity) => {
    if (newQuantity <= 0) {
      setCart(prev => prev.filter(item => item.uniqueId !== uniqueId));
      return;
    }
    setCart(prevCart =>
      prevCart.map(item =>
        item.uniqueId === uniqueId ? { ...item, quantity: newQuantity } : item
      )
    );
  }, []);

  const removeFromCart = useCallback((uniqueId) => {
    setCart(prev => prev.filter(item => item.uniqueId !== uniqueId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    SessionManager.removeFromLocalStorage('cart');
    SessionManager.removeFromSessionStorage('cart');
  }, []);

  // Price calculation including toppings
  const calculateItemPrice = useCallback((item) => {
    let totalPrice = parseFloat(item.finalPrice || item.price || 0);

    if (item.selectedToppings && item.selectedToppings.length > 0) {
      item.selectedToppings.forEach(topping => {
        if (topping.basePrice) totalPrice += parseFloat(topping.basePrice);
        if (topping.price) totalPrice += parseFloat(topping.price);
        if (topping.subGroups && topping.subGroups.length > 0) {
          topping.subGroups.forEach(subItem => {
            if (subItem.price) totalPrice += parseFloat(subItem.price);
          });
        }
      });
    }

    return totalPrice * (item.quantity || 1);
  }, []);

  const calculateTotalAmount = useCallback(() => {
    return cart.reduce((sum, item) => sum + calculateItemPrice(item), 0);
  }, [cart, calculateItemPrice]);

  const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalAmount = cart.reduce((sum, item) => sum + calculateItemPrice(item), 0);

  return {
    cart,
    setCart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    calculateItemPrice,
    calculateTotalAmount,
    totalItems,
    totalAmount
  };
}
