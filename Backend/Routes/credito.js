const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { tenantAuth } = require('../middleware/tenantAuth');
const Customer = require('../Models/Customer');
const CreditoMovimiento = require('../Models/CreditoMovimiento');
const { mover } = require('../services/credito');
const logger = require('../utils/logger');

/**
 * Cuentas por cobrar: quién debe, cuánto, y sus abonos.
 *
 * La caja fía y recibe abonos por su cola; aquí el dueño ve la cartera,
 * habilita crédito y cupo, y registra abonos que llegan por fuera de la caja
 * —una transferencia de la empresa a fin de mes—.
 */
router.use(tenantAuth, (req, res, next) => {
  if (req.user?.scope === 'pos') return res.status(403).json({ message: 'Esta consulta es del panel' });
  if (!req.user?.businessId && !req.query.businessId) return res.status(400).json({ message: 'businessId es requerido' });
  next();
});

const negocio = (req) => req.user.businessId || req.query.businessId;
const escapar = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* La cartera: los que tienen crédito o deben algo. Con `q`, cualquier cliente
   que coincida, para poder habilitarle crédito a uno nuevo. */
router.get('/', async (req, res) => {
  try {
    const businessId = negocio(req);
    const q = String(req.query.q || '').trim().slice(0, 40);
    const filtro = q
      ? { businessId, $or: [{ name: new RegExp(escapar(q), 'i') }, { phone: new RegExp(`^${escapar(q)}`) }] }
      : { businessId, $or: [{ 'credito.habilitado': true }, { 'credito.saldo': { $gt: 0 } }] };
    const clientes = await Customer.find(filtro)
      .select('name phone documento credito')
      .sort({ 'credito.saldo': -1, name: 1 })
      .limit(q ? 20 : 500)
      .lean();
    const cartera = clientes.reduce((t, c) => t + (c.credito?.saldo || 0), 0);
    res.json({ clientes, cartera });
  } catch (error) {
    logger.error('Error listando la cartera', error, req);
    res.status(500).json({ message: 'No se pudo cargar la cartera' });
  }
});

router.get('/:id/movimientos', async (req, res) => {
  try {
    const movimientos = await CreditoMovimiento.find({ businessId: negocio(req), customerId: req.params.id })
      .sort({ fecha: -1 })
      .limit(200)
      .lean();
    res.json({ movimientos });
  } catch (error) {
    logger.error('Error listando movimientos de crédito', error, req);
    res.status(500).json({ message: 'No se pudieron cargar los movimientos' });
  }
});

/* Habilitar crédito y fijar el cupo: es decidir cuánto se le presta a
   alguien, así que no lo hace el personal del panel. */
router.put('/:id', async (req, res) => {
  try {
    if (req.user?.role === 'staff') return res.status(403).json({ message: 'Solo el administrador define el crédito' });
    const cambios = {};
    if (typeof req.body?.habilitado === 'boolean') cambios['credito.habilitado'] = req.body.habilitado;
    if (req.body?.cupo !== undefined) {
      const cupo = Math.round(Number(req.body.cupo));
      if (!Number.isFinite(cupo) || cupo < 0) return res.status(400).json({ message: 'El cupo no es válido' });
      cambios['credito.cupo'] = cupo;
    }
    /* Mover updatedAt es lo que hace que las cajas bajen el cambio: la bajada
       de clientes va por marca de agua. */
    const c = await Customer.findOneAndUpdate({ _id: req.params.id, businessId: negocio(req) }, { $set: cambios }, { new: true })
      .select('name phone documento credito')
      .lean();
    if (!c) return res.status(404).json({ message: 'Cliente no encontrado' });
    res.json({ cliente: c });
  } catch (error) {
    logger.error('Error guardando el crédito de un cliente', error, req);
    res.status(500).json({ message: 'No se pudo guardar' });
  }
});

/* Un abono recibido por fuera de la caja. */
router.post('/:id/abono', async (req, res) => {
  try {
    const monto = Math.round(Number(req.body?.monto) || 0);
    if (monto <= 0) return res.status(400).json({ message: 'El monto no es válido' });
    const r = await mover({
      businessId: negocio(req),
      customerId: req.params.id,
      tipo: 'abono',
      monto,
      origenId: `panel-${crypto.randomUUID()}`,
      origen: 'panel',
      medio: String(req.body?.medio || 'transferencia').slice(0, 20),
      nota: String(req.body?.nota || '').slice(0, 200),
      usuario: req.user?.name || req.user?.username || '',
    });
    /* Las cajas ven el saldo nuevo en su próxima bajada de clientes. */
    await Customer.updateOne({ _id: req.params.id }, { $currentDate: { updatedAt: true } });
    res.status(201).json({ ok: true, saldo: r.saldo });
  } catch (error) {
    logger.error('Error registrando un abono desde el panel', error, req);
    res.status(500).json({ message: error.message === 'Cliente no encontrado' ? error.message : 'No se pudo registrar el abono' });
  }
});

module.exports = router;
