const AuditLog = require('../Models/AuditLog');
const logger = require('./logger');

/**
 * Create an audit log entry. Fire-and-forget (non-blocking).
 *
 * @param {Object} opts
 * @param {string} opts.action - create | update | delete | toggle | reorder
 * @param {string} opts.resource - product | category | toppingGroup | businessConfig | order | subscription
 * @param {string} opts.resourceId
 * @param {string} [opts.resourceName]
 * @param {Object|string} opts.businessId
 * @param {string} [opts.businessName]
 * @param {Object} [opts.before] - snapshot before the action
 * @param {Object} [opts.after] - snapshot after the action
 * @param {import('express').Request} [opts.req] - Express request (extracts user info + IP + UA)
 */
function audit(opts) {
  try {
    const { action, resource, resourceId, resourceName, businessId, businessName, before, after, req } = opts;

    const entry = {
      action,
      resource,
      resourceId: String(resourceId),
      resourceName: resourceName || '',
      businessId,
      businessName: businessName || '',
      before: before || null,
      after: after || null,
    };

    // Extract user info from request
    if (req) {
      const user = req.user || {};
      entry.userId = user.id || user._id || null;
      entry.userEmail = user.email || null;
      entry.userRole = user.role || (user.businessId ? 'admin' : 'unknown');
      entry.ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.connection?.remoteAddress || null;
      entry.userAgent = req.headers['user-agent'] || null;
    }

    // Fire and forget — don't await
    AuditLog.create(entry).catch(err => {
      logger.warn('Failed to write audit log', { error: err.message, action, resource, resourceId });
    });
  } catch (err) {
    // Never let audit logging crash the request
    logger.warn('Audit log error', { error: err.message });
  }
}

module.exports = { audit };
