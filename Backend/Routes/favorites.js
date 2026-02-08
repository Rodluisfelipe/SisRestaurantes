const express = require('express');
const router = express.Router();
const Favorite = require('../Models/Favorite');
const Customer = require('../Models/Customer');
const Product = require('../Models/Product');
const { isValidObjectId } = require('../utils/validators');
const logger = require('../utils/logger');
const { formatHttpError } = require('../utils/errorFormatter');

/**
 * GET /api/favorites
 * Get all favorites for a customer
 * Query params: phone, businessId
 */
router.get('/', async (req, res) => {
  try {
    const { phone, businessId } = req.query;

    if (!phone || !businessId) {
      return res.status(400).json(formatHttpError(req, 'phone and businessId are required', 400));
    }

    const favorites = await Favorite.find({ phone, businessId })
      .populate('productId', 'name price image available')
      .sort({ lastOrderedAt: -1, createdAt: -1 });

    res.json({
      success: true,
      favorites
    });
  } catch (error) {
    logger.error('Error fetching favorites', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener favoritos', 500));
  }
});

/**
 * POST /api/favorites
 * Add a product to favorites
 * Body: { phone, businessId, productId, productName, productPrice, productImage, selectedToppings, selectedOptions, notes }
 */
router.post('/', async (req, res) => {
  try {
    const {
      phone,
      businessId,
      productId,
      productName,
      productPrice,
      productImage,
      selectedToppings = [],
      selectedOptions = [],
      notes = ''
    } = req.body;

    // Validations
    if (!phone || !businessId || !productId || !productName || productPrice === undefined) {
      return res.status(400).json(formatHttpError(req, 'Missing required fields', 400));
    }

    if (!isValidObjectId(businessId) || !isValidObjectId(productId)) {
      return res.status(400).json(formatHttpError(req, 'Invalid businessId or productId', 400));
    }

    // Verify product exists and is available
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json(formatHttpError(req, 'Product not found', 404));
    }

    if (!product.active) {
      return res.status(400).json(formatHttpError(req, 'Product is not available', 400));
    }

    // Find or create customer
    let customer = await Customer.findOne({ phone, businessId });
    if (!customer) {
      customer = await Customer.create({
        businessId,
        phone,
        name: 'Cliente' // Default name, can be updated later
      });
    }

    // Check if this exact configuration is already a favorite
    const existingFavorite = await Favorite.findOne({
      customerId: customer._id,
      businessId,
      productId,
      selectedToppings,
      selectedOptions
    });

    if (existingFavorite) {
      return res.status(400).json(formatHttpError(req, 'This configuration is already in favorites', 400));
    }

    // Create favorite
    const favorite = await Favorite.create({
      businessId,
      customerId: customer._id,
      phone,
      productId,
      productName,
      productPrice,
      productImage: productImage || product.image || '',
      selectedToppings,
      selectedOptions,
      notes
    });

    await favorite.populate('productId', 'name price image available');

    logger.info('Favorite created', { favoriteId: favorite._id, phone, productId }, req);

    res.status(201).json({
      success: true,
      message: 'Favorito agregado exitosamente',
      favorite
    });
  } catch (error) {
    logger.error('Error creating favorite', error, req);
    res.status(500).json(formatHttpError(req, 'Error al agregar favorito', 500));
  }
});

/**
 * DELETE /api/favorites/:id
 * Remove a favorite
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { phone, businessId } = req.query;

    if (!isValidObjectId(id)) {
      return res.status(400).json(formatHttpError(req, 'Invalid favorite ID', 400));
    }

    if (!phone || !businessId) {
      return res.status(400).json(formatHttpError(req, 'phone and businessId are required', 400));
    }

    // Ensure the favorite belongs to the customer
    const favorite = await Favorite.findOne({ _id: id, phone, businessId });
    
    if (!favorite) {
      return res.status(404).json(formatHttpError(req, 'Favorite not found', 404));
    }

    await Favorite.findByIdAndDelete(id);

    logger.info('Favorite deleted', { favoriteId: id, phone }, req);

    res.json({
      success: true,
      message: 'Favorito eliminado exitosamente'
    });
  } catch (error) {
    logger.error('Error deleting favorite', error, req);
    res.status(500).json(formatHttpError(req, 'Error al eliminar favorito', 500));
  }
});

/**
 * POST /api/favorites/:id/order
 * Record that a favorite was ordered
 */
router.post('/:id/order', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json(formatHttpError(req, 'Invalid favorite ID', 400));
    }

    const favorite = await Favorite.findById(id);
    
    if (!favorite) {
      return res.status(404).json(formatHttpError(req, 'Favorite not found', 404));
    }

    await favorite.recordOrder();

    res.json({
      success: true,
      message: 'Order recorded for favorite'
    });
  } catch (error) {
    logger.error('Error recording favorite order', error, req);
    res.status(500).json(formatHttpError(req, 'Error al registrar pedido de favorito', 500));
  }
});

module.exports = router;
