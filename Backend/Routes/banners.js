const express = require('express');
const router = express.Router();
const Banner = require('../Models/Banner');
const BusinessConfig = require('../Models/BusinessConfig');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const { formatHttpError } = require('../utils/errorFormatter');

// Validación de entrada para crear banner (después de multer)
const validateBannerInput = (req, res, next) => {
  const errors = [];
  const { title, description, endDate, priority, businessId } = req.body;
  
  // Validar title
  if (!title) {
    errors.push({ field: 'title', message: 'title es requerido' });
  } else if (typeof title !== 'string' || title.trim().length === 0) {
    errors.push({ field: 'title', message: 'title debe ser un string no vacío' });
  } else if (title.length > 100) {
    errors.push({ field: 'title', message: 'title no puede exceder 100 caracteres' });
  }
  
  // Validar description (opcional)
  if (description !== undefined && (typeof description !== 'string' || description.length > 200)) {
    errors.push({ field: 'description', message: 'description debe ser un string y no exceder 200 caracteres' });
  }
  
  // Validar endDate
  if (!endDate) {
    errors.push({ field: 'endDate', message: 'endDate es requerido' });
  } else {
    const endDateObj = new Date(endDate);
    if (isNaN(endDateObj.getTime())) {
      errors.push({ field: 'endDate', message: 'endDate debe ser una fecha válida' });
    } else {
      const now = new Date();
      if (endDateObj <= now) {
        errors.push({ field: 'endDate', message: 'endDate debe ser posterior a hoy' });
      }
    }
  }
  
  // Validar priority (opcional)
  if (priority !== undefined) {
    const priorityNum = parseInt(priority);
    if (isNaN(priorityNum) || priorityNum < 1 || priorityNum > 10) {
      errors.push({ field: 'priority', message: 'priority debe ser un número entre 1 y 10' });
    }
  }
  
  // Validar businessId (solo si no viene del token)
  if (businessId !== undefined && typeof businessId !== 'string') {
    errors.push({ field: 'businessId', message: 'businessId debe ser un string' });
  }
  
  if (errors.length > 0) {
    return res.status(400).json(
      formatHttpError(req, 'Errores de validación en la entrada', 400, errors)
    );
  }
  
  next();
};

// Configuración de multer para subir imágenes
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads/banners');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'banner-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB máximo
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen (JPEG, JPG, PNG, WEBP)'));
    }
  }
});

// GET /api/banners/test - Endpoint de prueba sin autenticación
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Banners API funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// POST /api/banners/test-upload - Endpoint temporal para probar subida sin autenticación
router.post('/test-upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'La imagen es requerida'
      });
    }

    res.json({
      success: true,
      message: 'Imagen recibida correctamente',
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al procesar imagen'
    });
  }
});

// POST /api/banners/superadmin-create - Endpoint temporal para SuperAdmin crear banners
router.post('/superadmin-create', upload.single('image'), async (req, res) => {
  try {
    const { title, description, endDate, priority, businessId } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'La imagen es requerida'
      });
    }

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'BusinessId es requerido'
      });
    }

    // Obtener información del negocio
    const business = await BusinessConfig.findById(businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Negocio no encontrado'
      });
    }

    // Crear el banner
    const banner = new Banner({
      businessId,
      businessName: business.businessName,
      businessSlug: business.slug,
      title,
      description,
      image: `/uploads/banners/${req.file.filename}`,
      endDate: new Date(endDate),
      priority: parseInt(priority) || 1,
      status: 'pending'
    });

    await banner.save();

    res.json({
      success: true,
      message: 'Banner creado exitosamente y enviado para revisión',
      banner: {
        id: banner._id,
        title: banner.title,
        status: banner.status
      }
    });
  } catch (error) {
    logger.error('Error creating banner', error, req);
    res.status(500).json(formatHttpError(req, 'Error al crear banner', 500));
  }
});

// GET /api/banners - Obtener banners activos para el catálogo
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const banners = await Banner.find({
      status: 'approved',
      startDate: { $lte: now },
      endDate: { $gte: now }
    })
    .populate('businessId', 'businessName slug logo')
    .sort({ priority: -1, createdAt: -1 })
    .limit(5); // Máximo 5 banners activos

    logger.info(`Found ${banners.length} active banners`, { count: banners.length }, req);
    res.json({
      success: true,
      banners: banners.map(banner => ({
        _id: banner._id,
        title: banner.title,
        description: banner.description,
        image: banner.image,
        businessName: banner.businessName,
        businessSlug: banner.businessSlug,
        priority: banner.priority,
        endDate: banner.endDate
      }))
    });
  } catch (error) {
    logger.error('Error fetching banners', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener banners', 500));
  }
});

// GET /api/banners/my - Obtener banners del restaurante autenticado
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const banners = await Banner.find({ businessId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      banners
    });
  } catch (error) {
    logger.error('Error fetching user banners', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener tus banners', 500));
  }
});

// GET /api/banners/business/:businessId - Obtener banners de un negocio específico (con autenticación)
router.get('/business/:businessId', authMiddleware, async (req, res) => {
  try {
    const { businessId } = req.params;
    const banners = await Banner.find({ businessId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      banners
    });
  } catch (error) {
    logger.error('Error fetching business banners', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener banners del negocio', 500));
  }
});

// GET /api/banners/business/:businessId/public - Obtener banners de un negocio específico (sin autenticación)
router.get('/business/:businessId/public', async (req, res) => {
  try {
    const { businessId } = req.params;
    
    const banners = await Banner.find({ businessId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      banners
    });
  } catch (error) {
    logger.error('Error fetching business banners (public)', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener banners del negocio', 500));
  }
});


// POST /api/banners - Crear nuevo banner (restaurante)
router.post('/', authMiddleware, upload.single('image'), validateBannerInput, async (req, res) => {
  try {
    // Usar businessId del FormData si está disponible, sino del token
    let businessId = req.body.businessId || req.user.businessId;
    const { title, description, endDate, priority } = req.body;

    if (!req.file) {
      return res.status(400).json(formatHttpError(req, 'La imagen es requerida', 400));
    }

    // Obtener información del negocio
    const business = await BusinessConfig.findById(businessId);
    if (!business) {
      return res.status(404).json(formatHttpError(req, 'Negocio no encontrado', 404));
    }

    // Crear banner
    const banner = new Banner({
      businessId,
      businessName: business.businessName,
      businessSlug: business.slug,
      title,
      description,
      image: `/uploads/banners/${req.file.filename}`,
      endDate: endDateObj,
      priority: priority || 1
    });

    await banner.save();

    logger.info('Banner created', { id: banner._id, businessId }, req);
    res.status(201).json({
      success: true,
      message: 'Banner creado exitosamente. Está pendiente de aprobación.',
      banner
    });
  } catch (error) {
    logger.error('Error creating banner', error, req);
    res.status(500).json(formatHttpError(req, 'Error al crear banner', 500));
  }
});

// GET /api/banners/pending - Obtener banners pendientes (SuperAdmin)
router.get('/pending', authMiddleware, async (req, res) => {
  try {
    const banners = await Banner.find({ status: 'pending' })
      .populate('businessId', 'businessName slug logo')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      banners
    });
  } catch (error) {
    logger.error('Error fetching pending banners', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener banners pendientes', 500));
  }
});

// GET /api/banners/pending/public - Obtener banners pendientes (sin autenticación para SuperAdmin temporal)
router.get('/pending/public', async (req, res) => {
  try {
    const banners = await Banner.find({ status: 'pending' })
      .populate('businessId', 'businessName slug logo')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      banners
    });
  } catch (error) {
    logger.error('Error fetching pending banners (public)', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener banners pendientes', 500));
  }
});

// GET /api/banners/approved/public - Obtener banners aprobados (sin autenticación)
router.get('/approved/public', async (req, res) => {
  try {
    const banners = await Banner.find({ status: 'approved' })
      .populate('businessId', 'businessName slug logo')
      .sort({ priority: -1, createdAt: -1 });

    res.json({
      success: true,
      banners
    });
  } catch (error) {
    logger.error('Error fetching approved banners (public)', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener banners aprobados', 500));
  }
});

// GET /api/banners/rejected/public - Obtener banners rechazados (sin autenticación)
router.get('/rejected/public', async (req, res) => {
  try {
    const banners = await Banner.find({ status: 'rejected' })
      .populate('businessId', 'businessName slug logo')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      banners
    });
  } catch (error) {
    logger.error('Error fetching rejected banners (public)', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener banners rechazados', 500));
  }
});

// GET /api/banners/all/public - Obtener todos los banners (sin autenticación)
router.get('/all/public', async (req, res) => {
  try {
    const banners = await Banner.find({})
      .populate('businessId', 'businessName slug logo')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      banners
    });
  } catch (error) {
    logger.error('Error fetching all banners (public)', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener todos los banners', 500));
  }
});

// PUT /api/banners/:id/approve - Aprobar banner (SuperAdmin)
router.put('/:id/approve', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner no encontrado'
      });
    }

    banner.status = 'approved';
    banner.approvedBy = req.user.id;
    banner.approvedAt = new Date();
    if (priority) banner.priority = priority;

    await banner.save();

    logger.info('Banner approved', { id, businessId: banner.businessId }, req);
    res.json({
      success: true,
      message: 'Banner aprobado exitosamente',
      banner
    });
  } catch (error) {
    logger.error('Error approving banner', error, req);
    res.status(500).json(formatHttpError(req, 'Error al aprobar banner', 500));
  }
});

// PUT /api/banners/:id/reject - Rechazar banner (SuperAdmin)
router.put('/:id/reject', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json(formatHttpError(req, 'Banner no encontrado', 404));
    }

    banner.status = 'rejected';
    banner.rejectionReason = rejectionReason;

    await banner.save();

    logger.info('Banner rejected', { id }, req);
    res.json({
      success: true,
      message: 'Banner rechazado',
      banner
    });
  } catch (error) {
    logger.error('Error rejecting banner', error, req);
    res.status(500).json(formatHttpError(req, 'Error al rechazar banner', 500));
  }
});

// PUT /api/banners/:id/click - Incrementar clicks (público)
router.put('/:id/click', async (req, res) => {
  try {
    const { id } = req.params;
    const banner = await Banner.findById(id);
    
    if (!banner) {
      return res.status(404).json(formatHttpError(req, 'Banner no encontrado', 404));
    }

    await banner.incrementClicks();

    res.json({
      success: true,
      message: 'Click registrado'
    });
  } catch (error) {
    logger.error('Error incrementing clicks', error, req);
    res.status(500).json(formatHttpError(req, 'Error al registrar click', 500));
  }
});

// DELETE /api/banners/:id - Eliminar banner
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.user.businessId;

    const banner = await Banner.findOne({ _id: id, businessId });
    if (!banner) {
      return res.status(404).json(formatHttpError(req, 'Banner no encontrado', 404));
    }

    // Eliminar archivo de imagen
    if (banner.image) {
      const imagePath = path.join(__dirname, '..', banner.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await Banner.findByIdAndDelete(id);

    logger.info('Banner deleted', { id }, req);
    res.json({
      success: true,
      message: 'Banner eliminado exitosamente'
    });
  } catch (error) {
    logger.error('Error deleting banner', error, req);
    res.status(500).json(formatHttpError(req, 'Error al eliminar banner', 500));
  }
});

// PUT /api/banners/:id/approve/public - Aprobar banner (público para SuperAdmin temporal)
router.put('/:id/approve/public', async (req, res) => {
  try {
    const { id } = req.params;
    const { priority = 1 } = req.body;

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner no encontrado'
      });
    }

    banner.status = 'approved';
    banner.priority = priority;
    banner.approvedAt = new Date();

    await banner.save();

    res.json({
      success: true,
      message: 'Banner aprobado exitosamente'
    });
  } catch (error) {
    logger.error('Error approving banner (public)', error, req);
    res.status(500).json(formatHttpError(req, 'Error al aprobar banner', 500));
  }
});

// PUT /api/banners/:id/reject/public - Rechazar banner (público para SuperAdmin temporal)
router.put('/:id/reject/public', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json(formatHttpError(req, 'Banner no encontrado', 404));
    }

    banner.status = 'rejected';
    banner.rejectionReason = reason;

    await banner.save();

    res.json({
      success: true,
      message: 'Banner rechazado exitosamente'
    });
  } catch (error) {
    logger.error('Error rejecting banner (public)', error, req);
    res.status(500).json(formatHttpError(req, 'Error al rechazar banner', 500));
  }
});

// PUT /api/banners/:id/toggle-status/public - Cambiar estado del banner (público para SuperAdmin temporal)
router.put('/:id/toggle-status/public', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json(formatHttpError(req, 'Banner no encontrado', 404));
    }

    banner.status = status;
    if (status === 'approved') {
      banner.approvedAt = new Date();
    }

    await banner.save();

    res.json({
      success: true,
      message: `Banner ${status === 'approved' ? 'activado' : 'desactivado'} exitosamente`
    });
  } catch (error) {
    logger.error('Error toggling banner status (public)', error, req);
    res.status(500).json(formatHttpError(req, 'Error al cambiar estado del banner', 500));
  }
});

// DELETE /api/banners/:id/delete/public - Eliminar banner permanentemente (público para SuperAdmin temporal)
router.delete('/:id/delete/public', async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json(formatHttpError(req, 'Banner no encontrado', 404));
    }

    // Eliminar archivo de imagen si existe
    if (banner.image) {
      const fs = require('fs');
      const path = require('path');
      const imagePath = path.join(__dirname, '..', banner.image);
      if (fs.existsSync(imagePath)) {
        try {
          fs.unlinkSync(imagePath);
        } catch (error) {
          logger.warn('Error eliminando archivo de imagen', error, req);
        }
      }
    }

    await Banner.findByIdAndDelete(id);

    logger.info('Banner deleted (public)', { id }, req);
    res.json({
      success: true,
      message: 'Banner eliminado exitosamente'
    });
  } catch (error) {
    logger.error('Error deleting banner (public)', error, req);
    res.status(500).json(formatHttpError(req, 'Error al eliminar banner', 500));
  }
});

// DELETE /api/banners/:id/delete/restaurant - Eliminar banner desde restaurante (público)
router.delete('/:id/delete/restaurant', async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json(formatHttpError(req, 'Banner no encontrado', 404));
    }

    // Eliminar archivo de imagen si existe
    if (banner.image) {
      const fs = require('fs');
      const path = require('path');
      const imagePath = path.join(__dirname, '..', banner.image);
      if (fs.existsSync(imagePath)) {
        try {
          fs.unlinkSync(imagePath);
        } catch (error) {
          logger.warn('Error eliminando archivo de imagen', error, req);
        }
      }
    }

    await Banner.findByIdAndDelete(id);

    logger.info('Banner deleted (restaurant)', { id }, req);
    res.json({
      success: true,
      message: 'Banner eliminado exitosamente'
    });
  } catch (error) {
    logger.error('Error deleting banner (restaurant)', error, req);
    res.status(500).json(formatHttpError(req, 'Error al eliminar banner', 500));
  }
});

module.exports = router;
