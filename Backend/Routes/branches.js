const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Brand = require('../Models/Brand');
const BusinessConfig = require('../Models/BusinessConfig');
const Admin = require('../Models/Admin');
const Category = require('../Models/Category');
const Product = require('../Models/Product');
const ToppingGroup = require('../Models/ToppingGroup');
const { tenantAuth } = require('../middleware/tenantAuth');
const { generateToken } = require('../config/jwt');
const logger = require('../utils/logger');

// Deep-clone menu from sourceBizId into targetBizId
async function cloneMenu(sourceBizId, targetBizId) {
  const sourceId = new mongoose.Types.ObjectId(String(sourceBizId));
  const targetId = new mongoose.Types.ObjectId(String(targetBizId));

  // 1. Clone toppingGroups — build oldId→newId map
  const toppingGroups = await ToppingGroup.find({ businessId: sourceId }).lean();
  const toppingIdMap = {};
  for (const tg of toppingGroups) {
    const { _id, businessId, createdAt, updatedAt, __v, ...rest } = tg;
    const newTg = await ToppingGroup.create({ ...rest, businessId: targetId });
    toppingIdMap[String(_id)] = newTg._id;
  }

  // 2. Clone categories — build oldId→newId map
  const categories = await Category.find({ businessId: sourceId }).lean();
  const catIdMap = {};
  for (const cat of categories) {
    const { _id, businessId, createdAt, updatedAt, __v, ...rest } = cat;
    const newCat = await Category.create({ ...rest, businessId: targetId });
    catIdMap[String(_id)] = newCat._id;
  }

  // 3. Clone products — remap category + toppingGroups references
  const products = await Product.find({ businessId: sourceId }).lean();
  for (const prod of products) {
    const { _id, businessId, createdAt, updatedAt, __v, ...rest } = prod;
    await Product.create({
      ...rest,
      businessId: targetId,
      category: rest.category ? (catIdMap[String(rest.category)] || null) : null,
      toppingGroups: (rest.toppingGroups || []).map(tid => toppingIdMap[String(tid)]).filter(Boolean),
      toppingGroupsOrder: (rest.toppingGroupsOrder || [])
        .map(({ toppingGroupId, order }) => ({
          toppingGroupId: toppingIdMap[String(toppingGroupId)] || toppingGroupId,
          order,
        })),
    });
  }

  return { categories: categories.length, products: products.length, toppingGroups: toppingGroups.length };
}

// GET / — list branches for the current brand_admin (or own business for regular admin)
router.get('/', tenantAuth, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id, 'brandId accessibleBusinessIds role businessId').lean();
    if (!admin) return res.status(404).json({ message: 'Admin no encontrado' });

    if (admin.role !== 'brand_admin' || !admin.brandId) {
      // Regular admin — single branch
      const biz = await BusinessConfig.findById(admin.businessId, 'businessName branchLabel slug isMainBranch isActive brandId').lean();
      return res.json({ branches: biz ? [biz] : [], hasBrand: false });
    }

    const branches = await BusinessConfig.find(
      { brandId: admin.brandId },
      'businessName branchLabel slug isMainBranch isActive useSharedMenu'
    ).lean();
    res.json({ branches, hasBrand: true, brandId: admin.brandId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST / — self-service: create a new branch
router.post('/', tenantAuth, async (req, res) => {
  try {
    const { businessName, slug, branchLabel, whatsappNumber, address, useSharedMenu, cloneMenu: shouldClone } = req.body;

    if (!businessName?.trim()) return res.status(400).json({ message: 'Nombre de la sucursal requerido' });
    if (!slug?.trim()) return res.status(400).json({ message: 'Slug requerido' });

    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    const slugExists = await BusinessConfig.exists({ slug: cleanSlug });
    if (slugExists) return res.status(400).json({ message: 'Ese slug ya está en uso, elige otro' });

    const admin = await Admin.findById(req.user.id);
    if (!admin) return res.status(404).json({ message: 'Admin no encontrado' });

    const currentBiz = await BusinessConfig.findById(admin.businessId, 'businessName businessType slug brandId isMainBranch').lean();
    if (!currentBiz) return res.status(404).json({ message: 'Negocio no encontrado' });

    // Auto-create Brand if this admin doesn't have one yet
    let brandId = admin.brandId;
    if (!brandId) {
      const brandSlug = currentBiz.slug + '-brand';
      const brand = await Brand.create({
        name: currentBiz.businessName,
        slug: brandSlug,
        createdBy: admin.username,
      });
      brandId = brand._id;

      // Link current business to brand as main branch
      await BusinessConfig.findByIdAndUpdate(admin.businessId, {
        brandId,
        isMainBranch: true,
      });
    }

    // Create new branch
    const newBiz = await BusinessConfig.create({
      businessName: businessName.trim(),
      slug: cleanSlug,
      branchLabel: branchLabel?.trim() || null,
      businessType: currentBiz.businessType || 'restaurant',
      brandId,
      isMainBranch: false,
      useSharedMenu: !!useSharedMenu,
      mainBranchId: useSharedMenu ? admin.businessId : null,
      ...(whatsappNumber ? { whatsappNumber } : {}),
      ...(address ? { address } : {}),
    });

    // Upgrade admin to brand_admin + add new branch to accessible list
    const currentIds = (admin.accessibleBusinessIds || []).map(String);
    if (!currentIds.includes(String(admin.businessId))) {
      currentIds.push(String(admin.businessId));
    }
    currentIds.push(String(newBiz._id));

    admin.role = 'brand_admin';
    admin.brandId = brandId;
    admin.accessibleBusinessIds = currentIds.map(id => new mongoose.Types.ObjectId(id));
    await admin.save();

    // Issue new JWT with brand_admin role + same active branch
    const token = generateToken(admin._id, admin.businessId, 'brand_admin', brandId);

    // Clone menu if requested (and NOT sharing menu)
    let cloneStats = null;
    if (shouldClone && !useSharedMenu) {
      try {
        cloneStats = await cloneMenu(admin.businessId, newBiz._id);
        logger.info(`Menu cloned to branch ${cleanSlug}`, cloneStats);
      } catch (cloneErr) {
        logger.warn('Menu clone failed (branch still created)', { error: cloneErr.message });
      }
    }

    const branches = await BusinessConfig.find(
      { brandId },
      'businessName branchLabel slug isMainBranch useSharedMenu isActive'
    ).lean();

    logger.info(`New branch created: ${cleanSlug} under brand ${brandId}`);
    res.status(201).json({ token, branches, newBranchId: newBiz._id, cloneStats });
  } catch (err) {
    logger.error('Error creating branch', err);
    res.status(500).json({ message: err.message });
  }
});

// DELETE /:id — remove a branch (not allowed on main branch)
router.delete('/:id', tenantAuth, async (req, res) => {
  try {
    if (req.user.role !== 'brand_admin') return res.status(403).json({ message: 'Sin permiso' });

    const admin = await Admin.findById(req.user.id, 'brandId accessibleBusinessIds businessId').lean();
    const hasAccess = (admin?.accessibleBusinessIds || []).some(id => id.toString() === req.params.id);
    if (!hasAccess) return res.status(403).json({ message: 'Sin acceso a esta sucursal' });

    const biz = await BusinessConfig.findById(req.params.id, 'isMainBranch brandId businessName').lean();
    if (!biz) return res.status(404).json({ message: 'Sucursal no encontrada' });
    if (biz.isMainBranch) return res.status(400).json({ message: 'No se puede eliminar la sucursal principal' });

    // Soft-delete: unlink from brand and deactivate
    await BusinessConfig.findByIdAndUpdate(req.params.id, {
      $unset: { brandId: 1 },
      isActive: false,
      isMainBranch: false,
      useSharedMenu: false,
      mainBranchId: null,
    });

    // Remove from admin's accessible list
    await Admin.findByIdAndUpdate(req.user.id, {
      $pull: { accessibleBusinessIds: new mongoose.Types.ObjectId(req.params.id) },
    });

    res.json({ message: 'Sucursal desvinculada' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
