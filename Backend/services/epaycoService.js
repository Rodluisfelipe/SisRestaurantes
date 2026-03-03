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

// Configuración de ePayco desde variables de entorno
const config = {
  publicKey: process.env.EPAYCO_PUBLIC_KEY || '',
  privateKey: process.env.EPAYCO_PRIVATE_KEY || '',
  pCustId: process.env.EPAYCO_P_CUST_ID || '',
  pKey: process.env.EPAYCO_P_KEY || '',
  isTest: process.env.EPAYCO_TEST === 'true',
};

/**
 * Planes de suscripción disponibles
 * Precio base = lo que nosotros recibimos neto
 * totalConComision = lo que paga el cliente (base + ~4% para cubrir comisión ePayco)
 */
const PLANS = {
  1: { months: 1, basePrice: 30000, label: '1 Mes' },
  3: { months: 3, basePrice: 90000, label: '3 Meses' },
  6: { months: 6, basePrice: 180000, label: '6 Meses' },
  12: { months: 12, basePrice: 360000, label: '12 Meses' },
};

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
function getPlanDetails(months) {
  const plan = PLANS[months];
  if (!plan) return null;
  
  const total = calculateTotalWithCommission(plan.basePrice);
  const commission = total - plan.basePrice;
  
  return {
    months: plan.months,
    label: plan.label,
    basePrice: plan.basePrice,
    commission,
    total,
    pricePerMonth: Math.round(plan.basePrice / plan.months),
  };
}

/**
 * Obtener todos los planes con precios
 */
function getAllPlans() {
  return Object.keys(PLANS).map(k => getPlanDetails(parseInt(k)));
}

/**
 * Generar referencia única de pago
 */
function generatePaymentReference(businessId, months) {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  return `SUB-${businessId.slice(-6)}-${months}M-${timestamp}-${random}`;
}

/**
 * Validar la firma de confirmación de ePayco
 * Firma = md5(p_cust_id_cliente + p_key + x_ref_payco + x_transaction_id + x_amount + x_currency_code)
 */
function validateConfirmationSignature(data) {
  const { x_ref_payco, x_transaction_id, x_amount, x_currency_code, x_signature } = data;
  
  const signatureString = `${config.pCustId}^${config.pKey}^${x_ref_payco}^${x_transaction_id}^${x_amount}^${x_currency_code}`;
  const expectedSignature = crypto.createHash('sha256').update(signatureString).digest('hex');
  
  return expectedSignature === x_signature;
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
  PLANS,
  calculateTotalWithCommission,
  getPlanDetails,
  getAllPlans,
  generatePaymentReference,
  validateConfirmationSignature,
  interpretResponseCode,
  isConfigured,
};
