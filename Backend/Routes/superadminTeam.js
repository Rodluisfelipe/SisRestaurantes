/**
 * Gestión del equipo SuperAdmin.
 *
 * Endpoints (todos bajo /api/superadmin):
 *   GET    /team/me         — info del usuario actual (cualquier rol)
 *   GET    /team            — lista de miembros (admin+)
 *   POST   /team            — crear miembro nuevo (owner)
 *   PUT    /team/:id        — actualizar nombre/rol (owner)
 *   PATCH  /team/:id/active — activar/desactivar (owner)
 *   POST   /team/:id/reset-password — fuerza reset password (owner)
 *   DELETE /team/:id        — eliminar (owner, no a sí mismo)
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const mongoose = require('mongoose');
const SuperAdmin = require('../Models/SuperAdmin');
const auth = require('../middleware/authSuperAdmin');
const logger = require('../utils/logger');

const VALID_ROLES = ['owner', 'admin', 'support', 'auditor'];

// Todas requieren autenticación
router.use(auth.protectSuperAdmin);

/* GET /team/me — perfil del usuario actual y sus permisos */
router.get('/me', (req, res) => {
  const role = req.user.superAdminRole;
  res.json({
    success: true,
    me: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role,
    },
    permissions: {
      canManageTeam: auth.hasMinRole(role, 'owner'),
      canDelete: auth.hasMinRole(role, 'admin'),
      canApprove: auth.hasMinRole(role, 'support'),
      isReadOnly: role === 'auditor',
    },
  });
});

/* GET /team — lista del equipo (admin+) */
router.get('/', auth.requireRole('admin'), async (req, res) => {
  try {
    const team = await SuperAdmin.find({})
      .select('email name role active createdBy lastLoginAt createdAt')
      .sort({ role: 1, createdAt: 1 })
      .populate('createdBy', 'email name')
      .lean();
    res.json({ success: true, team });
  } catch (e) {
    logger.error('Error listing team', e);
    res.status(500).json({ message: 'Error al listar el equipo' });
  }
});

/* POST /team — crear miembro nuevo (owner) */
router.post('/', auth.requireRole('owner'), async (req, res) => {
  try {
    const { email, name, role, password } = req.body || {};

    if (!email || !password || !role) {
      return res.status(400).json({ message: 'email, password y role son requeridos' });
    }
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: `Rol inválido. Válidos: ${VALID_ROLES.join(', ')}` });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const existing = await SuperAdmin.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ message: 'Ya existe un miembro con ese email' });
    }

    const newMember = new SuperAdmin({
      email: email.toLowerCase().trim(),
      name: name?.trim() || null,
      password,
      role,
      active: true,
      createdBy: req.user.id,
    });
    await newMember.save();

    const safe = newMember.toObject();
    delete safe.password;
    delete safe.refreshToken;
    delete safe.resetPasswordToken;

    logger.info('SuperAdmin created team member', { actor: req.user.email, target: email, role });
    res.status(201).json({ success: true, member: safe });
  } catch (e) {
    logger.error('Error creating team member', e);
    res.status(500).json({ message: 'Error al crear miembro' });
  }
});

/* PUT /team/:id — actualizar nombre/rol (owner) */
router.put('/:id', auth.requireRole('owner'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    const { name, role } = req.body || {};
    const update = {};
    if (name !== undefined) update.name = name?.trim() || null;
    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ message: `Rol inválido. Válidos: ${VALID_ROLES.join(', ')}` });
      }
      // No te puedes bajar a ti mismo de owner si eres el único owner
      if (String(id) === String(req.user.id) && req.user.superAdminRole === 'owner' && role !== 'owner') {
        const owners = await SuperAdmin.countDocuments({ role: 'owner', active: true });
        if (owners <= 1) {
          return res.status(400).json({ message: 'No puedes quitarte el rol de owner si eres el único activo' });
        }
      }
      update.role = role;
    }
    const member = await SuperAdmin.findByIdAndUpdate(id, update, { new: true })
      .select('email name role active createdBy lastLoginAt createdAt');
    if (!member) return res.status(404).json({ message: 'Miembro no encontrado' });

    logger.info('SuperAdmin updated team member', { actor: req.user.email, target: member.email, update });
    res.json({ success: true, member });
  } catch (e) {
    logger.error('Error updating team member', e);
    res.status(500).json({ message: 'Error al actualizar miembro' });
  }
});

/* PATCH /team/:id/active — activar/desactivar (owner) */
router.patch('/:id/active', auth.requireRole('owner'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    const { active } = req.body || {};
    if (typeof active !== 'boolean') {
      return res.status(400).json({ message: 'active debe ser boolean' });
    }
    if (String(id) === String(req.user.id) && active === false) {
      return res.status(400).json({ message: 'No puedes desactivarte a ti mismo' });
    }
    // No desactivar al último owner activo
    if (active === false) {
      const target = await SuperAdmin.findById(id).select('role');
      if (target?.role === 'owner') {
        const activeOwners = await SuperAdmin.countDocuments({ role: 'owner', active: true });
        if (activeOwners <= 1) {
          return res.status(400).json({ message: 'No puedes desactivar al último owner activo' });
        }
      }
    }
    const member = await SuperAdmin.findByIdAndUpdate(id, { active }, { new: true })
      .select('email name role active');
    if (!member) return res.status(404).json({ message: 'Miembro no encontrado' });

    logger.info('SuperAdmin toggled active', { actor: req.user.email, target: member.email, active });
    res.json({ success: true, member });
  } catch (e) {
    logger.error('Error toggling team member active', e);
    res.status(500).json({ message: 'Error al cambiar estado' });
  }
});

/* POST /team/:id/reset-password — fuerza nueva contraseña (owner) */
router.post('/:id/reset-password', auth.requireRole('owner'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    const { newPassword } = req.body || {};
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: 'newPassword debe tener al menos 8 caracteres' });
    }
    const member = await SuperAdmin.findById(id);
    if (!member) return res.status(404).json({ message: 'Miembro no encontrado' });

    member.password = newPassword; // el pre-save hash bcrypt
    // Invalidar sesiones existentes
    member.refreshToken = null;
    await member.save();

    logger.info('SuperAdmin reset password', { actor: req.user.email, target: member.email });
    res.json({ success: true, message: 'Contraseña actualizada y sesiones revocadas' });
  } catch (e) {
    logger.error('Error resetting password', e);
    res.status(500).json({ message: 'Error al resetear contraseña' });
  }
});

/* DELETE /team/:id — eliminar miembro (owner) */
router.delete('/:id', auth.requireRole('owner'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    if (String(id) === String(req.user.id)) {
      return res.status(400).json({ message: 'No puedes eliminarte a ti mismo' });
    }
    const target = await SuperAdmin.findById(id).select('role email');
    if (!target) return res.status(404).json({ message: 'Miembro no encontrado' });
    if (target.role === 'owner') {
      const owners = await SuperAdmin.countDocuments({ role: 'owner' });
      if (owners <= 1) {
        return res.status(400).json({ message: 'No puedes eliminar al último owner' });
      }
    }
    await SuperAdmin.findByIdAndDelete(id);
    logger.info('SuperAdmin deleted team member', { actor: req.user.email, target: target.email });
    res.json({ success: true, message: 'Miembro eliminado' });
  } catch (e) {
    logger.error('Error deleting team member', e);
    res.status(500).json({ message: 'Error al eliminar miembro' });
  }
});

module.exports = router;
