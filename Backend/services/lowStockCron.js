const cron = require('node-cron');
const logger = require('../utils/logger');
const { trackRun } = require('./cronRegistry');

/**
 * Aviso diario de existencias bajas.
 *
 * El umbral `lowStockAlert` existía desde antes, pero solo pintaba una etiqueta
 * de color en la pantalla: si nadie entraba a Inventario, nadie se enteraba de
 * que algo se había acabado. Un dato pasivo no cambia una decisión.
 *
 * Corre a las 7:00 a. m. hora Colombia, antes de abrir, que es cuando todavía
 * se puede hacer algo: llamar al proveedor o quitar el producto del menú.
 *
 * Solo escribe a quien tiene inventario activado y algo que reportar. Un aviso
 * que llega todos los días sin novedad se vuelve ruido y se ignora.
 */
async function avisarStockBajo() {
  const BusinessConfig = require('../Models/BusinessConfig');
  const Product = require('../Models/Product');
  const { sendPushToBusinessId } = require('./pushService');

  const negocios = await BusinessConfig.find({
    isActive: true,
    'inventory.mode': { $in: ['basic', 'advanced'] },
  }).select('_id businessName').lean();

  let avisados = 0;
  let sinNovedad = 0;

  for (const negocio of negocios) {
    try {
      const productos = await Product.find({
        businessId: negocio._id,
        trackStock: true,
        active: { $ne: false },
      }).select('name stock lowStockAlert').lean();

      const agotados = productos.filter(p => (p.stock ?? 0) <= 0);
      const bajos = productos.filter(p => {
        const s = p.stock ?? 0;
        return s > 0 && s <= (p.lowStockAlert || 5);
      });

      if (agotados.length === 0 && bajos.length === 0) { sinNovedad++; continue; }

      /* El mensaje nombra los productos en vez de dar solo un número: "se
         acabó la Coca-Cola" se actúa, "3 productos bajos" hay que ir a mirar. */
      const nombres = [...agotados, ...bajos].slice(0, 3).map(p => p.name).join(', ');
      const resto = (agotados.length + bajos.length) - 3;

      const titulo = agotados.length > 0
        ? `Se agotó ${agotados.length === 1 ? agotados[0].name : `${agotados.length} productos`}`
        : 'Productos por acabarse';

      const cuerpo = `${nombres}${resto > 0 ? ` y ${resto} más` : ''}`
        + (agotados.length && bajos.length ? ` · ${agotados.length} agotados, ${bajos.length} por acabarse` : '');

      const r = await sendPushToBusinessId(negocio._id.toString(), {
        title: `📦 ${titulo}`,
        body: cuerpo,
        clickUrl: '/admin?tab=inventory',
        data: { type: 'low_stock', agotados: agotados.length, bajos: bajos.length },
      });

      if (r?.sent > 0) avisados++;
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => setTimeout(r, 200));   // gentil con el servicio de push
    } catch (err) {
      logger.warn('[LowStock] Fallo el aviso de un negocio', { businessId: negocio._id?.toString(), error: err.message });
    }
  }

  return `${avisados} avisados, ${sinNovedad} sin novedad, de ${negocios.length} con inventario`;
}

function startLowStockCron() {
  cron.schedule('0 7 * * *', async () => {
    logger.info('[LowStock] Revisando existencias bajas...');
    try {
      await trackRun('lowStock', avisarStockBajo);
    } catch (err) {
      logger.error('[LowStock] El aviso diario falló', err);
    }
  }, { timezone: 'America/Bogota' });

  logger.info('📦 Low stock cron iniciado (7:00 a. m. Colombia)');
}

module.exports = { startLowStockCron, avisarStockBajo };
