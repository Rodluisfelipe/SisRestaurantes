/**
 * Hace público el Space de DigitalOcean para que las imágenes carguen en
 * cualquier dispositivo (no solo en navegadores que las tengan en caché).
 *
 * Causa del problema: los objetos quedaron PRIVADOS (AccessDenied), porque el
 * Space no está honrando el ACL "public-read" de cada subida.
 *
 * Estrategia:
 *  1. Aplica una BUCKET POLICY pública (cubre archivos existentes y futuros).
 *  2. Si el Space no soporta policy, hace fallback a PutObjectAcl public-read
 *     sobre cada objeto existente.
 *
 * Uso (en el servidor, donde existe el .env de producción):
 *   node scripts/makeSpacesPublic.js
 */

require('dotenv').config();
const {
  S3Client,
  PutBucketPolicyCommand,
  ListObjectsV2Command,
  PutObjectAclCommand,
} = require('@aws-sdk/client-s3');

const REGION = process.env.DO_SPACES_REGION || 'nyc3';
const BUCKET = process.env.DO_SPACES_BUCKET || 'menuby';

if (!process.env.DO_SPACES_KEY || !process.env.DO_SPACES_SECRET) {
  console.error('❌ Faltan DO_SPACES_KEY / DO_SPACES_SECRET en el entorno.');
  process.exit(1);
}

const s3 = new S3Client({
  endpoint: `https://${REGION}.digitaloceanspaces.com`,
  region: REGION,
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET,
  },
  forcePathStyle: false,
});

async function applyBucketPolicy() {
  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'PublicReadGetObject',
        Effect: 'Allow',
        Principal: '*',
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${BUCKET}/*`],
      },
    ],
  };

  await s3.send(new PutBucketPolicyCommand({
    Bucket: BUCKET,
    Policy: JSON.stringify(policy),
  }));
}

async function fixObjectAcls() {
  let token;
  let total = 0;
  let failed = 0;
  do {
    const list = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      ContinuationToken: token,
    }));
    for (const obj of (list.Contents || [])) {
      try {
        await s3.send(new PutObjectAclCommand({
          Bucket: BUCKET,
          Key: obj.Key,
          ACL: 'public-read',
        }));
        total++;
        if (total % 50 === 0) console.log(`   ...${total} objetos procesados`);
      } catch (e) {
        failed++;
        console.error(`   ✗ ${obj.Key}: ${e.message}`);
      }
    }
    token = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (token);
  console.log(`✅ ACL public-read aplicado a ${total} objetos (${failed} fallidos).`);
}

(async () => {
  console.log(`🔧 Haciendo público el Space "${BUCKET}" (${REGION})...`);

  try {
    await applyBucketPolicy();
    console.log('✅ Bucket policy pública aplicada. Todas las imágenes (existentes y futuras) son públicas.');
    return;
  } catch (e) {
    console.warn(`⚠️  No se pudo aplicar la bucket policy (${e.name}: ${e.message}).`);
    console.warn('   Probando fallback: ACL public-read por objeto...');
  }

  try {
    await fixObjectAcls();
    console.log('ℹ️  Nota: si el problema vuelve con imágenes nuevas, el Space no honra ACLs y debes hacerlo público desde el panel de DigitalOcean.');
  } catch (e) {
    console.error(`❌ Fallback también falló: ${e.message}`);
    process.exit(1);
  }
})().catch((e) => {
  console.error('❌ Error inesperado:', e);
  process.exit(1);
});
