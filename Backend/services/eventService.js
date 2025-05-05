class EventService {
  constructor() {
    this.clients = new Set();
  }

  // Agregar un nuevo cliente
  addClient(client) {
    this.clients.add(client);
    console.log(`Cliente conectado. Total clientes: ${this.clients.size}`);
  }

  // Remover un cliente
  removeClient(client) {
    this.clients.delete(client);
    console.log(`Cliente desconectado. Total clientes: ${this.clients.size}`);
  }

  // Enviar evento a todos los clientes
  sendEventToAll(eventData) {
    const data = JSON.stringify(eventData);
    this.clients.forEach(client => {
      client.write(`data: ${data}\n\n`);
    });
  }
}

// Exportar una única instancia
module.exports = new EventService(); 