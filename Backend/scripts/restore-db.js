#!/usr/bin/env node
/**
 * Restaura un respaldo creado por backup-db.js.
 *
 * Existe porque un respaldo que nadie sabe restaurar no es un respaldo. Se
 * escribe junto al de volcado y no el día de la emergencia.
 *
 * Por defecto NO escribe nada: lista lo que haría. Para escribir de verdad hay
 * que pasar --confirm, y para pisar colecciones que ya tienen datos, --wipe.
 *
 * Uso:
 *   node scripts/restore-db.js --list                    ver respaldos disponibles
 *   node scripts/restore-db.js                           simular con el más reciente
 *   node scripts/restore-db.js --key=backups/db/x.json.gz --confirm
 *   node scripts/restore-db.js --confirm --wipe          reemplazar lo que haya
 *
 * Restaurar sobre la base de producción es destructivo. Lo sensato ante un
 * incidente es levantar una base aparte, apuntar MONGODB_URI ahí, restaurar y
 * comparar antes de tocar nada en vivo.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const zlib = require('zlib');
const { EJSON } = require('bson');
const { S3Client, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const REGION = process.env.DO_SPACES_REGION || 'nyc3';
const BUCKET = process.env.DO_SPACES_BUCKET || 'menuby';
const PREFIJO = 'backups/db/';

const args = process.argv.slice(2);
const tiene = (f) => args.includes(f);
const valor = (f) => (args.find((a) => a.startsWith(`${f}=`)) || '').split('=')[1] || null;

const CONFIRMAR = tiene('--confirm');
const LIMPIAR = tiene('--wipe');
const LISTAR = tiene('--list');
const CLAVE = valor('--key');

const s3 = new S3Client({
  endpoint: `https://${REGION}.digitaloceanspaces.com`,
  region: REGION,
  credentials: { accessKeyId: process.env.DO_SPACES_KEY, secretAccessKey: process.env.DO_SPACES_SECRET },
});

const log = (...a) => console.log(...a);
const mb = (n) => (n / 1048576).toFixed(2) + ' MB';

async function listar() {
  const r = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: PREFIJO }));
  return (r.Contents || []).sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));
}

async function descargar(clave) {
  const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: clave }));
  const trozos = [];
  for await (const t of r.Body) trozos.push(t);
  return zlib.gunzipSync(Buffer.concat(trozos)).toString('utf8');
}

(async () => {
  const respaldos = await listar();

  if (LISTAR || respaldos.length === 0) {
    log(`\nRespaldos en ${BUCKET}/${PREFIJO}:\n`);
    if (respaldos.length === 0) { log('  (ninguno)\n'); process.exit(1); }
    respaldos.forEach((o, i) => log(`  ${i === 0 ? '→' : ' '} ${o.Key}   ${mb(o.Size)}   ${new Date(o.LastModified).toLocaleString('es-CO')}`));
    log('');
    process.exit(0);
  }

  const clave = CLAVE || respaldos[0].Key;
  log(`\nRespaldo: ${clave}`);
  log(`Destino : ${String(process.env.MONGODB_URI).replace(/\/\/[^@]+@/, '//***@')}\n`);

  const contenido = await descargar(clave);
  const lineas = contenido.split('\n').filter(Boolean);

  // Agrupar por colección
  const porColeccion = new Map();
  for (const linea of lineas) {
    const { __col, doc } = JSON.parse(linea);
    if (!porColeccion.has(__col)) porColeccion.set(__col, []);
    porColeccion.get(__col).push(EJSON.deserialize(doc));
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  log('Colección                     en el respaldo   en la base');
  log('─'.repeat(62));
  for (const [nombre, docs] of porColeccion) {
    const actuales = await db.collection(nombre).countDocuments();
    log(`  ${nombre.padEnd(28)} ${String(docs.length).padStart(8)}   ${String(actuales).padStart(10)}`);
  }
  log('');

  if (!CONFIRMAR) {
    log('SIMULACIÓN: no se escribió nada. Añade --confirm para restaurar de verdad.\n');
    await mongoose.disconnect();
    process.exit(0);
  }

  let insertados = 0;
  let omitidos = 0;

  for (const [nombre, docs] of porColeccion) {
    const col = db.collection(nombre);
    const actuales = await col.countDocuments();

    if (actuales > 0 && !LIMPIAR) {
      log(`  ${nombre}: tiene ${actuales} documentos, se omite (usa --wipe para reemplazar)`);
      omitidos += docs.length;
      continue;
    }
    if (actuales > 0 && LIMPIAR) {
      await col.deleteMany({});
      log(`  ${nombre}: vaciada (${actuales} documentos eliminados)`);
    }

    // Por lotes: un insertMany de 5.000 documentos puede pasarse del límite
    // de tamaño de la operación.
    for (let i = 0; i < docs.length; i += 500) {
      await col.insertMany(docs.slice(i, i + 500), { ordered: false });
    }
    insertados += docs.length;
    log(`  ${nombre}: ${docs.length} documentos restaurados`);
  }

  log(`\nListo. Insertados: ${insertados}${omitidos ? ` · Omitidos: ${omitidos}` : ''}\n`);
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
