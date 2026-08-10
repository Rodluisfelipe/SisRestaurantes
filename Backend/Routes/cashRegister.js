const express = require("express");
const router = express.Router();
const CashRegister = require("../Models/CashRegister");
const BusinessConfig = require("../Models/BusinessConfig");
const authMiddleware = require("../middleware/authMiddleware");
const { tenantAuth } = require("../middleware/tenantAuth");
const logger = require("../utils/logger");

// Middleware: verify POS beta is enabled for the business
const checkPosBeta = async (req, res, next) => {
  try {
    const businessId = req.body.businessId || req.query.businessId;
    if (!businessId) return res.status(400).json({ message: "businessId es requerido" });
    const business = await BusinessConfig.findById(businessId).select('features').lean();
    if (!business) return res.status(404).json({ message: "Negocio no encontrado" });
    if (!business.features?.posBetaEnabled) {
      return res.status(403).json({ message: "El módulo POS no está habilitado para este negocio" });
    }
    next();
  } catch (error) {
    logger.error("Error checking POS beta", error);
    res.status(500).json({ message: "Error interno" });
  }
};

// Abrir caja
router.post("/open", authMiddleware, checkPosBeta, async (req, res) => {
  try {
    const { businessId, openingAmount } = req.body;
    if (!businessId) return res.status(400).json({ message: "businessId es requerido" });

    const existing = await CashRegister.findOne({ businessId, status: 'open' });
    if (existing) return res.status(409).json({ message: "Ya hay una caja abierta", cashRegister: existing });

    const cashRegister = new CashRegister({
      businessId,
      openedBy: req.user.id,
      openingAmount: Number(openingAmount) || 0,
      status: 'open'
    });

    const saved = await cashRegister.save();
    logger.info(`Cash register opened for business ${businessId} by ${req.user.id}`);
    res.status(201).json(saved);
  } catch (error) {
    logger.error("Error opening cash register", error);
    res.status(500).json({ message: "Error al abrir la caja" });
  }
});

// Obtener caja actual (abierta)
router.get("/current", authMiddleware, checkPosBeta, async (req, res) => {
  try {
    const { businessId } = req.query;
    if (!businessId) return res.status(400).json({ message: "businessId es requerido" });

    const cashRegister = await CashRegister.findOne({ businessId, status: 'open' })
      .populate('openedBy', 'name username');
    res.json(cashRegister);
  } catch (error) {
    logger.error("Error getting current cash register", error);
    res.status(500).json({ message: "Error al obtener la caja" });
  }
});

// Agregar movimiento (ingreso/retiro)
router.post("/movement", authMiddleware, checkPosBeta, async (req, res) => {
  try {
    const { businessId, type, amount, description } = req.body;
    if (!businessId) return res.status(400).json({ message: "businessId es requerido" });
    if (!['income', 'expense'].includes(type)) return res.status(400).json({ message: "Tipo debe ser 'income' o 'expense'" });
    if (!amount || Number(amount) <= 0) return res.status(400).json({ message: "Monto debe ser mayor a 0" });

    const cashRegister = await CashRegister.findOne({ businessId, status: 'open' });
    if (!cashRegister) return res.status(404).json({ message: "No hay caja abierta" });

    cashRegister.movements.push({
      type,
      amount: Number(amount),
      description: description || (type === 'income' ? 'Ingreso manual' : 'Retiro manual'),
      createdBy: req.user.id,
      createdAt: new Date()
    });

    const saved = await cashRegister.save();
    logger.info(`Cash register movement: ${type} $${amount} for business ${businessId}`);
    res.json(saved);
  } catch (error) {
    logger.error("Error adding movement", error);
    res.status(500).json({ message: "Error al registrar movimiento" });
  }
});

// Cerrar caja
router.post("/close", authMiddleware, checkPosBeta, async (req, res) => {
  try {
    const { businessId, closingAmount } = req.body;
    if (!businessId) return res.status(400).json({ message: "businessId es requerido" });

    const cashRegister = await CashRegister.findOne({ businessId, status: 'open' });
    if (!cashRegister) return res.status(404).json({ message: "No hay caja abierta" });

    // Calcular resumen de ventas
    const salesMovements = cashRegister.movements.filter(m => m.type === 'sale');
    const refundMovements = cashRegister.movements.filter(m => m.type === 'refund');
    const incomeMovements = cashRegister.movements.filter(m => m.type === 'income');
    const expenseMovements = cashRegister.movements.filter(m => m.type === 'expense');

    // Separar ventas POS vs MenuBy
    const posSales = salesMovements.filter(m => m.orderChannel === 'pos' || !m.orderChannel);
    const menubySales = salesMovements.filter(m => m.orderChannel === 'menuby');

    const totalSales = salesMovements.reduce((sum, m) => sum + m.amount, 0);
    const totalRefunds = refundMovements.reduce((sum, m) => sum + m.amount, 0);
    const totalIncome = incomeMovements.reduce((sum, m) => sum + m.amount, 0);
    const totalExpense = expenseMovements.reduce((sum, m) => sum + m.amount, 0);

    /* El mismo método de pago tiene dos nombres en la base: 'cash' y
       'efectivo', 'transfer' y 'transferencia'. Los dos son válidos en el
       modelo y los dos se usan según por dónde entró la venta.

       Agruparlos por el nombre crudo partía el efectivo en dos montones y el
       cierre solo miraba uno: $37.608.800 quedaban invisibles y 35 de 38
       cierres salían descuadrados. Los cajeros llevaban meses cuadrando a mano
       una diferencia que no existía. */
    const MISMO_METODO = { efectivo: 'cash', transferencia: 'transfer' };
    const metodoDe = (m) => MISMO_METODO[m.paymentMethod] || m.paymentMethod || 'cash';

    const agrupar = (movimientos) => {
      const por = {};
      movimientos.forEach(m => {
        const method = metodoDe(m);
        if (!por[method]) por[method] = { count: 0, total: 0 };
        por[method].count += 1;
        por[method].total += m.amount;
      });
      return por;
    };

    const byPaymentMethod = agrupar(salesMovements);
    const posByPaymentMethod = agrupar(posSales);
    const menubyByPaymentMethod = agrupar(menubySales);

    // Efectivo esperado = apertura + ventas en efectivo + ingresos - retiros - reembolsos en efectivo
    const cashSales = (byPaymentMethod['cash']?.total || 0);
    const expectedAmount = cashRegister.openingAmount + cashSales + totalIncome - totalExpense - totalRefunds;
    const realClosing = Number(closingAmount) || 0;

    cashRegister.closedBy = req.user.id;
    cashRegister.closedAt = new Date();
    cashRegister.status = 'closed';
    cashRegister.closingAmount = realClosing;
    cashRegister.expectedAmount = expectedAmount;
    cashRegister.difference = realClosing - expectedAmount;
    cashRegister.salesSummary = {
      totalSales,
      totalOrders: salesMovements.length,
      byPaymentMethod,
      posSales: {
        total: posSales.reduce((s, m) => s + m.amount, 0),
        count: posSales.length,
        byPaymentMethod: posByPaymentMethod
      },
      menubySales: {
        total: menubySales.reduce((s, m) => s + m.amount, 0),
        count: menubySales.length,
        byPaymentMethod: menubyByPaymentMethod
      }
    };

    const saved = await cashRegister.save();
    logger.info(`Cash register closed for business ${businessId}. Expected: ${expectedAmount}, Real: ${realClosing}, Diff: ${saved.difference}`);
    res.json(saved);
  } catch (error) {
    logger.error("Error closing cash register", error);
    res.status(500).json({ message: "Error al cerrar la caja" });
  }
});

// Historial de cajas
router.get("/history", authMiddleware, checkPosBeta, async (req, res) => {
  try {
    const { businessId, page = 1, limit = 10 } = req.query;
    if (!businessId) return res.status(400).json({ message: "businessId es requerido" });

    const skip = (Number(page) - 1) * Number(limit);
    const [registers, total] = await Promise.all([
      CashRegister.find({ businessId, status: 'closed' })
        .sort({ closedAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('openedBy', 'name username')
        .populate('closedBy', 'name username')
        .lean(),
      CashRegister.countDocuments({ businessId, status: 'closed' })
    ]);

    res.json({ registers, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (error) {
    logger.error("Error getting cash register history", error);
    res.status(500).json({ message: "Error al obtener historial" });
  }
});

// Detalle de caja específica
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const cashRegister = await CashRegister.findById(req.params.id)
      .populate('openedBy', 'name username')
      .populate('closedBy', 'name username');
    if (!cashRegister) return res.status(404).json({ message: "Caja no encontrada" });
    res.json(cashRegister);
  } catch (error) {
    logger.error("Error getting cash register detail", error);
    res.status(500).json({ message: "Error al obtener detalle de caja" });
  }
});

module.exports = router;
