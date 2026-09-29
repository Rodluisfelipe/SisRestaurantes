/**
 * Integración con Activos (mensajería) — solo el restaurante habilitado.
 *
 * Activos corre sobre Firebase Realtime Database: se inicia sesión con la
 * cuenta del restaurante (correo/clave, en el .env) y se escribe la entrega en
 * `pedidos_activos/tiendas/<tienda>`, igual que hace su app al tocar
 * "Solicitar Entrega". Su "motor" asigna un repartidor solo y va llenando el
 * resto de campos; MenuBy lee ese registro para seguir el estado.
 *
 * Se habilita por negocio con ACTIVOS_BUSINESS_ID; sin las variables del .env,
 * queda apagado y no pasa nada.
 */
const logger = require('../utils/logger');
const { geocodeAddress } = require('../utils/geocoding');

const API_KEY = process.env.ACTIVOS_API_KEY || 'AIzaSyDqPIV52Sy9_uIg_qBnMtdizw1MfNtWyTo';
const DB = process.env.ACTIVOS_DB_URL || 'https://allco-uo9n52-default-rtdb.firebaseio.com';

function config() {
  return {
    businessId: process.env.ACTIVOS_BUSINESS_ID || '',
    tiendaId: Number(process.env.ACTIVOS_TIENDA_ID || 0),
    email: process.env.ACTIVOS_EMAIL || '',
    password: process.env.ACTIVOS_PASSWORD || '',
    uid: process.env.ACTIVOS_UID || '',
    tienda: {
      nombre: process.env.ACTIVOS_TIENDA_NOMBRE || 'GO BURGER',
      telefono: process.env.ACTIVOS_TIENDA_TELEFONO || '',
      lat: Number(process.env.ACTIVOS_TIENDA_LAT || 0),
      lng: Number(process.env.ACTIVOS_TIENDA_LNG || 0),
      ciudad: process.env.ACTIVOS_TIENDA_CIUDAD || '',
    },
  };
}

/** ¿Este negocio de MenuBy tiene la integración con Activos encendida? */
function habilitadoPara(businessId) {
  const c = config();
  return !!(c.businessId && c.email && c.password && c.tiendaId && String(businessId) === String(c.businessId));
}

// ── Sesión Firebase (token cacheado y refrescado) ──
let idToken = null, refreshToken = null, venceEn = 0;

async function login() {
  const c = config();
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: c.email, password: c.password, returnSecureToken: true }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error('Activos login: ' + (d.error?.message || r.status));
  idToken = d.idToken; refreshToken = d.refreshToken; venceEn = Date.now() + (Number(d.expiresIn) - 60) * 1000;
}

async function refrescar() {
  const r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${refreshToken}`,
  });
  const d = await r.json();
  if (!r.ok) { idToken = null; return login(); }
  idToken = d.id_token; refreshToken = d.refresh_token; venceEn = Date.now() + (Number(d.expires_in) - 60) * 1000;
}

async function token() {
  if (!idToken) await login();
  else if (Date.now() >= venceEn) await refrescar();
  return idToken;
}

// ── Construir la entrega desde el pedido de MenuBy ──
function construirEntrega(order, { minutosPreparacion = 15, coords: coordsOverride } = {}) {
  const c = config();
  const coords = coordsOverride || order.deliveryCoordinates || {};
  const efectivo = ['efectivo', 'cash', 'contraentrega'].includes(String(order.paymentMethod || '').toLowerCase());
  return {
    // Identidad de la tienda
    id_tienda: c.tiendaId,
    ID_restaurante: c.tiendaId,
    id_restaurante: String(c.tiendaId),
    nombre_tienda: c.tienda.nombre,
    nombre_restaurante: c.tienda.nombre,
    telefono_tienda: c.tienda.telefono,
    ubicacion_restaurante: { lat: c.tienda.lat, lng: c.tienda.lng },
    owner_uid: c.uid,
    id_cuenta_firebase_app: c.uid,
    // Datos del pedido (lo que el restaurante llenaría en "Solicitar Entrega")
    nombre_cliene: String(order.customerName || '').slice(0, 60),   // (sic) typo de su base
    telefono_cliente: Number(String(order.phone || '').replace(/\D/g, '')) || 0,
    descripcion_direccion: String(order.address || '').slice(0, 70),
    descripcion_cliente: String(order.customerNotes || '').slice(0, 120),
    ubicacion_cliente: String(order.address || ''),
    destino_ubicacion: { lat: coords.lat ?? null, lng: coords.lon ?? null },
    ciudad: c.tienda.ciudad,
    estado_pago: efectivo ? 'Cobrar al cliente' : 'No cobrar al cliente',
    tiempo_preparacion: String(minutosPreparacion),
    metodo_pago: '',
    creado_por: 'menuby',
    last_updated: Date.now(),
  };
}

/**
 * Crea la entrega en Activos. ⚠️ Despacha un repartidor real.
 * @returns {Promise<string>} entrega_id (la clave que genera Firebase)
 */
/** Coordenadas del cliente, mirando los dos lugares y aceptando lon o lng. */
function coordsDelPedido(order) {
  for (const c of [order.deliveryCoordinates, order.deliveryZoneInfo?.coordinates]) {
    if (!c) continue;
    const lat = Number(c.lat);
    const lng = Number(c.lng ?? c.lon);
    if (lat && lng) return { lat, lon: lng };
  }
  return null;
}

async function solicitarEntrega(order, opciones = {}) {
  const c = config();
  // Coordenadas del pedido; si no hay, se geocodifica la dirección.
  let coords = coordsDelPedido(order);
  if (!coords && order.address) {
    try {
      const res = await geocodeAddress(order.address);
      if (res && res[0]) coords = { lat: Number(res[0].lat), lon: Number(res[0].lon) };
    } catch (e) { logger.warn('No se pudo geocodificar la dirección para Activos', { error: e.message }); }
  }
  const cuerpo = construirEntrega(order, { ...opciones, coords });
  if (!cuerpo.destino_ubicacion.lat || !cuerpo.destino_ubicacion.lng) {
    throw new Error('No pudimos ubicar la dirección del cliente. Pídele que marque el punto en el mapa al pedir.');
  }
  const r = await fetch(`${DB}/pedidos_activos/tiendas/${c.tiendaId}.json?auth=${await token()}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const d = await r.json();
  if (!r.ok) throw new Error('Activos solicitarEntrega: ' + (d.error || r.status));
  logger.info('Entrega solicitada a Activos', { orderId: String(order._id), entregaId: d.name });
  return d.name;
}

/** Traduce las banderas de Activos a un estado único para MenuBy. */
function estadoMenuBy(e) {
  if (!e) return 'desconocido';
  if (e.hora_finalizacion) return 'entregado';
  if (e.asignacion_fallida) return 'sin_repartidor';
  if (e.entrega_lista || e.pedido_listo_notificado) return 'recogido';
  if (e.llegada_tienda_at) return 'en_el_local';
  if (e.comenzar_ruta) return 'en_camino';
  if (e.esta_asignado_entrega && e.id_repartidor) return 'asignado';
  return 'buscando_repartidor';
}

/** Estado actual de una entrega (busca en activas y luego en finalizadas de hoy). */
async function estadoDeEntrega(entregaId) {
  const c = config();
  const t = await token();
  let e = await (await fetch(`${DB}/pedidos_activos/tiendas/${c.tiendaId}/${entregaId}.json?auth=${t}`)).json();
  if (!e) e = await (await fetch(`${DB}/pedidos_finalizados_hoy/tiendas/${c.tiendaId}/${entregaId}.json?auth=${t}`)).json();
  if (!e) return { estado: 'desconocido' };
  return {
    estado: estadoMenuBy(e),
    idEntrega: e.ID_entrega ?? null,
    repartidor: e.nombre_repartidor || null,
    telefonoRepartidor: e.telefono_repartidor || null,
    vehiculo: e.vehiculo_snapshot || null,
    distanciaKm: e.distancia_km ?? null,
    valorDomicilio: e.valor_pedido ?? null,
    fotoEvidencia: e.foto_evidencia || null,
  };
}

module.exports = { config, habilitadoPara, solicitarEntrega, estadoDeEntrega, estadoMenuBy, construirEntrega };
