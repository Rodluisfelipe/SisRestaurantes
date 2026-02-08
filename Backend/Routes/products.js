const express = require("express");
const router = express.Router();
const Product = require("../Models/Product");
const { emitToBusiness } = require("../services/socketService");
const mongoose = require("mongoose");
const { validateAndResolveBusinessId, createBusinessFilter } = require("../utils/businessValidator");
const { resolveBusinessId } = require("../utils/businessResolver");
const logger = require("../utils/logger");
const { formatHttpError } = require("../utils/errorFormatter");
const { tenantAuth } = require("../middleware/tenantAuth");

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

// GET featured products (productos destacados) - DEBE estar ANTES de /:id
router.get("/featured", async (req, res) => {
  try {
    let { businessId } = req.query;
    
    if (!businessId) {
      return res.status(400).json(formatHttpError(req, "businessId es requerido", 400));
    }

    businessId = await resolveBusinessId(businessId);

    const featuredProducts = await Product.find({ 
      businessId,
      isFeatured: true,
      active: true
    })
    .populate({
      path: 'toppingGroups',
      match: { active: true },
      select: 'name description isMultipleChoice isRequired options basePrice subGroups'
    })
    .sort({ featuredOrder: 1, displayOrder: 1 });

    logger.info(`Found ${featuredProducts.length} featured products for business ${businessId}`);
    res.json(featuredProducts);
  } catch (error) {
    logger.error("Error getting featured products", error, req);
    res.status(500).json(formatHttpError(req, "Error al obtener productos destacados", 500));
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
    logger.error("Error al obtener producto", error, req);
    res.status(500).json(formatHttpError(req, error.message || "Error al obtener producto", 500));
  }
});

// Validación de entrada para crear/actualizar producto
const validateProductInput = (req, res, next) => {
  const errors = [];
  let { name, price, businessId } = req.body;
  
  // Validar name
  if (!name) {
    errors.push({ field: 'name', message: 'name es requerido' });
  } else if (typeof name !== 'string' || name.trim().length === 0) {
    errors.push({ field: 'name', message: 'name debe ser un string no vacío' });
  }
  
  // Validar y convertir price (puede venir como string desde FormData)
  if (price === undefined || price === null) {
    errors.push({ field: 'price', message: 'price es requerido' });
  } else {
    // Convertir a número si viene como string (FormData)
    if (typeof price === 'string') {
      price = parseFloat(price);
      req.body.price = price; // Actualizar el valor en req.body
    }
    
    if (typeof price !== 'number' || isNaN(price) || price < 0) {
      errors.push({ field: 'price', message: 'price debe ser un número >= 0' });
    }
  }
  
  // Validar businessId (solo para POST, en PUT se valida en el endpoint)
  if (req.method === 'POST') {
    if (!businessId) {
      errors.push({ field: 'businessId', message: 'businessId es requerido' });
    } else if (typeof businessId !== 'string') {
      errors.push({ field: 'businessId', message: 'businessId debe ser un string' });
    }
  }
  
  if (errors.length > 0) {
    return res.status(400).json(
      formatHttpError(req, 'Errores de validación en la entrada', 400, errors)
    );
  }
  
  next();
};

// POST a product
router.post("/", tenantAuth, validateProductInput, async (req, res) => {
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
      try {
        productData.businessId = await resolveBusinessId(productData.businessId);
      } catch (error) {
        return res.status(404).json(
          formatHttpError(req, 'Business not found', 404, { detail: error.message })
        );
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
    
    logger.info(`Created new product: ${newProduct.name} for business ${productData.businessId}`);
    res.json(populatedProduct);
  } catch (error) {
    logger.error("Error creating product", error, req);
    res.status(500).json(formatHttpError(req, "Error creating product", 500));
  }
});

// Test endpoint without middleware
router.put("/reorder-simple", tenantAuth, async (req, res) => {
  logger.debug("Simple test endpoint hit", { timestamp: new Date().toISOString() }, req);
  res.json({ success: true, message: "Simple endpoint working", timestamp: new Date().toISOString() });
});

// Reorder products (working endpoint)
router.put("/products-reorder", tenantAuth, async (req, res) => {
  logger.debug("PRODUCTS-REORDER ENDPOINT CALLED", { timestamp: new Date().toISOString() }, req);
  
  try {
    const { businessId, products } = req.body;
    
    if (!businessId) {
      return res.status(400).json({ message: "businessId es requerido" });
    }
    
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ message: "Formato inválido para products" });
    }
    
    logger.debug("Reordenando productos", { businessId, productsCount: products.length }, req);
    
    // Usar bulkWrite para actualizar todos los productos de una vez (más eficiente)
    const bulkOps = products.map(productData => ({
      updateOne: {
        filter: { _id: productData._id },
        update: { displayOrder: productData.order }
      }
    }));
    
    const result = await Product.bulkWrite(bulkOps);
    logger.debug("Bulk update result", { modifiedCount: result.modifiedCount }, req);
    
    // Emitir evento de actualización
    emitToBusiness(businessId, "products_update", { 
      type: "reordered", 
      businessId,
      message: "Orden de productos actualizado" 
    });
    
    res.json({ success: true, message: "Orden de productos actualizado correctamente" });
  } catch (error) {
    logger.error("Error al reordenar productos", error, req);
    res.status(500).json(formatHttpError(req, "Error al reordenar los productos", 500));
  }
});

// Reorder products
router.put("/reorder", tenantAuth, async (req, res) => {
  logger.debug("REORDER ENDPOINT CALLED", { timestamp: new Date().toISOString() }, req);
  
  try {
    res.json({ success: true, message: "Endpoint simplificado funcionando" });
  } catch (error) {
    logger.error("Error en endpoint simplificado", error, req);
    res.status(500).json(formatHttpError(req, "Error en endpoint simplificado", 500));
  }
});

// PUT reorder featured products
router.put("/reorder-featured", tenantAuth, async (req, res) => {
  try {
    logger.info('Reorder featured products endpoint called', { body: req.body });
    const { orderedIds } = req.body;

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      logger.warn('Invalid orderedIds', { orderedIds, type: typeof orderedIds });
      return res.status(400).json(formatHttpError(req, "orderedIds debe ser un array no vacío", 400));
    }

    // Actualizar el featuredOrder de cada producto
    const updatePromises = orderedIds.map((id, index) => 
      Product.findByIdAndUpdate(id, { featuredOrder: index + 1 })
    );

    await Promise.all(updatePromises);

    logger.info(`Reordered ${orderedIds.length} featured products`);

    // Obtener businessId del primer producto para el socket
    const firstProduct = await Product.findById(orderedIds[0]);
    if (firstProduct) {
      emitToBusiness(firstProduct.businessId?.toString(), "products_reordered", {
        type: "featured_reordered",
        count: orderedIds.length
      });
    }

    res.json({
      success: true,
      message: `${orderedIds.length} productos destacados reordenados correctamente`
    });
  } catch (error) {
    logger.error("Error reordering featured products", error, req);
    res.status(500).json(formatHttpError(req, "Error al reordenar productos destacados", 500));
  }
});

// PUT toggle featured status (DEBE estar ANTES de /:id genérico)
router.put("/:id/toggle-featured", tenantAuth, async (req, res) => {




  try {
    const { id } = req.params;
    const { featuredOrder } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(formatHttpError(req, "ID de producto inválido", 400));
    }


    const product = await Product.findById(id);

    if (!product) {

      return res.status(404).json(formatHttpError(req, "Producto no encontrado", 404));
    }


    // Si está activando featured, verificar límite de 5
    if (!product.isFeatured) {

      const featuredCount = await Product.countDocuments({
        businessId: product.businessId,
        isFeatured: true,
        _id: { $ne: product._id }
      });


      if (featuredCount >= 5) {

        return res.status(400).json({
          success: false,
          message: 'No puedes tener más de 5 productos destacados. Remueve uno primero.',
          limit: 5,
          current: featuredCount
        });
      }
    }


    product.isFeatured = !product.isFeatured;
    
    // Si se está marcando como destacado y no tiene orden, asignar el siguiente
    if (product.isFeatured) {

      if (featuredOrder !== undefined) {
        product.featuredOrder = featuredOrder;
      } else if (!product.featuredOrder || product.featuredOrder === 0) {
        // Buscar el orden más alto actual
        const maxOrder = await Product.findOne({
          businessId: product.businessId,
          isFeatured: true,
          _id: { $ne: product._id }
        }).sort('-featuredOrder').select('featuredOrder');
        product.featuredOrder = maxOrder && maxOrder.featuredOrder ? maxOrder.featuredOrder + 1 : 1;

      }
    } else {
      // Si se está quitando de destacados, limpiar el orden
      product.featuredOrder = 0;

    }


    
    // Usar updateOne directamente para forzar la actualización de campos que no existen
    const updateResult = await Product.updateOne(
      { _id: id },
      { 
        $set: { 
          isFeatured: product.isFeatured, 
          featuredOrder: product.featuredOrder 
        } 
      }
    );
    

    
    // Recargar el producto para obtener los valores actualizados
    const updatedProduct = await Product.findById(id);



    
    // Actualizar el objeto product con los valores confirmados
    product.isFeatured = updatedProduct.isFeatured;
    product.featuredOrder = updatedProduct.featuredOrder;

    logger.info(`Product ${id} featured status toggled to ${product.isFeatured}`);

    // Emit update
    emitToBusiness(req, product.businessId, "product_featured_update", {
      type: "featured_toggled",
      productId: product._id,
      isFeatured: product.isFeatured
    });


    res.json({
      success: true,
      message: `Producto ${product.isFeatured ? 'marcado como destacado' : 'removido de destacados'}`,
      product: {
        _id: product._id,
        name: product.name,
        isFeatured: product.isFeatured,
        featuredOrder: product.featuredOrder
      }
    });

  } catch (error) {
    console.error('❌❌❌ ERROR EN TOGGLE FEATURED:', error);
    console.error('Stack trace:', error.stack);
    logger.error("Error toggling featured status", error, req);
    res.status(500).json(formatHttpError(req, "Error al cambiar estado destacado", 500));
  }
});

// PUT a product
router.put("/:id", tenantAuth, validateProductInput, async (req, res) => {
  try {
    const productId = req.params.id;
    const { name, description, price, category, image, toppingGroups, businessId } = req.body;
    
    logger.debug('Actualizando producto', { productId, toppingGroupsCount: toppingGroups?.length }, req);
    
    // Validar businessId en PUT
    if (!businessId) {
      return res.status(400).json(
        formatHttpError(req, 'Errores de validación en la entrada', 400, [
          { field: 'businessId', message: 'businessId es requerido' }
        ])
      );
    }
    
    // Manejar businessId si viene como slug usando la utilidad centralizada
    let finalBusinessId = businessId;
    if (businessId && typeof businessId === 'string') {
      try {
        finalBusinessId = await resolveBusinessId(businessId);
      } catch (error) {
        return res.status(400).json(
          formatHttpError(req, 'Errores de validación en la entrada', 400, [
            { field: 'businessId', message: error.message }
          ])
        );
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

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, businessId: finalBusinessId },
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
      { new: true }
    ).populate({
      path: 'toppingGroups',
      match: { active: true },
      select: 'name description isMultipleChoice isRequired options basePrice subGroups'
    });
    
    logger.info('Producto actualizado', { productId: updatedProduct._id.toString() }, req);
    
    res.json(updatedProduct);
  } catch (error) {
    logger.error('Error al actualizar producto', error, req);
    res.status(500).json(formatHttpError(req, error.message || "Error al actualizar producto", 500));
  }
});

// DELETE a product
router.delete("/:id", tenantAuth, async (req, res) => {
  try {
    const { businessId } = req.query;
    let resolvedBusinessId;
    try {
      resolvedBusinessId = await resolveBusinessId(businessId);
    } catch (error) {
      return res.status(404).json(formatHttpError(req, error.message, 404));
    }
    const deletedProduct = await Product.findOneAndDelete({ _id: req.params.id, businessId: resolvedBusinessId });
    
    // Emitir evento de actualización por WebSocket
    if (deletedProduct) {
      emitToBusiness(deletedProduct.businessId?.toString(), "products_update", { type: "deleted", productId: deletedProduct._id });
    }
    
    res.json({ message: "Producto eliminado" });
  } catch (error) {
    logger.error("Error al eliminar producto", error, req);
    res.status(500).json(formatHttpError(req, "Error al eliminar el producto", 500));
  }
});

// Toggle active status of a product
router.patch("/:id/toggle", tenantAuth, async (req, res) => {
  try {
    const productId = req.params.id;
    
    logger.debug("Toggling product", { productId }, req);
    
    // Encontrar el producto
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }
    
    // Toggle del estado activo
    product.active = !product.active;
    await product.save();
    
    logger.info(`Product toggled`, { productId: product._id.toString(), name: product.name, active: product.active }, req);
    
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
    logger.error("Error toggling product", error, req);
    res.status(500).json(formatHttpError(req, "Error al cambiar el estado del producto", 500));
  }
});

module.exports = router;
