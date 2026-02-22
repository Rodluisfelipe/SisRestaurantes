const logger = require('../utils/logger');

class EventService {
  constructor() {
    // Map of businessId -> Set of SSE response objects
    this.businessClients = new Map();
  }

  // Agregar un nuevo cliente asociado a un negocio
  addClient(client, businessId) {
    if (!businessId) {
      logger.warn('SSE client attempted to connect without businessId');
      return;
    }
    const bizId = businessId.toString();
    if (!this.businessClients.has(bizId)) {
      this.businessClients.set(bizId, new Set());
    }
    this.businessClients.get(bizId).add(client);
    logger.debug('SSE client connected', { businessId: bizId, totalClients: this.businessClients.get(bizId).size });
  }

  // Remover un cliente
  removeClient(client, businessId) {
    if (!businessId) return;
    const bizId = businessId.toString();
    const clients = this.businessClients.get(bizId);
    if (clients) {
      clients.delete(client);
      if (clients.size === 0) {
        this.businessClients.delete(bizId);
      }
      logger.debug('SSE client disconnected', { businessId: bizId, totalClients: clients.size });
    }
  }

  // Enviar evento solo a los clientes de un negocio específico
  sendEventToBusiness(businessId, eventData) {
    if (!businessId) return;
    const bizId = businessId.toString();
    const clients = this.businessClients.get(bizId);
    if (!clients || clients.size === 0) return;

    const data = JSON.stringify(eventData);
    clients.forEach(client => {
      try {
        client.write(`data: ${data}\n\n`);
      } catch (err) {
        logger.warn('Error writing to SSE client, removing', { businessId: bizId });
        this.removeClient(client, bizId);
      }
    });
  }

  // Backward-compat: sendEventToAll now requires businessId (broadcasts to a single tenant)
  sendEventToAll(eventData, businessId) {
    if (businessId) {
      this.sendEventToBusiness(businessId, eventData);
    } else {
      logger.warn('sendEventToAll called without businessId — event dropped for tenant safety');
    }
  }
}

// Exportar una única instancia
module.exports = new EventService(); 