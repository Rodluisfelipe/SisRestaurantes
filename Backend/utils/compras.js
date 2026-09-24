/**
 * Las reglas de una compra, sin base de datos de por medio.
 */

const numero = (v) => (Number.isFinite(Number(v)) ? Number(v) : NaN);

/**
 * Valida lo que manda el panel al registrar una compra.
 *
 * Los totales se calculan aquí y no se aceptan del cliente: un total que no
 * cuadra con sus líneas es un error de tecleo que después descuadra la cuenta
 * con el proveedor.
 */
function validarCompra(cuerpo) {
  const c = cuerpo && typeof cuerpo === 'object' ? cuerpo : {};
  if (!c.proveedorId) return { ok: false, error: 'Falta el proveedor' };
  const lineas = [];
  for (const l of Array.isArray(c.lineas) ? c.lineas : []) {
    const cantidad = numero(l?.cantidad);
    const costoUnitario = numero(l?.costoUnitario);
    if (!['insumo', 'producto'].includes(l?.tipo) || !l?.refId) return { ok: false, error: 'Hay una línea sin producto' };
    if (!(cantidad > 0)) return { ok: false, error: `La cantidad de "${l.nombre || 'una línea'}" no es válida` };
    if (!(costoUnitario >= 0)) return { ok: false, error: `El costo de "${l.nombre || 'una línea'}" no es válido` };
    lineas.push({
      tipo: l.tipo,
      refId: String(l.refId),
      nombre: String(l.nombre || '').trim().slice(0, 80) || 'Sin nombre',
      unidad: String(l.unidad || '').slice(0, 20),
      cantidad,
      costoUnitario: Math.round(costoUnitario),
      subtotal: Math.round(cantidad * costoUnitario),
    });
  }
  if (!lineas.length) return { ok: false, error: 'La compra no tiene líneas' };
  if (lineas.length > 200) return { ok: false, error: 'Máximo 200 líneas por compra' };

  const total = lineas.reduce((t, l) => t + l.subtotal, 0);
  const pagado = Math.min(total, Math.max(0, Math.round(numero(c.pagado) || 0)));
  return {
    ok: true,
    compra: {
      proveedorId: String(c.proveedorId),
      factura: String(c.factura || '').trim().slice(0, 40),
      fecha: c.fecha ? new Date(c.fecha) : new Date(),
      lineas,
      total,
      pagado,
      saldo: total - pagado,
      medioPago: String(c.medioPago || 'efectivo').slice(0, 20),
      notas: String(c.notas || '').trim().slice(0, 300),
    },
  };
}

/**
 * Cuánto pedir de algo que está por acabarse.
 *
 * Llevarlo al doble del mínimo: con el mínimo como punto de alarma, pedir
 * hasta el doble deja margen para la próxima entrega sin llenar la bodega.
 */
function sugerido(stock, minimo) {
  const s = Math.max(0, Number(stock) || 0);
  const m = Math.max(0, Number(minimo) || 0);
  if (m <= 0 || s > m) return 0;
  return Math.max(m, m * 2 - s);
}

module.exports = { validarCompra, sugerido };
