const mongoose = require('mongoose');

/**
 * CronRun — última ejecución de cada tarea programada.
 *
 * Sin esto no había forma de saber si un cron corrió: se descubría cuando un
 * cliente reclamaba. Un documento por tarea, sobrescrito en cada corrida.
 */
const cronRunSchema = new mongoose.Schema({
  task: { type: String, required: true, unique: true, index: true },
  lastRunAt: { type: Date, default: null },
  lastStatus: { type: String, enum: ['ok', 'error'], default: null },
  lastError: { type: String, default: null },
  lastDurationMs: { type: Number, default: null },
  lastResult: { type: String, default: null },   // resumen corto y legible
  runs: { type: Number, default: 0 },
  failures: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.models.CronRun || mongoose.model('CronRun', cronRunSchema);
