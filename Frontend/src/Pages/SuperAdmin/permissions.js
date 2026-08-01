/**
 * Matriz de permisos del panel SuperAdmin.
 *
 * Fuente única de verdad para el frontend: qué puede ver y hacer cada rol.
 * El backend debe replicar las decisiones críticas (no confíes solo en esto).
 *
 * Roles ordenados de menor a mayor poder:
 *   auditor → support → admin → owner
 */

export const ROLE_LEVEL = {
  auditor: 1,
  support: 2,
  admin: 3,
  owner: 4,
};

export const ROLE_INFO = {
  owner: {
    label: 'Owner',
    short: 'Owner',
    color: 'amber',
    desc: 'Control total. Único rol con gestión del equipo.',
  },
  admin: {
    label: 'Admin',
    short: 'Admin',
    color: 'violet',
    desc: 'Operaciones del día a día: negocios, suscripciones, contenido. No toca equipo.',
  },
  support: {
    label: 'Soporte',
    short: 'Soporte',
    color: 'cyan',
    desc: 'Aprobaciones (banners, pagos, referidos), anuncios. No edita suscripciones ni borra.',
  },
  auditor: {
    label: 'Auditor',
    short: 'Auditor',
    color: 'slate',
    desc: 'Solo lectura en todo el panel.',
  },
};

/**
 * Tabs visibles por rol. El sidebar oculta los no permitidos.
 */
export const NAV_BY_ROLE = {
  owner:   ['home', 'businesses', 'health', 'activation', 'brands', 'orders', 'partners', 'banners', 'announcements', 'subscriptions', 'referrals', 'crew_people', 'crew_kyc', 'crew_employers', 'crew_vacancies', 'crew_finance', 'team', 'audit', 'system', 'whatsapp'],
  admin:   ['home', 'businesses', 'health', 'activation', 'brands', 'orders', 'partners', 'banners', 'announcements', 'subscriptions', 'referrals', 'crew_people', 'crew_kyc', 'crew_employers', 'crew_vacancies', 'crew_finance', 'audit', 'system', 'whatsapp'],
  support: ['home', 'businesses', 'health', 'activation', 'orders', 'banners', 'announcements', 'subscriptions', 'referrals', 'crew_people', 'crew_kyc', 'crew_employers', 'crew_vacancies', 'crew_finance', 'audit', 'system'],
  auditor: ['home', 'businesses', 'health', 'activation', 'orders', 'banners', 'announcements', 'subscriptions', 'referrals', 'crew_people', 'crew_kyc', 'crew_employers', 'crew_vacancies', 'crew_finance', 'audit', 'system'],
};

/**
 * Acciones por recurso/operación. Formato: `resource:action`.
 * Usa wildcard `*` para "todas las acciones del recurso".
 */
const PERMS = {
  owner: ['*'],
  admin: [
    'business:read', 'business:create', 'business:update', 'business:delete', 'business:activate', 'business:pos_beta',
    'order:read', 'order:update',
    'banner:read', 'banner:approve', 'banner:reject', 'banner:delete',
    'announcement:read', 'announcement:create', 'announcement:update', 'announcement:delete',
    'subscription:read', 'subscription:update',
    'payment_request:read', 'payment_request:approve', 'payment_request:reject',
    'referral:read', 'referral:approve', 'referral:reject', 'referral:config',
    'audit:read', 'audit:revert',
  ],
  support: [
    'business:read', 'business:activate',
    'order:read', 'order:update',
    'banner:read', 'banner:approve', 'banner:reject',
    'announcement:read', 'announcement:create', 'announcement:update',
    'subscription:read',
    'payment_request:read', 'payment_request:approve', 'payment_request:reject',
    'referral:read', 'referral:approve', 'referral:reject',
    'audit:read',
  ],
  auditor: [
    'business:read', 'order:read', 'banner:read', 'announcement:read',
    'subscription:read', 'payment_request:read', 'referral:read', 'audit:read',
  ],
};

/**
 * Devuelve true si el rol tiene la acción solicitada.
 *   can('admin', 'business:delete') → true
 *   can('support', 'business:delete') → false
 *   can('owner', 'cualquier_cosa') → true
 */
export function can(role, action) {
  const perms = PERMS[role];
  if (!perms) return false;
  if (perms.includes('*')) return true;
  if (perms.includes(action)) return true;
  // wildcard por recurso: `resource:*` matchea `resource:cualquier_accion`
  const [resource] = action.split(':');
  return perms.includes(`${resource}:*`);
}

/**
 * Devuelve true si el rol del usuario tiene al menos el nivel mínimo requerido.
 */
export function hasMinRole(userRole, minRole) {
  return (ROLE_LEVEL[userRole] || 0) >= (ROLE_LEVEL[minRole] || 0);
}

/**
 * Lista todas las acciones que un rol puede hacer (expande wildcards).
 * Útil para debugging.
 */
export function listPermissions(role) {
  return PERMS[role] || [];
}
