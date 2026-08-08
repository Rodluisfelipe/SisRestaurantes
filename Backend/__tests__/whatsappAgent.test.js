/**
 * El agente que atiende por WhatsApp.
 *
 * Lo que se prueba acá es el reparto de trabajo: que el modelo no pueda elegir
 * un precio, inventar existencias ni armar un total. Si esa frontera se rompe,
 * vuelven los pedidos con el total equivocado, pero esta vez sin nadie
 * revisándolos antes de que salgan.
 */
const fs = require('fs');
const path = require('path');
const acciones = require('../services/whatsappAgent/acciones');

const CATALOGO = [
  { _id: 'a1', name: 'Hamburguesa Doble Queso', price: 18000, trackStock: false },
  { _id: 'a2', name: 'Papas Francesas', price: 8000, trackStock: true, stock: 3 },
  { _id: 'a3', name: 'Hamburguesa Sencilla', price: 14000, trackStock: false },
  { _id: 'a4', name: 'Limonada de Coco', price: 9000, trackStock: true, stock: 0 },
];

const sesionVacia = () => ({
  items: [], orderType: null, address: '', customerName: '', notes: '',
  contactPhone: '573138178003',
});

describe('encontrar el producto del que habla el cliente', () => {
  it('lo encuentra por nombre completo', () => {
    expect(acciones.buscarProducto(CATALOGO, 'Papas Francesas').producto.name).toBe('Papas Francesas');
  });

  it('lo encuentra por una parte del nombre', () => {
    expect(acciones.buscarProducto(CATALOGO, 'papas').producto.name).toBe('Papas Francesas');
  });

  it('no le importan mayúsculas ni tildes', () => {
    expect(acciones.buscarProducto(CATALOGO, 'LIMONADA DE COCO').producto.name).toBe('Limonada de Coco');
    expect(acciones.buscarProducto(CATALOGO, 'papas frances').producto.name).toBe('Papas Francesas');
  });

  it('cuando hay varias opciones no elige por su cuenta', () => {
    // Elegir una de dos hamburguesas sin preguntar es venderle al cliente algo
    // que no pidió.
    const r = acciones.buscarProducto(CATALOGO, 'hamburguesa');
    expect(r.producto).toBeUndefined();
    expect(r.opciones).toHaveLength(2);
  });

  it('lo que no está en la carta no existe', () => {
    expect(acciones.buscarProducto(CATALOGO, 'sushi').ninguno).toBe(true);
    expect(acciones.buscarProducto(CATALOGO, '').ninguno).toBe(true);
  });
});

describe('el nombre más específico gana', () => {
  /* Un cliente pidió "una hamburguesa doble sin salsas" y recibió una
     Hamburguesa sencilla: bastaba con que la consulta contuviera el nombre de
     un producto para darlo por bueno, así que el nombre más corto se tragaba
     las peticiones más específicas. */
  const CARTA = [
    { _id: '1', name: 'Hamburguesa', price: 30000 },
    { _id: '2', name: 'Doble Hamburguesa con Queso', price: 26900 },
    { _id: '3', name: 'Chicken McNuggets 6 pz', price: 24900 },
    { _id: '4', name: 'Chicken McNuggets 10 pz', price: 32000 },
    { _id: '5', name: 'McFlurry Oreo', price: 19500 },
    { _id: '6', name: 'McFlurry M&M', price: 17900 },
  ];
  const cual = (q) => acciones.buscarProducto(CARTA, q).producto?.name;

  it('pedir la doble no devuelve la sencilla', () => {
    expect(cual('hamburguesa doble')).toBe('Doble Hamburguesa con Queso');
    expect(cual('una hamburguesa doble sin salsas')).toBe('Doble Hamburguesa con Queso');
  });

  it('pedir la sencilla sigue devolviendo la sencilla', () => {
    expect(cual('hamburguesa')).toBe('Hamburguesa');
  });

  it('la cifra distingue la porción', () => {
    // "de" se descarta por corta, pero el número es lo que decide.
    expect(cual('nuggets de 6')).toBe('Chicken McNuggets 6 pz');
    expect(cual('nuggets de 10')).toBe('Chicken McNuggets 10 pz');
  });

  it('sin la cifra, pregunta cuál', () => {
    const r = acciones.buscarProducto(CARTA, 'nuggets');
    expect(r.producto).toBeUndefined();
    expect(r.opciones).toHaveLength(2);
  });

  it('reconoce un trozo de palabra', () => {
    // El cliente dice "nuggets"; el producto se llama "McNuggets".
    expect(acciones.buscarProducto(CARTA, 'nuggets').opciones).toBeDefined();
    expect(cual('mcflurry oreo')).toBe('McFlurry Oreo');
  });

  it('el sabor decide entre dos del mismo tipo', () => {
    expect(acciones.buscarProducto(CARTA, 'mcflurry').opciones).toHaveLength(2);
    expect(cual('un helado oreo')).toBe('McFlurry Oreo');
  });
});

describe('las indicaciones del cliente no se pierden', () => {
  it('la nota queda guardada en la línea', async () => {
    // "sin salsas" se repetía de vuelta pero no llegaba a la cocina.
    const s = sesionVacia();
    await acciones.agregar(s, CATALOGO, { producto: 'papas', cantidad: 1, nota: 'sin sal' });
    expect(s.items[0].note).toBe('sin sal');
  });

  it('dos indicaciones sobre lo mismo se acumulan', async () => {
    const s = sesionVacia();
    await acciones.agregar(s, CATALOGO, { producto: 'papas', cantidad: 1, nota: 'sin sal' });
    await acciones.agregar(s, CATALOGO, { producto: 'papas', cantidad: 1, nota: 'bien doradas' });
    expect(s.items[0].note).toBe('sin sal; bien doradas');
    expect(s.items[0].quantity).toBe(2);
  });

  it('una indicación desmedida se recorta', async () => {
    const s = sesionVacia();
    await acciones.agregar(s, CATALOGO, { producto: 'papas', cantidad: 1, nota: 'x'.repeat(500) });
    expect(s.items[0].note.length).toBe(120);
  });
});

describe('el precio y el stock salen de la base, no del modelo', () => {
  it('el precio que se guarda es el del catálogo', async () => {
    const s = sesionVacia();
    const r = await acciones.agregar(s, CATALOGO, { producto: 'papas', cantidad: 2 });
    expect(r.ok).toBe(true);
    expect(s.items[0].price).toBe(8000);       // no lo dijo el modelo
    expect(s.items[0].quantity).toBe(2);
  });

  it('no se puede vender más de lo que hay', async () => {
    const s = sesionVacia();
    const r = await acciones.agregar(s, CATALOGO, { producto: 'papas', cantidad: 10 });
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('sin_stock');
    expect(r.disponible).toBe(3);
    expect(s.items).toHaveLength(0);
  });

  it('lo agotado no se vende', async () => {
    const s = sesionVacia();
    const r = await acciones.agregar(s, CATALOGO, { producto: 'limonada', cantidad: 1 });
    expect(r.ok).toBe(false);
    expect(r.disponible).toBe(0);
  });

  it('sumar dos veces no permite saltarse el stock', async () => {
    // Pedir 2 y luego 2 más de algo con 3 unidades tiene que fallar la segunda.
    const s = sesionVacia();
    expect((await acciones.agregar(s, CATALOGO, { producto: 'papas', cantidad: 2 })).ok).toBe(true);
    const r = await acciones.agregar(s, CATALOGO, { producto: 'papas', cantidad: 2 });
    expect(r.ok).toBe(false);
    expect(s.items[0].quantity).toBe(2);   // quedó como estaba
  });

  it('pedir lo mismo otra vez suma, no duplica la línea', async () => {
    const s = sesionVacia();
    await acciones.agregar(s, CATALOGO, { producto: 'hamburguesa doble', cantidad: 1 });
    await acciones.agregar(s, CATALOGO, { producto: 'hamburguesa doble', cantidad: 2 });
    expect(s.items).toHaveLength(1);
    expect(s.items[0].quantity).toBe(3);
  });

  it('una cantidad disparatada se recorta', async () => {
    const s = sesionVacia();
    await acciones.agregar(s, CATALOGO, { producto: 'hamburguesa doble', cantidad: 9999 });
    expect(s.items[0].quantity).toBe(50);
  });

  it('una cantidad sin sentido se toma como una', async () => {
    const s = sesionVacia();
    await acciones.agregar(s, CATALOGO, { producto: 'hamburguesa doble', cantidad: -3 });
    expect(s.items[0].quantity).toBe(1);
  });
});

describe('qué falta para poder cerrar el pedido', () => {
  it('un pedido vacío no está listo', () => {
    expect(acciones.queFalta(sesionVacia())).toContain('productos');
  });

  it('un domicilio sin dirección no está listo', async () => {
    const s = sesionVacia();
    await acciones.agregar(s, CATALOGO, { producto: 'papas', cantidad: 1 });
    acciones.fijarTipo(s, { tipo: 'domicilio' });
    acciones.fijarDatos(s, { nombre: 'Felipe' });
    expect(acciones.queFalta(s)).toEqual(['direccion']);
  });

  it('para recoger no se pide dirección', async () => {
    const s = sesionVacia();
    await acciones.agregar(s, CATALOGO, { producto: 'papas', cantidad: 1 });
    acciones.fijarTipo(s, { tipo: 'recoger' });
    acciones.fijarDatos(s, { nombre: 'Felipe' });
    expect(acciones.queFalta(s)).toEqual([]);
  });

  it('entiende cómo lo dice la gente', () => {
    const s = sesionVacia();
    expect(acciones.fijarTipo(s, { tipo: 'domicilio' }).tipo).toBe('delivery');
    expect(acciones.fijarTipo(s, { tipo: 'recoger' }).tipo).toBe('takeaway');
    expect(acciones.fijarTipo(s, { tipo: 'mesa' }).tipo).toBe('inSite');
    expect(acciones.fijarTipo(s, { tipo: 'volando' }).ok).toBe(false);
  });

  it('quitar del pedido funciona', async () => {
    const s = sesionVacia();
    await acciones.agregar(s, CATALOGO, { producto: 'papas', cantidad: 1 });
    await acciones.agregar(s, CATALOGO, { producto: 'hamburguesa doble', cantidad: 1 });
    expect(acciones.quitar(s, CATALOGO, { producto: 'papas' }).ok).toBe(true);
    expect(s.items).toHaveLength(1);
    expect(s.items[0].name).toBe('Hamburguesa Doble Queso');
  });
});

describe('la frontera entre el modelo y el código', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'whatsappAgent', 'index.js'), 'utf8');
  const srcAcc = fs.readFileSync(path.join(__dirname, '..', 'services', 'whatsappAgent', 'acciones.js'), 'utf8');

  it('al modelo se le prohíbe escribir precios', () => {
    expect(src).toMatch(/NUNCA escribas precios/i);
  });

  it('el resumen del pedido lo escribe el código', () => {
    // Si el modelo se inventa una cifra, la que el cliente lee de última es la nuestra.
    expect(src).toMatch(/function resumen\(sesion\)/);
    expect(src).toMatch(/respuesta \+= resumen\(sesion\)/);
  });

  /* El modelo llegó a decir "te agrego una doble hamburguesa" sin ejecutar la
     acción. Como el resumen solo salía cuando el pedido cambiaba, no se mostró
     nada y el cliente siguió creyendo que estaba pedida. */
  it('el pedido se muestra en cada turno, no solo cuando cambia', () => {
    expect(src).toMatch(/if \(sesion\.items\?\.length && !yaSeCerro/);
  });

  it('se pregunta por la confirmación mostrando el total', () => {
    // Antes decía "te confirmo el total" sin mostrarlo y el cliente decía "sí".
    expect(src).toMatch(/¿Confirmo el pedido\?/);
  });

  it('al modelo se le exige ejecutar la acción, no solo anunciarla', () => {
    expect(src).toMatch(/Nunca digas que agregaste algo sin ejecutar la acción/);
  });

  it('el precio nunca viene de los argumentos del modelo', () => {
    /* Se comprueba la garantía, no la firma exacta: lo que agregar() recibe del
       modelo no puede incluir un precio, y el que guarda sale del catálogo. */
    const firma = srcAcc.match(/async function agregar\(sesion, catalogo, \{([^}]*)\}\)/);
    expect(firma).not.toBeNull();
    expect(firma[1]).not.toMatch(/precio|price|valor|total/i);
    expect(srcAcc).toContain('price: Number(p.price) || 0');
  });

  it('los precios se releen de la base antes de crear el pedido', () => {
    const fn = srcAcc.slice(srcAcc.indexOf('async function crearPedido'));
    expect(fn).toMatch(/Product\.find\(\{ _id: \{ \$in: ids \}, businessId \}\)/);
    expect(fn).toMatch(/const precio = Number\(p\.price\) \|\| 0/);
  });

  it('el agente no calcula el domicilio', () => {
    // Las zonas son polígonos y tarifas por distancia; una dirección escrita a
    // mano no da coordenadas fiables, y cobrar mal el envío ya nos pasó.
    expect(srcAcc).toContain('deliveryCalculated: false');
  });

  it('el pedido se crea por la misma API que usa el panel', () => {
    const ruta = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'whatsappInbox.js'), 'utf8');
    expect(ruta).toContain('/api/orders');
    expect(ruta).not.toMatch(/new Order\(/);   // nada de escribir la colección a mano
  });

  it('si el modelo falla, el agente calla en vez de improvisar', () => {
    expect(src).toMatch(/catch[\s\S]{0,400}con_humano/);
    expect(src).toMatch(/mejor no responder que responder cualquier cosa/);
  });

  it('el agente viene apagado de fábrica', () => {
    const modelo = fs.readFileSync(path.join(__dirname, '..', 'Models', 'WhatsAppAccount.js'), 'utf8');
    expect(modelo).toMatch(/activo: \{ type: Boolean, default: false \}/);
  });

  /* Una conversación pasada a un humano se quedaba muda para siempre: si nadie
     del negocio contestaba, el cliente esperaba indefinidamente sin respuesta
     ni explicación. Pasó de verdad al preguntar por los horarios. */
  it('el traspaso a una persona caduca si nadie lo atiende', () => {
    expect(src).toContain('ESPERA_HUMANO_MS');
    expect(src).toMatch(/if \(respondioAlguien \|\| !vencido\) return null/);
    expect(src).toMatch(/sesion\.estado = 'activa'/);
  });

  it('se considera atendido solo si el negocio escribió después del traspaso', () => {
    // El plazo por sí solo no basta: si alguien ya contestó, el agente no vuelve.
    expect(src).toMatch(/direction: 'out', sentAt: \{ \$gt: desde \}/);
  });

  it('cada traspaso deja constancia de cuándo fue', () => {
    const traspasos = (src.match(/sesion\.estado = 'con_humano';/g) || []).length;
    const marcas = (src.match(/sesion\.traspasadoEn = new Date\(\);/g) || []).length;
    expect(traspasos).toBeGreaterThan(0);
    expect(marcas).toBe(traspasos);
  });

  it('si contesta una persona, el agente se calla', () => {
    // Responder desde el panel marca la conversación como atendida...
    const ruta = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'whatsappInbox.js'), 'utf8');
    expect(ruta).toMatch(/contestó una persona del negocio/);
    // ...y el agente comprueba ese estado antes de decir nada.
    expect(src).toMatch(/if \(sesion\.estado === 'con_humano'\) \{/);
    expect(src).toMatch(/respondioAlguien/);
  });

  it('un reintento de Meta no hace que conteste dos veces', () => {
    const ruta = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'whatsappInbox.js'), 'utf8');
    expect(ruta).toMatch(/if \(guardado\) await quizaContesteElAgente/);
  });
});

describe('la carta la imprime el código', () => {
  /* El modelo la redactaba de memoria y salía un chorizo corrido, sin precios,
     todo en una línea y mezclando categorías. */
  const { cartaParaCliente } = require('../services/whatsappAgent');
  const CARTA = [
    { _id: '1', name: 'Hamburguesa', price: 30000, category: { name: 'Hamburguesas' } },
    { _id: '2', name: 'Doble Hamburguesa con Queso', price: 26900, category: { name: 'Hamburguesas' } },
    { _id: '3', name: 'McFlurry Oreo', price: 19500, category: { name: 'Postres' } },
    { _id: '4', name: 'Sin categoría', price: 1000 },
  ];

  it('agrupa por categoría y pone los precios', () => {
    const texto = cartaParaCliente(CARTA);
    expect(texto).toContain('*Hamburguesas*');
    expect(texto).toContain('*Postres*');
    expect(texto).toContain('$30.000');
    expect(texto).toContain('$19.500');
  });

  it('lo que no tiene categoría no se pierde', () => {
    expect(cartaParaCliente(CARTA)).toContain('*Otros*');
  });

  it('puede mostrar solo una categoría', () => {
    const soloPostres = cartaParaCliente(CARTA, 'postres');
    expect(soloPostres).toContain('McFlurry Oreo');
    expect(soloPostres).not.toContain('Hamburguesa');
  });

  it('al modelo se le prohíbe enumerar la carta', () => {
    const fs2 = require('fs');
    const path2 = require('path');
    const src2 = fs2.readFileSync(path2.join(__dirname, '..', 'services', 'whatsappAgent', 'index.js'), 'utf8');
    expect(src2).toMatch(/ni enumeres la carta/);
    expect(src2).toMatch(/mostrar_carta/);
  });

  it('no se ofrecen productos que el negocio desactivó', () => {
    // El agente llegó a ofrecer un producto llamado "Prueba" que estaba apagado.
    const fs2 = require('fs');
    const path2 = require('path');
    const src2 = fs2.readFileSync(path2.join(__dirname, '..', 'services', 'whatsappAgent', 'index.js'), 'utf8');
    expect(src2).toMatch(/active: \{ \$ne: false \}/);
  });
});

describe('llevar al cliente al menú', () => {
  /* Armar el pedido conversando cuesta diez o quince mensajes; mandar el enlace
     cuesta uno. Con el mismo cupo, llevar al menú rinde diez veces más, y el
     pedido entra mejor porque el cliente ve fotos, tamaños y extras. */
  const { enlaceMenu } = require('../services/whatsappAgent');
  const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'whatsappAgent', 'index.js'), 'utf8');

  it('el enlace lleva la marca de por dónde vino', () => {
    expect(enlaceMenu('doggitos')).toContain('/doggitos?source=whatsapp');
  });

  it('sin slug no se inventa un enlace', () => {
    // Mandar a una página que no existe es peor que seguir por chat.
    expect(enlaceMenu(null)).toBeNull();
    expect(enlaceMenu('')).toBeNull();
  });

  it('el enlace lo escribe el código, no el modelo', () => {
    expect(src).toMatch(/ni escribas el enlace del menú/);
    expect(src).toMatch(/case 'mandar_menu'/);
  });

  it('mandar el menú es lo preferido en las instrucciones', () => {
    expect(src).toMatch(/LO PRIMERO QUE HAY QUE HACER/);
    expect(src).toMatch(/lo PREFERIDO/);
  });

  it('si no hay enlace, el agente sigue por chat', () => {
    // No se le dan instrucciones de derivar si no hay a dónde derivar.
    expect(src).toMatch(/\$\{enlace \? `LO PRIMERO/);
  });
});

describe('en qué va mi pedido', () => {
  it('traduce cada estado a algo que el cliente entienda', () => {
    // Y no promete tiempos, que es lo que el agente no puede saber.
    expect(acciones.COMO_VA.preparing).toMatch(/prepar/i);
    expect(acciones.COMO_VA.ready).toMatch(/listo/i);
    expect(acciones.COMO_VA.cancelled).toMatch(/cancel/i);
    for (const texto of Object.values(acciones.COMO_VA)) {
      expect(texto).not.toMatch(/\d+\s*(minutos|horas)/i);
    }
  });

  it('cubre todos los estados en que puede estar un pedido', () => {
    const orders = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'orders.js'), 'utf8');
    const bloque = orders.slice(orders.indexOf('const VALID_TRANSITIONS = {'));
    const estados = [...bloque.slice(0, 900).matchAll(/^\s*'([a-z_A-Z]+)':/gm)].map((m) => m[1]);
    expect(estados.length).toBeGreaterThan(5);
    const sinTexto = estados.filter((e) => !acciones.COMO_VA[e]);
    expect(sinTexto).toEqual([]);
  });

  it('el pedido en curso manda sobre el ya entregado', async () => {
    const enCurso = { orderNumber: '99', status: 'preparing' };
    const viejo = { orderNumber: '10', status: 'completed' };
    const r = await acciones.estadoDelPedido({
      businessId: 'b1', contactPhone: '573138178003',
      Order: { findOne: () => ({ sort: () => ({ select: () => ({ lean: async () => enCurso }) }) }) },
      CompletedOrder: { findOne: () => ({ sort: () => ({ select: () => ({ lean: async () => viejo }) }) }) },
      variantes: (p) => [p],
    });
    expect(r.orderNumber).toBe('99');
    expect(r.enCurso).toBe(true);
  });

  it('sin pedidos lo dice en vez de inventarse uno', async () => {
    const vacio = { findOne: () => ({ sort: () => ({ select: () => ({ lean: async () => null }) }) }) };
    const r = await acciones.estadoDelPedido({
      businessId: 'b1', contactPhone: '573138178003',
      Order: vacio, CompletedOrder: vacio, variantes: (p) => [p],
    });
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('sin_pedidos');
  });
});

describe('de qué enlace vino el cliente', () => {
  const modelo = fs.readFileSync(path.join(__dirname, '..', 'Models', 'Order.js'), 'utf8');
  const ruta = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'orders.js'), 'utf8');

  it('el pedido guarda el origen aparte del canal', () => {
    // orderChannel dice CÓMO se tomó; source dice qué enlace lo trajo.
    expect(modelo).toMatch(/source: \{[\s\S]{0,160}maxlength: 40/);
    expect(modelo).toMatch(/orderChannel: \{/);
  });

  it('lo que llega de la URL se limpia antes de guardarlo', () => {
    expect(ruta).toMatch(/source \? String\(source\)[\s\S]{0,80}replace\(/);
  });

  it('el frontend recuerda el origen mientras el cliente navega', () => {
    const util = fs.readFileSync(
      path.join(__dirname, '..', '..', 'Frontend', 'src', 'utils', 'origenVisita.js'), 'utf8',
    );
    // El parámetro se pierde al navegar por categorías; el pedido se crea después.
    expect(util).toContain('sessionStorage');
    expect(util).toMatch(/params\.get\('source'\)/);
    // Y no puede romper el menú si el navegador bloquea el almacenamiento.
    expect(util).toMatch(/catch \{/);
  });

  it('la atribución mide las dos colecciones de pedidos', () => {
    // Los pedidos viven en activos y completados; mirar una sola da la mitad.
    const inbox = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'whatsappInbox.js'), 'utf8');
    const fn = inbox.slice(inbox.indexOf("router.get('/origen'"));
    expect(fn).toContain('CompletedOrder.aggregate');
    expect(fn).toContain('Order.aggregate');
    // Y los cancelados no cuentan como venta.
    expect(fn).toMatch(/status: \{ \$ne: 'cancelled' \}/);
  });

  it('los pedidos sin marcar no se esconden', () => {
    // Si se filtraran, el total no cuadraría con las ventas reales.
    const inbox = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'whatsappInbox.js'), 'utf8');
    expect(inbox).toMatch(/\$ifNull: \['\$source', 'sin-marcar'\]/);
  });

  it('la pantalla muestra de dónde vienen los pedidos', () => {
    const inbox = fs.readFileSync(
      path.join(__dirname, '..', '..', 'Frontend', 'src', 'Components', 'Admin', 'WhatsAppInbox.jsx'), 'utf8',
    );
    expect(inbox).toContain('OrigenPedidos');
    expect(inbox).toMatch(/whatsapp-inbox\/origen/);
  });

  it('cada chat muestra en qué anda sin tener que abrirlo', () => {
    const inbox = fs.readFileSync(
      path.join(__dirname, '..', '..', 'Frontend', 'src', 'Components', 'Admin', 'WhatsAppInbox.jsx'), 'utf8',
    );
    for (const marca of ['Sin responder', 'Contestado', 'Menú enviado', 'Lo tomó alguien', 'Atiende el bot']) {
      expect(inbox).toContain(marca);
    }
    // Y el backend le pasa los datos que esas marcas necesitan.
    const ruta = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'whatsappInbox.js'), 'utf8');
    expect(ruta).toMatch(/esperandoRespuesta: c\.lastDirection === 'in'/);
    expect(ruta).toMatch(/menuEnviado: !!s\.menuEnviadoAt/);
  });

  it('el menú manda el origen al crear el pedido', () => {
    const menu = fs.readFileSync(
      path.join(__dirname, '..', '..', 'Frontend', 'src', 'Pages', 'Menu.jsx'), 'utf8',
    );
    expect(menu).toMatch(/registrarOrigen\(\)/);
    expect(menu).toMatch(/source: origenActual\(\)/);
  });
});

describe('el cupo de conversaciones', () => {
  /* El complemento se cobra fijo pero atender cuesta por mensaje: sin tope, un
     solo negocio con mucho tráfico se lleva el margen de todos los demás. */
  const cupo = require('../services/whatsappAgent/cupo');
  const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'whatsappAgent', 'index.js'), 'utf8');
  const cuentaNueva = () => ({ agente: {} });

  it('trae el cupo del complemento', () => {
    expect(cupo.cupoDe(cuentaNueva())).toBe(500);
  });

  it('se puede vender un paquete distinto', () => {
    expect(cupo.cupoDe({ agente: { cupoConversaciones: 2000 } })).toBe(2000);
  });

  it('cuenta conversaciones y avisa cuando se agota', () => {
    const c = cuentaNueva();
    expect(cupo.tieneCupo(c)).toBe(true);
    for (let i = 0; i < 500; i++) cupo.contarConversacion(c);
    expect(cupo.estado(c).restantes).toBe(0);
    expect(cupo.estado(c).agotado).toBe(true);
    expect(cupo.tieneCupo(c)).toBe(false);
  });

  it('arranca de cero al cambiar el mes, sin tarea programada', () => {
    const c = cuentaNueva();
    for (let i = 0; i < 400; i++) cupo.contarConversacion(c);
    c.agente.consumo.periodo = '2020-01';        // como si fuera de otro mes
    expect(cupo.estado(c).usadas).toBe(0);
    expect(cupo.estado(c).periodo).toBe(cupo.periodoActual());
  });

  it('los mensajes se cuentan aparte, para ver el costo real', () => {
    const c = cuentaNueva();
    cupo.contarConversacion(c);
    cupo.contarMensaje(c);
    cupo.contarMensaje(c);
    expect(cupo.estado(c)).toMatchObject({ usadas: 1, mensajes: 2 });
  });

  it('una conversación ya empezada no se corta a media frase', () => {
    // Solo se frenan las NUEVAS: cortarle a alguien a mitad es peor que
    // atender una de más.
    expect(src).toMatch(/esConversacionNueva && !cupo\.tieneCupo\(account\)/);
  });

  it('sin cupo no se corta la bandeja, solo el agente', () => {
    const ruta = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'whatsappInbox.js'), 'utf8');
    expect(ruta).toMatch(/e\.code === 'SIN_CUPO'/);
    // El mensaje ya quedó guardado antes de que el agente entrara en juego.
    expect(ruta).toMatch(/if \(guardado\) await quizaContesteElAgente/);
  });

  it('se cuenta después de atender, no antes', () => {
    // Si el modelo falla y no se responde nada, no se descuenta nada.
    const i = src.indexOf('await sesion.save()');
    const j = src.indexOf('cupo.contarConversacion(account)');
    expect(j).toBeGreaterThan(i);
  });
});

describe('el complemento del agente', () => {
  const { getEffectiveFeatures, getPlanConfig, getAddonConfig } = require('../utils/commercialPlans');

  it('no sirve sin la bandeja', () => {
    // Un agente sin número conectado no tiene a quién contestar.
    const soloAgente = getEffectiveFeatures(getPlanConfig('free'), {
      addons: [{ key: 'whatsapp_agent', status: 'active', periodEnd: null }],
    });
    expect(soloAgente.whatsappAgent).toBeFalsy();
  });

  it('con la bandeja sí queda activo', () => {
    const ambos = getEffectiveFeatures(getPlanConfig('free'), {
      addons: [
        { key: 'whatsapp_inbox', status: 'active', periodEnd: null },
        { key: 'whatsapp_agent', status: 'active', periodEnd: null },
      ],
    });
    expect(ambos.whatsappInbox).toBe(true);
    expect(ambos.whatsappAgent).toBe(true);
  });

  it('declara de qué depende', () => {
    expect(getAddonConfig('whatsapp_agent').requiere).toBe('whatsapp_inbox');
  });
});
