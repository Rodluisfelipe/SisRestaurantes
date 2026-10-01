import React from 'react';
import { motion } from 'framer-motion';
import {
  FaUser, FaMapMarkerAlt, FaTruck, FaEye,
  FaChair, FaHome, FaExclamationTriangle, FaTimes,
  FaMoneyBillWave, FaImage, FaTimesCircle, FaCheckCircle, FaPrint, FaMotorcycle,
  FaCreditCard, FaCommentDots,
} from 'react-icons/fa';
import { ORDER_STATUS } from '../utils/constants';
import { pasosDelPedido, TONOS_PASO, totalDelPedido, pesos } from '../utils/pedidos';
import api from '../services/api';
import DomiciliarioActivos from './DomiciliarioActivos';

const PAYMENT_LABELS = {
  cash: 'Efectivo', efectivo: 'Efectivo',
  nequi: 'Nequi', daviplata: 'Daviplata',
  transfer: 'Transferencia', transferencia: 'Transferencia',
  roomCharge: 'Cargo a habitación', credito: 'Crédito', other: 'Otro'
};

function OrderCard({
  order, viewMode, cardVariants, isService, businessType,
  orderTypeInfo, statusInfo, timeElapsed, isPending,
  onShowDetails, onPrint, onShowProof, onUpdateStatus,
  onConfirmPayment, onRejectPayment, onAssignDelivery, onOpenChat,
  tienda = false, onDespachar,
}) {
  const customerMsgCount = (order.messages || []).filter(m => m.sender === 'customer').length;
  const StatusIcon = statusInfo.Icon;
  const TypeIcon = orderTypeInfo.Icon;
  const hasChat = order.orderChannel === 'inapp';
  const isTerminal = ['completed', 'delivered', 'cancelled'].includes(order.status);

  /* Los pasos siguientes, los mismos del detalle (utils/pedidos). El primero
     es el normal (lleno); los demás, atajos claros. */
  const S = ORDER_STATUS;
  const nextSteps = pasosDelPedido(order);
  const total = totalDelPedido(order);

  /* Domicilio sin domiciliario (MenuBy Go): "Asignar". Con domiciliario que
     aún no lo recoge: "Cambiar", por si hay que pasárselo a otro. */
  const domicilioAbierto = order.orderType === 'delivery' && !isTerminal
    && [S.PENDING, S.CONFIRMED, S.PREPARING, S.READY, S.IN_PROGRESS].filter(Boolean).includes(order.status);
  const needsDelivery = domicilioAbierto && !order.deliveryPersonId;
  const cambiarDomi = domicilioAbierto && !!order.deliveryPersonId && !order.deliveryPickedAt;

  /* Tiendas: un envío no se "asigna a un domiciliario", se entrega a una
     transportadora y queda un número de guía. Mientras no lo tenga, despachar
     es la acción que falta; cuando lo tiene, lo que importa es verlo. */
  const despachado = !!order.envio?.guia;


  // Qué pidió, de un vistazo (cocina no tiene que abrir el detalle).
  const items = order.items || [];
  const unidades = items.reduce((n, it) => n + (Number(it.quantity) || 1), 0);
  const cancelar = () => { if (window.confirm('¿Cancelar pedido #' + order.orderNumber + '?')) onUpdateStatus(order._id, ORDER_STATUS.CANCELLED); };
  const porDespachar = tienda && order.orderType === 'delivery' && !despachado && !isTerminal;

  return (
    <motion.div
      key={order._id}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={`bg-white rounded-2xl lg:rounded-xl overflow-hidden transition-all duration-150 ${
        isPending
          ? 'border border-yellow-300/60 lg:border-yellow-300 ring-1 ring-yellow-100'
          : 'border border-slate-100 lg:border-slate-200 hover:border-slate-300'
      } ${viewMode === 'list' ? 'p-3' : 'p-0'}`}
    >
      {viewMode === 'grid' ? (
        <>
          {/* ── Header ── */}
          <div className={`px-3 py-2 ${
            isPending
              ? 'bg-yellow-50/80 border-b border-yellow-200/60'
              : 'bg-slate-50/50 border-b border-slate-100/60'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-7 h-7 ${orderTypeInfo.color} rounded-lg flex items-center justify-center shrink-0`}>
                  <TypeIcon className="text-white text-xs" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-bold text-slate-800 text-sm leading-tight">#{order.orderNumber}</h3>
                    <span className="text-2xs text-slate-400 font-medium">{orderTypeInfo.label}</span>
                    {/* De qué enlace llegó el cliente. El dato ya venía guardado
                        en cada pedido; sin mostrarlo, el negocio no podía saber
                        qué canal le trajo ESE pedido, solo el total del mes. */}
                    {order.source && (
                      <span
                        title={`Llegó por: ${order.source}`}
                        className="text-2xs font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 break-all"
                      >
                        {order.source}
                      </span>
                    )}
                    {order.isGift && (
                      <span className="text-2xs font-bold px-1.5 py-0.5 rounded-full bg-pink-100 text-pink-700 border border-pink-200">🎁 Regalo</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {hasChat && !isTerminal && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenChat?.(order); }}
                    className="relative w-8 h-8 bg-blue-100 hover:bg-blue-200 rounded-full flex items-center justify-center transition-colors"
                    title="Abrir chat con el cliente"
                    aria-label="Abrir chat con el cliente"
                  >
                    <FaCommentDots className="text-xs text-blue-600" />
                    {customerMsgCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-2xs font-bold rounded-full flex items-center justify-center">{customerMsgCount}</span>
                    )}
                  </button>
                )}
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs font-bold ${
                  isPending
                    ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                    : statusInfo.bgColor + ' ' + statusInfo.textColor
                }`}>
                  <StatusIcon className="text-2xs" /> {statusInfo.label}
                </span>
                <span className={`text-2xs font-medium tabular-nums ${
                  isPending ? 'text-yellow-600' : 'text-slate-400'
                }`}>
                  {timeElapsed}
                </span>
              </div>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="px-3 py-2.5">
            {/* Cliente */}
            <div className="flex items-center gap-1.5">
              <FaUser className="text-2xs text-slate-300 shrink-0" />
              <span className="text-[13px] font-semibold text-slate-800 break-words min-w-0">{order.customerName}</span>
              {order.phone && (
                <a href={`tel:${order.phone}`} className="ml-auto text-[11px] text-slate-400 hover:text-blue-500 shrink-0 tabular-nums">
                  {order.phone}
                </a>
              )}
            </div>

            {/* Dónde: mesa o dirección, en su propia línea */}
            {order.tableNumber && (
              <p className="mt-1 flex items-center gap-1.5 text-[12px] text-slate-600">
                <FaChair className="text-2xs text-slate-300 shrink-0" /> {businessType === 'hotel' ? 'Habitación' : 'Mesa'} {order.tableNumber}
              </p>
            )}
            {order.orderType === 'delivery' && order.address && (
              <div className="mt-1 flex items-start gap-1.5 text-[12px] text-slate-600 min-w-0">
                <FaHome className="text-2xs text-slate-300 shrink-0 mt-[3px]" />
                <span className="leading-snug break-words min-w-0">{order.address}</span>
                {order.deliveryCoordinates?.lat && (
                  <a
                    href={`https://maps.google.com/?q=${order.deliveryCoordinates.lat},${order.deliveryCoordinates.lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="ml-auto shrink-0 inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-700 font-semibold"
                    title="Abrir en Google Maps"
                  >
                    <FaMapMarkerAlt className="text-2xs" /> Maps
                  </a>
                )}
              </div>
            )}

            {/* Domiciliario con Activos (solo si el negocio lo tiene habilitado) */}
            {!isTerminal && <DomiciliarioActivos order={order} />}

            {/* Datos cortos en fichas */}
            {(order.deliveryZoneName || order.deliveryFee > 0 || order.paymentMethod) && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {order.orderType === 'delivery' && order.deliveryZoneName && (
                  <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md bg-slate-50 border border-slate-100 text-2xs font-medium text-slate-600">
                    <FaMapMarkerAlt className="text-2xs text-slate-400" /> {order.deliveryZoneName}
                  </span>
                )}
                {order.orderType === 'delivery' && order.deliveryFee > 0 && (
                  <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md bg-slate-50 border border-slate-100 text-2xs font-medium text-slate-600">
                    <FaTruck className="text-2xs text-slate-400" /> Envío {pesos(order.deliveryFee)}
                  </span>
                )}
                {order.paymentMethod && (
                  <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md bg-slate-50 border border-slate-100 text-2xs font-medium text-slate-600">
                    <FaCreditCard className="text-2xs text-slate-400" /> {PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}
                  </span>
                )}
              </div>
            )}

            {/* Lo que pidió */}
            {items.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {items.slice(0, 2).map((it, k) => (
                  <li key={it._id || k} className="flex items-baseline gap-1.5 text-[12px] text-slate-700 min-w-0">
                    <span className="font-bold text-slate-500 tabular-nums shrink-0">{it.quantity || 1}×</span>
                    <span className="leading-snug line-clamp-2 min-w-0">{it.name}</span>
                    {it.selectedToppings?.length > 0 && <span className="text-2xs text-slate-400 shrink-0">+{it.selectedToppings.length}</span>}
                  </li>
                ))}
                {items.length > 2 && <li className="text-2xs text-slate-400 pl-4">y {items.length - 2} más</li>}
              </ul>
            )}

            <div className="mb-2" />

            {order.orderType === 'delivery' && order.deliveryNeedsConfirmation && (
              <div className="flex items-center gap-1.5 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 mb-2">
                <FaExclamationTriangle className="text-2xs text-amber-500 shrink-0" />
                <span className="text-2xs font-semibold text-amber-700">Envío por confirmar</span>
              </div>
            )}

            {/* Gift recipient info */}
            {order.isGift && order.gift && (
              <div className="mb-2 p-2 rounded-lg bg-pink-50 border border-pink-200 space-y-1">
                <p className="text-2xs font-bold text-pink-700">
                  🎁 Regalo para {order.gift.recipientName}{order.gift.recipientPhone ? ` · ${order.gift.recipientPhone}` : ''}
                </p>
                {order.gift.message && <p className="text-2xs text-pink-600 italic">"{order.gift.message}"</p>}
                {order.gift.hidePrices && <p className="text-2xs text-pink-500 font-semibold">⚠️ No incluir precios en la entrega</p>}
              </div>
            )}

            {/* ── Total bar ── */}
            <div className={`flex items-center justify-between py-1.5 border-t ${
              isPending ? 'border-yellow-200' : 'border-slate-100'
            }`}>
              <span className="text-[11px] text-slate-400">{unidades} {isService ? (unidades === 1 ? 'servicio' : 'servicios') : (unidades === 1 ? 'producto' : 'productos')}</span>
              <div className="text-right">
                {order.deliveryNeedsConfirmation && !order.deliveryFee ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-bold text-slate-800">{pesos(total)}</span>
                    <span className="text-2xs text-amber-600 font-semibold">+ envío</span>
                  </div>
                ) : (
                  <span className="text-sm font-bold text-slate-800 tabular-nums">{pesos(total)}</span>
                )}
                {(order.discountAmount > 0 || order.tipAmount > 0) && (
                  <p className="text-2xs text-slate-400">
                    {order.discountAmount > 0 && `−${pesos(order.discountAmount)} desc.`}
                    {order.discountAmount > 0 && order.tipAmount > 0 && ' · '}
                    {order.tipAmount > 0 && `+${pesos(order.tipAmount)} propina`}
                  </p>
                )}
              </div>
            </div>

            {/* ═══ Acciones ═══ */}
            <div className="pt-2 space-y-1.5">
              {order.status === ORDER_STATUS.PAYMENT_UPLOADED && (
                <div className="flex gap-1.5">
                  <button onClick={() => onConfirmPayment(order._id)} className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white h-10 rounded-xl text-xs font-bold transition-colors active:scale-[0.97]">
                    <FaCheckCircle className="text-2xs" /> Confirmar pago
                  </button>
                  <button onClick={() => onRejectPayment(order._id)} className="flex items-center justify-center gap-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 px-4 h-10 rounded-xl text-xs font-bold transition-colors active:scale-[0.97]">
                    <FaTimesCircle className="text-2xs" /> Rechazar
                  </button>
                </div>
              )}

              {needsDelivery && !tienda && (
                <button onClick={() => onAssignDelivery(order)} className="w-full flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 h-10 rounded-xl text-xs font-bold transition-colors active:scale-[0.97]">
                  <FaMotorcycle className="text-sm" /> Asignar domiciliario
                </button>
              )}
              {cambiarDomi && !tienda && (
                <button onClick={() => onAssignDelivery(order)} className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 h-9 rounded-xl text-xs font-bold transition-colors active:scale-[0.97]">
                  <FaMotorcycle className="text-sm" /> Domiciliario asignado · Ver o cambiar
                </button>
              )}

              {porDespachar && (
                <button onClick={() => onDespachar?.(order)} className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white h-10 rounded-xl text-xs font-bold transition-colors active:scale-[0.97]">
                  <FaTruck className="text-sm" /> Despachar con guía
                </button>
              )}

              {despachado && (
                <div className="w-full flex items-center justify-center gap-2 bg-violet-50 text-violet-700 py-2.5 rounded-xl text-[11.5px] font-bold">
                  <FaTruck className="text-[11px]" />
                  {order.envio.transportadora} · guía {order.envio.guia}
                </div>
              )}

              {nextSteps.length > 0 && (
                <div className={`grid gap-1.5 ${nextSteps.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {nextSteps.map(({ to, label, Icon, tono }) => (
                    <button
                      key={to}
                      onClick={() => onUpdateStatus(order._id, to)}
                      className={`flex items-center justify-center gap-1.5 min-h-11 py-2 px-2 rounded-xl text-[13px] font-bold leading-tight text-center transition-colors active:scale-[0.97] ${TONOS_PASO[tono]}`}
                    >
                      <Icon className="text-2xs shrink-0" /> <span>{label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Utilidades en una sola fila; cancelar al final, sin gritar */}
              <div className="flex gap-1.5">
                <button onClick={() => onShowDetails(order)} className="flex-1 flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-600 h-9 rounded-lg text-[11px] font-semibold border border-slate-200 transition-colors active:scale-[0.97]">
                  <FaEye className="text-2xs" /> Detalles
                </button>
                <button onClick={async () => { try { await api.post(`/print-agent/print-comanda/${order._id}`); } catch { onPrint(order); } }} className="flex-1 flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-600 h-9 rounded-lg text-[11px] font-semibold border border-slate-200 transition-colors active:scale-[0.97]" title="Imprimir comanda">
                  <FaPrint className="text-2xs" /> Comanda
                </button>
                {order.status !== ORDER_STATUS.PENDING && order.status !== 'pending_payment' && (
                  <button onClick={async () => { try { await api.post(`/print-agent/print-receipt/${order._id}`); } catch { onPrint(order); } }} className="flex-1 flex items-center justify-center gap-1.5 bg-white hover:bg-emerald-50 text-emerald-700 h-9 rounded-lg text-[11px] font-semibold border border-emerald-200 transition-colors active:scale-[0.97]" title="Imprimir recibo">
                    <FaMoneyBillWave className="text-2xs" /> Recibo
                  </button>
                )}
                {order.paymentProof && (
                  <button onClick={() => onShowProof(order.paymentProof)} className="flex-1 flex items-center justify-center gap-1.5 bg-white hover:bg-purple-50 text-purple-700 h-9 rounded-lg text-[11px] font-semibold border border-purple-200 transition-colors active:scale-[0.97]" title="Ver comprobante">
                    <FaImage className="text-2xs" /> Pago
                  </button>
                )}
                {!isTerminal && (
                  <button onClick={cancelar} className="w-9 h-9 shrink-0 flex items-center justify-center bg-white hover:bg-red-50 text-red-500 rounded-lg border border-red-200 transition-colors active:scale-[0.97]" title="Cancelar pedido" aria-label="Cancelar pedido">
                    <FaTimes className="text-xs" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* ══ List view ══ */
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 ${orderTypeInfo.color} rounded-lg flex items-center justify-center shrink-0`}>
              <TypeIcon className="text-white text-xs" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-sm">#{order.orderNumber}</h3>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs font-bold ${statusInfo.textColor} ${statusInfo.bgColor}`}>
                  <StatusIcon className="text-2xs" /> {statusInfo.label}
                </span>
                {order.isGift && (
                  <span className="text-2xs font-bold px-1.5 py-0.5 rounded-full bg-pink-100 text-pink-700 border border-pink-200">🎁</span>
                )}
                {hasChat && !isTerminal && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenChat?.(order); }}
                    className="relative w-7 h-7 bg-blue-100 hover:bg-blue-200 rounded-full flex items-center justify-center transition-colors"
                    title="Abrir chat con el cliente"
                    aria-label="Abrir chat con el cliente"
                  >
                    <FaCommentDots className="text-xs text-blue-600" />
                    {customerMsgCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-2xs font-bold rounded-full flex items-center justify-center">{customerMsgCount}</span>
                    )}
                  </button>
                )}
              </div>
              <p className="text-[12px] text-slate-500 mt-0.5 break-words">
                {order.customerName} · {orderTypeInfo.label} · {timeElapsed}{order.paymentMethod ? ` · ${PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-sm font-bold text-slate-800 tabular-nums">{pesos(total)}</p>
              <p className="text-2xs text-slate-400">{unidades} {unidades === 1 ? 'producto' : 'productos'}</p>
            </div>

            <div className="flex gap-1">
              <button onClick={() => onShowDetails(order)} className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 transition-colors" title="Ver detalles">
                <FaEye className="text-xs" />
              </button>

              {order.paymentProof && (
                <button onClick={() => onShowProof(order.paymentProof)} className="p-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-500 transition-colors" title="Ver comprobante">
                  <FaImage className="text-xs" />
                </button>
              )}

              {order.status === ORDER_STATUS.PAYMENT_UPLOADED && (
                <>
                  <button onClick={() => onConfirmPayment(order._id)} className="p-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors" title="Confirmar pago">
                    <FaCheckCircle className="text-xs" />
                  </button>
                  <button onClick={() => onRejectPayment(order._id)} className="p-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors" title="Rechazar pago">
                    <FaTimesCircle className="text-xs" />
                  </button>
                </>
              )}

              {(needsDelivery || cambiarDomi) && !tienda && (
                <button onClick={() => onAssignDelivery(order)} className="p-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors" title={cambiarDomi ? 'Ver o cambiar domiciliario' : 'Asignar domiciliario'}>
                  <FaMotorcycle className="text-xs" />
                </button>
              )}

              {porDespachar && (
                <button onClick={() => onDespachar?.(order)} className="p-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition-colors" title="Despachar con guía">
                  <FaTruck className="text-xs" />
                </button>
              )}

              {/* El paso normal lleva su nombre escrito: con solo un ícono no se
                  sabe qué hace; los atajos quedan como ícono. */}
              {nextSteps.map(({ to, label, Icon, tono }, i) => (
                <button
                  key={to}
                  onClick={() => onUpdateStatus(order._id, to)}
                  className={`h-9 rounded-lg transition-colors inline-flex items-center gap-1.5 text-xs font-bold ${i === 0 ? 'px-3' : 'px-2.5'} ${TONOS_PASO[tono]}`}
                  title={label}
                  aria-label={label}
                >
                  <Icon className="text-xs" />{i === 0 && <span>{label}</span>}
                </button>
              ))}

              {!isTerminal && (
                <button onClick={cancelar} className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors border border-red-200" title="Cancelar pedido">
                  <FaTimes className="text-xs" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default React.memo(OrderCard);
