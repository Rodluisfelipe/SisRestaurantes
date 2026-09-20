/**
 * Rastreo de Servientrega.
 *
 * No se prueba la red —esos endpoints no son nuestros y no tienen SLA—, se
 * prueba lo que de verdad rompe: que un servicio .NET conteste en PascalCase,
 * que los movimientos vengan al revés, y que "05/03/2026" no se lea como 3 de
 * mayo. Cada una de esas tres cosas produce un resultado que *parece* correcto
 * y está mal, que es la peor clase de error para un cliente esperando su
 * paquete.
 */
const servientrega = require('../services/transportadoras/servientrega');
const { rastrearEnvio, porNombre, soportadas } = require('../services/transportadoras');

const { normalizar, ordenarDescendente, aISO, pick, mejorDe, desenvolver } = servientrega._internos;
const { normalizarGuia, clasificarEstado } = servientrega;

describe('el número de guía', () => {
  it('acepta lo que el cliente pega con espacios, puntos o guiones', () => {
    expect(normalizarGuia(' 123 456-789.0 ')).toBe('1234567890');
  });

  it('rechaza lo que no es una guía', () => {
    expect(normalizarGuia('')).toBeNull();
    expect(normalizarGuia('12345')).toBeNull();          // muy corta
    expect(normalizarGuia('ABC123456')).toBeNull();      // Servientrega es numérica
    expect(normalizarGuia('1'.repeat(31))).toBeNull();   // muy larga
  });

  it('una guía inválida no llega siquiera a pedirle nada a Servientrega', async () => {
    const r = await servientrega.rastrear('hola');
    expect(r.encontrado).toBe(false);
    expect(r.motivo).toBe('guia_invalida');
  });
});

describe('leer la respuesta venga como venga', () => {
  it('lee camelCase (la app móvil)', () => {
    const r = normalizar({ estadoActual: 'EN TRANSITO', numeroGuia: '123456' }, '123456', 'A');
    expect(r.estado).toBe('EN TRANSITO');
    expect(r.guia).toBe('123456');
  });

  /* B y C salen de un servicio .NET, que serializa en PascalCase. Leyendo solo
     camelCase la consulta "funcionaba" y devolvía un envío vacío. */
  it('lee PascalCase (el servicio .NET)', () => {
    const r = normalizar({
      EstadoActual: 'ENTREGADO',
      NumeroGuia: '999888',
      Remitente: { Ciudad: 'MEDELLIN' },
      Destinatario: { Ciudad: 'BOGOTA' },
      Movimientos: [{ Movimiento: 'Entregado', Fecha: '10/03/2026 14:20', Ubicacion: 'BOGOTA' }],
    }, '999888', 'C');

    expect(r.estado).toBe('ENTREGADO');
    expect(r.origen).toBe('MEDELLIN');
    expect(r.destino).toBe('BOGOTA');
    expect(r.movimientos).toHaveLength(1);
    expect(r.movimientos[0].ubicacion).toBe('BOGOTA');
  });

  it('un payload sin estado ni movimientos no cuenta como encontrado', () => {
    // Si contara, ganaría la carrera y taparía a la estrategia que sí trajo datos.
    expect(normalizar({ Code: 1, ValidationNumber: 4 }, '123456', 'B')).toBeNull();
    expect(normalizar(null, '123456', 'B')).toBeNull();
    expect(normalizar('', '123456', 'B')).toBeNull();
  });

  it('saca el envío de Results[] cuando viene envuelto', () => {
    expect(desenvolver({ Code: 1, Results: [{ EstadoActual: 'EN REPARTO' }] }))
      .toEqual({ EstadoActual: 'EN REPARTO' });
  });

  it('sin Results usable, deja el payload como está', () => {
    expect(desenvolver({ estadoActual: 'X' })).toEqual({ estadoActual: 'X' });
    expect(desenvolver({ Results: [] })).toEqual({ Results: [] });
  });

  it('pick ignora vacíos y prueba los alias en orden', () => {
    expect(pick({ movimiento: '', estado: 'Recibido' }, 'movimiento', 'estado')).toBe('Recibido');
    expect(pick(null, 'lo que sea')).toBeUndefined();
  });
});

describe('las fechas', () => {
  /* En JS, new Date("05/03/2026") es el 3 de MAYO. Servientrega escribe
     dd/MM/yyyy, así que esa lectura corre el movimiento dos meses. */
  it('05/03/2026 es 5 de marzo, no 3 de mayo', () => {
    expect(aISO('05/03/2026')).toBe('2026-03-05T00:00:00.000Z');
  });

  it('entiende la hora cuando viene', () => {
    expect(aISO('05/03/2026 14:20')).toBe('2026-03-05T14:20:00.000Z');
    expect(aISO('5/3/2026 9:05:30')).toBe('2026-03-05T09:05:30.000Z');
  });

  it('acepta ISO, que no es ambiguo', () => {
    expect(aISO('2026-03-05T14:20:00Z')).toBe('2026-03-05T14:20:00.000Z');
  });

  it('lo que no entiende lo deja en null en vez de inventar', () => {
    expect(aISO('ayer por la tarde')).toBeNull();
    expect(aISO('')).toBeNull();
  });
});

describe('el orden de los movimientos', () => {
  const mov = (fecha) => ({ descripcion: fecha, fecha, fechaISO: aISO(fecha), ubicacion: '' });

  it('deja primero el más reciente, venga como venga', () => {
    const ascendente = [mov('01/03/2026 08:00'), mov('03/03/2026 10:00'), mov('05/03/2026 09:00')];
    ordenarDescendente(ascendente);
    expect(ascendente.map((m) => m.fecha)).toEqual(['05/03/2026 09:00', '03/03/2026 10:00', '01/03/2026 08:00']);

    const descendente = [mov('05/03/2026 09:00'), mov('03/03/2026 10:00'), mov('01/03/2026 08:00')];
    ordenarDescendente(descendente);
    expect(descendente[0].fecha).toBe('05/03/2026 09:00');
  });

  it('si ninguna fecha se entiende, invierte y no inventa', () => {
    const sinFecha = [mov('primero'), mov('segundo'), mov('tercero')];
    ordenarDescendente(sinFecha);
    expect(sinFecha.map((m) => m.fecha)).toEqual(['tercero', 'segundo', 'primero']);
  });

  it('los movimientos sin fecha legible van al final', () => {
    const mezcla = [mov('sin fecha'), mov('01/03/2026'), mov('05/03/2026')];
    ordenarDescendente(mezcla);
    expect(mezcla[0].fecha).toBe('05/03/2026');
    expect(mezcla[2].fecha).toBe('sin fecha');
  });
});

describe('en qué fase va el envío', () => {
  it.each([
    ['ENTREGADO', 'entregado'],
    ['Recibido por el destinatario', 'entregado'],
    ['EN TRANSITO', 'en_transito'],
    ['En tránsito hacia BOGOTA', 'en_transito'],
    ['EN REPARTO', 'en_reparto'],
    ['En ruta de entrega', 'en_reparto'],
    ['ADMITIDO', 'admitido'],
    ['Devolución al remitente', 'novedad'],
    ['Dirección errada', 'novedad'],
    ['cualquier cosa nueva', 'desconocido'],
  ])('"%s" → %s', (estado, fase) => {
    expect(clasificarEstado(estado)).toBe(fase);
  });

  /* "Entrega fallida" contiene "entrega": si el orden de las reglas se
     invierte, un envío devuelto se le muestra al cliente como entregado. */
  it('una entrega fallida es novedad, no una entrega', () => {
    expect(clasificarEstado('ENTREGA FALLIDA')).toBe('novedad');
  });

  it('las tildes no cambian la fase', () => {
    expect(clasificarEstado('EN TRÁNSITO')).toBe('en_transito');
  });
});

describe('cuál de las tres respuestas gana', () => {
  const envio = (movs, extra = {}) => ({
    encontrado: true, transportadora: 'servientrega', guia: '1', estado: 'EN TRANSITO',
    fase: 'en_transito', origen: null, destino: null, fechaEnvio: null, fechaEntrega: null,
    movimientos: new Array(movs).fill({ descripcion: 'x', fecha: '', fechaISO: null, ubicacion: '' }),
    totalMovimientos: movs, fuente: 'A', ...extra,
  });

  it('gana la que trae historial, no la que responde primero', async () => {
    const rapidaYVacia = Promise.resolve(envio(0, { fuente: 'B', estado: 'Sin información' }));
    const lentaYCompleta = new Promise((r) => setTimeout(() => r(envio(4, { fuente: 'A' })), 20));
    const ganador = await mejorDe([rapidaYVacia, lentaYCompleta]);
    expect(ganador.fuente).toBe('A');
  });

  it('una estrategia caída no tumba a las otras', async () => {
    const caida = Promise.reject(new Error('C 500'));
    const buena = Promise.resolve(envio(2, { fuente: 'A' }));
    const ganador = await mejorDe([caida, buena]);
    expect(ganador.fuente).toBe('A');
  });

  it('si las tres fallan, no hay resultado', async () => {
    const ganador = await mejorDe([Promise.reject(new Error('A')), Promise.resolve(null)]);
    expect(ganador).toBeNull();
  });
});

describe('el registro de transportadoras', () => {
  it('reconoce el nombre que escribió el negocio, como lo haya escrito', () => {
    expect(porNombre('Servientrega')?.id).toBe('servientrega');
    expect(porNombre('SERVIENTREGA S.A.')?.id).toBe('servientrega');
    expect(porNombre('servi entrega')?.id).toBe('servientrega');
  });

  it('dice claro cuáles sabe rastrear', () => {
    expect(soportadas()).toEqual([{ id: 'servientrega', nombre: 'Servientrega' }]);
  });

  it('con una transportadora que no manejamos, lo dice en vez de fallar', async () => {
    const r = await rastrearEnvio('1234567890', 'Coordinadora');
    expect(r.encontrado).toBe(false);
    expect(r.motivo).toBe('sin_soporte');
    expect(r.mensaje).toContain('Coordinadora');
  });
});
