/**
 * Servicio de subida de imágenes a DigitalOcean Spaces
 * 
 * Soporta compresión automática con sharp y subida a S3-compatible storage.
 * Las imágenes se comprimen a WebP para optimizar tamaño y velocidad.
 */

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const path = require('path');
const crypto = require('crypto');

// Configuración de DigitalOcean Spaces
const s3Client = new S3Client({
  endpoint: `https://${process.env.DO_SPACES_REGION || 'nyc3'}.digitaloceanspaces.com`,
  region: process.env.DO_SPACES_REGION || 'nyc3',
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET,
  },
  forcePathStyle: false,
});

const BUCKET = process.env.DO_SPACES_BUCKET || 'menuby';
const CDN_URL = process.env.DO_SPACES_CDN_URL || `https://${BUCKET}.${process.env.DO_SPACES_REGION || 'nyc3'}.digitaloceanspaces.com`;

/**
 * Comprime y sube una imagen a DigitalOcean Spaces
 * 
 * @param {Buffer} fileBuffer - Buffer del archivo de imagen
 * @param {string} folder - Carpeta destino (ej: 'products', 'banners', 'proofs')
 * @param {Object} options - Opciones de compresión
 * @param {number} options.maxWidth - Ancho máximo (default: 800)
 * @param {number} options.quality - Calidad WebP 1-100 (default: 80)
 * @returns {Promise<{url: string, key: string}>}
 */
async function uploadImage(fileBuffer, folder = 'products', options = {}) {
  const { maxWidth = 800, quality = 80 } = options;

  // Comprimir imagen con sharp → WebP
  const compressedBuffer = await sharp(fileBuffer)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();

  // Generar nombre único
  const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.webp`;
  const key = `${folder}/${uniqueName}`;

  // Subir a Spaces
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: compressedBuffer,
    ContentType: 'image/webp',
    ACL: 'public-read',
    CacheControl: 'public, max-age=31536000', // Cachear 1 año
  }));

  return {
    url: `${CDN_URL}/${key}`,
    key,
    size: compressedBuffer.length,
  };
}

/**
 * Elimina una imagen de DigitalOcean Spaces
 * 
 * @param {string} imageUrl - URL completa de la imagen o key
 * @returns {Promise<boolean>}
 */
async function deleteImage(imageUrl) {
  try {
    // Extraer el key de la URL
    let key = imageUrl;
    if (imageUrl.startsWith('http')) {
      const url = new URL(imageUrl);
      key = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
    }

    await s3Client.send(new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }));

    return true;
  } catch (error) {
    console.error('Error eliminando imagen de Spaces:', error.message);
    return false;
  }
}

/**
 * Verifica si la configuración de Spaces está completa
 */
function isSpacesConfigured() {
  return !!(process.env.DO_SPACES_KEY && process.env.DO_SPACES_SECRET);
}

module.exports = {
  uploadImage,
  deleteImage,
  isSpacesConfigured,
};
