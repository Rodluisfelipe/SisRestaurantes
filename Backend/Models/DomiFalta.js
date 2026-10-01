const mongoose = require('mongoose');

/**
 * Una falta del domiciliario: lo único que cuenta en su contra en las métricas.
 *
 * Solo se registran cosas que SÍ son culpa suya (ver services/desempenoDomi.js):
 * dejar vencer una oferta que la app le mostró, aceptar solo y no arrancar,
 * no entregar sin haber llegado donde el cliente, GPS falso. Cada falta se
 * puede reclamar; si el superadmin le da la razón, se anula y deja de contar.
 */
const domiFaltaSchema = new mongoose.Schema({
  telefono: { type: String, required: true, index: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPerson' },
  tipo: { type: String, enum: ['oferta_vencida', 'no_arranco', 'no_entregado', 'gps_falso'], required: true },
  // Pedido u oferta que la originó (para no contarla dos veces)
  refId: { type: String, default: null },
  pedidoNumero: { type: String, default: null },
  negocio: { type: String, default: null },
  at: { type: Date, default: Date.now, index: true },
  // vigente → cuenta | en_revision → la reclamó (sigue contando hasta que se decida) | anulada → no cuenta
  estado: { type: String, enum: ['vigente', 'en_revision', 'anulada'], default: 'vigente', index: true },
  reclamo: {
    nota: { type: String, maxlength: 500 },
    at: { type: Date },
    respuesta: { type: String, maxlength: 300 },
    resueltoAt: { type: Date },
    resueltoPor: { type: String },
  },
}, { timestamps: true });

domiFaltaSchema.index({ telefono: 1, tipo: 1, refId: 1 }, { unique: true, partialFilterExpression: { refId: { $type: 'string' } } });

module.exports = mongoose.model('DomiFalta', domiFaltaSchema);
