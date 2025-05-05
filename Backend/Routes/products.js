const express = require("express");
const router = express.Router();
const Product = require("../Models/Product");
const { emitToBusiness } = require("../services/socketService");
const mongoose = require("mongoose");
const { findBusinessByIdentifier, createBusinessFilter } = require("../utils/businessHelper");

/**
 * API de Productos
 *
 * Proporciona endpoints para:
 * - GET /api/products: Obtener todos los productos
 * - POST /api/products: Crear un nuevo producto
 * - PUT /api/products/:id: Actualizar un producto existente
 * - DELETE /api/products/:id: Eliminar un producto
 */

// Función auxiliar para obtener todos los productos con sus relaciones
const getAllProducts = async () => {
  console.log('[Products] Obteniendo todos los productos con sus relaciones');
  const products = await Product.find()
    .populate({
      path: 'toppingGroups',
      match: { active: true },
      select: 'name description isMultipleChoice isRequired options basePrice subGroups'
    });
  
  console.log('[Products] Productos encontrados:', products.length);
  console.log('[Products] Ejemplo de toppingGroups en el primer producto:', 
    products[0]?.toppingGroups);
  
  return products;
};

// Función para emitir actualización de productos
const emitProductsUpdate = async (req) => {
  try {
    const products = await getAllProducts();
    console.log(`Emitiendo actualización de productos (${products.length} productos)`);
    req.emitEvent('products_update', products);
  } catch (error) {
    console.error('Error al emitir actualización de productos:', error);
  }
};

// GET all products
router.get("/", async (req, res) => {
  try {
    let { businessId } = req.query;
    
    // Crear filtro basado en businessId o slug
    const filter = await createBusinessFilter(businessId);
    
    console.log('Buscando productos con filtro:', filter);
    
    const products = await Product.find(filter)
      .populate({
        path: 'toppingGroups',
        match: { active: true },
        select: 'name description isMultipleChoice isRequired options basePrice subGroups'
      });
    
    console.log(`Encontrados ${products.length} productos`);
    res.json(products);
  } catch (error) {
    console.error("Error al obtener productos:", error);
    res.status(500).json({ message: error.message });
  }
});

// GET /products/:id (si existe)
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate({
        path: 'toppingGroups',
        match: { active: true },
        select: 'name description isMultipleChoice isRequired options basePrice subGroups'
      });
    res.json(product);
  } catch (error) {
    console.error("Error al obtener producto:", error);
    res.status(500).json({ message: error.message });
  }
});

// POST a product
router.post("/", async (req, res) => {
  try {
    let productData = req.body;
    
    // Si los toppingGroups vienen como string (desde FormData), parsearlo
    if (typeof productData.toppingGroups === 'string') {
      productData.toppingGroups = JSON.parse(productData.toppingGroups);
    }
    
    // Manejar businessId si viene como slug
    if (productData.businessId && typeof productData.businessId === 'string') {
      // Buscar el businessId real
      const business = await findBusinessByIdentifier(productData.businessId);
      if (business) {
        productData.businessId = business._id;
      } else {
        return res.status(404).json({ 
          message: 'Negocio no encontrado',
          detail: `No se encontró un negocio con el identificador '${productData.businessId}'`
        });
      }
    }
    
    const newProduct = new Product(productData);
    await newProduct.save();
    
    // Obtener el producto con sus relaciones
    const populatedProduct = await Product.findById(newProduct._id)
      .populate({
        path: 'toppingGroups',
        match: { active: true },
        select: 'name description isMultipleChoice isRequired options basePrice subGroups'
      });
    
    // Emitir evento de actualización por WebSocket
    emitToBusiness(newProduct.businessId?.toString(), "products_update", { type: "created", product: populatedProduct });
    
    res.json(populatedProduct);
  } catch (error) {
    console.error("Error al crear producto:", error);
    res.status(500).json({ message: "Error al crear el producto" });
  }
});

// PUT a product
router.put("/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    const { name, description, price, category, image, toppingGroups, businessId } = req.body;
    
    console.log('Actualizando producto:', productId);
    console.log('Datos recibidos:', req.body);
    console.log('ToppingGroups recibidos:', toppingGroups);
    
    // Manejar businessId si viene como slug
    let finalBusinessId = businessId;
    if (businessId && typeof businessId === 'string' && !mongoose.Types.ObjectId.isValid(businessId)) {
      // Buscar el businessId real
      const business = await findBusinessByIdentifier(businessId);
      if (business) {
        finalBusinessId = business._id;
      }
    }
    
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { 
        name, 
        description, 
        price, 
        category, 
        image,
        businessId: finalBusinessId,
        // Asegúrate de que toppingGroups se actualice correctamente
        toppingGroups: toppingGroups || [] 
      },
      { new: true }  // Para que devuelva el documento actualizado
    ).populate({
      path: 'toppingGroups',
      match: { active: true },
      select: 'name description isMultipleChoice isRequired options basePrice subGroups'
    });
    
    console.log('Producto actualizado:', updatedProduct);
    
    res.json(updatedProduct);
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE a product
router.delete("/:id", async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    
    // Emitir evento de actualización por WebSocket
    if (deletedProduct) {
      emitToBusiness(deletedProduct.businessId?.toString(), "products_update", { type: "deleted", productId: deletedProduct._id });
    }
    
    res.json({ message: "Producto eliminado" });
  } catch (error) {
    console.error("Error al eliminar producto:", error);
    res.status(500).json({ message: "Error al eliminar el producto" });
  }
});

module.exports = router;
