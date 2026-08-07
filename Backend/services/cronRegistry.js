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
  dbBackup:        { label: 'Respaldo de la base', schedule: 'Diario 4:30 a. m.', maxAgeHours: 30 },
  lowStock:        { label: 'Aviso de existencias bajas', schedule: 'Diario 7:00 a. m.', maxAgeHours: 30 },
};

/* Ventana en la que una misma tarea no se vuelve a ejecutar. Cubre de sobra
   el solape de un despliegue, que dura segundos, y queda muy por debajo de la
   frecuencia del cron más seguido (reservas, cada 15 minutos). */
const VENTANA_MS = 5 * 60 * 1000;

/**
 * Reclama la tarea de forma atómica. Devuelve false si otro proceso ya la
 * tomó hace poco.
 *
 * El candado es la base de datos, no la memoria: durante un despliegue
 * solapado conviven dos contenedores y cada uno tiene su propio proceso, así
 * que una bandera en memoria no los coordinaría.
 */
async function reclamar(task) {
  const corte = new Date(Date.now() - VENTANA_MS);
  try {
    const r = await CronRun.updateOne(
      { task, $or: [{ startedAt: { $lte: corte } }, { startedAt: null }] },
      { $set: { task, startedAt: new Date() } },
      { upsert: true }
    );
    return r.modifiedCount > 0 || r.upsertedCount > 0;
  } catch (err) {
    /* El índice único de `task` hace que, si otro proceso lo reclamó entre el
       filtro y la inserción, esto falle con clave duplicada. Es justo la señal
       de que alguien más lo tiene. */
    if (err?.code === 11000) return false;
    // Cualquier otro problema no debe impedir que la tarea corra
    logger.warn(`No se pudo reclamar el cron ${task}, se ejecuta igual`, { error: err.message });
    return true;
  }
}

/**
 * Envuelve la corrida de un cron para dejar registro de cuándo pasó y cómo le
 * fue. Nunca cambia el comportamiento: si el registro falla, la tarea sigue.
 */
async function trackRun(task, fn) {
  if (!(await reclamar(task))) {
    logger.info(`Cron ${task} omitido: otro proceso lo está ejecutando`);
    return undefined;
  }

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
