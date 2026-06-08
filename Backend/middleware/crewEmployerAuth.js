/**
 * crewEmployerAuth — middleware para autenticar empleadores Crew externos.
 *
 * Espera un JWT con `kind: 'crew_employer'` (emitido por POST /crew/employers/login).
 * Inyecta `req.employer` con el documento CrewEmployer.
 *
 * Bloquea operaciones de empleadores en estado `pending_approval`, `rejected`,
 * `suspended` o `banned`. Solo `approved` pueden mutar.
 *
 * Para endpoints que SÍ permiten ver sin estar aprobado (ej. ver mi propio
 * perfil para saber por qué estoy bloqueado), usar `requireEmployerAny`.
 */
const jwt = require('jsonwebtoken');
const CrewEmployer = require('../Models/CrewEmployer');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

async function loadEmployerFromToken(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return { error: { code: 401, message: 'No autenticado' } };
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.kind !== 'crew_employer') {
      return { error: { code: 401, message: 'Token inválido' } };
    }
    const employer = await CrewEmployer.findById(decoded.id);
    if (!employer) return { error: { code: 401, message: 'Cuenta no existe' } };
    return { employer };
  } catch (e) {
    return { error: { code: 401, message: 'Token inválido o expirado' } };
  }
}

/**
 * requireEmployer — exige token válido + status `approved`.
 * Para todas las mutaciones (publicar, recargar, cancelar, etc).
 */
async function requireEmployer(req, res, next) {
  const { employer, error } = await loadEmployerFromToken(req);
  if (error) return res.status(error.code).json({ message: error.message });
  if (employer.status !== 'approved') {
    return res.status(403).json({
      message: statusToMessage(employer.status, employer.rejectionReason),
      errorCode: 'ACCOUNT_NOT_APPROVED',
      status: employer.status,
    });
  }
  req.employer = employer;
  next();
}

/**
 * requireEmployerAny — exige token válido pero permite cualquier status.
 * Útil para GET /me, para que el empleador pueda ver por qué está bloqueado.
 */
async function requireEmployerAny(req, res, next) {
  const { employer, error } = await loadEmployerFromToken(req);
  if (error) return res.status(error.code).json({ message: error.message });
  req.employer = employer;
  next();
}

function statusToMessage(status, rejectionReason) {
  switch (status) {
    case 'pending_approval':
      return 'Tu cuenta está en revisión. Te avisaremos cuando se apruebe.';
    case 'rejected':
      return `Tu cuenta fue rechazada${rejectionReason ? `: ${rejectionReason}` : ''}.`;
    case 'suspended':
      return 'Tu cuenta está suspendida temporalmente. Contáctanos para más info.';
    case 'banned':
      return 'Tu cuenta ha sido bloqueada.';
    default:
      return `Tu cuenta está en estado ${status}.`;
  }
}

module.exports = { requireEmployer, requireEmployerAny, loadEmployerFromToken };
