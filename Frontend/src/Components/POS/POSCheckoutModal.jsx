import React, { useState, useMemo } from 'react';
import api from '../../services/api';

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Efectivo', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm0-5c-.83 0-1.5-.67-1.5-1.5V7c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v3c0 .83-.67 1.5-1.5 1.5z' },
  { id: 'nequi', label: 'Nequi', icon: null },
  { id: 'daviplata', label: 'Daviplata', icon: null },
  { id: 'transfer', label: 'Transferencia', icon: null },
];

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000];

export default function POSCheckoutModal({ cart, businessConfig, onClose, onOrderComplete, cashRegister }) {
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const themeColor = businessConfig?.theme?.buttonColor || '#3B82F6';
  const businessId = businessConfig?._id;

  const total = useMemo(() => cart.reduce((sum, item) => sum + (item.totalPrice || item.price || 0) * item.quantity, 0), [cart]);
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

  const handleSubmit = async () => {
    if (submitting || !canSubmit) return;
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
        orderType: tableNumber.trim() ? 'inSite' : 'takeaway',
        tableNumber: tableNumber.trim() || '',
        phone: '',
        address: '',
        items,
        totalAmount: String(total),
        paymentMethod,
        orderChannel: 'pos',
        customerNotes: notes.trim(),
      };

      const res = await api.post('/orders', orderData);
      const order = res.data?.order || res.data;

      // Attach extra info for ticket
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Cobrar venta</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Total */}
          <div className="text-center">
            <p className="text-sm text-slate-500 font-medium">Total a cobrar</p>
            <p className="text-4xl font-black text-slate-900 mt-1">${total.toLocaleString()}</p>
          </div>

          {/* Payment method */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Método de pago</p>
            <div className="grid grid-cols-4 gap-2">
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
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Efectivo recibido</p>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cashReceived ? `$${parseInt(cashReceived).toLocaleString()}` : ''}
                  readOnly
                  className="w-full text-center text-2xl font-bold py-3 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-800 focus:outline-none"
                  placeholder="$0"
                />
              </div>

              {/* Quick amounts */}
              <div className="grid grid-cols-4 gap-1.5">
                {QUICK_AMOUNTS.map(a => (
                  <button key={a} onClick={() => handleQuickAmount(a)} className="py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors">
                    +${(a / 1000)}K
                  </button>
                ))}
                <button onClick={handleExact} className="py-2 rounded-lg text-xs font-bold text-white transition-colors col-span-2" style={{ backgroundColor: themeColor }}>
                  Exacto
                </button>
                <button onClick={() => handleNumpad('C')} className="py-2 rounded-lg bg-red-50 hover:bg-red-100 text-xs font-bold text-red-600 transition-colors col-span-2">
                  Borrar
                </button>
              </div>

              {/* Numpad */}
              <div className="grid grid-cols-3 gap-1.5">
                {['1','2','3','4','5','6','7','8','9','00','0','⌫'].map(k => (
                  <button key={k} onClick={() => handleNumpad(k)} className="py-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-base font-bold text-slate-700 transition-colors active:scale-95">
                    {k}
                  </button>
                ))}
              </div>

              {/* Change */}
              {cashNum > 0 && (
                <div className={`text-center p-3 rounded-xl ${change >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <p className="text-xs font-medium text-slate-500">Cambio</p>
                  <p className={`text-2xl font-black ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    ${Math.abs(change).toLocaleString()}
                  </p>
                  {change < 0 && <p className="text-xs text-red-500 mt-0.5">Falta dinero</p>}
                </div>
              )}
            </div>
          )}

          {/* Optional fields */}
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
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Notas (opcional)</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Instrucciones especiales..." className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': `${themeColor}40` }} />
          </div>

          {error && (
            <div className="text-center text-sm text-red-600 bg-red-50 py-2 rounded-lg">{error}</div>
          )}
        </div>

        {/* Submit */}
        <div className="px-6 pb-6">
          <button
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
            className="w-full py-4 rounded-xl text-white font-bold text-base shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            style={{ backgroundColor: themeColor }}
          >
            {submitting ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Confirmar cobro
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
