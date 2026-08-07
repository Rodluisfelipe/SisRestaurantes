#!/usr/bin/env node
/**
 * Respaldo diario de la base de datos a DigitalOcean Spaces.
 *
 * No había ninguno: ni en el repositorio, ni en el servidor, ni un cron. Ahí
 * viven los pedidos, los clientes y el historial de ventas de todos los
 * negocios. Un borrado mal hecho o un problema con la cuenta de Atlas y no
 * habría de dónde recuperar.
 *
 * Vuelca cada colección en JSON extendido (preserva ObjectId, fechas y
 * decimales), lo comprime y lo sube. No usa mongodump a propósito: exigiría
 * instalar las herramientas de Mongo en la imagen, y con este volumen —unos
 * pocos MB— el volcado por driver es igual de fiable y no añade dependencias.
 *
 * Uso:
 *   docker exec <contenedor> node scripts/backup-db.js
 *
 * Para restaurar: scripts/restore-db.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const zlib = require('zlib');
const { EJSON } = require('bson');
const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');

const REGION = process.env.DO_SPACES_REGION || 'nyc3';
const BUCKET = process.env.DO_SPACES_BUCKET || 'menuby';
const PREFIJO = 'backups/db/';
const RETENCION_DIAS = 30;
// Se sube en un solo objeto; con este volumen no hace falta multiparte.
const LIMITE_AVISO_MB = 100;

const s3 = new S3Client({
  endpoint: `https://${REGION}.digitaloceanspaces.com`,
  region: REGION,
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET,
  },
});

const log = (...a) => console.log(`[${new Date().toISOString()}]`, ...a);

async function volcar() {
  const db = mongoose.connection.db;
  const colecciones = (await db.listCollections().toArray())
    .filter((c) => c.type !== 'view')
    .map((c) => c.name)
    .sort();

  const partes = [];
  const resumen = {};

  for (const nombre of colecciones) {
    const docs = await db.collection(nombre).find({}).toArray();
    resumen[nombre] = docs.length;
    // Una línea por documento: si el archivo se corrompe a la mitad, lo
    // anterior sigue siendo recuperable.
    for (const doc of docs) {
      partes.push(JSON.stringify({ __col: nombre, doc: EJSON.serialize(doc) }));
    }
  }

  return { contenido: partes.join('\n'), resumen, colecciones: colecciones.length };
}

async function podarViejos() {
  const corte = Date.now() - RETENCION_DIAS * 864e5;
  const lista = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: PREFIJO }));
  const viejos = (lista.Contents || []).filter((o) => new Date(o.LastModified).getTime() < corte);
  if (viejos.length === 0) return 0;

  await s3.send(new DeleteObjectsCommand({
    Bucket: BUCKET,
    Delete: { Objects: viejos.map((o) => ({ Key: o.Key })) },
  }));
  return viejos.length;
}

async function registrar(estado, detalle) {
  /* Queda en la misma tabla que los demás crons para que aparezca en el
     Estado del sistema del superadmin. Un respaldo que falla en silencio es
     lo mismo que no tener respaldo. */
  try {
    const CronRun = require('../Models/CronRun');
    await CronRun.findOneAndUpdate(
      { task: 'dbBackup' },
      {
        task: 'dbBackup',
        lastRunAt: new Date(),
        lastStatus: estado,
        lastError: estado === 'error' ? String(detalle).slice(0, 300) : null,
        lastResult: estado === 'ok' ? String(detalle).slice(0, 200) : null,
        $inc: { runs: 1, ...(estado === 'error' ? { failures: 1 } : {}) },
      },
      { upsert: true }
    );
  } catch (e) {
    log('No se pudo registrar el resultado:', e.message);
  }
}

/**
 * Ejecuta el respaldo. Devuelve un resumen corto para el registro del cron.
 * Asume que ya hay conexión a Mongo (la tiene el servidor cuando corre como
 * tarea programada; el modo suelto de abajo la abre por su cuenta).
 */
async function runBackup() {
  const inicio = Date.now();

  if (!process.env.DO_SPACES_KEY || !process.env.DO_SPACES_SECRET) {
    throw new Error('Faltan las credenciales de Spaces (DO_SPACES_KEY / DO_SPACES_SECRET)');
  }

  const { contenido, resumen, colecciones } = await volcar();
  const docs = Object.values(resumen).reduce((s, n) => s + n, 0);

  const comprimido = zlib.gzipSync(Buffer.from(contenido, 'utf8'), { level: 9 });
  const tam = comprimido.length / 1048576;

  if (tam > LIMITE_AVISO_MB) {
    log(`AVISO: el respaldo supera ${LIMITE_AVISO_MB} MB. Conviene pasar a subida multiparte.`);
  }

  const fecha = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const clave = `${PREFIJO}menuby-${fecha}.json.gz`;

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: clave,
    Body: comprimido,
    ContentType: 'application/gzip',
    // Privado: son datos personales de clientes de los negocios
    ACL: 'private',
    Metadata: { documentos: String(docs), colecciones: String(colecciones) },
  }));

  const podados = await podarViejos();
  const detalle = `${docs} docs, ${tam.toFixed(2)} MB, ${colecciones} colecciones`
    + (podados ? `, ${podados} viejos eliminados` : '');

  log(`Respaldo listo en ${((Date.now() - inicio) / 1000).toFixed(1)}s — ${detalle}`);
  return detalle;
}

module.exports = { runBackup };

// Modo suelto: node scripts/backup-db.js
if (require.main === module) {
  (async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    try {
      const detalle = await runBackup();
      await registrar('ok', detalle);
      await mongoose.disconnect();
      process.exit(0);
    } catch (err) {
      log('ERROR:', err.message);
      await registrar('error', err.message);
      await mongoose.disconnect().catch(() => {});
      process.exit(1);
    }
  })();
}
