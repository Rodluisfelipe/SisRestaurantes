const express = require("express");
const router = express.Router();
const Product = require("../Models/Product");

// GET all products
router.get("/", async (req, res) => {
  try {
    const products = await Product.find()
      .populate({
        path: 'toppingGroups',
        match: { active: true },
        select: 'name description isMultipleChoice isRequired options'
      });
    res.json(products);
  } catch (error) {
    console.error("Error al obtener productos:", error);
    res.status(500).json({ message: "Error al obtener los productos" });
  }
});

// POST a product
router.post("/", async (req, res) => {
  try {
    const newProduct = new Product(req.body);
    await newProduct.save();
    const populatedProduct = await Product.findById(newProduct._id)
      .populate({
        path: 'toppingGroups',
        match: { active: true },
        select: 'name description isMultipleChoice isRequired options'
      });
    res.json(populatedProduct);
  } catch (error) {
    console.error("Error al crear producto:", error);
    res.status(500).json({ message: "Error al crear el producto" });
  }
});

// PUT a product
router.put("/:id", async (req, res) => {
  try {
    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate({
      path: 'toppingGroups',
      match: { active: true },
      select: 'name description isMultipleChoice isRequired options'
    });
    res.json(updated);
  } catch (error) {
    console.error("Error al actualizar producto:", error);
    res.status(500).json({ message: "Error al actualizar el producto" });
  }
});

// DELETE a product
router.delete("/:id", async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Producto eliminado" });
  } catch (error) {
    console.error("Error al eliminar producto:", error);
    res.status(500).json({ message: "Error al eliminar el producto" });
  }
});

module.exports = router;
