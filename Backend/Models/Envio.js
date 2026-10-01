const mongoose = require('mongoose');

/**
 * Un envío que una empresa de reparto le hace a uno de sus clientes, por fuera
 * de los pedidos de MenuBy. Lo lleva un domi de la empresa con la misma app y
 * el mismo recorrido que un pedido: ir a recoger, recoger, llevar, entregar.
 *
 * Las marcas de tiempo son las mismas que usa un pedido (utils/domiApp las
 * lee igual), así los dos pasan por el mismo código de eventos y de cuadre.
 */
const puntoSchema = new mongoose.Schema({
  nombre: { type: String, trim: true, maxlength: 80, default: '' },
  telefono: { type: String, trim: true, maxlength: 20, default: '' },
  direccion: { type: String, trim: true, maxlength: 160, required: true },
  notas: { type: String, trim: true, maxlength: 200, default: '' },
  ubicacion: { lat: Number, lng: Number },
}, { _id: false });

const envioSchema = new mongoose.Schema({
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPartner', required: true, index: true },
  clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClienteEmpresa', required: true, index: true },
  numero: { type: Number, required: true },
  origen: { type: puntoSchema, required: true },
  destino: { type: puntoSchema, required: true },
  descripcion: { type: String, trim: true, maxlength: 200, default: '' },
  // Lo que el domi le cobra al que recibe (un producto contraentrega), sin el envío
  valorACobrar: { type: Number, default: 0, min: 0 },
  // Quién paga el envío: el cliente de la empresa (a su cuenta) o el que recibe, en efectivo
  pagaEnvio: { type: String, enum: ['cliente', 'destinatario'], default: 'cliente' },
  precio: { type: Number, required: true, min: 0 },
  desglosePrecio: [{ concepto: String, valor: Number, _id: false }],
  zona: { type: String, default: null },
  km: { type: Number, default: null },

  estado: {
    type: String,
    enum: ['buscando', 'asignado', 'entregado', 'no_entregado', 'cancelado'],
    default: 'buscando',
    index: true,
  },
  deliveryPersonId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPerson', default: null, index: true },
  // Marcas con los mismos nombres que en Order: utils/domiApp las lee igual
  deliveryAssignedAt: { type: Date, default: null },
  deliveryArrivedStoreAt: { type: Date, default: null },
  deliveryPickedAt: { type: Date, default: null },
  deliveryArrivedCustomerAt: { type: Date, default: null },
  deliveredAt: { type: Date, default: null },
  deliveryFailedAt: { type: Date, default: null },
  deliveryFailReason: { type: String, default: null },
  deliveryProofPhoto: { type: String, default: null },
  canceladoAt: { type: Date, default: null },
  canceladoPor: { type: String, default: null },

  // El que recibe se lo dicta al domi; lo ve en su enlace de seguimiento
  codigoEntrega: { type: String, required: true },
  intentosCodigo: { type: Number, default: 0 },
  seguimiento: { type: String, required: true, unique: true },
  // Ofertas: domis que ya lo rechazaron o lo dejaron vencer
  rechazadoPor: [{ type: mongoose.Schema.Types.ObjectId }],
  historial: [{ estado: String, nota: String, at: { type: Date, default: Date.now }, _id: false }],
}, { timestamps: true });

envioSchema.index({ partnerId: 1, numero: -1 }, { unique: true });
envioSchema.index({ partnerId: 1, createdAt: -1 });
envioSchema.index({ deliveryPersonId: 1, deliveredAt: -1 }, { partialFilterExpression: { deliveryPersonId: { $type: 'objectId' } } });

module.exports = mongoose.model('Envio', envioSchema);
