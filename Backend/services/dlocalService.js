/**
 * dLocal Go Service
 * 
 * Integración con dLocal Go para pagos de suscripción.
 * API docs: https://docs.dlocalgo.com/integration-api
 * 
 * Auth: Bearer <API_KEY>:<SECRET_KEY>
 * Sandbox: https://api-sbx.dlocalgo.com
 * Live:    https://api.dlocalgo.com
 * 
 * Comisión: 1.99% + USD 0.20 (todos los métodos en Colombia)
 */

const crypto = require('crypto');
const logger = require('../utils/logger');
const { getPaidPlanOptions, resolvePaymentSelection } = require('../utils/commercialPlans');

const config = {
  apiKey: process.env.DLOCAL_API_KEY || '',
  secretKey: process.env.DLOCAL_SECRET_KEY || '',
  smartFieldsKey: process.env.DLOCAL_SMART_FIELDS_KEY || '',
  isTest: (process.env.DLOCAL_TEST || 'false') === 'true',
  get baseUrl() {
    return this.isTest ? 'https://api-sbx.dlocalgo.com' : 'https://api.dlocalgo.com';
  },
};

const BASE_PLANS = getPaidPlanOptions();

// dLocal Go: 1.99% + USD 0.20
const PERCENT_FEE = 0.0199;
const FIXED_FEE_USD = 0.20;
const USD_TO_COP = 4200; // Tasa aproximada

/**
 * Calcular total con comisión dLocal incluida
 * total = ceil((base + fixedFeeCOP) / (1 - 0.0199) / 100) * 100
 */
function calculateTotalWithCommission(basePrice) {
  const fixedFeeCop = FIXED_FEE_USD * USD_TO_COP;
  const raw = (basePrice + fixedFeeCop) / (1 - PERCENT_FEE);
  return Math.ceil(raw / 100) * 100;
}

/**
 * Obtener todos los planes con precios dLocal
 */
function getPlans() {
  return BASE_PLANS.map(plan => {
    const total = calculateTotalWithCommission(plan.basePrice);
    const commission = total - plan.basePrice;
    return {
      id: `${plan.commercialPlan}_${plan.billingCycle}`,
      commercialPlan: plan.commercialPlan,
      billingCycle: plan.billingCycle,
      months: plan.months,
      label: plan.label,
      basePrice: plan.basePrice,
      total,
      commission,
      pricePerMonth: plan.pricePerMonth,
    };
  });
}

function getPlanDetails(selectionInput) {
  if (!selectionInput) return null;

  const selection = typeof selectionInput === 'object'
    ? resolvePaymentSelection(selectionInput)
    : resolvePaymentSelection({ months: selectionInput });

  if (!selection || selection.commercialPlan === 'free') return null;

  return getPlans().find(
    (p) => p.commercialPlan === selection.commercialPlan && p.billingCycle === selection.billingCycle
  ) || null;
}

/**
 * Generar headers de autenticación para dLocal Go
 * Formato: Bearer <API_KEY>:<SECRET_KEY>
 */
function generateAuthHeaders() {
  return {
    'Authorization': `Bearer ${config.apiKey}:${config.secretKey}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Verificar firma de notificación de dLocal Go
 * Signature = HMAC-SHA256(secretKey, apiKey + jsonBody)
 */
function verifyWebhookSignature(bodyStr, receivedSignature) {
  const message = config.apiKey + bodyStr;
  const expected = crypto.createHmac('sha256', config.secretKey)
    .update(message)
    .digest('hex');
  // Timing-safe comparison to prevent signature guessing via timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(receivedSignature, 'utf8'));
  } catch {
    return false; // Different lengths
  }
}

/**
 * Generar referencia de pago única
 */
function generatePaymentReference(businessId, selectionInput) {
  const selection = typeof selectionInput === 'object'
    ? resolvePaymentSelection(selectionInput)
    : resolvePaymentSelection({ months: selectionInput });
  const bizSuffix = businessId.toString().slice(-6);
  const random = crypto.randomBytes(4).toString('hex');
  const planPart = selection
    ? `${selection.commercialPlan}-${selection.billingCycle}`
    : 'legacy';
  return `DL-${bizSuffix}-${planPart}-${Date.now()}-${random}`;
}

function isConfigured() {
  return !!(config.apiKey && config.secretKey);
}

module.exports = {
  config,
  PLANS: BASE_PLANS,
  getPlans,
  getPlanDetails,
  calculateTotalWithCommission,
  generateAuthHeaders,
  verifyWebhookSignature,
  generatePaymentReference,
  isConfigured,
};
