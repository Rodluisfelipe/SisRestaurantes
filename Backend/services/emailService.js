const nodemailer = require('nodemailer');
const crypto = require('crypto');
const BusinessConfig = require('../Models/BusinessConfig');
const logger = require('../utils/logger');

// AES-256-CBC encryption for app passwords
const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex').slice(0, 32);
const IV_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf8'), iv);
  let encrypted = cipher.update(text, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encrypted = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf8'), iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Create a Nodemailer transporter for a business using their Gmail App Password.
 */
function createTransporter(senderEmail, appPasswordDecrypted) {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: senderEmail,
      pass: appPasswordDecrypted
    }
  });
}

/**
 * Get the email config for a business. Returns null if not configured.
 * Uses raw DB query to get the actual encrypted password (bypassing toJSON).
 */
async function getEmailConfig(businessId) {
  const config = await BusinessConfig.findById(businessId)
    .select('emailSettings businessName')
    .lean({ virtuals: false });

  if (!config?.emailSettings?.enabled || !config.emailSettings.senderEmail || !config.emailSettings.appPassword) {
    return null;
  }

  let decryptedPassword;
  try {
    decryptedPassword = decrypt(config.emailSettings.appPassword);
  } catch (e) {
    logger.error('Failed to decrypt email app password', { businessId, error: e.message });
    return null;
  }

  return {
    senderEmail: config.emailSettings.senderEmail,
    senderName: config.emailSettings.senderName || config.businessName || 'Mi Negocio',
    password: decryptedPassword,
    settings: config.emailSettings,
    businessName: config.businessName
  };
}

/**
 * Send a transactional email for a business.
 */
async function sendEmail(businessId, { to, subject, html }) {
  const emailConfig = await getEmailConfig(businessId);
  if (!emailConfig) {
    logger.debug('Email not configured for business, skipping', { businessId });
    return { sent: false, reason: 'not_configured' };
  }

  try {
    const transporter = createTransporter(emailConfig.senderEmail, emailConfig.password);
    const info = await transporter.sendMail({
      from: `"${emailConfig.senderName}" <${emailConfig.senderEmail}>`,
      to,
      subject,
      html
    });
    logger.info('Email sent successfully', { businessId, to, messageId: info.messageId });
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Failed to send email', { businessId, to, error: error.message });
    return { sent: false, reason: error.message };
  }
}

/**
 * Send a test email to verify the configuration works.
 */
async function sendTestEmail(senderEmail, appPassword, senderName) {
  try {
    const transporter = createTransporter(senderEmail, appPassword);
    const info = await transporter.sendMail({
      from: `"${senderName || 'MenuBy'}" <${senderEmail}>`,
      to: senderEmail,
      subject: '✅ Correo de prueba — MenuBy',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e293b;">¡Configuración exitosa! ✅</h2>
          <p style="color: #475569;">Tu correo electrónico está correctamente configurado en MenuBy.</p>
          <p style="color: #475569;">A partir de ahora, tus clientes recibirán confirmaciones automáticas de citas y pedidos.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">Este es un correo de prueba enviado desde MenuBy.</p>
        </div>
      `
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ─── EMAIL TEMPLATES ─────────────────────────────────────────

function baseTemplate(businessName, content) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px 20px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; font-size: 18px; margin: 0; font-weight: 700;">${businessName}</h1>
      </div>
      <div style="padding: 24px 20px;">
        ${content}
      </div>
      <div style="padding: 16px 20px; background: #f8fafc; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
        <p style="color: #94a3b8; font-size: 11px; margin: 0; text-align: center;">
          Enviado por ${businessName} a través de MenuBy
        </p>
      </div>
    </div>
  `;
}

function formatDateTime(dateStr) {
  const d = new Date(dateStr);
  const date = d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const time = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
  return { date, time };
}

/**
 * Send booking confirmation email.
 */
async function sendBookingCreatedEmail(businessId, booking) {
  const emailConfig = await getEmailConfig(businessId);
  if (!emailConfig || !emailConfig.settings.sendOnBookingCreated) return;
  if (!booking.customerEmail) return;

  const { date, time } = formatDateTime(booking.bookingDate);
  const services = (booking.items || []).map(i => i.name).join(', ') || 'Servicio';
  const total = (booking.finalAmount || booking.totalAmount || 0).toLocaleString('es-CO');

  const html = baseTemplate(emailConfig.businessName, `
    <h2 style="color: #1e293b; font-size: 20px; margin: 0 0 16px;">📅 Cita Agendada</h2>
    <p style="color: #475569; margin: 0 0 20px;">Hola <strong>${booking.customerName}</strong>, tu cita ha sido agendada correctamente.</p>
    
    <div style="background: #f1f5f9; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="color: #64748b; font-size: 12px; padding: 4px 0;">Fecha</td><td style="color: #1e293b; font-weight: 600; text-align: right; padding: 4px 0;">${date}</td></tr>
        <tr><td style="color: #64748b; font-size: 12px; padding: 4px 0;">Hora</td><td style="color: #1e293b; font-weight: 600; text-align: right; padding: 4px 0;">${time}</td></tr>
        <tr><td style="color: #64748b; font-size: 12px; padding: 4px 0;">Servicio(s)</td><td style="color: #1e293b; font-weight: 600; text-align: right; padding: 4px 0;">${services}</td></tr>
        ${booking.staffName ? `<tr><td style="color: #64748b; font-size: 12px; padding: 4px 0;">Profesional</td><td style="color: #1e293b; font-weight: 600; text-align: right; padding: 4px 0;">${booking.staffName}</td></tr>` : ''}
        <tr><td style="color: #64748b; font-size: 12px; padding: 4px 0;">Total</td><td style="color: #059669; font-weight: 700; text-align: right; padding: 4px 0;">$${total}</td></tr>
      </table>
    </div>

    <p style="color: #475569; font-size: 13px;">Número de cita: <strong>#${booking.orderNumber}</strong></p>
    <p style="color: #94a3b8; font-size: 12px; margin-top: 16px;">Si necesitas cancelar o reprogramar, por favor contacta al negocio con anticipación.</p>
  `);

  return sendEmail(businessId, {
    to: booking.customerEmail,
    subject: `📅 Confirmación de cita — ${emailConfig.businessName}`,
    html
  });
}

/**
 * Send booking confirmed email (when admin confirms a pending booking).
 */
async function sendBookingConfirmedEmail(businessId, booking) {
  const emailConfig = await getEmailConfig(businessId);
  if (!emailConfig || !emailConfig.settings.sendOnBookingConfirmed) return;
  if (!booking.customerEmail) return;

  const { date, time } = formatDateTime(booking.bookingDate);

  const html = baseTemplate(emailConfig.businessName, `
    <h2 style="color: #059669; font-size: 20px; margin: 0 0 16px;">✅ Cita Confirmada</h2>
    <p style="color: #475569; margin: 0 0 20px;">Hola <strong>${booking.customerName}</strong>, tu cita ha sido <strong>confirmada</strong>.</p>
    
    <div style="background: #ecfdf5; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
      <p style="color: #065f46; font-size: 14px; margin: 0;"><strong>📅 ${date}</strong></p>
      <p style="color: #065f46; font-size: 14px; margin: 4px 0 0;"><strong>🕐 ${time}</strong></p>
      ${booking.staffName ? `<p style="color: #065f46; font-size: 14px; margin: 4px 0 0;"><strong>👤 ${booking.staffName}</strong></p>` : ''}
    </div>
    
    <p style="color: #475569; font-size: 13px;">Cita #${booking.orderNumber}</p>
    <p style="color: #94a3b8; font-size: 12px;">¡Te esperamos!</p>
  `);

  return sendEmail(businessId, {
    to: booking.customerEmail,
    subject: `✅ Cita confirmada — ${emailConfig.businessName}`,
    html
  });
}

/**
 * Send booking cancelled email.
 */
async function sendBookingCancelledEmail(businessId, booking) {
  const emailConfig = await getEmailConfig(businessId);
  if (!emailConfig || !emailConfig.settings.sendOnBookingCancelled) return;
  if (!booking.customerEmail) return;

  const { date, time } = formatDateTime(booking.bookingDate);

  const html = baseTemplate(emailConfig.businessName, `
    <h2 style="color: #ef4444; font-size: 20px; margin: 0 0 16px;">❌ Cita Cancelada</h2>
    <p style="color: #475569; margin: 0 0 20px;">Hola <strong>${booking.customerName}</strong>, tu cita ha sido cancelada.</p>
    
    <div style="background: #fef2f2; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
      <p style="color: #991b1b; font-size: 14px; margin: 0;">📅 ${date} — 🕐 ${time}</p>
      ${booking.cancellationReason ? `<p style="color: #991b1b; font-size: 13px; margin: 8px 0 0;">Motivo: ${booking.cancellationReason}</p>` : ''}
    </div>
    
    <p style="color: #475569; font-size: 13px;">Cita #${booking.orderNumber}</p>
    <p style="color: #94a3b8; font-size: 12px;">Si deseas reagendar, puedes hacerlo desde nuestro menú digital.</p>
  `);

  return sendEmail(businessId, {
    to: booking.customerEmail,
    subject: `❌ Cita cancelada — ${emailConfig.businessName}`,
    html
  });
}

/**
 * Send booking reminder email.
 */
async function sendBookingReminderEmail(businessId, booking, hoursUntil) {
  const emailConfig = await getEmailConfig(businessId);
  if (!emailConfig || !emailConfig.settings.sendReminder) return;
  if (!booking.customerEmail) return;

  const { date, time } = formatDateTime(booking.bookingDate);
  const services = (booking.items || []).map(i => i.name).join(', ') || 'tu cita';
  const timeLabel = hoursUntil <= 2 ? 'en 1 hora' : 'mañana';

  const html = baseTemplate(emailConfig.businessName, `
    <h2 style="color: #6366f1; font-size: 20px; margin: 0 0 16px;">⏰ Recordatorio de Cita</h2>
    <p style="color: #475569; margin: 0 0 20px;">Hola <strong>${booking.customerName}</strong>, te recordamos que tienes una cita programada <strong>${timeLabel}</strong>.</p>
    
    <div style="background: #eef2ff; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
      <p style="color: #3730a3; font-size: 14px; margin: 0;"><strong>📅 ${date}</strong></p>
      <p style="color: #3730a3; font-size: 14px; margin: 4px 0 0;"><strong>🕐 ${time}</strong></p>
      <p style="color: #3730a3; font-size: 14px; margin: 4px 0 0;"><strong>💼 ${services}</strong></p>
      ${booking.staffName ? `<p style="color: #3730a3; font-size: 14px; margin: 4px 0 0;"><strong>👤 ${booking.staffName}</strong></p>` : ''}
    </div>
    
    <p style="color: #475569; font-size: 13px;">Cita #${booking.orderNumber}</p>
    <p style="color: #94a3b8; font-size: 12px;">¡Te esperamos!</p>
  `);

  return sendEmail(businessId, {
    to: booking.customerEmail,
    subject: `⏰ Recordatorio: ${services} ${timeLabel} — ${emailConfig.businessName}`,
    html
  });
}

module.exports = {
  encrypt,
  decrypt,
  sendEmail,
  sendTestEmail,
  sendBookingCreatedEmail,
  sendBookingConfirmedEmail,
  sendBookingCancelledEmail,
  sendBookingReminderEmail
};
