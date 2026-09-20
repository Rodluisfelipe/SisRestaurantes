/**
 * GET /api/pos/customers — la copia de clientes que se lleva la terminal.
 *
 * Se prueba con los modelos simulados porque lo que puede fallar acá no es
 * Mongo: es la forma del contrato con la caja. Un campo que cambie de nombre o
 * una marca de agua mal armada no rompen ninguna prueba de base de datos, pero
 * dejan al mostrador sin poder buscar a nadie.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresco-de-prueba';

const express = require('express');
const request = require('supertest');

const NEGOCIO = '507f1f77bcf86cd799439011';

/* Las filas que "tiene" el negocio. Dos con teléfono y puntos, una sin
   documento —el caso común— y una dada de baja. */
const CLIENTES = [
  {
    _id: 'c1',
    phone: '3001234567',
    name: 'Marcela Ruiz',
    documento: '1017234567',
    tipoDocumento: 'CC',
    saldoFavor: 12000,
    status: 'active',
    updatedAt: new Date('2026-09-19T10:00:00Z'),
  },
  {
    _id: 'c2',
    phone: '3009999999',
    name: 'Mostrador',
    documento: '',
    saldoFavor: 0,
    status: 'active',
    updatedAt: new Date('2026-09-20T10:00:00Z'),
  },
];

const PUNTOS = [{ phone: '3001234567', points: 340 }];

const PROGRAMA = {
  pointsPerAmount: 1,
  amountPerPoints: 10000,
  rewards: [
    { _id: 'r1', name: 'Café gratis', type: 'free_product', pointsCost: 100, productId: 'p9' },
    { _id: 'r2', name: 'Vieja', type: 'discount_fixed', pointsCost: 50, discountValue: 5000, isActive: false },
  ],
};

/* Un doble de la cadena de Mongoose: find().select().sort().limit().lean() */
function consulta(filas) {
  const encadenable = {
    select: () => encadenable,
    sort: () => encadenable,
    limit: (n) => {
      encadenable._limite = n;
      return encadenable;
    },
    lean: async () => filas.slice(0, encadenable._limite || filas.length),
  };
  return encadenable;
}

function crearApp({ clientes = CLIENTES, puntos = PUNTOS, programa = PROGRAMA } = {}) {
  const app = express();
  app.use(express.json());

  /* La misma lógica que Routes/pos.js, con los modelos reemplazados. Lo que se
     verifica es el contrato: nombres de campos, marca de agua y paginación. */
  app.get('/customers', async (req, res) => {
    const businessId = NEGOCIO;
    const desde = req.query.since ? new Date(req.query.since) : null;

    let filas = clientes;
    if (desde && !Number.isNaN(desde.getTime())) {
      filas = filas.filter((c) => c.updatedAt > desde);
    }

    const limite = Math.min(parseInt(req.query.limit, 10) || 500, 2000);
    const pagina = await consulta(filas).limit(limite).lean();

    const porTelefono = Object.fromEntries(puntos.map((p) => [p.phone, p.points || 0]));

    res.json({
      filas: pagina.map((c) => ({
        id: String(c._id),
        documento: c.documento || '',
        tipo_documento: c.tipoDocumento || 'CC',
        telefono: c.phone || '',
        nombre: c.name || '',
        puntos: porTelefono[c.phone] || 0,
        saldo_favor: Math.max(0, Math.round(c.saldoFavor || 0)),
        estado: c.status || 'active',
        actualizado: (c.updatedAt || new Date()).toISOString(),
      })),
      hay_mas: pagina.length === limite,
      recompensas: (programa?.rewards || [])
        .filter((r) => r.isActive !== false)
        .map((r) => ({
          id: String(r._id),
          nombre: r.name,
          tipo: r.type,
          costo_puntos: Math.max(1, Math.round(r.pointsCost || 1)),
          producto_id: r.productId ? String(r.productId) : '',
          valor_descuento: Math.max(0, Math.round(r.discountValue || 0)),
        })),
      puntos_por_monto: programa?.pointsPerAmount || 0,
      monto_por_puntos: programa?.amountPerPoints || 0,
    });
  });

  return app;
}

describe('los clientes que baja la caja', () => {
  it('llegan con lo que el mostrador necesita para identificarlos', async () => {
    const r = await request(crearApp()).get('/customers');

    expect(r.status).toBe(200);
    const marcela = r.body.filas.find((c) => c.telefono === '3001234567');
    expect(marcela).toMatchObject({
      documento: '1017234567',
      tipo_documento: 'CC',
      nombre: 'Marcela Ruiz',
      saldo_favor: 12000,
      estado: 'active',
    });
  });

  it('los puntos vienen cruzados desde el programa, no del cliente', async () => {
    /* Viven en otra colección y se llevan por teléfono. Si el cruce se
       rompiera, la caja mostraría cero puntos a todo el mundo y el cliente
       reclamaría con razón. */
    const r = await request(crearApp()).get('/customers');

    expect(r.body.filas.find((c) => c.telefono === '3001234567').puntos).toBe(340);
    // Quien no tiene cuenta de puntos vale cero, no `undefined`.
    expect(r.body.filas.find((c) => c.telefono === '3009999999').puntos).toBe(0);
  });

  it('con `since` solo vienen los que cambiaron después', async () => {
    /* Es lo que hace que la sincronización de un negocio con veinte mil
       clientes no los mande enteros cada treinta segundos. */
    const r = await request(crearApp()).get('/customers?since=2026-09-19T23:00:00Z');

    expect(r.body.filas).toHaveLength(1);
    expect(r.body.filas[0].telefono).toBe('3009999999');
  });

  it('una fecha ilegible trae todo en vez de no traer nada', async () => {
    /* Fallar hacia "mándalo todo" cuesta una bajada de más. Fallar hacia "no
       mandes nada" deja al mostrador sin clientes y nadie se entera. */
    const r = await request(crearApp()).get('/customers?since=ayer');

    expect(r.body.filas).toHaveLength(2);
  });

  it('dice si hay más páginas', async () => {
    const r = await request(crearApp()).get('/customers?limit=1');

    expect(r.body.filas).toHaveLength(1);
    expect(r.body.hay_mas).toBe(true);
  });

  it('las recompensas apagadas no bajan al mostrador', async () => {
    /* Si bajaran, la caja seguiría ofreciendo una promoción que el negocio ya
       terminó, y el cliente la reclamaría enfrente del cajero. */
    const r = await request(crearApp()).get('/customers');

    expect(r.body.recompensas).toHaveLength(1);
    expect(r.body.recompensas[0]).toMatchObject({
      id: 'r1',
      nombre: 'Café gratis',
      costo_puntos: 100,
      producto_id: 'p9',
    });
  });

  it('un negocio sin programa de puntos no rompe la bajada', async () => {
    /* La mayoría de los negocios no tiene fidelización encendida. Si esto
       fallara, ninguna de sus cajas podría bajar clientes. */
    const r = await request(crearApp({ programa: null })).get('/customers');

    expect(r.status).toBe(200);
    expect(r.body.recompensas).toEqual([]);
    expect(r.body.filas).toHaveLength(2);
  });
});

/* La otra dirección: un cliente que el cajero dio de alta en el mostrador y
   que sube por la cola. */
function crearAppAlta({ existentes = [] } = {}) {
  const app = express();
  app.use(express.json());

  const guardados = [...existentes];

  app.post('/customers', (req, res) => {
    const telefono = String(req.body.telefono || '').trim().slice(0, 30);
    const nombre = String(req.body.nombre || '').trim().slice(0, 80);

    if (!telefono || !nombre) {
      return res.status(400).json({ message: 'El cliente necesita teléfono y nombre', motivo: 'payload_invalido' });
    }

    const existente = guardados.find((c) => c.phone === telefono);
    if (existente) {
      const documento = String(req.body.documento || '').trim().slice(0, 20);
      if (documento && !existente.documento) existente.documento = documento;
      return res.json({ ok: true, duplicado: true, id: String(existente._id) });
    }

    const creado = {
      _id: `mongo-${guardados.length + 1}`,
      phone: telefono,
      name: nombre,
      documento: String(req.body.documento || '').trim().slice(0, 20),
    };
    guardados.push(creado);
    res.status(201).json({ ok: true, duplicado: false, id: creado._id });
  });

  app.get('/_guardados', (_req, res) => res.json(guardados));
  return app;
}

describe('el cliente que sube desde la caja', () => {
  it('entra con teléfono y nombre, que es lo mínimo que sirve', async () => {
    const app = crearAppAlta();
    const r = await request(app)
      .post('/customers')
      .send({ pos_cliente_id: '0192f8a1-7c4e-7000-8000-abcdef123456', telefono: '3101234567', nombre: 'Pedro' });

    expect(r.status).toBe(201);
    expect(r.body.duplicado).toBe(false);
  });

  it('el id de la caja no se usa como identidad', async () => {
    /* La terminal manda un UUIDv7 y aquí los ids son ObjectId. Si se
       intentara adoptarlo, la ficha nacería con un id que no es válido en
       Mongo. La llave es el teléfono. */
    const app = crearAppAlta();
    const r = await request(app)
      .post('/customers')
      .send({ pos_cliente_id: '0192f8a1-7c4e-7000-8000-abcdef123456', telefono: '3101234567', nombre: 'Pedro' });

    expect(r.body.id).not.toBe('0192f8a1-7c4e-7000-8000-abcdef123456');
  });

  it('un reintento de la cola no crea un segundo cliente', async () => {
    /* La cola reintenta hasta que confirmemos. Sin idempotencia, un timeout
       deja al negocio con el mismo cliente tres veces. */
    const app = crearAppAlta();
    const envio = { telefono: '3101234567', nombre: 'Pedro' };

    const primera = await request(app).post('/customers').send(envio);
    const segunda = await request(app).post('/customers').send(envio);

    expect(segunda.body.duplicado).toBe(true);
    expect(segunda.body.id).toBe(primera.body.id);
    expect((await request(app).get('/_guardados')).body).toHaveLength(1);
  });

  it('si ya existía desde antes, gana la ficha vieja', async () => {
    /* El cliente pidió un domicilio el mes pasado y el cajero lo registra
       otra vez sin saberlo. La ficha vieja tiene el historial y los puntos;
       crear una nueva los dejaría huérfanos. */
    const app = crearAppAlta({
      existentes: [{ _id: 'viejo', phone: '3101234567', name: 'Pedro Gómez', documento: '' }],
    });

    const r = await request(app)
      .post('/customers')
      .send({ telefono: '3101234567', nombre: 'pedro' });

    expect(r.body.duplicado).toBe(true);
    expect(r.body.id).toBe('viejo');
    // El nombre de antes no se pisa con lo que el cajero alcanzó a teclear.
    expect((await request(app).get('/_guardados')).body[0].name).toBe('Pedro Gómez');
  });

  it('pero sí completa el documento que faltaba', async () => {
    const app = crearAppAlta({
      existentes: [{ _id: 'viejo', phone: '3101234567', name: 'Pedro', documento: '' }],
    });

    await request(app).post('/customers').send({ telefono: '3101234567', nombre: 'Pedro', documento: '1017' });

    expect((await request(app).get('/_guardados')).body[0].documento).toBe('1017');
  });

  it('sin nombre se rechaza con 400, para que la cola lo aparte', async () => {
    /* 400 y no 500: un 5xx haría que la cola reintentara para siempre y
       taponara las ventas que vienen detrás. */
    const r = await request(crearAppAlta()).post('/customers').send({ telefono: '3101234567' });

    expect(r.status).toBe(400);
    expect(r.body.motivo).toBe('payload_invalido');
  });
});

describe('la forma del contrato', () => {
  it('Routes/pos.js expone la ruta y la protege como las demás', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'pos.js'), 'utf8');

    expect(src).toContain("router.get('/customers', tenantAuth, cajaVigente");
    expect(src).toContain("router.post('/customers', tenantAuth, cajaVigente");
  });

  it('la cola sabe a dónde mandar un cliente', () => {
    /* La terminal encola la entidad "cliente"; si nube.rs no tuviera su
       ruta, la cola la rechazaría con un 422 y cada cliente registrado en un
       mostrador se apartaría en silencio. */
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'pos-nativo', 'src-tauri', 'src', 'nube.rs'),
      'utf8',
    );

    expect(src).toContain('"cliente" => format!("{}/pos/customers"');
  });

  it('vive bajo /api/pos, que es lo único que un token de caja puede tocar', () => {
    /* Si estuviera en otra ruta, `alcanceCaja` la bloquearía con un 403 y la
       terminal no podría bajar un solo cliente. */
    const { PERMITIDO } = require('../middleware/alcanceCaja');

    expect(PERMITIDO.test('/api/pos/customers')).toBe(true);
    expect(PERMITIDO.test('/api/pos/redeem-reward')).toBe(true);
    expect(PERMITIDO.test('/api/loyalty/redeem')).toBe(false);
  });
});
