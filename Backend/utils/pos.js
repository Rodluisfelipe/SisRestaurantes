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

    /* El catálogo baja aplanado y cada fila vendible trae un id compuesto:
       el id del producto, dos puntos, y los valores de la variante separados
       por barra. Aquí se vuelve a partir, porque el inventario vive en el
       producto y en su variante, no en esa fila.

       Sin esto, el id compuesto llegaba entero a Product.findById, reventaba
       como ObjectId inválido y —al estar dentro del try de moverStock— el
       error se tragaba: la venta entraba bien y el stock de esa talla no
       bajaba nunca. */
    const compuesto = String(linea.producto_id || '');
    const corte = compuesto.indexOf(':');
    const productId = corte > 0 ? compuesto.slice(0, corte) : (compuesto || null);
    const valoresDelId = corte > 0 ? compuesto.slice(corte + 1).split('|').filter(Boolean) : [];

    /* Los valores salen del id y no del texto que se imprime en la tirilla:
       ese lleva separadores para leerse ("M · Negro") y el inventario compara
       valor por valor. */
    const valores = valoresDelId.length
      ? valoresDelId
      : (linea.variante ? [String(linea.variante)] : []);

    /* Cómo lo pidió el cliente. Llega al panel porque una devolución de
       "la hamburguesa que pedí sin cebolla vino con cebolla" se resuelve
       mirando esto. */
    const nota = String(linea?.nota || '').trim().slice(0, 120);

    /* Los extras que llevaba: adiciones, salsas, términos.

       Se mapean a `selectedToppings`, que es el mismo campo que usan los
       pedidos del menú web. Así el panel muestra una venta de caja y una del
       menú con el mismo desglose, y los informes de qué adiciones se venden
       más suman las dos sin saber de dónde vino cada una.

       El precio de la línea **ya los incluye**: esto es el desglose, no una
       suma aparte. Si se sumaran otra vez, el total no cuadraría con las
       líneas y la venta se rechazaría. */
    const extras = (Array.isArray(linea?.extras) ? linea.extras : [])
      .filter((e) => e && e.nombre)
      .slice(0, 40)
      .map((e) => ({
        groupName: String(e.grupo || '').trim().slice(0, 80),
        optionName: String(e.nombre).trim().slice(0, 80),
        price: Math.max(0, Number(e.precio) || 0),
        basePrice: Math.max(0, Number(e.precio) || 0),
      }));

    items.push({
      productId,
      name: nombre,
      variante: valores.length ? { valores, sku: '' } : undefined,
      price: precio,
      quantity: cantidad,
      nota: nota || undefined,
      selectedToppings: extras.length ? extras : undefined,
    });
  }

  const total = Number(cuerpo.total);
  if (!Number.isFinite(total) || total < 0) {
    return { ok: false, error: 'La venta no trae un total válido' };
  }

  /* El descuento, ya autorizado por un supervisor en la caja. Aquí no se
     vuelve a autorizar —eso pasó en el mostrador y quedó en la auditoría de la
     terminal— pero sí se comprueba que sea una cifra posible. */
  const descuento = Math.max(0, Number(cuerpo.descuento) || 0);
  if (descuento > Math.round(suma)) {
    return { ok: false, error: `El descuento (${descuento}) es mayor que la venta (${suma})` };
  }

  /* Que el total no cuadre con sus líneas no es una diferencia de precios: es
     un payload corrupto o un error de cálculo. Se rechaza para que no entre a
     los informes del negocio como una venta "rara" que nadie explica.

     El descuento entra en la cuenta: sin esto, toda venta con descuento se
     rechazaba con un 400 y la cola de esa caja la apartaba para siempre. */
  if (Math.round(suma) - descuento !== Math.round(total)) {
    return {
      ok: false,
      error: `El total (${total}) no cuadra con las líneas (${suma}) menos el descuento (${descuento})`,
    };
  }

  /* Con qué se pagó. Puede ser más de un medio: "treinta mil en efectivo y el
     resto con tarjeta". El cuadre de caja del panel depende de esto, no del
     resumen `medio_pago`, que con pago mixto solo dice "mixto". */
  const pagos = (Array.isArray(cuerpo.pagos) ? cuerpo.pagos : [])
    .map((p) => ({
      metodo: String(p?.metodo || '').trim().toLowerCase().slice(0, 30),
      monto: Math.max(0, Number(p?.monto) || 0),
      referencia: String(p?.referencia || '').trim().slice(0, 40),
    }))
    .filter((p) => p.metodo && p.monto > 0)
    .slice(0, 10);

  /* Los pagos tienen que alcanzar para lo que se cobró.

     Esta cuenta ya la hizo la caja antes de guardar la venta, y la de allá es
     la que manda: aquí no se recalcula el vuelto ni se decide nada. Lo que
     atrapa esta comprobación es una venta cuyo desglose de pagos no cuadra con
     su propio total, que es un payload corrupto o una caja con un defecto —y
     en cualquiera de los dos casos, plata que el cuadre del panel daría por
     cobrada sin estarlo.

     Se compara con "mayor o igual" porque en efectivo el cliente entrega de
     más y recibe cambio: lo que no puede pasar es que sume de menos. */
  /* El desglose por régimen: impoconsumo, IVA y exento, cada uno con su base.
     Sin esto, un negocio que vende almuerzos y cerveza no puede declarar: el
     panel vería un solo impuesto global y tendría que adivinar cuál. */
  const tributos = cuerpo.impuestos && typeof cuerpo.impuestos === 'object' ? cuerpo.impuestos : {};
  const entero = (v) => Math.max(0, Math.round(Number(v) || 0));

  const desgloseTributario = {
    baseInc: entero(tributos.base_inc),
    inc: entero(tributos.inc),
    baseIva: entero(tributos.base_iva),
    iva: entero(tributos.iva),
    exento: entero(tributos.exento),
  };

  const sumaTributos =
    desgloseTributario.baseInc + desgloseTributario.inc +
    desgloseTributario.baseIva + desgloseTributario.iva +
    desgloseTributario.exento;

  /* Se admite que venga en cero —las cajas que no se hayan actualizado no lo
     mandan— pero si viene, tiene que cuadrar con lo que se cobró. Un desglose
     inflado sería base gravable inventada, y eso es un problema con la DIAN,
     no un error de redondeo. */
  if (sumaTributos > 0 && sumaTributos !== Math.round(total)) {
    return {
      ok: false,
      error: `El desglose de impuestos (${sumaTributos}) no cuadra con el total (${total})`,
    };
  }

  /* La propina. Va aparte del total y **no se suma a él**: no es ingreso del
     negocio ni base gravable. Si entrara al total, aparecería en las ventas
     del mes, pagaría impuestos que no le corresponden, y al liquidar el turno
     nadie podría separar lo que hay que repartirle al personal. */
  const propina = Math.max(0, Number(cuerpo.propina) || 0);

  if (pagos.length) {
    /* Lo que el cliente entrega es la venta más la propina, así que los pagos
       se miden contra esa suma. Medirlos contra el total solo haría que toda
       venta con propina pareciera pagada de más. */
    const aPagar = Math.round(total) + propina;
    const cobrado = pagos.reduce((t, p) => t + p.monto, 0);
    if (Math.round(cobrado) < aPagar) {
      return {
        ok: false,
        error: `Los pagos (${cobrado}) no alcanzan para lo que hay que pagar (${aPagar})`,
      };
    }
  }

  return {
    ok: true,
    venta: {
      id,
      consecutivo: Number(cuerpo.consecutivo) || 0,
      total,
      iva: Math.max(0, Number(cuerpo.iva) || 0),
      medioPago: String(cuerpo.medio_pago || 'efectivo').slice(0, 30),
      pagos,
      bruto: Math.round(suma),
      propina,
      /* El desglose tributario que calculó la caja.

         **No se recalcula aquí.** Lo hizo la terminal en el momento de vender,
         con la clasificación que tenía en ese instante, y esa es la que vale:
         si el negocio reclasifica un producto mañana, las ventas de ayer
         tienen que seguir declarando lo que declararon. Una venta es un hecho.

         Lo que sí se comprueba es que las piezas sumen el total: un desglose
         que no cuadra con su propia venta es un payload corrupto. */
      impuestos: desgloseTributario,
      descuento,
      descuentoMotivo: String(cuerpo.descuento_motivo || '').trim().slice(0, 120),
      /* A quién se le vendió, si el cajero lo asoció. Antes se descartaba y
         toda venta de caja quedaba como "Mostrador", sin historial del cliente
         ni forma de fiarle. */
      clienteId: String(cuerpo.cliente_id || '').trim().slice(0, 64),
      clienteTelefono: String(cuerpo.cliente_telefono || '').trim().slice(0, 30),
      cajero: String(cuerpo.cajero || '').slice(0, 80),
      turnoId: String(cuerpo.turno_id || '').slice(0, 64),
      creadaEn: cuerpo.creada_en ? new Date(cuerpo.creada_en) : new Date(),
      /* Cuánto tardó el cajero en armar el ticket, medido por la terminal.

         Se acota a dos horas: una venta abierta desde la mañana que se cobra
         en la tarde no es "una toma de cinco horas", es una caja que se quedó
         con la pantalla encendida, y ese valor metido en el promedio arruina
         el único número para el que el dato sirve. */
      duracionTomaSegundos: Math.min(7200, Math.max(0, Math.round(Number(cuerpo.duracion_toma_segundos) || 0))),
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
    /* El mapa trae nombre y orden. Se acepta también la forma vieja —solo el
       nombre— porque este módulo lo usan otras rutas y no tienen por qué
       enterarse de que la caja ahora ordena las categorías. */
    const cat = categoriasPorId[String(p.category)];
    const categoria = (typeof cat === 'string' ? cat : cat?.nombre) || '';
    const categoriaOrden = typeof cat === 'object' && cat ? Number(cat.orden) || 999 : 999;

    /* Si este producto se vende en la caja. Los que no, **bajan igual** pero
       marcados inactivos: si se omitieran, uno que ya estaba replicado se
       quedaría en la terminal para siempre y se seguiría vendiendo. Es la
       misma razón por la que un producto desactivado tampoco se omite. */
    const enPos = p.enPos !== false;
    const activoProducto = p.active !== false;

    /* La foto del producto. La caja la descarga una vez y la guarda en disco,
       así que lo que viaja aquí es la dirección, no la imagen.

       Se toma la principal y no la galería: en una rejilla de mostrador cabe
       una sola, y bajar cinco por producto llenaría el disco de una terminal
       por fotos que nadie va a ver. Las variantes heredan la del producto
       —una talla M no tiene foto propia— y por eso se calcula una vez aquí
       arriba y no dentro de cada rama. */
    const foto = String(p.image || (Array.isArray(p.images) ? p.images[0] : '') || '').trim();

    /* Los extras del producto, aplanados a lo que la caja necesita para
       cobrarlos: nombre, precio y las reglas de cuántos se pueden elegir.

       Lo apagado no baja. En el menú web una opción inactiva se oculta; en la
       caja tiene que desaparecer igual, o el cajero vendería una salsa que el
       negocio dejó de ofrecer. */
    const extras = (Array.isArray(p.toppingGroups) ? p.toppingGroups : [])
      .filter((g) => g && g.active !== false)
      .map((g) => ({
        id: String(g._id),
        nombre: g.name,
        /* `multiple` decide si el cajero puede marcar varias o solo una, y
           `obligatorio` si puede seguir sin elegir nada. Son las dos reglas
           que hacen que una comanda llegue completa a la cocina. */
        multiple: g.isMultipleChoice === true,
        obligatorio: g.isRequired === true,
        /* Si el dueño marcó este grupo como el tamaño del producto. La caja
           pone sus opciones en la botonera del mostrador. */
        es_combo: g.esCombo === true,
        precio_base: Math.round(Number(g.basePrice) || 0),
        opciones: (Array.isArray(g.options) ? g.options : [])
          .filter((o) => o && o.active !== false && o.name)
          .map((o) => ({ nombre: o.name, precio: Math.round(Number(o.price) || 0) })),
        subgrupos: (Array.isArray(g.subGroups) ? g.subGroups : []).map((sg) => ({
          titulo: sg.title || '',
          multiple: sg.isMultipleChoice !== false,
          obligatorio: sg.isRequired === true,
          // null = sin tope. Es lo que permite "máximo 3 de 5 vegetales".
          maximo: sg.maxSelections == null ? null : Math.max(1, Number(sg.maxSelections) || 1),
          repetibles: sg.allowRepeats === true,
          opciones: (Array.isArray(sg.options) ? sg.options : [])
            .filter((o) => o && o.active !== false && o.name)
            .map((o) => ({ nombre: o.name, precio: Math.round(Number(o.price) || 0) })),
        })),
      }))
      // Un grupo sin nada que elegir es una pantalla en blanco para el cajero.
      .filter((g) => g.opciones.length || g.subgrupos.some((sg) => sg.opciones.length));

    const variantes = Array.isArray(p.variantes) ? p.variantes : [];

    if (!variantes.length) {
      filas.push({
        id: String(p._id),
        nombre: p.name,
        precio: Math.round(Number(p.price) || 0),
        categoria,
        sku: p.sku || '',
        variante: '',
        activo: activoProducto && enPos,
        categoria_orden: categoriaOrden,
        actualizado,
        foto,
        extras,
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
        activo: activoProducto && enPos && v.activo !== false,
        categoria_orden: categoriaOrden,
        actualizado,
        foto,
        /* Las variantes heredan los extras del producto: una camiseta talla M
           lleva los mismos estampados que la L, y una hamburguesa no cambia de
           salsas según el tamaño. */
        extras,
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

  /* Lo devuelto en efectivo salió de la gaveta, y la caja lo resta del
     esperado. Este chequeo no lo restaba: cualquier turno con una devolución
     en efectivo "no cuadraba", se rechazaba, y el cierre quedaba apartado en
     la caja sin llegar nunca al panel. Opcional para las cajas viejas que no
     lo mandan: para ellas vale cero, como antes. */
  const devolucionesEfectivo = Math.max(0, Number(cuerpo.devoluciones_efectivo) || 0);
  const esperadoCalculado =
    campos.fondoInicial + campos.ventasEfectivo + campos.entradas - campos.salidas - devolucionesEfectivo;

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
      /* Lo que la caja manda además de la plata. No cambia el cuadre; es lo
         que el dueño mira para entender un turno: cuánto de la gaveta es
         propina, cuántas veces se abrió sin vender, cuánto se borró. */
      detalle: {
        propinaEfectivo: Math.max(0, Number(cuerpo.propina_efectivo) || 0),
        propinaOtros: Math.max(0, Number(cuerpo.propina_otros) || 0),
        devolucionesEfectivo,
        aperturasSinVenta: Math.max(0, parseInt(cuerpo.aperturas_sin_venta, 10) || 0),
        borradoresAnulados: Math.max(0, parseInt(cuerpo.borradores_anulados, 10) || 0),
        borradoresMonto: Math.max(0, Number(cuerpo.borradores_monto) || 0),
        anulacionesComanda: Math.max(0, parseInt(cuerpo.anulaciones_comanda, 10) || 0),
        anulacionesMonto: Math.max(0, Number(cuerpo.anulaciones_monto) || 0),
        ventaBruta: Math.max(0, Number(cuerpo.venta_bruta) || 0),
        alertaBorradores: cuerpo.alerta_borradores === true,
      },
      movimientos: (Array.isArray(cuerpo.movimientos) ? cuerpo.movimientos : [])
        .filter((m) => m && (m.tipo === 'entrada' || m.tipo === 'salida') && Number(m.monto) > 0)
        .slice(0, 500)
        .map((m) => ({
          tipo: m.tipo,
          monto: Number(m.monto),
          motivo: String(m.motivo || '').slice(0, 200),
          usuario: String(m.usuario || '').slice(0, 80),
          creadoEn: m.creado_en ? new Date(m.creado_en) : undefined,
        })),
    },
  };
}

/** Los tipos de excepción que la caja puede reportar. */
/* `anular_borrador` es quitar una línea que todavía no fue a cocina: un error
   de tecleo. Se registra sin supervisor —pedirlo en cada dedo mal puesto
   vuelve la firma un trámite— y cuenta en el arqueo como señal: diez borrados
   en un turno es como se ve un cobro de palabra. La caja lo mandaba desde que
   existe, y el servidor lo rechazaba por no conocerlo: quedaban apartados. */
const TIPOS_EXCEPCION = ['anular_item', 'anular_borrador', 'descuento', 'abrir_cajon', 'descartar_pausada'];

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

/**
 * Valida una devolución que sube la caja.
 *
 * Igual que con la venta, la decisión ya se tomó en el mostrador: un supervisor
 * la autorizó y la plata ya salió de la gaveta. Aquí no se aprueba ni se
 * rechaza el hecho, se comprueba que el mensaje sea coherente antes de mover el
 * inventario del negocio con él.
 */
function validarDevolucion(cuerpo) {
  if (!cuerpo || typeof cuerpo !== 'object') {
    return { ok: false, error: 'Devolución vacía' };
  }

  /* El id lo genera la caja (UUIDv7) y es la llave de idempotencia: la cola
     reintenta hasta que le confirmemos, y sin él una devolución reintentada
     sumaría el inventario dos veces. */
  const id = String(cuerpo.id || '').trim();
  if (id.length < 8 || id.length > 64) {
    return { ok: false, error: 'La devolución no trae un id válido' };
  }

  const ventaId = String(cuerpo.venta_id || '').trim();
  if (!ventaId) return { ok: false, error: 'No dice de qué venta es' };

  /* Sin autorización no entra, aunque la caja ya la haya registrado. Es la
     misma regla del mostrador repetida aquí: una devolución sin nombre encima
     es una salida de efectivo que nadie firmó. */
  const autorizo = String(cuerpo.autorizo || '').trim().slice(0, 80);
  if (!autorizo) return { ok: false, error: 'La devolución no trae quién la autorizó' };

  const motivo = String(cuerpo.motivo || '').trim().slice(0, 200);
  if (motivo.length < 3) return { ok: false, error: 'La devolución no trae motivo' };

  const lineas = Array.isArray(cuerpo.items) ? cuerpo.items : [];
  if (!lineas.length) return { ok: false, error: 'La devolución no trae líneas' };
  if (lineas.length > MAX_LINEAS) return { ok: false, error: 'Demasiadas líneas en una devolución' };

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

    /* El mismo id compuesto que en la venta: el inventario vive en el producto
       y en su variante, no en la fila aplanada del catálogo. */
    const compuesto = String(linea.producto_id || '');
    const corte = compuesto.indexOf(':');
    const productId = corte > 0 ? compuesto.slice(0, corte) : (compuesto || null);
    const valoresDelId = corte > 0 ? compuesto.slice(corte + 1).split('|').filter(Boolean) : [];
    const valores = valoresDelId.length
      ? valoresDelId
      : (linea.variante ? [String(linea.variante)] : []);

    items.push({
      productId,
      name: nombre,
      variante: valores.length ? { valores, sku: '' } : undefined,
      price: precio,
      quantity: cantidad,
    });
  }

  const total = Number(cuerpo.total);
  if (!Number.isFinite(total) || total < 0) {
    return { ok: false, error: 'La devolución no trae un total válido' };
  }
  if (Math.round(suma) !== Math.round(total)) {
    return { ok: false, error: `El total (${total}) no cuadra con las líneas (${suma})` };
  }

  return {
    ok: true,
    devolucion: {
      id,
      ventaId,
      consecutivo: Number(cuerpo.consecutivo) || 0,
      total,
      medio: String(cuerpo.medio || 'efectivo').slice(0, 30),
      motivo,
      cajero: String(cuerpo.cajero || '').slice(0, 80),
      autorizo,
      turnoId: String(cuerpo.turno_id || '').slice(0, 64),
      creadaEn: cuerpo.creada_en ? new Date(cuerpo.creada_en) : new Date(),
      items,
    },
  };
}

/* ── Pedidos web en la caja ─────────────────────────────────────────────── */

/* Los estados en que un pedido todavía le toca a alguien. Los finales
   (completado, entregado, cancelado) ya no se muestran en la caja. */
const ESTADOS_ACTIVOS = [
  'pending', 'pending_payment', 'payment_uploaded', 'payment_confirmed',
  'confirmed', 'preparing', 'inProgress', 'ready',
];

/**
 * Un pedido, en la forma que la caja dibuja.
 *
 * Se aplana acá y no en la caja porque la caja no tiene por qué conocer el
 * modelo de Mongo: los extras llegan como texto listo para leer y las notas
 * del pedido con su nombre en castellano. Si mañana cambia el esquema, cambia
 * esta función y la caja ni se entera.
 */
function pedidoParaCaja(o) {
  const texto = (v, max = 300) => String(v ?? '').trim().slice(0, max);
  const items = (o.items || []).map((it) => {
    const extras = [];
    for (const t of it.selectedToppings || []) {
      if (t.optionName) extras.push(texto(t.optionName, 80));
      for (const sg of t.subGroups || []) {
        if (sg.optionName) extras.push(texto(sg.optionName, 80));
      }
    }
    return {
      nombre: texto(it.name, 120),
      variante: (it.variante?.valores || []).map((v) => texto(v, 40)).join(' / '),
      cantidad: Number(it.quantity) || 1,
      precio: Math.round(Number(it.price) || 0),
      extras,
      regalo: !!it.isLoyaltyReward,
    };
  });
  return {
    id: String(o._id),
    numero: texto(o.orderNumber, 30) || String(o._id).slice(-6),
    estado: o.status,
    canal: o.orderChannel || 'whatsapp',
    tipo: o.orderType || 'takeaway',
    cliente: texto(o.customerName, 80),
    telefono: texto(o.phone, 30),
    direccion: texto(o.address, 200),
    mesa: texto(o.tableNumber, 20),
    notas: texto(o.customerNotes, 500),
    metodo_pago: o.paymentMethod || '',
    comprobante: !!o.paymentProof,
    total: Math.round(Number(o.finalAmount ?? o.totalAmount) || 0),
    envio: Math.round(Number(o.deliveryFee) || 0),
    creado: o.createdAt ? new Date(o.createdAt).toISOString() : '',
    items,
  };
}

module.exports = {
  pedidoParaCaja,
  ESTADOS_ACTIVOS,
  validarVenta,
  validarCierre,
  validarExcepcion,
  aplanarCatalogo,
  validarDevolucion,
  TIPOS_EXCEPCION,
  MAX_LINEAS,
  MAX_CANTIDAD,
};
