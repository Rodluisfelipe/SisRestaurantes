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
    return !!(this.publicKey && this.privateKey && this.integrityKey);
  }

  /**
   * Generar firma de integridad SHA256 para Widget/Web Checkout
   * @param {String} reference - Referencia única de pago
   * @param {Number} amountInCents - Monto en centavos
   * @param {String} currency - Moneda (COP)
   * @returns {String} - Firma SHA256
   */
  generateIntegritySignature(reference, amountInCents, currency = 'COP') {
    if (!this.integrityKey) {
      throw new Error('Wompi integrity key no está configurada');
    }

    // Concatenar: <Referencia><Monto><Moneda><SecretoIntegridad>
    const concatenated = `${reference}${amountInCents}${currency}${this.integrityKey}`;
    
    // Generar hash SHA256
    const signature = crypto
      .createHash('sha256')
      .update(concatenated)
      .digest('hex');
    
    logger.debug('Generated integrity signature', {
      reference,
      amountInCents,
      currency,
      signatureLength: signature.length
    });
    
    return signature;
  }

  /**
   * Obtener los tokens de aceptación desde la API de Wompi
   * @returns {Promise<{acceptance_token, accept_personal_auth}>}
   */
  async getAcceptanceTokens() {
    if (!this.isConfigured()) {
      throw new Error('Wompi no está configurado.');
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/merchants/${this.publicKey}`,
        {
          headers: {
            'Authorization': `Bearer ${this.publicKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const presignedAcceptance = response.data.data?.presigned_acceptance;
      const presignedPersonalAuth = response.data.data?.presigned_personal_data_auth;

      if (!presignedAcceptance || !presignedPersonalAuth) {
        throw new Error('No se pudieron obtener los tokens de aceptación de Wompi');
      }

      return {
        acceptance_token: presignedAcceptance.acceptance_token,
        accept_personal_auth: presignedPersonalAuth.acceptance_token,
        links: {
          terms: presignedAcceptance.permalink,
          personalData: presignedPersonalAuth.permalink
        }
      };
    } catch (error) {
      logger.error('Error obteniendo tokens de aceptación de Wompi', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      throw new Error('No se pudieron obtener los tokens de aceptación: ' + (error.response?.data?.error?.message || error.message));
    }
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
    subscriptionId,
    planType = null,
    shippingAddress = null,
    business = null
  }) {
    if (!this.isConfigured()) {
      throw new Error('Wompi no está configurado. Configure las variables de entorno.');
    }

    // Wompi requiere customer_data con información completa
    // Para crear un checkout donde el usuario elige el método, usamos el campo acceptance_token
    const checkoutData = {
      amount_in_cents: Math.round(amountInCents), // Ya está en centavos
      currency: currency || 'COP',
      reference: reference || `SUB_${subscriptionId}_${Date.now()}`,
      customer_data: {
        email: customerEmail,
        full_name: customerName || 'Cliente Menuby'
      },
      shipping_address: {
        address_line_1: shippingAddress?.address_line_1 || business?.address || 'Dirección no especificada', // Mínimo 4 caracteres requerido
        city: shippingAddress?.city || business?.city || 'Bogotá',
        country: shippingAddress?.country || 'CO',
        region: shippingAddress?.region || business?.department || 'Cundinamarca',
        phone_number: shippingAddress?.phone_number || business?.whatsappNumber || '3000000000'
      },
      redirect_url: redirectUrl
      // No incluimos payment_method para que el usuario pueda elegir en el checkout
    };

    logger.debug('Creating Wompi checkout', { businessId, subscriptionId, amountInCents, checkoutData });

    try {
      logger.info('Starting Wompi checkout creation', { businessId, subscriptionId, planType });
      
      // Obtener los tokens de aceptación dinámicamente desde Wompi
      logger.info('Fetching acceptance tokens from Wompi');
      const acceptanceTokens = await this.getAcceptanceTokens();
      logger.info('Acceptance tokens obtained successfully');
      
      // Para payment_links, la estructura es diferente
      const planTypeDesc = planType ? (planType === 'annual' ? 'anual' : 'mensual') : 'mensual';
      const paymentLinkData = {
        name: `Suscripción ${subscriptionId || 'Menuby'}`,
        description: `Pago de suscripción ${planTypeDesc}`,
        single_use: true,
        collect_shipping: false,
        amount_in_cents: checkoutData.amount_in_cents,
        currency: checkoutData.currency,
        reference: checkoutData.reference,
        customer_data: checkoutData.customer_data,
        shipping_address: checkoutData.shipping_address,
        redirect_url: checkoutData.redirect_url,
        acceptance_token: acceptanceTokens.acceptance_token,
        accept_personal_auth: acceptanceTokens.accept_personal_auth
      };
      
      logger.info('Creating payment link with data', { 
        amount: paymentLinkData.amount_in_cents,
        currency: paymentLinkData.currency,
        hasAcceptanceToken: !!paymentLinkData.acceptance_token,
        hasPersonalAuth: !!paymentLinkData.accept_personal_auth
      });
      
      // Usar /payment_links para que el usuario pueda elegir el método de pago
      const response = await axios.post(
        `${this.baseUrl}/payment_links`,
        paymentLinkData,
        {
          headers: {
            'Authorization': `Bearer ${this.privateKey}`, // Payment links requiere private key
            'Content-Type': 'application/json'
          }
        }
      );
      
      logger.debug('Wompi API response', { status: response.status, data: response.data });

      logger.info('Wompi payment link created successfully', { 
        linkId: response.data.data.id,
        reference: response.data.data.reference
      });

      // Wompi devuelve el payment_link_url en la respuesta de payment_links
      const data = response.data.data || response.data;
      return {
        id: data.id,
        reference: data.reference || reference,
        link: data.url || data.payment_link_url || data.checkout_url,
        status: data.status || 'ACTIVE'
      };

    } catch (error) {
      // Log detallado del error de Wompi
      logger.error('Wompi checkout creation error caught', {
        errorMessage: error.message,
        errorStack: error.stack,
        responseStatus: error.response?.status,
        responseData: error.response?.data
      });
      
      const wompiError = error.response?.data;
      const errorMessages = wompiError?.error?.messages || [];
      const validationErrors = Array.isArray(errorMessages) 
        ? errorMessages.map(m => typeof m === 'string' ? m : JSON.stringify(m)).join(', ')
        : JSON.stringify(errorMessages);
      
      logger.error('Wompi checkout creation failed', { 
        status: error.response?.status,
        errorType: wompiError?.error?.type,
        reason: wompiError?.error?.reason,
        validationErrors: validationErrors,
        fullError: JSON.stringify(wompiError, null, 2),
        requestData: JSON.stringify(paymentLinkData || checkoutData, null, 2)
      });
      
      // Construir mensaje de error más descriptivo
      let errorMessage = 'No se pudo crear el checkout de pago';
      if (wompiError?.error?.reason) {
        errorMessage = `Error en Wompi: ${wompiError.error.reason}`;
      } else if (validationErrors && validationErrors.length > 0) {
        errorMessage = `Error de validación en Wompi: ${validationErrors}`;
      } else if (wompiError?.error?.message) {
        errorMessage = wompiError.error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
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

