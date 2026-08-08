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
    expect(src).toMatch(/if \(cambioElPedido\) respuesta \+= resumen\(sesion\)/);
  });

  it('el precio nunca viene de los argumentos del modelo', () => {
    // agregar() sólo acepta producto y cantidad: no hay forma de pasarle un precio.
    expect(srcAcc).toMatch(/async function agregar\(sesion, catalogo, \{ producto: nombre, cantidad = 1 \}\)/);
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

  it('si contesta una persona, el agente se calla', () => {
    const ruta = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'whatsappInbox.js'), 'utf8');
    expect(ruta).toMatch(/contestó una persona del negocio/);
    expect(src).toMatch(/if \(sesion\.estado === 'con_humano'\) return null/);
  });

  it('un reintento de Meta no hace que conteste dos veces', () => {
    const ruta = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'whatsappInbox.js'), 'utf8');
    expect(ruta).toMatch(/if \(guardado\) await quizaContesteElAgente/);
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
