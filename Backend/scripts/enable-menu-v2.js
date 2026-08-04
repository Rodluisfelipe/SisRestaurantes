/**
 * Activa el Menú V2 en todos los negocios existentes.
 *
 * Cambiar el default del modelo a true solo afecta a los negocios nuevos: los
 * que ya existen tienen features.menuV2 guardado en false desde que se creó el
 * flag, así que sin esto el cambio no se notaría en producción.
 *
 * Es idempotente: solo toca los que no lo tienen activo.
 *
 * Uso (dentro del contenedor):
 *   node scripts/enable-menu-v2.js
 *
 * Desde el host:
 *   docker exec backend-backend-1 node scripts/enable-menu-v2.js
 *
 * Para revertir un negocio puntual está el botón "V2" del panel superadmin.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const BusinessConfig = require('../Models/BusinessConfig');

const MONGODB_URI = process.env.MONGODB_URI;

async function run() {
  if (!MONGODB_URI) {
    console.error('Falta MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log('Conectado a MongoDB');

  const pendientes = await BusinessConfig.find({ 'features.menuV2': { $ne: true } })
    .select('businessName slug')
    .lean();

  console.log(`Negocios sin Menú V2: ${pendientes.length}`);
  pendientes.forEach((b) => console.log(`  - ${b.businessName || '(sin nombre)'} [${b.slug || b._id}]`));

  if (pendientes.length === 0) {
    console.log('Nada que hacer.');
    await mongoose.disconnect();
    return;
  }

  const result = await BusinessConfig.updateMany(
    { 'features.menuV2': { $ne: true } },
    { $set: { 'features.menuV2': true } }
  );

  console.log(`Actualizados: ${result.modifiedCount}`);

  const restantes = await BusinessConfig.countDocuments({ 'features.menuV2': { $ne: true } });
  console.log(restantes === 0 ? 'OK: todos los negocios quedaron en V2.' : `ATENCIÓN: quedaron ${restantes} sin activar.`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Error en la migración:', err);
  process.exit(1);
});
