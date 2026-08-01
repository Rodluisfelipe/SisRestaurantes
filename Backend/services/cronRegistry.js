const CronRun = require('../Models/CronRun');
const logger = require('../utils/logger');

/**
 * Catálogo de tareas programadas: nombre legible y cada cuánto deberían correr.
 * `maxAgeHours` es la tolerancia antes de considerarlas atrasadas.
 */
const TASKS = {
  googleRefresh:   { label: 'Reseñas de Google', schedule: 'Diario 4:00 a. m.', maxAgeHours: 30 },
  subscriptions:   { label: 'Suscripciones', schedule: 'Diario', maxAgeHours: 30 },
  weeklyReport:    { label: 'Reporte semanal', schedule: 'Semanal', maxAgeHours: 24 * 8 },
  orderCleanup:    { label: 'Limpieza de pedidos', schedule: 'Diario', maxAgeHours: 30 },
  loyaltyExpiry:   { label: 'Vencimiento de puntos', schedule: 'Diario', maxAgeHours: 30 },
  bookingReminder: { label: 'Recordatorios de reservas', schedule: 'Cada hora', maxAgeHours: 3 },
  dailyDigest:     { label: 'Resumen diario por correo', schedule: 'Diario 7:00 a. m.', maxAgeHours: 30 },
};

/**
 * Envuelve la corrida de un cron para dejar registro de cuándo pasó y cómo le
 * fue. Nunca cambia el comportamiento: si el registro falla, la tarea sigue.
 */
async function trackRun(task, fn) {
  const started = Date.now();
  try {
    const result = await fn();
    const summary = typeof result === 'string'
      ? result.slice(0, 200)
      : result && typeof result === 'object'
        ? JSON.stringify(result).slice(0, 200)
        : null;
    await CronRun.findOneAndUpdate(
      { task },
      {
        task,
        lastRunAt: new Date(),
        lastStatus: 'ok',
        lastError: null,
        lastDurationMs: Date.now() - started,
        lastResult: summary,
        $inc: { runs: 1 },
      },
      { upsert: true }
    ).catch(() => {});
    return result;
  } catch (err) {
    await CronRun.findOneAndUpdate(
      { task },
      {
        task,
        lastRunAt: new Date(),
        lastStatus: 'error',
        lastError: String(err?.message || err).slice(0, 300),
        lastDurationMs: Date.now() - started,
        $inc: { runs: 1, failures: 1 },
      },
      { upsert: true }
    ).catch(() => {});
    logger.error(`Cron ${task} falló`, err);
    throw err;
  }
}

module.exports = { TASKS, trackRun };
