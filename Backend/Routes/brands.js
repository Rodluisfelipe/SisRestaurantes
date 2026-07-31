const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Brand = require('../Models/Brand');
const BusinessConfig = require('../Models/BusinessConfig');
const Admin = require('../Models/Admin');
const logger = require('../utils/logger');
const authSuperAdmin = require('../middleware/authSuperAdmin');
const { requireRole } = authSuperAdmin;

router.use(authSuperAdmin.protectSuperAdmin);

// GET / — list all brands with branch count
router.get('/', async (req, res) => {
  try {
    const brands = await Brand.find().sort({ createdAt: -1 }).lean();
    const brandIds = brands.map(b => b._id);
    const branchCounts = await BusinessConfig.aggregate([
      { $match: { brandId: { $in: brandIds } } },
      { $group: { _id: '$brandId', count: { $sum: 1 } } }
    ]);
    const countMap = {};
    branchCounts.forEach(({ _id, count }) => { countMap[String(_id)] = count; });
    res.json(brands.map(b => ({ ...b, branchCount: countMap[String(b._id)] || 0 })));
  } catch (err) {
    logger.error('Error listing brands', err);
    res.status(500).json({ message: err.message });
  }
});

// GET /:id — brand detail with branches
router.get('/:id', async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id).lean();
    if (!brand) return res.status(404).json({ message: 'Marca no encontrada' });
    const branches = await BusinessConfig.find(
      { brandId: brand._id },
      'businessName branchLabel slug isMainBranch useSharedMenu mainBranchId isActive'
    ).lean();
    res.json({ ...brand, branches });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST / — create brand
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { name, slug, logoUrl } = req.body;
    if (!name || !slug) return res.status(400).json({ message: 'name y slug son requeridos' });
    const exists = await Brand.findOne({ slug: slug.toLowerCase() });
    if (exists) return res.status(400).json({ message: 'Ya existe una marca con ese slug' });
    const brand = await Brand.create({
      name: name.trim(),
      slug: slug.toLowerCase().trim(),
      logoUrl: logoUrl || null,
      createdBy: req.user?.username || null,
    });
    res.status(201).json(brand);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /:id — update brand
router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { name, logoUrl } = req.body;
    const brand = await Brand.findByIdAndUpdate(
      req.params.id,
      { ...(name && { name: name.trim() }), ...(logoUrl !== undefined && { logoUrl }) },
      { new: true }
    );
    if (!brand) return res.status(404).json({ message: 'Marca no encontrada' });
    res.json(brand);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /:id/assign — assign businesses to brand + optional brand_admin creation
router.post('/:id/assign', requireRole('admin'), async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) return res.status(404).json({ message: 'Marca no encontrada' });

    const { businessIds = [], mainBranchId, sharedMenuBranchIds = [], brandAdmin } = req.body;

    if (!businessIds.length) return res.status(400).json({ message: 'businessIds es requerido' });
    if (!mainBranchId) return res.status(400).json({ message: 'mainBranchId es requerido' });
    if (!businessIds.includes(String(mainBranchId))) {
      return res.status(400).json({ message: 'mainBranchId debe estar en businessIds' });
    }

    // Unset brandId from businesses that were previously in this brand but are being removed
    await BusinessConfig.updateMany(
      { brandId: brand._id, _id: { $nin: businessIds.map(id => new mongoose.Types.ObjectId(id)) } },
      { $unset: { brandId: 1 }, $set: { isMainBranch: false, useSharedMenu: false, mainBranchId: null } }
    );

    // Assign all businesses to this brand
    await Promise.all(businessIds.map(bizId => {
      const isMain = String(bizId) === String(mainBranchId);
      const useShared = !isMain && sharedMenuBranchIds.includes(String(bizId));
      return BusinessConfig.findByIdAndUpdate(bizId, {
        brandId: brand._id,
        isMainBranch: isMain,
        useSharedMenu: useShared,
        mainBranchId: useShared ? mainBranchId : null,
        branchLabel: undefined,
      });
    }));

    // Create / update brand_admin account
    let createdAdmin = null;
    if (brandAdmin?.username && brandAdmin?.password) {
      const existing = await Admin.findOne({ username: brandAdmin.username });
      // La contraseña se pasa EN PLANO: el hook pre('save') del modelo Admin la
      // hashea (también en Admin.create). Hashearla aquí la dejaba con doble
      // bcrypt y el admin de marca no podía iniciar sesión.
      const plainPassword = brandAdmin.password;

      if (existing) {
        existing.brandId = brand._id;
        existing.accessibleBusinessIds = businessIds.map(id => new mongoose.Types.ObjectId(id));
        existing.role = 'brand_admin';
        existing.businessId = new mongoose.Types.ObjectId(mainBranchId);
        if (brandAdmin.password) {
          existing.password = plainPassword;
        }
        await existing.save();
        createdAdmin = { id: existing._id, username: existing.username, isNew: false };
      } else {
        const newAdmin = await Admin.create({
          username: brandAdmin.username.trim(),
          password: plainPassword,
          name: brandAdmin.name || brand.name,
          role: 'brand_admin',
          brandId: brand._id,
          businessId: new mongoose.Types.ObjectId(mainBranchId),
          accessibleBusinessIds: businessIds.map(id => new mongoose.Types.ObjectId(id)),
          authProvider: 'local',
        });
        createdAdmin = { id: newAdmin._id, username: newAdmin.username, isNew: true };
      }
    }

    const branches = await BusinessConfig.find(
      { brandId: brand._id },
      'businessName branchLabel slug isMainBranch useSharedMenu'
    ).lean();

    res.json({ brand, branches, admin: createdAdmin });
  } catch (err) {
    logger.error('Error assigning brand', err);
    res.status(500).json({ message: err.message });
  }
});

// PATCH /:brandId/branch/:bizId — update a single branch config (label, useSharedMenu)
router.patch('/:brandId/branch/:bizId', requireRole('admin'), async (req, res) => {
  try {
    const { branchLabel, useSharedMenu, mainBranchId } = req.body;
    const update = {};
    if (branchLabel !== undefined) update.branchLabel = branchLabel;
    if (useSharedMenu !== undefined) {
      update.useSharedMenu = useSharedMenu;
      update.mainBranchId = useSharedMenu ? mainBranchId : null;
    }
    const biz = await BusinessConfig.findOneAndUpdate(
      { _id: req.params.bizId, brandId: req.params.brandId },
      update,
      { new: true, select: 'businessName branchLabel useSharedMenu mainBranchId isMainBranch' }
    );
    if (!biz) return res.status(404).json({ message: 'Sucursal no encontrada' });
    res.json(biz);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /:id — remove brand (unsets brandId from all businesses)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) return res.status(404).json({ message: 'Marca no encontrada' });
    await BusinessConfig.updateMany(
      { brandId: brand._id },
      { $unset: { brandId: 1 }, $set: { isMainBranch: false, useSharedMenu: false, mainBranchId: null } }
    );
    await Admin.updateMany({ brandId: brand._id }, { $unset: { brandId: 1 }, $set: { role: 'admin', accessibleBusinessIds: [] } });
    await Brand.deleteOne({ _id: brand._id });
    res.json({ message: 'Marca eliminada' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
