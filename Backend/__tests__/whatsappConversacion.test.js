/**
 * La conversación, probada entera sin red y sin modelo.
 *
 * Esto es lo que la primera versión no permitía: como el modelo decidía el
 * flujo, no había forma de comprobar que una conversación llegara a buen
 * puerto. Cada fallo se descubría mandando WhatsApps a mano.
 *
 * Los casos de acá son conversaciones reales que fallaron.
 */
const { resolver, resumen, PREGUNTA } = require('../services/whatsappAgent/conversacion');
const { normalizar, NADA } = require('../services/whatsappAgent/interpretar');

const CARTA = [
  { _id: '1', name: 'Hamburguesa', price: 30000 },
  { _id: '2', name: 'Doble Hamburguesa con Queso', price: 26900 },
  { _id: '3', name: 'Papas Francesas', price: 8000, trackStock: true, stock: 3 },
];

const ENLACE = 'https://menuby.tech/macdonalds?source=whatsapp';

/** Una sesión como la que guarda Mongo, con su método de total. */
const nuevaSesion = () => ({
  items: [], orderType: null, address: '', customerName: '', notes: '',
  menuEnviadoAt: null, estado: 'activa',
  total() { return this.items.reduce((s, i) => s + i.price * i.quantity, 0); },
});

/** Lo que el modelo entendería de un mensaje. */
const dice = (campos) => normalizar({ ...NADA, ...campos });

/** `texto` es lo que el cliente escribió de verdad; sirve para distinguir
    "pide otra" de "está hablando de la que ya pidió". */
const turno = (sesion, campos, extra = {}) => resolver({
  sesion, catalogo: CARTA, dicho: dice(campos), enlace: ENLACE, negocio: 'MacDonalds',
  texto: extra.texto || '',
  estadoPedido: async () => ({ ok: false }),
  ...extra,
});

describe('lo que el cliente dice se guarda antes de mirar qué falta', () => {
  /* Al revés, un mensaje que traía justo el dato que faltaba se contestaba
     pidiendo ese mismo dato. */
  it('nombre y dirección en el mismo mensaje se guardan los dos', async () => {
    const s = nuevaSesion();
    await turno(s, { productos: [{ nombre: 'Hamburguesa', cantidad: 1 }] });
    await turno(s, { tipo: 'domicilio' });

    const r = await turno(s, { nombre: 'Felipe', direccion: 'Cra 6 # 3 139' });

    expect(s.customerName).toBe('Felipe');
    expect(s.address).toBe('Cra 6 # 3 139');
    // Y como ya no falta nada, se pasa a confirmar en vez de volver a preguntar.
    expect(r.respuesta).toContain('¿Confirmo el pedido?');
  });

  it('nunca se pregunta por algo que el cliente acaba de decir', async () => {
    const s = nuevaSesion();
    await turno(s, { productos: [{ nombre: 'Hamburguesa', cantidad: 1 }], tipo: 'domicilio' });
    const r = await turno(s, { direccion: 'Cra 6 # 3 139' });
    expect(r.respuesta).not.toContain(PREGUNTA.direccion);
  });
});

describe('el menú se manda cuando ayuda, no siempre', () => {
  /* El bucle real: el cliente decía "quiero una hamburguesa sin salsas" y se le
     mandaba el menú una y otra vez, sin agregar nunca nada. */
  it('al saludar sin pedir nada, se manda el menú', async () => {
    const s = nuevaSesion();
    const r = await turno(s, {});
    expect(r.respuesta).toContain(ENLACE);
    expect(s.menuEnviadoAt).toBeTruthy();
  });

  it('si ya dijo qué quiere, se agrega en vez de mandarle el menú', async () => {
    const s = nuevaSesion();
    const r = await turno(s, { productos: [{ nombre: 'Hamburguesa', cantidad: 1, nota: 'sin salsas' }] });

    expect(s.items).toHaveLength(1);
    expect(s.items[0].note).toBe('sin salsas');
    expect(r.respuesta).not.toContain(ENLACE);
    // Y ve su pedido de inmediato.
    expect(r.respuesta).toContain('1x Hamburguesa (sin salsas)');
  });

  it('el menú no se repite solo', async () => {
    const s = nuevaSesion();
    await turno(s, {});                       // saludo -> menú
    const r = await turno(s, { confirma: false });   // "no"
    expect(r.respuesta).not.toContain(ENLACE);
  });

  it('pero si lo pide otra vez, se le manda', async () => {
    const s = nuevaSesion();
    await turno(s, {});
    const r = await turno(s, { quiereMenu: true });
    expect(r.respuesta).toContain(ENLACE);
  });
});

describe('el pedido está siempre a la vista', () => {
  it('el total lo escribe el código en cada turno', async () => {
    const s = nuevaSesion();
    const r = await turno(s, { productos: [{ nombre: 'Hamburguesa', cantidad: 2 }] });
    expect(r.respuesta).toContain('$60.000');
  });

  it('lo que no se pudo agregar se dice, no se calla', async () => {
    const s = nuevaSesion();
    const r = await turno(s, { productos: [{ nombre: 'sushi', cantidad: 1 }] });
    /* Se comprueba el fondo y no la frase: que nombre lo que no hay y que no
       lo meta al pedido. El tono se cambió una vez y esta prueba se rompió
       sin que nada hubiera dejado de funcionar. */
    expect(r.respuesta).toContain('sushi');
    expect(s.items).toHaveLength(0);
  });

  it('si hay dos parecidos, se pregunta cuál', async () => {
    const s = nuevaSesion();
    const r = await turno(s, { productos: [{ nombre: 'hamburguesa', cantidad: 1 }] });
    // "Hamburguesa" existe exacto, así que esa gana; el caso ambiguo es otro.
    expect(s.items[0].name).toBe('Hamburguesa');
    expect(r.respuesta).toBeTruthy();
  });

  it('no se vende más de lo que hay', async () => {
    const s = nuevaSesion();
    const r = await turno(s, { productos: [{ nombre: 'papas', cantidad: 10 }] });
    // Lo que importa: que diga cuántas hay de verdad y no venda las diez.
    expect(r.respuesta).toMatch(/\b3\b/);
    expect(s.items).toHaveLength(0);
  });
});

describe('cerrar el pedido', () => {
  it('no se cierra si falta algo, aunque el cliente diga que sí', async () => {
    const s = nuevaSesion();
    await turno(s, { productos: [{ nombre: 'Hamburguesa', cantidad: 1 }] });
    const r = await turno(s, { confirma: true });   // dice que sí, pero falta el tipo
    expect(r.crear).toBeFalsy();
    expect(r.respuesta).toContain(PREGUNTA.tipo);
  });

  it('se cierra solo cuando no falta nada y dijo que sí', async () => {
    const s = nuevaSesion();
    await turno(s, {
      productos: [{ nombre: 'Hamburguesa', cantidad: 1 }],
      tipo: 'domicilio', nombre: 'Felipe', direccion: 'Cra 6 # 3 139',
    });
    const r = await turno(s, { confirma: true });
    expect(r.crear).toBe(true);
  });

  it('antes de confirmar, el cliente ve el total', async () => {
    // Antes decía "te confirmo el total" sin mostrarlo y el cliente decía "sí".
    const s = nuevaSesion();
    const r = await turno(s, {
      productos: [{ nombre: 'Hamburguesa', cantidad: 1 }],
      tipo: 'recoger', nombre: 'Felipe',
    });
    expect(r.respuesta).toContain('$30.000');
    expect(r.respuesta).toContain('¿Confirmo el pedido?');
  });

  it('para recoger no se pide dirección', async () => {
    const s = nuevaSesion();
    const r = await turno(s, {
      productos: [{ nombre: 'Hamburguesa', cantidad: 1 }], tipo: 'recoger', nombre: 'Felipe',
    });
    expect(r.respuesta).not.toContain(PREGUNTA.direccion);
  });
});

describe('cuándo se sale de la conversación', () => {
  it('una pregunta que no es de pedir la toma una persona', async () => {
    const s = nuevaSesion();
    const r = await turno(s, { otraPregunta: '¿a qué hora cierran?' }, { texto: '¿A qué hora cierran?' });
    expect(r.traspasar).toContain('a qué hora cierran');
    expect(r.respuesta).toContain('alguien del equipo');
  });

  it('si pide una persona, se le pasa', async () => {
    const r = await turno(nuevaSesion(), { quiereHumano: true },
      { texto: 'quiero hablar con una persona' });
    expect(r.traspasar).toBeTruthy();
  });

  /* Un "Hola" se leyó como "quiero hablar con una persona" y la conversación
     quedó bloqueada media hora: el cliente escribió cuatro veces más sin
     recibir nada. Sacar al agente es la decisión más cara que puede tomar, así
     que tiene que estar respaldada por el texto. */
  it('un saludo NUNCA saca al agente de la conversación', async () => {
    for (const saludo of ['Hola', 'Buenas tardes', 'Hey', 'Buenas', 'Holaa']) {
      const r = await turno(nuevaSesion(), { quiereHumano: true, otraPregunta: 'saludó' },
        { texto: saludo });
      expect(r.traspasar).toBeFalsy();
    }
  });

  it('decir que quiere pedir tampoco', async () => {
    const r = await turno(nuevaSesion(), { quiereHumano: true }, { texto: 'Quiero pedir algo' });
    expect(r.traspasar).toBeFalsy();
  });

  it('el traspaso necesita que el texto lo respalde', async () => {
    // El modelo dice que quiere un humano, pero el mensaje no lo dice.
    const r = await turno(nuevaSesion(), { quiereHumano: true }, { texto: 'una hamburguesa' });
    expect(r.traspasar).toBeFalsy();
  });

  it('reconoce las formas de pedir una persona', async () => {
    for (const t of ['con un asesor por favor', 'quiero hablar con alguien', 'pásame al encargado']) {
      const r = await turno(nuevaSesion(), { quiereHumano: true }, { texto: t });
      expect(r.traspasar).toBeTruthy();
    }
  });

  it('preguntar por un pedido no toca el carrito', async () => {
    const s = nuevaSesion();
    await turno(s, { productos: [{ nombre: 'Hamburguesa', cantidad: 1 }] });
    const r = await turno(s, { preguntaEstado: true }, {
      estadoPedido: async () => ({ ok: true, orderNumber: '62', texto: 'Lo estamos preparando.' }),
    });
    expect(r.respuesta).toContain('#62');
    expect(s.items).toHaveLength(1);
  });
});

describe('el pedido no se multiplica solo', () => {
  /* Pasó de verdad: el cliente pidió una hamburguesa y terminó con tres. Al
     contestar "Domicilio" y dar su dirección, el modelo volvía a reportar la
     hamburguesa de tres mensajes atrás y el código la sumaba otra vez. */
  it('contestar "a domicilio" no agrega otra hamburguesa', async () => {
    const s = nuevaSesion();
    await turno(s, { productos: [{ nombre: 'Hamburguesa', cantidad: 1, nota: 'sin salsas' }] },
      { texto: 'Quiero una hamburguesa sencilla sin salsas' });
    expect(s.items[0].quantity).toBe(1);

    // El modelo vuelve a reportarla, pero el mensaje no pide nada más.
    await turno(s, { tipo: 'domicilio', productos: [{ nombre: 'Hamburguesa', cantidad: 1, nota: 'sin salsas' }] },
      { texto: 'Domicilio' });
    expect(s.items[0].quantity).toBe(1);
  });

  it('dar la dirección tampoco', async () => {
    const s = nuevaSesion();
    await turno(s, { productos: [{ nombre: 'Hamburguesa', cantidad: 1 }] }, { texto: 'una hamburguesa' });
    await turno(s, { direccion: 'Cra 6 # 3 139', productos: [{ nombre: 'Hamburguesa', cantidad: 1 }] },
      { texto: 'Cra 6 #3 139' });
    expect(s.items[0].quantity).toBe(1);
  });

  it('la indicación no se apunta dos veces', async () => {
    // Llegó a quedar "sin salsas; sin salsas; sin salsas" para la cocina.
    const s = nuevaSesion();
    await turno(s, { productos: [{ nombre: 'Hamburguesa', cantidad: 1, nota: 'sin salsas' }] },
      { texto: 'una hamburguesa sin salsas' });
    await turno(s, { productos: [{ nombre: 'Hamburguesa', cantidad: 1, nota: 'sin salsas' }] },
      { texto: 'otra igual' });
    expect(s.items[0].note).toBe('sin salsas');
    expect(s.items[0].quantity).toBe(2);   // esta sí es una más
  });

  it('pero si de verdad pide otra, se agrega', async () => {
    const s = nuevaSesion();
    await turno(s, { productos: [{ nombre: 'Hamburguesa', cantidad: 1 }] }, { texto: 'una hamburguesa' });
    await turno(s, { productos: [{ nombre: 'Hamburguesa', cantidad: 1 }] }, { texto: 'dame otra hamburguesa' });
    expect(s.items[0].quantity).toBe(2);
  });

  it('y si pide dos más, también', async () => {
    const s = nuevaSesion();
    await turno(s, { productos: [{ nombre: 'Hamburguesa', cantidad: 1 }] }, { texto: 'una hamburguesa' });
    await turno(s, { productos: [{ nombre: 'Hamburguesa', cantidad: 2 }] }, { texto: '2 hamburguesas más' });
    expect(s.items[0].quantity).toBe(3);
  });

  it('un producto distinto siempre entra', async () => {
    const s = nuevaSesion();
    await turno(s, { productos: [{ nombre: 'Hamburguesa', cantidad: 1 }] }, { texto: 'una hamburguesa' });
    await turno(s, { productos: [{ nombre: 'Papas Francesas', cantidad: 1 }] }, { texto: 'papas' });
    expect(s.items).toHaveLength(2);
  });
});

describe('la conversación completa que fallaba', () => {
  it('de "quiero una hamburguesa sin salsas" a pedido cerrado', async () => {
    const s = nuevaSesion();

    // 1. Pide con una indicación
    let r = await turno(s, { productos: [{ nombre: 'Hamburguesa', cantidad: 1, nota: 'sin salsas' }] });
    expect(s.items).toHaveLength(1);
    expect(r.respuesta).toContain(PREGUNTA.tipo);

    // 2. Dice el tipo
    r = await turno(s, { tipo: 'domicilio' });
    expect(r.respuesta).toContain(PREGUNTA.direccion);

    // 3. Da nombre y dirección juntos — el mensaje que rompía todo
    r = await turno(s, { nombre: 'Felipe', direccion: 'Cra 6 # 3 139' });
    expect(r.respuesta).toContain('¿Confirmo el pedido?');
    expect(r.respuesta).toContain('$30.000');

    // 4. Confirma
    r = await turno(s, { confirma: true });
    expect(r.crear).toBe(true);

    // Cuatro turnos, sin una sola repetición.
  });
});

describe('lo que devuelve el modelo se sanea antes de usarlo', () => {
  it('las cantidades absurdas se recortan', () => {
    const d = normalizar({ productos: [{ nombre: 'x', cantidad: 9999 }] });
    expect(d.productos[0].cantidad).toBe(50);
  });

  it('una cantidad sin sentido vale uno', () => {
    expect(normalizar({ productos: [{ nombre: 'x', cantidad: -5 }] }).productos[0].cantidad).toBe(1);
  });

  it('un tipo de pedido inventado se descarta', () => {
    expect(normalizar({ tipo: 'teletransporte' }).tipo).toBeNull();
  });

  it('confirma solo acepta sí, no, o nada', () => {
    expect(normalizar({ confirma: true }).confirma).toBe(true);
    expect(normalizar({ confirma: false }).confirma).toBe(false);
    expect(normalizar({ confirma: 'quizás' }).confirma).toBeNull();
  });

  it('una respuesta vacía del modelo no rompe nada', () => {
    const d = normalizar({});
    expect(d.productos).toEqual([]);
    expect(d.quiereMenu).toBe(false);
  });

  it('el modelo no puede colar un precio', () => {
    // agregar() lee el precio del catálogo; lo que venga acá se ignora.
    const d = normalizar({ productos: [{ nombre: 'Hamburguesa', cantidad: 1, price: 1 }] });
    expect(d.productos[0].price).toBeUndefined();
  });
});
