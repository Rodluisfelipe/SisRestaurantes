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

// Función auxiliar para obtener el template personalizado
const getCustomTemplate = async (businessId) => {
  try {
    const response = await fetch(`${import.meta.env.PROD ? 'https://157-245-125-216.nip.io' : 'http://localhost:5000'}/api/whatsapp-templates?businessId=${businessId}`);
    if (response.ok) {
      const data = await response.json();
      return data.messageTemplate;
    }
  } catch (error) {
    console.warn('Could not load custom WhatsApp template, using default');
  }
  return null;
};

// Crear mensaje de WhatsApp con template personalizado
export const createWhatsAppMessage = async (orderInfo, cart, totalAmount, totalItems, businessConfig, appliedCoupon) => {
  const businessName = businessConfig?.businessName || 'Nuestro Negocio';
  const businessId = businessConfig?._id || businessConfig?.businessId;
  
  // Intentar obtener el template personalizado
  let template = await getCustomTemplate(businessId);
  
  // Si no hay template personalizado, usar el predeterminado
  if (!template) {
    template = `*** DATOS DEL CLIENTE ***
{{customerInfo}}
------------------------

*** DETALLE DEL PEDIDO ***
{{orderDetails}}

*** RESUMEN ***
{{orderSummary}}
------------------------

¡Gracias por tu pedido en {{businessName}}!
Tu orden será procesada inmediatamente.

{{timestamp}}`;
  }

  // Generar información del cliente
  let customerInfo = `*Nombre:* ${orderInfo.customerName || 'Cliente'}\n`;
  
  if (orderInfo.orderType === 'delivery') {
    customerInfo += `*Tipo de pedido:* A Domicilio\n`;
    customerInfo += `*Teléfono:* ${orderInfo.phone || 'No proporcionado'}\n`;
    customerInfo += `*Dirección:* ${orderInfo.address || 'No proporcionada'}\n`;
    
    // Agregar información de zona y costo de envío
    if (orderInfo.deliveryFee && orderInfo.deliveryFee > 0) {
      customerInfo += `*Zona:* ${orderInfo.deliveryZoneName || 'Automática'}\n`;
      customerInfo += `*Costo de envío:* $${orderInfo.deliveryFee.toLocaleString()}\n`;
    } else if (orderInfo.deliveryNeedsConfirmation) {
      customerInfo += `*⚠️ Costo de envío:* Por confirmar (fuera de zonas automáticas)\n`;
    } else {
      customerInfo += `*Costo de envío:* Por confirmar\n`;
    }
  } else if (orderInfo.orderType === 'inSite') {
    customerInfo += `*Tipo de pedido:* En Sitio\n`;
    customerInfo += `*Mesa #:* ${orderInfo.tableNumber || 'No especificada'}\n`;
  } else if (orderInfo.orderType === 'takeaway') {
    customerInfo += `*Tipo de pedido:* Para Llevar\n`;
  }

  // Generar detalle de productos
  let orderDetails = '';
  cart.forEach((item, index) => {
    orderDetails += `\n${index + 1}. ${item.quantity}x ${item.name}\n`;
    orderDetails += `   Precio unitario: $${(item.finalPrice || item.price).toLocaleString()}\n`;
    
    // Verificar si hay toppings seleccionados y es un array
    if (item.selectedToppings && Array.isArray(item.selectedToppings) && item.selectedToppings.length > 0) {
      orderDetails += `   *Adicionales:*\n`;
      
      // Iterar sobre cada grupo de toppings seleccionado
      item.selectedToppings.forEach(topping => {
        const basePrice = Number(topping.basePrice || 0);
        
        // Mostrar el grupo y su precio base si existe
        orderDetails += `   • ${topping.groupName}`;
        if (basePrice > 0) {
          orderDetails += ` (Base: $${basePrice.toLocaleString()})`;
        }
        orderDetails += `:\n`;
        
        // Mostrar la opción principal si existe
        if (topping.optionName) {
          orderDetails += `     - ${topping.optionName}`;
          if (topping.price > 0) {
            orderDetails += ` (+$${topping.price.toLocaleString()})`;
          }
          orderDetails += `\n`;
        }
        
        // Mostrar opciones de subgrupos si existen
        if (topping.subGroups && Array.isArray(topping.subGroups) && topping.subGroups.length > 0) {
          topping.subGroups.forEach(subItem => {
            orderDetails += `     - ${subItem.subGroupTitle}: ${subItem.optionName}`;
            if (subItem.price > 0) {
              orderDetails += ` (+$${subItem.price.toLocaleString()})`;
            }
            orderDetails += `\n`;
          });
        }
      });
    }
    
    orderDetails += `   *Subtotal:* $${calculateItemPrice(item).toLocaleString()}\n`;
    orderDetails += `   ------------------------\n`;
  });

  // Generar resumen del pedido
  let orderSummary = `*Productos:* ${cart.length}
*Cantidad total:* ${totalItems} items`;

  // Calcular total incluyendo costo de envío
  const deliveryFee = orderInfo.deliveryFee || 0;
  const totalWithDelivery = totalAmount + deliveryFee;

  // Agregar información del cupón si está aplicado
  if (appliedCoupon) {
    orderSummary += `
*Subtotal productos:* $${totalAmount.toLocaleString()}`;
    
    // Agregar costo de envío si existe
    if (deliveryFee > 0) {
      orderSummary += `
*Costo de envío:* $${deliveryFee.toLocaleString()}`;
    }
    
    orderSummary += `
*Cupón aplicado:* ${appliedCoupon.coupon.code} (${appliedCoupon.coupon.name})
*Descuento:* -$${appliedCoupon.discountAmount.toLocaleString()}
*TOTAL A PAGAR:* $${(totalWithDelivery - appliedCoupon.discountAmount).toLocaleString()}`;
  } else {
    // Sin cupón
    if (deliveryFee > 0) {
      orderSummary += `
*Subtotal productos:* $${totalAmount.toLocaleString()}
*Costo de envío:* $${deliveryFee.toLocaleString()}
*TOTAL A PAGAR:* $${totalWithDelivery.toLocaleString()}`;
    } else {
      orderSummary += `
*TOTAL A PAGAR:* $${totalAmount.toLocaleString()}`;
    }
  }

  // Generar timestamp
  const now = new Date();
  const timestamp = `Fecha: ${now.toLocaleDateString('es-CO')} - ${now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;

  // Reemplazar variables en el template
  let message = template
    .replace(/{{customerInfo}}/g, customerInfo.trim())
    .replace(/{{orderDetails}}/g, orderDetails.trim())
    .replace(/{{orderSummary}}/g, orderSummary)
    .replace(/{{businessName}}/g, businessName)
    .replace(/{{timestamp}}/g, timestamp);

  // Usar encodeURIComponent con soporte para emojis
  return encodeURIComponent(message).replace(/'/g, "%27");
}; 