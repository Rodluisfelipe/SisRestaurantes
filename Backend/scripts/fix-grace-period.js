/**
 * Script para actualizar graceUntil en suscripciones existentes.
 * Cambia de 5 días de gracia a 1 día.
 * 
 * Uso: node scripts/fix-grace-period.js
 */
const mongoose = require('mongoose');
require('dotenv').config();

const GRACE_DAYS = parseInt(process.env.SUBSCRIPTION_GRACE_DAYS || '1');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Conectado a MongoDB');

  const Subscription = require('../Models/Subscription');

  // Buscar TODAS las suscripciones
  const subs = await Subscription.find({}).sort({ createdAt: -1 });
  console.log(`Total suscripciones: ${subs.length}`);

  for (const sub of subs) {
    const periodEnd = sub.periodEnd || sub.endDate;
    if (!periodEnd) {
      console.log(`  [${sub._id}] Sin periodEnd, saltando`);
      continue;
    }

    const oldGrace = sub.graceUntil;
    const newGrace = new Date(periodEnd);
    newGrace.setDate(newGrace.getDate() + GRACE_DAYS);

    console.log(`  [${sub._id}] business=${sub.businessId} plan=${sub.planType}`);
    console.log(`    periodEnd:    ${periodEnd.toISOString()}`);
    console.log(`    graceUntil:   ${oldGrace ? oldGrace.toISOString() : 'null'} -> ${newGrace.toISOString()}`);

    // Solo actualizar si la graceUntil cambió
    if (!oldGrace || Math.abs(oldGrace.getTime() - newGrace.getTime()) > 60000) {
      sub.graceUntil = newGrace;
      await sub.save();
      console.log(`    ✅ ACTUALIZADO`);
    } else {
      console.log(`    ⏭️  Sin cambios`);
    }
  }

  console.log('\nListo. Cerrando conexión...');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
