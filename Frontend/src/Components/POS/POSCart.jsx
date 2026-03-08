import React from 'react';

export default function POSCart({ cart, updateQuantity, removeFromCart, clearCart, onCheckout, themeColor }) {
  const total = cart.reduce((sum, item) => sum + item.totalPrice * item.quantity, 0);

  return (
    <div className="h-full flex flex-col bg-white border-l border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
          <h2 className="font-bold text-slate-800">Venta actual</h2>
          {cart.length > 0 && (
            <span className="text-xs text-white rounded-full w-5 h-5 flex items-center justify-center font-bold" style={{ backgroundColor: themeColor }}>
              {cart.reduce((s, i) => s + i.quantity, 0)}
            </span>
          )}
        </div>
        {cart.length > 0 && (
          <button onClick={clearCart} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Vaciar venta">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
        )}
      </div>

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <svg className="w-7 h-7 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
            </div>
            <p className="text-sm font-medium text-slate-400">Sin productos</p>
            <p className="text-xs text-slate-300 mt-1">Toca un producto para agregarlo</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {cart.map(item => (
              <div key={item.uniqueId} className="px-4 py-3 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 leading-tight truncate">{item.name}</p>
                    {item.selectedToppings && item.selectedToppings.length > 0 && (
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                        + {item.selectedToppings.map(t => t.name).join(', ')}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-1">${item.totalPrice?.toLocaleString()} c/u</p>
                  </div>
                  <button onClick={() => removeFromCart(item.uniqueId)} className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(item.uniqueId, item.quantity - 1)}
                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                    >
                      <svg className="w-3 h-3 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><path d="M5 12h14"/></svg>
                    </button>
                    <span className="w-7 text-center text-sm font-bold text-slate-800 tabular-nums">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.uniqueId, item.quantity + 1)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors text-white"
                      style={{ backgroundColor: themeColor }}
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                    </button>
                  </div>
                  <span className="text-sm font-bold text-slate-900">${(item.totalPrice * item.quantity).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer / Checkout */}
      {cart.length > 0 && (
        <div className="border-t border-slate-200 p-4 space-y-3 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">{cart.reduce((s, i) => s + i.quantity, 0)} artículo(s)</span>
            <span className="text-xl font-black text-slate-900">${total.toLocaleString()}</span>
          </div>
          <button
            onClick={() => onCheckout(total)}
            className="w-full py-3.5 rounded-xl text-white font-bold text-base shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            style={{ backgroundColor: themeColor }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>
            Cobrar ${total.toLocaleString()}
          </button>
        </div>
      )}
    </div>
  );
}
