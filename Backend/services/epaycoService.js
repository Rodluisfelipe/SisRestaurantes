/**
 * ePayco Service
 * 
 * Maneja la integración con ePayco para cobros automáticos de suscripción.
 * Utiliza el Standard Checkout de ePayco.
 * 
 * Configuración requerida (variables de entorno):
 * - EPAYCO_PUBLIC_KEY
 * - EPAYCO_PRIVATE_KEY  
 * - EPAYCO_P_CUST_ID
 * - EPAYCO_P_KEY
 * - EPAYCO_TEST (true/false)
 */

const crypto = require('crypto');
const logger = require('../utils/logger');
const { getPaidPlanOptions, resolvePaymentSelection } = require('../utils/commercialPlans');

// Configuración de ePayco desde variables de entorno
const config = {
  publicKey: process.env.EPAYCO_PUBLIC_KEY || '',
  privateKey: process.env.EPAYCO_PRIVATE_KEY || '',
  pCustId: process.env.EPAYCO_P_CUST_ID || '',
  pKey: process.env.EPAYCO_P_KEY || '',
  isTest: process.env.EPAYCO_TEST === 'true',
};

const BASE_PLANS = getPaidPlanOptions();

/**
 * Calcular precio con comisión ePayco incluida
 * ePayco cobra ~2.99% + $900 COP (tarjeta) o ~$3,500 (PSE)
 * Usamos 3.5% + $1,000 para cubrir cualquier método con margen
 * Fórmula: total = ceil((base + 1000) / (1 - 0.035) / 100) * 100
 */
function calculateTotalWithCommission(basePrice) {
  const COMMISSION_RATE = 0.035; // 3.5%
  const FIXED_FEE = 1000; // $1,000 COP fijo
  const raw = (basePrice + FIXED_FEE) / (1 - COMMISSION_RATE);
  // Redondear al próximo $100
  return Math.ceil(raw / 100) * 100;
}

/**
 * Obtener detalle de un plan con precios
 */
function toGatewayPlan(basePlan) {
  const total = calculateTotalWithCommission(basePlan.basePrice);
  const commission = total - basePlan.basePrice;

  return {
    id: `${basePlan.commercialPlan}_${basePlan.billingCycle}`,
    commercialPlan: basePlan.commercialPlan,
    billingCycle: basePlan.billingCycle,
    months: basePlan.months,
    label: basePlan.label,
    basePrice: basePlan.basePrice,
    commission,
    total,
    pricePerMonth: basePlan.pricePerMonth
  };
}

function getPlanDetails(selectionInput) {
  if (!selectionInput) return null;

  const selection = typeof selectionInput === 'object'
    ? resolvePaymentSelection(selectionInput)
    : resolvePaymentSelection({ months: selectionInput });

  if (!selection || selection.commercialPlan === 'free') return null;

  const basePlan = BASE_PLANS.find(
    (p) => p.commercialPlan === selection.commercialPlan && p.billingCycle === selection.billingCycle
  );

  if (!basePlan) return null;
  return toGatewayPlan(basePlan);
}

/**
 * Obtener todos los planes con precios
 */
function getAllPlans() {
  return BASE_PLANS.map(toGatewayPlan);
}

/**
 * Generar referencia única de pago
 */
function generatePaymentReference(businessId, selectionInput) {
  const selection = typeof selectionInput === 'object'
    ? resolvePaymentSelection(selectionInput)
    : resolvePaymentSelection({ months: selectionInput });
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  const planPart = selection
    ? `${selection.commercialPlan}-${selection.billingCycle}`
    : 'legacy';
  return `SUB-${businessId.toString().slice(-6)}-${planPart}-${timestamp}-${random}`;
}

/**
 * Validar la firma de confirmación de ePayco
 * Firma = md5(p_cust_id_cliente + p_key + x_ref_payco + x_transaction_id + x_amount + x_currency_code)
 */
function validateConfirmationSignature(data) {
  const { x_ref_payco, x_transaction_id, x_amount, x_currency_code, x_signature } = data;
  
  const signatureString = `${config.pCustId}^${config.pKey}^${x_ref_payco}^${x_transaction_id}^${x_amount}^${x_currency_code}`;
  const expectedSignature = crypto.createHash('sha256').update(signatureString).digest('hex');
  
  // Timing-safe comparison to prevent signature guessing via timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(expectedSignature, 'utf8'), Buffer.from(x_signature || '', 'utf8'));
  } catch {
    return false; // Different lengths
  }
}

/**
 * Interpretar el código de respuesta de ePayco
 * x_cod_response: 1 = Aceptada, 2 = Rechazada, 3 = Pendiente, 4 = Fallida
 */
function interpretResponseCode(codResponse) {
  const code = parseInt(codResponse);
  switch (code) {
    case 1: return { status: 'approved', label: 'Aprobada' };
    case 2: return { status: 'rejected', label: 'Rechazada' };
    case 3: return { status: 'pending', label: 'Pendiente' };
    case 4: return { status: 'failed', label: 'Fallida' };
    case 6: return { status: 'reversed', label: 'Reversada' };
    case 7: return { status: 'held', label: 'Retenida' };
    case 8: return { status: 'started', label: 'Iniciada' };
    case 9: return { status: 'expired', label: 'Expirada' };
    case 10: return { status: 'abandoned', label: 'Abandonada' };
    case 11: return { status: 'cancelled', label: 'Cancelada' };
    case 12: return { status: 'antifraud', label: 'Antifraude' };
    default: return { status: 'unknown', label: 'Desconocido' };
  }
}

/**
 * Verificar si ePayco está configurado
 */
function isConfigured() {
  return !!(config.publicKey && config.privateKey && config.pCustId && config.pKey);
}

module.exports = {
  config,
  PLANS: BASE_PLANS,
  calculateTotalWithCommission,
  getPlanDetails,
  getAllPlans,
  generatePaymentReference,
  validateConfirmationSignature,
  interpretResponseCode,
  isConfigured,
};
