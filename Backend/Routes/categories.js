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

// Función auxiliar para obtener todas las categorías
const getAllCategories = async (businessId = null) => {
  const filter = await createBusinessFilter(businessId);
  return await Category.find(filter);
};

// Obtener todas las categorías
router.get("/", async (req, res) => {
  try {
    let { businessId } = req.query;
    
    // Crear filtro basado en businessId o slug
    const filter = await createBusinessFilter(businessId);
    const categories = await Category.find(filter).sort({ displayOrder: 1, createdAt: 1 });
    
    logger.info(`Retrieved ${categories.length} categories for business ${businessId}`, { count: categories.length }, req);
    res.json(categories);
  } catch (error) {
    logger.error('Error obteniendo categorías', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener categorías', 500));
  }
});

// Crear nueva categoría
router.post("/", tenantAuth, async (req, res) => {
  try {
    // Si se proporciona un _id, actualizar en lugar de crear
    if (req.body._id) {
      // Compound query: only update categories belonging to this tenant
      const updatedCategory = await Category.findOneAndUpdate(
        { _id: req.body._id, businessId: req.user.businessId },
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
      
      // Emitir evento de actualización por WebSocket
      emitToBusiness(updatedCategory.businessId?.toString(), "categories_update", { type: "updated", category: updatedCategory });
      
      return res.json(updatedCategory);
    }
    
    // Si no hay _id, crear una nueva categoría
    logger.debug('Creating category', { name: req.body.name }, req);
    
    // Force businessId from authenticated user's token
    const categoryData = {
      name: req.body.name,
      description: req.body.description,
      displayOrder: req.body.displayOrder,
      active: req.body.active,
      businessId: req.user.businessId
    };
    
    const newCategory = new Category(categoryData);
    try {
      const savedCategory = await newCategory.save();
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
router.put("/reorder", tenantAuth, async (req, res) => {
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
    const updatePromises = categories.map(category => 
      Category.findOneAndUpdate(
        { _id: category._id, businessId: req.user.businessId },
        { displayOrder: category.order },
        { new: true }
      )
    );
    
    await Promise.all(updatePromises);
    
    // Emitir evento de actualización por WebSocket
    emitToBusiness(req.user.businessId?.toString(), "categories_update", { 
      type: "reordered", 
      businessId: req.user.businessId,
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
router.put("/:id", tenantAuth, async (req, res) => {
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
    const updatedCategory = await Category.findOneAndUpdate(
      { _id: req.params.id, businessId: req.user.businessId },
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!updatedCategory) {
      return res.status(404).json(formatHttpError(req, "Categoría no encontrada", 404));
    }
    
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
router.delete("/:id", tenantAuth, async (req, res) => {
  try {
    // Use businessId from token for tenant isolation
    const category = await Category.findOneAndDelete({ _id: req.params.id, businessId: req.user.businessId });
    if (!category) {
      return res.status(404).json(formatHttpError(req, "Categoría no encontrada", 404));
    }
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
router.post("/update-order", tenantAuth, async (req, res) => {
  try {
    const { categories } = req.body;
    
    if (!categories || !Array.isArray(categories)) {
      return res.status(400).json(formatHttpError(req, "Formato inválido", 400));
    }
    
    logger.debug("Actualizando orden de categorías", { count: categories.length }, req);
    
    // Actualizar cada categoría con su nuevo displayOrder (compound query for tenant isolation)
    const updatePromises = categories.map(item => 
      Category.findOneAndUpdate(
        { _id: item.id, businessId: req.user.businessId },
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