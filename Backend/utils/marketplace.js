/**
 * Qué negocios salen en el marketplace de MenuBy (/restaurantes, su buscador,
 * "Descubre más" y el sitemap) y con qué datos.
 *
 * Cada endpoint armaba su propio filtro y ninguno coincidía con otro: un
 * negocio que el superadmin ocultaba volvía a aparecer en el buscador, los
 * proveedores B2B figuraban como restaurantes y los menús pausados seguían
 * listados. Las reglas viven acá una sola vez.
 */
const Subscription = require('../Models/Subscription');
const DeliveryZone = require('../Models/DeliveryZone');
const Product = require('../Models/Product');
const { calculateSubscriptionStatus } = require('./subscriptionHelper');
const { haversineDistance, pointInPolygon, pointInRadius } = require('./geospatial');
const { estadoDeHoy } = require('../services/whatsappAgent/horario');

/* "Cerca" para las secciones curadas y "Descubre más": cubre un área
   metropolitana sin llegar a la ciudad vecina. La lista completa no se corta. */
const RADIO_CERCANO_KM = 30;

const CAMPOS_VITRINA = 'businessName slug logo coverImage description theme isOpen menuStatus tipoTienda envioNacional address whatsappNumber socialMedia department city location businessHours reviewStats createdAt updatedAt useSharedMenu mainBranchId';

/* Aparece quien está activo, no fue ocultado por el superadmin, no pausó su
   menú y es un restaurante: los proveedores tienen su propio marketplace B2B.
   `$ne` y no igualdad, porque los negocios creados antes de cada campo no lo
   tienen guardado y deben contar con el valor por defecto. */
function filtroVisible(extra = {}) {
  return {
    isActive: true,
    showInMarketplace: { $ne: false },
    menuStatus: { $ne: 'paused' },
    isSupplier: { $ne: true },
    ...extra,
  };
}

/* Una sucursal con menú compartido no tiene productos propios: los lee de la
   principal, igual que hacen products.js y categories.js al servir el menú. */
function idDelMenu(negocio) {
  return negocio.useSharedMenu && negocio.mainBranchId
    ? String(negocio.mainBranchId)
    : String(negocio._id);
}

/** Acepta `lng` o `lon`: el catálogo manda uno y "Descubre más" el otro. */
function leerUbicacion(query = {}) {
  const lat = parseFloat(query.lat);
  const lng = parseFloat(query.lng ?? query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function coordenadasDe(negocio) {
  const c = negocio.location?.coordinates;
  if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return null;
  // 0,0 es el valor de un formulario sin llenar, no un restaurante en el mar.
  if (c.lat === 0 && c.lng === 0) return null;
  return { lat: c.lat, lng: c.lng };
}

function distanciaKm(origen, negocio) {
  const destino = coordenadasDe(negocio);
  if (!origen || !destino) return null;
  return Math.round(haversineDistance(origen.lat, origen.lng, destino.lat, destino.lng) * 10) / 10;
}

/* En hora de Colombia y con los campos que de verdad guarda el editor
   (openTime/closeTime). La versión anterior leía open/close, que nunca
   existieron, así que "abierto ahora" era solo el interruptor manual. */
function estaAbiertoAhora(negocio) {
  if (!negocio || negocio.isOpen === false || negocio.menuStatus === 'paused') return false;
  // Las tiendas venden a toda hora: el horario es cuándo despachan, no cuándo abren.
  if (negocio.tipoTienda === 'ecommerce') return true;
  const hoy = estadoDeHoy(negocio);
  // Sin horario configurado manda el interruptor, que ya está encendido.
  return hoy ? hoy.abierto : true;
}

/** ¿Le llega a cualquiera, esté donde esté? */
function enviaATodoElPais(negocio) {
  return negocio?.tipoTienda === 'ecommerce' && !!negocio?.envioNacional?.activo;
}

/* Para ordenar, una tienda que despacha a todo el país está tan "cerca" como
   la que queda en el barrio: el paquete llega igual. Se le pone el borde del
   radio cercano en vez de su distancia real, así no encabeza la lista por
   encima de los de al lado, pero tampoco termina enterrada al final por estar
   en otra ciudad. */
function distanciaEfectiva(negocio) {
  const real = negocio?.distance ?? Infinity;
  if (!enviaATodoElPais(negocio)) return real;
  return Math.min(real, RADIO_CERCANO_KM);
}

/** Del más cercano al más lejano; los que no tienen ubicación, al final. */
function ordenarPorCercania(lista, desempate = () => 0) {
  return lista.sort((a, b) => {
    const da = distanciaEfectiva(a);
    const db = distanciaEfectiva(b);
    return da === db ? desempate(a, b) : da - db;
  });
}

function zonaQueCubre(zonas, punto) {
  const porPrioridad = [...zonas].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  for (const zona of porPrioridad) {
    let dentro = false;
    if (zona.type === 'polygon' && zona.geometry?.coordinates?.[0]) {
      dentro = pointInPolygon(punto, zona.geometry.coordinates[0]);
    } else if (zona.type === 'circle' && zona.geometry?.center?.coordinates) {
      const [lon, lat] = zona.geometry.center.coordinates;
      dentro = pointInRadius(punto, { lat, lon }, zona.geometry.radius);
    }
    if (dentro) return { name: zona.name, estimatedTime: zona.estimatedTime, pricing: zona.pricing };
  }
  return null;
}

/* Mismo cálculo que hace orders.js al crear el pedido, sobre la suscripción
   más reciente: si acá dijera otra cosa, el catálogo prometería pedidos que
   después se rechazan. Sin suscripción no hay bloqueo, igual que allá. */
async function negociosSinPedidos(ids) {
  if (!ids.length) return new Set();
  const suscripciones = await Subscription.find({ businessId: { $in: ids } })
    .sort({ createdAt: -1 })
    .lean();
  const vistos = new Set();
  const sinPedidos = new Set();
  for (const s of suscripciones) {
    const id = String(s.businessId);
    if (vistos.has(id)) continue;
    vistos.add(id);
    if (calculateSubscriptionStatus(Subscription.hydrate(s)).isSuspended) sinPedidos.add(id);
  }
  return sinPedidos;
}

/**
 * Agrega a cada negocio lo que el catálogo necesita para mostrarlo: distancia,
 * si está abierto, si envía a esa dirección y si puede recibir pedidos.
 *
 * No descarta a nadie. Antes un negocio sin zona de entrega que cubriera al
 * cliente desaparecía, y con él todos los que solo atienden en mesa o para
 * recoger.
 */
async function decorarParaVitrina(negocios, origen) {
  if (!negocios.length) return [];
  const ids = negocios.map(b => b._id);
  const [zonas, sinPedidos] = await Promise.all([
    DeliveryZone.find({ businessId: { $in: ids }, isActive: true }).lean(),
    negociosSinPedidos(ids),
  ]);

  const zonasDe = {};
  for (const zona of zonas) {
    const id = String(zona.businessId);
    if (!zonasDe[id]) zonasDe[id] = [];
    zonasDe[id].push(zona);
  }
  const punto = origen ? { lat: origen.lat, lon: origen.lng } : null;

  return negocios.map(b => {
    const id = String(b._id);
    const propias = zonasDe[id] || [];
    return {
      ...b,
      distance: distanciaKm(origen, b),
      isCurrentlyOpen: estaAbiertoAhora(b),
      enviaATodoElPais: enviaATodoElPais(b),
      tieneDomicilio: propias.length > 0,
      deliveryZone: punto && propias.length ? zonaQueCubre(propias, punto) : null,
      recibePedidos: !sinPedidos.has(id),
    };
  });
}

/* Un menú sin productos no tiene nada que ofrecer: entrar y encontrarlo vacío
   es peor que no verlo. */
async function conProductos(negocios) {
  if (!negocios.length) return [];
  const menus = [...new Set(negocios.map(idDelMenu))];
  const conAlgo = new Set(
    (await Product.distinct('businessId', { businessId: { $in: menus }, active: true })).map(String)
  );
  return negocios.filter(b => conAlgo.has(idDelMenu(b)));
}

module.exports = {
  RADIO_CERCANO_KM,
  CAMPOS_VITRINA,
  filtroVisible,
  idDelMenu,
  leerUbicacion,
  distanciaKm,
  estaAbiertoAhora,
  ordenarPorCercania,
  zonaQueCubre,
  decorarParaVitrina,
  conProductos,
};
