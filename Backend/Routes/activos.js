/**
 * Domiciliario con Activos (mensajería externa).
 * Solo el restaurante habilitado (ACTIVOS_BUSINESS_ID). El admin lo dispara a
 * mano desde el pedido; no es automático.
 */
const express = require("express");
const router = express.Router();
const { tenantAuth } = require("../middleware/tenantAuth");
const Order = require("../Models/Order");
const CompletedOrder = require("../Models/CompletedOrder");
const activos = require("../services/activos");
const socketService = require("../services/socketService");
const logger = require("../utils/logger");

async function buscarPedido(id, businessId) {
  const filtro = { _id: id, ...(businessId ? { businessId } : {}) };
  return (await Order.findOne(filtro)) || (await CompletedOrder.findOne(filtro));
}

/** ¿Está encendida la integración para el negocio del usuario? (para mostrar u ocultar el botón) */
router.get("/estado-config", tenantAuth, (req, res) => {
  const businessId = req.user?.businessId || req.resolvedBusinessId || req.query.businessId;
  res.json({ habilitado: activos.habilitadoPara(businessId) });
});

/** Pedir el domiciliario a Activos para un pedido. ⚠️ Despacha un repartidor real. */
router.post("/solicitar", tenantAuth, async (req, res) => {
  try {
    const businessId = req.user?.businessId || req.resolvedBusinessId || req.body.businessId;
    if (!activos.habilitadoPara(businessId)) {
      return res.status(403).json({ message: "Este negocio no tiene la mensajería de Activos habilitada." });
    }
    const { orderId, minutosPreparacion } = req.body;
    const order = await buscarPedido(orderId, businessId);
    if (!order) return res.status(404).json({ message: "Pedido no encontrado" });
    if (order.orderType !== "delivery") {
      return res.status(400).json({ message: "Este pedido no es a domicilio." });
    }
    if (order.activos?.entregaId) {
      return res.status(409).json({ message: "Ya se pidió el domiciliario para este pedido.", entregaId: order.activos.entregaId });
    }

    const entregaId = await activos.solicitarEntrega(order, {
      minutosPreparacion: parseInt(minutosPreparacion, 10) || 15,
    });

    order.activos = { entregaId, solicitadoAt: new Date(), solicitadoPor: req.user?.name || "" };
    await order.save();

    socketService.emitToBusiness(String(order.businessId), "order_updated", order);
    res.json({ success: true, entregaId });
  } catch (error) {
    logger.error("Error al solicitar domiciliario a Activos", error, req);
    res.status(502).json({ message: error.message || "No se pudo pedir el domiciliario." });
  }
});

/** Estado actual del domiciliario de un pedido. */
router.get("/estado/:orderId", tenantAuth, async (req, res) => {
  try {
    const businessId = req.user?.businessId || req.resolvedBusinessId || req.query.businessId;
    if (!activos.habilitadoPara(businessId)) {
      return res.status(403).json({ message: "No habilitado" });
    }
    const order = await buscarPedido(req.params.orderId, businessId);
    if (!order?.activos?.entregaId) return res.json({ solicitado: false });
    const estado = await activos.estadoDeEntrega(order.activos.entregaId);
    res.json({ solicitado: true, ...estado });
  } catch (error) {
    logger.error("Error al consultar el estado de Activos", error, req);
    res.status(502).json({ message: "No se pudo consultar el estado." });
  }
});

module.exports = router;
