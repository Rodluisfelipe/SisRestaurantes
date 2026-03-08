import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { socket } from '../../services/socket';

const STATUS_CONFIG = {
  pending: { label: 'Pendiente', bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-400', next: 'confirmed', nextLabel: 'Confirmar' },
  pending_payment: { label: 'Pago pendiente', bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-400', next: null, nextLabel: null },
  payment_uploaded: { label: 'Pago subido', bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-400', next: 'payment_confirmed', nextLabel: 'Confirmar pago' },
  payment_confirmed: { label: 'Pago confirmado', bg: 'bg-indigo-100', text: 'text-indigo-800', dot: 'bg-indigo-400', next: 'confirmed', nextLabel: 'Confirmar' },
  confirmed: { label: 'Confirmada', bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-400', next: 'preparing', nextLabel: 'Preparar' },
  preparing: { label: 'En preparación', bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-400', next: 'ready', nextLabel: 'Lista' },
  ready: { label: 'Lista', bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-400', next: 'completed', nextLabel: 'Completar' },
};

const METHOD_LABELS = { cash: 'Efectivo', nequi: 'Nequi', daviplata: 'Daviplata', transfer: 'Transferencia', transferencia: 'Transferencia' };
const TYPE_LABELS = { inSite: 'Mesa', takeaway: 'Para llevar', delivery: 'Domicilio' };

export default function POSActiveOrders({ businessId, themeColor }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [filter, setFilter] = useState('all'); // all, pos, menuby

  const fetchOrders = useCallback(async () => {
    if (!businessId) return;
    try {
      console.log('[POSActiveOrders] fetching businessId:', businessId);
      const res = await api.get(`/orders?businessId=${businessId}&status=pending,pending_payment,payment_uploaded,payment_confirmed,confirmed,preparing,ready`);
      console.log('[POSActiveOrders] got', Array.isArray(res.data) ? res.data.length : 0, 'orders');
      const data = Array.isArray(res.data) ? res.data : [];
      setOrders(data.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
    } catch (err) {
      console.error('[POSActiveOrders] fetch error:', err?.response?.status, err?.response?.data, 'businessId:', businessId);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);

    const handleOrderCreated = (order) => {
      if (order?.businessId === businessId || order?.businessId?._id === businessId) {
        setOrders(prev => {
          if (prev.find(o => o._id === order._id)) return prev;
          return [...prev, order].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        });
      }
    };

    const handleOrderUpdated = (order) => {
      if (!order) return;
      setOrders(prev => {
        const completedStatuses = ['completed', 'cancelled', 'delivered'];
        if (completedStatuses.includes(order.status)) {
          return prev.filter(o => o._id !== order._id);
        }
        return prev.map(o => o._id === order._id ? order : o);
      });
    };

    const handleOrderDeleted = (data) => {
      if (data?._id) setOrders(prev => prev.filter(o => o._id !== data._id));
    };

    socket.on('order_created', handleOrderCreated);
    socket.on('order_updated', handleOrderUpdated);
    socket.on('order_deleted', handleOrderDeleted);

    return () => {
      clearInterval(interval);
      socket.off('order_created', handleOrderCreated);
      socket.off('order_updated', handleOrderUpdated);
      socket.off('order_deleted', handleOrderDeleted);
    };
  }, [businessId, fetchOrders]);

  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/status`, { status: newStatus, businessId });
      setOrders(prev => {
        if (newStatus === 'completed' || newStatus === 'cancelled') {
          return prev.filter(o => o._id !== orderId);
        }
        return prev.map(o => o._id === orderId ? { ...o, status: newStatus } : o);
      });
    } catch (err) {
      console.error('Error updating order:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrders = orders.filter(o => {
    if (filter === 'pos') return o.orderChannel === 'pos';
    if (filter === 'menuby') return o.orderChannel !== 'pos';
    return true;
  });

  const posCount = orders.filter(o => o.orderChannel === 'pos').length;
  const menubyCount = orders.filter(o => o.orderChannel !== 'pos').length;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: themeColor }} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
      {/* Filter pills */}
      <div className="px-4 py-3 flex items-center gap-2 flex-shrink-0">
        {[
          { key: 'all', label: 'Todas', count: orders.length },
          { key: 'pos', label: 'POS', count: posCount },
          { key: 'menuby', label: 'MenuBy', count: menubyCount },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              filter === f.key ? 'text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'
            }`}
            style={filter === f.key ? { backgroundColor: themeColor } : {}}
          >
            {f.label}
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
              filter === f.key ? 'bg-white/25' : 'bg-slate-100'
            }`}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Orders list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <svg className="w-7 h-7 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>
            </div>
            <p className="text-sm font-bold text-slate-400">Sin órdenes activas</p>
            <p className="text-xs text-slate-300 mt-1">Las órdenes aparecerán aquí</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredOrders.map(order => {
              const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.confirmed;
              const isUpdating = updatingId === order._id;
              const isPOS = order.orderChannel === 'pos';
              const time = new Date(order.createdAt);
              const elapsed = Math.floor((Date.now() - time.getTime()) / 60000);

              return (
                <div key={order._id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  {/* Card header */}
                  <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-800">#{order.orderNumber}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isPOS ? 'bg-indigo-50 text-indigo-600' : 'bg-violet-50 text-violet-600'}`}>
                        {isPOS ? 'POS' : 'MenuBy'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${config.bg} ${config.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                        {config.label}
                      </span>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="px-3.5 py-2.5 space-y-1.5">
                    {/* Customer & type */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 truncate max-w-[60%]">
                        {order.customerName !== 'POS' ? order.customerName : 'Sin nombre'}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <span>{TYPE_LABELS[order.orderType] || order.orderType}</span>
                        {order.tableNumber && <span className="font-bold text-slate-600">M{order.tableNumber}</span>}
                      </div>
                    </div>

                    {/* Items summary */}
                    <div className="space-y-0.5">
                      {(order.items || []).slice(0, 3).map((item, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-slate-600 truncate max-w-[70%]">{item.quantity}x {item.name}</span>
                          <span className="text-slate-400 font-semibold">${((item.totalPrice || item.price) * item.quantity).toLocaleString()}</span>
                        </div>
                      ))}
                      {(order.items || []).length > 3 && (
                        <span className="text-[10px] text-slate-300">+{order.items.length - 3} más</span>
                      )}
                    </div>

                    {/* Total & time */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-800">${(order.finalAmount || order.totalAmount || 0).toLocaleString()}</span>
                        {order.paymentMethod && (
                          <span className="text-[10px] text-slate-400">{METHOD_LABELS[order.paymentMethod] || order.paymentMethod}</span>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold ${elapsed > 15 ? 'text-red-500' : elapsed > 8 ? 'text-amber-500' : 'text-slate-400'}`}>
                        {elapsed < 1 ? 'Ahora' : `${elapsed} min`}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  {config.next && (
                    <div className="px-3.5 py-2 border-t border-slate-50 flex gap-2">
                      {order.status !== 'pending' && (
                        <button
                          onClick={() => handleStatusChange(order._id, 'cancelled')}
                          disabled={isUpdating}
                          className="px-3 py-2 rounded-lg text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                      )}
                      <button
                        onClick={() => handleStatusChange(order._id, config.next)}
                        disabled={isUpdating}
                        className="flex-1 py-2 rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                        style={{ backgroundColor: themeColor }}
                      >
                        {isUpdating ? (
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                        ) : (
                          <>
                            {config.next === 'preparing' && <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>}
                            {config.next === 'ready' && <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
                            {config.next === 'completed' && <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
                            {config.nextLabel}
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
