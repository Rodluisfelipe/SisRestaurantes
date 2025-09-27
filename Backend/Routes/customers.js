const express = require('express');
const router = express.Router();
const Customer = require('../Models/Customer');
const Order = require('../Models/Order');
const { validateBusinessId } = require('../middleware/authMiddleware');
const { isValidObjectId } = require('../utils/isValidObjectId');

// GET /api/customers/:phone - Obtener datos del cliente por teléfono
router.get('/:phone', validateBusinessId, async (req, res) => {
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

// PUT /api/customers/:phone - Actualizar datos del cliente
router.put('/:phone', validateBusinessId, async (req, res) => {
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
router.post('/', validateBusinessId, async (req, res) => {
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
router.get('/:phone/orders', validateBusinessId, async (req, res) => {
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
      'customerInfo.phone': phone
    };

    if (status) {
      orderFilter.status = status;
    }

    // Obtener pedidos con paginación
    const orders = await Order.find(orderFilter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('items.productId', 'name price');

    const totalOrders = await Order.countDocuments(orderFilter);

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

// PUT /api/customers/:phone/settings - Actualizar configuraciones del cliente
router.put('/:phone/settings', validateBusinessId, async (req, res) => {
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
router.delete('/:phone', validateBusinessId, async (req, res) => {
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

module.exports = router;