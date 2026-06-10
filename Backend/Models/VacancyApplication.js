/**
 * VacancyApplication — postulación de un worker a una Vacancy.
 *
 * Distinta de ShiftApplication: no genera Booking ni mueve plata. Es solo
 * un registro de interés. El proceso de contratación se sale del marketplace
 * (el empleador y el candidato pactan directamente).
 *
 * Estados:
 *   pending     → recién postulado, sin revisar
 *   shortlisted → seleccionado para entrevista
 *   interviewing → en proceso de entrevista
 *   hired       → contratado (cierra el ciclo positivamente)
 *   rejected    → descartado por el empleador
 *   withdrawn   → el worker se retiró
 */
const mongoose = require('mongoose');

const ANSWER_STATUS = ['pending', 'shortlisted', 'interviewing', 'hired', 'rejected', 'withdrawn'];

// Respuesta a una pregunta del formulario personalizado.
// Guardamos el ID y el texto de la pregunta para que el ledger no dependa
// de que la vacante siga existiendo idéntica (snapshot).
const answerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  question: { type: String, required: true, maxlength: 280 }, // snapshot
  value: { type: mongoose.Schema.Types.Mixed, default: null }, // string | string[] | number | bool
}, { _id: false });

const vacancyApplicationSchema = new mongoose.Schema({
  vacancyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vacancy', required: true, index: true },
  workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true, index: true },

  // Snapshot del owner para facilitar queries del lado empleador sin populate
  ownerType: { type: String, enum: ['business', 'crew_employer'], required: true, index: true },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig', default: null, index: true },
  employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CrewEmployer', default: null, index: true },

  // Mensaje libre del worker (opcional)
  coverLetter: { type: String, maxlength: 2000, default: '' },

  // Respuestas al formulario
  answers: [answerSchema],

  // CV (URL al PDF en Spaces) si la vacante lo exigió o el worker lo cargó voluntariamente
  cvUrl: { type: String, default: null },

  // Estado y notas internas del empleador
  status: { type: String, enum: ANSWER_STATUS, default: 'pending', index: true },
  internalNote: { type: String, maxlength: 500, default: '' },

  // Score auto-calculado para ordenar (sprint 2: ranking smarter)
  matchScore: { type: Number, default: 0 },

  appliedAt: { type: Date, default: Date.now },
  respondedAt: { type: Date, default: null },
  withdrawnAt: { type: Date, default: null },
}, { timestamps: true });

// Un worker no puede postularse 2 veces a la misma vacante
vacancyApplicationSchema.index({ vacancyId: 1, workerId: 1 }, { unique: true });
vacancyApplicationSchema.index({ workerId: 1, status: 1, createdAt: -1 });
vacancyApplicationSchema.index({ vacancyId: 1, status: 1, matchScore: -1 });

module.exports = mongoose.models.VacancyApplication
  || mongoose.model('VacancyApplication', vacancyApplicationSchema);
module.exports.ANSWER_STATUS = ANSWER_STATUS;
