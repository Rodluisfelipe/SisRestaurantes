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

  /* Se puntúa cada producto y gana el que coincida en MÁS palabras.
     Antes bastaba con que la consulta contuviera el nombre, y eso hacía que un
     nombre corto se tragara consultas más específicas: pedir "hamburguesa
     doble" devolvía "Hamburguesa" en vez de "Doble Hamburguesa con Queso", y el
     cliente recibía otro plato. */
  /* Se conservan las cifras: en "nuggets de 6" el 6 es lo que distingue una
     porción de otra. Las palabras cortas ("de", "la") no aportan nada. */
  const partir = (s) => s.split(/\s+/).filter((w) => w.length > 2 || /^\d+$/.test(w));
  const palabrasQ = partir(q);

  const puntuados = catalogo
    .map((p) => {
      const n = llano(p.name);
      const palabrasN = partir(n);
      /* Se compara por trozo y no por palabra entera: el cliente dice
         "nuggets" y el producto se llama "McNuggets". */
      const aciertos = palabrasQ.filter((w) => n.includes(w)).length;
      // Qué parte del nombre del producto quedó explicada por lo que dijo.
      const especificidad = palabrasN.length ? aciertos / palabrasN.length : 0;
      const contiene = n.includes(q) || q.includes(n) ? 1 : 0;
      return { p, aciertos, contiene, puntaje: aciertos * 3 + especificidad + contiene };
    })
    .filter((x) => x.aciertos > 0 || x.contiene)
    .sort((a, b) => b.puntaje - a.puntaje);

  if (!puntuados.length) return { ninguno: true };

  /* Solo se elige solo cuando gana con claridad. Si dos productos quedan
     parejos —"hamburguesa" con dos hamburguesas en la carta— se pregunta, en
     vez de venderle al cliente algo que no pidió. */
  const [mejor, segundo] = puntuados;
  if (!segundo || mejor.puntaje - segundo.puntaje >= 0.5) {
    return { producto: mejor.p };
  }

  const parejos = puntuados.filter((x) => mejor.puntaje - x.puntaje < 0.5);
  return { opciones: parejos.slice(0, 6).map((x) => x.p) };
}

/**
 * Buscar por algo vago: "pollo", "postres", "algo barato".
 *
 * `buscarProducto` está hecho para elegir UNO —es lo que hace falta al armar
 * un pedido— y ante la duda prefiere no elegir. Acá pasa lo contrario: se
 * quieren todos los que se parezcan, para poder enseñárselos.
 *
 * Busca también por categoría, porque "¿qué tienen de postres?" no nombra
 * ningún producto: nombra el grupo.
 */
/* Las cartas mezclan español e inglés —"Chicken McNuggets", "McPollo"— y el
   cliente pregunta en español. Sin esto, "¿qué tienen de pollo?" no encontraba
   los nuggets, que son pollo.
   Va solo en la búsqueda vaga: al armar un pedido se busca el nombre exacto y
   ampliar ahí traería productos que el cliente no nombró. */
const SINONIMOS = {
  pollo: ['chicken'],
  carne: ['beef', 'res'],
  queso: ['cheese'],
  papas: ['fries', 'french'],
  bebida: ['drink', 'soda', 'gaseosa', 'jugo', 'refresco'],
  bebidas: ['drink', 'soda', 'gaseosa', 'jugo', 'refresco'],
  postre: ['dessert', 'helado', 'flurry', 'sundae'],
  postres: ['dessert', 'helado', 'flurry', 'sundae'],
  hamburguesa: ['burger'],
  hamburguesas: ['burger'],
};

function buscarVarios(catalogo, texto, limite = 8) {
  const q = llano(texto);
  if (!q) return [];

  const partir = (s) => s.split(/\s+/).filter((w) => w.length > 2 || /^\d+$/.test(w));
  const palabras = [...partir(q)];
  // Se añaden los equivalentes, sin quitar lo que el cliente escribió.
  for (const w of [...palabras]) {
    if (SINONIMOS[w]) palabras.push(...SINONIMOS[w]);
  }
  if (!palabras.length) return [];

  return catalogo
    .map((p) => {
      const nombre = llano(p.name);
      const categoria = llano(p.category?.name || p.category || '');
      const descripcion = llano(p.description || '');
      const enNombre = palabras.filter((w) => nombre.includes(w)).length;
      /* Tres pesos distintos, de más a menos fiable. El nombre es lo que el
         negocio eligió llamar al plato; la categoría, dónde lo puso; la
         descripción, lo que lleva dentro —ahí está "tocineta" o "sin picante",
         que es como pregunta la gente, pero también palabras sueltas que
         aparecen en media carta. */
      const enCategoria = palabras.filter((w) => categoria.includes(w)).length;
      const enDescripcion = palabras.filter((w) => descripcion.includes(w)).length;
      return { p, puntaje: enNombre * 3 + enCategoria * 2 + enDescripcion };
    })
    .filter((x) => x.puntaje > 0)
    .sort((a, b) => b.puntaje - a.puntaje)
    .slice(0, limite)
    .map((x) => x.p);
}

/** ¿Se puede vender? El stock manda, no lo que crea el modelo. */
function hayExistencias(producto, cantidad, variante = null) {
  if (!producto.trackStock) return { ok: true };
  // Con variantes el stock es el de esa talla o fragancia, no el del producto.
  const stock = Number(variante ? variante.stock : producto.stock) || 0;
  if (stock >= cantidad) return { ok: true };
  return { ok: false, disponible: stock };
}

/* Tiendas: un producto con variantes no se puede agregar "a secas". Sin saber
   la talla no se sabe qué cobrar, qué descontar ni qué empacar, así que o el
   cliente ya la dijo en su mensaje ("la negra en M") o hay que preguntarle.
   Los valores se comparan por palabras sueltas: así "100 ml" casa con "100ml"
   y una talla "M" no se dispara dentro de cualquier palabra que lleve eme. */
function elegirVariante(producto, texto) {
  const ejes = (producto.opciones || []).filter(
    (e) => e && e.nombre && Array.isArray(e.valores) && e.valores.length,
  );
  if (!ejes.length) return { sinVariantes: true };

  const palabras = llano(texto || '').split(/[^a-z0-9]+/).filter(Boolean);
  const pegado = palabras.join('');
  const estaEnElTexto = (valor) => {
    const partes = llano(valor).split(/[^a-z0-9]+/).filter(Boolean);
    if (!partes.length) return false;
    return partes.every((parte) => palabras.includes(parte)) || pegado.includes(partes.join(''));
  };

  const elegidos = ejes.map((e) => e.valores.find(estaEnElTexto) || null);
  const falta = ejes.filter((_, i) => !elegidos[i]).map((e) => ({ nombre: e.nombre, valores: e.valores }));
  if (falta.length) return { falta };

  const activas = (producto.variantes || []).filter((v) => v && v.activo !== false && Array.isArray(v.valores));
  const hallada = activas.find(
    (v) => v.valores.length === elegidos.length &&
      v.valores.every((valor, i) => llano(valor) === llano(elegidos[i])),
  );
  // Las palabras existen pero el negocio no vende esa combinación (negro solo en M).
  if (!hallada) return { falta: ejes.map((e) => ({ nombre: e.nombre, valores: e.valores })), inexistente: true };

  return { variante: hallada };
}

/**
 * Agrega al carrito leyendo el precio de la base, nunca del mensaje.
 */
async function agregar(sesion, catalogo, { producto: nombre, cantidad = 1, nota = '' }) {
  const cant = Math.max(1, Math.min(50, Number(cantidad) || 1));
  const hallazgo = buscarProducto(catalogo, nombre);

  if (hallazgo.ninguno) {
    return { ok: false, motivo: 'no_existe', pedido: nombre };
  }
  if (hallazgo.opciones) {
    return { ok: false, motivo: 'ambiguo', opciones: hallazgo.opciones.map((p) => p.name) };
  }

  const p = hallazgo.producto;

  /* La variante se busca en lo que escribió el cliente, no en el nombre que
     resolvió el buscador: ahí es donde viene "la de 100 ml". */
  const eleccion = elegirVariante(p, `${nombre || ''} ${nota || ''}`);
  if (eleccion.falta) {
    return {
      ok: false,
      motivo: 'variante',
      producto: p.name,
      falta: eleccion.falta,
      inexistente: !!eleccion.inexistente,
    };
  }
  const variante = eleccion.variante || null;
  const etiqueta = variante ? `${p.name} (${variante.valores.join(' · ')})` : p.name;
  const precioLinea = variante && variante.precio != null ? Number(variante.precio) : (Number(p.price) || 0);

  const mismaLinea = (i) => String(i.productId) === String(p._id) &&
    (variante
      ? Array.isArray(i.variante?.valores) && i.variante.valores.join('|') === variante.valores.join('|')
      : !i.variante);
  const yaTiene = (sesion.items || []).find(mismaLinea);
  const cantidadFinal = (yaTiene?.quantity || 0) + cant;

  const stock = hayExistencias(p, cantidadFinal, variante);
  if (!stock.ok) {
    return { ok: false, motivo: 'sin_stock', producto: etiqueta, disponible: stock.disponible };
  }

  /* La nota del cliente ("sin salsas", "bien cocida") se guarda en la línea.
     Antes se perdía: el agente la repetía de vuelta como si la hubiera tomado
     pero no quedaba en ninguna parte, así que a la cocina no le llegaba. */
  const limpiaNota = String(nota || '').slice(0, 120).trim();

  if (yaTiene) {
    yaTiene.quantity = cantidadFinal;
    /* La misma indicación no se apunta dos veces. Cuando el pedido se
       multiplicaba solo, la nota quedaba "sin salsas; sin salsas; sin salsas" y
       eso es lo que iba a llegarle a la cocina. */
    const yaDicha = llano(yaTiene.note || '').split(';').map((s) => s.trim());
    if (limpiaNota && !yaDicha.includes(llano(limpiaNota))) {
      yaTiene.note = yaTiene.note ? `${yaTiene.note}; ${limpiaNota}` : limpiaNota;
    }
  } else {
    sesion.items.push({
      productId: p._id,
      name: etiqueta,
      price: precioLinea,   // el precio sale de la base, y de la variante si la hay
      quantity: cant,
      note: limpiaNota,
      ...(variante ? { variante: { valores: variante.valores, sku: variante.sku || '' } } : {}),
    });
  }

  return { ok: true, producto: etiqueta, cantidad: cant, precio: precioLinea, nota: limpiaNota };
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
  const actuales = await Product.find({ _id: { $in: ids }, businessId })
    .select('name price stock trackStock opciones variantes')
    .lean();
  const porId = new Map(actuales.map((p) => [String(p._id), p]));

  const items = [];
  for (const linea of sesion.items) {
    const p = porId.get(String(linea.productId));
    if (!p) return { ok: false, motivo: 'producto_desaparecido', producto: linea.name };

    /* La línea guarda qué combinación pidió el cliente; el precio y el stock
       se releen de la variante por si el negocio los cambió mientras hablaban. */
    const combinacion = linea.variante && linea.variante.valores;
    const variante = Array.isArray(combinacion)
      ? (p.variantes || []).find(
          (v) => Array.isArray(v.valores) && v.valores.length === combinacion.length &&
            v.valores.every((valor, i) => llano(valor) === llano(combinacion[i])),
        )
      : null;
    if (Array.isArray(combinacion) && !variante) {
      return { ok: false, motivo: 'producto_desaparecido', producto: linea.name };
    }

    const stock = hayExistencias(p, linea.quantity, variante);
    if (!stock.ok) {
      return { ok: false, motivo: 'sin_stock', producto: linea.name, disponible: stock.disponible };
    }

    const precio = variante && variante.precio != null ? Number(variante.precio) : (Number(p.price) || 0);
    items.push({
      productId: p._id,
      name: linea.name,
      price: precio,
      totalPrice: precio,
      quantity: linea.quantity,
      selectedToppings: [],
      ...(variante ? { variante: { valores: variante.valores, sku: variante.sku || '' } } : {}),
    });
  }

  const totalAmount = items.reduce((s, i) => s + i.price * i.quantity, 0);

  /* Las notas por producto se suman a las del pedido. La cocina lee una sola
     nota, así que "sin salsas" tiene que decir a qué plato se refiere. */
  const notasPorProducto = sesion.items
    .filter((i) => i.note)
    .map((i) => `${i.name}: ${i.note}`);
  const notas = [sesion.notes, ...notasPorProducto].filter(Boolean).join(' · ');

  const pedido = await crearOrden({
    businessId,
    customerName: sesion.customerName,
    phone: sesion.contactPhone,
    orderType: sesion.orderType,
    address: sesion.orderType === 'delivery' ? sesion.address : undefined,
    customerNotes: notas || undefined,
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

/* Cómo se le explica al cliente en qué va su pedido. El agente no inventa
   tiempos: dice el estado y ya. */
const COMO_VA = {
  pending: '📝 Lo tenemos anotado, ya lo confirmamos.',
  pending_payment: '⏳ Estamos esperando el pago para empezarlo.',
  payment_uploaded: '🔎 Estamos verificando tu pago.',
  payment_confirmed: '✅ Pago confirmado, ya entra a cocina.',
  confirmed: '✅ Confirmado, ya entra a cocina.',
  preparing: '👨‍🍳 Lo estamos preparando.',
  inProgress: '👨‍🍳 Lo estamos preparando.',
  ready: '🛍️ ¡Ya está listo!',
  completed: '✅ Este pedido ya se entregó.',
  delivered: '✅ Este pedido ya se entregó.',
  cancelled: '❌ Este pedido fue cancelado.',
};

/**
 * En qué va el último pedido de quien escribe.
 *
 * Es de lo que más preguntan, y hasta ahora el agente no tenía cómo saberlo:
 * o lo pasaba a una persona o se lo inventaba. Busca por teléfono en todos los
 * formatos en que puede estar guardado (ver utils/phoneVariants).
 */
async function estadoDelPedido({ businessId, contactPhone, Order, CompletedOrder, variantes }) {
  const filtro = { businessId, phone: { $in: variantes(contactPhone) } };

  const [activo, terminado] = await Promise.all([
    Order.findOne(filtro).sort({ createdAt: -1 }).select('orderNumber status createdAt').lean(),
    CompletedOrder.findOne(filtro).sort({ completedAt: -1 }).select('orderNumber status completedAt').lean(),
  ]);

  // El que esté en curso manda: es por el que están preguntando.
  const pedido = activo || terminado;
  if (!pedido) return { ok: false, motivo: 'sin_pedidos' };

  return {
    ok: true,
    orderNumber: pedido.orderNumber,
    status: pedido.status,
    enCurso: !!activo,
    texto: COMO_VA[pedido.status] || 'Lo estamos gestionando.',
  };
}

module.exports = {
  llano,
  buscarProducto,
  buscarVarios,
  estadoDelPedido,
  COMO_VA,
  hayExistencias,
  agregar,
  quitar,
  fijarTipo,
  fijarDatos,
  queFalta,
  crearPedido,
};
