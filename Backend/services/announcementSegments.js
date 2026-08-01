const logger = require('../utils/logger');

/**
 * Segmentos de anuncios: a qué negocios les toca cada uno.
 *
 * Antes todos los anuncios iban a todos, así que avisar de algo del POS
 * llegaba también a quien no lo tiene. Aquí se resuelve quién califica.
 */

const SEGMENTS = {
  all:             { label: 'Todos los negocios', desc: 'Sin filtro' },
  at_risk:         { label: 'En riesgo', desc: 'Llevan días sin recibir pedidos' },
  never_activated: { label: 'Nunca activaron', desc: 'Registrados hace más de una semana y sin un solo pedido' },
  without_pos:     { label: 'Sin POS', desc: 'Aún no tienen el punto de venta activo' },
  with_pos:        { label: 'Con POS', desc: 'Ya usan el punto de venta' },
  without_menu_v2: { label: 'Sin menú V2', desc: 'Siguen con el menú anterior' },
  by_plan:         { label: 'Por plan', desc: 'Solo ciertos planes comerciales' },
};

/**
 * ¿Este negocio recibe este anuncio?
 * Ante cualquier duda devuelve true: es preferible que un anuncio llegue de
 * más a que un aviso importante se pierda en silencio.
 */
async function businessMatchesSegment(businessId, segment) {
  const type = segment?.type || 'all';
  if (type === 'all') return true;

  try {
    const BusinessConfig = require('../Models/BusinessConfig');
    const business = await BusinessConfig.findById(businessId)
      .select('features subscriptionCommercialPlan createdAt')
      .lean();
    if (!business) return false;

    switch (type) {
      case 'without_pos':
        return !business.features?.posBetaEnabled;
      case 'with_pos':
        return !!business.features?.posBetaEnabled;
      case 'without_menu_v2':
        return !business.features?.menuV2;
      case 'by_plan': {
        const plans = (segment.plans || []).map((p) => String(p).toLowerCase());
        if (!plans.length) return true;
        return plans.includes(String(business.subscriptionCommercialPlan || '').toLowerCase());
      }
      case 'at_risk':
      case 'never_activated': {
        const lastOrderAt = await getLastOrderDate(businessId);
        if (type === 'never_activated') {
          const weekOld = Date.now() - new Date(business.createdAt).getTime() > 7 * 864e5;
          return !lastOrderAt && weekOld;
        }
        if (!lastOrderAt) return false;   // sin pedidos nunca cae en never_activated, no aquí
        const days = segment.daysWithoutOrders || 14;
        return Date.now() - new Date(lastOrderAt).getTime() >= days * 864e5;
      }
      default:
        return true;
    }
  } catch (error) {
    logger.warn('Error evaluando segmento de anuncio', { error: error.message, businessId });
    return true;
  }
}

/** Fecha del último pedido: puede estar en Order o en CompletedOrder. */
async function getLastOrderDate(businessId) {
  const Order = require('../Models/Order');
  const CompletedOrder = require('../Models/CompletedOrder');
  const [a, b] = await Promise.all([
    Order.findOne({ businessId }).sort({ createdAt: -1 }).select('createdAt').lean(),
    CompletedOrder.findOne({ businessId }).sort({ createdAt: -1 }).select('createdAt').lean(),
  ]);
  const dates = [a?.createdAt, b?.createdAt].filter(Boolean).map((d) => new Date(d));
  return dates.length ? new Date(Math.max(...dates)) : null;
}

/** Cuántos negocios recibirían un segmento — para mostrarlo antes de publicar. */
async function countSegment(segment) {
  const BusinessConfig = require('../Models/BusinessConfig');
  const type = segment?.type || 'all';
  const actives = await BusinessConfig.find({ isActive: true }).select('_id').lean();
  if (type === 'all') return actives.length;

  let n = 0;
  for (const b of actives) {
    // eslint-disable-next-line no-await-in-loop
    if (await businessMatchesSegment(b._id, segment)) n += 1;
  }
  return n;
}

module.exports = { SEGMENTS, businessMatchesSegment, countSegment };
