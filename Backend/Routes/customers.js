const express = require('express');
const router = express.Router();
const Customer = require('../Models/Customer');
const Order = require('../Models/Order');
const { validateAndResolveBusinessId } = require('../utils/businessValidator');
const { isValidObjectId } = require('../utils/isValidObjectId');
const { tenantAuth } = require('../middleware/tenantAuth');
const authMiddleware = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
const {
  validateCreateCustomer,
  validateUpdateCustomer,
  validateUpdateAddress,
  validateUpdateSettings,
  validateDeleteCustomer,
  validateDeleteCustomerById,
} = require('../middleware/validators/customerValidators');

// Rate limiter for public customer endpoints
const customerRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: { error: 'Demasiadas solicitudes. Intente nuevamente mÃ¡s tarde.' }
});

// GET /api/customers - Listar clientes con filtros (admin only â€” tenant isolated)
router.get('/', tenantAuth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      status = 'all',
      sortBy = 'lastOrderDate',
      sortOrder = 'desc'
    } = req.query;

    // Use tenant-validated businessId from middleware, with fallback for superadmin
    const resolvedBusinessId = req.user.businessId || req.query.businessId;



    // Construir filtro
    const filter = {
      businessId: resolvedBusinessId
    };



    // Filtro por estado
    if (status !== 'all') {
      filter.status = status;
    }

    // Filtro por bÃºsqueda (escapar regex para prevenir ReDoS)
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { phone: { $regex: escapedSearch, $options: 'i' } },
        { email: { $regex: escapedSearch, $options: 'i' } }
      ];
    }

    // Construir sort
    const sort = {};
    if (sortBy === 'lastOrderDate') {
      sort.lastOrderDate = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'name') {
      sort.name = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'totalSpent') {
      sort.totalSpent = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'totalOrders') {
      sort.totalOrders = sortOrder === 'desc' ? -1 : 1;
    } else {
      sort.createdAt = -1; // Default sort
    }



    // Obtener clientes con paginaciÃ³n
    const customers = await Customer.find(filter)
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    const totalCustomers = await Customer.countDocuments(filter);



    // Calcular estadÃ­sticas usando MongoDB aggregation (evita cargar todos los docs en memoria)
    const [statsResult] = await Customer.aggregate([
      { $match: { businessId: filter.businessId } },
      { $group: {
        _id: null,
        totalRevenue: { $sum: { $ifNull: ['$totalSpent', 0] } },
        totalOrdersSum: { $sum: { $ifNull: ['$totalOrders', 0] } },
        count: { $sum: 1 },
        vipCustomers: { $sum: { $cond: [{ $gte: [{ $ifNull: ['$totalOrders', 0] }, 10] }, 1, 0] } }
      }}
    ]);

    const stats = {
      totalCustomers: totalCustomers,
      vipCustomers: statsResult?.vipCustomers || 0,
      totalRevenue: statsResult?.totalRevenue || 0,
      averageOrders: statsResult?.count > 0 
        ? (statsResult.totalOrdersSum / statsResult.count).toFixed(1) 
        : 0
    };

    res.json({
      customers,
      stats,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(totalCustomers / parseInt(limit)),
        limit: parseInt(limit),
        totalCustomers
      }
    });
  } catch (error) {
    logger.error('[Customers] Error al obtener clientes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/customers/:phone - Actualizar datos del cliente
router.put('/:phone', tenantAuth, validateUpdateCustomer, async (req, res) => {
  try {
    const { phone } = req.params;
    const { businessId } = req.query;
    const updateData = { ...req.body };

    // Remover campos que no se deben actualizar directamente
    delete updateData.businessId;
    delete updateData.phone;
    delete updateData.totalOrders;
    delete updateData.totalSpent;
    delete updateData.lastOrderDate;

    if (!phone) {
      return res.status(400).json({ error: 'NÃºmero de telÃ©fono requerido' });
    }

    const customer = await Customer.findOneAndUpdate(
      { 
        businessId: isValidObjectId(businessId) ? businessId : null, 
        phone 
      },
      updateData,
      { new: true, runValidators: true }
    );

    if (!customer) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json(customer);
  } catch (error) {
    logger.error('Error al actualizar cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/customers - Crear o encontrar cliente (public, rate limited)
router.post('/', customerRateLimiter, validateCreateCustomer, async (req, res) => {
  try {
    const { businessId } = req.query;
    // Whitelist allowed fields â€” prevent stat manipulation (totalOrders, totalSpent, status)
    const { phone, name, address, email } = req.body;

    if (!phone || !name) {
      return res.status(400).json({ error: 'TelÃ©fono y nombre son requeridos' });
    }

    // Validate businessId exists
    if (!businessId || !isValidObjectId(businessId)) {
      return res.status(400).json({ error: 'businessId vÃ¡lido es requerido' });
    }
    const BusinessConfig = require('../Models/BusinessConfig');
    const businessExists = await BusinessConfig.exists({ _id: businessId });
    if (!businessExists) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }

    // Buscar cliente existente
    let customer = await Customer.findOne({ 
      businessId: isValidObjectId(businessId) ? businessId : null, 
      phone 
    });

    if (customer) {
      // Si existe, actualizar solo campos permitidos
      if (name) customer.name = name;
      if (address) customer.address = address;
      if (email) customer.email = email;
      await customer.save();
    } else {
      // Si no existe, crear nuevo cliente con campos permitidos solamente
      customer = new Customer({
        businessId: isValidObjectId(businessId) ? businessId : null,
        phone,
        name,
        ...(address && { address }),
        ...(email && { email })
      });
      await customer.save();
    }

    res.status(201).json(customer);
  } catch (error) {
    logger.error('Error al crear/actualizar cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/customers/:phone/orders - Obtener pedidos del cliente (rate limited)
router.get('/:phone/orders', customerRateLimiter, async (req, res) => {
  try {
    const { phone } = req.params;
    const { businessId } = req.query;
    const { limit = 10, page = 1, status } = req.query;

    if (!phone) {
      return res.status(400).json({ error: 'NÃºmero de telÃ©fono requerido' });
    }

    // Verificar que el cliente existe
    const customer = await Customer.findOne({ 
      businessId: isValidObjectId(businessId) ? businessId : null, 
      phone 
    });

    if (!customer) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Construir filtro para pedidos
    const orderFilter = {
      businessId: isValidObjectId(businessId) ? businessId : null,
      phone: phone
    };

    // Obtener pedidos activos + completados
    const CompletedOrder = require('../Models/CompletedOrder');
    
    const completedFilter = {
      businessId: isValidObjectId(businessId) ? businessId : null,
      phone: phone
    };
    if (status) {
      orderFilter.status = status;
      completedFilter.status = status;
    }

    const [activeOrders, completedOrders] = await Promise.all([
      Order.find(orderFilter).sort({ createdAt: -1 }).limit(parseInt(limit)).lean(),
      CompletedOrder.find(completedFilter).sort({ completedAt: -1 }).limit(parseInt(limit)).lean()
    ]);

    // Merge and sort by date (newest first)
    const orders = [...activeOrders, ...completedOrders]
      .sort((a, b) => new Date(b.createdAt || b.completedAt) - new Date(a.createdAt || a.completedAt))
      .slice(0, parseInt(limit));

    const totalOrders = await Order.countDocuments(orderFilter) + await CompletedOrder.countDocuments(completedFilter);

    res.json({
      orders,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(totalOrders / parseInt(limit)),
        limit: parseInt(limit),
        totalOrders
      }
    });
  } catch (error) {
    logger.error('Error al obtener pedidos del cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PATCH /api/customers/:phone/address - Actualizar nombre/direcciÃ³n (rate limited)
router.patch('/:phone/address', customerRateLimiter, validateUpdateAddress, async (req, res) => {
  try {
    const { phone } = req.params;
    const { businessId } = req.query;
    const { name, address } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'NÃºmero de telÃ©fono requerido' });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (address) updateData.address = address;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    const customer = await Customer.findOneAndUpdate(
      { 
        businessId: isValidObjectId(businessId) ? businessId : null, 
        phone 
      },
      updateData,
      { new: true, runValidators: true }
    );

    if (!customer) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json(customer);
  } catch (error) {
    logger.error('Error al actualizar direcciÃ³n del cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/customers/:phone/settings - Actualizar configuraciones del cliente (rate limited)
router.put('/:phone/settings', customerRateLimiter, validateUpdateSettings, async (req, res) => {
  try {
    const { phone } = req.params;
    const { businessId } = req.query;
    const { notifications, settings } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'NÃºmero de telÃ©fono requerido' });
    }

    const updateData = {};
    if (notifications) updateData.notifications = notifications;
    if (settings) updateData.settings = settings;

    const customer = await Customer.findOneAndUpdate(
      { 
        businessId: isValidObjectId(businessId) ? businessId : null, 
        phone 
      },
      updateData,
      { new: true, runValidators: true }
    );

    if (!customer) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json(customer);
  } catch (error) {
    logger.error('Error al actualizar configuraciones del cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/customers/:phone - Eliminar cliente
router.delete('/:phone', tenantAuth, validateDeleteCustomer, async (req, res) => {
  try {
    const { phone } = req.params;

    if (!phone) {
      return res.status(400).json({ error: 'NÃºmero de telÃ©fono requerido' });
    }

    // Use businessId from token for tenant isolation, with fallback for superadmin
    const customer = await Customer.findOneAndDelete({ 
      businessId: req.user.businessId || req.query.businessId, 
      phone 
    });

    if (!customer) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json({ message: 'Cliente eliminado exitosamente' });
  } catch (error) {
    logger.error('Error al eliminar cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/customers/by-id/:id - Eliminar cliente por ID
router.delete('/by-id/:id', tenantAuth, validateDeleteCustomerById, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'ID del cliente requerido' });
    }

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'ID del cliente invÃ¡lido' });
    }

    // Use businessId from token for tenant isolation, with fallback for superadmin
    const customer = await Customer.findOneAndDelete({ 
      _id: id,
      businessId: req.user.businessId || req.query.businessId
    });

    if (!customer) {

      return res.status(404).json({ error: 'Cliente no encontrado' });
    }


    res.json({ message: 'Cliente eliminado exitosamente' });
  } catch (error) {
    logger.error('[Customers] Error al eliminar cliente por ID:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/customers/:phone - Obtener datos del cliente por telÃ©fono (rate limited) - MUST BE LAST
router.get('/:phone', customerRateLimiter, async (req, res) => {
  try {
    const { phone } = req.params;
    const { businessId } = req.query;

    if (!phone) {
      return res.status(400).json({ error: 'NÃºmero de telÃ©fono requerido' });
    }

    // businessId is mandatory â€” prevents enumeration of customers across businesses
    if (!businessId || !isValidObjectId(businessId)) {
      return res.status(400).json({ error: 'businessId es requerido' });
    }

    const customer = await Customer.findOne({ 
      businessId, 
      phone 
    });

    if (!customer) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json(customer);
  } catch (error) {
    logger.error('Error al obtener cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
