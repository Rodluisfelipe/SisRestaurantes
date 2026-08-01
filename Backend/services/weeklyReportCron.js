const cron = require('node-cron');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { startOfDayCOL } = require('../utils/timezone');
const BusinessConfig = require('../Models/BusinessConfig');
const Admin = require('../Models/Admin');
const CompletedOrder = require('../Models/CompletedOrder');
const { sendWeeklyReportEmail } = require('./emailService');
const { trackRun } = require('./cronRegistry');

const WD = ['', 'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAY_MS = 24 * 60 * 60 * 1000;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Stats de un negocio en [start, end) — hora Colombia via completedAt en UTC.
async function statsFor(bizId, start, end) {
  const rev = { $ifNull: ['$finalAmount', '$totalAmount'] };
  const rows = await CompletedOrder.aggregate([
    { $match: { businessId: bizId, completedAt: { $gte: start, $lt: end } } },
    { $facet: {
      totals: [{ $group: {
        _id: null,
        orders: { $sum: 1 },
        revenue: { $sum: rev },
        products: { $sum: { $reduce: { input: { $ifNull: ['$items', []] }, initialValue: 0, in: { $add: ['$$value', { $ifNull: ['$$this.quantity', 0] }] } } } },
      } }],
      byWeekday: [
        { $group: { _id: { $dayOfWeek: { date: '$completedAt', timezone: 'America/Bogota' } }, revenue: { $sum: rev } } },
        { $sort: { revenue: -1 } }, { $limit: 1 },
      ],
      topProduct: [
        { $unwind: '$items' },
        { $group: { _id: '$items.name', qty: { $sum: '$items.quantity' } } },
        { $sort: { qty: -1 } }, { $limit: 1 },
      ],
    } },
  ]);
  const f = rows[0] || {};
  const t = (f.totals && f.totals[0]) || { orders: 0, revenue: 0, products: 0 };
  return {
    orders: t.orders, revenue: t.revenue, products: t.products,
    bestDay: (f.byWeekday && f.byWeekday[0]) ? { label: WD[f.byWeekday[0]._id] || '', revenue: f.byWeekday[0].revenue } : null,
    topProduct: (f.topProduct && f.topProduct[0]) ? { name: f.topProduct[0]._id, qty: f.topProduct[0].qty } : null,
  };
}

async function runWeeklyReports() {
  const end = startOfDayCOL(new Date());               // hoy 00:00 COL (exclusivo)
  const start = new Date(end.getTime() - 7 * DAY_MS);  // 7 días atrás
  const prevEnd = start;
  const prevStart = new Date(start.getTime() - 7 * DAY_MS);
  const periodLabel = `${start.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })} — ${new Date(end.getTime() - 1).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}`;

  const businesses = await BusinessConfig.find({ isActive: true }).select('_id businessName slug logo').lean();
  let sent = 0;
  for (const b of businesses) {
    try {
      const bizId = new mongoose.Types.ObjectId(b._id);
      const cur = await statsFor(bizId, start, end);
      if (!cur.orders) continue; // sin actividad esta semana: no molestar

      const admin = await Admin.findOne({ businessId: b._id, role: 'admin' }).select('username').lean();
      const to = admin?.username;
      if (!to || !/@/.test(to)) continue; // username no es email

      const prev = await statsFor(bizId, prevStart, prevEnd);
      await sendWeeklyReportEmail({
        to, businessName: b.businessName, slug: b.slug, logo: b.logo,
        stats: {
          periodLabel,
          revenue: cur.revenue, orders: cur.orders, products: cur.products,
          avgTicket: cur.orders ? cur.revenue / cur.orders : 0,
          revenuePrev: prev.revenue, ordersPrev: prev.orders,
          topProduct: cur.topProduct, bestDay: cur.bestDay,
        },
      });
      sent++;
      await sleep(400); // gentil con los límites de los proveedores
    } catch (e) {
      logger.warn('Weekly report failed for business', { businessId: b._id?.toString(), error: e.message });
    }
  }
  logger.info(`Weekly reports sent: ${sent}/${businesses.length}`);
}

function startWeeklyReportCron() {
  // Lunes 8:00 AM Colombia
  cron.schedule('0 8 * * 1', () => {
    trackRun('weeklyReport', runWeeklyReports).catch(e => logger.error('Weekly report cron error', e));
  }, { timezone: 'America/Bogota' });
  logger.info('Weekly report cron started (Mondays 8am COL)');
}

module.exports = { startWeeklyReportCron, runWeeklyReports };
