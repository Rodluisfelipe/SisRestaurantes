const jwt = require('jsonwebtoken');

/**
 * La cuenta del cliente en el menú, sin códigos por SMS ni WhatsApp.
 *
 * El problema: todo lo del cliente (sus datos, pedidos, favoritos, puntos) se
 * pedía con el teléfono y nada más. Quien supiera un número —o probara
 * números— veía la dirección de esa persona, sus pedidos, las notas que el
 * personal escribe sobre ella, y podía gastarle los puntos.
 *
 * La solución sin costo: la cuenta se abre en el celular desde el que se hizo
 * un pedido. Al crear el pedido, el servidor le entrega a ese celular una
 * *llave* firmada con el negocio y el teléfono. Con ella ve y edita su cuenta;
 * sin ella, saber el número no sirve de nada.
 *
 * La llave se firma con un secreto derivado, distinto del de las sesiones del
 * panel: aunque alguien la pusiera en `Authorization`, nunca valdría como
 * sesión del personal.
 */

const CABECERA = 'x-cuenta';
const VIGENCIA = '400d';

function secreto() {
  const base = process.env.JWT_SECRET;
  if (!base) throw new Error('JWT_SECRET no está configurado');
  return `${base}:cuenta-cliente`;
}

/** El teléfono tal como se compara: sin espacios, guiones ni paréntesis. */
function normalizarTelefono(telefono) {
  return String(telefono || '').replace(/[\s\-().]/g, '').trim();
}

/* La llave guarda el teléfono tal como quedó en el pedido (los teléfonos no se
   guardan normalizados), para buscar con él exactamente lo mismo. Solo al
   comparar se normalizan los dos lados. */
function emitirLlave({ businessId, telefono }) {
  const p = String(telefono || '').trim();
  if (!businessId || !normalizarTelefono(p)) return null;
  return jwt.sign({ tipo: 'cuenta', b: String(businessId), p }, secreto(), { expiresIn: VIGENCIA });
}

/** La cuenta que abre la llave de esta petición, o null si no hay o no vale. */
function leerLlave(req) {
  const llave = req.headers?.[CABECERA];
  if (!llave || typeof llave !== 'string') return null;
  try {
    const d = jwt.verify(llave, secreto());
    if (d?.tipo !== 'cuenta' || !d.b || !d.p) return null;
    return { businessId: d.b, telefono: d.p };
  } catch {
    return null;
  }
}

/** ¿La llave de esta petición abre la cuenta de ese teléfono en ese negocio? */
function abreCuenta(req, businessId, telefono) {
  const cuenta = leerLlave(req);
  if (!cuenta) return false;
  return cuenta.businessId === String(businessId)
    && normalizarTelefono(cuenta.telefono) === normalizarTelefono(telefono);
}

/** Middleware: sin llave válida no se entra. Deja la cuenta en `req.cuenta`. */
function requiereCuenta(req, res, next) {
  const cuenta = leerLlave(req);
  if (!cuenta) {
    return res.status(401).json({
      codigo: 'SIN_CUENTA',
      message: 'Tu cuenta se activa en este celular con tu primer pedido.',
    });
  }
  req.cuenta = cuenta;
  return next();
}

/* ── Lo que el cliente ve de sí mismo ─────────────────────────────────────
   Nunca las notas del personal, ni el estado interno (vip), ni los totales
   que usa el negocio para segmentar. */
function perfilParaCliente(c) {
  if (!c) return null;
  return {
    nombre: c.name || '',
    telefono: c.phone || '',
    email: c.email || '',
    documento: c.documento || '',
    tipoDocumento: c.tipoDocumento || 'CC',
    direcciones: direccionesDe(c),
    saldoFavor: Number(c.saldoFavor) || 0,
    credito: c.credito?.habilitado
      ? { cupo: Number(c.credito.cupo) || 0, saldo: Number(c.credito.saldo) || 0 }
      : null,
  };
}

/** Las direcciones guardadas; la dirección única de antes cuenta como "Casa". */
function direccionesDe(c) {
  const lista = Array.isArray(c?.direcciones) ? c.direcciones : [];
  if (lista.length) {
    return lista.map((d) => ({
      id: String(d._id),
      etiqueta: d.etiqueta || 'Dirección',
      texto: d.texto || '',
      referencia: d.referencia || '',
      principal: !!d.principal,
    }));
  }
  if (c?.address) return [{ id: 'anterior', etiqueta: 'Casa', texto: c.address, referencia: '', principal: true }];
  return [];
}

const MAX_DIRECCIONES = 8;

/** Valida una dirección que manda el cliente; devuelve el error o la dirección limpia. */
function limpiarDireccion(entrada) {
  const etiqueta = String(entrada?.etiqueta || '').trim().slice(0, 30);
  const texto = String(entrada?.texto || '').trim().slice(0, 200);
  const referencia = String(entrada?.referencia || '').trim().slice(0, 200);
  if (texto.length < 5) return { error: 'Escribe la dirección completa' };
  return { direccion: { etiqueta: etiqueta || 'Dirección', texto, referencia, principal: !!entrada?.principal } };
}

/** Un pedido como lo ve su dueño: sin los datos internos del negocio. */
function pedidoParaCliente(p) {
  return {
    id: String(p._id),
    numero: p.orderNumber,
    estado: p.status,
    tipo: p.orderType,
    total: Number(p.finalAmount ?? p.totalAmount) || 0,
    fecha: p.completedAt || p.createdAt,
    items: (p.items || []).map((i) => ({
      productId: i.productId ? String(i.productId) : null,
      nombre: i.name,
      cantidad: i.quantity,
      precio: i.price,
      variante: i.variante || null,
      selectedToppings: i.selectedToppings || [],
      selectedOptions: i.selectedOptions || {},
      notas: i.notes || '',
    })),
    // El token de seguimiento es de su dueño: con él se sube el comprobante.
    ...(p.customerToken ? { seguimiento: p.customerToken } : {}),
  };
}

module.exports = {
  CABECERA,
  MAX_DIRECCIONES,
  normalizarTelefono,
  emitirLlave,
  leerLlave,
  abreCuenta,
  requiereCuenta,
  perfilParaCliente,
  direccionesDe,
  limpiarDireccion,
  pedidoParaCliente,
};
