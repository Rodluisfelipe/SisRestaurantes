/**
 * La caja nativa contra la nube.
 *
 * Dos cosas se prueban acá, que son las dos que cuestan plata:
 *
 * 1. Que el servidor no acepte una venta incoherente. La caja ya cobró, así que
 *    el servidor no corrige precios —eso sería reescribir lo que el cliente
 *    pagó— pero sí rechaza lo que no cuadra consigo mismo.
 * 2. Que el catálogo baje aplanado y completo, incluidos los apagados: si solo
 *    bajaran los activos, un producto descontinuado se quedaría para siempre en
 *    la caja y se seguiría vendiendo.
 */
const {
  validarVenta, validarCierre, validarExcepcion, aplanarCatalogo, validarDevolucion,
} = require('../utils/pos');

const VENTA = {
  id: '0192f8a1-7c4e-7000-8000-abcdef123456',   // UUIDv7 de la caja
  consecutivo: 143,
  total: 14500,
  iva: 0,
  medio_pago: 'efectivo',
  cajero: 'Ana',
  turno_id: 't1',
  creada_en: '2026-09-20T15:04:05-05:00',
  items: [
    { producto_id: 'p1', nombre: 'Café', variante: '', precio: 5000, cantidad: 2 },
    { producto_id: 'p2', nombre: 'Pan', variante: '', precio: 1500, cantidad: 3 },
  ],
};

const venta = (cambios = {}) => ({ ...VENTA, ...cambios });

describe('lo que la caja sube', () => {
  it('una venta coherente pasa', () => {
    const r = validarVenta(VENTA);
    expect(r.ok).toBe(true);
    expect(r.venta.total).toBe(14500);
    expect(r.venta.items).toHaveLength(2);
    expect(r.venta.items[0].quantity).toBe(2);
  });

  it('sin id no hay idempotencia, así que no entra', () => {
    // Sin id, un reintento crearía una segunda venta y el negocio cobraría dos veces en sus reportes.
    expect(validarVenta(venta({ id: '' })).ok).toBe(false);
    expect(validarVenta(venta({ id: 'x' })).ok).toBe(false);
  });

  it('el total tiene que ser la suma de sus líneas', () => {
    const r = validarVenta(venta({ total: 99000 }));
    expect(r.ok).toBe(false);
    expect(r.error).toContain('no cuadra');
  });

  it('no acepta cantidades que no son cantidades', () => {
    expect(validarVenta(venta({ items: [{ nombre: 'X', precio: 1000, cantidad: 0 }] })).ok).toBe(false);
    expect(validarVenta(venta({ items: [{ nombre: 'X', precio: 1000, cantidad: -3 }] })).ok).toBe(false);
    expect(validarVenta(venta({ items: [{ nombre: 'X', precio: 1000, cantidad: 1.5 }] })).ok).toBe(false);
  });

  it('no acepta precios negativos', () => {
    expect(validarVenta(venta({ items: [{ nombre: 'X', precio: -1000, cantidad: 1 }], total: -1000 })).ok).toBe(false);
  });

  it('una venta sin líneas no es una venta', () => {
    expect(validarVenta(venta({ items: [] })).ok).toBe(false);
    expect(validarVenta(null).ok).toBe(false);
  });

  it('respeta la hora de la caja, no la del servidor', () => {
    // Una venta hecha sin internet a las 3 de la tarde no puede aparecer a las
    // 9 de la noche, cuando volvió la señal.
    const r = validarVenta(VENTA);
    expect(r.venta.creadaEn.toISOString()).toBe('2026-09-20T20:04:05.000Z');
  });

  it('la variante viaja para que el stock baje de la talla correcta', () => {
    const r = validarVenta(venta({
      items: [{ producto_id: 'p1', nombre: 'Camiseta', variante: 'M', precio: 40000, cantidad: 1 }],
      total: 40000,
    }));
    expect(r.venta.items[0].variante).toEqual({ valores: ['M'], sku: '' });
  });

  it('no acepta una venta con miles de líneas', () => {
    const muchas = Array.from({ length: 201 }, () => ({ nombre: 'X', precio: 100, cantidad: 1 }));
    expect(validarVenta(venta({ items: muchas, total: 20100 })).ok).toBe(false);
  });
});

describe('el catálogo que baja a la caja', () => {
  const CATEGORIAS = { c1: 'Bebidas' };

  const producto = (extra = {}) => ({
    _id: 'p1',
    name: 'Café',
    price: 4500,
    category: 'c1',
    active: true,
    sku: 'CAF-01',
    updatedAt: new Date('2026-09-20T10:00:00Z'),
    ...extra,
  });

  it('un producto simple es una fila', () => {
    const [fila] = aplanarCatalogo([producto()], CATEGORIAS);
    expect(fila).toMatchObject({
      id: 'p1', nombre: 'Café', precio: 4500, categoria: 'Bebidas', sku: 'CAF-01', variante: '', activo: true,
    });
    expect(fila.actualizado).toBe('2026-09-20T10:00:00.000Z');
  });

  it('un producto con tallas baja como una fila por talla', () => {
    // En la caja se toca "Camiseta · M", no "Camiseta".
    const filas = aplanarCatalogo([producto({
      name: 'Camiseta',
      price: 40000,
      variantes: [
        { valores: ['M'], precio: null, sku: 'CAM-M', activo: true },
        { valores: ['L'], precio: 42000, sku: 'CAM-L', activo: true },
      ],
    })], CATEGORIAS);

    expect(filas).toHaveLength(2);
    expect(filas[0]).toMatchObject({ id: 'p1:M', variante: 'M', precio: 40000, sku: 'CAM-M' });
    expect(filas[1]).toMatchObject({ id: 'p1:L', variante: 'L', precio: 42000 });
  });

  it('la talla sin precio propio hereda el del producto', () => {
    const [fila] = aplanarCatalogo([producto({
      price: 40000,
      variantes: [{ valores: ['M'], precio: '', activo: true }],
    })]);
    expect(fila.precio).toBe(40000);
  });

  it('lo apagado también baja, marcado', () => {
    // Si no bajara, se quedaría para siempre en la caja vendiéndose.
    const [fila] = aplanarCatalogo([producto({ active: false })]);
    expect(fila.activo).toBe(false);
  });

  it('una talla apagada no se vende aunque el producto esté activo', () => {
    const filas = aplanarCatalogo([producto({
      variantes: [
        { valores: ['M'], activo: true },
        { valores: ['L'], activo: false },
      ],
    })]);
    expect(filas.map((f) => f.activo)).toEqual([true, false]);
  });

  it('un producto apagado apaga todas sus tallas', () => {
    const filas = aplanarCatalogo([producto({
      active: false,
      variantes: [{ valores: ['M'], activo: true }, { valores: ['L'], activo: true }],
    })]);
    expect(filas.every((f) => f.activo === false)).toBe(true);
  });

  it('el id compuesto distingue combinaciones de varios ejes', () => {
    const [fila] = aplanarCatalogo([producto({
      variantes: [{ valores: ['M', 'Negro'], activo: true }],
    })]);
    expect(fila.id).toBe('p1:M|Negro');
    expect(fila.variante).toBe('M · Negro');
  });
});

describe('el arqueo que sube la caja', () => {
  const CIERRE = {
    turno_id: '0192f8a1-7c4e-7000-8000-000000000001',
    cajero: 'Ana',
    abierto_en: '2026-09-20T08:00:00-05:00',
    cerrado_en: '2026-09-20T18:00:00-05:00',
    fondo_inicial: 100000,
    ventas_efectivo: 30000,
    ventas_otros: 20000,
    entradas: 50000,
    salidas: 10000,
    esperado: 170000,
    contado: 170000,
    diferencia: 0,
    ventas: 2,
  };
  const cierre = (cambios = {}) => ({ ...CIERRE, ...cambios });

  it('un arqueo que cuadra pasa', () => {
    const r = validarCierre(CIERRE);
    expect(r.ok).toBe(true);
    expect(r.cierre.diferencia).toBe(0);
  });

  it('un faltante entra como faltante, no se corrige', () => {
    // Es el dato del que depende todo el control de pérdidas.
    const r = validarCierre(cierre({ contado: 150000, diferencia: -20000 }));
    expect(r.ok).toBe(true);
    expect(r.cierre.diferencia).toBe(-20000);
  });

  it('rechaza un esperado que no sale de sus propios números', () => {
    expect(validarCierre(cierre({ esperado: 999999 })).ok).toBe(false);
  });

  it('rechaza una diferencia que no cuadra con el conteo', () => {
    // Sin esto, una caja alterada podría reportar faltante cero contando de menos.
    expect(validarCierre(cierre({ contado: 150000, diferencia: 0 })).ok).toBe(false);
  });

  it('el servidor NO recalcula el esperado con lo que alcanzó a subir', () => {
    /* Un turno con ventas todavía en cola saldría con un faltante enorme que no
       existe, y alguien terminaría acusado de robar. */
    const r = validarCierre(CIERRE);
    expect(r.cierre.ventasEfectivo).toBe(30000);
    expect(r.cierre.esperado).toBe(170000);
  });

  it('sin turno no hay arqueo', () => {
    expect(validarCierre(cierre({ turno_id: '' })).ok).toBe(false);
    expect(validarCierre(null).ok).toBe(false);
  });

  it('no acepta un fondo o un conteo negativo', () => {
    expect(validarCierre(cierre({ contado: -1, diferencia: -170001 })).ok).toBe(false);
  });
});

describe('las excepciones del mostrador', () => {
  const BASE = {
    id: '0192f8a1-7c4e-7000-8000-000000000009',
    turno_id: '0192f8a1-7c4e-7000-8000-000000000001',
    tipo: 'anular_item',
    detalle: 'Café x2',
    monto: 10000,
    motivo: 'el cliente se arrepintió',
    cajero: 'Ana',
    autorizo: 'Felipe',
    creada_en: '2026-09-20T15:00:00-05:00',
  };
  const exc = (cambios = {}) => ({ ...BASE, ...cambios });

  it('una anulación con motivo y autorización pasa', () => {
    const r = validarExcepcion(BASE);
    expect(r.ok).toBe(true);
    expect(r.excepcion.cajero).toBe('Ana');
    expect(r.excepcion.autorizo).toBe('Felipe');
  });

  it('una anulación sin motivo no es un registro, es una línea que desapareció', () => {
    expect(validarExcepcion(exc({ motivo: '' })).ok).toBe(false);
    expect(validarExcepcion(exc({ motivo: 'ok' })).ok).toBe(false);
  });

  it('una anulación sin quién la autorizó no entra', () => {
    expect(validarExcepcion(exc({ autorizo: '' })).ok).toBe(false);
  });

  it('un descuento se exige igual de estricto que una anulación', () => {
    expect(validarExcepcion(exc({ tipo: 'descuento', autorizo: '' })).ok).toBe(false);
    expect(validarExcepcion(exc({ tipo: 'descuento' })).ok).toBe(true);
  });

  it('abrir el cajón se registra sin pedir supervisor', () => {
    // Pedir autorización para dar un cambio paraliza la fila en hora pico.
    const r = validarExcepcion({ id: BASE.id, tipo: 'abrir_cajon', cajero: 'Ana', creada_en: BASE.creada_en });
    expect(r.ok).toBe(true);
    expect(r.excepcion.autorizo).toBe('');
  });

  it('un tipo inventado no entra', () => {
    expect(validarExcepcion(exc({ tipo: 'lo_que_sea' })).ok).toBe(false);
  });

  it('sin id no hay idempotencia', () => {
    expect(validarExcepcion(exc({ id: '' })).ok).toBe(false);
  });

  it('guarda la hora del mostrador, no la del servidor', () => {
    // Puede llegar dos días tarde si la caja estuvo sin internet.
    const r = validarExcepcion(BASE);
    expect(r.excepcion.ocurridaEn.toISOString()).toBe('2026-09-20T20:00:00.000Z');
  });
});

describe('el voucher del datáfono', () => {
  const conTarjeta = (pago) => ({ ...VENTA, medio_pago: 'tarjeta', pago });

  it('una venta con tarjeta guarda con qué se pagó', () => {
    // Es lo que permite cuadrar la pila de vouchers de papel contra las ventas.
    const r = validarVenta(conTarjeta({
      aprobada: true,
      codigo_autorizacion: '048123',
      ultimos_cuatro: '4582',
      franquicia: 'Visa',
    }));
    expect(r.ok).toBe(true);
    expect(r.venta.pago).toEqual({ autorizacion: '048123', ultimosCuatro: '4582', franquicia: 'Visa' });
  });

  it('un pago no aprobado no se guarda como pago', () => {
    const r = validarVenta(conTarjeta({ aprobada: false, codigo_autorizacion: '' }));
    expect(r.ok).toBe(true);
    expect(r.venta.pago).toBeNull();
  });

  it('una venta en efectivo no inventa un voucher', () => {
    expect(validarVenta(VENTA).venta.pago).toBeNull();
  });
});

describe('el id compuesto del catálogo aplanado', () => {
  /* La caja vende la fila que bajó: "<producto>:M|Negro". El inventario vive
     en el producto y su variante, así que el id hay que volver a partirlo. */
  it('separa el producto de su variante', () => {
    const r = validarVenta({
      ...VENTA,
      total: 40000,
      items: [{ producto_id: '68f1a2b3c4d5e6f708192a3b:M|Negro', nombre: 'Camiseta', variante: 'M · Negro', precio: 40000, cantidad: 1 }],
    });

    expect(r.ok).toBe(true);
    expect(r.venta.items[0].productId).toBe('68f1a2b3c4d5e6f708192a3b');
    // Valor por valor, no el texto con separadores de la tirilla.
    expect(r.venta.items[0].variante.valores).toEqual(['M', 'Negro']);
  });

  it('un producto sin variantes deja su id intacto', () => {
    const r = validarVenta({
      ...VENTA,
      total: 4500,
      items: [{ producto_id: '68f1a2b3c4d5e6f708192a3b', nombre: 'Café', variante: '', precio: 4500, cantidad: 1 }],
    });
    expect(r.venta.items[0].productId).toBe('68f1a2b3c4d5e6f708192a3b');
    expect(r.venta.items[0].variante).toBeUndefined();
  });

  it('sin id compuesto, la variante sale del texto', () => {
    // Compatibilidad con cualquier caja vieja que mande solo el nombre.
    const r = validarVenta({
      ...VENTA,
      total: 40000,
      items: [{ producto_id: '68f1a2b3c4d5e6f708192a3b', nombre: 'Camiseta', variante: 'M', precio: 40000, cantidad: 1 }],
    });
    expect(r.venta.items[0].variante.valores).toEqual(['M']);
  });
});

describe('el descuento que baja de la caja', () => {
  /* El descuento lo autoriza un supervisor en el mostrador y queda en la
     auditoría de esa terminal. Aquí no se vuelve a autorizar: se comprueba que
     la cuenta cierre, que es lo único que este lado puede saber. */

  it('una venta con descuento cuadra', () => {
    const r = validarVenta(venta({ total: 13000, descuento: 1500, descuento_motivo: 'Cliente frecuente' }));

    expect(r.ok).toBe(true);
    expect(r.venta.descuento).toBe(1500);
    expect(r.venta.bruto).toBe(14500);
    expect(r.venta.total).toBe(13000);
    expect(r.venta.descuentoMotivo).toBe('Cliente frecuente');
  });

  it('sin descuento, el bruto es el total', () => {
    // Para que restar las dos cifras en un informe no dé un descuento fantasma.
    const r = validarVenta(VENTA);
    expect(r.venta.bruto).toBe(r.venta.total);
    expect(r.venta.descuento).toBe(0);
  });

  it('un total que no cuadra ni con descuento se rechaza', () => {
    const r = validarVenta(venta({ total: 9000, descuento: 1500 }));
    expect(r.ok).toBe(false);
  });

  it('no se puede descontar más de lo que vale la venta', () => {
    const r = validarVenta(venta({ total: 0, descuento: 99000 }));
    expect(r.ok).toBe(false);
  });

  it('un descuento negativo no se convierte en recargo', () => {
    /* Si pasara, sería la forma de cobrar de más sin que quedara registrado
       como un precio distinto. Se trata como cero, y entonces el total no
       cuadra y la venta se rechaza. */
    const r = validarVenta(venta({ total: 16000, descuento: -1500 }));
    expect(r.ok).toBe(false);
  });
});

describe('el pago repartido entre varios medios', () => {
  it('una venta mixta trae su desglose', () => {
    const r = validarVenta(venta({
      medio_pago: 'mixto',
      pagos: [
        { metodo: 'efectivo', monto: 10000 },
        { metodo: 'tarjeta', monto: 4500, referencia: 'A1B2' },
      ],
    }));

    expect(r.ok).toBe(true);
    expect(r.venta.pagos).toHaveLength(2);
    expect(r.venta.pagos[1]).toEqual({ metodo: 'tarjeta', monto: 4500, referencia: 'A1B2' });
  });

  it('el medio se normaliza a minúsculas', () => {
    // El cuadre del panel agrupa por este campo: "Tarjeta" y "tarjeta" tienen
    // que caer en el mismo montón.
    const r = validarVenta(venta({ pagos: [{ metodo: 'TARJETA', monto: 14500 }] }));
    expect(r.venta.pagos[0].metodo).toBe('tarjeta');
  });

  it('los pagos en cero o sin medio se descartan', () => {
    const r = validarVenta(venta({
      pagos: [
        { metodo: 'efectivo', monto: 14500 },
        { metodo: 'tarjeta', monto: 0 },
        { metodo: '', monto: 500 },
      ],
    }));
    expect(r.venta.pagos).toHaveLength(1);
  });

  it('una venta de siempre no trae pagos y no pasa nada', () => {
    // Las cajas que todavía no se hayan actualizado siguen subiendo igual.
    const r = validarVenta(VENTA);
    expect(r.ok).toBe(true);
    expect(r.venta.pagos).toEqual([]);
  });

  it('los pagos tienen que alcanzar para el total', () => {
    /* Una venta cuyo desglose suma menos que su propio total es un payload
       corrupto o una caja con un defecto. En los dos casos, el cuadre del
       panel daría por cobrada plata que no entró. */
    const r = validarVenta(venta({
      pagos: [
        { metodo: 'efectivo', monto: 5000 },
        { metodo: 'tarjeta', monto: 4000 },
      ],
    }));

    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/no alcanzan/);
  });

  it('en efectivo se puede entregar de más', () => {
    // El cliente paga con un billete grande y recibe cambio: eso no es un error.
    const r = validarVenta(venta({ pagos: [{ metodo: 'efectivo', monto: 20000 }] }));
    expect(r.ok).toBe(true);
  });

  it('con descuento, los pagos se miden contra lo que se cobró', () => {
    /* La cuenta que importa: con 13.000 alcanza para una venta de 14.500 que
       tiene 1.500 de descuento. Si se midiera contra el bruto, toda venta con
       descuento y pago exacto se rechazaría. */
    const r = validarVenta(venta({
      total: 13000,
      descuento: 1500,
      pagos: [{ metodo: 'efectivo', monto: 13000 }],
    }));

    expect(r.ok).toBe(true);
  });
});

describe('la nota del cliente', () => {
  it('llega con la línea', () => {
    /* Una devolución de "pedí la hamburguesa sin cebolla y vino con cebolla"
       se resuelve mirando esto en el panel. */
    const r = validarVenta(venta({
      items: [{ producto_id: 'p1', nombre: 'Hamburguesa', variante: '', precio: 14500, cantidad: 1, nota: 'Sin cebolla' }],
    }));

    expect(r.ok).toBe(true);
    expect(r.venta.items[0].nota).toBe('Sin cebolla');
  });

  it('sin nota, la línea no lleva el campo', () => {
    // Para no llenar la base de cadenas vacías.
    const r = validarVenta(VENTA);
    expect(r.venta.items[0].nota).toBeUndefined();
  });
});

describe('la propina', () => {
  /* No es del negocio. Se cobra con la venta, viaja con ella y se guarda
     aparte del total: si entrara al total aparecería en las ventas del mes,
     pagaría impuestos que no le corresponden, y al liquidar el turno nadie
     podría separar lo que hay que repartirle al personal. */

  it('viaja aparte y no toca el total', () => {
    const r = validarVenta(venta({ propina: 2000 }));

    expect(r.ok).toBe(true);
    expect(r.venta.propina).toBe(2000);
    expect(r.venta.total).toBe(14500);
    expect(r.venta.bruto).toBe(14500);
  });

  it('sin propina es cero, no undefined', () => {
    // Para que sumar la columna en un informe no dé NaN.
    expect(validarVenta(VENTA).venta.propina).toBe(0);
  });

  it('los pagos tienen que cubrir la venta más la propina', () => {
    /* Lo que el cliente entrega es la suma de las dos. Medir los pagos solo
       contra el total haría que una venta con propina pareciera pagada de
       más, y el desglose que ve el panel no cuadraría con la gaveta. */
    const r = validarVenta(venta({
      propina: 2000,
      pagos: [{ metodo: 'efectivo', monto: 14500 }],
    }));

    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/no alcanzan/);
  });

  it('con el pago completo, pasa', () => {
    const r = validarVenta(venta({
      propina: 2000,
      pagos: [{ metodo: 'efectivo', monto: 16500 }],
    }));

    expect(r.ok).toBe(true);
  });

  it('una propina negativa no es un descuento encubierto', () => {
    const r = validarVenta(venta({ propina: -2000 }));
    expect(r.venta.propina).toBe(0);
  });

  it('convive con el descuento', () => {
    /* El caso completo de un restaurante: se descuenta sobre el consumo y la
       propina se calcula aparte. Los pagos cubren 13.000 + 1.300. */
    const r = validarVenta(venta({
      total: 13000,
      descuento: 1500,
      propina: 1300,
      pagos: [{ metodo: 'efectivo', monto: 14300 }],
    }));

    expect(r.ok).toBe(true);
    expect(r.venta.bruto).toBe(14500);
    expect(r.venta.descuento).toBe(1500);
    expect(r.venta.total).toBe(13000);
    expect(r.venta.propina).toBe(1300);
  });
});

describe('la devolución que sube la caja', () => {
  /* Cuando esto llega, la plata **ya salió de la gaveta**: un supervisor la
     autorizó frente al cliente, posiblemente sin internet y horas antes. Este
     lado no aprueba el hecho; comprueba que el mensaje sea coherente antes de
     mover el inventario del negocio con él. */

  const DEVOLUCION = {
    id: '0192f8a1-7c4e-7000-8000-fedcba654321',
    venta_id: '0192f8a1-7c4e-7000-8000-abcdef123456',
    consecutivo: 143,
    turno_id: 't1',
    total: 5000,
    medio: 'efectivo',
    motivo: 'Salió frío',
    cajero: 'Ana',
    autorizo: 'Luis',
    creada_en: '2026-09-20T16:00:00-05:00',
    items: [{ producto_id: 'p1', nombre: 'Café', variante: '', precio: 5000, cantidad: 1 }],
  };

  const devolucion = (cambios = {}) => ({ ...DEVOLUCION, ...cambios });

  it('una devolución coherente pasa', () => {
    const r = validarDevolucion(DEVOLUCION);

    expect(r.ok).toBe(true);
    expect(r.devolucion.total).toBe(5000);
    expect(r.devolucion.autorizo).toBe('Luis');
    expect(r.devolucion.items).toHaveLength(1);
  });

  it('sin id no hay idempotencia, así que no entra', () => {
    /* La cola reintenta hasta que le confirmemos. Sin el id, un reintento
       sumaría el inventario dos veces y el negocio creería tener unidades que
       no tiene. */
    expect(validarDevolucion(devolucion({ id: '' })).ok).toBe(false);
  });

  it('sin quién la autorizó, no entra', () => {
    /* La misma regla del mostrador, repetida aquí: una devolución sin nombre
       encima es una salida de efectivo que nadie firmó. */
    const r = validarDevolucion(devolucion({ autorizo: '   ' }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/autoriz/i);
  });

  it('sin motivo tampoco', () => {
    expect(validarDevolucion(devolucion({ motivo: 'x' })).ok).toBe(false);
  });

  it('el total tiene que cuadrar con sus líneas', () => {
    // Un total inflado sería inventario devuelto que no corresponde.
    expect(validarDevolucion(devolucion({ total: 50000 })).ok).toBe(false);
  });

  it('no acepta cantidades que no son cantidades', () => {
    const r = validarDevolucion(devolucion({
      items: [{ producto_id: 'p1', nombre: 'Café', variante: '', precio: 5000, cantidad: 0 }],
    }));
    expect(r.ok).toBe(false);
  });

  it('una devolución sin líneas no es una devolución', () => {
    expect(validarDevolucion(devolucion({ items: [] })).ok).toBe(false);
  });

  it('la variante viaja para que el stock suba a la talla correcta', () => {
    /* Mismo id compuesto que en la venta. Sin partirlo, la unidad volvería al
       producto padre y la talla seguiría figurando agotada. */
    const r = validarDevolucion(devolucion({
      total: 40000,
      items: [{ producto_id: '507f1f77bcf86cd799439011:M|Negro', nombre: 'Camiseta', variante: 'M · Negro', precio: 40000, cantidad: 1 }],
    }));

    expect(r.ok).toBe(true);
    expect(r.devolucion.items[0].productId).toBe('507f1f77bcf86cd799439011');
    expect(r.devolucion.items[0].variante.valores).toEqual(['M', 'Negro']);
  });

  it('respeta la hora de la caja, no la del servidor', () => {
    // Una devolución hecha sin internet a las 4 no puede aparecer a las 9.
    const r = validarDevolucion(DEVOLUCION);
    expect(r.devolucion.creadaEn.toISOString()).toBe(new Date('2026-09-20T16:00:00-05:00').toISOString());
  });

  it('guarda con qué se devolvió la plata', () => {
    /* En efectivo salió de la gaveta y el arqueo de ese turno ya lo restó; por
       datáfono la reversa la hizo el banco. No son lo mismo al conciliar. */
    expect(validarDevolucion(devolucion({ medio: 'tarjeta' })).devolucion.medio).toBe('tarjeta');
  });
});

describe('los extras de una línea', () => {
  /* Adiciones, salsas, términos. El precio de la línea **ya los incluye**:
     esto es el desglose para el panel, no una suma aparte. */

  const conExtras = (extras) => venta({
    total: 18000,
    items: [{
      producto_id: 'p1', nombre: 'Hamburguesa', variante: '', precio: 18000, cantidad: 1, extras,
    }],
  });

  it('viajan como selectedToppings, igual que en el menú web', () => {
    /* El mismo campo que usan los pedidos del menú: así el panel muestra las
       dos con el mismo desglose y los informes las suman sin saber de dónde
       vino cada venta. */
    const r = validarVenta(conExtras([
      { grupo: 'Adiciones', nombre: 'Queso extra', precio: 3000, cantidad: 1 },
    ]));

    expect(r.ok).toBe(true);
    expect(r.venta.items[0].selectedToppings).toEqual([
      { groupName: 'Adiciones', optionName: 'Queso extra', price: 3000, basePrice: 3000 },
    ]);
  });

  it('el precio de la línea ya los incluye y no se suman otra vez', () => {
    /* Es la trampa de este diseño: si el validador sumara los extras al
       precio, el total dejaría de cuadrar con las líneas y **toda venta con
       adiciones se rechazaría** con un 400. */
    const r = validarVenta(conExtras([
      { grupo: 'Adiciones', nombre: 'Queso extra', precio: 3000, cantidad: 1 },
      { grupo: 'Adiciones', nombre: 'Tocineta', precio: 4000, cantidad: 1 },
    ]));

    expect(r.ok).toBe(true);
    expect(r.venta.total).toBe(18000);
  });

  it('sin extras la línea no lleva el campo', () => {
    // Para no llenar la base de listas vacías.
    expect(validarVenta(VENTA).venta.items[0].selectedToppings).toBeUndefined();
  });

  it('un extra sin nombre se descarta', () => {
    const r = validarVenta(conExtras([{ grupo: 'Adiciones', precio: 3000 }]));
    expect(r.venta.items[0].selectedToppings).toBeUndefined();
  });

  it('un precio negativo en un extra se vuelve cero', () => {
    // Un extra que resta sería un descuento sin autorizar.
    const r = validarVenta(conExtras([
      { grupo: 'Adiciones', nombre: 'Queso extra', precio: -5000, cantidad: 1 },
    ]));
    expect(r.venta.items[0].selectedToppings[0].price).toBe(0);
  });
});
