/**
 * Las decisiones de una devolución, sin base de datos de por medio.
 *
 * Qué se puede devolver, a qué precio y cuánta plata se mueve son reglas, no
 * consultas. Separarlas de la ruta permite probarlas de verdad: cada caso feo
 * —devolver dos veces la misma talla, mandar un precio inflado, cambiar una M
 * por una L del mismo producto— es una prueba de tres líneas.
 */

/** La combinación identifica la línea: la misma camiseta en M y en L son dos. */
function mismaLinea(a, b) {
  if (String(a?.productId || '') !== String(b?.productId || '')) return false;
  const va = (a?.variante?.valores || []).map((v) => String(v).toLowerCase()).join('|');
  const vb = (b?.variante?.valores || []).map((v) => String(v).toLowerCase()).join('|');
  return va === vb;
}

/**
 * Convierte lo que pide el panel en líneas de devolución confiables.
 *
 * @param pedido      el pedido original, o null si no hay respaldo
 * @param yaDevueltas líneas devueltas antes en ese mismo pedido
 * @param solicitadas lo que el panel quiere devolver ahora
 *
 * El precio siempre sale del pedido: si llegara del panel, devolver una
 * camiseta de 40.000 por 400.000 sería cuestión de editar un número.
 */
function validarLineas(pedido, yaDevueltas, solicitadas) {
  const items = [];

  for (const linea of solicitadas || []) {
    const cantidad = parseInt(linea?.quantity, 10);
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      return { ok: false, error: 'Cantidad inválida' };
    }

    /* Sin pedido de respaldo (una venta de mostrador vieja, un pedido ya
       depurado) se acepta lo que mande el panel: exige sesión del negocio y es
       preferible a no poder registrar la devolución. */
    if (!pedido) {
      items.push({
        productId: linea.productId || null,
        name: String(linea.name || 'Producto').slice(0, 200),
        variante: linea.variante?.valores?.length ? linea.variante : undefined,
        quantity: cantidad,
        price: Math.max(0, Number(linea.price) || 0),
      });
      continue;
    }

    const enPedido = (pedido.items || []).find((i) => mismaLinea(i, linea));
    if (!enPedido) {
      return { ok: false, error: `"${linea.name || 'Ese producto'}" no está en el pedido` };
    }

    const vendidas = Number(enPedido.quantity) || 0;
    const antes = (yaDevueltas || [])
      .filter((d) => mismaLinea(d, linea))
      .reduce((t, d) => t + (Number(d.quantity) || 0), 0);

    if (antes + cantidad > vendidas) {
      return {
        ok: false,
        error: `De "${enPedido.name}" se vendieron ${vendidas} y ya se devolvieron ${antes}`,
      };
    }

    items.push({
      productId: enPedido.productId || null,
      name: enPedido.name,
      variante: enPedido.variante?.valores?.length ? enPedido.variante : undefined,
      quantity: cantidad,
      price: Number(enPedido.price) || 0,   // el precio sale del pedido
    });
  }

  return { ok: true, items };
}

/** Normaliza lo que el cliente se lleva a cambio. */
function normalizarCambio(cambioPor) {
  return (Array.isArray(cambioPor) ? cambioPor : []).slice(0, 20).map((l) => ({
    productId: l?.productId || null,
    name: String(l?.name || 'Producto').slice(0, 200),
    variante: l?.variante?.valores?.length ? l.variante : undefined,
    quantity: Math.max(1, parseInt(l?.quantity, 10) || 1),
    price: Math.max(0, Number(l?.price) || 0),
  }));
}

const valorDe = (lineas) => (lineas || []).reduce(
  (t, i) => t + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0,
);

/**
 * La plata que mueve la operación.
 *
 * En una devolución es lo que se le regresa al cliente. En un cambio es la
 * diferencia: positiva si le toca completar, negativa si se le devuelve algo.
 * Un cambio parejo —misma camiseta, otra talla— da cero, que es exactamente lo
 * que debe cobrarse.
 */
function calcularPlata(tipo, items, cambioPor) {
  const valor = valorDe(items);
  if (tipo === 'cambio') {
    return { montoDevuelto: 0, diferencia: valorDe(cambioPor) - valor };
  }
  return { montoDevuelto: valor, diferencia: 0 };
}

module.exports = { mismaLinea, validarLineas, normalizarCambio, calcularPlata, valorDe };
