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
    const { BACKEND_URL } = await import('../config');
    const response = await fetch(`${BACKEND_URL}/api/whatsapp-templates?businessId=${businessId}`);
    if (response.ok) {
      const data = await response.json();
      return data.messageTemplate;
    }
  } catch (error) {
    console.warn('Could not load custom WhatsApp template, using default');
  }
  return null;
};

// Crear mensaje de WhatsApp estilo recibo compacto
export const createWhatsAppMessage = async (orderInfo, cart, totalAmount, totalItems, businessConfig, appliedCoupon) => {
  const businessName = businessConfig?.businessName || 'Nuestro Negocio';

  // Tipo de pedido
  let tipoPedido = '🛒 Para llevar';
  let datosExtra = '';
  if (orderInfo.orderType === 'delivery') {
    tipoPedido = '🏍️ Domicilio';
    datosExtra = `📍 ${orderInfo.address || 'Sin dirección'}`;
    if (orderInfo.deliveryZoneName) datosExtra += ` (${orderInfo.deliveryZoneName})`;
    if (orderInfo.phone) datosExtra += `\n📞 ${orderInfo.phone}`;
  } else if (orderInfo.orderType === 'inSite') {
    tipoPedido = `🍽️ Mesa ${orderInfo.tableNumber || '—'}`;
  }

  // Productos
  let items = '';
  cart.forEach(item => {
    const subtotal = calculateItemPrice(item);
    items += `${item.quantity}x *${item.name}* · $${subtotal.toLocaleString()}\n`;
    // Toppings detallados debajo
    if (item.selectedToppings?.length > 0) {
      item.selectedToppings.forEach(t => {
        if (t.optionName) {
          items += `   ﹥ ${t.groupName}: ${t.optionName}`;
          if (t.price > 0) items += ` +$${t.price.toLocaleString()}`;
          items += `\n`;
        }
        if (t.subGroups?.length > 0) {
          t.subGroups.forEach(s => {
            items += `   ﹥ ${s.subGroupTitle}: ${s.optionName}`;
            if (s.price > 0) items += ` +$${s.price.toLocaleString()}`;
            items += `\n`;
          });
        }
      });
    }
  });

  // Totales
  const deliveryFee = orderInfo.deliveryFee || 0;
  const totalFinal = totalAmount + deliveryFee - (appliedCoupon?.discountAmount || 0);
  
  let totales = '';
  if (appliedCoupon || deliveryFee > 0) {
    totales += `Subtotal: $${totalAmount.toLocaleString()}\n`;
    if (deliveryFee > 0) {
      totales += `Envío: $${deliveryFee.toLocaleString()}\n`;
    } else if (orderInfo.orderType === 'delivery') {
      totales += `Envío: Por confirmar\n`;
    }
    if (appliedCoupon) {
      totales += `🏷️ ${appliedCoupon.coupon.code}: -$${appliedCoupon.discountAmount.toLocaleString()}\n`;
    }
  } else if (orderInfo.orderType === 'delivery') {
    totales += `Envío: Por confirmar\n`;
  }
  totales += `*Total: $${totalFinal.toLocaleString()}*`;

  // Método de pago
  const PAYMENT_LABELS = { efectivo: '💵 Efectivo', nequi: '📱 Nequi', daviplata: '📲 Daviplata', transferencia: '🏦 Transferencia' };
  const pagoLine = orderInfo.paymentMethod ? PAYMENT_LABELS[orderInfo.paymentMethod] || orderInfo.paymentMethod : null;

  // Armar mensaje compacto
  let msg = `🧾 *${businessName}*\n`;
  msg += `${tipoPedido}\n`;
  msg += `👤 ${orderInfo.customerName || 'Cliente'}\n`;
  if (datosExtra) msg += `${datosExtra}\n`;
  if (pagoLine) msg += `💳 ${pagoLine}\n`;
  msg += `\n${items}\n${totales}`;

  return encodeURIComponent(msg).replace(/'/g, "%27");
}; 