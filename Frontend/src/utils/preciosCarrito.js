/**
 * Volver a ponerle precio al carrito cuando el menú cambia debajo.
 *
 * El problema que esto cierra: el cliente abre el menú, arma el carrito, y
 * mientras tanto el dueño edita un precio desde el panel. Al confirmar, el
 * servidor recalcula el total con los precios de ahora, no cuadra con el que
 * mandó el cliente, y el pedido se rechaza con un "recarga la página" que el
 * cliente no entiende. El 22/09/2026 le pasó a un cliente de cocina-vital
 * trece minutos después de una edición: en vez de recargar, rehizo el pedido
 * más barato y el negocio perdió la diferencia.
 *
 * Las cuentas de acá tienen que dar **exactamente** lo mismo que
 * `Backend/utils/orderPricing.js`, que es quien decide si el pedido pasa. Si
 * las dos se separan, el cliente ve un total que el servidor no acepta, que
 * es justo el problema que esto viene a resolver. Al tocar una, toca revisar
 * la otra.
 */

/**
 * Lo que vale una unidad del producto con los toppings que eligió el cliente.
 *
 * Igual que el servidor: parte del precio del producto en la base y suma lo
 * que encuentre por **nombre**. Un grupo o una opción que ya no exista suma
 * cero, sin inventarse el precio que traía el carrito.
 *
 * @param {object} producto el producto fresco, con `toppingGroups` poblados
 * @param {Array} seleccionados `item.selectedToppings`
 * @returns {number}
 */
export function precioUnitario(producto, seleccionados) {
  let precio = Number(producto?.price) || 0;
  const grupos = producto?.toppingGroups || [];

  for (const elegido of seleccionados || []) {
    const grupo = grupos.find((g) => g.name === elegido.groupName);
    if (!grupo) continue;

    if (typeof grupo.basePrice === 'number') precio += grupo.basePrice;

    if (elegido.optionName) {
      const opcion = (grupo.options || []).find((o) => o.name === elegido.optionName);
      if (opcion?.price) precio += opcion.price;
    }

    for (const sub of elegido.subGroups || []) {
      const subGrupo = (grupo.subGroups || []).find((sg) => sg.title === sub.subGroupTitle);
      if (!subGrupo || !sub.optionName) continue;
      const opcionSub = (subGrupo.options || []).find((o) => o.name === sub.optionName);
      if (opcionSub?.price) precio += opcionSub.price;
    }
  }

  return precio;
}

/**
 * El carrito con los precios de ahora.
 *
 * Reescribe también los precios guardados dentro de `selectedToppings`, no
 * solo el del producto: el total del carrito y el pedido que se envía se
 * calculan a partir de esa copia, así que dejarla vieja sería arreglar el
 * número de la pantalla y seguir mandando el equivocado.
 *
 * Solo toca las líneas cuyo producto venga en `productos`. Una lista parcial
 * —por ejemplo si el catálogo no trae los desactivados— no puede hacer que
 * una línea se quede en cero.
 *
 * @param {Array} carrito
 * @param {Array} productos el catálogo fresco
 * @returns {{carrito: Array, cambios: Array<{nombre: string, antes: number, despues: number}>}}
 */
export function resincronizarCarrito(carrito, productos) {
  const porId = new Map((productos || []).map((p) => [String(p._id), p]));
  const cambios = [];

  const nuevo = (carrito || []).map((item) => {
    /* Los premios de fidelización valen cero por definición: los puntos ya se
       descontaron. El servidor también los salta. */
    if (item.isLoyaltyReward) return item;

    const producto = porId.get(String(item._id));
    if (!producto) return item;

    const antes = (Number(item.finalPrice ?? item.price) || 0)
      + sumaDeToppings(item.selectedToppings);
    const despues = precioUnitario(producto, item.selectedToppings);

    if (antes === despues) return item;

    cambios.push({ nombre: item.name, antes, despues });

    /* `finalPrice` sale del objeto: el carrito lo prefiere sobre `price`, así
       que dejarlo con el valor viejo haría que el recálculo no se note. */
    const { finalPrice, ...resto } = item;

    return {
      ...resto,
      price: producto.price,
      selectedToppings: conPreciosFrescos(producto, item.selectedToppings),
    };
  });

  return { carrito: nuevo, cambios };
}

/** Lo que el carrito creía que costaban los toppings de una línea. */
function sumaDeToppings(seleccionados) {
  let suma = 0;
  for (const t of seleccionados || []) {
    suma += Number(t.basePrice) || 0;
    suma += Number(t.price) || 0;
    for (const sub of t.subGroups || []) suma += Number(sub.price) || 0;
  }
  return suma;
}

/** La misma selección, con los precios que tiene hoy el producto. */
function conPreciosFrescos(producto, seleccionados) {
  const grupos = producto?.toppingGroups || [];

  return (seleccionados || []).map((elegido) => {
    const grupo = grupos.find((g) => g.name === elegido.groupName);
    if (!grupo) return { ...elegido, basePrice: 0, price: 0, subGroups: (elegido.subGroups || []).map((s) => ({ ...s, price: 0 })) };

    const opcion = elegido.optionName
      ? (grupo.options || []).find((o) => o.name === elegido.optionName)
      : null;

    return {
      ...elegido,
      basePrice: typeof grupo.basePrice === 'number' ? grupo.basePrice : 0,
      price: opcion?.price || 0,
      subGroups: (elegido.subGroups || []).map((sub) => {
        const subGrupo = (grupo.subGroups || []).find((sg) => sg.title === sub.subGroupTitle);
        const opcionSub = subGrupo && sub.optionName
          ? (subGrupo.options || []).find((o) => o.name === sub.optionName)
          : null;
        return { ...sub, price: opcionSub?.price || 0 };
      }),
    };
  });
}
