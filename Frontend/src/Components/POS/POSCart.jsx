import React, { useState } from 'react';
import { useBusinessConfig } from '../../Context/BusinessContext';
import { X } from 'lucide-react';

export default function POSCart({ cart, updateQuantity, removeFromCart, clearCart, onCheckout, onHoldOrder, heldOrders, onRecallHeldOrder, onDeleteHeldOrder, selectedTable, onClearTable, themeColor }) {
  const { businessConfig } = useBusinessConfig();
  const isHotel = businessConfig?.businessType === 'hotel';
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);
  const tableLabel = isHotel ? 'Hab.' : 'Mesa';
  const total = cart.reduce((sum, item) => sum + (item.totalPrice || item.price || 0) * item.quantity, 0);
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);
  const [showHeld, setShowHeld] = useState(false);

  const iconBtn = "w-9 h-9 rounded-xl flex items-center justify-center transition-all";

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-slate-200/70 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${themeColor}14` }}>
              <svg className="w-[18px] h-[18px]" style={{ color: themeColor }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 01-8 0" /></svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-extrabold text-slate-800 tracking-tight">Venta actual</h2>
                {itemCount > 0 && (
                  <span className="text-[11px] text-white font-black rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center" style={{ backgroundColor: themeColor }}>{itemCount}</span>
                )}
              </div>
              {selectedTable && (
                <button onClick={onClearTable} className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  {tableLabel} {selectedTable.tableNumber} <X className="w-3 h-3 inline" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {cart.length > 0 && (
              <button onClick={onHoldOrder} className={`${iconBtn} text-slate-400 hover:text-amber-600 hover:bg-amber-50`} title="Congelar venta">
                <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M10 10h4M10 14h4" /></svg>
              </button>
            )}
            {heldOrders.length > 0 && (
              <button onClick={() => setShowHeld(!showHeld)} className={`${iconBtn} relative ${showHeld ? 'text-amber-600 bg-amber-50' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'}`} title="Ventas congeladas">
                <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a5 5 0 015 5v3H7V7a5 5 0 015-5z" /><rect x="3" y="10" width="18" height="12" rx="2" /></svg>
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-amber-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">{heldOrders.length}</span>
              </button>
            )}
            {cart.length > 0 && (
              <button onClick={clearCart} className={`${iconBtn} text-slate-400 hover:text-red-500 hover:bg-red-50`} title="Vaciar">
                <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Held orders panel */}
      {showHeld && heldOrders.length > 0 && (
        <div className="border-b border-amber-100 bg-amber-50/60 px-3 py-2.5 space-y-2 max-h-44 overflow-y-auto flex-shrink-0">
          <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Ventas congeladas
          </p>
          {heldOrders.map(held => {
            const hc = held.items.reduce((s, i) => s + i.quantity, 0);
            const ht = held.items.reduce((s, i) => s + (i.totalPrice || i.price || 0) * i.quantity, 0);
            const mins = Math.round((Date.now() - new Date(held.heldAt).getTime()) / 60000);
            return (
              <div key={held.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 border border-amber-100 shadow-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-700">{hc} items · <span style={{ color: themeColor }}>${ht.toLocaleString()}</span></p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{held.tableNumber ? `${tableLabel} ${held.tableNumber} · ` : ''}{mins < 1 ? '<1' : mins} min</p>
                </div>
                <button onClick={() => { onRecallHeldOrder(held.id); setShowHeld(false); }} className="px-3 py-1.5 rounded-lg text-[11px] font-black text-white transition-colors shadow-sm" style={{ backgroundColor: themeColor }}>Retomar</button>
                <button onClick={() => onDeleteHeldOrder(held.id)} className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto bg-[#F7F8FA]">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-8">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4" style={{ backgroundColor: `${themeColor}0d` }}>
              <svg className="w-10 h-10" style={{ color: `${themeColor}40` }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 01-8 0" /></svg>
            </div>
            <p className="text-[15px] font-bold text-slate-500">Carrito vacío</p>
            <p className="text-[13px] text-slate-400 mt-1 text-center">{isService ? 'Selecciona servicios para comenzar' : 'Toca un producto para agregarlo'}</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {cart.map(item => {
              const unitPrice = item.totalPrice || item.price || 0;
              const lineTotal = unitPrice * item.quantity;
              return (
                <div key={item.uniqueId} className="bg-white rounded-2xl p-3 relative border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <button onClick={() => removeFromCart(item.uniqueId)} className="absolute top-2.5 right-2.5 w-6 h-6 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>

                  <p className="text-sm font-bold text-slate-800 leading-tight pr-8 line-clamp-1">{item.name}</p>
                  {item.selectedToppings && item.selectedToppings.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {item.selectedToppings.map((t, idx) => (
                        <div key={idx}>
                          {t.optionName && (
                            <p className="text-[11px] text-slate-500 leading-tight">+ {t.optionName}{t.price > 0 && <span className="text-slate-400 ml-0.5">(${t.price.toLocaleString()})</span>}</p>
                          )}
                          {t.subGroups && t.subGroups.map((sg, si) => (
                            <p key={si} className="text-[11px] text-slate-500 leading-tight pl-2">+ {sg.optionName}{sg.price > 0 && <span className="text-slate-400 ml-0.5">(${sg.price.toLocaleString()})</span>}</p>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2.5">
                    <div className="flex items-center gap-0.5 bg-slate-100 rounded-xl p-0.5">
                      <button onClick={() => updateQuantity(item.uniqueId, item.quantity - 1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 bg-white shadow-sm hover:text-slate-900 active:scale-95 transition-all">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><path d="M5 12h14" /></svg>
                      </button>
                      <span className="w-9 text-center text-[15px] font-black text-slate-800 tabular-nums select-none">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.uniqueId, item.quantity + 1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm active:scale-95 transition-all" style={{ backgroundColor: themeColor }}>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                      </button>
                    </div>
                    <div className="text-right">
                      {item.quantity > 1 && <p className="text-[10px] text-slate-400 tabular-nums">${unitPrice.toLocaleString()} c/u</p>}
                      <p className="text-[15px] font-black text-slate-900 tabular-nums">${lineTotal.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer / Checkout */}
      {cart.length > 0 && (
        <div className="border-t border-slate-200/70 bg-white p-4 flex-shrink-0">
          <div className="flex items-end justify-between mb-3">
            <span className="text-[13px] font-semibold text-slate-400">{itemCount} artículo{itemCount !== 1 ? 's' : ''}</span>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Total a cobrar</p>
              <p className="text-[32px] font-black text-slate-900 leading-none tabular-nums mt-0.5">${total.toLocaleString()}</p>
            </div>
          </div>
          <button
            onClick={() => onCheckout(total)}
            className="w-full py-4 rounded-2xl text-white font-black text-[15px] shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            style={{ backgroundColor: themeColor, boxShadow: `0 10px 26px -10px ${themeColor}` }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" /><path d="M1 10h22" /></svg>
            Cobrar ${total.toLocaleString()}
          </button>
        </div>
      )}
    </div>
  );
}
