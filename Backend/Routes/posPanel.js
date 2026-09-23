const express = require('express');
const router = express.Router();
const { tenantAuth } = require('../middleware/tenantAuth');
const CompletedOrder = require('../Models/CompletedOrder');
const CashRegister = require('../Models/CashRegister');
const PosExcepcion = require('../Models/PosExcepcion');
const PosDevolucion = require('../Models/PosDevolucion');
const PosCaja = require('../Models/PosCaja');
const logger = require('../utils/logger');

/**
 * La sección "Punto de venta" del panel: todo lo de la caja nativa en un
 * solo lugar —ventas, cierres, auditoría, devoluciones—.
 *
 * Antes estaba repartido: los cierres de la caja salían mezclados con los del
 * POS web (y escondidos si el negocio no tenía ese beta), la auditoría tenía
 * API pero ninguna pantalla, y las devoluciones de caja no se veían en ningún
 * lado. Los informes de ventas siguen en Completados, donde se juntan la caja
 * y el menú: esto es para **operar** la caja, no para sumar el negocio.
 *
 * Es del panel y solo del panel. Un token de caja no pasa (alcanceCaja ya lo
 * limita a /api/pos/, y aquí se comprueba otra vez): una caja robada no puede
 * servir para auditar al negocio.
 */

router.use(tenantAuth, (req, res, next) => {
  if (req.user?.scope === 'pos' || req.caja) {
    return res.status(403).json({ message: 'Esta consulta es del panel', motivo: 'fuera_de_alcance' });
  }
  if (!req.user?.businessId && !req.query.businessId) {
    return res.status(400).json({ message: 'businessId es requerido' });
  }
  next();
});

const negocio = (req) => req.user.businessId || req.query.businessId;

/* Colombia no tiene horario de verano: el día del negocio va de 00:00 a 23:59
   en UTC-5, siempre. */
const DIA = /^\d{4}-\d{2}-\d{2}$/;

function hoyBogota() {
  return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * El rango de fechas pedido, como instantes. Hasta 93 días: un trimestre es
 * lo más largo que alguien revisa en detalle, y más que eso es un informe.
 */
function rango(query) {
  const desde = DIA.test(query.desde || '') ? query.desde : hoyBogota();
  const hasta = DIA.test(query.hasta || '') ? query.hasta : desde;
  let inicio = new Date(`${desde}T00:00:00-05:00`);
  const fin = new Date(`${hasta}T23:59:59.999-05:00`);
  if (fin < inicio) inicio = new Date(`${hasta}T00:00:00-05:00`);
  const maximo = 93 * 24 * 3600 * 1000;
  if (fin - inicio > maximo) inicio = new Date(fin.getTime() - maximo);
  return { inicio, fin };
}

/** De dónde sale el dinero de una venta: sus pagos, o el medio único. */
function pagosDe(venta) {
  if (Array.isArray(venta.posPagos) && venta.posPagos.length) {
    return venta.posPagos.map((p) => ({ metodo: p.metodo || 'otro', monto: Number(p.monto) || 0 }));
  }
  return [{ metodo: venta.paymentMethod || 'efectivo', monto: Number(venta.finalAmount) || 0 }];
}

/**
 * El resumen de lo que pasó en la caja en un rango. Puro, para probarlo sin
 * base de datos.
 */
function resumir({ ventas, cierres, excepciones, devoluciones }) {
  const porMedio = {};
  let total = 0;
  let propinas = 0;
  let descuentos = 0;
  for (const v of ventas) {
    total += Number(v.finalAmount) || 0;
    propinas += Number(v.tipAmount) || 0;
    descuentos += Number(v.discountAmount) || 0;
    for (const p of pagosDe(v)) {
      const fila = porMedio[p.metodo] || { metodo: p.metodo, ventas: 0, total: 0 };
      fila.ventas += 1;
      fila.total += p.monto;
      porMedio[p.metodo] = fila;
    }
  }

  const porTipo = {};
  for (const x of excepciones) {
    const fila = porTipo[x.tipo] || { tipo: x.tipo, veces: 0, monto: 0 };
    fila.veces += 1;
    fila.monto += Number(x.monto) || 0;
    porTipo[x.tipo] = fila;
  }

  return {
    ventas: {
      cantidad: ventas.length,
      total,
      ticketPromedio: ventas.length ? Math.round(total / ventas.length) : 0,
      propinas,
      descuentos,
      porMedio: Object.values(porMedio).sort((a, b) => b.total - a.total),
    },
    cierres: {
      cantidad: cierres.length,
      conDescuadre: cierres.filter((c) => Math.round(Number(c.difference) || 0) !== 0).length,
      diferencia: cierres.reduce((t, c) => t + (Number(c.difference) || 0), 0),
    },
    auditoria: Object.values(porTipo),
    devoluciones: {
      cantidad: devoluciones.length,
      total: devoluciones.reduce((t, d) => t + (Number(d.total) || 0), 0),
    },
  };
}

/* Las ventas de la caja nativa: son las que traen el id de venta del POS. */
const deLaCaja = (businessId) => ({ businessId, posSaleId: { $exists: true, $ne: null } });

router.get('/resumen', async (req, res) => {
  try {
    const businessId = negocio(req);
    const { inicio, fin } = rango(req.query);
    const [ventas, cierres, excepciones, devoluciones, cajas] = await Promise.all([
      CompletedOrder.find({ ...deLaCaja(businessId), completedAt: { $gte: inicio, $lte: fin } })
        .select('finalAmount tipAmount discountAmount paymentMethod posPagos')
        .lean(),
      CashRegister.find({ businessId, status: 'closed', closedAt: { $gte: inicio, $lte: fin } })
        .select('difference')
        .lean(),
      PosExcepcion.find({ businessId, ocurridaEn: { $gte: inicio, $lte: fin } }).select('tipo monto').lean(),
      PosDevolucion.find({ businessId, createdAt: { $gte: inicio, $lte: fin } }).select('total').lean(),
      PosCaja.countDocuments({ businessId, revocada: { $ne: true } }),
    ]);
    res.json({ desde: inicio, hasta: fin, cajas, ...resumir({ ventas, cierres, excepciones, devoluciones }) });
  } catch (error) {
    logger.error('Error armando el resumen del POS', error, req);
    res.status(500).json({ message: 'No se pudo cargar el resumen' });
  }
});

router.get('/cierres', async (req, res) => {
  try {
    const businessId = negocio(req);
    const { inicio, fin } = rango({ desde: req.query.desde || '2000-01-01', hasta: req.query.hasta || hoyBogota() });
    const limite = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const pagina = Math.max(1, parseInt(req.query.page, 10) || 1);
    /* Los dos: la caja nativa y el POS web. La migración de uno al otro va
       de a poco, y mientras dure el dueño tiene que ver todos sus cierres en
       un solo lugar. `origen` filtra si quiere ver solo uno. */
    const filtro = { businessId, status: 'closed', closedAt: { $gte: inicio, $lte: fin } };
    if (req.query.origen === 'pos-nativo') filtro.origen = 'pos-nativo';
    if (req.query.origen === 'web') filtro.origen = { $ne: 'pos-nativo' };
    const [cierres, total] = await Promise.all([
      CashRegister.find(filtro)
        .sort({ closedAt: -1 })
        .skip((pagina - 1) * limite)
        .limit(limite)
        .populate('openedBy', 'name username')
        .populate('closedBy', 'name username')
        .lean(),
      CashRegister.countDocuments(filtro),
    ]);
    res.json({ cierres, total, pagina, paginas: Math.ceil(total / limite) });
  } catch (error) {
    logger.error('Error listando cierres del POS', error, req);
    res.status(500).json({ message: 'No se pudieron cargar los cierres' });
  }
});

router.get('/auditoria', async (req, res) => {
  try {
    const businessId = negocio(req);
    const { inicio, fin } = rango(req.query);
    const filtro = { businessId, ocurridaEn: { $gte: inicio, $lte: fin } };
    if (req.query.tipo) filtro.tipo = String(req.query.tipo);
    const excepciones = await PosExcepcion.find(filtro).sort({ ocurridaEn: -1 }).limit(500).lean();

    /* Por cajero, lo que mueve o esconde plata: anulaciones, borrados y
       descuentos. "Ana borró 12 veces por 300.000" se lee de un vistazo. */
    const porCajero = {};
    for (const x of excepciones) {
      if (!['anular_item', 'anular_borrador', 'descuento'].includes(x.tipo)) continue;
      const fila = porCajero[x.cajero] || { cajero: x.cajero, veces: 0, monto: 0 };
      fila.veces += 1;
      fila.monto += x.monto || 0;
      porCajero[x.cajero] = fila;
    }
    res.json({ excepciones, porCajero: Object.values(porCajero).sort((a, b) => b.monto - a.monto) });
  } catch (error) {
    logger.error('Error listando la auditoría del POS', error, req);
    res.status(500).json({ message: 'No se pudo cargar la auditoría' });
  }
});

router.get('/devoluciones', async (req, res) => {
  try {
    const businessId = negocio(req);
    const { inicio, fin } = rango(req.query);
    const devoluciones = await PosDevolucion.find({ businessId, createdAt: { $gte: inicio, $lte: fin } })
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();
    res.json({ devoluciones });
  } catch (error) {
    logger.error('Error listando devoluciones del POS', error, req);
    res.status(500).json({ message: 'No se pudieron cargar las devoluciones' });
  }
});

router.get('/ventas', async (req, res) => {
  try {
    const businessId = negocio(req);
    const { inicio, fin } = rango(req.query);
    const limite = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const pagina = Math.max(1, parseInt(req.query.page, 10) || 1);
    const filtro = { ...deLaCaja(businessId), completedAt: { $gte: inicio, $lte: fin } };
    const [ventas, total] = await Promise.all([
      CompletedOrder.find(filtro)
        .select('orderNumber completedAt finalAmount totalAmount discountAmount discountReason tipAmount paymentMethod posPagos items.name items.quantity items.price items.selectedToppings posImpuestos')
        .sort({ completedAt: -1 })
        .skip((pagina - 1) * limite)
        .limit(limite)
        .lean(),
      CompletedOrder.countDocuments(filtro),
    ]);
    res.json({ ventas, total, pagina, paginas: Math.ceil(total / limite) });
  } catch (error) {
    logger.error('Error listando ventas del POS', error, req);
    res.status(500).json({ message: 'No se pudieron cargar las ventas' });
  }
});

router.resumir = resumir;
router.rango = rango;
module.exports = router;
