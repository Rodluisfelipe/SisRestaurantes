/**
 * La app del domiciliario (versión 2): las reglas que no dependen de la base.
 *
 * Aquí vive lo que cuesta plata si falla —cuánto gana el domi, cuánto
 * efectivo trae en la mano, quién le debe a quién— y lo que decide si un
 * evento que llega del celular se puede aplicar. Todo es puro para poder
 * probarlo entero sin servidor ni red.
 */

const EFECTIVO = ['cash', 'efectivo'];

/** ¿El cliente paga en efectivo al recibir? */
function esEfectivo(metodo) {
  return EFECTIVO.includes(String(metodo || '').toLowerCase());
}

/** Lo que el domi le cobra al cliente en la puerta (el total ya trae el domicilio). */
function efectivoACobrar(pedido) {
  if (!pedido || !esEfectivo(pedido.paymentMethod)) return 0;
  const total = Number(pedido.finalAmount ?? pedido.totalAmount ?? 0);
  return Number.isFinite(total) && total > 0 ? Math.round(total) : 0;
}

const MODOS_PAGO = ['domicilio', 'fijo', 'porcentaje', 'ninguno'];

/**
 * Cómo se le paga al domi. Lo más común en Colombia: se queda con el
 * domicilio que pagó el cliente. Una regla rota o vacía cae en esa.
 */
function normalizarReglaPago(regla) {
  const modo = MODOS_PAGO.includes(regla?.modo) ? regla.modo : 'domicilio';
  let valor = Number(regla?.valor) || 0;
  if (modo === 'porcentaje') valor = Math.min(100, Math.max(0, valor));
  if (modo === 'fijo') valor = Math.max(0, Math.round(valor));
  return { modo, valor: modo === 'domicilio' || modo === 'ninguno' ? 0 : valor };
}

/** Lo que gana el domi por un pedido entregado. */
function gananciaDomi(pedido, regla) {
  const r = normalizarReglaPago(regla);
  const domicilio = Math.max(0, Math.round(Number(pedido?.deliveryFee) || 0));
  if (r.modo === 'domicilio') return domicilio;
  if (r.modo === 'fijo') return r.valor;
  if (r.modo === 'porcentaje') return Math.round((domicilio * r.valor) / 100);
  return 0;
}

/**
 * El cuadre de un grupo de entregas sin liquidar.
 *   neto > 0 → el domi le entrega esa plata al local
 *   neto < 0 → el local le paga esa plata al domi
 * El domi se descuenta su pago del efectivo que trae, que es como pasa en la
 * vida real: nadie devuelve la plata para que después le paguen a él.
 */
function cuadrar(entregas = []) {
  let efectivo = 0;
  let ganancias = 0;
  for (const e of entregas) {
    efectivo += Math.max(0, Math.round(Number(e.efectivo) || 0));
    ganancias += Math.max(0, Math.round(Number(e.ganancia) || 0));
  }
  const neto = efectivo - ganancias;
  return {
    entregas: entregas.length,
    efectivo,
    ganancias,
    neto,
    debeEntregar: Math.max(0, neto),
    leDeben: Math.max(0, -neto),
  };
}

/**
 * Las formas en que puede estar guardado un celular colombiano: con o sin 57.
 * Un negocio registra "3001234567" y otro "573001234567"; es la misma persona.
 */
function variantesTelefono(tel) {
  const d = String(tel || '').replace(/\D/g, '');
  if (!d) return [];
  if (d.length === 12 && d.startsWith('57')) return [d, d.slice(2)];
  if (d.length === 10 && d.startsWith('3')) return [d, `57${d}`];
  return [d];
}

/** Estado del pedido visto desde el domi, sacado de sus marcas de tiempo. */
function estadoParaDomi(pedido) {
  if (!pedido) return 'desconocido';
  if (pedido.deliveredAt || pedido.status === 'delivered' || pedido.status === 'completed') return 'entregado';
  if (pedido.deliveryFailedAt) return 'no_entregado';
  if (pedido.status === 'cancelled') return 'cancelado';
  if (pedido.deliveryArrivedCustomerAt) return 'con_cliente';
  if (pedido.deliveryPickedAt) return 'hacia_cliente';
  if (pedido.deliveryArrivedStoreAt) return 'en_local';
  return 'hacia_local';
}

const TIPOS_EVENTO = ['llegue_local', 'recogido', 'llegue_cliente', 'entregado', 'no_entregado'];

// Desde qué estado se puede hacer cada cosa
const PERMITIDO = {
  llegue_local: ['hacia_local'],
  recogido: ['hacia_local', 'en_local'],
  llegue_cliente: ['hacia_cliente'],
  entregado: ['hacia_cliente', 'con_cliente'],
  no_entregado: ['hacia_cliente', 'con_cliente'],
};

// A qué estado deja cada evento (para reconocer un reintento que ya se aplicó)
const DEJA_EN = {
  llegue_local: 'en_local',
  recogido: 'hacia_cliente',
  llegue_cliente: 'con_cliente',
  entregado: 'entregado',
  no_entregado: 'no_entregado',
};

// Orden del recorrido: un evento "viejo" que llega tarde no hace retroceder nada
const ORDEN_ESTADO = ['hacia_local', 'en_local', 'hacia_cliente', 'con_cliente', 'entregado'];

/**
 * ¿Se puede aplicar este evento al pedido tal como está?
 * @returns {{ aplicar: boolean, yaEstaba?: boolean, motivo?: string }}
 */
function puedeAplicar(tipo, estado) {
  if (!PERMITIDO[tipo]) return { aplicar: false, motivo: 'tipo_invalido' };
  if (PERMITIDO[tipo].includes(estado)) return { aplicar: true };
  // Llegó tarde algo que ya quedó atrás (sin señal se mandan en orden, pero
  // el panel pudo adelantar el pedido): se da por hecho, no es un error.
  const destino = DEJA_EN[tipo];
  const iDestino = ORDEN_ESTADO.indexOf(destino);
  const iActual = ORDEN_ESTADO.indexOf(estado);
  if (estado === destino || (iDestino >= 0 && iActual >= 0 && iActual >= iDestino)) {
    return { aplicar: false, yaEstaba: true };
  }
  if (estado === 'cancelado') return { aplicar: false, motivo: 'cancelado' };
  if (estado === 'entregado' || estado === 'no_entregado') return { aplicar: false, motivo: 'cerrado' };
  return { aplicar: false, motivo: 'fuera_de_orden' };
}

const MOTIVOS_NO_ENTREGA = {
  cliente_no_responde: 'El cliente no responde',
  direccion_errada: 'La dirección está mal',
  cliente_rechazo: 'El cliente no lo recibió',
  sin_dinero: 'El cliente no tenía cómo pagar',
  otro: 'Otro motivo',
};

const ID_EVENTO = /^[A-Za-z0-9-]{8,64}$/;
const ID_MONGO = /^[a-f0-9]{24}$/i;
const MAX_ATRASO_MS = 48 * 60 * 60 * 1000;

/**
 * Valida un evento que manda el celular (en línea o desde su cola sin señal).
 * La hora es la del celular, porque sin señal el evento se manda horas
 * después; pero no se acepta del futuro ni de hace más de dos días.
 */
function validarEvento(ev, ahora = new Date()) {
  if (!ev || typeof ev !== 'object') return { ok: false, error: 'evento_invalido' };
  const id = String(ev.id || '');
  if (!ID_EVENTO.test(id)) return { ok: false, error: 'id_invalido' };
  if (!TIPOS_EVENTO.includes(ev.tipo)) return { ok: false, error: 'tipo_invalido' };
  const pedidoId = String(ev.pedidoId || '');
  if (!ID_MONGO.test(pedidoId)) return { ok: false, error: 'pedido_invalido' };

  let at = ev.at ? new Date(ev.at) : ahora;
  if (Number.isNaN(at.getTime())) at = ahora;
  if (at.getTime() > ahora.getTime()) at = ahora; // reloj adelantado
  if (ahora.getTime() - at.getTime() > MAX_ATRASO_MS) return { ok: false, error: 'muy_viejo' };

  const lat = Number(ev.lat);
  const lng = Number(ev.lng);
  const ubicacion = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0)
    ? { lat, lng } : null;

  const d = ev.datos || {};
  const datos = {};
  if (d.codigo != null && d.codigo !== '') {
    const c = String(d.codigo).replace(/\D/g, '');
    if (c.length !== 4) return { ok: false, error: 'codigo_invalido' };
    datos.codigo = c;
  }
  if (ev.tipo === 'no_entregado') {
    datos.motivo = MOTIVOS_NO_ENTREGA[d.motivo] ? d.motivo : 'otro';
  }
  if (d.nota) datos.nota = String(d.nota).trim().slice(0, 200);
  if (d.fotoUrl) {
    const u = String(d.fotoUrl);
    if (!/^https:\/\/[^\s]{8,490}$/.test(u)) return { ok: false, error: 'foto_invalida' };
    datos.fotoUrl = u;
  }

  return { ok: true, evento: { id, tipo: ev.tipo, pedidoId, at, ubicacion, datos } };
}

/** Distancia en km entre dos puntos {lat, lng}. */
function distanciaKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Coordenadas {lat, lng} de un pedido o de un negocio, vengan como vengan. */
function coordenadas(x) {
  if (!x) return null;
  const lat = Number(x.lat);
  const lng = Number(x.lng ?? x.lon);
  return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0) ? { lat, lng } : null;
}

module.exports = {
  esEfectivo,
  efectivoACobrar,
  normalizarReglaPago,
  gananciaDomi,
  cuadrar,
  variantesTelefono,
  estadoParaDomi,
  puedeAplicar,
  validarEvento,
  distanciaKm,
  coordenadas,
  TIPOS_EVENTO,
  MOTIVOS_NO_ENTREGA,
  MODOS_PAGO,
};
