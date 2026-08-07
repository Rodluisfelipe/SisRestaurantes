/**
 * secretBox — cifrado simétrico para secretos de terceros que guardamos en Mongo.
 *
 * El caso que lo motiva: el token permanente de WhatsApp Cloud API. Quien lo
 * tenga puede escribir mensajes haciéndose pasar por el restaurante, así que no
 * puede quedar en claro en la base ni aparecer en un backup legible.
 *
 * AES-256-GCM: además de cifrar, autentica. Si alguien altera un byte del texto
 * cifrado, descifrar falla en vez de devolver basura silenciosa.
 *
 * La llave sale de SECRET_BOX_KEY (64 caracteres hex = 32 bytes). Se genera una
 * vez con:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Rotarla deja ilegible lo ya cifrado: los negocios tendrían que reconectar su
 * número. Por eso el formato lleva versión adelante, para poder soportar dos
 * llaves a la vez el día que haga falta.
 */
const crypto = require('crypto');

const VERSION = 'v1';
const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;   // tamaño recomendado para GCM
const TAG_BYTES = 16;

let cachedKey = null;

function getKey() {
  if (cachedKey) return cachedKey;
  const raw = process.env.SECRET_BOX_KEY;
  if (!raw) {
    throw new Error('Falta SECRET_BOX_KEY: no se pueden guardar secretos cifrados');
  }
  const key = Buffer.from(raw.trim(), 'hex');
  if (key.length !== 32) {
    throw new Error('SECRET_BOX_KEY debe ser de 32 bytes en hex (64 caracteres)');
  }
  cachedKey = key;
  return key;
}

/** ¿Está configurada la llave? Para avisar al arrancar en vez de fallar al usarla. */
function isConfigured() {
  const raw = process.env.SECRET_BOX_KEY;
  return !!raw && Buffer.from(raw.trim(), 'hex').length === 32;
}

/** Cifra un texto. Devuelve "v1:<iv>:<tag>:<datos>" en base64url. */
function seal(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === '') return '';
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), enc.toString('base64url')].join(':');
}

/** Descifra lo que produjo seal(). Lanza si el dato fue alterado. */
function open(sealed) {
  if (!sealed) return '';
  const parts = String(sealed).split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Secreto con formato desconocido');
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, 'base64url');
  const tag = Buffer.from(tagB64, 'base64url');
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error('Secreto con formato desconocido');
  }
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()]).toString('utf8');
}

/** Últimos 4 caracteres, para mostrar en el panel sin revelar el secreto. */
function hint(plaintext) {
  const s = String(plaintext || '');
  return s.length <= 4 ? '••••' : '••••' + s.slice(-4);
}

module.exports = { seal, open, hint, isConfigured, VERSION };
