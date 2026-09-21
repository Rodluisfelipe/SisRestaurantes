const Product = require('../Models/Product');
const logger = require('./logger');

/**
 * Cómo se enteran las cajas de que un grupo de extras cambió.
 *
 * El catálogo baja a las terminales por **marca de agua**: cada caja guarda la
 * fecha del último cambio que recibió y solo pide lo posterior. Esa fecha sale
 * de `Product.updatedAt`, porque lo que la caja replica son productos.
 *
 * El problema es que los extras viajan **dentro** del producto —aplanados en
 * una columna JSON— pero viven en otro documento. Editar un grupo, marcarlo
 * como tamaño o apagarle una opción cambia el `ToppingGroup` y **no toca el
 * producto**: su `updatedAt` se queda donde estaba, por debajo de la marca de
 * agua de la caja, y el cambio no se pide nunca.
 *
 * No falla ruidosamente. La caja sigue vendiendo, con los extras de antes, y
 * nadie se entera hasta que un cliente pide una opción que el negocio quitó
 * hace un mes.
 *
 * Es el mismo fallo que tuvieron las fotos, y la regla que quedó escrita
 * entonces es la que aplica aquí: **lo que cambie el contenido de un producto
 * tiene que mover su `updatedAt`**.
 */

/**
 * Marca como cambiados los productos que usan este grupo de extras.
 *
 * No espera a nadie ni rompe nada si falla: quien llama ya guardó lo que el
 * dueño pidió, y lo peor que puede pasar aquí es que las cajas tarden hasta la
 * siguiente edición en enterarse. Un 500 en el panel por esto sería peor.
 *
 * @param {*} grupoId el `_id` del ToppingGroup que cambió
 * @returns {Promise<number>} cuántos productos se marcaron
 */
async function tocarProductosDe(grupoId) {
  if (!grupoId) return 0;

  try {
    /* `$currentDate` y no `$set: { updatedAt: new Date() }`: lo pone el motor,
       con su reloj, en la misma operación. Con `$set` y varios procesos de
       Node con relojes distintos, un producto podría quedar marcado con una
       fecha anterior a la marca de agua que la caja ya tenía. */
    const r = await Product.updateMany(
      { toppingGroups: grupoId },
      { $currentDate: { updatedAt: true } },
      { timestamps: false },
    );

    return r.modifiedCount || 0;
  } catch (error) {
    logger.error('No se pudieron marcar los productos del grupo de extras', error);
    return 0;
  }
}

module.exports = { tocarProductosDe };
