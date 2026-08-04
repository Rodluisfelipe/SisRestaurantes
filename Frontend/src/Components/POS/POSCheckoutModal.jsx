import React, { useState, useMemo, useEffect } from 'react';
import api from '../../services/api';
import { queueOfflineOrder } from '../../services/posOfflineStore';

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Efectivo', color: '#059669', svg: 'M2 8a2 2 0 012-2h16a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8z M2 11h20 M7 15h.01' },
  { id: 'nequi', label: 'Nequi', color: '#E5007E', svg: 'M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z M12 17h.01' },
  { id: 'daviplata', label: 'Daviplata', color: '#ED1C27', svg: 'M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z M12 17h.01' },
  { id: 'transfer', label: 'Transferencia', color: '#2563EB', svg: 'M3 10h18 M6 6l-3 4 3 4 M18 14l3-4-3-4 M3 10v8a2 2 0 002 2h14a2 2 0 002-2v-8' },
];

const ORDER_TYPE_ICONS = {
  inSite: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12v6a2 2 0 002 2h10a2 2 0 002-2v-6',
  takeaway: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
  delivery: 'M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0',
};

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000];

export default function POSCheckoutModal({ cart, businessConfig, onClose, onOrderComplete, cashRegister, preselectedTable, isOnline = true, tabOrder = null }) {
  const isTab = !!tabOrder;
  const isHotel = businessConfig?.businessType === 'hotel';
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);
  const ORDER_TYPES = [
    { id: 'inSite', label: isService ? 'Presencial' : 'En mesa', icon: ORDER_TYPE_ICONS.inSite },
    { id: 'takeaway', label: isService ? 'A domicilio' : 'Para llevar', icon: ORDER_TYPE_ICONS.takeaway },
    { id: 'delivery', label: 'Domicilio', icon: ORDER_TYPE_ICONS.delivery },
  ];
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [orderType, setOrderType] = useState(preselectedTable ? 'inSite' : 'takeaway');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [tableNumber, setTableNumber] = useState(preselectedTable?.tableNumber || '');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryZones, setDeliveryZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [notes, setNotes] = useState('');
  const [tipPct, setTipPct] = useState(0);
  const [discount, setDiscount] = useState(''); // monto de descuento (string)
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const themeColor = businessConfig?.theme?.buttonColor || '#3B82F6';
  const businessId = businessConfig?._id;

  // Fetch delivery zones
  useEffect(() => {
    if (businessId) {
      api.get(`/delivery-zones/public?businessId=${businessId}`)
        .then(res => setDeliveryZones(res.data?.zones || []))
        .catch(() => {});
    }
  }, [businessId]);

  const subtotal = useMemo(() => {
    if (isTab) return tabOrder.totalAmount || 0; // total autoritativo de la cuenta
    return cart.reduce((sum, item) => sum + (item.totalPrice || item.price || 0) * item.quantity, 0);
  }, [cart, isTab, tabOrder]);
  const deliveryFee = orderType === 'delivery' ? (selectedZone?.pricing?.displayPrice || 0) : 0;
  const discountAmount = Math.min(parseInt(discount) || 0, subtotal);
  const tipAmount = Math.round(subtotal * tipPct / 100);
  const total = Math.max(0, subtotal + deliveryFee - discountAmount + tipAmount);
  const cashNum = parseFloat(cashReceived) || 0;
  const change = paymentMethod === 'cash' ? cashNum - total : 0;

  const canSubmit = paymentMethod !== 'cash' || cashNum >= total;

  const handleQuickAmount = (amount) => {
    setCashReceived(prev => String((parseFloat(prev) || 0) + amount));
  };

  const handleExact = () => setCashReceived(String(total));

  const handleNumpad = (val) => {
    if (val === 'C') return setCashReceived('');
    if (val === '⌫') return setCashReceived(prev => prev.slice(0, -1));
    setCashReceived(prev => prev + val);
  };

  const hasZones = deliveryZones.length > 0;
  const canSubmitDelivery = orderType !== 'delivery' || (deliveryAddress.trim() && customerName.trim() && (!hasZones || selectedZone));

  const handleSubmit = async () => {
    if (submitting || !canSubmit || !canSubmitDelivery) return;
    setSubmitting(true);
    setError('');

    // Cobrar cuenta abierta de mesa: no crea orden nueva, cierra la existente
    if (isTab) {
      try {
        const res = await api.patch(`/orders/${tabOrder._id}/pay-tab`, {
          businessId,
          paymentMethod,
          tipAmount: tipAmount || 0,
          discountAmount: discountAmount || 0,
          posPaymentInfo: paymentMethod === 'cash' ? { cashReceived: cashNum, change } : undefined,
        });
        const order = res.data?.order || res.data;
        order._posExtra = {
          paymentMethod,
          cashReceived: paymentMethod === 'cash' ? cashNum : null,
          change: paymentMethod === 'cash' ? change : null,
        };
        onOrderComplete(order);
      } catch (err) {
        setError(err.response?.data?.message || 'Error al cobrar la cuenta');
        setSubmitting(false);
      }
      return;
    }

    try {
      const items = cart.map(item => ({
        productId: item._id,
        name: item.name,
        price: item.totalPrice || item.price,
        quantity: item.quantity,
        selectedToppings: item.selectedToppings || [],
      }));

      const orderData = {
        businessId,
        customerName: customerName.trim() || 'POS',
        orderType,
        tableNumber: orderType === 'inSite' ? tableNumber.trim() : '',
        phone: customerPhone.trim(),
        address: orderType === 'delivery' ? deliveryAddress.trim() : '',
        items,
        /* Solo los productos: el domicilio viaja aparte en deliveryFee y el
           servidor lo suma al final. Enviarlo aquí hacía que la validación de
           precios lo leyera como un sobreprecio y rechazara el pedido. */
        totalAmount: String(subtotal),
        discountAmount: discountAmount || undefined,
        tipAmount: tipAmount || undefined,
        paymentMethod,
        orderChannel: 'pos',
        customerNotes: notes.trim(),
        posPaymentInfo: paymentMethod === 'cash' ? { cashReceived: cashNum, change } : undefined,
      };

      if (orderType === 'delivery' && selectedZone) {
        orderData.deliveryFee = deliveryFee;
        orderData.deliveryZoneName = selectedZone.name;
        orderData.deliveryZoneId = selectedZone.id || selectedZone._id;
        orderData.deliveryCalculated = true;
      }

      let order;

      if (!isOnline) {
        // Offline: queue order locally
        const queued = await queueOfflineOrder(orderData);
        order = {
          ...orderData,
          _id: queued.offlineId,
          localOrderNumber: queued.localOrderNumber,
          orderNumber: queued.localOrderNumber,
          status: 'pending',
          _offline: true,
          createdAt: new Date().toISOString(),
        };
      } else {
        try {
          const res = await api.post('/orders', orderData);
          order = res.data?.order || res.data;
        } catch (networkErr) {
          // Network error while online — fallback to offline queue
          if (!networkErr.response) {
            const queued = await queueOfflineOrder(orderData);
            order = {
              ...orderData,
              _id: queued.offlineId,
              localOrderNumber: queued.localOrderNumber,
              orderNumber: queued.localOrderNumber,
              status: 'pending',
              _offline: true,
              createdAt: new Date().toISOString(),
            };
          } else {
            throw networkErr;
          }
        }
      }

      order._posExtra = {
        paymentMethod,
        cashReceived: paymentMethod === 'cash' ? cashNum : null,
        change: paymentMethod === 'cash' ? change : null,
      };

      onOrderComplete(order);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al crear la orden');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-t-2xl lg:rounded-2xl shadow-2xl w-full lg:max-w-5xl lg:mx-4 max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 lg:px-6 py-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2 lg:gap-3">
            <h2 className="text-base lg:text-lg font-bold text-slate-800">{isTab ? `Cobrar ${isHotel ? 'Hab.' : 'Mesa'} ${tabOrder.tableNumber}` : 'Cobrar'}</h2>
            <span className="text-xl lg:text-2xl font-black" style={{ color: themeColor }}>${total.toLocaleString()}</span>
            {orderType === 'delivery' && deliveryFee > 0 && (
              <span className="text-xs text-slate-400 hidden sm:inline">
                ({isService ? 'Servicios' : 'Productos'} ${subtotal.toLocaleString()} + Domicilio ${deliveryFee.toLocaleString()})
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-2 -mr-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Two-column body — stacks on mobile */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 min-h-0 overflow-hidden">
          {/* LEFT COLUMN — Order details */}
          <div className="p-4 lg:p-5 space-y-4 overflow-y-auto border-b lg:border-b-0 lg:border-r border-slate-100">
            {/* Order type */}
            {!isTab && <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tipo de orden</p>
              <div className="grid grid-cols-3 gap-2">
                {ORDER_TYPES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setOrderType(t.id); if (t.id !== 'delivery') setSelectedZone(null); }}
                    className={`py-2.5 lg:py-2 rounded-xl text-xs font-bold border-2 transition-all flex flex-col items-center gap-1 ${
                      orderType === t.id
                        ? 'text-white border-transparent shadow-md'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                    style={orderType === t.id ? { backgroundColor: themeColor, borderColor: themeColor } : undefined}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={t.icon}/></svg>
                    {t.id === 'inSite' && isHotel ? 'En hab.' : t.label}
                  </button>
                ))}
              </div>
            </div>}

            {/* Cuenta abierta: resumen de la mesa */}
            {isTab && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cuenta de {isHotel ? 'Hab.' : 'Mesa'} {tabOrder.tableNumber}</p>
                <p className="text-sm text-slate-600 mt-1">{cart.reduce((s, i) => s + i.quantity, 0)} artículo(s) acumulado(s) · Orden #{tabOrder.orderNumber}</p>
              </div>
            )}

            {/* Order-type specific fields */}
            {!isTab && orderType === 'inSite' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Cliente (opcional)</label>
                  <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nombre" className="w-full px-3 py-2.5 lg:py-2 rounded-xl lg:rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': `${themeColor}40` }} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">{isHotel ? 'Hab.' : 'Mesa'} (opcional)</label>
                  <input type="text" value={tableNumber} onChange={e => setTableNumber(e.target.value)} placeholder="Ej: 5" className="w-full px-3 py-2.5 lg:py-2 rounded-xl lg:rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': `${themeColor}40` }} />
                </div>
              </div>
            )}

            {!isTab && orderType === 'takeaway' && (
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Cliente (opcional)</label>
                <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nombre" className="w-full px-3 py-2.5 lg:py-2 rounded-xl lg:rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': `${themeColor}40` }} />
              </div>
            )}

            {!isTab && orderType === 'delivery' && (
              <div className="space-y-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Datos de entrega</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Nombre *</label>
                    <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nombre del cliente" className="w-full px-3 py-2.5 lg:py-2 rounded-xl lg:rounded-lg border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': `${themeColor}40` }} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Teléfono</label>
                    <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="300 123 4567" className="w-full px-3 py-2.5 lg:py-2 rounded-xl lg:rounded-lg border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': `${themeColor}40` }} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Dirección *</label>
                  <input type="text" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="Calle, barrio, referencia..." className="w-full px-3 py-2.5 lg:py-2 rounded-xl lg:rounded-lg border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': `${themeColor}40` }} />
                </div>
                {deliveryZones.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Zona de entrega *</label>
                    {!selectedZone && (
                      <p className="text-xs text-amber-600 mb-1.5">Selecciona una zona para calcular el domicilio</p>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      {deliveryZones.map(z => {
                        const zoneKey = z.id || z._id;
                        const selectedKey = selectedZone?.id || selectedZone?._id;
                        const isSelected = selectedKey === zoneKey;
                        return (
                        <button
                          key={zoneKey}
                          onClick={() => setSelectedZone(isSelected ? null : z)}
                          className={`p-2 rounded-lg border-2 text-left transition-all ${
                            isSelected
                              ? 'border-transparent text-white shadow-md'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                          style={isSelected ? { backgroundColor: z.color || themeColor, borderColor: z.color || themeColor } : undefined}
                        >
                          <p className="text-xs font-bold">{z.name}</p>
                          <p className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                            {z.pricing?.priceLabel || `$${(z.pricing?.displayPrice || 0).toLocaleString()}`}
                            {z.estimatedTime ? ` · ${z.estimatedTime}` : ''}
                          </p>
                        </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Notas (opcional)</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Instrucciones especiales..." className="w-full px-3 py-2.5 lg:py-2 rounded-xl lg:rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': `${themeColor}40` }} />
            </div>

            {/* Cart summary */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Resumen ({cart.reduce((s, i) => s + i.quantity, 0)} artículos)</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {cart.map((item, i) => (
                  <div key={i} className="flex justify-between items-center text-sm py-1.5 px-2 rounded-lg bg-slate-50">
                    <span className="text-slate-700 truncate flex-1">
                      <span className="font-bold text-slate-500 mr-1">{item.quantity}x</span>
                      {item.name}
                    </span>
                    <span className="font-bold text-slate-800 ml-2 shrink-0">${((item.totalPrice || item.price || 0) * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Descuento y propina */}
            <div className="space-y-2.5">
              {/* Descuento */}
              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Descuento</p>
                <div className="flex gap-1.5">
                  {[5, 10, 15].map(p => (
                    <button key={p} type="button" onClick={() => setDiscount(String(Math.round(subtotal * p / 100)))} className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-600 transition-colors">{p}%</button>
                  ))}
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input inputMode="numeric" value={discount} onChange={e => setDiscount(e.target.value.replace(/\D/g, ''))} placeholder="0" className="w-full pl-6 pr-8 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': `${themeColor}40` }} />
                    {discount && <button type="button" onClick={() => setDiscount('')} className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs">×</button>}
                  </div>
                </div>
              </div>
              {/* Propina */}
              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Propina</p>
                <div className="flex gap-1.5 items-center">
                  {[0, 5, 10, 15].map(p => {
                    const active = tipPct === p;
                    return (
                      <button key={p} type="button" onClick={() => setTipPct(p)} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${active ? 'text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} style={active ? { backgroundColor: themeColor } : undefined}>
                        {p === 0 ? 'Sin' : `${p}%`}
                      </button>
                    );
                  })}
                  {tipAmount > 0 && <span className="ml-auto text-sm font-black text-slate-700 tabular-nums">+${tipAmount.toLocaleString()}</span>}
                </div>
              </div>
              {/* Desglose */}
              <div className="rounded-xl bg-slate-50 p-3 space-y-1 text-[13px]">
                <div className="flex justify-between text-slate-500"><span>Subtotal</span><span className="tabular-nums">${subtotal.toLocaleString()}</span></div>
                {deliveryFee > 0 && <div className="flex justify-between text-slate-500"><span>Envío</span><span className="tabular-nums">${deliveryFee.toLocaleString()}</span></div>}
                {discountAmount > 0 && <div className="flex justify-between text-emerald-600"><span>Descuento</span><span className="tabular-nums">-${discountAmount.toLocaleString()}</span></div>}
                {tipAmount > 0 && <div className="flex justify-between text-slate-500"><span>Propina</span><span className="tabular-nums">+${tipAmount.toLocaleString()}</span></div>}
                <div className="flex justify-between pt-1.5 mt-0.5 border-t border-slate-200 font-black text-slate-900 text-[15px]"><span>Total</span><span className="tabular-nums">${total.toLocaleString()}</span></div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN — Payment */}
          <div className="p-4 lg:p-5 flex flex-col gap-4 overflow-y-auto">
            {/* Payment method */}
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Método de pago</p>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(m => {
                  const active = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setPaymentMethod(m.id)}
                      className={`relative py-2.5 px-3 rounded-xl border-2 transition-all flex items-center gap-2.5 ${
                        active ? 'shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                      style={active ? { borderColor: m.color, backgroundColor: `${m.color}0d` } : undefined}
                    >
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${m.color}1a`, color: m.color }}>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={m.svg} /></svg>
                      </span>
                      <span className="text-[13px] font-bold" style={{ color: active ? m.color : '#334155' }}>{m.label}</span>
                      {active && (
                        <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: m.color }}>
                          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 12.75l6 6 9-13.5" /></svg>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cash input — only for cash */}
            {paymentMethod === 'cash' && (
              <div className="space-y-2 flex-1">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Efectivo recibido</p>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={cashReceived ? `$${parseInt(cashReceived).toLocaleString()}` : ''}
                    readOnly
                    className="w-full text-center text-xl font-bold py-2 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-800 focus:outline-none"
                    placeholder="$0"
                  />
                </div>

                {/* Quick amounts */}
                <div className="grid grid-cols-4 gap-1.5">
                  {QUICK_AMOUNTS.map(a => (
                    <button key={a} onClick={() => handleQuickAmount(a)} className="py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors">
                      +${(a / 1000)}K
                    </button>
                  ))}
                  <button onClick={handleExact} className="py-1.5 rounded-lg text-xs font-bold text-white transition-colors col-span-2" style={{ backgroundColor: themeColor }}>
                    Exacto
                  </button>
                  <button onClick={() => handleNumpad('C')} className="py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-xs font-bold text-red-600 transition-colors col-span-2">
                    Borrar
                  </button>
                </div>

                {/* Numpad */}
                <div className="grid grid-cols-3 gap-1.5">
                  {['1','2','3','4','5','6','7','8','9','00','0','⌫'].map(k => (
                    <button key={k} onClick={() => handleNumpad(k)} className="py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-bold text-slate-700 transition-colors active:scale-95">
                      {k}
                    </button>
                  ))}
                </div>

                {/* Change */}
                {cashNum > 0 && (
                  <div className={`text-center p-2.5 rounded-xl ${change >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    <p className="text-xs font-medium text-slate-500">Cambio</p>
                    <p className={`text-xl font-black ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      ${Math.abs(change).toLocaleString()}
                    </p>
                    {change < 0 && <p className="text-xs text-red-500 mt-0.5">Falta dinero</p>}
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="text-center text-sm text-red-600 bg-red-50 py-2 rounded-lg">{error}</div>
            )}

            {/* Submit — always at bottom */}
            {!isOnline && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs shrink-0">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01"/></svg>
                Sin conexión — la orden se guardará localmente
              </div>
            )}
            <button
              onClick={handleSubmit}
              disabled={submitting || !canSubmit || !canSubmitDelivery}
              className="w-full py-3.5 rounded-xl text-white font-bold text-base shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shrink-0 mt-auto"
              style={{ backgroundColor: !isOnline ? '#d97706' : themeColor }}
            >
              {submitting ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {!isOnline ? `Guardar offline · $${total.toLocaleString()}` : `Confirmar cobro · $${total.toLocaleString()}`}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
