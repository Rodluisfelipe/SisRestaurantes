const express = require("express");
const router = express.Router();
const Category = require("../Models/Category");

// Función auxiliar para obtener todas las categorías
const getAllCategories = async () => {
  return await Category.find({ active: true }).sort('name');
};

// Obtener todas las categorías
router.get("/", async (req, res) => {
  try {
    const categories = await getAllCategories();
    res.json(categories);
  } catch (error) {
    console.error("Error al obtener categorías:", error);
    res.status(500).json({ message: "Error al obtener las categorías" });
  }
});

// Crear nueva categoría
router.post("/", async (req, res) => {
  try {
    const category = new Category({
      name: req.body.name,
      description: req.body.description
    });
    await category.save();
    
    // Obtener categorías actualizadas y emitir actualización
    const categories = await getAllCategories();
    req.emitEvent('categories_update', { categories });
    
    res.status(201).json(category);
  } catch (error) {
    console.error("Error al crear categoría:", error);
    res.status(500).json({ message: "Error al crear la categoría", error: error.message });
  }
});

// Eliminar categoría
router.delete("/:id", async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    );
    
    // Obtener categorías actualizadas y emitir actualización
    const categories = await getAllCategories();
    req.emitEvent('categories_update', { categories });
    
    res.json(category);
  } catch (error) {
    console.error("Error al eliminar categoría:", error);
    res.status(500).json({ message: "Error al eliminar la categoría" });
  }
});

module.exports = router; 