/**
 * Las reglas del POS nativo, sin base de datos de por medio.
 *
 * Dos trabajos:
 *
 * 1. **Revisar lo que sube la caja.** La caja ya cobró: el servidor no puede
 *    "corregir" precios ni recalcular totales contra su catálogo, porque el
 *    cliente ya pagó lo que decía la tirilla. Lo que sí hace es comprobar que
 *    la venta sea internamente coherente —que el total sea la suma de sus
 *    líneas— y rechazar lo que no cuadre, que es corrupción o un error nuestro,
 *    no una diferencia de precios.
 *
 * 2. **Aplanar el catálogo.** En el menú, una camiseta es un producto con
 *    tallas. En una caja, "Camiseta · M" es un botón. Un producto con variantes
 *    baja como varias filas, cada una con su precio y su referencia.
 */

/** Lo máximo que se acepta en una sola venta. Más que esto es un bug. */
const MAX_LINEAS = 200;
const MAX_CANTIDAD = 9999;

/**
 * Valida el payload que manda el POS.
 * Devuelve `{ ok: true, venta }` o `{ ok: false, error }`.
 */
function validarVenta(cuerpo) {
  if (!cuerpo || typeof cuerpo !== 'object') {
    return { ok: false, error: 'Venta vacía' };
  }

  /* El id lo genera la caja (UUIDv7) y es la llave de idempotencia: sin él no
     hay forma de saber si un reintento es la misma venta u otra. */
  const id = String(cuerpo.id || '').trim();
  if (id.length < 8 || id.length > 64) {
    return { ok: false, error: 'La venta no trae un id válido' };
  }

  const lineas = Array.isArray(cuerpo.items) ? cuerpo.items : [];
  if (!lineas.length) return { ok: false, error: 'La venta no trae líneas' };
  if (lineas.length > MAX_LINEAS) return { ok: false, error: 'Demasiadas líneas en una venta' };

  const items = [];
  let suma = 0;

  for (const linea of lineas) {
    const cantidad = Number(linea?.cantidad);
    const precio = Number(linea?.precio);
    const nombre = String(linea?.nombre || '').trim();

    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_CANTIDAD) {
      return { ok: false, error: `Cantidad inválida en "${nombre || 'una línea'}"` };
    }
    if (!Number.isFinite(precio) || precio < 0) {
      return { ok: false, error: `Precio inválido en "${nombre || 'una línea'}"` };
    }
    if (!nombre) return { ok: false, error: 'Hay una línea sin nombre de producto' };

    suma += precio * cantidad;
    items.push({
      productId: linea.producto_id || null,
      name: nombre,
      variante: linea.variante ? { valores: [String(linea.variante)], sku: '' } : undefined,
      price: precio,
      quantity: cantidad,
    });
  }

  const total = Number(cuerpo.total);
  if (!Number.isFinite(total) || total < 0) {
    return { ok: false, error: 'La venta no trae un total válido' };
  }

  /* Que el total no cuadre con sus líneas no es una diferencia de precios: es
     un payload corrupto o un error de cálculo. Se rechaza para que no entre a
     los informes del negocio como una venta "rara" que nadie explica. */
  if (Math.round(suma) !== Math.round(total)) {
    return { ok: false, error: `El total (${total}) no cuadra con las líneas (${suma})` };
  }

  return {
    ok: true,
    venta: {
      id,
      consecutivo: Number(cuerpo.consecutivo) || 0,
      total,
      iva: Math.max(0, Number(cuerpo.iva) || 0),
      medioPago: String(cuerpo.medio_pago || 'efectivo').slice(0, 30),
      cajero: String(cuerpo.cajero || '').slice(0, 80),
      turnoId: String(cuerpo.turno_id || '').slice(0, 64),
      creadaEn: cuerpo.creada_en ? new Date(cuerpo.creada_en) : new Date(),
      items,
      /* El voucher del datáfono, cuando se cobró con tarjeta. Es lo que permite
         cuadrar la pila de vouchers de papel contra las ventas del turno; sin
         los últimos cuatro y el código de aprobación, ese cuadre es a ojo. */
      pago: cuerpo.pago && cuerpo.pago.aprobada
        ? {
            autorizacion: String(cuerpo.pago.codigo_autorizacion || '').slice(0, 20),
            ultimosCuatro: String(cuerpo.pago.ultimos_cuatro || '').slice(0, 4),
            franquicia: String(cuerpo.pago.franquicia || '').slice(0, 30),
          }
        : null,
    },
  };
}

/**
 * Convierte productos de MenuBy en filas vendibles para la caja.
 *
 * Un producto sin variantes es una fila. Uno con variantes baja como una fila
 * por combinación activa, con id compuesto (`<producto>:<valores>`), que es lo
 * que la caja usa como llave primaria local.
 *
 * Los inactivos **también bajan**, marcados. Si solo se mandaran los activos,
 * un producto que el negocio apagó se quedaría para siempre en la caja y se
 * seguiría vendiendo lo que ya no se vende.
 */
function aplanarCatalogo(productos, categoriasPorId = {}) {
  const filas = [];

  for (const p of productos) {
    const actualizado = (p.updatedAt || p.createdAt || new Date()).toISOString();
    const categoria = categoriasPorId[String(p.category)] || '';
    const activoProducto = p.active !== false;

    const variantes = Array.isArray(p.variantes) ? p.variantes : [];

    if (!variantes.length) {
      filas.push({
        id: String(p._id),
        nombre: p.name,
        precio: Math.round(Number(p.price) || 0),
        categoria,
        sku: p.sku || '',
        variante: '',
        activo: activoProducto,
        actualizado,
      });
      continue;
    }

    for (const v of variantes) {
      const valores = Array.isArray(v.valores) ? v.valores : [];
      if (!valores.length) continue;

      filas.push({
        id: `${p._id}:${valores.join('|')}`,
        nombre: p.name,
        // El precio de la variante manda; vacío hereda el del producto.
        precio: Math.round(
          v.precio === null || v.precio === undefined || v.precio === ''
            ? Number(p.price) || 0
            : Number(v.precio) || 0,
        ),
        categoria,
        sku: v.sku || p.sku || '',
        variante: valores.join(' · '),
        // Una talla apagada tampoco se vende, aunque el producto esté activo.
        activo: activoProducto && v.activo !== false,
        actualizado,
      });
    }
  }

  return filas;
}

/**
 * Valida el arqueo que sube la caja al cerrar un turno.
 *
 * El conteo y el esperado vienen calculados de la caja —que es donde están las
 * ventas, incluidas las que se hicieron sin internet— y aquí se comprueba que
 * la aritmética cuadre. Si el servidor recalculara el esperado con lo que
 * alcanzó a subir, un turno con ventas todavía en cola saldría con un faltante
 * enorme que no existe, y alguien terminaría acusado de robar.
 */
function validarCierre(cuerpo) {
  if (!cuerpo || typeof cuerpo !== 'object') return { ok: false, error: 'Cierre vacío' };

  const turnoId = String(cuerpo.turno_id || '').trim();
  if (turnoId.length < 8 || turnoId.length > 64) {
    return { ok: false, error: 'El cierre no trae un turno válido' };
  }

  const numero = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  const campos = {
    fondoInicial: numero(cuerpo.fondo_inicial),
    ventasEfectivo: numero(cuerpo.ventas_efectivo),
    ventasOtros: numero(cuerpo.ventas_otros),
    entradas: numero(cuerpo.entradas),
    salidas: numero(cuerpo.salidas),
    esperado: numero(cuerpo.esperado),
    contado: numero(cuerpo.contado),
    diferencia: numero(cuerpo.diferencia),
  };

  for (const [nombre, valor] of Object.entries(campos)) {
    if (valor === null) return { ok: false, error: `Falta o es inválido: ${nombre}` };
  }
  if (campos.contado < 0 || campos.fondoInicial < 0) {
    return { ok: false, error: 'Hay montos negativos donde no puede haberlos' };
  }

  const esperadoCalculado =
    campos.fondoInicial + campos.ventasEfectivo + campos.entradas - campos.salidas;

  if (Math.round(esperadoCalculado) !== Math.round(campos.esperado)) {
    return { ok: false, error: 'El esperado no cuadra con el fondo, las ventas y los movimientos' };
  }
  if (Math.round(campos.contado - campos.esperado) !== Math.round(campos.diferencia)) {
    return { ok: false, error: 'La diferencia no cuadra con el conteo' };
  }

  return {
    ok: true,
    cierre: {
      turnoId,
      cajero: String(cuerpo.cajero || '').slice(0, 80),
      abiertoEn: cuerpo.abierto_en ? new Date(cuerpo.abierto_en) : new Date(),
      cerradoEn: cuerpo.cerrado_en ? new Date(cuerpo.cerrado_en) : new Date(),
      ventas: Math.max(0, parseInt(cuerpo.ventas, 10) || 0),
      ...campos,
    },
  };
}

/** Los tipos de excepción que la caja puede reportar. */
const TIPOS_EXCEPCION = ['anular_item', 'descuento', 'abrir_cajon', 'descartar_pausada'];

/**
 * Valida una excepción del mostrador.
 *
 * Lo estricto aquí es el **motivo** y, cuando la operación lo exige, **quién
 * autorizó**. Una anulación sin motivo no es un registro: es una línea que
 * desapareció, que es exactamente lo que este sistema existe para impedir.
 */
function validarExcepcion(cuerpo) {
  if (!cuerpo || typeof cuerpo !== 'object') return { ok: false, error: 'Excepción vacía' };

  const id = String(cuerpo.id || '').trim();
  if (id.length < 8 || id.length > 64) {
    return { ok: false, error: 'La excepción no trae un id válido' };
  }

  const tipo = String(cuerpo.tipo || '').trim();
  if (!TIPOS_EXCEPCION.includes(tipo)) {
    return { ok: false, error: 'Tipo de excepción desconocido' };
  }

  const motivo = String(cuerpo.motivo || '').trim();
  const autorizo = String(cuerpo.autorizo || '').trim();

  /* Anular y descontar mueven plata: sin motivo ni autorización no se aceptan.
     Abrir el cajón se registra igual pero no exige ninguna de las dos, porque
     pedir un supervisor para dar un cambio paraliza la fila. */
  const exigente = tipo === 'anular_item' || tipo === 'descuento';
  if (exigente && motivo.length < 3) {
    return { ok: false, error: 'Una anulación o un descuento tienen que decir por qué' };
  }
  if (exigente && !autorizo) {
    return { ok: false, error: 'Falta quién autorizó la operación' };
  }

  return {
    ok: true,
    excepcion: {
      id,
      turnoId: String(cuerpo.turno_id || '').slice(0, 64),
      tipo,
      detalle: String(cuerpo.detalle || '').slice(0, 200),
      monto: Math.max(0, Number(cuerpo.monto) || 0),
      motivo: motivo.slice(0, 200),
      cajero: String(cuerpo.cajero || '').slice(0, 80),
      autorizo: autorizo.slice(0, 80),
      // La hora del mostrador, no la del servidor: puede llegar dos días tarde.
      ocurridaEn: cuerpo.creada_en ? new Date(cuerpo.creada_en) : new Date(),
    },
  };
}

module.exports = {
  validarVenta,
  validarCierre,
  validarExcepcion,
  aplanarCatalogo,
  TIPOS_EXCEPCION,
  MAX_LINEAS,
  MAX_CANTIDAD,
};
