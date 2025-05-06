// Calculación del precio de un item incluyendo toppings
export const calculateItemPrice = (item) => {
  // Precio base del producto
  let totalPrice = parseFloat(item.finalPrice || item.price || 0);
  
  // Sumar precio de toppings si existen
  if (item.selectedToppings && item.selectedToppings.length > 0) {
    item.selectedToppings.forEach(topping => {
      // Añadir precio base del grupo si existe
      if (topping.basePrice) {
        totalPrice += parseFloat(topping.basePrice);
      }
      
      // Añadir precio de la opción seleccionada
      if (topping.price) {
        totalPrice += parseFloat(topping.price);
      }
      
      // Añadir precios de subgrupos si existen
      if (topping.subGroups && topping.subGroups.length > 0) {
        topping.subGroups.forEach(subItem => {
          if (subItem.price) {
            totalPrice += parseFloat(subItem.price);
          }
        });
      }
    });
  }
  
  return totalPrice * (item.quantity || 1);
};

// Calcular total del carrito
export const calculateTotalAmount = (cart) => {
  return cart.reduce((sum, item) => sum + calculateItemPrice(item), 0);
};

// Calcular total de items
export const calculateTotalItems = (cart) => {
  return cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
};

// Crear mensaje de WhatsApp
export const createWhatsAppMessage = (orderInfo, cart, totalAmount, totalItems, businessConfig) => {
  const businessName = businessConfig?.businessName || 'Nuestro Negocio';
  let message = "";
  
  // Información del cliente
  message += `*** DATOS DEL CLIENTE ***\n`;
  message += `*Nombre:* ${orderInfo.customerName || 'Cliente'}\n`;
  
  // Información del pedido según tipo
  if (orderInfo.orderType === 'delivery') {
    message += `*Tipo de pedido:* A Domicilio\n`;
    message += `*Teléfono:* ${orderInfo.phone || 'No proporcionado'}\n`;
    message += `*Dirección:* ${orderInfo.address || 'No proporcionada'}\n`;
  } else if (orderInfo.orderType === 'inSite') {
    message += `*Tipo de pedido:* En Sitio\n`;
    message += `*Mesa #:* ${orderInfo.tableNumber || 'No especificada'}\n`;
  }
  message += `------------------------\n\n`;

  // Agregar detalle de productos
  message += `*** DETALLE DEL PEDIDO ***\n`;
  
  cart.forEach((item, index) => {
    message += `\n${index + 1}. ${item.quantity}x ${item.name}\n`;
    message += `   Precio unitario: $${(item.finalPrice || item.price).toFixed(2)}\n`;
    
    // Verificar si hay toppings seleccionados y es un array
    if (item.selectedToppings && Array.isArray(item.selectedToppings) && item.selectedToppings.length > 0) {
      message += `   *Adicionales:*\n`;
      
      // Iterar sobre cada grupo de toppings seleccionado
      item.selectedToppings.forEach(topping => {
        const basePrice = Number(topping.basePrice || 0);
        
        // Mostrar el grupo y su precio base si existe
        message += `   • ${topping.groupName}`;
        if (basePrice > 0) {
          message += ` (Base: $${basePrice.toFixed(2)})`;
        }
        message += `:\n`;
        
        // Mostrar la opción principal si existe
        if (topping.optionName) {
          message += `     - ${topping.optionName}`;
          if (topping.price > 0) {
            message += ` (+$${topping.price.toFixed(2)})`;
          }
          message += `\n`;
        }
        
        // Mostrar opciones de subgrupos si existen
        if (topping.subGroups && Array.isArray(topping.subGroups) && topping.subGroups.length > 0) {
          topping.subGroups.forEach(subItem => {
            message += `     - ${subItem.subGroupTitle}: ${subItem.optionName}`;
            if (subItem.price > 0) {
              message += ` (+$${subItem.price.toFixed(2)})`;
            }
            message += `\n`;
          });
        }
      });
    }
    
    message += `   *Subtotal:* $${calculateItemPrice(item).toFixed(2)}\n`;
    message += `   ------------------------\n`;
  });

  // Agregar totales
  message += `\n*** RESUMEN ***\n`;
  message += `*Productos:* ${cart.length}\n`;
  message += `*Cantidad total:* ${totalItems} items\n`;
  message += `*TOTAL A PAGAR:* $${totalAmount.toFixed(2)}\n`;
  message += `------------------------\n`;
  
  // Agregar un mensaje de agradecimiento y datos del negocio
  message += `\n¡Gracias por tu pedido en ${businessName}!\n`;
  message += `Tu orden será procesada inmediatamente.`;
  
  return encodeURIComponent(message);
}; 