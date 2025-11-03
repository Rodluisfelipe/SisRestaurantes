const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

class WompiService {
  constructor() {
    this.baseUrl = process.env.WOMPI_API_URL || 'https://production.wompi.co/v1';
    this.publicKey = process.env.WOMPI_PUBLIC_KEY;
    this.privateKey = process.env.WOMPI_PRIVATE_KEY;
    this.integrityKey = process.env.WOMPI_INTEGRITY_KEY;
    
    // Log warning si no están configuradas las keys
    if (!this.publicKey || !this.privateKey) {
      logger.warn('⚠️ Wompi keys not configured. Payment features will be DISABLED. Set WOMPI_PUBLIC_KEY and WOMPI_PRIVATE_KEY in .env');
    }
  }

  /**
   * Verificar si Wompi está configurado
   */
  isConfigured() {
    return !!(this.publicKey && this.privateKey);
  }

  /**
   * Crear una transacción/checkout en Wompi
   * @param {Object} params - Parámetros del checkout
   * @returns {Promise<{id, reference, link, status}>}
   */
  async createCheckout({ 
    amountInCents, 
    currency, 
    reference, 
    customerEmail,
    customerName,
    redirectUrl,
    businessId,
    subscriptionId
  }) {
    if (!this.isConfigured()) {
      throw new Error('Wompi no está configurado. Configure las variables de entorno.');
    }

    const checkoutData = {
      amount_in_cents: amountInCents * 100, // Wompi usa centavos
      currency: currency,
      customer_email: customerEmail,
      payment_method: {
        type: 'CARD', // Por defecto, se puede cambiar después
        installments: 1
      },
      reference: reference || `SUB_${subscriptionId}_${Date.now()}`,
      shipping_address: {
        address_line_1: '', // TODO: Obtener de BusinessConfig
        city: '',
        country: 'CO'
      },
      redirect_url: redirectUrl
    };

    logger.debug('Creating Wompi checkout', { businessId, subscriptionId, amount: amountInCents });

    try {
      const response = await axios.post(
        `${this.baseUrl}/transactions`,
        checkoutData,
        {
          headers: {
            'Authorization': `Bearer ${this.publicKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('Wompi checkout created successfully', { 
        transactionId: response.data.data.id,
        reference: response.data.data.reference
      });

      return {
        id: response.data.data.id,
        reference: response.data.data.reference || reference,
        link: response.data.data.payment_link_url || response.data.data.checkout_url,
        status: response.data.data.status
      };

    } catch (error) {
      logger.error('Wompi checkout creation failed', error.response?.data || error.message);
      throw new Error('No se pudo crear el checkout de pago. Intenta nuevamente.');
    }
  }

  /**
   * Verificar estado de una transacción
   * @param {String} transactionId
   * @returns {Promise<{id, status, amount, reference}>}
   */
  async getTransactionStatus(transactionId) {
    if (!this.isConfigured()) {
      throw new Error('Wompi no está configurado.');
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/transactions/${transactionId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.publicKey}`
          }
        }
      );

      return {
        id: response.data.data.id,
        status: response.data.data.status, // 'APPROVED' | 'DECLINED' | 'VOIDED' | 'PENDING'
        amount: response.data.data.amount_in_cents / 100,
        reference: response.data.data.reference,
        paymentMethod: response.data.data.payment_method?.type || 'UNKNOWN'
      };

    } catch (error) {
      logger.error('Wompi transaction status check failed', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Validar webhook signature
   * @param {Object} payload
   * @param {String} signature
   * @returns {Boolean}
   */
  verifyWebhookSignature(payload, signature) {
    if (!this.integrityKey) {
      logger.warn('Wompi integrity key not configured. Skipping signature validation.');
      return true; // En desarrollo, permitir si no está configurada
    }

    const eventSignature = crypto
      .createHmac('sha256', this.integrityKey)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(eventSignature)
      );
    } catch (error) {
      logger.error('Error verifying Wompi webhook signature', error);
      return false;
    }
  }
}

module.exports = new WompiService();

