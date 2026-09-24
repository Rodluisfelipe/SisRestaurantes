const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { tenantAuth } = require('../middleware/tenantAuth');
const Proveedor = require('../Models/Proveedor');
const Compra = require('../Models/Compra');
const Supply = require('../Models/Supply');
const Product = require('../Models/Product');
const StockMovement = require('../Models/StockMovement');
const logger = require('../utils/logger');
const { validarCompra, sugerido } = require('../utils/compras');
const { rango } = require('./posPanel');

/**
 * Proveedores, compras y lo que se les debe.
 *
 * Cierra el ciclo que faltaba: el inventario se descontaba solo con cada
 * venta, pero lo que entraba se ajustaba a mano, sin decir de quién ni a qué
 * costo. Registrar una compra mete la mercancía al kardex como "Entrada", deja
 * el último costo en el insumo o producto —que es lo que usa la rentabilidad—
 * y deja por pagar lo que no se pagó de contado.
 */
router.use(tenantAuth, (req, res, next) => {
  if (req.user?.scope === 'pos') return res.status(403).json({ message: 'Esta consulta es del panel' });
  if (!req.user?.businessId && !req.query.businessId) return res.status(400).json({ message: 'businessId es requerido' });
  next();
});

const negocio = (req) => req.user.businessId || req.query.businessId;
const usuarioDe = (req) => req.user?.name || req.user?.username || '';

/* ── Proveedores ──────────────────────────────────────────────────────── */

router.get('/proveedores', async (req, res) => {
  try {
    const proveedores = await Proveedor.find({ businessId: negocio(req) }).sort({ activo: -1, nombre: 1 }).lean();
    /* Lo que se le debe a cada uno, en la misma respuesta: es lo primero que
       se mira al abrir la lista. */
    const deudas = await Compra.aggregate([
      { $match: { businessId: new mongoose.Types.ObjectId(String(negocio(req))), saldo: { $gt: 0 } } },
      { $group: { _id: '$proveedorId', saldo: { $sum: '$saldo' } } },
    ]);
    const porId = Object.fromEntries(deudas.map((d) => [String(d._id), d.saldo]));
    res.json({ proveedores: proveedores.map((p) => ({ ...p, saldo: porId[String(p._id)] || 0 })) });
  } catch (error) {
    logger.error('Error listando proveedores', error, req);
    res.status(500).json({ message: 'No se pudieron cargar los proveedores' });
  }
});

const camposProveedor = (b) => {
  const t = (v, n) => String(v ?? '').trim().slice(0, n);
  const c = {};
  if (b.nombre !== undefined) c.nombre = t(b.nombre, 80);
  for (const [k, n] of [['nit', 30], ['telefono', 30], ['contacto', 80], ['email', 120], ['notas', 300]]) {
    if (b[k] !== undefined) c[k] = t(b[k], n);
  }
  if (typeof b.activo === 'boolean') c.activo = b.activo;
  return c;
};

router.post('/proveedores', async (req, res) => {
  try {
    const c = camposProveedor(req.body || {});
    if (!c.nombre) return res.status(400).json({ message: 'Falta el nombre' });
    const p = await Proveedor.create({ ...c, businessId: negocio(req) });
    res.status(201).json({ proveedor: p });
  } catch (error) {
    logger.error('Error creando proveedor', error, req);
    res.status(500).json({ message: 'No se pudo crear el proveedor' });
  }
});

router.patch('/proveedores/:id', async (req, res) => {
  try {
    const c = camposProveedor(req.body || {});
    if (c.nombre === '') return res.status(400).json({ message: 'Falta el nombre' });
    const p = await Proveedor.findOneAndUpdate({ _id: req.params.id, businessId: negocio(req) }, { $set: c }, { new: true });
    if (!p) return res.status(404).json({ message: 'Proveedor no encontrado' });
    res.json({ proveedor: p });
  } catch (error) {
    logger.error('Error editando proveedor', error, req);
    res.status(500).json({ message: 'No se pudo guardar' });
  }
});

/* ── Qué se puede comprar: insumos y productos con inventario ─────────── */

router.get('/catalogo', async (req, res) => {
  try {
    const businessId = negocio(req);
    const q = String(req.query.q || '').trim().slice(0, 40);
    const re = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
    const [insumos, productos] = await Promise.all([
      Supply.find({ businessId, ...(re ? { name: re } : {}) }).select('name unit stock cost').limit(30).lean(),
      Product.find({ businessId, trackStock: true, ...(re ? { name: re } : {}) }).select('name stock cost').limit(30).lean(),
    ]);
    res.json({
      opciones: [
        ...insumos.map((s) => ({ tipo: 'insumo', refId: s._id, nombre: s.name, unidad: s.unit || '', stock: s.stock ?? 0, costo: s.cost })),
        ...productos.map((p) => ({ tipo: 'producto', refId: p._id, nombre: p.name, unidad: 'u', stock: p.stock ?? 0, costo: p.cost })),
      ],
    });
  } catch (error) {
    logger.error('Error buscando qué comprar', error, req);
    res.status(500).json({ message: 'No se pudo buscar' });
  }
});

/* ── Compras ──────────────────────────────────────────────────────────── */

router.get('/', async (req, res) => {
  try {
    const { inicio, fin } = rango({ desde: req.query.desde || '2000-01-01', hasta: req.query.hasta });
    const filtro = { businessId: negocio(req), fecha: { $gte: inicio, $lte: fin } };
    if (req.query.porPagar === '1') { delete filtro.fecha; filtro.saldo = { $gt: 0 }; }
    if (req.query.proveedorId) filtro.proveedorId = req.query.proveedorId;
    const compras = await Compra.find(filtro).sort({ fecha: -1 }).limit(300).lean();
    res.json({ compras, total: compras.reduce((t, c) => t + c.total, 0), porPagar: compras.reduce((t, c) => t + c.saldo, 0) });
  } catch (error) {
    logger.error('Error listando compras', error, req);
    res.status(500).json({ message: 'No se pudieron cargar las compras' });
  }
});

/**
 * Mete una línea de compra al inventario y deja su costo al día.
 *
 * El costo que queda es el **último**: es el que se va a pagar en la próxima
 * compra y el que refleja lo que cuesta hoy vender ese plato. Los insumos
 * siempre llevan su existencia; los productos solo si tienen control de
 * inventario.
 */
async function entrar(businessId, linea, nota, usuario) {
  const Modelo = linea.tipo === 'insumo' ? Supply : Product;
  const antes = await Modelo.findOneAndUpdate(
    { _id: linea.refId, businessId },
    [{
      $set: {
        cost: linea.costoUnitario,
        stock: linea.tipo === 'insumo'
          ? { $add: [{ $ifNull: ['$stock', 0] }, linea.cantidad] }
          : { $cond: [{ $eq: ['$trackStock', true] }, { $add: [{ $ifNull: ['$stock', 0] }, linea.cantidad] }, '$stock'] },
      },
    }],
    { new: false },
  ).select('name stock unit trackStock').lean();
  if (!antes) return false;
  if (linea.tipo === 'producto' && !antes.trackStock) return true;

  const a = antes.stock ?? 0;
  await StockMovement.create({
    businessId,
    ...(linea.tipo === 'insumo' ? { supplyId: linea.refId } : { productId: linea.refId }),
    productName: antes.name,
    unit: antes.unit || '',
    type: 'purchase',
    quantity: linea.cantidad,
    stockBefore: a,
    stockAfter: a + linea.cantidad,
    userName: usuario,
    note: nota.slice(0, 200),
  }).catch(() => {});
  return true;
}

router.post('/', async (req, res) => {
  try {
    const v = validarCompra(req.body);
    if (!v.ok) return res.status(400).json({ message: v.error });
    const businessId = negocio(req);
    const proveedor = await Proveedor.findOne({ _id: v.compra.proveedorId, businessId }).lean();
    if (!proveedor) return res.status(400).json({ message: 'Ese proveedor no existe' });

    const usuario = usuarioDe(req);
    const compra = await Compra.create({
      businessId,
      proveedorId: proveedor._id,
      proveedorNombre: proveedor.nombre,
      factura: v.compra.factura,
      fecha: v.compra.fecha,
      lineas: v.compra.lineas,
      total: v.compra.total,
      pagado: v.compra.pagado,
      saldo: v.compra.saldo,
      pagos: v.compra.pagado > 0 ? [{ monto: v.compra.pagado, medio: v.compra.medioPago, usuario }] : [],
      notas: v.compra.notas,
      usuario,
    });

    const nota = `Compra a ${proveedor.nombre}${v.compra.factura ? ` · Fact. ${v.compra.factura}` : ''}`;
    const resultados = await Promise.all(v.compra.lineas.map((l) => entrar(businessId, l, nota, usuario)));
    const perdidas = v.compra.lineas.filter((_, i) => !resultados[i]).map((l) => l.nombre);
    if (perdidas.length) logger.warn('Líneas de compra sin producto', { businessId: String(businessId), perdidas });

    res.status(201).json({ compra, sinInventario: perdidas });
  } catch (error) {
    logger.error('Error registrando una compra', error, req);
    res.status(500).json({ message: 'No se pudo registrar la compra' });
  }
});

/* Un pago al proveedor sobre una compra que quedó debiéndose. */
router.post('/:id/pago', async (req, res) => {
  try {
    const monto = Math.round(Number(req.body?.monto) || 0);
    if (monto <= 0) return res.status(400).json({ message: 'El monto no es válido' });
    const compra = await Compra.findOne({ _id: req.params.id, businessId: negocio(req) });
    if (!compra) return res.status(404).json({ message: 'Compra no encontrada' });
    if (compra.saldo <= 0) return res.status(400).json({ message: 'Esa compra ya está pagada' });
    const pago = Math.min(monto, compra.saldo);
    compra.pagos.push({ monto: pago, medio: String(req.body?.medio || 'efectivo').slice(0, 20), nota: String(req.body?.nota || '').slice(0, 200), usuario: usuarioDe(req) });
    compra.pagado += pago;
    compra.saldo -= pago;
    await compra.save();
    res.json({ compra });
  } catch (error) {
    logger.error('Error registrando pago a proveedor', error, req);
    res.status(500).json({ message: 'No se pudo registrar el pago' });
  }
});

/* ── Qué comprar: lo que está en o por debajo de su mínimo ────────────── */

router.get('/reposicion', async (req, res) => {
  try {
    const businessId = negocio(req);
    const [insumos, productos] = await Promise.all([
      Supply.find({ businessId, lowStockAlert: { $gt: 0 } }).select('name unit stock cost lowStockAlert').lean(),
      Product.find({ businessId, trackStock: true, lowStockAlert: { $gt: 0 } }).select('name stock cost lowStockAlert').lean(),
    ]);
    const filas = [
      ...insumos.map((s) => ({ tipo: 'insumo', refId: s._id, nombre: s.name, unidad: s.unit || '', stock: s.stock ?? 0, minimo: s.lowStockAlert, costo: s.cost })),
      ...productos.map((p) => ({ tipo: 'producto', refId: p._id, nombre: p.name, unidad: 'u', stock: p.stock ?? 0, minimo: p.lowStockAlert, costo: p.cost })),
    ]
      .map((f) => ({ ...f, sugerido: sugerido(f.stock, f.minimo) }))
      .filter((f) => f.sugerido > 0);

    /* A quién se le compró la última vez, para armar el pedido de una. */
    const ultimas = await Compra.aggregate([
      { $match: { businessId: new mongoose.Types.ObjectId(String(businessId)) } },
      { $sort: { fecha: -1 } },
      { $unwind: '$lineas' },
      { $group: { _id: '$lineas.refId', proveedorId: { $first: '$proveedorId' }, proveedor: { $first: '$proveedorNombre' }, costo: { $first: '$lineas.costoUnitario' } } },
    ]);
    const porRef = Object.fromEntries(ultimas.map((u) => [String(u._id), u]));
    res.json({
      reposicion: filas.map((f) => ({
        ...f,
        ultimoProveedorId: porRef[String(f.refId)]?.proveedorId || null,
        ultimoProveedor: porRef[String(f.refId)]?.proveedor || '',
        ultimoCosto: porRef[String(f.refId)]?.costo ?? f.costo ?? null,
      })),
    });
  } catch (error) {
    logger.error('Error calculando la reposición', error, req);
    res.status(500).json({ message: 'No se pudo calcular qué comprar' });
  }
});

module.exports = router;
