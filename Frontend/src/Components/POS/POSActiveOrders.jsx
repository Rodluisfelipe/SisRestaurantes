import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

const METHOD_LABELS = { cash: 'Efectivo', nequi: 'Nequi', daviplata: 'Daviplata', transfer: 'Transferencia', transferencia: 'Transferencia', roomCharge: 'Cargo a hab.' };
const TYPE_LABELS_DEFAULT = { inSite: 'Mesa', takeaway: 'Para llevar', delivery: 'Domicilio' };
const TYPE_LABELS_HOTEL = { inSite: 'Hab.', takeaway: 'Para llevar', delivery: 'Domicilio' };
const TYPE_LABELS_SERVICE = { inSite: 'Presencial', takeaway: 'A domicilio', delivery: 'Domicilio' };

export default function POSActiveOrders({ businessId, themeColor, businessConfig }) {
  const isHotel = businessConfig?.businessType === 'hotel';
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);
  const TYPE_LABELS = isService ? TYPE_LABELS_SERVICE : isHotel ? TYPE_LABELS_HOTEL : TYPE_LABELS_DEFAULT;
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [filter, setFilter] = useState('all'); // all, pos, menuby
  const [detailOrder, setDetailOrder] = useState(null);

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
    // Polling as fallback only (socket is primary). 30s with visibility check.
    const interval = setInterval(() => {
      if (!document.hidden) fetchOrders();
    }, 30000);

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
    const bName = businessConfig?.businessName || 'Mi Negocio';
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
    const orderTypeLabels = { inSite: isHotel ? 'En habitación' : isService ? 'Presencial' : 'En mesa', takeaway: isService ? 'A domicilio' : 'Para llevar', delivery: 'Delivery' };
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
    if (order.tableNumber) customerHtml += `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:16px;color:#000"><span>${isHotel ? 'Hab.:' : 'Mesa:'}</span><span>${order.tableNumber}</span></div>`;
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
      ${order.paymentMethod ? `<div style="border-top:2px dashed #000;margin:8px 0"></div><div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:15px;color:#000"><span>Pago:</span><span>${{'cash':'Efectivo','efectivo':'Efectivo','nequi':'Nequi','daviplata':'Daviplata','transfer':'Transferencia','transferencia':'Transferencia','other':'Otro'}[order.paymentMethod] || order.paymentMethod}</span></div>` : ''}${order.posPaymentInfo?.cashReceived != null ? `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:15px;color:#000"><span>Recibido:</span><span>$${order.posPaymentInfo.cashReceived.toLocaleString()}</span></div>` : ''}${order.posPaymentInfo?.change > 0 ? `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:15px;color:#000"><span>Cambio:</span><span>$${order.posPaymentInfo.change.toLocaleString()}</span></div>` : ''}
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

  const filteredOrders = useMemo(() => orders.filter(o => {
    if (filter === 'pos') return o.orderChannel === 'pos';
    if (filter === 'menuby') return o.orderChannel !== 'pos';
    return true;
  }), [orders, filter]);

  const posCount = useMemo(() => orders.filter(o => o.orderChannel === 'pos').length, [orders]);
  const menubyCount = useMemo(() => orders.filter(o => o.orderChannel !== 'pos').length, [orders]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: themeColor }} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F5F6F8]">
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

              const custName = order.customerName;
              const showCust = custName && custName !== 'POS' && !/^(mesa|hab)\.?\s*/i.test(custName);
              const items = order.items || [];
              const itemCount = items.reduce((s, it) => s + (it.quantity || 1), 0);
              return (
                <div key={order._id} className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_3px_rgba(15,23,42,0.05)] hover:shadow-[0_10px_26px_-12px_rgba(15,23,42,0.22)] transition-shadow overflow-hidden flex flex-col">
                  {/* Status accent strip */}
                  <div className={`h-1.5 ${config.dot}`} />

                  {/* Card header */}
                  <div className="px-4 pt-3 pb-2.5 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg font-black text-slate-900 leading-none">#{order.orderNumber}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide ${isPOS ? 'bg-indigo-50 text-indigo-600' : 'bg-violet-50 text-violet-600'}`}>
                        {isPOS ? 'POS' : 'MENUBY'}
                      </span>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold flex-shrink-0 ${config.bg} ${config.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                      {config.label}
                    </span>
                  </div>

                  {/* Table / customer chips */}
                  {(order.tableNumber || showCust || order.orderType !== 'inSite') && (
                    <div className="px-4 pb-2.5 flex items-center gap-1.5 flex-wrap">
                      {order.tableNumber ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-black">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
                          {isHotel ? 'Hab.' : 'Mesa'} {order.tableNumber}
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-500 text-xs font-bold">{TYPE_LABELS[order.orderType] || order.orderType}</span>
                      )}
                      {showCust && <span className="text-xs text-slate-500 font-medium truncate">{custName}</span>}
                    </div>
                  )}

                  {/* Items — toca para ver el pedido completo */}
                  <div onClick={() => setDetailOrder(order)} className="px-4 pb-2.5 space-y-1 flex-1 cursor-pointer hover:bg-slate-50/70 transition-colors">
                    {items.slice(0, 4).map((item, i) => (
                      <div key={i} className="flex justify-between gap-2 text-[13px]">
                        <span className="text-slate-700 truncate"><span className="font-bold text-slate-400 mr-1">{item.quantity}×</span>{item.name}</span>
                        <span className="text-slate-400 font-semibold tabular-nums flex-shrink-0">${((item.totalPrice || item.price) * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                    {items.length > 4 ? (
                      <span className="inline-flex items-center gap-1 text-[12px] font-black mt-0.5" style={{ color: themeColor }}>
                        Ver pedido completo ({items.length})
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
                      </span>
                    ) : items.length > 0 ? (
                      <span className="text-[10px] text-slate-300">Toca para ver el detalle</span>
                    ) : null}
                  </div>

                  {/* Total & time */}
                  <div className="px-4 py-2.5 bg-slate-50/80 flex items-center justify-between border-t border-slate-100">
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-black text-slate-900 tabular-nums leading-none">${(order.finalAmount || order.totalAmount || 0).toLocaleString()}</span>
                      {order.paymentMethod && <span className="text-[11px] text-slate-400 font-semibold">{METHOD_LABELS[order.paymentMethod] || order.paymentMethod}</span>}
                    </div>
                    <span className={`text-[11px] font-black ${elapsed > 15 ? 'text-red-500' : elapsed > 8 ? 'text-amber-500' : 'text-slate-400'}`}>
                      {elapsed < 1 ? 'Ahora' : `${elapsed} min`}
                    </span>
                  </div>

                  {/* Actions */}
                  {config.next && (
                    <div className="px-3 py-2.5 border-t border-slate-100 flex gap-2">
                      <button onClick={() => handlePrintOrder(order)} className="w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors" title="Imprimir comanda">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
                      </button>
                      <button onClick={() => { if (window.confirm((isService ? '¿Cancelar cita #' : '¿Cancelar pedido #') + order.orderNumber + '?')) handleStatusChange(order._id, 'cancelled'); }} disabled={isUpdating} className="w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center text-red-500 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50" title="Cancelar">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                      </button>
                      <button onClick={() => handleStatusChange(order._id, config.next)} disabled={isUpdating} className="flex-1 py-2.5 rounded-xl text-[13px] font-black text-white transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5" style={{ backgroundColor: themeColor }}>
                        {isUpdating ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        ) : (
                          <>
                            {config.next === 'inProgress' && <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>}
                            {config.next === 'completed' && <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                            {config.next === 'payment_confirmed' && <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>}
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

      {/* Detalle del pedido completo */}
      {detailOrder && (() => {
        const d = detailOrder;
        const dc = STATUS_CONFIG[d.status] || STATUS_CONFIG.confirmed;
        const dItems = d.items || [];
        const dIsPOS = d.orderChannel === 'pos';
        const dTotal = (d.finalAmount || d.totalAmount || 0);
        const dCust = d.customerName;
        const dShowCust = dCust && dCust !== 'POS' && !/^(mesa|hab)\.?\s*/i.test(dCust);
        const dUpdating = updatingId === d._id;
        return (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm sm:p-4" onClick={() => setDetailOrder(null)}>
            <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className={`h-1.5 ${dc.dot} flex-shrink-0`} />
              {/* Header */}
              <div className="px-5 pt-3.5 pb-3 flex items-start justify-between border-b border-slate-100 flex-shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black text-slate-900">#{d.orderNumber}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${dIsPOS ? 'bg-indigo-50 text-indigo-600' : 'bg-violet-50 text-violet-600'}`}>{dIsPOS ? 'POS' : 'MENUBY'}</span>
                  </div>
                  <span className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${dc.bg} ${dc.text}`}><span className={`w-1.5 h-1.5 rounded-full ${dc.dot}`} />{dc.label}</span>
                </div>
                <button onClick={() => setDetailOrder(null)} className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {/* Meta */}
                <div className="flex flex-wrap gap-1.5">
                  {d.tableNumber ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-black">{isHotel ? 'Hab.' : 'Mesa'} {d.tableNumber}</span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold">{TYPE_LABELS[d.orderType] || d.orderType}</span>
                  )}
                  {dShowCust && <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold">{dCust}</span>}
                  {d.phone && <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-xs font-medium">{d.phone}</span>}
                </div>
                {d.orderType === 'delivery' && d.address && (
                  <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">📍 {d.address}{d.deliveryZoneName ? ` · ${d.deliveryZoneName}` : ''}</p>
                )}

                {/* Items */}
                <div className="space-y-3">
                  {dItems.map((item, i) => (
                    <div key={i} className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 leading-snug">
                          <span className="font-black mr-1" style={{ color: themeColor }}>{item.quantity}×</span>{item.name}
                        </p>
                        {item.selectedToppings && item.selectedToppings.map((t, ti) => (
                          <div key={ti} className="mt-0.5">
                            {t.optionName && <p className="text-[11px] text-slate-500 pl-4 leading-tight">+ {t.groupName ? `${t.groupName}: ` : ''}{t.optionName}{t.price > 0 ? ` ($${t.price.toLocaleString()})` : ''}</p>}
                            {t.subGroups && t.subGroups.map((sg, si) => (
                              <p key={si} className="text-[11px] text-slate-400 pl-6 leading-tight">+ {sg.subGroupTitle ? `${sg.subGroupTitle}: ` : ''}{sg.optionName}{sg.price > 0 ? ` ($${sg.price.toLocaleString()})` : ''}</p>
                            ))}
                          </div>
                        ))}
                      </div>
                      <span className="text-sm font-bold text-slate-800 tabular-nums flex-shrink-0">${((item.totalPrice || item.price || 0) * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="border-t border-slate-100 pt-3 space-y-1.5">
                  {d.deliveryFee > 0 && (
                    <div className="flex justify-between text-[13px] text-slate-500"><span>Envío</span><span className="tabular-nums">${d.deliveryFee.toLocaleString()}</span></div>
                  )}
                  {d.discountAmount > 0 && (
                    <div className="flex justify-between text-[13px] text-emerald-600"><span>Descuento</span><span className="tabular-nums">-${d.discountAmount.toLocaleString()}</span></div>
                  )}
                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Total</span>
                    <span className="text-2xl font-black text-slate-900 tabular-nums">${dTotal.toLocaleString()}</span>
                  </div>
                </div>

                {/* Payment */}
                {d.paymentMethod && (
                  <div className="bg-slate-50 rounded-xl px-3.5 py-2.5 space-y-1">
                    <div className="flex justify-between text-[13px]"><span className="text-slate-400 font-medium">Pago</span><span className="font-bold text-slate-700">{METHOD_LABELS[d.paymentMethod] || d.paymentMethod}</span></div>
                    {d.posPaymentInfo?.cashReceived != null && <div className="flex justify-between text-[13px]"><span className="text-slate-400 font-medium">Recibido</span><span className="font-semibold text-slate-600 tabular-nums">${d.posPaymentInfo.cashReceived.toLocaleString()}</span></div>}
                    {d.posPaymentInfo?.change > 0 && <div className="flex justify-between text-[13px]"><span className="text-slate-400 font-medium">Cambio</span><span className="font-semibold text-emerald-600 tabular-nums">${d.posPaymentInfo.change.toLocaleString()}</span></div>}
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div className="px-4 py-3 border-t border-slate-100 flex gap-2 flex-shrink-0">
                <button onClick={() => handlePrintOrder(d)} className="w-11 h-11 flex-shrink-0 rounded-xl flex items-center justify-center text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors" title="Imprimir">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
                </button>
                {dc.next && (
                  <button onClick={() => { if (window.confirm((isService ? '¿Cancelar cita #' : '¿Cancelar pedido #') + d.orderNumber + '?')) { handleStatusChange(d._id, 'cancelled'); setDetailOrder(null); } }} disabled={dUpdating} className="px-4 h-11 rounded-xl text-[13px] font-bold text-red-500 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50">Cancelar</button>
                )}
                {dc.next && (
                  <button onClick={() => { handleStatusChange(d._id, dc.next); if (dc.next === 'completed' || dc.next === 'cancelled') setDetailOrder(null); }} disabled={dUpdating} className="flex-1 h-11 rounded-xl text-[14px] font-black text-white transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5" style={{ backgroundColor: themeColor }}>
                    {dUpdating ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : dc.nextLabel}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
