const express = require('express');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const router = express.Router();

const Customer = require('../Models/Customer');
const Order = require('../Models/Order');
const CompletedOrder = require('../Models/CompletedOrder');
const Favorite = require('../Models/Favorite');
const Product = require('../Models/Product');
const LoyaltyProgram = require('../Models/LoyaltyProgram');
const CustomerLoyalty = require('../Models/CustomerLoyalty');
const logger = require('../utils/logger');
const { getSubscriptionForBusiness, isFeatureEnabledForPlan } = require('../utils/subscriptionHelper');
const {
  MAX_DIRECCIONES,
  emitirLlave,
  requiereCuenta,
  perfilParaCliente,
  direccionesDe,
  limpiarDireccion,
  pedidoParaCliente,
} = require('../utils/cuentaCliente');

/**
 * "Mi cuenta" del cliente en el menú. Todo aquí pasa por la llave del celular
 * (ver utils/cuentaCliente): el teléfono sale de la llave, nunca de lo que
 * mande la petición.
 */

const limite = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' },
});
router.use(limite);

const ESTADOS_CERRADOS = ['completed', 'cancelled', 'delivered'];

async function clienteDe(cuenta) {
  return Customer.findOne({ businessId: cuenta.businessId, phone: cuenta.telefono });
}

/* ── La llave para los celulares que ya tenían un pedido en curso ──────────
   Antes de las cuentas, el celular guardaba el token de seguimiento de su
   pedido activo. Ese token prueba que el pedido es suyo, así que se cambia
   por la llave de la cuenta sin pedirle nada al cliente. */
router.post('/llave', async (req, res) => {
  try {
    const { orderId, seguimiento } = req.body || {};
    if (!orderId || !seguimiento || !mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({ message: 'Faltan datos del pedido' });
    }
    const pedido = await Order.findById(orderId).select('businessId phone customerToken').lean();
    if (!pedido || !pedido.customerToken || pedido.customerToken !== String(seguimiento)) {
      return res.status(403).json({ message: 'No se pudo verificar el pedido' });
    }
    const llave = emitirLlave({ businessId: pedido.businessId, telefono: pedido.phone });
    if (!llave) return res.status(400).json({ message: 'El pedido no tiene teléfono' });
    return res.json({ llave });
  } catch (error) {
    logger.error('Error emitiendo llave de cuenta', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

router.use(requiereCuenta);

/* ── Todo junto: lo que muestra la pantalla "Mi cuenta" ────────────────── */
router.get('/', async (req, res) => {
  try {
    const { businessId, telefono } = req.cuenta;
    const [cliente, activos, anteriores, favoritos, puntos] = await Promise.all([
      clienteDe(req.cuenta),
      Order.find({ businessId, phone: telefono, status: { $nin: ESTADOS_CERRADOS } })
        .sort({ createdAt: -1 }).limit(10).lean(),
      CompletedOrder.find({ businessId, phone: telefono }).sort({ completedAt: -1 }).limit(20).lean(),
      Favorite.countDocuments({ businessId, phone: telefono }),
      puntosDe(businessId, telefono),
    ]);
    return res.json({
      perfil: perfilParaCliente(cliente) || { nombre: '', telefono, direcciones: [], saldoFavor: 0, credito: null },
      puntos,
      pedidos: {
        activos: activos.map(pedidoParaCliente),
        anteriores: anteriores.map(pedidoParaCliente),
      },
      favoritos,
    });
  } catch (error) {
    logger.error('Error leyendo la cuenta del cliente', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

async function puntosDe(businessId, telefono) {
  const programa = await LoyaltyProgram.findOne({ businessId, isActive: true }).lean();
  if (!programa) return null;
  const { planConfig } = await getSubscriptionForBusiness(businessId);
  const conRecompensas = isFeatureEnabledForPlan(planConfig, 'loyaltyRewards');
  const saldo = await CustomerLoyalty.findOne({ businessId, phone: telefono }).lean();
  const puntos = saldo?.points || 0;
  const recompensas = conRecompensas ? (programa.rewards || []).filter((r) => r.isActive) : [];
  return {
    puntos,
    nivel: saldo?.currentTier || programa.tiers?.[0]?.name || '',
    recompensas: recompensas.map((r) => ({
      id: String(r._id),
      nombre: r.name,
      descripcion: r.description || '',
      puntos: r.pointsCost ?? r.points ?? 0,
    })),
  };
}

/* ── Datos personales ────────────────────────────────────────────────── */
const TIPOS_DOCUMENTO = ['CC', 'NIT', 'CE', 'PP'];

router.put('/perfil', async (req, res) => {
  try {
    const cliente = await clienteDe(req.cuenta);
    if (!cliente) return res.status(404).json({ message: 'Aún no tienes pedidos en este negocio' });
    const { nombre, email, documento, tipoDocumento } = req.body || {};
    if (nombre !== undefined) {
      const n = String(nombre).trim().slice(0, 80);
      if (n.length < 2) return res.status(400).json({ message: 'Escribe tu nombre' });
      cliente.name = n;
    }
    if (email !== undefined) {
      const e = String(email).trim().toLowerCase().slice(0, 254);
      if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return res.status(400).json({ message: 'El correo no es válido' });
      cliente.email = e || null;
    }
    if (documento !== undefined) cliente.documento = String(documento).replace(/[^\dA-Za-z-]/g, '').slice(0, 20);
    if (tipoDocumento !== undefined && TIPOS_DOCUMENTO.includes(tipoDocumento)) cliente.tipoDocumento = tipoDocumento;
    await cliente.save();
    return res.json({ perfil: perfilParaCliente(cliente) });
  } catch (error) {
    logger.error('Error guardando el perfil del cliente', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* ── Direcciones ─────────────────────────────────────────────────────── */

/* La dirección única de antes pasa a ser la primera guardada la primera vez
   que el cliente toca sus direcciones, para no perderla. */
function adoptarDireccionAnterior(cliente) {
  if (!cliente.direcciones?.length && cliente.address) {
    cliente.direcciones.push({ etiqueta: 'Casa', texto: cliente.address, principal: true });
  }
}

function dejarUnaPrincipal(cliente, id) {
  cliente.direcciones.forEach((d) => { d.principal = String(d._id) === String(id); });
  const principal = cliente.direcciones.find((d) => d.principal);
  if (principal) cliente.address = principal.texto;
}

router.post('/direcciones', async (req, res) => {
  try {
    const cliente = await clienteDe(req.cuenta);
    if (!cliente) return res.status(404).json({ message: 'Aún no tienes pedidos en este negocio' });
    const { error, direccion } = limpiarDireccion(req.body);
    if (error) return res.status(400).json({ message: error });
    adoptarDireccionAnterior(cliente);
    if (cliente.direcciones.length >= MAX_DIRECCIONES) {
      return res.status(400).json({ message: `Puedes guardar hasta ${MAX_DIRECCIONES} direcciones` });
    }
    cliente.direcciones.push(direccion);
    const nueva = cliente.direcciones[cliente.direcciones.length - 1];
    if (direccion.principal || cliente.direcciones.length === 1) dejarUnaPrincipal(cliente, nueva._id);
    await cliente.save();
    return res.status(201).json({ direcciones: direccionesDe(cliente) });
  } catch (error) {
    logger.error('Error guardando dirección', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

router.put('/direcciones/:id', async (req, res) => {
  try {
    const cliente = await clienteDe(req.cuenta);
    if (!cliente) return res.status(404).json({ message: 'Aún no tienes pedidos en este negocio' });
    adoptarDireccionAnterior(cliente);
    const id = req.params.id === 'anterior' ? cliente.direcciones[0]?._id : req.params.id;
    const actual = id && cliente.direcciones.id(id);
    if (!actual) return res.status(404).json({ message: 'Esa dirección ya no existe' });
    const { error, direccion } = limpiarDireccion({ ...actual.toObject(), ...req.body });
    if (error) return res.status(400).json({ message: error });
    actual.etiqueta = direccion.etiqueta;
    actual.texto = direccion.texto;
    actual.referencia = direccion.referencia;
    if (req.body?.principal) dejarUnaPrincipal(cliente, actual._id);
    else if (actual.principal) cliente.address = actual.texto;
    await cliente.save();
    return res.json({ direcciones: direccionesDe(cliente) });
  } catch (error) {
    logger.error('Error editando dirección', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

router.delete('/direcciones/:id', async (req, res) => {
  try {
    const cliente = await clienteDe(req.cuenta);
    if (!cliente) return res.status(404).json({ message: 'Aún no tienes pedidos en este negocio' });
    adoptarDireccionAnterior(cliente);
    const id = req.params.id === 'anterior' ? cliente.direcciones[0]?._id : req.params.id;
    const actual = id && cliente.direcciones.id(id);
    if (!actual) return res.status(404).json({ message: 'Esa dirección ya no existe' });
    const eraPrincipal = actual.principal;
    actual.deleteOne();
    if (eraPrincipal) {
      if (cliente.direcciones.length) dejarUnaPrincipal(cliente, cliente.direcciones[0]._id);
      else cliente.address = '';
    }
    await cliente.save();
    return res.json({ direcciones: direccionesDe(cliente) });
  } catch (error) {
    logger.error('Error borrando dirección', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* ── Favoritos ───────────────────────────────────────────────────────── */
router.get('/favoritos', async (req, res) => {
  try {
    const { businessId, telefono } = req.cuenta;
    const lista = await Favorite.find({ businessId, phone: telefono }).sort({ createdAt: -1 }).limit(100).lean();
    return res.json({ favoritos: lista });
  } catch (error) {
    logger.error('Error leyendo favoritos', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* El corazón de la ficha: guarda el producto. El nombre, el precio y la foto
   salen del catálogo, no de lo que mande el celular. */
router.post('/favoritos', async (req, res) => {
  try {
    const { businessId, telefono } = req.cuenta;
    const { productId, selectedToppings, selectedOptions, notes } = req.body || {};
    if (!mongoose.isValidObjectId(productId)) return res.status(400).json({ message: 'Producto no válido' });
    const producto = await Product.findOne({ _id: productId, businessId }).select('name price image').lean();
    if (!producto) return res.status(404).json({ message: 'Ese producto ya no está en el menú' });

    let cliente = await clienteDe(req.cuenta);
    if (!cliente) return res.status(404).json({ message: 'Aún no tienes pedidos en este negocio' });

    const conOpciones = Array.isArray(selectedToppings) && selectedToppings.length > 0;
    // Sin opciones, el mismo producto no se guarda dos veces.
    if (!conOpciones) {
      const ya = await Favorite.findOne({ businessId, phone: telefono, productId, 'selectedToppings.0': { $exists: false } }).lean();
      if (ya) return res.json({ favorito: ya, yaEstaba: true });
    }
    const favorito = await Favorite.create({
      businessId,
      customerId: cliente._id,
      phone: telefono,
      productId,
      productName: producto.name,
      productPrice: producto.price,
      productImage: producto.image || '',
      selectedToppings: conOpciones ? selectedToppings.slice(0, 50) : [],
      selectedOptions: selectedOptions && typeof selectedOptions === 'object' ? selectedOptions : {},
      notes: String(notes || '').slice(0, 300),
    });
    return res.status(201).json({ favorito });
  } catch (error) {
    logger.error('Error guardando favorito', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* Quitar el corazón: por id de favorito, o por producto (desde la ficha). */
router.delete('/favoritos/:id', async (req, res) => {
  try {
    const { businessId, telefono } = req.cuenta;
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Favorito no válido' });
    const porProducto = req.query.por === 'producto';
    const filtro = porProducto
      ? { businessId, phone: telefono, productId: id, 'selectedToppings.0': { $exists: false } }
      : { _id: id, businessId, phone: telefono };
    const r = await Favorite.deleteOne(filtro);
    if (!r.deletedCount) return res.status(404).json({ message: 'Ese favorito ya no existe' });
    return res.json({ ok: true });
  } catch (error) {
    logger.error('Error quitando favorito', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/* ── Borrar mis datos (Ley 1581: el titular puede pedir la supresión) ──────
   Se borran sus datos, favoritos y puntos. Los pedidos se conservan porque
   son registros contables del negocio. Si debe plata a crédito, no: esa
   deuda es del negocio y no se puede borrar desde el menú. */
router.delete('/', async (req, res) => {
  try {
    const { businessId, telefono } = req.cuenta;
    const cliente = await clienteDe(req.cuenta);
    if (cliente?.credito?.saldo > 0) {
      return res.status(409).json({ message: 'Tienes un saldo pendiente a crédito. Pásalo a pagar primero con el negocio.' });
    }
    await Promise.all([
      Favorite.deleteMany({ businessId, phone: telefono }),
      CustomerLoyalty.deleteOne({ businessId, phone: telefono }),
      cliente ? Customer.deleteOne({ _id: cliente._id }) : null,
    ]);
    logger.info('Cliente borró sus datos desde el menú', { businessId });
    return res.json({ ok: true });
  } catch (error) {
    logger.error('Error borrando los datos del cliente', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

module.exports = router;
