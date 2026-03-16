const BusinessConfig = require('../Models/BusinessConfig');
const logger = require('../utils/logger');

// ─── MULTI-PROVIDER EMAIL (HTTP APIs) ─────────────────────────
// Resend (100/day) + Brevo (300/day) + SendGrid (100/day) = 500/day free
// All use HTTPS port 443, no SMTP needed.

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@menuby.tech';
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'MenuBy';
const API_URL = process.env.API_URL || 'https://157-245-125-216.nip.io';
const MENUBY_LOGO = 'https://menuby.tech/logo.jpeg';
const MENUBY_URL = 'https://www.menuby.tech';

// Daily usage tracking (resets at midnight UTC)
const usage = { resend: 0, brevo: 0, sendgrid: 0, lastReset: new Date().toDateString() };
const LIMITS = { resend: 95, brevo: 290, sendgrid: 95 };

function resetUsageIfNewDay() {
  const today = new Date().toDateString();
  if (usage.lastReset !== today) {
    usage.resend = 0;
    usage.brevo = 0;
    usage.sendgrid = 0;
    usage.lastReset = today;
  }
}

// ─── PROVIDER IMPLEMENTATIONS ─────────────────────────────────

async function sendViaResend(to, subject, html, fromName) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${fromName} <${EMAIL_FROM}>`, to: [to], subject, html })
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return (await res.json()).id;
}

async function sendViaBrevo(to, subject, html, fromName) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender: { name: fromName, email: EMAIL_FROM }, to: [{ email: to }], subject, htmlContent: html })
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
  return (await res.json()).messageId;
}

async function sendViaSendGrid(to, subject, html, fromName) {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: EMAIL_FROM, name: fromName },
      subject,
      content: [{ type: 'text/html', value: html }]
    })
  });
  if (!res.ok) throw new Error(`SendGrid ${res.status}: ${await res.text()}`);
  return `sg-${Date.now()}`;
}

// ─── SMART ROUTER ─────────────────────────────────────────────

function getAvailableProviders() {
  resetUsageIfNewDay();
  const providers = [];
  if (BREVO_API_KEY && usage.brevo < LIMITS.brevo) providers.push({ name: 'brevo', fn: sendViaBrevo });
  if (RESEND_API_KEY && usage.resend < LIMITS.resend) providers.push({ name: 'resend', fn: sendViaResend });
  if (SENDGRID_API_KEY && usage.sendgrid < LIMITS.sendgrid) providers.push({ name: 'sendgrid', fn: sendViaSendGrid });
  return providers;
}

async function sendEmail(businessId, { to, subject, html }) {
  const config = await getEmailSettings(businessId);
  if (!config) {
    logger.info('Email not enabled for business, skipping', { businessId });
    return { sent: false, reason: 'not_enabled' };
  }

  const fromName = config.businessName || EMAIL_FROM_NAME;
  const providers = getAvailableProviders();

  if (providers.length === 0) {
    logger.warn('No email providers available', { businessId });
    return { sent: false, reason: 'no_providers' };
  }

  for (const provider of providers) {
    try {
      const messageId = await provider.fn(to, subject, html, fromName);
      usage[provider.name]++;
      logger.info('Email sent', { provider: provider.name, businessId, to, messageId });
      return { sent: true, provider: provider.name, messageId };
    } catch (error) {
      logger.warn(`Email provider ${provider.name} failed`, { error: error.message });
    }
  }

  logger.error('All email providers failed', { businessId, to });
  return { sent: false, reason: 'all_providers_failed' };
}

// ─── CONFIG ───────────────────────────────────────────────────

async function getEmailSettings(businessId) {
  const config = await BusinessConfig.findById(businessId)
    .select('emailSettings businessName logo theme whatsappNumber address socialMedia slug')
    .lean();
  if (!config?.emailSettings?.enabled) return null;
  const logoPath = config.logo || '';
  const logoUrl = logoPath.startsWith('http') ? logoPath : logoPath ? `${API_URL}${logoPath.startsWith('/') ? '' : '/'}${logoPath}` : '';
  const igHandle = config.socialMedia?.instagram?.url || '';
  return {
    settings: config.emailSettings,
    businessName: config.businessName || 'Mi Negocio',
    logo: logoUrl,
    brandColor: config.theme?.buttonColor || '#6366f1',
    whatsapp: config.whatsappNumber || '',
    address: config.address || '',
    instagram: igHandle,
    slug: config.slug || config._id.toString()
  };
}

async function sendTestEmail(businessId) {
  const config = await getEmailSettings(businessId);
  if (!config) return { success: false, error: 'Email no habilitado' };

  const providers = getAvailableProviders();
  if (providers.length === 0) return { success: false, error: 'No hay proveedores configurados. Contacta al administrador.' };

  const html = baseTemplate(config, `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:20px 0 10px">
      <div style="width:56px;height:56px;border-radius:50%;background:#ecfdf5;display:inline-block;line-height:56px;text-align:center;font-size:28px">✅</div>
    </td></tr></table>
    <h2 style="color:#1e293b;font-size:18px;margin:0 0 8px;text-align:center;font-weight:700">¡Configuración exitosa!</h2>
    <p style="color:#64748b;font-size:14px;text-align:center;margin:0 0 20px;line-height:1.5">Los correos automáticos están activos para <strong style="color:#1e293b">${config.businessName}</strong>. Tus clientes recibirán confirmaciones de citas.</p>
  `);

  const result = await sendEmail(businessId, { to: EMAIL_FROM, subject: `✅ Prueba — ${config.businessName}`, html });
  return result.sent ? { success: true, provider: result.provider } : { success: false, error: result.reason };
}

// ─── TEMPLATES ────────────────────────────────────────────────

function baseTemplate(config, content) {
  const { businessName, logo, brandColor, whatsapp, address, instagram } = config;
  const color2 = adjustColor(brandColor, -30);
  const logoBlock = logo
    ? `<img src="${logo}" alt="${businessName}" style="max-height:56px;max-width:200px;display:block;margin:0 auto 10px;border-radius:8px" />`
    : '';

  // Contact section — always show at least the business page link
  const contactItems = [];
  if (whatsapp) {
    const cleanNum = whatsapp.replace(/\D/g, '');
    contactItems.push(`<a href="https://wa.me/${cleanNum}" style="display:inline-block;background:#25d366;color:#ffffff;font-size:13px;font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none;line-height:1" target="_blank">📱 Escribir por WhatsApp</a>`);
  }
  if (address) {
    contactItems.push(`<span style="color:#475569;font-size:13px">📍 ${address}</span>`);
  }
  if (instagram) {
    const igUser = instagram.includes('instagram.com/') ? instagram.split('instagram.com/').pop().replace(/\/.*$/, '') : instagram.replace('@', '');
    contactItems.push(`<a href="https://instagram.com/${igUser}" style="color:${brandColor};text-decoration:none;font-size:13px;font-weight:500" target="_blank">📸 @${igUser}</a>`);
  }
  const menuUrl = `${MENUBY_URL}/${config.slug || ''}`;
  const contactBlock = `<div style="border-top:1px solid #e2e8f0;padding:16px 24px;background:#ffffff;text-align:center">
      <p style="color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 10px;font-weight:600">Contacto</p>
      ${contactItems.length > 0 ? contactItems.map(item => `<p style="margin:0 0 8px;line-height:1.6">${item}</p>`).join('') : ''}
      <p style="margin:4px 0 0"><a href="${menuUrl}" style="color:${brandColor};text-decoration:none;font-size:12px;font-weight:500" target="_blank">🌐 Ver nuestro menú / servicios</a></p>
    </div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:20px 10px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
      <!-- HEADER -->
      <tr><td style="background:linear-gradient(135deg,${brandColor},${color2});padding:32px 24px;text-align:center">
        ${logoBlock}
        <h1 style="color:#ffffff;font-size:20px;margin:0;font-weight:700;letter-spacing:-0.3px">${businessName}</h1>
      </td></tr>
      <!-- CONTENT -->
      <tr><td style="padding:28px 24px">${content}</td></tr>
      <!-- CONTACT -->
      <tr><td>${contactBlock}</td></tr>
      <!-- FOOTER -->
      <tr><td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">
        <a href="${MENUBY_URL}" style="text-decoration:none;display:inline-block" target="_blank">
          <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto"><tr>
            <td style="vertical-align:middle;padding-right:6px"><img src="${MENUBY_LOGO}" alt="MenuBy" style="height:20px;width:20px;border-radius:4px;display:block" /></td>
            <td style="vertical-align:middle;color:#94a3b8;font-size:10px;font-weight:600;letter-spacing:0.3px">Powered by MenuBy</td>
          </tr></table>
        </a>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function adjustColor(hex, amount) {
  const h = hex.replace('#', '');
  const num = parseInt(h, 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xFF) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xFF) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xFF) + amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function formatDateTime(dateStr) {
  const d = new Date(dateStr);
  return {
    date: d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    time: d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })
  };
}

function detailRow(icon, label, value, valueColor) {
  return `<tr>
    <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;width:24px;vertical-align:top;font-size:14px">${icon}</td>
    <td style="padding:8px 8px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;vertical-align:top">${label}</td>
    <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:${valueColor || '#1e293b'};font-weight:600;font-size:13px;text-align:right;vertical-align:top">${value}</td>
  </tr>`;
}

function contactNote(config) {
  if (config.whatsapp) {
    const cleanNum = config.whatsapp.replace(/\D/g, '');
    return `<div style="text-align:center;margin:20px 0 0">
      <a href="https://wa.me/${cleanNum}" style="display:inline-block;background:#25d366;color:#ffffff;font-size:13px;font-weight:600;padding:10px 24px;border-radius:8px;text-decoration:none" target="_blank">📱 ¿Necesitas cancelar? Escríbenos</a>
    </div>`;
  }
  const menuUrl = `${MENUBY_URL}/${config.slug || ''}`;
  return `<p style="color:#64748b;font-size:12px;margin:16px 0 0;text-align:center;line-height:1.5">¿Necesitas cancelar? <a href="${menuUrl}" style="color:${config.brandColor};font-weight:600;text-decoration:none" target="_blank">Contacta al negocio</a></p>`;
}

async function sendBookingCreatedEmail(businessId, booking) {
  const config = await getEmailSettings(businessId);
  if (!config?.settings?.sendOnBookingCreated || !booking.customerEmail) return;
  const { date, time } = formatDateTime(booking.bookingDate);
  const services = (booking.items || []).map(i => i.name).join(', ') || 'Servicio';
  const total = (booking.finalAmount || booking.totalAmount || 0).toLocaleString('es-CO');
  const html = baseTemplate(config, `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:0 0 16px">
      <div style="width:52px;height:52px;border-radius:50%;background:#eef2ff;display:inline-block;line-height:52px;text-align:center;font-size:24px">📅</div>
    </td></tr></table>
    <h2 style="color:#1e293b;font-size:18px;margin:0 0 6px;text-align:center;font-weight:700">Cita Agendada</h2>
    <p style="color:#64748b;font-size:14px;text-align:center;margin:0 0 24px">Hola <strong style="color:#1e293b">${booking.customerName}</strong>, tu cita ha sido registrada.</p>

    <div style="background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid #e2e8f0">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${detailRow('📆', 'Fecha', date)}
        ${detailRow('🕐', 'Hora', time)}
        ${detailRow('💼', 'Servicio', services)}
        ${booking.staffName ? detailRow('👤', 'Profesional', booking.staffName) : ''}
        ${detailRow('💰', 'Total', `$${total}`, '#059669')}
      </table>
    </div>

    <div style="text-align:center;padding:8px 0">
      <span style="display:inline-block;background:#f1f5f9;color:#64748b;font-size:12px;padding:6px 14px;border-radius:20px;font-weight:500">Cita #${booking.orderNumber}</span>
    </div>

    ${contactNote(config)}
  `);
  return sendEmail(businessId, { to: booking.customerEmail, subject: `📅 Cita agendada — ${config.businessName}`, html });
}

async function sendBookingConfirmedEmail(businessId, booking) {
  const config = await getEmailSettings(businessId);
  if (!config?.settings?.sendOnBookingConfirmed || !booking.customerEmail) return;
  const { date, time } = formatDateTime(booking.bookingDate);
  const services = (booking.items || []).map(i => i.name).join(', ') || 'Servicio';
  const total = (booking.finalAmount || booking.totalAmount || 0).toLocaleString('es-CO');
  const html = baseTemplate(config, `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:0 0 16px">
      <div style="width:52px;height:52px;border-radius:50%;background:#ecfdf5;display:inline-block;line-height:52px;text-align:center;font-size:24px">✅</div>
    </td></tr></table>
    <h2 style="color:#059669;font-size:18px;margin:0 0 6px;text-align:center;font-weight:700">Cita Confirmada</h2>
    <p style="color:#64748b;font-size:14px;text-align:center;margin:0 0 24px">Hola <strong style="color:#1e293b">${booking.customerName}</strong>, tu cita ha sido confirmada.</p>

    <div style="background:#ecfdf5;border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid #d1fae5">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${detailRow('📆', 'Fecha', date)}
        ${detailRow('🕐', 'Hora', time)}
        ${detailRow('💼', 'Servicio', services)}
        ${booking.staffName ? detailRow('👤', 'Profesional', booking.staffName) : ''}
        ${detailRow('💰', 'Total', `$${total}`, '#059669')}
      </table>
    </div>

    <div style="text-align:center;padding:8px 0">
      <span style="display:inline-block;background:#f1f5f9;color:#64748b;font-size:12px;padding:6px 14px;border-radius:20px;font-weight:500">Cita #${booking.orderNumber}</span>
    </div>

    ${contactNote(config)}
  `);
  return sendEmail(businessId, { to: booking.customerEmail, subject: `✅ Cita confirmada — ${config.businessName}`, html });
}

async function sendBookingCancelledEmail(businessId, booking) {
  const config = await getEmailSettings(businessId);
  if (!config?.settings?.sendOnBookingCancelled || !booking.customerEmail) return;
  const { date, time } = formatDateTime(booking.bookingDate);
  const html = baseTemplate(config, `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:0 0 16px">
      <div style="width:52px;height:52px;border-radius:50%;background:#fef2f2;display:inline-block;line-height:52px;text-align:center;font-size:24px">❌</div>
    </td></tr></table>
    <h2 style="color:#ef4444;font-size:18px;margin:0 0 6px;text-align:center;font-weight:700">Cita Cancelada</h2>
    <p style="color:#64748b;font-size:14px;text-align:center;margin:0 0 24px">Hola <strong style="color:#1e293b">${booking.customerName}</strong>, tu cita ha sido cancelada.</p>

    <div style="background:#fef2f2;border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid #fecaca">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${detailRow('📆', 'Fecha', date)}
        ${detailRow('🕐', 'Hora', time)}
        ${booking.cancellationReason ? detailRow('📝', 'Motivo', booking.cancellationReason, '#991b1b') : ''}
      </table>
    </div>

    <div style="text-align:center;padding:8px 0">
      <span style="display:inline-block;background:#f1f5f9;color:#64748b;font-size:12px;padding:6px 14px;border-radius:20px;font-weight:500">Cita #${booking.orderNumber}</span>
    </div>

    <p style="color:#64748b;font-size:13px;text-align:center;margin:16px 0 0;line-height:1.5">Puedes agendar una nueva cita cuando lo desees.</p>
  `);
  return sendEmail(businessId, { to: booking.customerEmail, subject: `❌ Cita cancelada — ${config.businessName}`, html });
}

async function sendBookingReminderEmail(businessId, booking, hoursUntil) {
  const config = await getEmailSettings(businessId);
  if (!config?.settings?.sendReminder || !booking.customerEmail) return;
  const { date, time } = formatDateTime(booking.bookingDate);
  const services = (booking.items || []).map(i => i.name).join(', ') || 'tu cita';
  const timeLabel = hoursUntil <= 2 ? 'en 1 hora' : 'mañana';
  const urgentBg = hoursUntil <= 2 ? '#fff7ed' : '#eef2ff';
  const urgentBorder = hoursUntil <= 2 ? '#fed7aa' : '#c7d2fe';
  const urgentText = hoursUntil <= 2 ? '#9a3412' : '#3730a3';
  const html = baseTemplate(config, `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:0 0 16px">
      <div style="width:52px;height:52px;border-radius:50%;background:${urgentBg};display:inline-block;line-height:52px;text-align:center;font-size:24px">⏰</div>
    </td></tr></table>
    <h2 style="color:${urgentText};font-size:18px;margin:0 0 6px;text-align:center;font-weight:700">Recordatorio de Cita</h2>
    <p style="color:#64748b;font-size:14px;text-align:center;margin:0 0 24px">Hola <strong style="color:#1e293b">${booking.customerName}</strong>, tienes una cita <strong style="color:${urgentText}">${timeLabel}</strong>.</p>

    <div style="background:${urgentBg};border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid ${urgentBorder}">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${detailRow('📆', 'Fecha', date)}
        ${detailRow('🕐', 'Hora', time)}
        ${detailRow('💼', 'Servicio', services)}
        ${booking.staffName ? detailRow('👤', 'Profesional', booking.staffName) : ''}
      </table>
    </div>

    <div style="text-align:center;padding:8px 0">
      <span style="display:inline-block;background:#f1f5f9;color:#64748b;font-size:12px;padding:6px 14px;border-radius:20px;font-weight:500">Cita #${booking.orderNumber}</span>
    </div>

    ${contactNote(config)}
  `);
  return sendEmail(businessId, { to: booking.customerEmail, subject: `⏰ Recordatorio: ${services} ${timeLabel} — ${config.businessName}`, html });
}

module.exports = {
  sendEmail,
  sendTestEmail,
  sendBookingCreatedEmail,
  sendBookingConfirmedEmail,
  sendBookingCancelledEmail,
  sendBookingReminderEmail
};
