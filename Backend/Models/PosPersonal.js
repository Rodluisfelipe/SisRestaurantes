const mongoose = require('mongoose');

/**
 * Quién trabaja en las cajas de un negocio y qué puede hacer.
 *
 * Un documento por negocio: roles y personas se leen siempre juntos —la caja
 * los baja en la misma consulta— y son pocos, así que no justifican dos
 * colecciones.
 *
 * El PIN se guarda en bcrypt y **baja a las cajas así**, porque la caja tiene
 * que poder verificarlo sin internet. Un PIN de cuatro dígitos se rompe por
 * fuerza bruta si alguien se lleva el hash; la defensa real está en la caja,
 * que se bloquea tras cinco intentos fallidos.
 */
const usuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true, maxlength: 60 },
  pinHash: { type: String, required: true },
  rol: { type: String, required: true, trim: true, maxlength: 40 },
  activo: { type: Boolean, default: true },
}, { timestamps: true });

const posPersonalSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig', required: true, unique: true },
  roles: [{
    _id: false,
    id: { type: String, required: true, trim: true, maxlength: 40 },
    nombre: { type: String, required: true, trim: true, maxlength: 40 },
    permisos: [{ type: String }],
  }],
  usuarios: [usuarioSchema],
}, { timestamps: true });

module.exports = mongoose.model('PosPersonal', posPersonalSchema);
