// Modificar la función getCategoryOrder para usar sessionManager
const getCategoryOrder = () => {
  try {
    const savedOrder = SessionManager.getFromLocalStorage('categoryOrderSettings');
    return savedOrder ? savedOrder : {};
  } catch (error) {
    logger.error('Error al obtener orden de categorías:', error);
    return {};
  }
};

// Modificar la función isValidSession para usar sessionManager
const isValidSession = () => {
  const sessionStartTime = SessionManager.getFromLocalStorage('sessionStartTime');
  if (!sessionStartTime) return false;
  
  // Máximo tiempo de sesión: 3 horas (10800000 ms)
  const MAX_SESSION_TIME = 3 * 60 * 60 * 1000;
  const currentTime = Date.now();
  const sessionAge = currentTime - parseInt(sessionStartTime);
  
  return sessionAge < MAX_SESSION_TIME;
};

// Si la sesión expiró o no viene de QR, limpiar localStorage de QR
useEffect(() => {
  if (isQRMode && !tableFromUrl) {
    SessionManager.removeFromLocalStorage('tableQR_currentTable');
    SessionManager.removeFromLocalStorage('isTableQRSession');
    SessionManager.removeFromLocalStorage('tableQR_orderInfo');
  }
}, [isQRMode, tableFromUrl]);

const updateQuantity = (uniqueId, newQuantity) => {
  if (newQuantity <= 0) {
    removeFromCart(uniqueId);
    return;
  }
  
  setCart(prevCart =>
    prevCart.map(item =>
      item.uniqueId === uniqueId
        ? { ...item, quantity: newQuantity }
        : item
    )
  );
  
  // Cart se guardará automáticamente con el efecto useEffect
};

const removeFromCart = (uniqueId) => {
  const updatedCart = cart.filter(item => item.uniqueId !== uniqueId);
  setCart(updatedCart);
  
  if (updatedCart.length === 0) {
    setShowCartSummary(false);
  }
};

const getSortedCategories = (categories) => {
  const savedOrder = SessionManager.getFromLocalStorage('categoryOrder');
  logger.info("Menu: Retrieved category order from localStorage:", savedOrder);
  
  if (!savedOrder) {
    return [...categories].sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999));
  }
  
  try {
    const orderMap = savedOrder;
    logger.info("Menu: Parsed order map:", orderMap);
    
    return [...categories].sort((a, b) => {
      const orderA = orderMap[a._id] !== undefined ? orderMap[a._id] : 999;
      const orderB = orderMap[b._id] !== undefined ? orderMap[b._id] : 999;
      return orderA - orderB;
    });
  } catch (err) {
    logger.error("Menu: Error parsing category order:", err);
    return [...categories].sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999));
  }
};

// En la función executeOrderSubmission
const executeOrderSubmission = async (orderDetails, cartItems, totalAmount) => {
  // ... existing code ...
  
  try {
    // ... existing code ...
    
    // Limpiar el carrito después de enviar
    setCart([]);
    setShowCartSummary(false);
    
    // Limpiar localStorage y guardar tipo de pedido completado
    SessionManager.removeFromLocalStorage('cart');
    SessionManager.saveToLocalStorage('lastCompletedOrderType', orderDetails.orderType);
    
    // Notificar a otras pestañas que se completó un pedido
    SessionManager.saveToLocalStorage('orderCompleted', 'true');
    
    // Eliminar la notificación después de un segundo
    setTimeout(() => {
      SessionManager.removeFromLocalStorage('orderCompleted');
    }, 1000);
    
    return true; // Indicar éxito
  } catch (error) {
    // ... existing code ...
  }
}; 