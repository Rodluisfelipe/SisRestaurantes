/**
 * Lo que el dueño puede CAMBIAR desde WhatsApp.
 *
 * Solo cosas del catálogo: agotar un producto, volverlo a activar, y lo mismo
 * con un extra. Nada de dinero, nada de caja, nada de borrar.
 *
 * El criterio para dejar escribir aquí es que el error sea barato y visible:
 * si se agota el producto equivocado, se nota en minutos y se deshace con un
 * mensaje. Cerrar una caja mal, no.
 *
 * Toda acción pasa por confirmación. Con un solo factor de identidad —el
 * teléfono— la confirmación es la segunda barrera: obliga a que quien escribe
 * lea qué va a pasar antes de que pase.
 */
const logger = require('../../utils/logger');

/* El mismo buscador que usa el agente con los clientes. Se reutiliza a
   propósito: ahí ya se resolvió que "hamburguesa doble" no puede acabar
   escogiendo "Hamburguesa", que fue un pedido mal tomado de verdad. */
const { buscarProducto } = require('../whatsappAgent/acciones');

const Product = require('../../Models/Product');
const ToppingGroup = require('../../Models/ToppingGroup');

/**
 * Deja constancia de quién cambió qué desde WhatsApp.
 *
 * Se usa el mismo registro que el panel —`toggle` sobre `product` o
 * `toppingGroup`— para que un cambio hecho por chat aparezca en la misma
 * historia que uno hecho a mano. Si tuviera acciones propias, quedaría fuera
 * de cualquier revisión.
 *
 * `before`/`after` se guardan porque el modelo los usa para poder deshacer.
 */
async function anotar({ businessId, persona, recurso, recursoId, nombre, antes, despues }) {
  try {
    const AuditLog = require('../../Models/AuditLog');
    await AuditLog.create({
      businessId,
      action: 'toggle',
      resource: recurso,
      resourceId: String(recursoId),
      resourceName: nombre,
      // Quién: el teléfono es la identidad con la que se autorizó.
      userId: persona?.telefono || null,
      userRole: 'whatsapp',
      userAgent: `WhatsApp · ${persona?.nombre || 'número autorizado'}`,
      before: { active: antes },
      after: { active: despues },
    });
  } catch (e) {
    // Que falle la anotación no puede impedir el cambio, pero sí hay que verlo.
    logger.warn('[WhatsApp] No se pudo anotar la acción en la auditoría', { error: e.message });
  }
}

/**
 * Busca lo que el dueño nombró: primero entre los productos, luego entre los
 * extras. En ese orden porque "se acabó el queso" suele ser el extra, pero
 * "se acabó la hamburguesa" es el producto, y los productos son menos y más
 * distintivos.
 */
async function encontrar(businessId, texto) {
  const productos = await Product.find({ businessId }).select('name active stock').lean();
  const r = buscarProducto(productos, texto);
  if (r.producto) return { tipo: 'producto', item: r.producto };
  /* El buscador devuelve `opciones` cuando varios empatan. Se pregunta cuál,
     nunca se elige por él: agotar el producto equivocado saca del menú algo
     que sí se estaba vendiendo. */
  if (r.opciones?.length) return { tipo: 'producto', ambiguo: r.opciones };

  const grupos = await ToppingGroup.find({ businessId }).select('name options').lean();
  const opciones = [];
  for (const g of grupos) {
    for (const o of g.options || []) {
      opciones.push({ _id: o._id, name: o.name, active: o.active, grupoId: g._id, grupo: g.name });
    }
  }
  const e = buscarProducto(opciones, texto);
  if (e.producto) return { tipo: 'extra', item: e.producto };
  if (e.opciones?.length) return { tipo: 'extra', ambiguo: e.opciones };

  return { ninguno: true };
}

/** Aplica el cambio. Se llama solo después de que el dueño confirmó. */
async function aplicar({ businessId, persona, accion }) {
  if (accion.operacion === 'stock') return aplicarStock({ businessId, persona, accion });

  const activar = accion.operacion === 'activar';

  if (accion.tipo === 'producto') {
    const p = await Product.findOneAndUpdate(
      { _id: accion.itemId, businessId },
      { $set: { active: activar } },
      { new: true },
    );
    if (!p) return 'Ese producto ya no existe.';

    await anotar({
      businessId, persona, recurso: 'product', recursoId: p._id,
      nombre: p.name, antes: !activar, despues: activar,
    });
    return activar
      ? `✅ *${p.name}* vuelve a estar disponible en el menú.`
      : `🚫 *${p.name}* ya no aparece en el menú.\n\n_Para volver a activarlo: "activa ${p.name}"._`;
  }

  /* El extra vive dentro de un grupo, así que se actualiza por posición con
     un filtro: sin `arrayFilters` habría que traerse el grupo, modificarlo en
     memoria y guardarlo entero, y dos cambios a la vez se pisarían. */
  const g = await ToppingGroup.findOneAndUpdate(
    { _id: accion.grupoId, businessId },
    { $set: { 'options.$[o].active': activar } },
    { new: true, arrayFilters: [{ 'o._id': accion.itemId }] },
  );
  if (!g) return 'Ese extra ya no existe.';

  await anotar({
    businessId, persona, recurso: 'toppingGroup', recursoId: g._id,
    nombre: `${g.name} › ${accion.nombre}`, antes: !activar, despues: activar,
  });
  return activar
    ? `✅ *${accion.nombre}* vuelve a estar disponible.`
    : `🚫 *${accion.nombre}* ya no se ofrece.\n\n_Para volver a activarlo: "activa ${accion.nombre}"._`;
}

/**
 * Deja el stock de un producto en una cantidad, o le suma unidades.
 *
 * Si el producto no tenía control de inventario, se le activa. Eso se avisa en
 * la confirmación: encender el control hace que el producto se agote solo
 * cuando llegue a cero, y quien solo quería anotar una cifra tiene que saber
 * que a partir de ahí el menú se va a apagar por su cuenta.
 */
async function aplicarStock({ businessId, persona, accion }) {
  const p = await Product.findOne({ _id: accion.itemId, businessId });
  if (!p) return 'Ese producto ya no existe.';

  const antes = p.trackStock ? (Number(p.stock) || 0) : null;
  const nuevo = accion.sumar
    ? (antes || 0) + accion.cantidad
    : accion.cantidad;

  p.stock = nuevo;
  p.trackStock = true;
  await p.save();

  await anotar({
    businessId, persona, recurso: 'product', recursoId: p._id,
    nombre: p.name, antes, despues: nuevo,
  });

  const seActivo = antes === null ? '\n\n_Le activé el control de inventario: se va a agotar solo al llegar a cero._' : '';
  return `📦 *${p.name}*: ${nuevo} unidad${nuevo === 1 ? '' : 'es'}.${seActivo}`;
}

module.exports = { encontrar, aplicar, aplicarStock, anotar };
