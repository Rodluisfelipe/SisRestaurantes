const BusinessConfig = require('../Models/BusinessConfig');
const Admin = require('../Models/Admin');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { DEFAULTS, ERROR_MESSAGES, HTTP_STATUS } = require('../utils/constants');
const logger = require('../utils/logger');

// Generate a secure random password
function generateSecurePassword() {
  return crypto.randomBytes(12).toString('base64url').slice(0, 16);
}

// Crear nuevo negocio y admin
exports.crearNegocio = async (req, res) => {
  try {
    const { businessName, logo, whatsappNumber, adminUsername, slug } = req.body;
    if (!slug) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Slug is required' });
    }
    
    // 1. Crear negocio
    const business = await BusinessConfig.create({ businessName, logo, whatsappNumber, slug });
    logger.info(`Created new business: ${businessName} with slug: ${slug}`);
    
    // 2. Crear admin con contraseña segura generada aleatoriamente
    const defaultPassword = generateSecurePassword();
    const admin = new Admin({
      username: adminUsername,
      password: defaultPassword,
      role: 'admin',
      businessId: business._id
    });
    await admin.save();
    
    // Emitir evento de actualización de negocios a través de Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('businesses-updated');
    }
    
    res.status(HTTP_STATUS.CREATED).json({
      business,
      admin: { username: admin.username, password: defaultPassword }
    });
  } catch (error) {
    logger.error('Error creating business', error);
    
    // Manejo de errores de duplicado
    if (error.code === 11000) {
      if (error.keyPattern && error.keyPattern.slug) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
          message: 'Slug already in use. Please use a different one.' 
        });
      }
      if (error.keyPattern && error.keyPattern.username) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
          message: 'Admin username already exists. Please use a different username.' 
        });
      }
    }
    
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
      message: 'Error creating business'
    });
  }
};

// Listar todos los negocios
exports.listarNegocios = async (req, res) => {
  try {
    const negocios = await BusinessConfig.find({}).lean();
    res.json({ businesses: negocios });
  } catch (error) {
    res.status(500).json({ message: 'Error al listar negocios' });
  }
};

// Obtener credenciales (solo username) del admin de un negocio
exports.getBusinessCredentials = async (req, res) => {
  try {
    const admin = await Admin.findOne({ businessId: req.params.id, role: 'admin' })
      .select('username mustChangePassword authProvider');
    if (!admin) return res.status(404).json({ message: 'No se encontró el administrador del negocio' });
    res.json({ success: true, admin: { username: admin.username, mustChangePassword: admin.mustChangePassword, authProvider: admin.authProvider } });
  } catch (error) {
    logger.error('Error fetching business credentials', error);
    res.status(500).json({ message: 'Error al obtener credenciales' });
  }
};

// Resetear credenciales (email/usuario y/o contraseña) del admin de un negocio
exports.resetBusinessCredentials = async (req, res) => {
  try {
    const { id } = req.params;
    const { newUsername, newPassword } = req.body;

    if (!newUsername?.trim() && !newPassword?.trim()) {
      return res.status(400).json({ message: 'Proporciona al menos un campo a actualizar' });
    }

    const admin = await Admin.findOne({ businessId: id, role: 'admin' });
    if (!admin) return res.status(404).json({ message: 'No se encontró el administrador del negocio' });

    if (newUsername?.trim()) {
      const conflict = await Admin.findOne({ username: newUsername.trim(), _id: { $ne: admin._id } });
      if (conflict) return res.status(400).json({ message: 'Ese correo/usuario ya está en uso por otro negocio' });
      admin.username = newUsername.trim();
    }

    if (newPassword?.trim()) {
      const salt = await bcrypt.genSalt(10);
      admin.password = await bcrypt.hash(newPassword.trim(), salt);
      admin.mustChangePassword = true;
      admin.refreshTokens = [];
      admin.authProvider = 'local';
    }

    await admin.save();
    logger.info(`SuperAdmin reset credentials for business ${id}`, { changedUsername: !!newUsername, changedPassword: !!newPassword });

    res.json({
      success: true,
      message: 'Credenciales actualizadas correctamente',
      admin: { username: admin.username, mustChangePassword: admin.mustChangePassword }
    });
  } catch (error) {
    logger.error('Error resetting business credentials', error);
    if (error.code === 11000) return res.status(400).json({ message: 'Ese correo/usuario ya está en uso' });
    res.status(500).json({ message: 'Error al resetear credenciales' });
  }
};

// Activar/desactivar negocio
exports.activarNegocio = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const negocio = await BusinessConfig.findByIdAndUpdate(id, { isActive }, { new: true });
    
    // Emitir evento de actualización de negocios a través de Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('businesses-updated');
    }
    
    res.json(negocio);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar negocio' });
  }
};

// Eliminar negocio y todos sus datos asociados (cascade delete)
exports.eliminarNegocio = async (req, res) => {
  try {
    const { id } = req.params;
    
    // First verify business exists
    const business = await BusinessConfig.findById(id);
    if (!business) {
      return res.status(404).json({ message: 'Negocio no encontrado' });
    }
    
    // Cascade delete all related data across 16 collections
    const Order = require('../Models/Order');
    const CompletedOrder = require('../Models/CompletedOrder');
    const Product = require('../Models/Product');
    const Category = require('../Models/Category');
    const Customer = require('../Models/Customer');
    const Subscription = require('../Models/Subscription');
    const DeliveryZone = require('../Models/DeliveryZone');
    const Table = require('../Models/Table');
    const ToppingGroup = require('../Models/ToppingGroup');
    const Favorite = require('../Models/Favorite');
    const Review = require('../Models/Review');
    const PushSubscription = require('../Models/PushSubscription');
    const Banner = require('../Models/Banner');
    const WhatsAppTemplate = require('../Models/WhatsAppTemplate');
    const PaymentRequest = require('../Models/PaymentRequest');
    
    const deleteResults = await Promise.allSettled([
      Admin.deleteMany({ businessId: id }),
      Order.deleteMany({ businessId: id }),
      CompletedOrder.deleteMany({ businessId: id }),
      Product.deleteMany({ businessId: id }),
      Category.deleteMany({ businessId: id }),
      Customer.deleteMany({ businessId: id }),
      Subscription.deleteMany({ businessId: id }),
      DeliveryZone.deleteMany({ businessId: id }),
      Table.deleteMany({ businessId: id }),
      ToppingGroup.deleteMany({ businessId: id }),
      Favorite.deleteMany({ businessId: id }),
      Review.deleteMany({ businessId: id }),
      PushSubscription.deleteMany({ businessId: id }),
      Banner.deleteMany({ businessId: id }),
      WhatsAppTemplate.deleteMany({ businessId: id }),
      PaymentRequest.deleteMany({ businessId: id }),
    ]);
    
    // Log any failures
    const collectionNames = ['Admin', 'Order', 'CompletedOrder', 'Product', 'Category', 'Customer', 'Subscription', 'DeliveryZone', 'Table', 'ToppingGroup', 'Favorite', 'Review', 'PushSubscription', 'Banner', 'WhatsAppTemplate', 'PaymentRequest'];
    deleteResults.forEach((result, idx) => {
      if (result.status === 'rejected') {
        logger.warn(`Cascade delete failed for ${collectionNames[idx]}`, { error: result.reason?.message });
      }
    });
    
    // Finally delete the business itself
    await BusinessConfig.findByIdAndDelete(id);
    
    // Emitir evento de actualización de negocios a través de Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('businesses-updated');
    }
    
    logger.info(`Business ${id} (${business.businessName}) deleted with all related data`);
    res.json({ message: 'Negocio eliminado correctamente' });
  } catch (error) {
    logger.error('Error deleting business', error);
    res.status(500).json({ message: 'Error al eliminar negocio' });
  }
}; 