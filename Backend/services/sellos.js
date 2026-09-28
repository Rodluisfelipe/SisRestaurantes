const LoyaltyProgram = require('../Models/LoyaltyProgram');
const CustomerLoyalty = require('../Models/CustomerLoyalty');
const Customer = require('../Models/Customer');
const Product = require('../Models/Product');
const logger = require('../utils/logger');

/**
 * Tarjeta de sellos: "cada pedido suma un sello; al llenar la tarjeta, el
 * siguiente pedido lleva premio".
 *
 * Es la otra forma del programa de fidelidad (el negocio elige puntos o
 * sellos). Todo lo que mueve sellos pasa por aquí, por las mismas razones que
 * el canje de puntos vive en un solo sitio: una sola puerta que cuenta.
 *
 * El premio se canjea en el servidor al crear el pedido, no en el navegador:
 * así el descuento queda en el pedido que ve el negocio y el premio no se
 * puede usar dos veces con dos pestañas abiertas.
 */

const TIPOS_PREMIO = ['free_product', 'discount_fixed', 'discount_percent'];

/** La configuración de la tarjeta, con valores sanos aunque falten datos. */
function tarjetaDe(programa) {
  const t = programa?.stampCard || {};
  const premio = t.reward || {};
  return {
    requeridos: Math.min(Math.max(parseInt(t.required, 10) || 10, 2), 30),
    montoMinimo: Math.max(0, Number(t.minAmount) || 0),
    premio: {
      tipo: TIPOS_PREMIO.includes(premio.type) ? premio.type : 'free_product',
      nombre: String(premio.name || '').trim() || 'Premio de la tarjeta',
      valor: Math.max(0, Number(premio.discountValue) || 0),
      tope: Math.max(0, Number(premio.maxDiscount) || 0),
      productId: premio.productId ? String(premio.productId) : '',
      productName: premio.productName || '',
    },
  };
}

/** El programa del negocio si está activo y funciona con sellos. */
async function programaDeSellos(businessId) {
  const p = await LoyaltyProgram.findOne({ businessId, isActive: true }).lean();
  return p && p.mode === 'stamps' ? p : null;
}

/**
 * Cuánto descuenta el premio en este pedido.
 * Producto gratis: el precio del producto (de la base, no del navegador), y
 * solo si el pedido lo trae.
 * @returns {{ok: true, descuento: number} | {ok: false, message: string}}
 */
async function descuentoDelPremio(tarjeta, items, totalProductos) {
  const { premio } = tarjeta;
  const total = Math.max(0, Number(totalProductos) || 0);
  if (premio.tipo === 'discount_fixed') {
    return { ok: true, descuento: Math.round(Math.min(premio.valor, total)) };
  }
  if (premio.tipo === 'discount_percent') {
    let d = Math.round(total * Math.min(premio.valor, 100) / 100);
    if (premio.tope > 0) d = Math.min(d, premio.tope);
    return { ok: true, descuento: d };
  }
  // Producto gratis
  const lleva = (items || []).some((i) => String(i.productId || i._id || '') === premio.productId);
  if (!premio.productId || !lleva) {
    return { ok: false, message: `Para usar tu premio agrega ${premio.productName || 'el producto del premio'} al pedido.` };
  }
  const producto = await Product.findById(premio.productId).select('price').lean();
  return { ok: true, descuento: Math.round(Math.min(Number(producto?.price) || 0, total)) };
}

/**
 * Aparta un premio del cliente (atómico: dos pedidos a la vez no usan el
 * mismo premio). Devuelve false si no tiene premios disponibles.
 */
async function apartarPremio({ businessId, telefono, nombre }) {
  const r = await CustomerLoyalty.findOneAndUpdate(
    { businessId, phone: telefono, stampRewards: { $gte: 1 } },
    {
      $inc: { stampRewards: -1, stampRewardsUsed: 1 },
      $set: { lastActivityAt: new Date() },
      $push: { transactions: { type: 'stamp_redeem', points: 0, description: `Premio usado: ${nombre}`, createdAt: new Date() } },
    },
    { new: true },
  );
  return !!r;
}

/** Devuelve un premio apartado (el pedido no se creó o se canceló). */
async function devolverPremio({ businessId, telefono, motivo, orderId }) {
  await CustomerLoyalty.updateOne(
    { businessId, phone: telefono },
    {
      $inc: { stampRewards: 1, stampRewardsUsed: -1 },
      $push: { transactions: { type: 'stamp_return', points: 0, description: motivo, orderId, createdAt: new Date() } },
    },
  );
}

/**
 * Suma el sello de un pedido completado. Idempotente: si el pedido ya sumó su
 * sello (reintento, doble toque en "Completar"), no suma otro.
 * @returns {Promise<{sumado: boolean, lleno?: boolean}>}
 */
async function sumarSello(pedido, programa) {
  if (!pedido?.customerId) return { sumado: false };
  const tarjeta = tarjetaDe(programa);
  const monto = Number(pedido.totalAmount) || 0;
  if (monto < tarjeta.montoMinimo) return { sumado: false };

  const filtro = { businessId: pedido.businessId, customerId: pedido.customerId };
  // Que exista la ficha (con teléfono), sin pisar una que ya esté
  const existe = await CustomerLoyalty.exists(filtro);
  if (!existe) {
    const cliente = await Customer.findById(pedido.customerId).select('phone').lean();
    try {
      await CustomerLoyalty.create({ ...filtro, phone: cliente?.phone || pedido.phone || '' });
    } catch (e) {
      if (e.code !== 11000) throw e;   // otra petición la creó en el mismo instante
    }
  }

  const n = tarjeta.requeridos;
  const antes = await CustomerLoyalty.findOneAndUpdate(
    { ...filtro, transactions: { $not: { $elemMatch: { type: 'stamp', orderId: pedido._id } } } },
    [
      { $set: { stamps: { $add: [{ $ifNull: ['$stamps', 0] }, 1] } } },
      {
        $set: {
          stampRewards: { $add: [{ $ifNull: ['$stampRewards', 0] }, { $cond: [{ $gte: ['$stamps', n] }, 1, 0] }] },
          cardsCompleted: { $add: [{ $ifNull: ['$cardsCompleted', 0] }, { $cond: [{ $gte: ['$stamps', n] }, 1, 0] }] },
          stamps: { $cond: [{ $gte: ['$stamps', n] }, 0, '$stamps'] },
          totalStamps: { $add: [{ $ifNull: ['$totalStamps', 0] }, 1] },
          totalOrders: { $add: [{ $ifNull: ['$totalOrders', 0] }, 1] },
          lastActivityAt: '$$NOW',
          transactions: {
            $concatArrays: [
              { $ifNull: ['$transactions', []] },
              [{ type: 'stamp', points: 0, description: `Sello por el pedido #${pedido.orderNumber}`, orderId: pedido._id, createdAt: '$$NOW' }],
            ],
          },
        },
      },
    ],
    { new: false },
  ).select('stamps').lean();

  if (!antes) return { sumado: false };   // ya tenía el sello de este pedido
  const lleno = (Number(antes.stamps) || 0) + 1 >= n;
  logger.info('Sello sumado', { orderId: String(pedido._id), lleno });
  return { sumado: true, lleno };
}

/** Lo que se muestra de la tarjeta de un cliente (menú, caja, panel). */
function estadoTarjeta(programa, lealtad) {
  const tarjeta = tarjetaDe(programa);
  return {
    requeridos: tarjeta.requeridos,
    montoMinimo: tarjeta.montoMinimo,
    premio: tarjeta.premio,
    sellos: Number(lealtad?.stamps) || 0,
    premiosDisponibles: Number(lealtad?.stampRewards) || 0,
    tarjetasCompletadas: Number(lealtad?.cardsCompleted) || 0,
  };
}

module.exports = {
  TIPOS_PREMIO, tarjetaDe, programaDeSellos, descuentoDelPremio,
  apartarPremio, devolverPremio, sumarSello, estadoTarjeta,
};
