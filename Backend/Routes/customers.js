const express = require('express');
const router = express.Router();
const Customer = require('../Models/Customer');
const Order = require('../Models/Order');
const { validateAndResolveBusinessId } = require('../utils/businessValidator');
const { isValidObjectId } = require('../utils/isValidObjectId');
const { tenantAuth } = require('../middleware/tenantAuth');

// GET /api/customers - Listar clientes con filtros
router.get('/', async (req, res) => {
  try {
    const { 
      businessId, 
      page = 1, 
      limit = 20, 
      search = '', 
      status = 'all',
      sortBy = 'lastOrderDate',
      sortOrder = 'desc'
    } = req.query;




    // Construir filtro
    const filter = {
      businessId: isValidObjectId(businessId) ? businessId : null
    };



    // Si businessId no es un ObjectId válido, intentar resolverlo como slug
    if (!isValidObjectId(businessId)) {

      const BusinessConfig = require('../Models/BusinessConfig');
      const business = await BusinessConfig.findOne({ slug: businessId });
      if (business) {
        filter.businessId = business._id;

      } else {

        return res.json({
          customers: [],
          pagination: {
            current: parseInt(page),
            total: 0,
            limit: parseInt(limit),
            totalCustomers: 0
          }
        });
      }
    }



    // Filtro por estado
    if (status !== 'all') {
      filter.status = status;
    }

    // Filtro por búsqueda (escapar regex para prevenir ReDoS)
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



    // Obtener clientes con paginación
    const customers = await Customer.find(filter)
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const totalCustomers = await Customer.countDocuments(filter);



    // Calcular estadísticas usando MongoDB aggregation (evita cargar todos los docs en memoria)
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
    console.error('[Customers] Error al obtener clientes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/customers/:phone - Actualizar datos del cliente
router.put('/:phone', tenantAuth, async (req, res) => {
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
      return res.status(400).json({ error: 'Número de teléfono requerido' });
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
    console.error('Error al actualizar cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/customers - Crear o encontrar cliente
router.post('/', async (req, res) => {
  try {
    const { businessId } = req.query;
    const { phone, name, ...otherData } = req.body;

    if (!phone || !name) {
      return res.status(400).json({ error: 'Teléfono y nombre son requeridos' });
    }

    // Buscar cliente existente
    let customer = await Customer.findOne({ 
      businessId: isValidObjectId(businessId) ? businessId : null, 
      phone 
    });

    if (customer) {
      // Si existe, actualizar con nuevos datos si se proporcionan
      Object.assign(customer, otherData);
      await customer.save();
    } else {
      // Si no existe, crear nuevo cliente
      customer = new Customer({
        businessId: isValidObjectId(businessId) ? businessId : null,
        phone,
        name,
        ...otherData
      });
      await customer.save();
    }

    res.status(201).json(customer);
  } catch (error) {
    console.error('Error al crear/actualizar cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/customers/:phone/orders - Obtener pedidos del cliente
router.get('/:phone/orders', async (req, res) => {
  try {
    const { phone } = req.params;
    const { businessId } = req.query;
    const { limit = 10, page = 1, status } = req.query;

    if (!phone) {
      return res.status(400).json({ error: 'Número de teléfono requerido' });
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
      Order.find(orderFilter).sort({ createdAt: -1 }).limit(parseInt(limit)),
      CompletedOrder.find(completedFilter).sort({ completedAt: -1 }).limit(parseInt(limit))
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
    console.error('Error al obtener pedidos del cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PATCH /api/customers/:phone/address - Actualizar nombre/dirección (público, sin auth)
router.patch('/:phone/address', async (req, res) => {
  try {
    const { phone } = req.params;
    const { businessId } = req.query;
    const { name, address } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Número de teléfono requerido' });
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
    console.error('Error al actualizar dirección del cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/customers/:phone/settings - Actualizar configuraciones del cliente
router.put('/:phone/settings', async (req, res) => {
  try {
    const { phone } = req.params;
    const { businessId } = req.query;
    const { notifications, settings } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Número de teléfono requerido' });
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
    console.error('Error al actualizar configuraciones del cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/customers/:phone - Eliminar cliente
router.delete('/:phone', tenantAuth, async (req, res) => {
  try {
    const { phone } = req.params;
    const { businessId } = req.query;

    if (!phone) {
      return res.status(400).json({ error: 'Número de teléfono requerido' });
    }

    const customer = await Customer.findOneAndDelete({ 
      businessId: isValidObjectId(businessId) ? businessId : null, 
      phone 
    });

    if (!customer) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json({ message: 'Cliente eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/customers/by-id/:id - Eliminar cliente por ID
router.delete('/by-id/:id', tenantAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { businessId } = req.query;



    if (!id) {
      return res.status(400).json({ error: 'ID del cliente requerido' });
    }

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'ID del cliente inválido' });
    }

    // Resolver businessId si es un slug
    let resolvedBusinessId = businessId;
    if (!isValidObjectId(businessId)) {

      const BusinessConfig = require('../Models/BusinessConfig');
      const business = await BusinessConfig.findOne({ slug: businessId });
      if (business) {
        resolvedBusinessId = business._id;

      } else {
        return res.status(404).json({ error: 'Negocio no encontrado' });
      }
    }

    const customer = await Customer.findOneAndDelete({ 
      _id: id,
      businessId: resolvedBusinessId
    });

    if (!customer) {

      return res.status(404).json({ error: 'Cliente no encontrado' });
    }


    res.json({ message: 'Cliente eliminado exitosamente' });
  } catch (error) {
    console.error('[Customers] Error al eliminar cliente por ID:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/customers/:phone - Obtener datos del cliente por teléfono - MUST BE LAST
router.get('/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const { businessId } = req.query;

    if (!phone) {
      return res.status(400).json({ error: 'Número de teléfono requerido' });
    }

    const customer = await Customer.findOne({ 
      businessId: isValidObjectId(businessId) ? businessId : null, 
      phone 
    });

    if (!customer) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json(customer);
  } catch (error) {
    console.error('Error al obtener cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
