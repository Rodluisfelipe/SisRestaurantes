const express = require("express");
const router = express.Router();
const Product = require("../Models/Product");
const { emitToBusiness } = require("../services/socketService");
const mongoose = require("mongoose");
const { validateAndResolveBusinessId, createBusinessFilter } = require("../utils/businessValidator");
const logger = require("../utils/logger");

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
  logger.debug('Getting all products with relations');
  const products = await Product.find()
    .populate({
      path: 'toppingGroups',
      match: { active: true },
      select: 'name description isMultipleChoice isRequired options basePrice subGroups'
    });
  
  logger.debug(`Found ${products.length} products`);
  return products;
};

// Función para emitir actualización de productos
const emitProductsUpdate = async (req) => {
  try {
    const products = await getAllProducts();
    logger.info(`Emitting products update (${products.length} products)`);
    req.emitEvent('products_update', products);
  } catch (error) {
    logger.error('Error emitting products update', error);
  }
};

// GET all products
router.get("/", async (req, res) => {
  try {
    let { businessId } = req.query;
    
    // Crear filtro basado en businessId o slug
    const filter = await createBusinessFilter(businessId);
    
    logger.debug('Searching products with filter', filter);
    
    const products = await Product.find(filter)
      .populate({
        path: 'toppingGroups',
        match: { active: true },
        select: 'name description isMultipleChoice isRequired options basePrice subGroups'
      })
      .sort({ displayOrder: 1, createdAt: 1 });
    
    logger.info(`Found ${products.length} products for business ${businessId}`);
    res.json(products);
  } catch (error) {
    logger.error("Error getting products", error);
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
    
    // Procesar el orden de los toppings si viene en el request
    if (productData.toppingGroups && Array.isArray(productData.toppingGroups)) {
      productData.toppingGroupsOrder = productData.toppingGroups.map((toppingId, index) => ({
        toppingGroupId: toppingId,
        order: index
      }));
    }
    
    // Manejar businessId si viene como slug usando la utilidad centralizada
    if (productData.businessId && typeof productData.businessId === 'string') {
      const businessResult = await validateAndResolveBusinessId(productData.businessId);
      if (!businessResult.success) {
        return res.status(404).json({ 
          message: 'Business not found',
          detail: businessResult.error
        });
      }
      productData.businessId = businessResult.businessId;
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
    
    logger.info(`Created new product: ${newProduct.name} for business ${productData.businessId}`);
    res.json(populatedProduct);
  } catch (error) {
    logger.error("Error creating product", error);
    res.status(500).json({ message: "Error creating product" });
  }
});

// Test endpoint without middleware
router.put("/reorder-simple", async (req, res) => {
  console.log(`[Products] Simple test endpoint hit - ${new Date().toISOString()}`);
  res.json({ success: true, message: "Simple endpoint working", timestamp: new Date().toISOString() });
});

// Reorder products (working endpoint)
router.put("/products-reorder", async (req, res) => {
  console.log(`[Products] PRODUCTS-REORDER ENDPOINT CALLED - ${new Date().toISOString()}`);
  
  try {
    const { businessId, products } = req.body;
    
    if (!businessId) {
      return res.status(400).json({ message: "businessId es requerido" });
    }
    
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ message: "Formato inválido para products" });
    }
    
    console.log(`[Products] Reordenando productos para negocio ${businessId}:`, products.length);
    
    // Usar bulkWrite para actualizar todos los productos de una vez (más eficiente)
    const bulkOps = products.map(productData => ({
      updateOne: {
        filter: { _id: productData._id },
        update: { displayOrder: productData.order }
      }
    }));
    
    const result = await Product.bulkWrite(bulkOps);
    console.log(`[Products] Bulk update result:`, result);
    
    // Emitir evento de actualización
    emitToBusiness(businessId, "products_update", { 
      type: "reordered", 
      businessId,
      message: "Orden de productos actualizado" 
    });
    
    res.json({ success: true, message: "Orden de productos actualizado correctamente" });
  } catch (error) {
    console.error("[Products] Error al reordenar productos:", error);
    res.status(500).json({ message: "Error al reordenar los productos", error: error.message });
  }
});

// Reorder products
router.put("/reorder", async (req, res) => {
  console.log(`[Products] REORDER ENDPOINT CALLED - ${new Date().toISOString()}`);
  console.log(`[Products] Request body:`, req.body);
  
  try {
    res.json({ success: true, message: "Endpoint simplificado funcionando", body: req.body });
  } catch (error) {
    console.error("[Products] Error en endpoint simplificado:", error);
    res.status(500).json({ message: "Error en endpoint simplificado", error: error.message });
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
    
    // Manejar businessId si viene como slug usando la utilidad centralizada
    let finalBusinessId = businessId;
    if (businessId && typeof businessId === 'string') {
      const businessResult = await validateAndResolveBusinessId(businessId);
      if (businessResult.success) {
        finalBusinessId = businessResult.businessId;
      }
    }
    
    // Procesar el orden de los toppings
    let toppingGroupsOrder = [];
    if (toppingGroups && Array.isArray(toppingGroups)) {
      toppingGroupsOrder = toppingGroups.map((toppingId, index) => ({
        toppingGroupId: toppingId,
        order: index
      }));
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
        toppingGroups: toppingGroups || [],
        toppingGroupsOrder: toppingGroupsOrder
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

// Toggle active status of a product
router.patch("/:id/toggle", async (req, res) => {
  try {
    const productId = req.params.id;
    
    console.log(`[Products] Toggling product ${productId}`);
    
    // Encontrar el producto
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }
    
    // Toggle del estado activo
    product.active = !product.active;
    await product.save();
    
    console.log(`[Products] Product ${product.name} toggled to ${product.active}`);
    
    // Emitir evento de actualización por WebSocket
    emitToBusiness(product.businessId?.toString(), "products_update", { 
      type: "toggled", 
      productId: product._id,
      active: product.active
    });
    
    res.json({ 
      success: true, 
      message: `Producto ${product.active ? 'activado' : 'desactivado'} correctamente`,
      product: {
        _id: product._id,
        name: product.name,
        active: product.active
      }
    });
  } catch (error) {
    console.error("Error toggling product:", error);
    res.status(500).json({ message: "Error al cambiar el estado del producto" });
  }
});

module.exports = router;
