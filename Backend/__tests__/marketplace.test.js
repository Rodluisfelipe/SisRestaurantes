/**
 * Las reglas del marketplace de restaurantes.
 *
 * Cada endpoint tenía su propio filtro y los resultados se contradecían: un
 * negocio oculto salía en el buscador, "abierto ahora" ignoraba el horario y
 * los negocios sin zona de entrega no aparecían nunca.
 */
const {
  filtroVisible,
  idDelMenu,
  leerUbicacion,
  distanciaKm,
  estaAbiertoAhora,
  ordenarPorCercania,
  zonaQueCubre,
} = require('../utils/marketplace');

const semana = (openTime, closeTime) => Object.fromEntries(
  ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    .map(d => [d, { isOpen: true, openTime, closeTime }])
);

describe('quién aparece', () => {
  it('saca a los ocultos, pausados, inactivos y proveedores', () => {
    expect(filtroVisible()).toEqual({
      isActive: true,
      showInMarketplace: { $ne: false },
      menuStatus: { $ne: 'paused' },
      isSupplier: { $ne: true },
    });
  });

  it('suma condiciones sin perder las reglas', () => {
    const f = filtroVisible({ $or: [{ businessName: /x/ }] });
    expect(f.isSupplier).toEqual({ $ne: true });
    expect(f.$or).toHaveLength(1);
  });
});

describe('abierto ahora', () => {
  afterEach(() => jest.useRealTimers());
  const a = (iso) => jest.useFakeTimers().setSystemTime(new Date(iso));

  it('usa el horario guardado (openTime/closeTime)', () => {
    a('2026-09-15T20:00:00Z'); // martes 3:00 p. m. en Colombia
    expect(estaAbiertoAhora({ isOpen: true, businessHours: semana('08:00', '22:00') })).toBe(true);
    expect(estaAbiertoAhora({ isOpen: true, businessHours: semana('17:00', '22:00') })).toBe(false);
  });

  it('usa la hora de Colombia, no la del servidor en UTC', () => {
    a('2026-09-16T04:00:00Z'); // en UTC ya es miércoles 4 a. m.; en Colombia, martes 11 p. m.
    expect(estaAbiertoAhora({ isOpen: true, businessHours: semana('08:00', '22:00') })).toBe(false);
    expect(estaAbiertoAhora({ isOpen: true, businessHours: semana('18:00', '23:30') })).toBe(true);
  });

  it('entiende horarios que pasan de medianoche', () => {
    a('2026-09-16T05:30:00Z'); // 12:30 a. m. en Colombia
    expect(estaAbiertoAhora({ isOpen: true, businessHours: semana('18:00', '02:00') })).toBe(true);
  });

  it('el interruptor manual y la pausa mandan sobre el horario', () => {
    a('2026-09-15T20:00:00Z');
    expect(estaAbiertoAhora({ isOpen: false, businessHours: semana('08:00', '22:00') })).toBe(false);
    expect(estaAbiertoAhora({ isOpen: true, menuStatus: 'paused', businessHours: semana('08:00', '22:00') })).toBe(false);
  });

  it('sin horario configurado cuenta el interruptor', () => {
    expect(estaAbiertoAhora({ isOpen: true })).toBe(true);
  });
});

describe('cercanía', () => {
  const bogota = { lat: 4.711, lng: -74.0721 };
  const negocio = (nombre, coords) => ({ businessName: nombre, location: { coordinates: coords } });

  it('lee lat con lng o lon y descarta basura', () => {
    expect(leerUbicacion({ lat: '4.7', lon: '-74' })).toEqual({ lat: 4.7, lng: -74 });
    expect(leerUbicacion({ lat: '4.7', lng: '-74' })).toEqual({ lat: 4.7, lng: -74 });
    expect(leerUbicacion({ lat: 'x', lng: '-74' })).toBeNull();
    expect(leerUbicacion({ lat: '95', lng: '-74' })).toBeNull();
    expect(leerUbicacion({})).toBeNull();
  });

  it('no inventa distancia para negocios sin coordenadas', () => {
    expect(distanciaKm(bogota, negocio('a', { lat: null, lng: null }))).toBeNull();
    expect(distanciaKm(bogota, negocio('b', { lat: 0, lng: 0 }))).toBeNull();
    expect(distanciaKm(null, negocio('c', { lat: 4.8, lng: -74 }))).toBeNull();
    expect(distanciaKm(bogota, negocio('d', { lat: 4.8612, lng: -74.0325 }))).toBeGreaterThan(15);
  });

  it('ordena del más cercano al más lejano y deja al final los sin ubicación', () => {
    const lista = [
      { businessName: 'sin', distance: null },
      { businessName: 'lejos', distance: 400 },
      { businessName: 'cerca', distance: 1.2 },
    ];
    expect(ordenarPorCercania(lista).map(b => b.businessName)).toEqual(['cerca', 'lejos', 'sin']);
  });

  it('desempata cuando la distancia es igual', () => {
    const lista = [{ n: 'a', distance: null, p: 1 }, { n: 'b', distance: null, p: 9 }];
    expect(ordenarPorCercania(lista, (x, y) => y.p - x.p).map(b => b.n)).toEqual(['b', 'a']);
  });

  /* Una tienda que despacha a todo el país le llega igual al cliente esté
     donde esté: enterrarla al final por quedar en otra ciudad es esconder algo
     que sí puede vender. */
  it('la tienda que envía a todo el país no se hunde por estar lejos', () => {
    const lista = [
      { businessName: 'restaurante lejos', distance: 400 },
      { businessName: 'tienda lejos', distance: 400, tipoTienda: 'ecommerce', envioNacional: { activo: true } },
      { businessName: 'restaurante cerca', distance: 2 },
    ];
    expect(ordenarPorCercania(lista).map(b => b.businessName))
      .toEqual(['restaurante cerca', 'tienda lejos', 'restaurante lejos']);
  });

  it('pero no se cuela por encima de lo que está al lado', () => {
    const lista = [
      { businessName: 'tienda nacional', distance: 900, tipoTienda: 'ecommerce', envioNacional: { activo: true } },
      { businessName: 'la de la esquina', distance: 0.4 },
    ];
    expect(ordenarPorCercania(lista)[0].businessName).toBe('la de la esquina');
  });

  it('una tienda sin envío nacional se ordena por distancia como todos', () => {
    const lista = [
      { businessName: 'tienda local lejos', distance: 400, tipoTienda: 'ecommerce' },
      { businessName: 'restaurante cerca', distance: 30.5 },
    ];
    expect(ordenarPorCercania(lista)[0].businessName).toBe('restaurante cerca');
  });
});

describe('zona de entrega', () => {
  const circulo = { type: 'circle', name: 'Centro', geometry: { center: { coordinates: [-74.0721, 4.711] }, radius: 2000 } };

  it('dice qué zona cubre el punto y cuál no', () => {
    expect(zonaQueCubre([circulo], { lat: 4.712, lon: -74.072 })?.name).toBe('Centro');
    expect(zonaQueCubre([circulo], { lat: 4.9, lon: -74.072 })).toBeNull();
  });
});

describe('sucursales con menú compartido', () => {
  it('cuentan los productos de la principal', () => {
    expect(idDelMenu({ _id: 'suc', useSharedMenu: true, mainBranchId: 'ppal' })).toBe('ppal');
    expect(idDelMenu({ _id: 'suc', useSharedMenu: false, mainBranchId: 'ppal' })).toBe('suc');
  });
});

describe('lo que el catálogo muestra de cada negocio', () => {
  const Subscription = require('../Models/Subscription');
  const DeliveryZone = require('../Models/DeliveryZone');
  const { decorarParaVitrina } = require('../utils/marketplace');
  const DIA = 24 * 60 * 60 * 1000;
  const id = (n) => `64b0000000000000000000${String(n).padStart(2, '0')}`;

  afterEach(() => jest.restoreAllMocks());

  function simular({ suscripciones = [], zonas = [] }) {
    // Ya ordenadas de la más reciente a la más vieja, como las devuelve la consulta.
    jest.spyOn(Subscription, 'find').mockReturnValue({ sort: () => ({ lean: async () => suscripciones }) });
    jest.spyOn(DeliveryZone, 'find').mockReturnValue({ lean: async () => zonas });
  }

  it('no descarta a un negocio sin zona de entrega: lo marca como solo recoger', async () => {
    simular({});
    const [b] = await decorarParaVitrina([{ _id: id(1), isOpen: true }], { lat: 4.71, lng: -74.07 });
    expect(b.tieneDomicilio).toBe(false);
    expect(b.deliveryZone).toBeNull();
    expect(b.recibePedidos).toBe(true);
  });

  it('sin pedidos solo si la suscripción más reciente venció y pasó la gracia', async () => {
    simular({ suscripciones: [
      { businessId: id(2), periodEnd: new Date(Date.now() - 10 * DIA), createdAt: new Date() },
      { businessId: id(3), periodEnd: new Date(Date.now() + 20 * DIA), createdAt: new Date() },
      { businessId: id(3), periodEnd: new Date(Date.now() - 40 * DIA), createdAt: new Date(Date.now() - 60 * DIA) },
    ] });
    const r = await decorarParaVitrina([{ _id: id(2) }, { _id: id(3) }, { _id: id(4) }], null);
    // vencido · renovado (la vieja vencida no cuenta) · sin suscripción (no se bloquea, igual que orders.js)
    expect(r.map(b => b.recibePedidos)).toEqual([false, true, true]);
  });

  it('entrega la zona que cubre la dirección del cliente', async () => {
    simular({ zonas: [{
      businessId: id(5), type: 'circle', name: 'Centro',
      geometry: { center: { coordinates: [-74.0721, 4.711] }, radius: 3000 },
    }] });
    const [cerca] = await decorarParaVitrina([{ _id: id(5) }], { lat: 4.712, lng: -74.072 });
    expect(cerca.tieneDomicilio).toBe(true);
    expect(cerca.deliveryZone.name).toBe('Centro');

    const [lejos] = await decorarParaVitrina([{ _id: id(5) }], { lat: 6.25, lng: -75.56 });
    expect(lejos.tieneDomicilio).toBe(true);
    expect(lejos.deliveryZone).toBeNull();
  });
});
