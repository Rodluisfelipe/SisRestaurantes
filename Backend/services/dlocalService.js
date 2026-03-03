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

const config = {
  apiKey: process.env.DLOCAL_API_KEY || 'hdwWMaogDXXYZvEfrIztWlWIAzKkQHLx',
  secretKey: process.env.DLOCAL_SECRET_KEY || 'QJiOzA6PxeHjJxTGEAypGTqNTdJkAyCzis176IVc',
  smartFieldsKey: process.env.DLOCAL_SMART_FIELDS_KEY || '3997e61a-4e7c-42ed-b28c-b204f1682e4c',
  isTest: (process.env.DLOCAL_TEST || 'false') === 'true',
  get baseUrl() {
    return this.isTest ? 'https://api-sbx.dlocalgo.com' : 'https://api.dlocalgo.com';
  },
};

// Planes — mismos precios base que ePayco
const PLANS = {
  1: { months: 1, basePrice: 30000, label: '1 Mes' },
  3: { months: 3, basePrice: 90000, label: '3 Meses' },
  6: { months: 6, basePrice: 180000, label: '6 Meses' },
  12: { months: 12, basePrice: 360000, label: '12 Meses' },
};

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
  return Object.values(PLANS).map(plan => {
    const total = calculateTotalWithCommission(plan.basePrice);
    const commission = total - plan.basePrice;
    return {
      months: plan.months,
      label: plan.label,
      basePrice: plan.basePrice,
      total,
      commission,
      pricePerMonth: Math.round(plan.basePrice / plan.months),
    };
  });
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
  return expected === receivedSignature;
}

/**
 * Generar referencia de pago única
 */
function generatePaymentReference(businessId, months) {
  const bizSuffix = businessId.toString().slice(-6);
  const random = crypto.randomBytes(4).toString('hex');
  return `DL-${bizSuffix}-${months}M-${Date.now()}-${random}`;
}

function isConfigured() {
  return !!(config.apiKey && config.secretKey);
}

module.exports = {
  config,
  PLANS,
  getPlans,
  calculateTotalWithCommission,
  generateAuthHeaders,
  verifyWebhookSignature,
  generatePaymentReference,
  isConfigured,
};
