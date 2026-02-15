/**
 * Ruta de subida de imágenes
 * 
 * POST /api/upload/image - Sube una imagen a DigitalOcean Spaces
 * DELETE /api/upload/image - Elimina una imagen de Spaces
 * 
 * Soporta imágenes de productos, banners, y otros recursos.
 * Requiere autenticación (tenantAuth o authMiddleware).
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadImage, deleteImage, isSpacesConfigured } = require('../services/imageUploadService');
const { tenantAuth } = require('../middleware/tenantAuth');

// Configurar multer para almacenamiento en memoria (no disco)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (JPEG, PNG, WebP)'), false);
    }
  },
});

/**
 * POST /api/upload/image
 * Sube una imagen y retorna la URL pública
 * 
 * Body (multipart/form-data):
 * - image: archivo de imagen
 * - folder: carpeta destino ('products', 'banners', 'proofs', 'announcements')
 * - maxWidth: ancho máximo opcional (default: 800)
 * - quality: calidad WebP 1-100 (default: 80)
 */
router.post('/image', tenantAuth, upload.single('image'), async (req, res) => {
  try {
    if (!isSpacesConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Servicio de almacenamiento no configurado',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se envió ninguna imagen',
      });
    }

    const folder = req.body.folder || 'products';
    const maxWidth = parseInt(req.body.maxWidth) || 800;
    const quality = parseInt(req.body.quality) || 80;

    // Validar folder permitido
    const allowedFolders = ['products', 'banners', 'proofs', 'order-proofs', 'announcements', 'logos'];
    if (!allowedFolders.includes(folder)) {
      return res.status(400).json({
        success: false,
        message: `Carpeta no permitida. Usa: ${allowedFolders.join(', ')}`,
      });
    }

    const result = await uploadImage(req.file.buffer, folder, { maxWidth, quality });

    res.json({
      success: true,
      url: result.url,
      key: result.key,
      size: result.size,
    });
  } catch (error) {
    console.error('Error subiendo imagen:', error);
    
    if (error.message?.includes('Solo se permiten')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error al subir la imagen',
    });
  }
});

/**
 * DELETE /api/upload/image
 * Elimina una imagen de Spaces
 * 
 * Body: { url: "https://menuby.nyc3.digitaloceanspaces.com/products/xxx.webp" }
 */
router.delete('/image', tenantAuth, async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL de imagen requerida',
      });
    }

    const deleted = await deleteImage(url);
    
    res.json({
      success: deleted,
      message: deleted ? 'Imagen eliminada' : 'No se pudo eliminar la imagen',
    });
  } catch (error) {
    console.error('Error eliminando imagen:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar la imagen',
    });
  }
});

module.exports = router;
