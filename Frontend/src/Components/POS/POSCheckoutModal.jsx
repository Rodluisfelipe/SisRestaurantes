import React, { useState, useMemo, useEffect } from 'react';
import api from '../../services/api';
import { queueOfflineOrder } from '../../services/posOfflineStore';

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Efectivo', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm0-5c-.83 0-1.5-.67-1.5-1.5V7c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v3c0 .83-.67 1.5-1.5 1.5z' },
  { id: 'nequi', label: 'Nequi', icon: null },
  { id: 'daviplata', label: 'Daviplata', icon: null },
  { id: 'transfer', label: 'Transferencia', icon: null },
];

const ORDER_TYPES = [
  { id: 'inSite', label: 'En mesa', icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12v6a2 2 0 002 2h10a2 2 0 002-2v-6' },
  { id: 'takeaway', label: 'Para llevar', icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z' },
  { id: 'delivery', label: 'Domicilio', icon: 'M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0' },
];

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000];

export default function POSCheckoutModal({ cart, businessConfig, onClose, onOrderComplete, cashRegister, preselectedTable, isOnline = true }) {
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

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + (item.totalPrice || item.price || 0) * item.quantity, 0), [cart]);
  const deliveryFee = selectedZone?.pricing?.displayPrice || 0;
  const total = orderType === 'delivery' ? subtotal + deliveryFee : subtotal;
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
        totalAmount: String(total),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-4 max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-800">Cobrar venta</h2>
            <span className="text-2xl font-black" style={{ color: themeColor }}>${total.toLocaleString()}</span>
            {orderType === 'delivery' && deliveryFee > 0 && (
              <span className="text-xs text-slate-400">
                (Productos ${subtotal.toLocaleString()} + Domicilio ${deliveryFee.toLocaleString()})
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Two-column body */}
        <div className="flex-1 grid grid-cols-2 min-h-0 overflow-hidden">
          {/* LEFT COLUMN — Order details */}
          <div className="p-5 space-y-4 overflow-y-auto border-r border-slate-100">
            {/* Order type */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tipo de orden</p>
              <div className="grid grid-cols-3 gap-2">
                {ORDER_TYPES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setOrderType(t.id); if (t.id !== 'delivery') setSelectedZone(null); }}
                    className={`py-2 rounded-xl text-xs font-bold border-2 transition-all flex flex-col items-center gap-1 ${
                      orderType === t.id
                        ? 'text-white border-transparent shadow-md'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                    style={orderType === t.id ? { backgroundColor: themeColor, borderColor: themeColor } : undefined}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={t.icon}/></svg>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Order-type specific fields */}
            {orderType === 'inSite' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Cliente (opcional)</label>
                  <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nombre" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': `${themeColor}40` }} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Mesa (opcional)</label>
                  <input type="text" value={tableNumber} onChange={e => setTableNumber(e.target.value)} placeholder="Ej: 5" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': `${themeColor}40` }} />
                </div>
              </div>
            )}

            {orderType === 'takeaway' && (
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Cliente (opcional)</label>
                <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nombre" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': `${themeColor}40` }} />
              </div>
            )}

            {orderType === 'delivery' && (
              <div className="space-y-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Datos de entrega</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Nombre *</label>
                    <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nombre del cliente" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': `${themeColor}40` }} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Teléfono</label>
                    <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="300 123 4567" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': `${themeColor}40` }} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Dirección *</label>
                  <input type="text" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="Calle, barrio, referencia..." className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': `${themeColor}40` }} />
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
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Instrucciones especiales..." className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': `${themeColor}40` }} />
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
          </div>

          {/* RIGHT COLUMN — Payment */}
          <div className="p-5 flex flex-col gap-4 overflow-y-auto">
            {/* Payment method */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Método de pago</p>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id)}
                    className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${
                      paymentMethod === m.id
                        ? 'text-white border-transparent shadow-md'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                    style={paymentMethod === m.id ? { backgroundColor: themeColor, borderColor: themeColor } : undefined}
                  >
                    {m.label}
                  </button>
                ))}
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
