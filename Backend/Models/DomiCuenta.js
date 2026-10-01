const mongoose = require('mongoose');

/**
 * La cuenta del domiciliario en la app v2: una por celular.
 *
 * Cada negocio registra a sus domis en DeliveryPerson (y una empresa aliada a
 * los suyos). La misma persona puede estar en varios; aquí se junta todo lo
 * que es de la persona y no de un negocio: la sesión, el candado contra
 * intentos de PIN y sus preferencias.
 */
const domiCuentaSchema = new mongoose.Schema({
  // Celular en 10 dígitos (sin 57)
  telefono: { type: String, required: true, unique: true, trim: true },
  // Sesión larga: hash del token de renovación vigente (rota en cada uso)
  refreshHash: { type: String, default: null },
  // Candado: un PIN de 4 dígitos se adivina en minutos sin esto
  fallos: { type: Number, default: 0 },
  bloqueadaHasta: { type: Date, default: null },
  ultimoIngreso: { type: Date, default: null },
  // Plataforma y versión de la app, para soporte
  dispositivo: {
    plataforma: { type: String, default: '' },
    version: { type: String, default: '' },
  },
  // Contra trampas: el último reporte de la app y las veces que se pilló GPS falso
  seguridad: {
    alterada: { type: Boolean, default: false },
    motivos: { type: [String], default: [] },
    avisos: { type: [String], default: [] },
    revisadaAt: { type: Date, default: null },
    simuladas: { type: Number, default: 0 },
    saltos: { type: Number, default: 0 },
    ultimaTrampaAt: { type: Date, default: null },
    // Último punto de GPS bueno: ancla para pillar saltos imposibles
    ultimoPunto: { lat: Number, lng: Number, at: Date },
  },
}, { timestamps: true });

module.exports = mongoose.model('DomiCuenta', domiCuentaSchema);
