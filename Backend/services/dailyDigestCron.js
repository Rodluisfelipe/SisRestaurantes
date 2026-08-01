const cron = require('node-cron');
const logger = require('../utils/logger');
const { trackRun } = require('./cronRegistry');

/**
 * Resumen diario de operación al correo del dueño.
 *
 * El panel solo avisa si entras. Esto invierte la relación: cada mañana llega
 * lo que necesita tu atención y, si no hay nada, no molesta.
 *
 * Destinatario: DIGEST_EMAIL (o SUPERADMIN_EMAIL como respaldo).
 */

const money = (n) => `$${Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

async function buildDigest() {
  const BusinessConfig = require('../Models/BusinessConfig');
  const Order = require('../Models/Order');
  const CompletedOrder = require('../Models/CompletedOrder');
  const PaymentRequest = require('../Models/PaymentRequest');
  const CronRun = require('../Models/CronRun');
  const { TASKS } = require('./cronRegistry');

  const now = new Date();
  const d1 = new Date(now - 864e5);
  const d7 = new Date(now - 7 * 864e5);
  const d14 = new Date(now - 14 * 864e5);

  const [ordersToday, completedToday, pendingProofs, businesses, lastOrders, cronRuns] = await Promise.all([
    Order.countDocuments({ createdAt: { $gte: d1 } }),
    CompletedOrder.countDocuments({ createdAt: { $gte: d1 } }),
    PaymentRequest.countDocuments({ status: 'pending' }),
    BusinessConfig.find({ isActive: true }).select('_id businessName createdAt').lean(),
    Promise.all([
      Order.aggregate([{ $group: { _id: '$businessId', last: { $max: '$createdAt' } } }]),
      CompletedOrder.aggregate([{ $group: { _id: '$businessId', last: { $max: '$createdAt' } } }]),
    ]).then(([a, b]) => [...a, ...b]),
    CronRun.find({}).lean(),
  ]);

  // Último pedido por negocio (vive en Order o en CompletedOrder)
  const lastBy = new Map();
  for (const r of lastOrders) {
    const k = String(r._id);
    const cur = lastBy.get(k);
    if (!cur || (r.last && r.last > cur)) lastBy.set(k, r.last);
  }

  const atRisk = [];
  let neverActivated = 0;
  for (const b of businesses) {
    const last = lastBy.get(String(b._id));
    if (!last) {
      if (new Date(b.createdAt) < d7) neverActivated += 1;
      continue;
    }
    if (new Date(last) < d14) {
      atRisk.push({ name: b.businessName, days: Math.floor((now - new Date(last)) / 864e5) });
    }
  }
  atRisk.sort((a, b) => b.days - a.days);

  // Tareas atrasadas o con error
  const runBy = new Map(cronRuns.map((r) => [r.task, r]));
  const cronIssues = [];
  for (const [key, meta] of Object.entries(TASKS)) {
    const r = runBy.get(key);
    if (!r || !r.lastRunAt) continue;   // sin datos aún: no se reporta como falla
    if (r.lastStatus === 'error') cronIssues.push(`${meta.label}: falló (${String(r.lastError || '').slice(0, 60)})`);
    else if ((now - new Date(r.lastRunAt)) / 36e5 > meta.maxAgeHours) cronIssues.push(`${meta.label}: sin correr desde hace ${Math.floor((now - new Date(r.lastRunAt)) / 36e5)} h`);
  }

  const newBusinesses = businesses.filter((b) => new Date(b.createdAt) >= d1).length;

  return {
    ordersToday: ordersToday + completedToday,
    newBusinesses,
    pendingProofs,
    atRisk,
    neverActivated,
    cronIssues,
    totalBusinesses: businesses.length,
  };
}

function renderHtml(d) {
  const needsAttention = d.atRisk.length + d.pendingProofs + d.cronIssues.length;
  const row = (label, value, tone = '#0f172a') =>
    `<tr><td style="padding:6px 0;color:#64748b;font-size:14px">${label}</td>
     <td style="padding:6px 0;text-align:right;font-weight:700;font-size:15px;color:${tone}">${value}</td></tr>`;

  const block = (title, items, color) => items.length ? `
    <div style="margin-top:20px">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${color}">${title}</p>
      ${items.map((t) => `<div style="padding:8px 12px;background:#f8fafc;border-left:3px solid ${color};border-radius:4px;margin-bottom:6px;font-size:14px;color:#334155">${t}</div>`).join('')}
    </div>` : '';

  return `<!DOCTYPE html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">
    <div style="background:#fff;border-radius:16px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.06)">
      <h1 style="margin:0 0 4px;font-size:19px;color:#0f172a">Resumen de MenuBy</h1>
      <p style="margin:0 0 20px;font-size:13px;color:#94a3b8">
        ${new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>

      <div style="padding:14px;border-radius:12px;background:${needsAttention > 0 ? '#fffbeb' : '#ecfdf5'};margin-bottom:16px">
        <p style="margin:0;font-size:15px;font-weight:700;color:${needsAttention > 0 ? '#92400e' : '#065f46'}">
          ${needsAttention > 0 ? `${needsAttention} cosa${needsAttention > 1 ? 's' : ''} que requiere${needsAttention > 1 ? 'n' : ''} tu atención` : 'Todo en orden hoy'}
        </p>
      </div>

      <table style="width:100%;border-collapse:collapse">
        ${row('Pedidos en 24 h', d.ordersToday)}
        ${row('Negocios nuevos', d.newBusinesses)}
        ${row('Negocios activos', d.totalBusinesses)}
        ${d.pendingProofs > 0 ? row('Comprobantes por revisar', d.pendingProofs, '#b45309') : ''}
      </table>

      ${block('Se están apagando', d.atRisk.slice(0, 8).map((b) => `<strong>${b.name}</strong> — sin pedidos hace ${b.days} días`), '#dc2626')}
      ${d.neverActivated > 0 ? block('Nunca activaron', [`${d.neverActivated} negocio(s) registrados hace más de una semana y sin un solo pedido`], '#ea580c') : ''}
      ${block('Sistema', d.cronIssues, '#d97706')}

      <a href="https://menuby.tech/superadmin" style="display:block;margin-top:22px;padding:12px;background:#0f172a;color:#fff;text-decoration:none;border-radius:10px;text-align:center;font-weight:700;font-size:14px">Abrir el panel</a>
      <p style="margin:14px 0 0;font-size:11px;color:#cbd5e1;text-align:center">Resumen automático diario de MenuBy</p>
    </div>
  </div></body></html>`;
}

async function runDailyDigest() {
  const to = process.env.DIGEST_EMAIL || process.env.SUPERADMIN_EMAIL;
  if (!to) {
    logger.warn('Daily digest sin destinatario: define DIGEST_EMAIL');
    return 'sin destinatario';
  }

  const d = await buildDigest();
  const attention = d.atRisk.length + d.pendingProofs + d.cronIssues.length;

  /* Si no hay nada que atender, no se envía: un correo diario que siempre dice
     "todo bien" se deja de leer y deja de servir cuando sí importa. */
  if (attention === 0) {
    logger.info('Daily digest omitido: nada que reportar');
    return 'sin novedades, no se envió';
  }

  const { sendSystemEmail } = require('./emailService');
  const subject = `MenuBy · ${attention} cosa${attention > 1 ? 's' : ''} por revisar`;
  const res = await sendSystemEmail({ to, subject, html: renderHtml(d) });
  return res.sent ? `enviado a ${to}` : `no enviado (${res.reason})`;
}

function startDailyDigestCron() {
  cron.schedule('0 7 * * *', () => {
    trackRun('dailyDigest', runDailyDigest).catch((e) => logger.error('Daily digest cron error', e));
  }, { timezone: 'America/Bogota' });
  logger.info('Daily digest cron started (diario 7am COL)');
}

module.exports = { startDailyDigestCron, runDailyDigest, buildDigest, renderHtml };
