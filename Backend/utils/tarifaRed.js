/**
 * Cuánto se le paga a un domiciliario independiente de la Red MenuBy por un
 * pedido. Es la misma idea que usan Rappi o DiDi:
 *
 *   base + distancia de entrega + distancia para ir a recoger
 *   × lo que hace la hora (pico o noche), la lluvia y la demanda
 *   → acotado entre un mínimo y un máximo, redondeado hacia arriba.
 *
 * Tres reglas que la sostienen:
 *  1. Se calcula una sola vez, al ofrecer el pedido, y se congela: el domi
 *     acepta viendo cuánto va a ganar y eso no cambia después.
 *  2. Todo recargo sale en el desglose con su nombre ("Hora pico +$800").
 *     Un domi que entiende por qué gana más confía en la tarifa.
 *  3. Los recargos no se suman sin techo: con lluvia, noche y mucha demanda a
 *     la vez, el multiplicador total se corta en `multiplicadorMaximo`.
 *
 * Todo es puro (sin base ni red) para probarlo entero.
 */

const CONFIG_BASE = Object.freeze({
  base: 2500,
  porKm: 1000,
  kmIncluidos: 1,
  porKmRecogida: 500,
  recogidaGratisKm: 1.5,
  minimo: 4500,
  maximo: 30000,
  horasPico: [
    { desde: '11:30', hasta: '14:00', factor: 1.15 },
    { desde: '18:30', hasta: '21:00', factor: 1.15 },
  ],
  noche: { desde: '22:00', hasta: '05:00', factor: 1.2 },
  lluvia: 1.25,
  demanda: { sensibilidad: 0.25, maximo: 1.6 },
  multiplicadorMaximo: 2,
  redondeo: 500,
  // Lo que MenuBy le cobra al negocio encima del pago al domi (0 = nada)
  comisionPorcentaje: 0,
});

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** Mezcla la configuración guardada con la de base, sin dejar valores absurdos. */
function normalizarConfig(c = {}) {
  const b = CONFIG_BASE;
  const positivo = (v, d) => Math.max(0, num(v, d));
  const factor = (v, d) => Math.min(3, Math.max(1, num(v, d)));
  const hora = (h, d) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(h || '')) ? String(h) : d);
  const franjas = Array.isArray(c.horasPico) ? c.horasPico : b.horasPico;
  const minimo = positivo(c.minimo, b.minimo);
  return {
    base: positivo(c.base, b.base),
    porKm: positivo(c.porKm, b.porKm),
    kmIncluidos: positivo(c.kmIncluidos, b.kmIncluidos),
    porKmRecogida: positivo(c.porKmRecogida, b.porKmRecogida),
    recogidaGratisKm: positivo(c.recogidaGratisKm, b.recogidaGratisKm),
    minimo,
    maximo: Math.max(minimo, positivo(c.maximo, b.maximo)),
    horasPico: franjas.slice(0, 6).map((f) => ({
      desde: hora(f?.desde, '12:00'), hasta: hora(f?.hasta, '14:00'), factor: factor(f?.factor, 1.15),
    })),
    noche: {
      desde: hora(c.noche?.desde, b.noche.desde),
      hasta: hora(c.noche?.hasta, b.noche.hasta),
      factor: factor(c.noche?.factor, b.noche.factor),
    },
    lluvia: factor(c.lluvia, b.lluvia),
    demanda: {
      sensibilidad: Math.min(1, positivo(c.demanda?.sensibilidad, b.demanda.sensibilidad)),
      maximo: factor(c.demanda?.maximo, b.demanda.maximo),
    },
    multiplicadorMaximo: factor(c.multiplicadorMaximo, b.multiplicadorMaximo),
    redondeo: Math.max(1, Math.round(positivo(c.redondeo, b.redondeo))),
    comisionPorcentaje: Math.min(50, positivo(c.comisionPorcentaje, b.comisionPorcentaje)),
  };
}

/** Minutos desde medianoche en hora de Colombia (UTC-5, sin horario de verano). */
function minutoColombia(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  return (((d.getUTCHours() - 5) * 60 + d.getUTCMinutes()) % 1440 + 1440) % 1440;
}

const aMinutos = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** ¿El minuto cae en la franja? Soporta franjas que cruzan medianoche (22:00–05:00). */
function enFranja(minuto, desde, hasta) {
  const a = aMinutos(desde);
  const b = aMinutos(hasta);
  return a <= b ? minuto >= a && minuto < b : minuto >= a || minuto < b;
}

/**
 * Factor por demanda: más pedidos esperando que domis libres cerca sube el
 * pago, para que alguien lo tome. Con igual o más domis que pedidos, 1.
 */
function factorDemanda(demanda, oferta, cfg) {
  const d = Math.max(0, num(demanda, 0));
  const o = Math.max(0, num(oferta, 0));
  if (d <= 0) return 1;
  const ratio = d / Math.max(1, o);
  if (ratio <= 1) return 1;
  return Math.min(cfg.demanda.maximo, 1 + cfg.demanda.sensibilidad * (ratio - 1));
}

const redondearArriba = (v, paso) => Math.ceil(v / paso) * paso;

/**
 * @param {Object} e
 * @param {number} e.kmEntrega   del local al cliente (por calle)
 * @param {number} e.kmRecogida  del domi al local (por calle)
 * @param {Date}   e.fecha
 * @param {number} e.demanda     pedidos esperando domi cerca del local
 * @param {number} e.oferta      domis libres cerca del local
 * @param {boolean} e.lluvia
 * @param {Object} config        la guardada por el superadmin (se normaliza)
 */
function calcularTarifa(e = {}, config = {}) {
  const cfg = normalizarConfig(config);
  const kmEntrega = Math.max(0, num(e.kmEntrega, 0));
  const kmRecogida = Math.max(0, num(e.kmRecogida, 0));
  const desglose = [];

  desglose.push({ concepto: 'Tarifa base', valor: Math.round(cfg.base) });
  const kmCobrados = Math.max(0, kmEntrega - cfg.kmIncluidos);
  const porDistancia = Math.round(kmCobrados * cfg.porKm);
  if (porDistancia > 0) desglose.push({ concepto: `Distancia (${kmEntrega.toFixed(1)} km)`, valor: porDistancia });
  const kmRecogidaCobrados = Math.max(0, kmRecogida - cfg.recogidaGratisKm);
  const porRecogida = Math.round(kmRecogidaCobrados * cfg.porKmRecogida);
  if (porRecogida > 0) desglose.push({ concepto: `Ir a recoger (${kmRecogida.toFixed(1)} km)`, valor: porRecogida });

  const subtotal = cfg.base + porDistancia + porRecogida;

  // Hora: pico y noche no se suman; manda la mayor
  const minuto = minutoColombia(e.fecha || new Date());
  const pico = cfg.horasPico.filter((f) => enFranja(minuto, f.desde, f.hasta)).reduce((m, f) => Math.max(m, f.factor), 1);
  const noche = enFranja(minuto, cfg.noche.desde, cfg.noche.hasta) ? cfg.noche.factor : 1;
  const hora = Math.max(pico, noche);
  const lluvia = e.lluvia ? cfg.lluvia : 1;
  const demanda = factorDemanda(e.demanda, e.oferta, cfg);

  const bruto = hora * lluvia * demanda;
  const multiplicador = Math.min(cfg.multiplicadorMaximo, bruto);
  const escala = bruto > 0 ? multiplicador / bruto : 1; // si se topó, cada recargo baja en proporción

  // El recargo de cada factor se calcula en cadena para que el desglose sume exacto
  let acumulado = subtotal;
  const recargo = (factor, concepto) => {
    if (factor <= 1) return;
    const nuevo = acumulado * (1 + (factor - 1) * escala);
    const valor = Math.round(nuevo - acumulado);
    if (valor > 0) desglose.push({ concepto, valor });
    acumulado = nuevo;
  };
  recargo(hora, noche > pico ? 'Horario nocturno' : 'Hora pico');
  recargo(lluvia, 'Lluvia');
  recargo(demanda, 'Alta demanda');

  let pago = Math.max(cfg.minimo, Math.min(cfg.maximo, acumulado));
  pago = redondearArriba(pago, cfg.redondeo);
  const sumado = desglose.reduce((s, d) => s + d.valor, 0);
  if (pago !== sumado) {
    desglose.push({ concepto: pago > sumado ? (acumulado < cfg.minimo ? 'Ajuste a la tarifa mínima' : 'Redondeo') : 'Tope máximo', valor: pago - sumado });
  }

  const comision = Math.round((pago * cfg.comisionPorcentaje) / 100);
  return {
    pagoDomi: pago,
    comision,
    cobroNegocio: pago + comision,
    multiplicador: Math.round(multiplicador * 100) / 100,
    factores: { hora, lluvia, demanda: Math.round(demanda * 100) / 100 },
    km: { entrega: Math.round(kmEntrega * 10) / 10, recogida: Math.round(kmRecogida * 10) / 10 },
    desglose,
  };
}

module.exports = { calcularTarifa, normalizarConfig, factorDemanda, minutoColombia, enFranja, CONFIG_BASE };
