/**
 * Qué cuenta como "ventas", en un solo sitio.
 *
 * Un pedido mezcla cosas que no son lo mismo: lo que el negocio vendió, lo que
 * cobró por llevarlo y lo que el cliente dejó de propina. El domicilio suele
 * ir al domiciliario y la propina al personal, así que meterlos en "Ventas"
 * infla una cifra que el dueño usa para decidir.
 *
 *   VENTAS   = productos - descuentos   -> lo que factura el negocio
 *   ENVIOS   = domicilios               -> aparte, casi siempre de terceros
 *   PROPINAS = propinas                 -> aparte, del personal
 *   COBRADO  = la suma de los tres      -> lo que entró en caja
 *
 * Todo se calcula desde esas piezas y no desde `finalAmount`, que durante
 * meses se guardó sin sumar el domicilio. Las piezas siempre fueron correctas,
 * así que los reportes salen bien también para el histórico, sin reescribirlo.
 *
 * Vive aparte porque el criterio se había duplicado en el panel, el superadmin,
 * el Excel y el correo semanal, y se separaron entre sí: la misma venta daba
 * cifras distintas según la pantalla.
 */

const num = (campo) => ({ $ifNull: [campo, 0] });

/** Ventas del negocio: productos menos descuentos. Sin domicilio ni propina. */
const SALES = {
  $subtract: [num('$totalAmount'), num('$discountAmount')],
};

/** Domicilios cobrados. */
const DELIVERY = num('$deliveryFee');

/** Propinas recibidas. */
const TIPS = num('$tipAmount');

/** Todo lo que entró por el pedido. */
const CHARGED = { $add: [SALES, DELIVERY, TIPS] };

/** Versiones para un documento ya cargado (Excel, listados, correos). */
const n = (v) => Number(v) || 0;

function salesOf(order) {
  if (!order) return 0;
  return n(order.totalAmount) - n(order.discountAmount);
}

function deliveryOf(order) {
  return order ? n(order.deliveryFee) : 0;
}

function tipsOf(order) {
  return order ? n(order.tipAmount) : 0;
}

function chargedOf(order) {
  return salesOf(order) + deliveryOf(order) + tipsOf(order);
}

module.exports = {
  SALES, DELIVERY, TIPS, CHARGED,
  salesOf, deliveryOf, tipsOf, chargedOf,
};
