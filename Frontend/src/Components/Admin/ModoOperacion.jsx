import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaChair, FaShoppingBag, FaTruck, FaUtensils,
  FaCheck, FaClock, FaBell, FaSync
} from 'react-icons/fa';
import useOrdersDashboard from '../../hooks/useOrdersDashboard';
import { ORDER_STATUS } from '../../utils/constants';

/**
 * Modo Operación v2 — Mobile-first full-screen service overlay.
 *
 * Key improvements over v1:
 * - Single scroll list (no split panes) — eliminates double-scroll nightmare
 * - Sticky section headers scroll with content
 * - Bigger order numbers (24px bold) for instant recognition
 * - Items shown as readable inline list (not truncated to 4)
 * - 64px action buttons (proper thumb targets)
 * - Slide-up animation (native feel)
 * - Fixed AnimatePresence exit animation
 */

const TYPE_ICONS = { inSite: FaChair, takeaway: FaShoppingBag, delivery: FaTruck };
const TYPE_LABELS = { inSite: 'Mesa', takeaway: 'Llevar', delivery: 'Delivery' };

function timeAgo(createdAt) {
  const ms = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function getAction(status) {
  switch (status) {
    case ORDER_STATUS.PENDING:
      return { label: 'CONFIRMAR', next: ORDER_STATUS.IN_PROGRESS, bg: 'from-emerald-500 to-emerald-600', ring: 'ring-emerald-400/40', icon: 'check' };
    case ORDER_STATUS.PAYMENT_UPLOADED:
      return { label: 'CONFIRMAR PAGO', next: null, bg: 'from-purple-500 to-purple-600', ring: 'ring-purple-400/40', icon: 'check', isPayment: true };
    case ORDER_STATUS.PAYMENT_CONFIRMED:
    case ORDER_STATUS.CONFIRMED:
      return { label: 'PREPARAR', next: ORDER_STATUS.PREPARING, bg: 'from-blue-500 to-blue-600', ring: 'ring-blue-400/40', icon: 'clock' };
    case ORDER_STATUS.IN_PROGRESS:
    case ORDER_STATUS.PREPARING:
      return { label: 'LISTO ✓', next: ORDER_STATUS.READY, bg: 'from-amber-500 to-amber-600', ring: 'ring-amber-400/40', icon: 'bell' };
    case ORDER_STATUS.READY:
      return { label: 'ENTREGADO', next: ORDER_STATUS.COMPLETED, bg: 'from-teal-500 to-teal-600', ring: 'ring-teal-400/40', icon: 'check' };
    default:
      return null;
  }
}

function statusBorderColor(status) {
  switch (status) {
    case ORDER_STATUS.PENDING:              return 'border-l-yellow-400';
    case ORDER_STATUS.PAYMENT_UPLOADED:    return 'border-l-purple-400';
    case ORDER_STATUS.PAYMENT_CONFIRMED:
    case ORDER_STATUS.CONFIRMED:           return 'border-l-blue-400';
    case ORDER_STATUS.IN_PROGRESS:
    case ORDER_STATUS.PREPARING:           return 'border-l-amber-400';
    case ORDER_STATUS.READY:               return 'border-l-emerald-400';
    default:                               return 'border-l-slate-500';
  }
}

function statusLabel(status) {
  switch (status) {
    case ORDER_STATUS.PENDING:             return { text: 'Nuevo', color: 'bg-yellow-500' };
    case ORDER_STATUS.PAYMENT_UPLOADED:    return { text: 'Pago', color: 'bg-purple-500' };
    case ORDER_STATUS.PAYMENT_CONFIRMED:
    case ORDER_STATUS.CONFIRMED:           return { text: 'Confirmado', color: 'bg-blue-500' };
    case ORDER_STATUS.IN_PROGRESS:
    case ORDER_STATUS.PREPARING:           return { text: 'Preparando', color: 'bg-amber-500' };
    case ORDER_STATUS.READY:               return { text: 'Listo', color: 'bg-emerald-500' };
    default:                               return null;
  }
}

/* ─── Order Card ─── */
function OrderCard({ order, onAction, onPayment, isHotel }) {
  const action = getAction(order.status);
  const TypeIcon = TYPE_ICONS[order.orderType] || FaUtensils;
  const typeLabel = order.orderType === 'inSite'
    ? (isHotel ? `Hab. ${order.tableNumber || '—'}` : `Mesa ${order.tableNumber || '—'}`)
    : (TYPE_LABELS[order.orderType] || '');

  const elapsed = timeAgo(order.createdAt);
  const isUrgent = (Date.now() - new Date(order.createdAt).getTime()) > 600000;
  const total = ((order.totalAmount || 0) + (order.deliveryFee || 0)).toLocaleString('es-CO');
  const badge = statusLabel(order.status);

  const handleAction = () => {
    if (!action) return;
    action.isPayment ? onPayment(order._id) : onAction(order._id, action.next);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -48, transition: { duration: 0.18 } }}
      className={`bg-white rounded-2xl overflow-hidden border-l-[5px] ${statusBorderColor(order.status)} shadow-sm`}
    >
      {/* Info section */}
      <div className="px-4 pt-3.5 pb-3">
        {/* Row 1: order number + status badge + timer */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[22px] font-black text-slate-900 leading-none">#{order.orderNumber}</span>
            {badge && (
              <span className={`${badge.color} text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide`}>
                {badge.text}
              </span>
            )}
          </div>
          <span className={`flex items-center gap-1.5 text-[12px] font-bold ${isUrgent ? 'text-red-400' : 'text-slate-400'}`}>
            {isUrgent && <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />}
            <FaClock className="text-[9px]" />
            {elapsed}
          </span>
        </div>

        {/* Row 2: type + customer + total */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <TypeIcon className="text-[11px] text-slate-400 shrink-0" />
            <span className="text-[13px] font-semibold text-slate-600 shrink-0">{typeLabel}</span>
            {order.customerName && (
              <span className="text-[13px] text-slate-400 truncate">· {order.customerName}</span>
            )}
          </div>
          <span className="text-[14px] font-black text-slate-900 shrink-0 ml-2">${total}</span>
        </div>

        {/* Row 3: items list */}
        <div className="text-[12px] text-slate-500 leading-relaxed">
          {order.items?.slice(0, 6).map((item, idx) => (
            <span key={idx}>
              {idx > 0 && <span className="text-slate-300 mx-1">·</span>}
              <span className="font-bold text-slate-700">{item.quantity}×</span>
              {' '}{item.name}
            </span>
          ))}
          {(order.items?.length || 0) > 6 && (
            <span className="text-slate-400"> +{order.items.length - 6} más</span>
          )}
        </div>

        {/* Special instructions */}
        {order.specialInstructions && (
          <p className="mt-1.5 text-[11px] text-amber-600 bg-amber-50 rounded-lg px-2 py-1 leading-snug">
            📝 {order.specialInstructions}
          </p>
        )}
      </div>

      {/* Action button */}
      {action && (
        <button
          onClick={handleAction}
          className={`w-full min-h-[64px] bg-gradient-to-r ${action.bg} text-white font-black text-[15px] tracking-wider
                      flex items-center justify-center gap-2.5 transition-all
                      active:brightness-90 active:ring-4 ring-inset ${action.ring}`}
        >
          {action.icon === 'check' && (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
          )}
          {action.icon === 'clock' && (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2"/>
            </svg>
          )}
          {action.icon === 'bell' && <FaBell className="text-base" />}
          {action.label}
        </button>
      )}
    </motion.div>
  );
}

/* ─── Section sticky header ─── */
function SectionHeader({ dot, label, count, color }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2.5 px-4 py-2.5 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
      <span className={`w-2 h-2 rounded-full ${dot} shrink-0`} />
      <span className={`text-[11px] font-black uppercase tracking-[0.12em] ${color}`}>{label}</span>
      <span className={`ml-auto text-[13px] font-black ${color}`}>{count}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ModoOperacion v2 — main component
   ═══════════════════════════════════════════════════════ */
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
  const isHotel = businessConfig?.businessType === 'hotel';

  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [isOpen]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

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
    orders
      .filter(o => ACTIVE_STATUSES.includes(o.status))
      .sort((a, b) => {
        const priority = { [ORDER_STATUS.PENDING]: 0, [ORDER_STATUS.PAYMENT_UPLOADED]: 1 };
        const pa = priority[a.status] ?? 5;
        const pb = priority[b.status] ?? 5;
        if (pa !== pb) return pa - pb;
        return new Date(a.createdAt) - new Date(b.createdAt);
      }),
    [orders, now]
  );

  const readyOrders = useMemo(() =>
    orders
      .filter(o => o.status === ORDER_STATUS.READY)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [orders]
  );

  const pendingCount = activeOrders.filter(o => o.status === ORDER_STATUS.PENDING).length;
  const isEmpty = !loading && activeOrders.length === 0 && readyOrders.length === 0;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="modo-op-v2"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 300 }}
            className="fixed inset-0 z-[60] bg-slate-900 flex flex-col"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
          >
            {/* ─── Header ─── */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-800 shrink-0 border-b border-slate-700">
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 text-slate-400 active:text-white py-2 pr-2 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 5l-7 7 7 7"/>
                </svg>
                <span className="text-sm font-semibold">Cerrar</span>
              </button>

              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-red-500"
                />
                <span className="text-white font-black text-[13px] tracking-tight">MODO SERVICIO</span>
              </div>

              <button
                onClick={fetchOrders}
                className="p-2 text-slate-400 active:text-white transition-colors"
                aria-label="Actualizar"
              >
                <FaSync className="text-sm" />
              </button>
            </div>

            {/* ─── Summary pills ─── */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/60 shrink-0">
              <span className={`flex items-center gap-1.5 text-[12px] font-black px-2.5 py-1 rounded-full ${
                activeOrders.length > 0 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-700 text-slate-500'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${activeOrders.length > 0 ? 'bg-yellow-400' : 'bg-slate-600'}`} />
                {activeOrders.length} en curso
              </span>
              <span className={`flex items-center gap-1.5 text-[12px] font-black px-2.5 py-1 rounded-full ${
                readyOrders.length > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-500'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${readyOrders.length > 0 ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                {readyOrders.length} listos
              </span>
              {pendingCount > 0 && (
                <motion.span
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="ml-auto text-[12px] font-black bg-red-500 text-white px-2.5 py-1 rounded-full"
                >
                  {pendingCount} nuevo{pendingCount > 1 ? 's' : ''}
                </motion.span>
              )}
            </div>

            {/* ─── Single scroll list ─── */}
            <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">

              {/* Loading state */}
              {loading && activeOrders.length === 0 && readyOrders.length === 0 && (
                <div className="flex items-center justify-center h-48">
                  <div className="w-8 h-8 border-[3px] border-slate-600 border-t-white rounded-full animate-spin" />
                </div>
              )}

              {/* All clear */}
              {isEmpty && (
                <div className="flex flex-col items-center justify-center h-64 px-8 text-center">
                  <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                    <FaCheck className="text-2xl text-slate-600" />
                  </div>
                  <p className="text-[16px] font-black text-slate-400">Sin pedidos activos</p>
                  <p className="text-[13px] text-slate-600 mt-1">Los nuevos aparecerán aquí automáticamente</p>
                  <button
                    onClick={fetchOrders}
                    className="mt-4 flex items-center gap-2 text-[13px] font-bold text-slate-500 active:text-slate-300 transition-colors"
                  >
                    <FaSync className="text-xs" /> Verificar ahora
                  </button>
                </div>
              )}

              {/* Active orders section */}
              {activeOrders.length > 0 && (
                <div>
                  <SectionHeader
                    dot="bg-yellow-400 animate-pulse"
                    label="En curso"
                    count={activeOrders.length}
                    color="text-yellow-400"
                  />
                  <div className="px-3 pt-3 pb-2 space-y-3">
                    <AnimatePresence mode="popLayout">
                      {activeOrders.map(order => (
                        <OrderCard
                          key={order._id}
                          order={order}
                          onAction={updateOrderStatus}
                          onPayment={confirmPayment}
                          isHotel={isHotel}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Ready orders section */}
              {readyOrders.length > 0 && (
                <div>
                  <SectionHeader
                    dot="bg-emerald-400"
                    label="Listos para entregar"
                    count={readyOrders.length}
                    color="text-emerald-400"
                  />
                  <div className="px-3 pt-3 pb-4 space-y-3">
                    <AnimatePresence mode="popLayout">
                      {readyOrders.map(order => (
                        <OrderCard
                          key={order._id}
                          order={order}
                          onAction={updateOrderStatus}
                          onPayment={confirmPayment}
                          isHotel={isHotel}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Bottom padding so last card isn't glued to safe area */}
              <div style={{ height: 'env(safe-area-inset-bottom, 16px)' }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audio outside AnimatePresence so it persists */}
      <audio ref={notificationAudioRef} preload="auto">
        <source src="/notification.mp3" type="audio/mpeg" />
      </audio>
    </>
  );
}
