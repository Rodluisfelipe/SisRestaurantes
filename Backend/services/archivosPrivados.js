/**
 * Archivos que NO son públicos: documentos de identidad y selfies de los
 * domiciliarios.
 *
 * El resto de imágenes de MenuBy (productos, logos) se suben con lectura
 * pública porque cualquiera las tiene que ver. Un documento de identidad no:
 * se guarda privado y solo se ve con un enlace firmado que vence en minutos,
 * que se genera cuando el superadmin abre el registro.
 */
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const sharp = require('sharp');
const crypto = require('crypto');

const REGION = process.env.DO_SPACES_REGION || 'nyc3';
const BUCKET = process.env.DO_SPACES_BUCKET || 'menuby';

let cliente = null;
function s3() {
  cliente ??= new S3Client({
    endpoint: `https://${REGION}.digitaloceanspaces.com`,
    region: REGION,
    credentials: { accessKeyId: process.env.DO_SPACES_KEY, secretAccessKey: process.env.DO_SPACES_SECRET },
    forcePathStyle: false,
  });
  return cliente;
}

function spacesListo() {
  return !!(process.env.DO_SPACES_KEY && process.env.DO_SPACES_SECRET && process.env.DO_SPACES_KEY !== 'x');
}

/* En desarrollo, sin Spaces, los archivos van a una carpeta temporal del
   equipo y se "firman" como data URL. En producción esto nunca se usa: sin
   Spaces, la subida falla. */
const local = () => !spacesListo() && process.env.NODE_ENV !== 'production';
const carpetaLocal = () => require('path').join(require('os').tmpdir(), 'menuby-privado');

function configurado() {
  return spacesListo() || local();
}

/**
 * Sube una foto privada (se normaliza a WebP y se le quitan los metadatos,
 * incluida la ubicación GPS que traen las fotos de celular).
 * @returns {Promise<string>} la llave del archivo (no una URL)
 */
async function subirPrivado(buffer, carpeta) {
  const limpio = await sharp(buffer).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const llave = `privado/${carpeta}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.webp`;
  if (local()) {
    const fs = require('fs');
    const ruta = require('path').join(carpetaLocal(), llave.replace(/\//g, '_'));
    fs.mkdirSync(carpetaLocal(), { recursive: true });
    fs.writeFileSync(ruta, limpio);
    return llave;
  }
  await s3().send(new PutObjectCommand({
    Bucket: BUCKET, Key: llave, Body: limpio, ContentType: 'image/webp', ACL: 'private',
  }));
  return llave;
}

/** Enlace de lectura que vence (5 min por defecto). */
async function enlaceFirmado(llave, segundos = 300) {
  if (!llave) return null;
  if (local()) {
    try {
      const b = require('fs').readFileSync(require('path').join(carpetaLocal(), llave.replace(/\//g, '_')));
      return `data:image/webp;base64,${b.toString('base64')}`;
    } catch { return null; }
  }
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: BUCKET, Key: llave }), { expiresIn: segundos });
}

async function borrarPrivado(llave) {
  if (!llave) return;
  try { await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: llave })); } catch { /* ya no estaba */ }
}

module.exports = { subirPrivado, enlaceFirmado, borrarPrivado, configurado };
