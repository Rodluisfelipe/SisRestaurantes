import React, { useRef, useCallback } from 'react';

export default function POSTicket({ order, businessConfig, onClose }) {
  const ticketRef = useRef();

  const themeColor = businessConfig?.theme?.buttonColor || '#3B82F6';
  const businessName = businessConfig?.name || 'Restaurante';
  const extra = order?._posExtra || {};

  const handlePrint = useCallback(() => {
    const content = ticketRef.current;
    if (!content) return;

    const printWindow = window.open('', '_blank', 'width=320,height=600');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head>
        <title>Ticket #${order?.orderNumber || ''}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; padding: 4mm; color: #000; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .row { display: flex; justify-content: space-between; padding: 1px 0; }
          .item-name { font-weight: bold; }
          .topping { padding-left: 10px; font-size: 11px; color: #333; }
          .total-row { font-size: 14px; font-weight: bold; }
          .big { font-size: 16px; font-weight: bold; }
          @media print { body { width: 80mm; } @page { margin: 0; size: 80mm auto; } }
        </style>
      </head><body>
        ${content.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }, [order]);

  if (!order) return null;

  const items = order.items || [];
  const total = order.totalAmount || order.finalAmount || 0;
  const date = new Date(order.createdAt || Date.now());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800">Ticket de venta</h2>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="px-4 py-2 rounded-lg text-white text-sm font-bold transition-colors flex items-center gap-1.5" style={{ backgroundColor: themeColor }}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Imprimir
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        {/* Ticket preview */}
        <div className="p-5 max-h-[70vh] overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-lg p-4 font-mono text-xs" style={{ maxWidth: '320px', margin: '0 auto' }}>
            <div ref={ticketRef}>
              {/* Business name */}
              <div className="center bold" style={{ fontSize: '16px', marginBottom: '2px' }}>{businessName}</div>
              {businessConfig?.address && <div className="center" style={{ fontSize: '10px', color: '#666' }}>{businessConfig.address}</div>}
              {businessConfig?.phone && <div className="center" style={{ fontSize: '10px', color: '#666' }}>Tel: {businessConfig.phone}</div>}

              <div className="divider" />

              {/* Order info */}
              <div className="row"><span>Orden:</span><span className="bold">#{order.orderNumber}</span></div>
              <div className="row"><span>Fecha:</span><span>{date.toLocaleDateString('es-CO')}</span></div>
              <div className="row"><span>Hora:</span><span>{date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span></div>
              {order.customerName && order.customerName !== 'POS' && (
                <div className="row"><span>Cliente:</span><span>{order.customerName}</span></div>
              )}
              {order.tableNumber && <div className="row"><span>Mesa:</span><span>{order.tableNumber}</span></div>}

              <div className="divider" />

              {/* Items */}
              {items.map((item, i) => (
                <div key={i} style={{ marginBottom: '4px' }}>
                  <div className="row">
                    <span className="item-name">{item.quantity}x {item.name}</span>
                    <span>${(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                  {item.selectedToppings && item.selectedToppings.map((t, j) => (
                    <div key={j} className="topping">+ {t.optionName || t.name}{t.price > 0 ? ` ($${t.price.toLocaleString()})` : ''}</div>
                  ))}
                </div>
              ))}

              <div className="divider" />

              {/* Total */}
              <div className="row total-row">
                <span>TOTAL</span>
                <span className="big">${parseFloat(total).toLocaleString()}</span>
              </div>

              {/* Payment info */}
              {extra.paymentMethod && (
                <>
                  <div className="divider" />
                  <div className="row"><span>Pago:</span><span className="bold">{extra.paymentMethod === 'cash' ? 'Efectivo' : extra.paymentMethod === 'nequi' ? 'Nequi' : extra.paymentMethod === 'daviplata' ? 'Daviplata' : 'Transferencia'}</span></div>
                  {extra.cashReceived != null && <div className="row"><span>Recibido:</span><span>${extra.cashReceived.toLocaleString()}</span></div>}
                  {extra.change != null && extra.change > 0 && <div className="row"><span>Cambio:</span><span>${extra.change.toLocaleString()}</span></div>}
                </>
              )}

              <div className="divider" />
              <div className="center" style={{ marginTop: '8px', fontSize: '11px' }}>¡Gracias por su compra!</div>
              <div className="center" style={{ fontSize: '10px', color: '#999', marginTop: '4px' }}>Powered by MenuBy</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
