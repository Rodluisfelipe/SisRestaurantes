/**
 * El inventario cuando se mueve solo: ventas, cancelaciones y devoluciones.
 *
 * Vivía dentro de Routes/orders.js, pero descontar por una venta y devolver
 * por un cambio de talla son la misma operación con el signo cambiado. Tenerlo
 * en dos sitios era garantizar que con el tiempo uno de los dos descontara
 * distinto y el conteo del negocio dejara de cuadrar sin que nadie supiera cuál
 * de los dos mentía.
 */
const logger = require('../utils/logger');

/**
 * Mueve el inventario de una lista de líneas de pedido.
 *
 * @param {Array} items  líneas con productId y quantity
 * @param {number} signo -1 descuenta (se vendió), +1 devuelve (se canceló o
 *                       se quitó del pedido)
 *
 * Existe porque el descuento solo ocurría al crear el pedido. Cancelarlo no
 * devolvía nada, agregarle productos no descontaba, y quitarle tampoco
 * devolvía: el inventario se iba desviando de la realidad en cada operación
 * que no fuera "crear y despachar".
 *
 * Nunca tumba la operación que la llama: si el inventario falla, el pedido
 * igual se guarda y queda el aviso en el log. Un pedido perdido es peor que
 * un conteo desajustado.
 */
/**
 * Mueve los insumos que consume un producto con receta.
 *
 * En el inventario avanzado, vender una hamburguesa no descuenta
 * "hamburguesas": descuenta pan, carne y queso, que es lo que de verdad se
 * agota en la cocina. Si el producto no tiene receta, no hace nada y el
 * control sigue siendo por producto.
 */
async function moverInsumos(producto, unidadesVendidas, signo, contexto) {
  if (!producto?.recipe?.length) return false;

  const Supply = require('../Models/Supply');
  const StockMovement = require('../Models/StockMovement');

  await Promise.all(producto.recipe.map(async (linea) => {
    if (!linea.supplyId || !linea.quantity) return;
    const consumo = linea.quantity * unidadesVendidas * signo;
    if (!consumo) return;

    const antes = await Supply.findOneAndUpdate(
      { _id: linea.supplyId },
      [{ $set: { stock: { $max: [0, { $add: [{ $ifNull: ['$stock', 0] }, consumo] }] } } }],
      { new: false }
    ).select('name stock unit businessId').lean();
    if (!antes) return;

    const a = antes.stock ?? 0;
    const d = Math.max(0, a + consumo);

    await StockMovement.create({
      businessId: antes.businessId,
      supplyId: linea.supplyId,
      productName: antes.name,
      unit: antes.unit || '',
      type: contexto.type || (signo < 0 ? 'sale' : 'return'),
      quantity: d - a,
      stockBefore: a,
      stockAfter: d,
      orderId: contexto.orderId || null,
      orderNumber: contexto.orderNumber || '',
      userId: contexto.userId || null,
      // Se deja dicho qué plato lo consumió: sin eso, ver "-150 g de carne"
      // en el historial no explica nada.
      note: `${producto.name} x${unidadesVendidas}`,
    }).catch(() => {});
  }));

  return true;
}

/**
 * Nivel de inventario del negocio. Se consulta una vez por operación y no por
 * línea: un pedido de diez productos haría diez lecturas iguales.
 *
 * Ante cualquier duda devuelve 'off': es preferible no tocar el inventario que
 * descontar de un negocio que no lo está usando.
 */
async function nivelInventario(businessId) {
  if (!businessId) return 'off';
  try {
    const BusinessConfig = require('../Models/BusinessConfig');
    const b = await BusinessConfig.findById(businessId).select('inventory').lean();
    return b?.inventory?.mode || 'off';
  } catch {
    return 'off';
  }
}

async function moverStock(items, signo, contexto = {}) {
  if (!Array.isArray(items) || !items.length) return;
  try {
    const Product = require('../Models/Product');
    const StockMovement = require('../Models/StockMovement');

    /* El nivel manda. Antes se descontaba siempre que el producto tuviera
       trackStock, sin mirar el nivel: con el inventario en "Sin control" la
       pantalla prometía que no se tocaría nada y sí se tocaba, y las recetas
       se aplicaban aunque el negocio estuviera en Básico. */
    const nivel = await nivelInventario(contexto.businessId);
    if (nivel === 'off') return;

    await Promise.all(items.map(async (item) => {
      if (!item.productId) return;
      const cantidad = (Number(item.quantity) || 1) * signo;
      if (!cantidad) return;

      /* Tiendas: el stock vive en cada variante (talla, color, fragancia),
         no en el producto. La combinación completa es lo único que identifica
         a una variante, así que se compara valor por valor.

         Se lee y luego se escribe, no en una sola operación atómica: dos
         pedidos de la misma talla en el mismo instante podrían descontar uno
         solo. Con el volumen de una tienda pequeña es asumible, y el conteo se
         corrige desde Inventario; conviene revisarlo si el negocio crece. */
      const combinacion = item && item.variante && item.variante.valores;
      if (Array.isArray(combinacion) && combinacion.length) {
        const producto = await Product.findById(item.productId)
          .select('name businessId trackStock variantes')
          .lean();
        // Sin control de inventario no se lleva cuenta, igual que en el resto del catálogo.
        if (!producto || !producto.trackStock) return;
        const i = (producto.variantes || []).findIndex(
          (v) => Array.isArray(v.valores) &&
            v.valores.length === combinacion.length &&
            v.valores.every((valor, k) => String(valor).toLowerCase() === String(combinacion[k]).toLowerCase())
        );
        if (i === -1) return;

        const saldoAntes = Number(producto.variantes[i].stock) || 0;
        const saldoDespues = Math.max(0, saldoAntes + cantidad);
        await Product.updateOne({ _id: item.productId }, { $set: { ['variantes.' + i + '.stock']: saldoDespues } });

        await StockMovement.create({
          businessId: producto.businessId,
          productId: item.productId,
          productName: producto.name + ' (' + combinacion.join(' · ') + ')',
          type: contexto.type || (signo < 0 ? 'sale' : 'return'),
          quantity: saldoDespues - saldoAntes,
          stockBefore: saldoAntes,
          stockAfter: saldoDespues,
          orderId: contexto.orderId || null,
          orderNumber: contexto.orderNumber || '',
          userId: contexto.userId || null,
          userName: contexto.userName || '',
          note: contexto.note || '',
        }).catch(() => {});
        return;
      }

      /* Solo en avanzado: si el producto tiene receta, lo que se mueve son sus
         insumos y el contador del producto se deja quieto. Llevar los dos a la
         vez daría un doble descuento del mismo consumo. */
      if (nivel === 'advanced') {
        const conReceta = await Product.findById(item.productId).select('name recipe').lean();
        if (conReceta?.recipe?.length) {
          await moverInsumos(conReceta, Math.abs(Number(item.quantity) || 1), signo, contexto);
          return;
        }
      }

      /* findOneAndUpdate en vez de updateOne para conocer el saldo anterior:
         sin eso el historial no podría decir "de 12 pasó a 9", que es lo que
         hace auditable un movimiento. Es atómico igual. */
      const antes = await Product.findOneAndUpdate(
        { _id: item.productId, trackStock: true },
        /* $max con 0 para que no quede negativo al descontar. Al devolver,
           puede quedar por encima de lo que había si en su momento se vendió
           más de lo disponible: se prefiere eso a perder unidades, y el conteo
           se corrige a mano desde Inventario. */
        [{ $set: { stock: { $max: [0, { $add: [{ $ifNull: ['$stock', 0] }, cantidad] }] } } }],
        { new: false }   // devuelve el documento ANTES del cambio
      ).select('name stock businessId').lean();

      // Sin control de inventario activo no hay nada que registrar
      if (!antes) return;

      const saldoAntes = antes.stock ?? 0;
      const saldoDespues = Math.max(0, saldoAntes + cantidad);

      await StockMovement.create({
        businessId: antes.businessId,
        productId: item.productId,
        productName: antes.name || item.name || '',
        type: contexto.type || (signo < 0 ? 'sale' : 'return'),
        // Lo realmente movido, que puede ser menos de lo pedido si topó en 0
        quantity: saldoDespues - saldoAntes,
        stockBefore: saldoAntes,
        stockAfter: saldoDespues,
        orderId: contexto.orderId || null,
        orderNumber: contexto.orderNumber || '',
        userId: contexto.userId || null,
        userName: contexto.userName || '',
        note: contexto.note || '',
      }).catch(() => {});   // el historial nunca puede tumbar la venta
    }));
  } catch (err) {
    logger.warn('No se pudo mover el inventario', { error: err.message, signo });
  }
}

module.exports = { moverStock, moverInsumos, nivelInventario };
