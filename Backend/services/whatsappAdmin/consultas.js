/**
 * Las preguntas que el dueño le puede hacer al WhatsApp de su negocio.
 *
 * TODAS son de solo lectura. Ninguna escribe en ninguna tabla, y eso es una
 * decisión, no una fase: el teléfono es un solo factor de identidad, y con un
 * solo factor no se cierran cajas ni se gasta dinero. Cuando se agreguen
 * acciones que escriben, tendrán que pedir confirmación aparte.
 */
const { startOfDayCOL, endOfDayCOL, startOfMonthCOL } = require('../../utils/timezone');

const pesos = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');

/** Rango de un periodo, en horas de Colombia. */
function rango(periodo) {
  const hoy = new Date();
  if (periodo === 'ayer') {
    const ayer = new Date(hoy.getTime() - 24 * 3600 * 1000);
    return { desde: startOfDayCOL(ayer), hasta: endOfDayCOL(ayer), txt: 'ayer' };
  }
  if (periodo === 'semana') {
    return { desde: new Date(startOfDayCOL(hoy).getTime() - 6 * 24 * 3600 * 1000), hasta: endOfDayCOL(hoy), txt: 'los últimos 7 días' };
  }
  if (periodo === 'mes') {
    return { desde: startOfMonthCOL(hoy), hasta: endOfDayCOL(hoy), txt: 'este mes' };
  }
  return { desde: startOfDayCOL(hoy), hasta: endOfDayCOL(hoy), txt: 'hoy' };
}

/* Las ventas salen de CompletedOrder y no de Order: un pedido solo cuenta como
   venta cuando se completó. Contar los pendientes infla la cifra y luego no
   cuadra con la caja. */
async function ventas(businessId, periodo) {
  const CompletedOrder = require('../../Models/CompletedOrder');
  const { desde, hasta, txt } = rango(periodo);

  const [r] = await CompletedOrder.aggregate([
    { $match: { businessId, completedAt: { $gte: desde, $lte: hasta } } },
    { $group: { _id: null, total: { $sum: '$finalAmount' }, pedidos: { $sum: 1 } } },
  ]);

  if (!r?.pedidos) return `No hay ventas ${txt} todavía.`;
  const ticket = Math.round(r.total / r.pedidos);
  return `💰 *Ventas ${txt}*\n${pesos(r.total)} en ${r.pedidos} pedido${r.pedidos === 1 ? '' : 's'}\nTicket promedio: ${pesos(ticket)}`;
}

/** Lo que está sin entregar ahora mismo. */
async function pedidosPendientes(businessId) {
  const Order = require('../../Models/Order');
  const activos = await Order.find({
    businessId,
    status: { $nin: ['completed', 'cancelled', 'delivered'] },
  }).select('orderNumber status customerName finalAmount totalAmount').lean();

  if (!activos.length) return '✅ No hay pedidos pendientes.';

  const ETIQUETA = {
    pending: 'sin empezar', pending_payment: 'esperando pago',
    payment_uploaded: 'por cobrar', payment_confirmed: 'pago confirmado',
    confirmed: 'confirmado', preparing: 'en preparación',
    inProgress: 'en preparación', ready: 'listo',
  };

  const lineas = activos.slice(0, 10)
    .map((p) => `• #${p.orderNumber} — ${ETIQUETA[p.status] || p.status} · ${pesos(p.finalAmount ?? p.totalAmount)}`);
  const mas = activos.length > 10 ? `\n…y ${activos.length - 10} más` : '';
  return `🛒 *${activos.length} pedido${activos.length === 1 ? '' : 's'} pendiente${activos.length === 1 ? '' : 's'}*\n${lineas.join('\n')}${mas}`;
}

/** Cuánto hay en caja, sin cerrarla. */
async function caja(businessId) {
  const CashRegister = require('../../Models/CashRegister');
  const abierta = await CashRegister.findOne({ businessId, status: 'open' }).lean();
  if (!abierta) return '🔒 No hay ninguna caja abierta en este momento.';

  const movs = abierta.movements || [];
  /* Los dos nombres del mismo método de pago conviven en la base desde hace
     tiempo. Contar solo uno deja la mitad del efectivo fuera. */
  const esEfectivo = (m) => ['cash', 'efectivo'].includes(m.paymentMethod);
  const suma = (filtro) => movs.filter(filtro).reduce((t, m) => t + (Number(m.amount) || 0), 0);

  const ventasCaja = suma((m) => m.type === 'sale');
  const efectivo = suma((m) => m.type === 'sale' && esEfectivo(m));
  const gastos = suma((m) => m.type === 'expense');
  const enCaja = (Number(abierta.openingAmount) || 0) + efectivo - gastos;

  const abrio = new Date(abierta.openedAt).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  return `💵 *Caja abierta* desde ${abrio}\n`
    + `Base inicial: ${pesos(abierta.openingAmount)}\n`
    + `Ventas registradas: ${pesos(ventasCaja)}\n`
    + `Efectivo esperado: ${pesos(enCaja)}\n`
    + (gastos ? `Gastos: ${pesos(gastos)}\n` : '')
    + `\n_Para cerrarla hay que hacerlo desde el panel._`;
}

/** Qué se está vendiendo más. */
async function masVendido(businessId, periodo) {
  const CompletedOrder = require('../../Models/CompletedOrder');
  const { desde, hasta, txt } = rango(periodo || 'semana');

  const top = await CompletedOrder.aggregate([
    { $match: { businessId, completedAt: { $gte: desde, $lte: hasta } } },
    { $unwind: '$items' },
    { $group: { _id: '$items.name', unidades: { $sum: { $ifNull: ['$items.quantity', 1] } } } },
    { $sort: { unidades: -1 } },
    { $limit: 5 },
  ]);

  if (!top.length) return `No hay ventas ${txt} para comparar.`;
  const lineas = top.map((p, i) => `${i + 1}. ${p._id} — ${p.unidades} u.`);
  return `🔥 *Lo más vendido ${txt}*\n${lineas.join('\n')}`;
}

/** Lo que está por acabarse. */
async function stockBajo(businessId) {
  const Product = require('../../Models/Product');
  const productos = await Product.find({
    businessId, trackStock: true, stock: { $ne: null },
  }).select('name stock lowStockAlert').lean();

  const bajos = productos
    .filter((p) => Number(p.stock) <= Number(p.lowStockAlert ?? 5))
    .sort((a, b) => a.stock - b.stock);

  if (!productos.length) return 'Ningún producto tiene control de inventario activado.';
  if (!bajos.length) return '✅ Ningún producto está por acabarse.';

  const lineas = bajos.slice(0, 15).map((p) => {
    const agotado = Number(p.stock) <= 0;
    return `${agotado ? '🔴' : '🟠'} ${p.name} — ${agotado ? 'agotado' : `quedan ${p.stock}`}`;
  });
  return `📦 *${bajos.length} producto${bajos.length === 1 ? '' : 's'} por acabarse*\n${lineas.join('\n')}`;
}

/**
 * Un pedido concreto, por su número.
 *
 * Se busca en los activos y en los completados: un número que ya se despachó
 * sigue siendo el que el cliente tiene en la mano cuando llama a reclamar.
 */
async function pedido(businessId, numero) {
  const Order = require('../../Models/Order');
  const CompletedOrder = require('../../Models/CompletedOrder');

  const criterio = { businessId, orderNumber: String(numero) };
  const p = await Order.findOne(criterio).lean()
    || await CompletedOrder.findOne(criterio).sort({ completedAt: -1 }).lean();

  if (!p) return `No encontré el pedido #${numero}.`;

  const ESTADO = {
    pending: 'sin empezar', pending_payment: 'esperando pago',
    payment_uploaded: 'por cobrar', payment_confirmed: 'pago confirmado',
    confirmed: 'confirmado', preparing: 'en preparación',
    inProgress: 'en preparación', ready: 'listo',
    completed: 'completado', delivered: 'entregado', cancelled: 'cancelado',
  };
  const TIPO = { delivery: 'domicilio', takeaway: 'para recoger', inSite: 'en el local' };

  const items = (p.items || [])
    .map((i) => `• ${i.quantity || 1}× ${i.name}`)
    .join('\n');

  const cuando = new Date(p.completedAt || p.createdAt).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  return `🧾 *Pedido #${p.orderNumber}* — ${ESTADO[p.status] || p.status}\n`
    + `${p.customerName || 'Sin nombre'} · ${TIPO[p.orderType] || p.orderType}\n`
    + `${cuando}\n\n`
    + (items ? `${items}\n\n` : '')
    + `*Total: ${pesos(p.finalAmount ?? p.totalAmount)}*`
    + (p.deliveryAddress ? `\n📍 ${p.deliveryAddress}` : '');
}

/**
 * Cómo va el periodo comparado con el anterior.
 *
 * Una cifra sola no dice nada: $800.000 puede ser un buen día o el peor del
 * mes. Lo que informa es contra qué se compara.
 */
async function comparar(businessId, periodo) {
  const CompletedOrder = require('../../Models/CompletedOrder');
  const actual = rango(periodo);

  // El mismo tramo, corrido hacia atrás: ayer contra anteayer, esta semana
  // contra la anterior.
  const largo = actual.hasta.getTime() - actual.desde.getTime();
  const previo = {
    desde: new Date(actual.desde.getTime() - largo - 1),
    hasta: new Date(actual.desde.getTime() - 1),
  };

  const sumar = async ({ desde, hasta }) => {
    const [r] = await CompletedOrder.aggregate([
      { $match: { businessId, completedAt: { $gte: desde, $lte: hasta } } },
      { $group: { _id: null, total: { $sum: '$finalAmount' }, pedidos: { $sum: 1 } } },
    ]);
    return { total: r?.total || 0, pedidos: r?.pedidos || 0 };
  };

  const [a, b] = await Promise.all([sumar(actual), sumar(previo)]);

  if (!a.pedidos && !b.pedidos) return `No hay ventas ${actual.txt} ni en el periodo anterior.`;

  let veredicto;
  if (!b.total) {
    veredicto = 'No hay con qué comparar del periodo anterior.';
  } else {
    const cambio = Math.round(((a.total - b.total) / b.total) * 100);
    const flecha = cambio > 0 ? '📈' : cambio < 0 ? '📉' : '➡️';
    veredicto = `${flecha} ${cambio > 0 ? '+' : ''}${cambio}% frente al periodo anterior (${pesos(b.total)})`;
  }

  return `💰 *Ventas ${actual.txt}*\n${pesos(a.total)} en ${a.pedidos} pedido${a.pedidos === 1 ? '' : 's'}\n${veredicto}`;
}

/** Cuántos clientes llegaron, y quiénes son los que más gastan. */
async function clientes(businessId, periodo) {
  const Customer = require('../../Models/Customer');
  const { desde, hasta, txt } = rango(periodo || 'mes');

  const [nuevos, mejores] = await Promise.all([
    Customer.countDocuments({ businessId, createdAt: { $gte: desde, $lte: hasta } }),
    Customer.find({ businessId }).sort({ totalSpent: -1 }).limit(5)
      .select('name phone totalOrders totalSpent').lean(),
  ]);

  const lista = mejores.length
    ? mejores.map((c, i) => `${i + 1}. ${c.name || c.phone} — ${pesos(c.totalSpent)} en ${c.totalOrders} pedidos`).join('\n')
    : 'Todavía no hay clientes registrados.';

  return `👥 *Clientes nuevos ${txt}:* ${nuevos}\n\n*Los que más han gastado*\n${lista}`;
}

/** El resumen de "¿cómo va el negocio?". */
async function resumen(businessId) {
  /* Con comparación y no solo la cifra: "$800.000" no dice si el día va bien
     o mal, y eso es justo lo que se está preguntando. */
  const [v, p, c] = await Promise.all([
    comparar(businessId, 'hoy'),
    pedidosPendientes(businessId),
    caja(businessId),
  ]);
  return [v, p, c].join('\n\n');
}

module.exports = {
  ventas, pedidosPendientes, caja, masVendido, stockBajo, resumen,
  pedido, comparar, clientes,
  pesos, rango,
};
