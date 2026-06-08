/**
 * CrewFavorite — worker guarda restaurantes favoritos.
 * Permite re-encontrar negocios donde tuvo buena experiencia
 * y recibir notificaciones cuando publican turnos nuevos.
 */
const mongoose = require('mongoose');

const crewFavoriteSchema = new mongoose.Schema({
  workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true, index: true },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig', required: true, index: true },
  note: { type: String, maxlength: 100, default: '' }, // nota personal opcional
}, { timestamps: true });

// Un worker solo puede tener un favorito por negocio
crewFavoriteSchema.index({ workerId: 1, businessId: 1 }, { unique: true });

module.exports = mongoose.models.CrewFavorite || mongoose.model('CrewFavorite', crewFavoriteSchema);
