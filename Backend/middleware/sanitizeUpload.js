const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Middleware that sanitizes uploaded images by re-encoding them through sharp.
 * Strips EXIF metadata, removes embedded payloads, and normalizes the format.
 * 
 * Must be used AFTER multer middleware (requires req.file to be set).
 * Works with multer diskStorage — reads the saved file, re-encodes, and overwrites.
 */
function sanitizeUpload(opts = {}) {
  const { maxWidth = 1200, quality = 85 } = opts;

  return async (req, res, next) => {
    if (!req.file) return next();

    const ext = path.extname(req.file.originalname).toLowerCase();
    // Skip non-image files (e.g., PDF payment proofs)
    const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];
    if (!imageExts.includes(ext) && !req.file.mimetype.startsWith('image/')) {
      return next();
    }

    try {
      const filePath = req.file.path;
      const sanitized = await sharp(filePath)
        .resize(maxWidth, maxWidth, { fit: 'inside', withoutEnlargement: true })
        .rotate() // auto-rotate based on EXIF, then strip it
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();

      // Overwrite with sanitized version
      const sanitizedPath = filePath.replace(ext, '.jpg');
      fs.writeFileSync(sanitizedPath, sanitized);

      // If the extension changed, remove the original
      if (sanitizedPath !== filePath) {
        fs.unlinkSync(filePath);
      }

      // Update req.file to reflect the sanitized file
      req.file.path = sanitizedPath;
      req.file.filename = path.basename(sanitizedPath);
      req.file.size = sanitized.length;
      req.file.mimetype = 'image/jpeg';

      next();
    } catch (err) {
      logger.error('Image sanitization failed', err);
      // Don't block the upload — the original file passed multer's type check
      next();
    }
  };
}

module.exports = sanitizeUpload;
