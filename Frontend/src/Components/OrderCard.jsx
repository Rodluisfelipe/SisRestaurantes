import React from 'react';
import { motion } from 'framer-motion';
import {
  FaUser, FaPhone, FaMapMarkerAlt, FaTruck, FaEye, FaPlay, FaCheck,
  FaChair, FaHome, FaExclamationTriangle, FaTimes,
  FaMoneyBillWave, FaImage, FaTimesCircle, FaCheckCircle, FaPrint, FaMotorcycle,
  FaCreditCard, FaCommentDots, FaPlus
} from 'react-icons/fa';
import { ORDER_STATUS } from '../utils/constants';
import api from '../services/api';

const PAYMENT_LABELS = {
  cash: 'Efectivo', efectivo: 'Efectivo',
  nequi: 'Nequi', daviplata: 'Daviplata',
  transfer: 'Transferencia', transferencia: 'Transferencia',
  roomCharge: 'Cargo a habitación', other: 'Otro'
};

function OrderCard({
  order, viewMode, cardVariants, isService, businessType,
  orderTypeInfo, statusInfo, timeElapsed, isPending,
  onShowDetails, onPrint, onShowProof, onUpdateStatus,
  onConfirmPayment, onRejectPayment, onAssignDelivery, onOpenChat,
}) {
  const customerMsgCount = (order.messages || []).filter(m => m.sender === 'customer').length;
  const StatusIcon = statusInfo.Icon;
  const TypeIcon = orderTypeInfo.Icon;
  const hasChat = order.orderChannel === 'inapp';
  const isTerminal = ['completed', 'delivered', 'cancelled'].includes(order.status);

  /* Los pasos siguientes se definen una sola vez para las dos vistas (tarjeta y
     fila). Antes cada layout repetía las mismas condiciones y solo cubría
     cuatro de los once estados, así que los pedidos en `confirmed` —todo lo que
     entra por POS y por pedido rápido— se quedaban sin botón para avanzar en
     ambas: solo se podían cancelar. Igual pasaba con `preparing` y `ready`.

     Los saltos son los que acepta VALID_TRANSITIONS en el backend; ofrecer otro
     solo devolvería 400. */
  const S = ORDER_STATUS;
  const START = { to: S.IN_PROGRESS, label: 'Iniciar preparación', Icon: FaPlay, primary: false };
  const FINISH = { to: S.COMPLETED, label: 'Completar pedido', Icon: FaCheck, primary: true };
  const NEXT_STEPS = {
    [S.PENDING]: [START],
    [S.PAYMENT_CONFIRMED]: [START],
    [S.CONFIRMED]: [START, FINISH],
    [S.PREPARING]: [{ to: S.READY, label: 'Marcar como listo', Icon: FaCheck, primary: false }, FINISH],
    [S.IN_PROGRESS]: [FINISH],
    [S.READY]: [FINISH],
  };
  const nextSteps = NEXT_STEPS[order.status] || [];

  /* Un domicilio también necesita repartidor mientras está confirmado o en
     preparación, no solo en `inProgress`, que era el único estado que lo
     mostraba. */
  const needsDelivery = order.orderType === 'delivery'
    && !order.deliveryToken && !order.deliveryPersonId && !order.confirmationCode
    && [S.CONFIRMED, S.PREPARING, S.IN_PROGRESS].includes(order.status);

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
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-slate-800 text-sm leading-tight">#{order.orderNumber}</h3>
                    <span className="text-[10px] text-slate-400 font-medium">{orderTypeInfo.label}</span>
                    {order.isGift && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-pink-100 text-pink-700 border border-pink-200">🎁 Regalo</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {hasChat && !isTerminal && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenChat?.(order); }}
                    className="relative w-6 h-6 bg-blue-100 hover:bg-blue-200 rounded-full flex items-center justify-center transition-colors"
                    title="Abrir chat"
                  >
                    <FaCommentDots className="text-[9px] text-blue-500" />
                    {customerMsgCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white text-[7px] font-bold rounded-full flex items-center justify-center">{customerMsgCount}</span>
                    )}
                  </button>
                )}
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isPending
                    ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                    : statusInfo.bgColor + ' ' + statusInfo.textColor
                }`}>
                  <StatusIcon className="text-[7px]" /> {statusInfo.label}
                </span>
                <span className={`text-[10px] font-medium tabular-nums ${
                  isPending ? 'text-yellow-600' : 'text-slate-400'
                }`}>
                  {timeElapsed}
                </span>
              </div>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="px-3 py-2.5">
            {/* Customer row */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <FaUser className="text-[9px] text-slate-300 shrink-0" />
              <span className="text-[13px] font-semibold text-slate-800 truncate">{order.customerName}</span>
              {order.phone && (
                <a href={`tel:${order.phone}`} className="ml-auto text-[11px] text-slate-400 hover:text-blue-500 shrink-0 tabular-nums">
                  {order.phone}
                </a>
              )}
            </div>

            {/* Context row: table / address / zone */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 mb-2">
              {order.tableNumber && (
                <span className="flex items-center gap-1">
                  <FaChair className="text-[8px] text-slate-300" /> {businessType === 'hotel' ? 'Hab.' : 'Mesa'} {order.tableNumber}
                </span>
              )}
              {order.orderType === 'delivery' && order.address && (
                <span className="flex items-center gap-1 truncate max-w-full">
                  <FaHome className="text-[8px] text-slate-300 shrink-0" /> {order.address}
                </span>
              )}
              {order.orderType === 'delivery' && order.deliveryCoordinates?.lat && (
                <a
                  href={`https://maps.google.com/?q=${order.deliveryCoordinates.lat},${order.deliveryCoordinates.lon}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-0.5 text-blue-500 hover:text-blue-600 font-semibold shrink-0"
                  title="Abrir en Google Maps"
                >
                  <FaMapMarkerAlt className="text-[8px]" /> Maps
                </a>
              )}
              {order.orderType === 'delivery' && order.deliveryZoneName && (
                <span className="flex items-center gap-1">
                  <FaMapMarkerAlt className="text-[8px] text-slate-300" /> {order.deliveryZoneName}
                </span>
              )}
              {order.orderType === 'delivery' && order.deliveryFee > 0 && (
                <span className="flex items-center gap-1 font-semibold text-slate-600">
                  <FaTruck className="text-[8px] text-slate-300" /> Envío ${order.deliveryFee.toLocaleString()}
                </span>
              )}
              {order.paymentMethod && (
                <span className="flex items-center gap-1">
                  <FaCreditCard className="text-[8px] text-slate-300" /> {PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}
                </span>
              )}
            </div>

            {order.orderType === 'delivery' && order.deliveryNeedsConfirmation && (
              <div className="flex items-center gap-1.5 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 mb-2">
                <FaExclamationTriangle className="text-[9px] text-amber-500 shrink-0" />
                <span className="text-[10px] font-semibold text-amber-700">Envío por confirmar</span>
              </div>
            )}

            {/* Gift recipient info */}
            {order.isGift && order.gift && (
              <div className="mb-2 p-2 rounded-lg bg-pink-50 border border-pink-200 space-y-1">
                <p className="text-[10px] font-bold text-pink-700">
                  🎁 Regalo para {order.gift.recipientName}{order.gift.recipientPhone ? ` · ${order.gift.recipientPhone}` : ''}
                </p>
                {order.gift.message && <p className="text-[10px] text-pink-600 italic">"{order.gift.message}"</p>}
                {order.gift.hidePrices && <p className="text-[9px] text-pink-500 font-semibold">⚠️ No incluir precios en la entrega</p>}
              </div>
            )}

            {/* ── Total bar ── */}
            <div className={`flex items-center justify-between py-1.5 border-t ${
              isPending ? 'border-yellow-200' : 'border-slate-100'
            }`}>
              <span className="text-[11px] text-slate-400">{order.items?.length || 0} {isService ? 'servicios' : 'productos'}</span>
              <div className="text-right">
                {order.couponCode ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-400 line-through">${((order.totalAmount || 0) + (order.deliveryFee || 0)).toLocaleString()}</span>
                    <span className="text-sm font-bold text-emerald-600">${((order.totalAmount || 0) + (order.deliveryFee || 0) - (order.discountAmount || 0)).toLocaleString()}</span>
                  </div>
                ) : order.deliveryNeedsConfirmation ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-bold text-slate-800">${order.totalAmount.toLocaleString()}</span>
                    <span className="text-[10px] text-amber-600 font-semibold">+ envío</span>
                  </div>
                ) : (
                  <span className="text-sm font-bold text-slate-800">
                    ${((order.totalAmount || 0) + (order.deliveryFee || 0)).toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            {/* ═══ Action Buttons ═══ */}
            <div className="pt-2.5 space-y-2">
              {/* Utility row — 2x2 grid */}
              <div className="grid grid-cols-2 gap-1.5">
                <button onClick={() => onShowDetails(order)} className="flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 py-2.5 rounded-xl text-xs font-semibold border border-slate-200/60 transition-colors active:scale-[0.97]">
                  <FaEye className="text-[10px]" /> Detalles
                </button>
                <button onClick={async () => { try { await api.post(`/print-agent/print-comanda/${order._id}`); } catch { onPrint(order); } }} className="flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 py-2.5 rounded-xl text-xs font-semibold border border-slate-200/60 transition-colors active:scale-[0.97]" title="Imprimir comanda">
                  <FaPrint className="text-[10px]" /> Comanda
                </button>
                {order.status !== ORDER_STATUS.PENDING && order.status !== 'pending_payment' && (
                  <button onClick={async () => { try { await api.post(`/print-agent/print-receipt/${order._id}`); } catch { onPrint(order); } }} className="flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 py-2.5 rounded-xl text-xs font-semibold border border-emerald-200/60 transition-colors active:scale-[0.97]" title="Imprimir recibo">
                    <FaMoneyBillWave className="text-[10px]" /> Recibo
                  </button>
                )}
                {order.paymentProof && (
                  <button onClick={() => onShowProof(order.paymentProof)} className="flex items-center justify-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-600 py-2.5 rounded-xl text-xs font-semibold border border-purple-200/60 transition-colors active:scale-[0.97]">
                    <FaImage className="text-[10px]" /> Pago
                  </button>
                )}
              </div>

              {/* Primary action row */}
              <div className="space-y-1.5">
                {order.status === ORDER_STATUS.PAYMENT_UPLOADED && (
                  <div className="flex gap-1.5">
                    <button onClick={() => onConfirmPayment(order._id)} className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl text-xs font-bold transition-colors active:scale-[0.97]">
                      <FaCheckCircle className="text-[10px]" /> Confirmar pago
                    </button>
                    <button onClick={() => onRejectPayment(order._id)} className="flex items-center justify-center gap-1.5 bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-xl text-xs font-bold transition-colors active:scale-[0.97]">
                      <FaTimesCircle className="text-[10px]" /> Rechazar
                    </button>
                  </div>
                )}

                {needsDelivery && (
                  <button onClick={() => onAssignDelivery(order)} className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl text-xs font-bold transition-colors active:scale-[0.97]">
                    <FaMotorcycle className="text-sm" /> Asignar domiciliario
                  </button>
                )}

                {nextSteps.map(({ to, label, Icon, primary }) => (
                  <button
                    key={to}
                    onClick={() => onUpdateStatus(order._id, to)}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold text-white transition-colors active:scale-[0.97] ${
                      primary ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-800 hover:bg-slate-900'
                    }`}
                  >
                    <Icon className="text-[10px]" /> {label}
                  </button>
                ))}

                {!isTerminal && (
                  <button onClick={() => { if (window.confirm('¿Cancelar pedido #' + order.orderNumber + '?')) onUpdateStatus(order._id, ORDER_STATUS.CANCELLED); }} className="w-full flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-500 py-2.5 rounded-xl text-xs font-semibold border border-red-200/60 transition-colors active:scale-[0.97]">
                    <FaTimes className="text-[9px]" /> Cancelar pedido
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
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${statusInfo.textColor} ${statusInfo.bgColor}`}>
                  <StatusIcon className="text-[7px]" /> {statusInfo.label}
                </span>
                {order.isGift && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-pink-100 text-pink-700 border border-pink-200">🎁</span>
                )}
                {hasChat && !isTerminal && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenChat?.(order); }}
                    className="relative w-5 h-5 bg-blue-100 hover:bg-blue-200 rounded-full flex items-center justify-center transition-colors"
                    title="Abrir chat"
                  >
                    <FaCommentDots className="text-[7px] text-blue-500" />
                    {customerMsgCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 text-white text-[6px] font-bold rounded-full flex items-center justify-center">{customerMsgCount}</span>
                    )}
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                {order.customerName} · {orderTypeInfo.label} · {timeElapsed}{order.paymentMethod ? ` · ${PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-sm font-bold text-slate-800">${((order.totalAmount || 0) + (order.deliveryFee || 0)).toLocaleString()}</p>
              <p className="text-[10px] text-slate-400">{order.items?.length || 0} items</p>
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

              {needsDelivery && (
                <button onClick={() => onAssignDelivery(order)} className="p-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors" title="Asignar domiciliario">
                  <FaMotorcycle className="text-xs" />
                </button>
              )}

              {nextSteps.map(({ to, label, Icon, primary }) => (
                <button
                  key={to}
                  onClick={() => onUpdateStatus(order._id, to)}
                  className={`p-2 rounded-lg text-white transition-colors ${
                    primary ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-800 hover:bg-slate-900'
                  }`}
                  title={label}
                >
                  <Icon className="text-xs" />
                </button>
              ))}

              {!isTerminal && (
                <button onClick={() => { if (window.confirm('¿Cancelar pedido #' + order.orderNumber + '?')) onUpdateStatus(order._id, ORDER_STATUS.CANCELLED); }} className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors border border-red-200" title="Cancelar pedido">
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
