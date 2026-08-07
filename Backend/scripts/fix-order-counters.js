#!/usr/bin/env node
/**
 * Sube los contadores de número de pedido que quedaron por debajo del máximo
 * real, para que dejen de repartir números ya usados.
 *
 * IMPORTANTE: este script NO modifica ningún pedido. Solo lee los números
 * existentes para calcular el máximo y ajusta el contador. Los números de los
 * pedidos que ya están se quedan tal cual.
 *
 * El origen del problema: orderNumber se guarda como texto y el contador se
 * inicializaba con .sort({ orderNumber: -1 }), que ordena alfabéticamente.
 * "9" queda por encima de "4187", así que el contador arrancaba en 9 y volvía
 * a repartir números existentes.
 *
 * Por defecto solo informa. Para aplicar: --confirm
 *
 * Uso:
 *   docker exec <contenedor> node scripts/fix-order-counters.js
 *   docker exec <contenedor> node scripts/fix-order-counters.js --confirm
 */

require('dotenv').config();
const mongoose = require('mongoose');

const APLICAR = process.argv.includes('--confirm');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const negocios = await db.collection('businessconfigs').find({}).project({ businessName: 1 }).toArray();

  // Máximo numérico real por negocio, en las tres colecciones
  const maxDe = async (col, bid) => {
    const r = await db.collection(col).aggregate([
      { $match: { businessId: bid } },
      { $project: { n: { $convert: { input: '$orderNumber', to: 'int', onError: 0, onNull: 0 } } } },
      // Se descartan los números por timestamp que generaba el respaldo ante
      // un fallo: dispararían el contador a mil millones.
      { $match: { n: { $lt: 1000000 } } },
      { $group: { _id: null, max: { $max: '$n' } } },
    ]).toArray();
    return r[0]?.max || 0;
  };

  let ajustados = 0;
  let revisados = 0;

  console.log(APLICAR ? '=== APLICANDO ===\n' : '=== SIMULACIÓN (usa --confirm para aplicar) ===\n');
  console.log('  negocio                        contador   máximo real   acción');
  console.log('  ' + '─'.repeat(66));

  for (const b of negocios) {
    const bid = b._id;
    const id = `orderNumber:${bid.toString()}`;
    const [maxA, maxC, maxB] = await Promise.all([
      maxDe('orders', bid), maxDe('completedorders', bid), maxDe('bookings', bid),
    ]);
    const real = Math.max(maxA, maxC, maxB);
    if (real === 0) continue;
    revisados++;

    const contador = await db.collection('counters').findOne({ _id: id });
    const seq = contador?.seq || 0;

    const nombre = (b.businessName || '(sin nombre)').slice(0, 28);
    if (seq >= real) {
      console.log(`  ${nombre.padEnd(30)} ${String(seq).padStart(8)}   ${String(real).padStart(11)}   ok`);
      continue;
    }

    ajustados++;
    console.log(`  ${nombre.padEnd(30)} ${String(seq).padStart(8)}   ${String(real).padStart(11)}   ${APLICAR ? 'SUBIDO a ' + real : 'subiría a ' + real}`);

    if (APLICAR) {
      // $max: nunca baja el contador, y si otro proceso lo subió mientras
      // tanto, se respeta el mayor.
      await db.collection('counters').updateOne(
        { _id: id },
        { $max: { seq: real } },
        { upsert: true }
      );
    }
  }

  console.log('');
  console.log(`  negocios con pedidos : ${revisados}`);
  console.log(`  contadores por debajo: ${ajustados}`);
  if (!APLICAR && ajustados > 0) console.log('\n  Nada se escribió. Vuelve a correr con --confirm para aplicar.');
  if (APLICAR) console.log('\n  Listo. Ningún número de pedido existente fue modificado.');

  await mongoose.disconnect();
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
