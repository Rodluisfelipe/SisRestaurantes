import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { socket } from '../../services/socket';

const STATUS_CONFIG = {
  pending: { label: 'Pendiente', bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-400', next: 'inProgress', nextLabel: 'Iniciar' },
  pending_payment: { label: 'Pago pendiente', bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-400', next: null, nextLabel: null },
  payment_uploaded: { label: 'Pago subido', bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-400', next: 'payment_confirmed', nextLabel: 'Confirmar pago' },
  payment_confirmed: { label: 'Pago confirmado', bg: 'bg-teal-100', text: 'text-teal-800', dot: 'bg-teal-400', next: 'inProgress', nextLabel: 'Iniciar' },
  confirmed: { label: 'Confirmada', bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-400', next: 'inProgress', nextLabel: 'Iniciar' },
  inProgress: { label: 'En progreso', bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-400', next: 'completed', nextLabel: 'Completar' },
  preparing: { label: 'En preparación', bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-400', next: 'completed', nextLabel: 'Completar' },
  ready: { label: 'Lista', bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-400', next: 'completed', nextLabel: 'Completar' },
};

const METHOD_LABELS = { cash: 'Efectivo', nequi: 'Nequi', daviplata: 'Daviplata', transfer: 'Transferencia', transferencia: 'Transferencia' };
const TYPE_LABELS = { inSite: 'Mesa', takeaway: 'Para llevar', delivery: 'Domicilio' };

export default function POSActiveOrders({ businessId, themeColor, businessConfig }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [filter, setFilter] = useState('all'); // all, pos, menuby

  const fetchOrders = useCallback(async () => {
    if (!businessId) return;
    try {
      const res = await api.get(`/orders?businessId=${businessId}&status=pending,pending_payment,payment_uploaded,payment_confirmed,confirmed,inProgress,preparing,ready&_t=${Date.now()}`);
      const data = Array.isArray(res.data) ? res.data : [];
      setOrders(data.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchOrders();
    // Polling as fallback only (socket is primary). 60s with visibility check.
    const interval = setInterval(() => {
      if (!document.hidden) fetchOrders();
    }, 60000);

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

  const handlePrintOrder = (order) => {
    if (!order) return;
    const bName = businessConfig?.businessName || 'Restaurante';
    const bAddr = businessConfig?.address || '';
    const bPhone = businessConfig?.whatsappNumber || '';
    const bNit = businessConfig?.nit || '';
    const paperSize = businessConfig?.printerSettings?.paperSize || '55';
    const showQR = businessConfig?.printerSettings?.showQR !== false;
    const slug = businessConfig?.slug || '';
    const menuLink = slug ? `https://menuby.tech/${slug}` : '';
    const isFromMenuBy = order.orderChannel !== 'pos';
    const date = new Date(order.createdAt || Date.now());
    const items = order.items || [];
    const total = order.totalAmount || order.finalAmount || 0;
    const orderTypeLabels = { inSite: 'En mesa', takeaway: 'Para llevar', delivery: 'Delivery' };
    const orderTypeLabel = orderTypeLabels[order.orderType] || order.orderType || '';

    let itemsHtml = '';
    items.forEach(item => {
      const lineTotal = ((item.totalPrice || item.price || 0) * (item.quantity || 1));
      const loyaltyTag = item.isLoyaltyReward ? ' \uD83C\uDF81' : '';
      itemsHtml += `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:16px;color:#000"><span style="font-weight:900;font-size:16px;color:#000">${item.quantity}x ${item.name}${loyaltyTag}</span><span style="font-weight:900;font-size:15px">${item.isLoyaltyReward ? 'GRATIS' : '$' + lineTotal.toLocaleString()}</span></div>`;
      if (item.selectedToppings) {
        item.selectedToppings.forEach(t => {
          const tName = t.optionName || t.name || '';
          const tPrice = t.price > 0 ? ` ($${t.price.toLocaleString()})` : '';
          const tGroup = t.groupName ? `${t.groupName}: ` : '';
          if (tName) itemsHtml += `<div style="padding-left:8px;font-size:14px;font-weight:900;color:#000">+ ${tGroup}${tName}${tPrice}</div>`;
          if (t.subGroups) {
            t.subGroups.forEach(sg => {
              const sgPrice = sg.price > 0 ? ` ($${sg.price.toLocaleString()})` : '';
              const sgTitle = sg.subGroupTitle ? `${sg.subGroupTitle}: ` : '';
              itemsHtml += `<div style="padding-left:16px;font-size:13px;font-weight:900;color:#000">+ ${sgTitle}${sg.optionName}${sgPrice}</div>`;
            });
          }
        });
      }
    });

    let customerHtml = '';
    if (order.customerName && order.customerName !== 'POS') customerHtml += `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:15px;color:#000"><span>Cliente:</span><span>${order.customerName}</span></div>`;
    if (order.phone) customerHtml += `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:15px;color:#000"><span>Tel:</span><span>${order.phone}</span></div>`;
    if (orderTypeLabel) customerHtml += `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:15px;color:#000"><span>Tipo:</span><span>${orderTypeLabel}</span></div>`;
    if (order.tableNumber) customerHtml += `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:16px;color:#000"><span>Mesa:</span><span>${order.tableNumber}</span></div>`;
    if (order.orderType === 'delivery' && order.address) customerHtml += `<div style="padding:2px 0;font-weight:900;font-size:14px;color:#000">Dir: ${order.address}</div>`;
    if (order.orderType === 'delivery' && order.deliveryZoneName) customerHtml += `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:14px;color:#000"><span>Zona:</span><span>${order.deliveryZoneName}</span></div>`;

    let deliveryFeeHtml = '';
    if (order.deliveryFee) {
      deliveryFeeHtml = `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:15px;color:#000"><span>Env\u00edo:</span><span>$${order.deliveryFee.toLocaleString()}</span></div>`;
    }

    const qrSection = (isFromMenuBy && showQR && menuLink) ? `
      <div style="text-align:center;margin-top:10px">
        <div style="text-align:center;font-weight:900;font-size:13px;color:#000;margin-bottom:6px">\u00a1Pide desde tu celular!</div>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(menuLink)}&format=png" alt="QR" width="160" height="160" style="display:block;margin:0 auto" />
        <div style="text-align:center;font-weight:900;font-size:12px;color:#000;margin-top:6px">Escanea y pide con descuento</div>
        <div style="text-align:center;font-size:10px;font-weight:900;color:#000;margin-top:2px">${menuLink}</div>
      </div>
    ` : '';

    const finalTotal = total + (order.deliveryFee || 0) - (order.discountAmount || 0);

    const printWindow = window.open('', '_blank', 'width=260,height=700');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Pedido #${order.orderNumber || ''}</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:15px;font-weight:900;width:${paperSize}mm;padding:2mm;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}img{display:block;margin:0 auto}@media print{body{width:${paperSize}mm}@page{margin:0;size:${paperSize}mm auto}}</style>
    </head><body>
      <div style="height:20px"></div>
      <div style="text-align:center;font-weight:900;font-size:20px;color:#000;margin-bottom:2px">${bName}</div>
      ${bAddr ? `<div style="text-align:center;font-weight:900;font-size:12px;color:#000">${bAddr}</div>` : ''}
      ${bPhone ? `<div style="text-align:center;font-weight:900;font-size:12px;color:#000">Tel: ${bPhone}</div>` : ''}
      ${bNit ? `<div style="text-align:center;font-weight:900;font-size:12px;color:#000">NIT: ${bNit}</div>` : ''}
      <div style="border-top:2px dashed #000;margin:8px 0"></div>
      <div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:15px;color:#000"><span>Orden:</span><span style="font-weight:900;font-size:16px">  #${order.orderNumber}</span></div>
      <div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:15px;color:#000"><span>Fecha:</span><span>${date.toLocaleDateString('es-CO')}</span></div>
      <div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:15px;color:#000"><span>Hora:</span><span>${date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span></div>
      ${customerHtml}
      <div style="border-top:2px dashed #000;margin:8px 0"></div>
      ${itemsHtml}
      <div style="border-top:2px dashed #000;margin:8px 0"></div>
      ${deliveryFeeHtml}
      ${order.discountAmount ? `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:15px;color:#000"><span>Descuento:</span><span>-$${order.discountAmount.toLocaleString()}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:20px;font-weight:900;color:#000"><span>TOTAL</span><span style="font-size:22px;font-weight:900">$${parseFloat(finalTotal).toLocaleString()}</span></div>
      <div style="border-top:2px dashed #000;margin:8px 0"></div>
      <div style="text-align:center;font-weight:900;font-size:14px;color:#000;margin-top:6px">\u00a1Gracias por su compra!</div>
      ${qrSection}
      <div style="text-align:center;font-size:11px;font-weight:900;color:#333;margin-top:8px">Gracias por usar MenuBy \u2764\uFE0F</div>
      <div style="text-align:center;font-size:10px;font-weight:bold;color:#555;margin-top:1px">menuby.tech</div>
    </body></html>`);

    printWindow.document.close();
    printWindow.focus();
    const images = printWindow.document.querySelectorAll('img');
    const imgPromises = Array.from(images).map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; }));
    Promise.all(imgPromises).then(() => { setTimeout(() => { printWindow.print(); printWindow.close(); }, 200); });
  };

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
                      <button
                        onClick={() => handlePrintOrder(order)}
                        className="px-3 py-2 rounded-lg text-xs font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors"
                        title="Imprimir comanda"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                      </button>
                      <button
                        onClick={() => { if (window.confirm('¿Cancelar pedido #' + order.orderNumber + '?')) handleStatusChange(order._id, 'cancelled'); }}
                        disabled={isUpdating}
                        className="px-3 py-2 rounded-lg text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        Cancelar
                      </button>
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
                            {config.next === 'inProgress' && <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>}
                            {config.next === 'completed' && <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
                            {config.next === 'payment_confirmed' && <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
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
