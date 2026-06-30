const express = require("express");
const router = express.Router();
const Category = require("../Models/Category");
const { emitToBusiness } = require("../services/socketService");
const mongoose = require('mongoose');
const { createBusinessFilter } = require("../utils/businessHelper");
const { resolveBusinessId } = require("../utils/businessResolver");
const logger = require("../utils/logger");
const { formatHttpError } = require("../utils/errorFormatter");
const { tenantAuth } = require("../middleware/tenantAuth");
const { audit } = require('../utils/auditLog');
const BusinessConfig = require('../Models/BusinessConfig');
const { getPlanLimitStatus } = require('../utils/subscriptionHelper');
const {
  validateCreateCategory,
  validateReorderCategories,
  validateUpdateCategory,
  validateDeleteCategory,
  validateUpdateOrder,
} = require('../middleware/validators/categoryValidators');

// Función auxiliar para obtener todas las categorías
const getAllCategories = async (businessId = null) => {
  const filter = await createBusinessFilter(businessId);
  return await Category.find(filter).lean();
};

// Obtener todas las categorías
router.get("/", async (req, res) => {
  try {
    let { businessId } = req.query;

    // useSharedMenu: redirect public menu queries to main branch's categories
    try {
      const rawId = businessId && await resolveBusinessId(businessId);
      if (rawId) {
        const bizMeta = await BusinessConfig.findById(rawId, 'useSharedMenu mainBranchId').lean();
        if (bizMeta?.useSharedMenu && bizMeta?.mainBranchId) businessId = String(bizMeta.mainBranchId);
      }
    } catch (_) {}

    // Crear filtro basado en businessId o slug
    const filter = await createBusinessFilter(businessId);
    const categories = await Category.find(filter).sort({ displayOrder: 1, createdAt: 1 }).lean();
    
    logger.info(`Retrieved ${categories.length} categories for business ${businessId}`, { count: categories.length }, req);
    res.json(categories);
  } catch (error) {
    logger.error('Error obteniendo categorías', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener categorías', 500));
  }
});

// Crear nueva categoría
router.post("/", tenantAuth, validateCreateCategory, async (req, res) => {
  try {
    // Si se proporciona un _id, actualizar en lugar de crear
    if (req.body._id) {
      // Compound query: only update categories belonging to this tenant
      const tenantBusinessId = req.user.businessId || req.body.businessId;
      const beforeUpdate = await Category.findOne({ _id: req.body._id, ...(tenantBusinessId ? { businessId: tenantBusinessId } : {}) }).lean();
      const updatedCategory = await Category.findOneAndUpdate(
        { _id: req.body._id, ...(tenantBusinessId ? { businessId: tenantBusinessId } : {}) },
        {
          name: req.body.name,
          description: req.body.description,
          displayOrder: req.body.displayOrder,
          active: req.body.active
        },
        { new: true }
      );
      
      if (!updatedCategory) {
        return res.status(404).json({ message: "Categoría no encontrada" });
      }
      
      // Audit log
      const biz = await BusinessConfig.findById(updatedCategory.businessId).select('name').lean();
      audit({ action: 'update', resource: 'category', resourceId: updatedCategory._id, resourceName: updatedCategory.name, businessId: updatedCategory.businessId, businessName: biz?.name, before: beforeUpdate, after: updatedCategory.toObject ? updatedCategory.toObject() : updatedCategory, req });
      
      // Emitir evento de actualización por WebSocket
      emitToBusiness(updatedCategory.businessId?.toString(), "categories_update", { type: "updated", category: updatedCategory });
      
      return res.json(updatedCategory);
    }
    
    // Si no hay _id, crear una nueva categoría
    logger.debug('Creating category', { name: req.body.name }, req);
    
    // Force businessId from authenticated user's token, fallback for superadmin
    const categoryData = {
      name: req.body.name,
      description: req.body.description,
      displayOrder: req.body.displayOrder,
      active: req.body.active,
      businessId: req.user.businessId || req.body.businessId
    };

    const currentCount = await Category.countDocuments({ businessId: categoryData.businessId });
    const limitStatus = await getPlanLimitStatus({
      businessId: categoryData.businessId,
      resourceKey: 'categories',
      currentCount
    });

    if (limitStatus.limitReached) {
      return res.status(403).json(
        formatHttpError(req, limitStatus.message, 403, {
          code: 'PLAN_LIMIT_REACHED',
          resource: 'categories',
          plan: limitStatus.commercialPlan,
          limit: limitStatus.limitValue,
          current: currentCount
        })
      );
    }
    
    const newCategory = new Category(categoryData);
    try {
      const savedCategory = await newCategory.save();
      // Audit log
      const biz = await BusinessConfig.findById(savedCategory.businessId).select('name').lean();
      audit({ action: 'create', resource: 'category', resourceId: savedCategory._id, resourceName: savedCategory.name, businessId: savedCategory.businessId, businessName: biz?.name, after: savedCategory.toObject(), req });
      // Emitir evento de actualización por WebSocket
      emitToBusiness(savedCategory.businessId?.toString(), "categories_update", { type: "created", category: savedCategory });
      logger.info('Category created', { id: savedCategory._id, name: savedCategory.name }, req);
      res.status(201).json(savedCategory);
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json(formatHttpError(req, "Ya existe una categoría con ese nombre en este negocio.", 400));
      }
      logger.error("Error creating category", error, req);
      res.status(500).json(formatHttpError(req, "Error al crear la categoría", 500));
    }
  } catch (error) {
    logger.error("Error en POST categories", error, req);
    res.status(500).json(formatHttpError(req, "Error al procesar la categoría", 500));
  }
});

// Reordenar categorías (debe ir antes de /:id para evitar conflictos)
router.put("/reorder", tenantAuth, validateReorderCategories, async (req, res) => {
  try {
    const { businessId, categories } = req.body;
    
    if (!businessId) {
      return res.status(400).json(formatHttpError(req, "businessId es requerido", 400));
    }
    
    if (!categories || !Array.isArray(categories)) {
      return res.status(400).json(formatHttpError(req, "Formato inválido", 400));
    }
    
    logger.debug(`Reordenando categorías para negocio ${businessId}`, { count: categories.length }, req);
    
    // Actualizar cada categoría con su nuevo orden (compound query for tenant isolation)
    const tenantBusinessId = req.user.businessId || req.body.businessId;
    const updatePromises = categories.map(category => 
      Category.findOneAndUpdate(
        { _id: category._id, ...(tenantBusinessId ? { businessId: tenantBusinessId } : {}) },
        { displayOrder: category.order },
        { new: true }
      )
    );
    
    await Promise.all(updatePromises);
    
    // Emitir evento de actualización por WebSocket
    const wsBusinessId = tenantBusinessId || businessId;
    emitToBusiness(wsBusinessId?.toString(), "categories_update", { 
      type: "reordered", 
      businessId: wsBusinessId,
      message: "Orden de categorías actualizado" 
    });
    
    logger.info('Categories reordered', { businessId, count: categories.length }, req);
    res.json({ success: true, message: "Orden de categorías actualizado correctamente" });
  } catch (error) {
    logger.error("Error reordenando categorías", error, req);
    res.status(500).json(formatHttpError(req, "Error al reordenar las categorías", 500));
  }
});

// Actualizar categoría (mejorado para manejar displayOrder)
router.put("/:id", tenantAuth, validateUpdateCategory, async (req, res) => {
  try {
    logger.debug('Updating category', { id: req.params.id }, req);
    
    // Whitelist allowed fields — prevent businessId override and mass assignment
    const { name, description, displayOrder, active } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
    if (active !== undefined) updateData.active = active;
    
    // Compound query: only update categories belonging to this tenant
    const tenantBusinessId = req.user.businessId || req.body.businessId;
    const beforeUpdate = await Category.findOne({ _id: req.params.id, ...(tenantBusinessId ? { businessId: tenantBusinessId } : {}) }).lean();
    const updatedCategory = await Category.findOneAndUpdate(
      { _id: req.params.id, ...(tenantBusinessId ? { businessId: tenantBusinessId } : {}) },
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!updatedCategory) {
      return res.status(404).json(formatHttpError(req, "Categoría no encontrada", 404));
    }
    
    // Audit log
    const biz = await BusinessConfig.findById(updatedCategory.businessId).select('name').lean();
    audit({ action: 'update', resource: 'category', resourceId: updatedCategory._id, resourceName: updatedCategory.name, businessId: updatedCategory.businessId, businessName: biz?.name, before: beforeUpdate, after: updatedCategory.toObject ? updatedCategory.toObject() : updatedCategory, req });
    
    // Emitir evento de actualización por WebSocket
    emitToBusiness(updatedCategory.businessId?.toString(), "categories_update", { type: "updated", category: updatedCategory });
    
    logger.info('Category updated', { id: updatedCategory._id, name: updatedCategory.name }, req);
    res.json(updatedCategory);
  } catch (error) {
    logger.error("Error updating category", error, req);
    res.status(500).json(formatHttpError(req, "Error al actualizar la categoría", 500));
  }
});

// Eliminar categoría
router.delete("/:id", tenantAuth, validateDeleteCategory, async (req, res) => {
  try {
    // Use businessId from token for tenant isolation, fallback for superadmin
    const tenantBusinessId = req.user.businessId || req.query.businessId;
    const beforeDelete = await Category.findOne({ _id: req.params.id, ...(tenantBusinessId ? { businessId: tenantBusinessId } : {}) }).lean();
    const category = await Category.findOneAndDelete({ _id: req.params.id, ...(tenantBusinessId ? { businessId: tenantBusinessId } : {}) });
    if (!category) {
      return res.status(404).json(formatHttpError(req, "Categoría no encontrada", 404));
    }
    // Audit log
    const biz = await BusinessConfig.findById(category.businessId).select('name').lean();
    audit({ action: 'delete', resource: 'category', resourceId: category._id, resourceName: category.name, businessId: category.businessId, businessName: biz?.name, before: beforeDelete, req });
    // Emitir evento de actualización por WebSocket
    emitToBusiness(category.businessId?.toString(), "categories_update", { type: "deleted", categoryId: category._id });
    logger.info('Category deleted', { id: category._id }, req);
    res.json({ message: "Categoría eliminada correctamente" });
  } catch (error) {
    logger.error("Error deleting category", error, req);
    res.status(500).json(formatHttpError(req, "Error al eliminar la categoría", 500));
  }
});

// Actualizar el orden de múltiples categorías
router.post("/update-order", tenantAuth, validateUpdateOrder, async (req, res) => {
  try {
    const { categories } = req.body;
    
    if (!categories || !Array.isArray(categories)) {
      return res.status(400).json(formatHttpError(req, "Formato inválido", 400));
    }
    
    logger.debug("Actualizando orden de categorías", { count: categories.length }, req);
    
    // Actualizar cada categoría con su nuevo displayOrder (compound query for tenant isolation)
    const tenantBusinessId2 = req.user.businessId || req.body.businessId;
    const updatePromises = categories.map(item => 
      Category.findOneAndUpdate(
        { _id: item.id, ...(tenantBusinessId2 ? { businessId: tenantBusinessId2 } : {}) },
        { displayOrder: item.order },
        { new: true }
      )
    );
    
    await Promise.all(updatePromises);
    
    // Obtener categorías actualizadas y emitir actualización
    // const updatedCategories = await getAllCategories();
    // req.emitEvent('categories_update', { categories: updatedCategories }); // <-- Aquí emitir por WebSockets en el futuro
    
    logger.info('Categories order updated', { count: categories.length }, req);
    res.json({ success: true, message: "Orden actualizado correctamente" });
  } catch (error) {
    logger.error("Error updating categories order", error, req);
    res.status(500).json(formatHttpError(req, "Error al actualizar el orden", 500));
  }
});


module.exports = router; 