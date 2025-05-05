const express = require("express");
const router = express.Router();
const Category = require("../Models/Category");
const { emitToBusiness } = require("../services/socketService");
const mongoose = require('mongoose');
const { findBusinessByIdentifier, createBusinessFilter } = require("../utils/businessHelper");

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
    const categories = await getAllCategories(businessId);
    
    console.log(`Encontradas ${categories.length} categorías para el negocio ${businessId}`);
    res.json(categories);
  } catch (error) {
    console.error(`Error al obtener categorías para ${req.query.businessId}:`, error);
    res.status(500).json({ message: 'Error al obtener categorías', error: error.message });
  }
});

// Crear nueva categoría
router.post("/", async (req, res) => {
  try {
    // Si se proporciona un _id, actualizar en lugar de crear
    if (req.body._id) {
      // Intentar actualizar la categoría existente
      const updatedCategory = await Category.findByIdAndUpdate(
        req.body._id,
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
    console.log('Intentando crear categoría con:', req.body);
    
    // Manejar businessId si viene como slug
    if (req.body.businessId && typeof req.body.businessId === 'string') {
      // Buscar el businessId real
      const business = await findBusinessByIdentifier(req.body.businessId);
      if (business) {
        req.body.businessId = business._id;
      } else {
        return res.status(404).json({ 
          message: 'Negocio no encontrado',
          detail: `No se encontró un negocio con el identificador '${req.body.businessId}'`
        });
      }
    }
    
    const newCategory = new Category(req.body);
    try {
      const savedCategory = await newCategory.save();
      // Emitir evento de actualización por WebSocket
      emitToBusiness(savedCategory.businessId?.toString(), "categories_update", { type: "created", category: savedCategory });
      res.status(201).json(savedCategory);
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({ message: "Ya existe una categoría con ese nombre en este negocio." });
      }
      console.error("Error al crear/actualizar categoría:", error);
      res.status(500).json({ message: "Error al crear/actualizar la categoría" });
    }
  } catch (error) {
    console.error("Error al crear/actualizar categoría:", error);
    res.status(500).json({ message: "Error al crear/actualizar la categoría" });
  }
});

// Actualizar categoría (mejorado para manejar displayOrder)
router.put("/:id", async (req, res) => {
  try {
    console.log(`Actualizando categoría ${req.params.id}:`, req.body);
    
    // Manejar businessId si viene como slug
    if (req.body.businessId && typeof req.body.businessId === 'string') {
      // Buscar el businessId real
      const business = await findBusinessByIdentifier(req.body.businessId);
      if (business) {
        req.body.businessId = business._id;
      }
    }
    
    const updatedCategory = await Category.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    );
    
    if (!updatedCategory) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }
    
    // Emitir evento de actualización por WebSocket
    emitToBusiness(updatedCategory.businessId?.toString(), "categories_update", { type: "updated", category: updatedCategory });
    
    res.json(updatedCategory);
  } catch (error) {
    console.error("Error al actualizar categoría:", error);
    res.status(500).json({ message: "Error al actualizar la categoría" });
  }
});

// Eliminar categoría
router.delete("/:id", async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }
    // Emitir evento de actualización por WebSocket
    emitToBusiness(category.businessId?.toString(), "categories_update", { type: "deleted", categoryId: category._id });
    res.json({ message: "Categoría eliminada correctamente" });
  } catch (error) {
    console.error("Error al eliminar categoría:", error);
    res.status(500).json({ message: "Error al eliminar la categoría" });
  }
});

// Actualizar el orden de múltiples categorías
router.post("/update-order", async (req, res) => {
  try {
    const { categories } = req.body;
    
    if (!categories || !Array.isArray(categories)) {
      return res.status(400).json({ message: "Formato inválido" });
    }
    
    console.log("Actualizando orden de categorías:", categories);
    
    // Actualizar cada categoría con su nuevo displayOrder
    const updatePromises = categories.map(item => 
      Category.findByIdAndUpdate(
        item.id,
        { displayOrder: item.order },
        { new: true }
      )
    );
    
    await Promise.all(updatePromises);
    
    // Obtener categorías actualizadas y emitir actualización
    // const updatedCategories = await getAllCategories();
    // req.emitEvent('categories_update', { categories: updatedCategories }); // <-- Aquí emitir por WebSockets en el futuro
    
    res.json({ success: true, message: "Orden actualizado correctamente" });
  } catch (error) {
    console.error("Error al actualizar orden:", error);
    res.status(500).json({ message: "Error al actualizar el orden" });
  }
});

module.exports = router; 