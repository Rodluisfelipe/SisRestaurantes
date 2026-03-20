import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaTimes, FaChair, FaShoppingBag, FaTruck, FaUtensils,
  FaCheck, FaClock, FaMotorcycle, FaBell
} from 'react-icons/fa';
import useOrdersDashboard from '../../hooks/useOrdersDashboard';
import { ORDER_STATUS } from '../../utils/constants';

/**
 * Modo Operación — Full-screen optimized view for active service.
 * Two-panel layout: active orders (top 60%) + ready orders (bottom 40%).
 * Single-tap workflow: Pending → Confirmed → Preparing → Ready → Delivered.
 */

const TYPE_ICONS = { inSite: FaChair, takeaway: FaShoppingBag, delivery: FaTruck };
const TYPE_LABELS = { inSite: 'Mesa', takeaway: 'Llevar', delivery: 'Delivery' };

function formatItems(items) {
  if (!items?.length) return '';
  return items
    .slice(0, 4)
    .map(i => `${i.quantity}x ${i.name}`)
    .join(', ')
    + (items.length > 4 ? ` +${items.length - 4} más` : '');
}

function timeAgo(createdAt) {
  const ms = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/* ─── Primary action config per status ─── */
function getAction(status) {
  switch (status) {
    case ORDER_STATUS.PENDING:
      return { label: 'CONFIRMAR', next: ORDER_STATUS.IN_PROGRESS, bg: 'bg-emerald-500 active:bg-emerald-600', ring: 'ring-emerald-500/30' };
    case ORDER_STATUS.PAYMENT_UPLOADED:
      return { label: 'CONFIRMAR PAGO', next: null, bg: 'bg-purple-500 active:bg-purple-600', ring: 'ring-purple-500/30', isPayment: true };
    case ORDER_STATUS.PAYMENT_CONFIRMED:
    case ORDER_STATUS.CONFIRMED:
      return { label: 'PREPARAR', next: ORDER_STATUS.PREPARING, bg: 'bg-blue-500 active:bg-blue-600', ring: 'ring-blue-500/30' };
    case ORDER_STATUS.IN_PROGRESS:
    case ORDER_STATUS.PREPARING:
      return { label: 'LISTO', next: ORDER_STATUS.READY, bg: 'bg-amber-500 active:bg-amber-600', ring: 'ring-amber-500/30' };
    case ORDER_STATUS.READY:
      return { label: 'ENTREGADO', next: ORDER_STATUS.COMPLETED, bg: 'bg-teal-500 active:bg-teal-600', ring: 'ring-teal-500/30' };
    default:
      return null;
  }
}

/* ─── Status color bar ─── */
function statusColor(status) {
  switch (status) {
    case ORDER_STATUS.PENDING: return 'border-l-yellow-400';
    case ORDER_STATUS.PAYMENT_UPLOADED: return 'border-l-purple-400';
    case ORDER_STATUS.PAYMENT_CONFIRMED:
    case ORDER_STATUS.CONFIRMED: return 'border-l-blue-400';
    case ORDER_STATUS.IN_PROGRESS:
    case ORDER_STATUS.PREPARING: return 'border-l-amber-400';
    case ORDER_STATUS.READY: return 'border-l-emerald-400';
    default: return 'border-l-slate-300';
  }
}

/* ═══════════════════════════════════════════════════════════
   OrderMiniCard — Compact card with single primary action
   ═══════════════════════════════════════════════════════════ */
function OrderMiniCard({ order, onAction, onPayment, isHotel }) {
  const action = getAction(order.status);
  const TypeIcon = TYPE_ICONS[order.orderType] || FaUtensils;
  const typeLabel = order.orderType === 'inSite'
    ? (isHotel ? `Hab ${order.tableNumber || ''}` : `Mesa ${order.tableNumber || ''}`)
    : (TYPE_LABELS[order.orderType] || '');
  const elapsed = timeAgo(order.createdAt);
  const isUrgent = (Date.now() - new Date(order.createdAt).getTime()) > 600000; // 10+ min

  const handleClick = () => {
    if (!action) return;
    if (action.isPayment) {
      onPayment(order._id);
    } else {
      onAction(order._id, action.next);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -60, transition: { duration: 0.2 } }}
      className={`bg-white rounded-xl border-l-4 ${statusColor(order.status)} shadow-sm overflow-hidden`}
    >
      {/* Info row */}
      <div className="px-3 py-2.5 flex items-center gap-2.5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          order.status === ORDER_STATUS.PENDING ? 'bg-yellow-100 text-yellow-600' :
          order.status === ORDER_STATUS.PREPARING || order.status === ORDER_STATUS.IN_PROGRESS ? 'bg-amber-100 text-amber-600' :
          'bg-slate-100 text-slate-500'
        }`}>
          <TypeIcon className="text-sm" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold text-slate-800">#{order.orderNumber}</span>
            <span className="text-xs text-slate-400 font-medium">{typeLabel}</span>
            {order.customerName && (
              <span className="text-xs text-slate-500 truncate">· {order.customerName}</span>
            )}
          </div>
          <p className="text-xs text-slate-400 truncate mt-0.5">{formatItems(order.items)}</p>
        </div>

        <div className={`text-right shrink-0 ${isUrgent ? 'text-red-500' : 'text-slate-400'}`}>
          <div className="flex items-center gap-1 text-xs font-bold">
            <FaClock className="text-[9px]" />
            {elapsed}
          </div>
          <p className="text-xs font-bold text-slate-700 mt-0.5">
            ${((order.totalAmount || 0) + (order.deliveryFee || 0)).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Action button */}
      {action && (
        <button
          onClick={handleClick}
          className={`w-full min-h-[56px] ${action.bg} text-white font-black text-base tracking-wide
                      flex items-center justify-center gap-2 transition-all ring-0 active:ring-4 ${action.ring}`}
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ModoOperacion — Full-screen modal
   ═══════════════════════════════════════════════════════════ */
export default function ModoOperacion({ isOpen, onClose }) {
  const {
    orders,
    loading,
    updateOrderStatus,
    confirmPayment,
    fetchOrders,
    notificationAudioRef,
    businessConfig,
  } = useOrdersDashboard();

  const [now, setNow] = useState(Date.now());
  const activeScrollRef = useRef(null);

  // Tick every 30s to update time displays
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Split orders into active vs ready
  const ACTIVE_STATUSES = [
    ORDER_STATUS.PENDING,
    ORDER_STATUS.PENDING_PAYMENT,
    ORDER_STATUS.PAYMENT_UPLOADED,
    ORDER_STATUS.PAYMENT_CONFIRMED,
    ORDER_STATUS.CONFIRMED,
    ORDER_STATUS.IN_PROGRESS,
    ORDER_STATUS.PREPARING,
  ];

  const activeOrders = useMemo(() =>
    orders.filter(o => ACTIVE_STATUSES.includes(o.status))
      .sort((a, b) => {
        // Pending first, then by creation time
        const priority = { [ORDER_STATUS.PENDING]: 0, [ORDER_STATUS.PAYMENT_UPLOADED]: 1 };
        const pa = priority[a.status] ?? 5;
        const pb = priority[b.status] ?? 5;
        if (pa !== pb) return pa - pb;
        return new Date(a.createdAt) - new Date(b.createdAt);
      }),
    [orders]
  );

  const readyOrders = useMemo(() =>
    orders.filter(o => o.status === ORDER_STATUS.READY)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [orders]
  );

  const pendingCount = activeOrders.filter(o => o.status === ORDER_STATUS.PENDING).length;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="modo-operacion"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-slate-900 flex flex-col"
      >
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800 safe-area-top shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <h1 className="text-white font-black text-base tracking-tight">MODO OPERACIÓN</h1>
            {pendingCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded-full animate-bounce">
                {pendingCount} nuevo{pendingCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-slate-700 active:bg-slate-600 text-white transition-colors"
          >
            <FaTimes className="text-base" />
          </button>
        </div>

        {/* ─── Active Orders Section (top ~60%) ─── */}
        <div className="flex-[3] min-h-0 flex flex-col">
          <div className="px-4 py-2 bg-slate-800/50 flex items-center justify-between shrink-0">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Pedidos Activos · {activeOrders.length}
            </h2>
            <button
              onClick={fetchOrders}
              className="text-xs text-slate-500 font-bold px-2 py-1 rounded-md active:bg-slate-700 transition-colors"
            >
              Actualizar
            </button>
          </div>

          <div ref={activeScrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2 overscroll-contain">
            {loading && activeOrders.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-8 h-8 border-3 border-slate-600 border-t-white rounded-full animate-spin" />
              </div>
            ) : activeOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-500">
                <FaCheck className="text-2xl mb-2 text-slate-600" />
                <p className="text-sm font-bold">Sin pedidos activos</p>
                <p className="text-xs text-slate-600 mt-0.5">Aparecerán aquí automáticamente</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {activeOrders.map(order => (
                  <OrderMiniCard
                    key={order._id}
                    order={order}
                    onAction={updateOrderStatus}
                    onPayment={confirmPayment}
                    isHotel={businessConfig?.businessType === 'hotel'}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* ─── Divider ─── */}
        <div className="h-px bg-slate-700 shrink-0" />

        {/* ─── Ready Orders Section (bottom ~40%) ─── */}
        <div className="flex-[2] min-h-0 flex flex-col bg-slate-900/80">
          <div className="px-4 py-2 flex items-center gap-2 shrink-0">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
              Listos para Entregar · {readyOrders.length}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-1 space-y-2 overscroll-contain">
            {readyOrders.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-slate-600">
                <p className="text-xs font-bold">Los pedidos listos aparecerán aquí</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {readyOrders.map(order => (
                  <OrderMiniCard
                    key={order._id}
                    order={order}
                    onAction={updateOrderStatus}
                    onPayment={confirmPayment}
                    isHotel={businessConfig?.businessType === 'hotel'}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Safe area bottom */}
        <div className="h-[env(safe-area-inset-bottom,0px)] bg-slate-900 shrink-0" />

        {/* Hidden audio element for notifications */}
        <audio ref={notificationAudioRef} preload="auto">
          <source src="/notification.mp3" type="audio/mpeg" />
        </audio>
      </motion.div>
    </AnimatePresence>
  );
}
