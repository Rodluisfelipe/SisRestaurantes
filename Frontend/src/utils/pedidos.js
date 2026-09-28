import { FaPlay, FaCheck, FaCheckCircle, FaMotorcycle } from 'react-icons/fa';
import { ORDER_STATUS } from './constants';

/**
 * Lo que vale un pedido para el cliente: productos + envío − descuento +
 * propina. Un solo cálculo para la tarjeta, el detalle y el recibo.
 *
 * Antes cada pantalla sumaba a su manera: la tarjeta ignoraba la propina y
 * el descuento manual (solo restaba si había cupón) y el recibo del navegador
 * podía tomar el subtotal como total. El servidor guarda `finalAmount` ya
 * calculado; se usa ese cuando está.
 */
export function totalDelPedido(o) {
  if (!o) return 0;
  if (typeof o.finalAmount === 'number' && o.finalAmount > 0) return Math.round(o.finalAmount);
  return Math.max(0, Math.round(
    (o.totalAmount || 0) + (o.deliveryFee || 0) - (o.discountAmount || 0) + (o.tipAmount || 0),
  ));
}

/**
 * Precio de una unidad con sus opciones (tocineta, queso extra…). Mismo
 * cálculo que `lineTotal` en Backend/Routes/orders/compartido.js: antes la
 * línea mostraba solo el precio base y no cuadraba con el total.
 */
export function precioConOpciones(item) {
  const opciones = (item?.selectedToppings || []).reduce((suma, t) => {
    const sub = Array.isArray(t.subGroups) ? t.subGroups.reduce((s2, sg) => s2 + (Number(sg.price) || 0), 0) : 0;
    return suma + (Number(t.price) || 0) + sub;
  }, 0);
  return (Number(item?.price) || 0) + opciones;
}

export const totalDeLinea = (item) => precioConOpciones(item) * (Number(item?.quantity) || 0);

/** "$18.000", "$8.000". Agrupado a mano: según el navegador, toLocaleString
    dejaba "8000" sin punto y "18.000" con punto en la misma pantalla. */
export const pesos = (n) => {
  const v = Math.round(Number(n) || 0);
  const txt = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${v < 0 ? '-' : ''}$${txt}`;
};

/**
 * Qué puede pasar ahora con el pedido, en el orden en que se hace. El primero
 * es el paso normal (va lleno: azul avanza, verde cierra); los demás son
 * atajos y van claros. Son los saltos que acepta VALID_TRANSITIONS en el
 * servidor. La tarjeta y el detalle usan esta misma lista, con los mismos
 * nombres: antes cada uno decía una cosa distinta para el mismo botón.
 */
export function pasosDelPedido(o) {
  if (!o) return [];
  const S = ORDER_STATUS;
  const enMesa = o.orderType === 'inSite';
  const cerrar = {
    to: S.COMPLETED,
    label: enMesa ? 'Servido' : 'Entregado',
    Icon: FaCheck,
    tono: 'verde',
  };
  const preparar = { to: S.IN_PROGRESS, label: 'Empezar a preparar', Icon: FaPlay, tono: 'azul' };
  const listo = o.orderType === 'delivery'
    ? { to: S.READY, label: 'Salió a domicilio', Icon: FaMotorcycle, tono: 'azul' }
    : o.orderType === 'takeaway'
      ? { to: S.READY, label: 'Listo para recoger', Icon: FaCheck, tono: 'azul' }
      : null;

  switch (o.status) {
    case S.PENDING_PAYMENT:
      return [{ to: S.PAYMENT_CONFIRMED, label: 'Confirmar pago', Icon: FaCheckCircle, tono: 'verde' }];
    case S.PENDING:
    case S.PAYMENT_CONFIRMED:
      return [preparar];
    case S.CONFIRMED:
      return [preparar, { ...cerrar, tono: 'claro' }];
    case S.IN_PROGRESS:
    case S.PREPARING:
      return listo ? [listo, { ...cerrar, tono: 'claro' }] : [cerrar];
    case S.READY:
      return [cerrar];
    default:
      return [];
  }
}

export const TONOS_PASO = {
  azul: 'bg-blue-600 hover:bg-blue-700 text-white',
  verde: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  claro: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200',
};

/** Para meter texto del cliente en HTML armado a mano (el recibo impreso). */
export function escaparHtml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
