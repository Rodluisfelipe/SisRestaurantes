import React from 'react';
import { motion } from 'framer-motion';
import {
  FaUser, FaPhone, FaMapMarkerAlt, FaTruck, FaEye, FaPlay, FaCheck,
  FaChair, FaHome, FaExclamationTriangle, FaTimes,
  FaMoneyBillWave, FaImage, FaTimesCircle, FaCheckCircle, FaPrint, FaMotorcycle,
  FaCreditCard
} from 'react-icons/fa';
import { ORDER_STATUS } from '../utils/constants';

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
  onConfirmPayment, onRejectPayment, onAssignDelivery,
}) {
  const StatusIcon = statusInfo.Icon;
  const TypeIcon = orderTypeInfo.Icon;

  return (
    <motion.div
      key={order._id}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={`bg-white rounded-xl overflow-hidden transition-all duration-150 ${
        isPending
          ? 'border border-yellow-300 ring-1 ring-yellow-100'
          : 'border border-slate-200 hover:border-slate-300'
      } ${viewMode === 'list' ? 'p-3' : 'p-0'}`}
    >
      {viewMode === 'grid' ? (
        <>
          {/* Card Header */}
          <div className={`px-3 py-2.5 ${
            isPending
              ? 'bg-yellow-50/80 border-b border-yellow-200'
              : 'bg-slate-50/80 border-b border-slate-100'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-8 h-8 ${orderTypeInfo.color} rounded-lg flex items-center justify-center shrink-0`}>
                  <TypeIcon className="text-white text-sm" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-800 text-sm leading-tight">#{order.orderNumber}</h3>
                  <p className="text-xs text-slate-500">{orderTypeInfo.label}</p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                  isPending
                    ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                    : statusInfo.bgColor + ' ' + statusInfo.textColor
                }`}>
                  <StatusIcon className="text-[8px]" /> {statusInfo.label}
                </span>
                <span className={`text-xs font-medium tabular-nums ${
                  isPending ? 'text-yellow-600' : 'text-slate-400'
                }`}>
                  {timeElapsed}
                </span>
              </div>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-3">
            <div className="space-y-1.5 mb-3">
              <div className="flex items-center gap-2 text-[13px]">
                <FaUser className="text-[10px] text-slate-400 shrink-0" />
                <span className="font-medium text-slate-700 truncate">{order.customerName}</span>
              </div>

              {order.phone && (
                <div className="flex items-center gap-2 text-[13px]">
                  <FaPhone className="text-[10px] text-slate-400 shrink-0" />
                  <a href={`tel:${order.phone}`} className="font-medium text-slate-600 hover:text-blue-600 truncate">
                    {order.phone}
                  </a>
                </div>
              )}

              {order.tableNumber && (
                <div className="flex items-center gap-2 text-[13px]">
                  <FaChair className="text-[10px] text-slate-400 shrink-0" />
                  <span className="font-medium text-slate-700">{businessType === 'hotel' ? 'Hab.' : 'Mesa'} {order.tableNumber}</span>
                </div>
              )}

              {order.orderType === 'delivery' && order.address && (
                <div className="flex items-start gap-2 text-[13px]">
                  <FaHome className="text-[10px] text-slate-400 shrink-0 mt-0.5" />
                  <span className="font-medium text-slate-600 leading-snug">{order.address}</span>
                </div>
              )}

              {order.orderType === 'delivery' && order.deliveryZoneName && (
                <div className="flex items-center gap-2 text-[13px]">
                  <FaMapMarkerAlt className="text-[10px] text-slate-400 shrink-0" />
                  <span className="font-medium text-slate-600">Zona: {order.deliveryZoneName}</span>
                </div>
              )}

              {order.orderType === 'delivery' && order.deliveryFee && (
                <div className="flex items-center gap-2 text-[13px]">
                  <FaTruck className="text-[10px] text-slate-400 shrink-0" />
                  <span className="font-medium text-slate-700">Envío: ${order.deliveryFee.toLocaleString()}</span>
                </div>
              )}

              {order.orderType === 'delivery' && order.deliveryNeedsConfirmation && (
                <div className="flex items-center gap-1.5 bg-amber-50 px-2 py-1.5 rounded-lg border border-amber-200">
                  <FaExclamationTriangle className="text-[10px] text-amber-500 shrink-0" />
                  <span className="text-xs font-semibold text-amber-700">Envío por confirmar</span>
                </div>
              )}

              {order.paymentMethod && (
                <div className="flex items-center gap-2 text-[13px]">
                  <FaCreditCard className="text-[10px] text-slate-400 shrink-0" />
                  <span className="font-medium text-slate-700">{PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}</span>
                </div>
              )}
            </div>

            {/* Total */}
            <div className={`flex items-center justify-between py-2.5 border-t ${
              isPending ? 'border-yellow-200' : 'border-slate-100'
            }`}>
              <span className="text-xs text-slate-500">{order.items?.length || 0} {isService ? 'servicios' : 'productos'}</span>
              <div className="text-right">
                {order.couponCode ? (
                  <div>
                    <span className="text-sm font-bold text-emerald-600">${((order.totalAmount || 0) + (order.deliveryFee || 0) - (order.discountAmount || 0)).toLocaleString()}</span>
                    <div className="text-xs text-slate-400">
                      <span className="line-through">${((order.totalAmount || 0) + (order.deliveryFee || 0)).toLocaleString()}</span>
                      <span className="ml-1 text-emerald-500 font-semibold">{order.couponCode}</span>
                    </div>
                  </div>
                ) : order.deliveryNeedsConfirmation ? (
                  <div>
                    <span className="text-sm font-bold text-slate-800">${order.totalAmount.toLocaleString()}</span>
                    <div className="text-xs text-amber-600 font-medium">+ envío</div>
                  </div>
                ) : (
                  <span className="text-sm font-bold text-slate-800">
                    ${((order.totalAmount || 0) + (order.deliveryFee || 0)).toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-2 pt-1">
              {/* Row 1: utility buttons */}
              <div className="flex gap-2">
                <button onClick={() => onShowDetails(order)} className="flex-1 flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-600 px-3 py-3 min-h-[44px] rounded-lg text-xs font-semibold border border-slate-200 transition-colors">
                  <FaEye className="text-[10px]" /> <span>Detalles</span>
                </button>
                <button onClick={() => onPrint(order)} className="flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-600 px-3 py-3 min-h-[44px] rounded-lg text-xs font-semibold border border-slate-200 transition-colors" title="Imprimir comanda">
                  <FaPrint className="text-[10px]" />
                </button>

                {order.paymentProof && (
                  <button onClick={() => onShowProof(order.paymentProof)} className="flex items-center justify-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-600 px-3 py-3 min-h-[44px] rounded-lg text-xs font-semibold border border-purple-200 transition-colors">
                    <FaImage className="text-[10px]" /> <span>Comprobante</span>
                  </button>
                )}
              </div>

              {/* Row 2: status action + cancel */}
              <div className="flex gap-2">
                {order.status === ORDER_STATUS.PAYMENT_UPLOADED && (
                  <>
                    <button onClick={() => onConfirmPayment(order._id)} className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-3 min-h-[44px] rounded-lg text-xs font-semibold transition-colors">
                      <FaCheckCircle className="text-[9px]" /> <span>Confirmar</span>
                    </button>
                    <button onClick={() => onRejectPayment(order._id)} className="flex items-center justify-center gap-1.5 bg-red-500 hover:bg-red-600 text-white px-3 py-3 min-h-[44px] rounded-lg text-xs font-semibold transition-colors">
                      <FaTimesCircle className="text-[9px]" />
                    </button>
                  </>
                )}

                {order.status === ORDER_STATUS.PAYMENT_CONFIRMED && (
                  <button onClick={() => onUpdateStatus(order._id, ORDER_STATUS.IN_PROGRESS)} className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3 py-3 min-h-[44px] rounded-lg text-xs font-semibold transition-colors">
                    <FaPlay className="text-[9px]" /> <span>Iniciar</span>
                  </button>
                )}

                {order.status === ORDER_STATUS.PENDING && (
                  <button onClick={() => onUpdateStatus(order._id, ORDER_STATUS.IN_PROGRESS)} className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3 py-3 min-h-[44px] rounded-lg text-xs font-semibold transition-colors">
                    <FaPlay className="text-[9px]" /> <span>Iniciar</span>
                  </button>
                )}

                {order.status === ORDER_STATUS.IN_PROGRESS && (
                  <>
                    {order.orderType === 'delivery' && !order.deliveryToken && !order.deliveryPersonId && !order.confirmationCode && (
                      <button onClick={() => onAssignDelivery(order)} className="flex-1 flex items-center justify-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white px-3 py-3 min-h-[44px] rounded-lg text-xs font-semibold transition-colors">
                        <FaMotorcycle className="text-[11px]" /> <span>Asignar Domi</span>
                      </button>
                    )}
                    <button onClick={() => onUpdateStatus(order._id, ORDER_STATUS.COMPLETED)} className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-3 min-h-[44px] rounded-lg text-xs font-semibold transition-colors">
                      <FaCheck className="text-[9px]" /> <span>{order.orderType === 'delivery' ? 'Completar' : 'Completar'}</span>
                    </button>
                  </>
                )}

                {order.status !== ORDER_STATUS.COMPLETED && order.status !== ORDER_STATUS.CANCELLED && order.status !== ORDER_STATUS.DELIVERED && (
                  <button onClick={() => { if (window.confirm('¿Cancelar pedido #' + order.orderNumber + '?')) onUpdateStatus(order._id, ORDER_STATUS.CANCELLED); }} className="flex items-center justify-center gap-1 bg-red-50 hover:bg-red-100 text-red-500 px-3 py-3 min-h-[44px] rounded-lg text-xs font-semibold border border-red-200 transition-colors">
                    <FaTimes className="text-[9px]" /> <span>Cancelar</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* List view */
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 ${orderTypeInfo.color} rounded-lg flex items-center justify-center shrink-0`}>
              <TypeIcon className="text-white text-xs" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-sm">#{order.orderNumber}</h3>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${statusInfo.textColor} ${statusInfo.bgColor}`}>
                  <StatusIcon className="text-[8px]" /> {statusInfo.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {order.customerName} · {orderTypeInfo.label} · {timeElapsed}{order.paymentMethod ? ` · ${PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-sm font-bold text-slate-800">${((order.totalAmount || 0) + (order.deliveryFee || 0)).toLocaleString()}</p>
              <p className="text-xs text-slate-400">{order.items?.length || 0} items</p>
            </div>

            <div className="flex gap-1.5">
              <button onClick={() => onShowDetails(order)} className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 transition-colors">
                <FaEye className="text-xs" />
              </button>

              {order.paymentProof && (
                <button onClick={() => onShowProof(order.paymentProof)} className="p-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-500 transition-colors">
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

              {order.status === ORDER_STATUS.PAYMENT_CONFIRMED && (
                <button onClick={() => onUpdateStatus(order._id, ORDER_STATUS.IN_PROGRESS)} className="p-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors">
                  <FaPlay className="text-xs" />
                </button>
              )}

              {order.status === ORDER_STATUS.PENDING && (
                <button onClick={() => onUpdateStatus(order._id, ORDER_STATUS.IN_PROGRESS)} className="p-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors">
                  <FaPlay className="text-xs" />
                </button>
              )}

              {order.status === ORDER_STATUS.IN_PROGRESS && (
                <div className="flex gap-1">
                  {order.orderType === 'delivery' && !order.deliveryToken && !order.deliveryPersonId && !order.confirmationCode && (
                    <button onClick={() => onAssignDelivery(order)} className="p-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors" title="Asignar Domiciliario">
                      <FaMotorcycle className="text-xs" />
                    </button>
                  )}
                  <button onClick={() => onUpdateStatus(order._id, ORDER_STATUS.COMPLETED)} className="p-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors" title="Marcar como Completado">
                    <FaCheck className="text-xs" />
                  </button>
                </div>
              )}

              {order.status !== ORDER_STATUS.COMPLETED && order.status !== ORDER_STATUS.CANCELLED && order.status !== ORDER_STATUS.DELIVERED && (
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
