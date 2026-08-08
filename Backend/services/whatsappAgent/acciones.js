/**
 * Lo que el agente puede HACER. Todo lo que toca plata o datos pasa por acá.
 *
 * El modelo no ejecuta nada: devuelve el nombre de una acción y unos
 * argumentos, y este archivo la ejecuta contra la base. Así el modelo nunca
 * elige un precio, nunca decide si hay stock y nunca arma un total. Esa
 * separación es lo único que impide que vuelvan los pedidos con el total
 * equivocado que ya arreglamos una vez.
 */
const Product = require('../../Models/Product');
const logger = require('../../utils/logger');

/** Normaliza para comparar: sin tildes, sin mayúsculas. */
function llano(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/**
 * Busca un producto por nombre aproximado, dentro del catálogo del negocio.
 *
 * Devuelve `{ producto }` si hay una sola coincidencia clara, `{ opciones }`
 * si hay varias —para que el agente pregunte cuál— y `{ ninguno: true }` si no
 * hay nada. Nunca inventa: si el cliente pide algo que no está en la carta, el
 * agente tiene que decirlo.
 */
function buscarProducto(catalogo, texto) {
  const q = llano(texto);
  if (!q) return { ninguno: true };

  const exacto = catalogo.filter((p) => llano(p.name) === q);
  if (exacto.length === 1) return { producto: exacto[0] };

  const contiene = catalogo.filter((p) => llano(p.name).includes(q) || q.includes(llano(p.name)));
  if (contiene.length === 1) return { producto: contiene[0] };
  if (contiene.length > 1) return { opciones: contiene.slice(0, 6) };

  // Por palabras: "hamburguesa doble" encuentra "Hamburguesa Doble Queso"
  const palabras = q.split(/\s+/).filter((w) => w.length > 2);
  if (palabras.length) {
    const porPalabras = catalogo
      .map((p) => ({ p, aciertos: palabras.filter((w) => llano(p.name).includes(w)).length }))
      .filter((x) => x.aciertos > 0)
      .sort((a, b) => b.aciertos - a.aciertos);
    if (porPalabras.length === 1) return { producto: porPalabras[0].p };
    if (porPalabras.length > 1) return { opciones: porPalabras.slice(0, 6).map((x) => x.p) };
  }

  return { ninguno: true };
}

/** ¿Se puede vender? El stock manda, no lo que crea el modelo. */
function hayExistencias(producto, cantidad) {
  if (!producto.trackStock) return { ok: true };
  const stock = Number(producto.stock) || 0;
  if (stock >= cantidad) return { ok: true };
  return { ok: false, disponible: stock };
}

/**
 * Agrega al carrito leyendo el precio de la base, nunca del mensaje.
 */
async function agregar(sesion, catalogo, { producto: nombre, cantidad = 1 }) {
  const cant = Math.max(1, Math.min(50, Number(cantidad) || 1));
  const hallazgo = buscarProducto(catalogo, nombre);

  if (hallazgo.ninguno) {
    return { ok: false, motivo: 'no_existe', pedido: nombre };
  }
  if (hallazgo.opciones) {
    return { ok: false, motivo: 'ambiguo', opciones: hallazgo.opciones.map((p) => p.name) };
  }

  const p = hallazgo.producto;
  const yaTiene = (sesion.items || []).find((i) => String(i.productId) === String(p._id));
  const cantidadFinal = (yaTiene?.quantity || 0) + cant;

  const stock = hayExistencias(p, cantidadFinal);
  if (!stock.ok) {
    return { ok: false, motivo: 'sin_stock', producto: p.name, disponible: stock.disponible };
  }

  if (yaTiene) {
    yaTiene.quantity = cantidadFinal;
  } else {
    sesion.items.push({
      productId: p._id,
      name: p.name,
      price: Number(p.price) || 0,   // el precio sale de la base
      quantity: cant,
    });
  }

  return { ok: true, producto: p.name, cantidad: cant, precio: Number(p.price) || 0 };
}

function quitar(sesion, catalogo, { producto: nombre }) {
  const hallazgo = buscarProducto(catalogo, nombre);
  const objetivo = hallazgo.producto;
  const antes = sesion.items.length;

  if (objetivo) {
    sesion.items = sesion.items.filter((i) => String(i.productId) !== String(objetivo._id));
  } else {
    const q = llano(nombre);
    sesion.items = sesion.items.filter((i) => !llano(i.name).includes(q));
  }

  return { ok: sesion.items.length < antes, quitado: objetivo?.name || nombre };
}

function fijarTipo(sesion, { tipo }) {
  const validos = { domicilio: 'delivery', delivery: 'delivery', recoger: 'takeaway', takeaway: 'takeaway', mesa: 'inSite', insite: 'inSite' };
  const t = validos[llano(tipo)];
  if (!t) return { ok: false };
  sesion.orderType = t;
  return { ok: true, tipo: t };
}

function fijarDatos(sesion, { direccion, nombre, notas }) {
  if (direccion) sesion.address = String(direccion).slice(0, 300);
  if (nombre) sesion.customerName = String(nombre).slice(0, 80);
  if (notas) sesion.notes = String(notas).slice(0, 300);
  return { ok: true };
}

/**
 * Qué falta para poder cerrar. El agente pregunta solo lo que falte, en vez de
 * repetir un cuestionario.
 */
function queFalta(sesion) {
  const falta = [];
  if (!sesion.items?.length) falta.push('productos');
  if (!sesion.orderType) falta.push('tipo');
  if (sesion.orderType === 'delivery' && !sesion.address) falta.push('direccion');
  if (!sesion.customerName) falta.push('nombre');
  return falta;
}

/**
 * Crea el pedido de verdad, por el mismo camino que el panel.
 *
 * Los precios se vuelven a leer de la base justo antes de crear: si el negocio
 * cambió un precio a mitad de conversación, manda el de la base, no el que se
 * guardó al agregar.
 */
async function crearPedido(sesion, businessId, { crearOrden }) {
  const falta = queFalta(sesion);
  if (falta.length) return { ok: false, motivo: 'incompleto', falta };

  const ids = sesion.items.map((i) => i.productId);
  const actuales = await Product.find({ _id: { $in: ids }, businessId }).select('name price stock trackStock').lean();
  const porId = new Map(actuales.map((p) => [String(p._id), p]));

  const items = [];
  for (const linea of sesion.items) {
    const p = porId.get(String(linea.productId));
    if (!p) return { ok: false, motivo: 'producto_desaparecido', producto: linea.name };

    const stock = hayExistencias(p, linea.quantity);
    if (!stock.ok) {
      return { ok: false, motivo: 'sin_stock', producto: p.name, disponible: stock.disponible };
    }

    const precio = Number(p.price) || 0;
    items.push({
      productId: p._id,
      name: p.name,
      price: precio,
      totalPrice: precio,
      quantity: linea.quantity,
      selectedToppings: [],
    });
  }

  const totalAmount = items.reduce((s, i) => s + i.price * i.quantity, 0);

  const pedido = await crearOrden({
    businessId,
    customerName: sesion.customerName,
    phone: sesion.contactPhone,
    orderType: sesion.orderType,
    address: sesion.orderType === 'delivery' ? sesion.address : undefined,
    customerNotes: sesion.notes || undefined,
    orderChannel: 'whatsapp',
    items,
    totalAmount,
    /* El envío NO lo calcula el agente: las zonas son polígonos y tarifas por
       distancia, y una dirección escrita a mano no da coordenadas fiables.
       Se deja sin calcular para que el negocio lo confirme, que es preferible
       a cobrarle de menos o de más al cliente. */
    deliveryCalculated: false,
  });

  sesion.orderId = pedido._id;
  sesion.orderNumber = pedido.orderNumber;
  sesion.estado = 'cerrada';

  return { ok: true, pedido, total: totalAmount };
}

module.exports = {
  llano,
  buscarProducto,
  hayExistencias,
  agregar,
  quitar,
  fijarTipo,
  fijarDatos,
  queFalta,
  crearPedido,
};
