/**
 * Migra URLs de imágenes en MongoDB del bucket viejo al nuevo.
 *
 *   menuby.nyc3.digitaloceanspaces.com  →  menuby-cdn.nyc3.cdn.digitaloceanspaces.com
 *
 * Escanea TODAS las colecciones y busca el patrón en TODOS los campos
 * (incluidos arrays anidados y subdocumentos). No depende del esquema.
 *
 * Uso:
 *   node scripts/migrateImageUrls.js            # DRY RUN — solo reporta
 *   node scripts/migrateImageUrls.js --apply    # Aplica los cambios
 */

require('dotenv').config();
const mongoose = require('mongoose');

const OLD = 'menuby.nyc3.digitaloceanspaces.com';
const NEW = 'menuby-cdn.nyc3.cdn.digitaloceanspaces.com';
const APPLY = process.argv.includes('--apply');

function findStringFieldsWithSubstring(value, substring, path = '') {
  const results = [];
  if (typeof value === 'string') {
    if (value.includes(substring)) results.push(path);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => {
      results.push(...findStringFieldsWithSubstring(v, substring, `${path}.${i}`));
    });
  } else if (value && typeof value === 'object' && !(value instanceof Date) && !(value._bsontype)) {
    for (const [k, v] of Object.entries(value)) {
      const nextPath = path ? `${path}.${k}` : k;
      results.push(...findStringFieldsWithSubstring(v, substring, nextPath));
    }
  }
  return results;
}

function getByPath(obj, path) {
  return path.split('.').reduce((acc, k) => {
    if (acc == null) return undefined;
    return Array.isArray(acc) ? acc[Number(k)] : acc[k];
  }, obj);
}

(async () => {
  if (!process.env.MONGODB_URI) {
    console.error('❌ Falta MONGODB_URI en el entorno.');
    process.exit(1);
  }

  console.log(`Modo: ${APPLY ? '🚀 APPLY (escribe cambios)' : '🔍 DRY RUN (solo reporta)'}`);
  console.log(`Reemplazo: "${OLD}" → "${NEW}"\n`);

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  const summary = [];
  let totalDocs = 0;
  let totalFields = 0;

  for (const { name } of collections) {
    if (name.startsWith('system.')) continue;
    const col = db.collection(name);

    const matches = [];
    const cursor = col.find({});
    for await (const doc of cursor) {
      const fields = findStringFieldsWithSubstring(doc, OLD);
      if (fields.length > 0) matches.push({ doc, fields });
    }

    if (matches.length === 0) continue;

    const fieldCounts = {};
    for (const { fields } of matches) {
      for (const f of fields) {
        const normalized = f.replace(/\.\d+\./g, '.[].').replace(/\.\d+$/, '.[]');
        fieldCounts[normalized] = (fieldCounts[normalized] || 0) + 1;
      }
    }

    console.log(`📂 ${name}: ${matches.length} docs afectados`);
    for (const [field, count] of Object.entries(fieldCounts)) {
      console.log(`     • ${field}  ×${count}`);
    }

    const totalFieldsThisCol = matches.reduce((s, m) => s + m.fields.length, 0);
    summary.push({ collection: name, docs: matches.length, fields: totalFieldsThisCol });
    totalDocs += matches.length;
    totalFields += totalFieldsThisCol;

    if (APPLY) {
      const ops = matches.map(({ doc, fields }) => {
        const set = {};
        for (const path of fields) {
          const oldVal = getByPath(doc, path);
          if (typeof oldVal === 'string') {
            set[path] = oldVal.split(OLD).join(NEW);
          }
        }
        return { updateOne: { filter: { _id: doc._id }, update: { $set: set } } };
      });
      const result = await col.bulkWrite(ops, { ordered: false });
      console.log(`     ✅ ${result.modifiedCount} docs actualizados\n`);
    } else {
      console.log('');
    }
  }

  console.log('═══════════════════════════════════════════');
  console.log(`Total: ${totalDocs} docs · ${totalFields} campos a cambiar en ${summary.length} colecciones`);
  console.log(APPLY ? '✅ Aplicado.' : '🔍 DRY RUN — corre con --apply para aplicar los cambios.');
  console.log('═══════════════════════════════════════════');

  await mongoose.disconnect();
})().catch((e) => {
  console.error('❌ Error:', e);
  mongoose.disconnect().catch(() => {});
  process.exit(1);
});
