/**
 * Cuánto se gana de verdad: ventas menos lo que costó lo vendido.
 *
 * Las piezas ya existían —el costo de cada producto, las recetas con el costo
 * de sus insumos, y todas las ventas de la caja y del menú— pero ningún
 * informe las juntaba. El dueño sabía cuánto vendía, no cuánto ganaba, ni
 * qué productos le dejaban margen y cuáles solo movían plata.
 *
 * Todo aquí es puro, para probarlo sin base de datos. Dos decisiones:
 *
 * - **Sin costo no se inventa.** Un producto sin costo registrado no entra en
 *   el margen —daría 100 % y lo inflaría— y se lista aparte para que el dueño
 *   lo complete. El margen se calcula solo sobre lo que tiene costo.
 * - **Los precios llevan el impuesto adentro**, como se cobran en Colombia. El
 *   margen es sobre lo cobrado; la pantalla lo dice.
 */

/**
 * El costo de una unidad de un producto.
 *
 * Primero la receta: si todos sus insumos tienen costo, el producto cuesta la
 * suma. Una receta a medio costear no se usa —faltaría plata— y se cae al
 * costo del producto. La variante (talla, tamaño) manda sobre el producto si
 * tiene el suyo.
 *
 * @returns {number|null} null = no se sabe cuánto cuesta.
 */
function costoUnitario(producto, costoInsumo, valoresVariante = []) {
  if (!producto) return null;

  if (valoresVariante.length && Array.isArray(producto.variantes)) {
    const v = producto.variantes.find((x) =>
      Array.isArray(x.valores) && x.valores.length === valoresVariante.length
      && x.valores.every((val, i) => String(val) === String(valoresVariante[i])));
    if (v && typeof v.costo === 'number') return v.costo;
  }

  const receta = Array.isArray(producto.recipe) ? producto.recipe : [];
  if (receta.length) {
    let suma = 0;
    let completa = true;
    for (const r of receta) {
      const c = costoInsumo[String(r.supplyId)];
      if (typeof c !== 'number') { completa = false; break; }
      suma += c * (Number(r.quantity) || 0);
    }
    if (completa) return Math.round(suma);
  }

  return typeof producto.cost === 'number' ? producto.cost : null;
}

const margen = (utilidad, ventas) => (ventas > 0 ? Math.round((utilidad / ventas) * 1000) / 10 : 0);

/**
 * El informe de un periodo.
 *
 * @param {object[]} pedidos    pedidos completados (caja y menú)
 * @param {object}   productos  por id: { name, category, cost, recipe, variantes }
 * @param {object}   costoInsumo por id de insumo: costo de una unidad
 * @param {object}   categorias por id: nombre
 */
function calcular(pedidos, productos, costoInsumo, categorias = {}) {
  const porProducto = {};
  let ventasLineas = 0;
  let descuentos = 0;
  let conCostoVentas = 0;
  let costo = 0;
  let sinCostoVentas = 0;

  for (const p of pedidos) {
    descuentos += Number(p.discountAmount) || 0;
    for (const it of p.items || []) {
      const cantidad = Number(it.quantity) || 0;
      const ingreso = (Number(it.price) || 0) * cantidad;
      const id = it.productId ? String(it.productId) : '';
      const prod = productos[id];
      const valores = it.variante?.valores || [];
      const unitario = costoUnitario(prod, costoInsumo, valores);
      const clave = id || `libre:${it.name}`;

      const fila = porProducto[clave] || {
        productoId: id || null,
        nombre: prod?.name || it.name || 'Sin nombre',
        categoria: (prod && categorias[String(prod.category)]) || 'Sin categoría',
        cantidad: 0,
        ventas: 0,
        costo: 0,
        conCosto: unitario !== null,
      };
      fila.cantidad += cantidad;
      fila.ventas += ingreso;
      ventasLineas += ingreso;

      if (unitario !== null) {
        /* Un regalo de puntos se entrega igual: no ingresa nada pero cuesta. */
        const c = unitario * cantidad;
        fila.costo += c;
        costo += c;
        conCostoVentas += ingreso;
      } else {
        fila.conCosto = false;
        sinCostoVentas += ingreso;
      }
      porProducto[clave] = fila;
    }
  }

  const productosLista = Object.values(porProducto).map((f) => ({
    ...f,
    utilidad: f.conCosto ? f.ventas - f.costo : null,
    margen: f.conCosto ? margen(f.ventas - f.costo, f.ventas) : null,
  }));

  const porCategoria = {};
  for (const f of productosLista.filter((x) => x.conCosto)) {
    const c = porCategoria[f.categoria] || { categoria: f.categoria, ventas: 0, costo: 0 };
    c.ventas += f.ventas;
    c.costo += f.costo;
    porCategoria[f.categoria] = c;
  }

  /* Los descuentos se reparten sobre lo que tiene costo en la misma
     proporción que pesa en las ventas: si el 80 % de lo vendido tiene costo,
     el 80 % del descuento le toca a ese margen. */
  const parteDescuento = ventasLineas > 0 ? descuentos * (conCostoVentas / ventasLineas) : 0;
  const utilidad = conCostoVentas - parteDescuento - costo;

  return {
    ventas: ventasLineas,
    descuentos,
    ventasNetas: ventasLineas - descuentos,
    costo,
    utilidad: Math.round(utilidad),
    margen: margen(utilidad, conCostoVentas - parteDescuento),
    /* Qué parte de lo vendido tiene costo: si es poca, el margen dice poco. */
    cobertura: ventasLineas > 0 ? Math.round((conCostoVentas / ventasLineas) * 100) : 0,
    sinCostoVentas,
    productos: productosLista.sort((a, b) => (b.utilidad ?? -Infinity) - (a.utilidad ?? -Infinity)),
    categorias: Object.values(porCategoria)
      .map((c) => ({ ...c, utilidad: c.ventas - c.costo, margen: margen(c.ventas - c.costo, c.ventas) }))
      .sort((a, b) => b.utilidad - a.utilidad),
    sinCosto: productosLista.filter((f) => !f.conCosto).sort((a, b) => b.ventas - a.ventas),
  };
}

module.exports = { costoUnitario, calcular };
