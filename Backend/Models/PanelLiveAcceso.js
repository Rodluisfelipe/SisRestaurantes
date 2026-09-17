const mongoose = require('mongoose');

/**
 * Cuentas del Panel LIVE, el panel de TikTok que corre como servicio aparte en
 * el mismo servidor.
 *
 * Las personas se registran en el propio panel y quedan pendientes hasta que
 * alguien las apruebe desde el SuperAdmin. También se puede dar de alta un
 * correo antes: al registrarse, entra directo.
 *
 * El panel no pasa por esta API: lee y escribe la colección directamente. Por
 * eso el nombre de la colección va fijo; si cambia aquí, el panel deja de ver
 * las cuentas.
 */
const panelLiveAccesoSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 254
  },
  nombre: {
    type: String,
    default: ''
  },
  nota: {
    type: String,
    default: '',
    trim: true,
    maxlength: 120
  },
  // Pendiente (nunca aprobada) y pausada comparten activo=false; las
  // distingue aprobadoEn.
  activo: {
    type: Boolean,
    default: true
  },
  aprobadoEn: {
    type: Date,
    default: null
  },
  agregadoPor: {
    type: String,
    default: ''
  },
  // Lo escribe el panel al registrarse (scrypt). Nunca sale por la API.
  passwordHash: {
    type: String,
    select: false
  },
  ultimoIngreso: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  collection: 'panellive_accesos'
});

module.exports = mongoose.model('PanelLiveAcceso', panelLiveAccesoSchema);
