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

// Obtener configuración de módulos del template
const getTemplateConfig = async (businessId) => {
  try {
    const { BACKEND_URL } = await import('../config');
    const response = await fetch(`${BACKEND_URL}/api/whatsapp-templates?businessId=${businessId}`);
    if (response.ok) return await response.json();
  } catch (error) {
    console.warn('Could not load WhatsApp template config, using defaults');
  }
  return null;
};

const DEFAULT_MODULES = [
  { id: 'header', enabled: true, order: 0 },
  { id: 'orderType', enabled: true, order: 1 },
  { id: 'customerName', enabled: true, order: 2 },
  { id: 'address', enabled: true, order: 3 },
  { id: 'phone', enabled: true, order: 4 },
  { id: 'paymentMethod', enabled: true, order: 5 },
  { id: 'products', enabled: true, order: 6 },
  { id: 'totals', enabled: true, order: 7 },
  { id: 'notes', enabled: true, order: 8 },
  { id: 'customMessage', enabled: false, order: 9 },
];

const SEPARATOR_BEFORE = new Set(['products', 'totals', 'notes', 'customMessage']);

// Crear mensaje de WhatsApp basado en módulos configurables
export const createWhatsAppMessage = async (orderInfo, cart, totalAmount, totalItems, businessConfig, appliedCoupon) => {
  const businessName = businessConfig?.businessName || 'Nuestro Negocio';
  const businessId = businessConfig?._id || businessConfig?.businessId;

  // Obtener configuración del template
  let config = null;
  if (businessId) config = await getTemplateConfig(businessId);

  const modules = config?.modules?.length > 0
    ? [...config.modules].sort((a, b) => a.order - b.order)
    : DEFAULT_MODULES;
  const customText = config?.customMessage || '';

  // Constructores de cada módulo
  const PAYMENT_LABELS = { efectivo: 'Efectivo', nequi: 'Nequi', daviplata: 'Daviplata', transferencia: 'Transferencia' };

  const builders = {
    header: () => `🧾 *${businessName}*`,

    orderType: () => {
      if (orderInfo.orderType === 'delivery') return '🏍️ Domicilio';
      if (orderInfo.orderType === 'inSite') return `🍽️ Mesa ${orderInfo.tableNumber || '—'}`;
      return '🛒 Para llevar';
    },

    customerName: () => `👤 ${orderInfo.customerName || 'Cliente'}`,

    address: () => {
      if (orderInfo.orderType !== 'delivery') return null;
      let line = `📍 ${orderInfo.address || 'Sin dirección'}`;
      if (orderInfo.deliveryZoneName) line += ` (${orderInfo.deliveryZoneName})`;
      return line;
    },

    phone: () => orderInfo.phone ? `📞 ${orderInfo.phone}` : null,

    paymentMethod: () => {
      if (!orderInfo.paymentMethod) return null;
      const pi = businessConfig?.paymentInfo;
      const method = orderInfo.paymentMethod;

      if (method === 'efectivo') {
        return '💵 Efectivo';
      }

      if (method === 'nequi') {
        let line = '📱 Nequi';
        if (pi?.nequi) line += `\nPaga al: *${pi.nequi}*`;
        if (pi?.instructions) line += `\n📝 ${pi.instructions}`;
        return line;
      }

      if (method === 'daviplata') {
        let line = '📲 Daviplata';
        if (pi?.daviplata) line += `\nPaga al: *${pi.daviplata}*`;
        if (pi?.instructions) line += `\n📝 ${pi.instructions}`;
        return line;
      }

      if (method === 'transferencia') {
        let line = '🏦 Transferencia';
        if (pi?.bankAccountNumber) {
          if (pi.bankName) line += `\nBanco: *${pi.bankName}*`;
          if (pi.bankAccountType) line += ` - ${pi.bankAccountType}`;
          line += `\nCuenta: *${pi.bankAccountNumber}*`;
          if (pi.accountHolder) line += `\nTitular: ${pi.accountHolder}`;
        }
        if (pi?.instructions) line += `\n📝 ${pi.instructions}`;
        return line;
      }

      return `💳 ${method}`;
    },

    products: () => {
      let items = '';
      cart.forEach(item => {
        const basePrice = parseFloat(item.finalPrice || item.price || 0) * (item.quantity || 1);
        items += `${item.quantity}x *${item.name}* · $${basePrice.toLocaleString()}\n`;
        if (item.selectedToppings?.length > 0) {
          item.selectedToppings.forEach(t => {
            if (t.optionName) {
              items += `   ﹥ ${t.groupName}: ${t.optionName}`;
              if (t.price > 0) items += ` +$${t.price.toLocaleString()}`;
              items += '\n';
            }
            if (t.subGroups?.length > 0) {
              t.subGroups.forEach(s => {
                items += `   ﹥ ${s.subGroupTitle}: ${s.optionName}`;
                if (s.price > 0) items += ` +$${s.price.toLocaleString()}`;
                items += '\n';
              });
            }
          });
        }
      });
      return items.trimEnd();
    },

    totals: () => {
      const deliveryFee = orderInfo.deliveryFee || 0;
      const totalFinal = totalAmount + deliveryFee - (appliedCoupon?.discountAmount || 0);
      let txt = '';
      if (appliedCoupon || deliveryFee > 0) {
        txt += `Subtotal: $${totalAmount.toLocaleString()}\n`;
        if (deliveryFee > 0) txt += `Envío: $${deliveryFee.toLocaleString()}\n`;
        else if (orderInfo.orderType === 'delivery') txt += 'Envío: Por confirmar\n';
        if (appliedCoupon) txt += `🏷️ ${appliedCoupon.coupon.code}: -$${appliedCoupon.discountAmount.toLocaleString()}\n`;
      } else if (orderInfo.orderType === 'delivery') {
        txt += 'Envío: Por confirmar\n';
      }
      txt += `*Total: $${totalFinal.toLocaleString()}*`;
      return txt;
    },

    customMessage: () => customText || null,

    notes: () => orderInfo.customerNotes?.trim() ? `📝 *Nota:* ${orderInfo.customerNotes.trim()}` : null,
  };

  // Construir mensaje según módulos habilitados y su orden
  const lines = [];
  for (const mod of modules) {
    if (!mod.enabled) continue;
    const build = builders[mod.id];
    if (!build) continue;
    const content = build();
    if (content === null) continue;
    if (SEPARATOR_BEFORE.has(mod.id) && lines.length > 0) lines.push('');
    lines.push(content);
  }

  let msg = lines.join('\n');

  // ── Gift order: append restaurant info + a copy-paste block to forward to the recipient ──
  if (orderInfo.isGift && orderInfo.gift) {
    const g = orderInfo.gift;
    const sep = '\n\n━━━━━━━━━━━━━━━\n';

    // Restaurant-facing block (knows it's a gift, who the recipient is, where to deliver)
    let giftInfo = `${sep}🎁 *PEDIDO DE REGALO*\n`;
    giftInfo += `Para: *${g.recipientName || '—'}*`;
    if (g.recipientPhone) giftInfo += `\n📞 Destinatario: ${g.recipientPhone}`;
    giftInfo += `\nDe parte de: ${orderInfo.customerName || 'Cliente'}`;
    if (g.hidePrices) giftInfo += `\n⚠️ No incluir factura ni precios en la entrega`;
    msg += giftInfo;

    // Block the restaurant copies and forwards to the recipient (NO prices)
    let forward = `${sep}📋 *COPIA Y ENVÍA ESTO AL DESTINATARIO:*\n`;
    forward += `\n¡Hola ${g.recipientName || ''}! 🎁 Tienes un regalo en camino de parte de ${orderInfo.customerName || 'alguien especial'}.`;
    if (g.message && g.message.trim()) forward += `\n\n💌 "${g.message.trim()}"`;
    forward += `\n\n— ${businessName}`;
    msg += forward;
  }

  return encodeURIComponent(msg).replace(/'/g, "%27");
}; 