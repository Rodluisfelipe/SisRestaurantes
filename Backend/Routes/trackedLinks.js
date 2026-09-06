const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const TrackedLink = require("../Models/TrackedLink");
const Order = require("../Models/Order");
const CompletedOrder = require("../Models/CompletedOrder");
const logger = require("../utils/logger");
const { formatHttpError } = require("../utils/errorFormatter");
const { tenantAuth } = require("../middleware/tenantAuth");
const { audit } = require('../utils/auditLog');
const { resolveBusinessId } = require("../utils/businessResolver");
const { SALES, DELIVERY } = require('../utils/revenue');

/**
 * Enlaces marcados — "Sigue tus ventas".
 *
 * Dos cosas viven acá:
 *   1. El CRUD de enlaces que el negocio reparte (y de los que saca sus QR).
 *   2. El reporte de ventas por origen.
 *
 * El reporte ya existía, pero vivía dentro del módulo de WhatsApp y exigía el
 * complemento de la bandeja para verlo. No tiene nada que ver con WhatsApp:
 * agrupa TODOS los pedidos por su origen. Un negocio sin ese complemento tenía
 * el dato guardándose en cada venta y no podía mirarlo. Acá queda libre.
 */

/** Crea los tres enlaces base la primera vez que el negocio abre el módulo. */
async function asegurarPredefinidos(businessId) {
  const existentes = await TrackedLink.countDocuments({ businessId });
  if (existentes > 0) return;

  await TrackedLink.insertMany(
    TrackedLink.PREDEFINIDOS.map(p => ({ ...p, businessId, predefinido: true })),
    // `ordered: false` para que, si dos pestañas abren el módulo a la vez, el
    // choque contra el índice único no tumbe la creación entera.
    { ordered: false }
  ).catch(err => {
    if (err?.code !== 11000) throw err;
  });
}

// GET /api/tracked-links — los enlaces del negocio
router.get("/", tenantAuth, async (req, res) => {
  try {
    const businessId = await resolveBusinessId(req.query.businessId || req.user?.businessId);
    await asegurarPredefinidos(businessId);

    const enlaces = await TrackedLink.find({ businessId }).sort({ predefinido: -1, createdAt: 1 }).lean();
    res.json(enlaces);
  } catch (error) {
    logger.error("Error listando enlaces marcados", error, req);
    res.status(500).json(formatHttpError(req, "Error al obtener los enlaces", 500));
  }
});

// POST /api/tracked-links — crear uno nuevo
router.post("/", tenantAuth, async (req, res) => {
  try {
    const businessId = await resolveBusinessId(req.body.businessId || req.user?.businessId);
    const nombre = String(req.body.nombre || '').trim();
    const source = TrackedLink.limpiarSource(req.body.source || req.body.nombre);

    if (!nombre) {
      return res.status(400).json(formatHttpError(req, "El enlace necesita un nombre", 400));
    }
    if (!source) {
      return res.status(400).json(formatHttpError(req, "El identificador solo admite letras, números, punto y guion", 400));
    }

    const forzarTipo = ['inSite', 'takeaway', 'delivery'].includes(req.body.forzarTipo)
      ? req.body.forzarTipo : null;

    const enlace = await TrackedLink.create({ businessId, nombre, source, forzarTipo });

    audit({
      action: 'create', resource: 'trackedLink', resourceId: enlace._id,
      resourceName: enlace.nombre, businessId, after: enlace.toObject(), req,
    });

    res.status(201).json(enlace);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json(formatHttpError(req, "Ya tienes un enlace con ese identificador", 409));
    }
    logger.error("Error creando enlace marcado", error, req);
    res.status(500).json(formatHttpError(req, "Error al crear el enlace", 500));
  }
});

// PUT /api/tracked-links/:id
router.put("/:id", tenantAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json(formatHttpError(req, "Identificador inválido", 400));
    }
    const businessId = await resolveBusinessId(req.body.businessId || req.user?.businessId);
    const enlace = await TrackedLink.findOne({ _id: req.params.id, businessId });
    if (!enlace) {
      return res.status(404).json(formatHttpError(req, "Enlace no encontrado", 404));
    }

    if (req.body.nombre !== undefined) {
      const nombre = String(req.body.nombre).trim();
      if (!nombre) return res.status(400).json(formatHttpError(req, "El enlace necesita un nombre", 400));
      enlace.nombre = nombre;
    }
    if (req.body.forzarTipo !== undefined) {
      enlace.forzarTipo = ['inSite', 'takeaway', 'delivery'].includes(req.body.forzarTipo)
        ? req.body.forzarTipo : null;
    }
    if (req.body.activo !== undefined) enlace.activo = !!req.body.activo;

    /* El `source` no se puede cambiar: es lo que quedó grabado en los pedidos
       ya hechos y lo que llevan impreso los QR repartidos. Cambiarlo partiría
       el histórico del canal en dos y dejaría los códigos pegados apuntando a
       un origen que ya no existe. */

    await enlace.save();
    res.json(enlace);
  } catch (error) {
    logger.error("Error actualizando enlace marcado", error, req);
    res.status(500).json(formatHttpError(req, "Error al actualizar el enlace", 500));
  }
});

// DELETE /api/tracked-links/:id
router.delete("/:id", tenantAuth, async (req, res) => {
  try {
    const businessId = await resolveBusinessId(req.query.businessId || req.user?.businessId);
    const enlace = await TrackedLink.findOne({ _id: req.params.id, businessId });
    if (!enlace) {
      return res.status(404).json(formatHttpError(req, "Enlace no encontrado", 404));
    }
    if (enlace.predefinido) {
      return res.status(400).json(formatHttpError(
        req,
        "Los enlaces base no se borran, se desactivan: puede haber QR impresos usándolos.",
        400
      ));
    }

    await enlace.deleteOne();
    audit({
      action: 'delete', resource: 'trackedLink', resourceId: enlace._id,
      resourceName: enlace.nombre, businessId, before: enlace.toObject(), req,
    });
    res.json({ ok: true });
  } catch (error) {
    logger.error("Error eliminando enlace marcado", error, req);
    res.status(500).json(formatHttpError(req, "Error al eliminar el enlace", 500));
  }
});

/**
 * GET /api/tracked-links/reporte — ventas por origen.
 *
 * Los pedidos viven en dos colecciones —activos y completados—, así que se
 * consultan las dos y se suman. Mirar solo una da la mitad del cuadro.
 */
router.get("/reporte", tenantAuth, async (req, res) => {
  try {
    const businessId = await resolveBusinessId(req.query.businessId || req.user?.businessId);
    const dias = Math.min(Math.max(Number(req.query.dias) || 30, 1), 365);
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
    const negocio = new mongoose.Types.ObjectId(String(businessId));

    const agrupar = [
      { $group: {
        _id: { $ifNull: ['$source', 'sin-marcar'] },
        pedidos: { $sum: 1 },
        ventas: { $sum: SALES },
        envios: { $sum: DELIVERY },
      } },
    ];

    const [completados, activos, enlaces] = await Promise.all([
      CompletedOrder.aggregate([
        { $match: { businessId: negocio, completedAt: { $gte: desde } } }, ...agrupar,
      ]),
      Order.aggregate([
        { $match: { businessId: negocio, createdAt: { $gte: desde }, status: { $ne: 'cancelled' } } }, ...agrupar,
      ]),
      TrackedLink.find({ businessId: negocio }).select('nombre source').lean(),
    ]);

    const nombrePorSource = new Map(enlaces.map(e => [e.source, e.nombre]));

    const total = new Map();
    for (const fila of [...completados, ...activos]) {
      const previo = total.get(fila._id) || { pedidos: 0, ventas: 0, envios: 0 };
      total.set(fila._id, {
        pedidos: previo.pedidos + fila.pedidos,
        ventas: previo.ventas + fila.ventas,
        envios: previo.envios + fila.envios,
      });
    }

    const origenes = [...total]
      .map(([origen, v]) => ({
        origen,
        // El nombre legible del enlace si todavía existe; si se borró, al menos
        // el origen crudo, para no perder el histórico de la campaña.
        nombre: nombrePorSource.get(origen) || (origen === 'sin-marcar' ? 'Sin marcar' : origen),
        ...v,
        ticketPromedio: v.pedidos ? Math.round(v.ventas / v.pedidos) : 0,
      }))
      .sort((a, b) => b.ventas - a.ventas);

    res.json({
      dias,
      origenes,
      totales: {
        pedidos: origenes.reduce((s, o) => s + o.pedidos, 0),
        ventas: origenes.reduce((s, o) => s + o.ventas, 0),
      },
    });
  } catch (error) {
    logger.error("Error generando reporte de origen", error, req);
    res.status(500).json(formatHttpError(req, "Error al generar el reporte", 500));
  }
});

/**
 * GET /api/tracked-links/resolver — público, lo consulta el menú.
 *
 * Devuelve solo qué tipo de pedido impone un enlace. Va acá y no dentro de la
 * URL para que el negocio pueda cambiar la regla desde el panel sin reimprimir
 * los QR que ya están pegados en las mesas.
 */
router.get("/resolver", async (req, res) => {
  try {
    const { businessId, source } = req.query;
    if (!businessId || !source) return res.json({ forzarTipo: null });

    const bid = await resolveBusinessId(businessId).catch(() => null);
    if (!bid) return res.json({ forzarTipo: null });

    const enlace = await TrackedLink.findOne({
      businessId: bid,
      source: TrackedLink.limpiarSource(source),
      activo: true,
    }).select('forzarTipo').lean();

    res.json({ forzarTipo: enlace?.forzarTipo || null });
  } catch (error) {
    // Nunca romper el menú por esto: sin respuesta, se muestran todas las
    // opciones del negocio, que es el comportamiento de siempre.
    logger.warn("No se pudo resolver el enlace marcado", { error: error.message });
    res.json({ forzarTipo: null });
  }
});

module.exports = router;
