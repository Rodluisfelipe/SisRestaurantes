const express = require('express');
const router = express.Router();
const Customer = require('../Models/Customer');
const { validateAndResolveBusinessId } = require('../utils/businessValidator');

// Middleware to validate and resolve business ID
const validateBusinessId = async (req, res, next) => {
  try {
    const { businessId } = req.query;
    console.log('validateBusinessId - Received businessId:', businessId);
    
    if (!businessId) {
      return res.status(400).json({ message: 'Business ID is required' });
    }
    
    const result = await validateAndResolveBusinessId(businessId);
    console.log('validateBusinessId - Result:', result);
    
    if (!result.success) {
      return res.status(404).json({ message: result.error });
    }
    
    req.businessId = result.businessId;
    req.business = result.business;
    console.log('validateBusinessId - Set req.businessId to:', req.businessId);
    next();
  } catch (error) {
    console.error('validateBusinessId - Error:', error);
    res.status(500).json({ message: 'Error validating business ID' });
  }
};

// Get all customers for a business
router.get('/', validateBusinessId, async (req, res) => {
  try {
    const { businessId } = req;
    const { 
      page = 1, 
      limit = 20, 
      sortBy = 'lastOrderDate', 
      sortOrder = 'desc',
      search = '',
      status = 'all'
    } = req.query;

    // Build query
    const query = { businessId };
    
    // Add search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Add status filter
    if (status !== 'all') {
      query.status = status;
    }

    // Build sort object
    const sortObj = {};
    if (sortBy === 'lastOrderDate') {
      sortObj['stats.lastOrderDate'] = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'totalOrders') {
      sortObj['stats.totalOrders'] = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'totalSpent') {
      sortObj['stats.totalSpent'] = sortOrder === 'desc' ? -1 : 1;
    } else {
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
    }

    // Execute query with pagination
    const customers = await Customer.find(query)
      .sort(sortObj)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('preferences.favoriteProducts.productId', 'name image')
      .lean();

    // Get total count for pagination
    const total = await Customer.countDocuments(query);

    // Calculate statistics
    const stats = await Customer.aggregate([
      { $match: { businessId } },
      {
        $group: {
          _id: null,
          totalCustomers: { $sum: 1 },
          totalOrders: { $sum: '$stats.totalOrders' },
          totalRevenue: { $sum: '$stats.totalSpent' },
          averageOrderValue: { $avg: '$stats.averageOrderValue' },
          vipCustomers: {
            $sum: { $cond: [{ $eq: ['$status', 'vip'] }, 1, 0] }
          }
        }
      }
    ]);

    res.json({
      customers,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      },
      stats: stats[0] || {
        totalCustomers: 0,
        totalOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        vipCustomers: 0
      }
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ message: 'Error al obtener los clientes' });
  }
});

// Get customer by ID
router.get('/:id', validateBusinessId, async (req, res) => {
  try {
    const { businessId } = req;
    const customer = await Customer.findOne({ 
      _id: req.params.id, 
      businessId 
    }).populate('preferences.favoriteProducts.productId', 'name image price');

    if (!customer) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    res.json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ message: 'Error al obtener el cliente' });
  }
});

// Create or update customer
router.post('/', validateBusinessId, async (req, res) => {
  try {
    const { businessId } = req;
    const { phone, name, email, notes } = req.body;

    // Check if customer already exists
    let customer = await Customer.findOne({ phone, businessId });

    if (customer) {
      // Update existing customer
      customer.name = name || customer.name;
      customer.email = email || customer.email;
      customer.preferences.notes = notes || customer.preferences.notes;
      await customer.save();
    } else {
      // Create new customer
      customer = new Customer({
        businessId,
        phone,
        name,
        email,
        preferences: {
          notes: notes || ''
        }
      });
      await customer.save();
    }

    res.json(customer);
  } catch (error) {
    console.error('Error creating/updating customer:', error);
    res.status(500).json({ message: 'Error al crear/actualizar el cliente' });
  }
});

// Update customer
router.put('/:id', validateBusinessId, async (req, res) => {
  try {
    const { businessId } = req;
    const { name, email, notes, status } = req.body;

    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, businessId },
      {
        name,
        email,
        'preferences.notes': notes,
        status,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!customer) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    res.json(customer);
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ message: 'Error al actualizar el cliente' });
  }
});

// Delete customer
router.delete('/:id', validateBusinessId, async (req, res) => {
  try {
    const { businessId } = req;
    const customer = await Customer.findOneAndDelete({ 
      _id: req.params.id, 
      businessId 
    });

    if (!customer) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    res.json({ message: 'Cliente eliminado exitosamente' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ message: 'Error al eliminar el cliente' });
  }
});

// Get customer statistics
router.get('/stats/overview', validateBusinessId, async (req, res) => {
  try {
    const { businessId } = req;

    const stats = await Customer.aggregate([
      { $match: { businessId } },
      {
        $group: {
          _id: null,
          totalCustomers: { $sum: 1 },
          totalOrders: { $sum: '$stats.totalOrders' },
          totalRevenue: { $sum: '$stats.totalSpent' },
          averageOrderValue: { $avg: '$stats.averageOrderValue' },
          vipCustomers: {
            $sum: { $cond: [{ $eq: ['$status', 'vip'] }, 1, 0] }
          },
          activeCustomers: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          }
        }
      }
    ]);

    // Get recent customers (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentCustomers = await Customer.countDocuments({
      businessId,
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Get top customers by spending
    const topCustomers = await Customer.find({ businessId })
      .sort({ 'stats.totalSpent': -1 })
      .limit(5)
      .select('name phone stats.totalSpent stats.totalOrders')
      .lean();

    res.json({
      ...stats[0],
      recentCustomers,
      topCustomers
    });
  } catch (error) {
    console.error('Error fetching customer stats:', error);
    res.status(500).json({ message: 'Error al obtener estadísticas' });
  }
});

module.exports = router;
