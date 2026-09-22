/**
 * El menú abierto se entera de que cambió un precio.
 *
 * El 22/09/2026, en cocina-vital, el dueño editó el precio de un Bowl a las
 * 06:46. A las 06:59 un cliente que tenía el menú abierto intentó pedir dos:
 * su pestaña tenía la carta vieja, el total no cuadró con el del servidor y el
 * pedido se rechazó. El cliente no recargó —rehizo el pedido más barato— y el
 * negocio perdió la diferencia.
 *
 * Había dos huecos: la ruta que edita un producto no avisaba por socket, y el
 * menú público no podía entrar a oír porque la sala del negocio exige token.
 *
 * Lo que se prueba acá es sobre todo lo segundo, porque abrir una sala a
 * clientes sin cuenta es lo que puede salir caro: esa sala lleva pedidos con
 * nombres, teléfonos y direcciones.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresco-de-prueba';

jest.mock('../utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));
jest.mock('../services/viewerTracker', () => ({
  addViewer: jest.fn(), removeViewer: jest.fn(), removeViewerBySocketId: jest.fn(),
  getViewers: jest.fn(() => []), heartbeat: jest.fn(), markReturning: jest.fn(),
  cleanupStale: jest.fn(),
}));
jest.mock('../Models/BusinessConfig', () => ({
  findById: jest.fn(() => ({ select: () => ({ lean: async () => null }) })),
}));
jest.mock('../utils/businessResolver', () => ({
  resolveBusinessId: jest.fn(async (x) =>
    (x === 'cocina-vital' ? '6a90e02df6be190e3d31dda8' : x)),
}));

const { initSocket, emitToBusiness } = require('../services/socketService');
const { resolveBusinessId } = require('../utils/businessResolver');

const NEGOCIO = '6a90e02df6be190e3d31dda8';
const SALA_PUBLICA = `publico:${NEGOCIO}`;

/** Un `io` de mentiras que anota a qué sala se emitió cada cosa. */
function crearIo() {
  const emisiones = [];
  const io = {
    emisiones,
    conectar: null,
    on(evento, cb) { if (evento === 'connection') io.conectar = cb; },
    to(sala) { return { emit: (evento, datos) => emisiones.push({ sala, evento, datos }) }; },
    sockets: { adapter: { rooms: new Map() } },
  };
  return io;
}

/** Un socket de mentiras: anota a qué salas entró y qué le respondieron. */
function crearSocket(usuario = null) {
  const manejadores = {};
  return {
    id: 'skt-1',
    user: usuario,
    handshake: { auth: {}, query: {} },
    salas: [],
    respuestas: [],
    on(evento, cb) { manejadores[evento] = cb; },
    join(sala) { this.salas.push(sala); },
    leave(sala) { this.salas = this.salas.filter((s) => s !== sala); },
    emit(evento, datos) { this.respuestas.push({ evento, datos }); },
    async disparar(evento, carga) {
      if (!manejadores[evento]) throw new Error(`el servidor no escucha "${evento}"`);
      return manejadores[evento](carga);
    },
  };
}

describe('la sala pública del menú', () => {
  let io;

  beforeEach(() => {
    jest.clearAllMocks();
    io = crearIo();
    initSocket(io);
  });

  it('un cliente sin cuenta puede entrar a oír el catálogo', async () => {
    /* Es el punto de todo: quien abre el menú no tiene token y aun así tiene
       que enterarse de un cambio de precio antes de confirmar el pedido. */
    const socket = crearSocket(null);
    io.conectar(socket);

    await socket.disparar('joinPublicBusiness', NEGOCIO);

    expect(socket.salas).toContain(SALA_PUBLICA);
  });

  it('entrar al menú NO mete al cliente en la sala del negocio', async () => {
    /* Lo que hace que esto sea seguro. Por la sala del negocio pasan los
       pedidos con nombre, teléfono y dirección: si entrar al menú metiera al
       cliente ahí, cualquiera con el menú abierto leería los pedidos de los
       demás. */
    const socket = crearSocket(null);
    io.conectar(socket);

    await socket.disparar('joinPublicBusiness', NEGOCIO);

    expect(socket.salas).not.toContain(NEGOCIO);
    expect(socket.salas).toEqual([SALA_PUBLICA]);
  });

  it('resuelve el slug, que es como se abre el menú', async () => {
    /* El menú se abre en `menuby.tech/cocina-vital` pero los eventos salen
       con el ObjectId. Sin resolverlo, el cliente entra a una sala a la que
       nadie emite y el arreglo no sirve de nada. */
    const socket = crearSocket(null);
    io.conectar(socket);

    await socket.disparar('joinPublicBusiness', 'cocina-vital');

    expect(resolveBusinessId).toHaveBeenCalledWith('cocina-vital');
    expect(socket.salas).toContain(SALA_PUBLICA);
  });

  it('un slug que ya no existe no tumba la conexión', async () => {
    /* Los QR de negocios que se fueron siguen circulando: el 22/09 llegaron
       visitas a seis slugs que no existen. Eso no puede reventar el socket
       del que sí está mirando el menú. */
    resolveBusinessId.mockRejectedValueOnce(new Error('no existe'));
    const socket = crearSocket(null);
    io.conectar(socket);

    await expect(socket.disparar('joinPublicBusiness', 'el-fat-guy')).resolves.toBeUndefined();
    expect(socket.salas).toHaveLength(0);
  });

  it('salir del menú lo saca de la sala', async () => {
    const socket = crearSocket(null);
    io.conectar(socket);

    await socket.disparar('joinPublicBusiness', NEGOCIO);
    await socket.disparar('leavePublicBusiness');

    expect(socket.salas).toHaveLength(0);
  });
});

describe('qué se le reenvía a los menús abiertos', () => {
  let io;

  beforeEach(() => {
    jest.clearAllMocks();
    io = crearIo();
    initSocket(io);
  });

  const salasDe = (evento) => io.emisiones.filter((e) => e.evento === evento).map((e) => e.sala);

  it('los cambios de catálogo llegan a la sala pública', async () => {
    for (const evento of ['products_update', 'categories_update', 'topping_groups_update']) {
      await emitToBusiness(NEGOCIO, evento, { type: 'updated' });
      expect(salasDe(evento)).toContain(SALA_PUBLICA);
    }
  });

  it('los pedidos NO llegan a la sala pública', async () => {
    /* La razón por la que la lista de eventos públicos es una lista y no una
       regla: agregar un evento ahí es dárselo a cualquiera que abra el menú.
       `order_created` lleva el nombre, el teléfono y la dirección de quien
       pidió. */
    for (const evento of ['order_created', 'viewers_updated', 'whatsapp:mensaje', 'order_status_update']) {
      await emitToBusiness(NEGOCIO, evento, { cliente: 'Ana', telefono: '3154087774' });
      expect(salasDe(evento)).not.toContain(SALA_PUBLICA);
      expect(salasDe(evento)).toContain(NEGOCIO);
    }
  });

  it('el panel del negocio sigue recibiendo el catálogo', async () => {
    /* El reenvío es un añadido, no un desvío: si el catálogo dejara de llegar
       a la sala del negocio, el panel del dueño se quedaría desactualizado. */
    await emitToBusiness(NEGOCIO, 'products_update', { type: 'updated' });

    expect(salasDe('products_update')).toContain(NEGOCIO);
  });
});

describe('quién avisa que un producto cambió', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'products.js'), 'utf8');

  it('editar un producto avisa por socket', () => {
    /* El hueco exacto del incidente. Crear, borrar, reordenar y activar ya
       avisaban; la ruta que cambia el **precio** era la única que no, que es
       justo la que importa para el total del pedido. */
    expect(src).toContain("avisarCambioDeProductos(finalBusinessId, { type: 'updated', product: updatedProduct });");
  });

  it('el aviso lleva el producto con sus grupos de toppings', () => {
    /* Sin los grupos poblados, quien recibe el aviso no puede recalcular:
       el precio de una bebida vive en el grupo, no en el producto. Fue un
       grupo ("BEBIDA") lo que se editó el 22/09. */
    const rutaPut = src.slice(src.indexOf('router.put("/:id"'));
    const finRuta = rutaPut.indexOf('avisarCambioDeProductos');

    expect(rutaPut.slice(0, finRuta)).toContain("path: 'toppingGroups'");
  });

  it('sigue vaciando la caché de "los más pedidos"', () => {
    /* `avisarCambioDeProductos` hace las dos cosas. Si alguien la cambia por
       un emit pelado, esa sección vuelve a mostrar precios viejos. */
    expect(src).toContain('function avisarCambioDeProductos(businessId, payload) {');
    expect(src).toContain('invalidatePopularCache(businessId);');
  });
});
