const BusinessConfig = require('../Models/BusinessConfig');
const Admin = require('../Models/Admin');
const bcrypt = require('bcryptjs');
const { emitBusinessesUpdate } = require('../socketService');
const axios = require('axios');
const mongoose = require('mongoose');

// Crear nuevo negocio y admin
exports.crearNegocio = async (req, res) => {
  try {
    const { businessName, logo, whatsappNumber, adminUsername, slug } = req.body;
    if (!slug) {
      return res.status(400).json({ message: 'El slug es requerido' });
    }
    // 1. Crear negocio
    const business = await BusinessConfig.create({ businessName, logo, whatsappNumber, slug });
    // 2. Crear admin con contraseña por defecto
    const defaultPassword = 'admin123'; // Puedes cambiar esto
    const admin = new Admin({
      username: adminUsername,
      password: defaultPassword,
      role: 'admin',
      businessId: business._id
    });
    await admin.save();
    // Emitir evento de actualización de negocios
    emitBusinessesUpdate();
    res.status(201).json({
      business,
      admin: { username: admin.username, password: defaultPassword }
    });
  } catch (error) {
    console.error('Error al crear negocio:', error);
    // Manejo de errores de duplicado
    if (error.code === 11000) {
      if (error.keyPattern && error.keyPattern.slug) {
        return res.status(400).json({ message: 'El slug ya está en uso. Usa uno diferente.' });
      }
      if (error.keyPattern && error.keyPattern.username) {
        return res.status(400).json({ message: 'El usuario admin ya existe. Usa otro nombre de usuario.' });
      }
    }
    res.status(500).json({ message: 'Error al crear negocio', error: error.message });
  }
};

// Listar todos los negocios
exports.listarNegocios = async (req, res) => {
  try {
    const negocios = await BusinessConfig.find({}).lean();
    res.json(negocios);
  } catch (error) {
    res.status(500).json({ message: 'Error al listar negocios', error: error.message });
  }
};

// Activar/desactivar negocio
exports.activarNegocio = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const negocio = await BusinessConfig.findByIdAndUpdate(id, { isActive }, { new: true });
    // Emitir evento de actualización de negocios
    emitBusinessesUpdate();
    // --- Notificar al backend del negocio ---
    // Suponiendo que el backend del negocio está en localhost:5000
    // y que el _id de la base de datos del superadmin es igual al businessId del backend del negocio
    try {
      await axios.put('http://localhost:5000/business-config/active', {
        businessId: id,
        isActive
      });
    } catch (err) {
      console.error('Error notificando al backend del negocio:', err.message);
    }
    res.json(negocio);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar negocio', error: error.message });
  }
};

// Eliminar negocio y sus admins
exports.eliminarNegocio = async (req, res) => {
  try {
    const { id } = req.params;
    // Eliminar todos los admins asociados a este negocio
    await Admin.deleteMany({ businessId: id });
    // Eliminar el negocio
    const deleted = await BusinessConfig.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Negocio no encontrado' });
    }
    emitBusinessesUpdate();
    res.json({ message: 'Negocio eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar negocio', error: error.message });
  }
};
