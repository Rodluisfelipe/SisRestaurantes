import React, { useRef, useCallback } from 'react';

// 55mm thermal printer styles — everything bold, large, ultra-clear
const S = {
  center: { textAlign: 'center', fontWeight: 'bold' },
  bold: { fontWeight: 'bold' },
  divider: { borderTop: '2px dashed #000', margin: '6px 0' },
  row: { display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontWeight: 'bold', fontSize: '13px' },
  itemName: { fontWeight: '900', fontSize: '14px' },
  topping: { paddingLeft: '8px', fontSize: '12px', fontWeight: 'bold', color: '#000' },
  totalRow: { display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '18px', fontWeight: '900' },
  big: { fontSize: '20px', fontWeight: '900' },
};

export default function POSTicket({ order, businessConfig, onClose }) {
  const ticketRef = useRef();

  const themeColor = businessConfig?.theme?.buttonColor || '#3B82F6';
  const businessName = businessConfig?.businessName || 'Restaurante';
  const businessAddress = businessConfig?.address || businessConfig?.location?.address || '';
  const businessPhone = businessConfig?.whatsappNumber || '';
  const extra = order?._posExtra || {};

  const handlePrint = useCallback(() => {
    const content = ticketRef.current;
    if (!content) return;

    const printWindow = window.open('', '_blank', 'width=260,height=600');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head>
        <title>Ticket #${order?.orderNumber || ''}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            font-size: 13px;
            font-weight: bold;
            width: 55mm;
            padding: 2mm;
            color: #000;
            -webkit-print-color-adjust: exact;
          }
          @media print {
            body { width: 55mm; }
            @page { margin: 0; size: 55mm auto; }
          }
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
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

        {/* Ticket preview — simulates 55mm paper */}
        <div className="p-4 max-h-[70vh] overflow-y-auto">
          <div className="bg-white border-2 border-slate-300 rounded-lg p-3 font-mono text-sm font-bold" style={{ maxWidth: '240px', margin: '0 auto' }}>
            <div ref={ticketRef}>
              {/* Business name — big and clear */}
              <div style={{ ...S.center, fontSize: '18px', fontWeight: '900', marginBottom: '2px', letterSpacing: '0.5px' }}>{businessName}</div>
              {businessAddress && <div style={{ ...S.center, fontSize: '11px' }}>{businessAddress}</div>}
              {businessPhone && <div style={{ ...S.center, fontSize: '11px' }}>Tel: {businessPhone}</div>}

              <div style={S.divider} />

              {/* Order info */}
              <div style={S.row}><span>Orden:</span><span style={{ fontWeight: '900' }}>#{order.orderNumber}</span></div>
              <div style={S.row}><span>Fecha:</span><span>{date.toLocaleDateString('es-CO')}</span></div>
              <div style={S.row}><span>Hora:</span><span>{date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span></div>
              {order.customerName && order.customerName !== 'POS' && (
                <div style={S.row}><span>Cliente:</span><span>{order.customerName}</span></div>
              )}
              {order.tableNumber && <div style={S.row}><span>Mesa:</span><span>{order.tableNumber}</span></div>}

              <div style={S.divider} />

              {/* Items — bold and large */}
              {items.map((item, i) => (
                <div key={i} style={{ marginBottom: '5px' }}>
                  <div style={{ ...S.row, fontSize: '14px' }}>
                    <span style={S.itemName}>{item.quantity}x {item.name}</span>
                    <span style={{ fontWeight: '900' }}>${((item.totalPrice || item.price) * item.quantity).toLocaleString()}</span>
                  </div>
                  {item.selectedToppings && item.selectedToppings.map((t, j) => (
                    <div key={j} style={S.topping}>+ {t.optionName || t.name}{t.price > 0 ? ` ($${t.price.toLocaleString()})` : ''}</div>
                  ))}
                </div>
              ))}

              <div style={S.divider} />

              {/* Total — huge and unmissable */}
              <div style={S.totalRow}>
                <span>TOTAL</span>
                <span style={S.big}>${parseFloat(total).toLocaleString()}</span>
              </div>

              {/* Payment info */}
              {extra.paymentMethod && (
                <>
                  <div style={S.divider} />
                  <div style={S.row}><span>Pago:</span><span style={{ fontWeight: '900' }}>{extra.paymentMethod === 'cash' ? 'Efectivo' : extra.paymentMethod === 'nequi' ? 'Nequi' : extra.paymentMethod === 'daviplata' ? 'Daviplata' : 'Transferencia'}</span></div>
                  {extra.cashReceived != null && <div style={S.row}><span>Recibido:</span><span>${extra.cashReceived.toLocaleString()}</span></div>}
                  {extra.change != null && extra.change > 0 && <div style={S.row}><span>Cambio:</span><span>${extra.change.toLocaleString()}</span></div>}
                </>
              )}

              <div style={S.divider} />
              <div style={{ ...S.center, marginTop: '6px', fontSize: '12px', fontWeight: '900' }}>¡Gracias por su compra!</div>
              <div style={{ ...S.center, fontSize: '10px', color: '#555', marginTop: '3px' }}>Powered by MenuBy</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
