import React, { useRef, useCallback } from 'react';

// QR code via Google Charts API — generates inline QR image
const qrUrl = (url, size = 200) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&format=png`;

// 55mm thermal printer styles — everything bold, XL, ultra-clear for kitchen readability
const S = {
  center: { textAlign: 'center', fontWeight: '900', color: '#000' },
  divider: { borderTop: '2px dashed #000', margin: '8px 0' },
  row: { display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontWeight: '900', fontSize: '15px', color: '#000' },
  itemName: { fontWeight: '900', fontSize: '16px', color: '#000' },
  topping: { paddingLeft: '8px', fontSize: '14px', fontWeight: '900', color: '#000' },
  totalRow: { display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '20px', fontWeight: '900', color: '#000' },
  big: { fontSize: '22px', fontWeight: '900', color: '#000' },
};

export default function POSTicket({ order, businessConfig, onClose }) {
  const ticketRef = useRef();

  const themeColor = businessConfig?.theme?.buttonColor || '#3B82F6';
  const businessName = businessConfig?.businessName || 'Restaurante';
  const businessAddress = businessConfig?.address || '';
  const businessPhone = businessConfig?.whatsappNumber || '';
  const nit = businessConfig?.nit || '';
  const slug = businessConfig?.slug || '';
  const menuLink = slug ? `https://menuby.tech/${slug}` : '';
  const extra = order?._posExtra || {};
  const paperSize = businessConfig?.printerSettings?.paperSize || '55';
  const showQR = businessConfig?.printerSettings?.showQR !== false;

  const handlePrint = useCallback(() => {
    const content = ticketRef.current;
    if (!content) return;

    const printWindow = window.open('', '_blank', 'width=260,height=700');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head>
        <title>Ticket #${order?.orderNumber || ''}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            font-size: 15px;
            font-weight: 900;
            width: ${paperSize}mm;
            padding: 2mm;
            color: #000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          img { display: block; margin: 0 auto; }
          @media print {
            body { width: ${paperSize}mm; }
            @page { margin: 0; size: ${paperSize}mm auto; }
          }
        </style>
      </head><body>
        ${content.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();

    // Wait for all images (QR code) to load before printing
    const images = printWindow.document.querySelectorAll('img');
    const imagePromises = Array.from(images).map(img =>
      img.complete ? Promise.resolve() : new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
      })
    );

    Promise.all(imagePromises).then(() => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 200);
    });
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

        {/* Ticket preview */}
        <div className="p-4 max-h-[70vh] overflow-y-auto">
          <div className="bg-white border-2 border-slate-300 rounded-lg p-3 font-mono text-sm font-black" style={{ maxWidth: paperSize === '58' ? '250px' : '240px', margin: '0 auto', color: '#000' }}>
            <div ref={ticketRef}>
              {/* ---- Hanger space (espacio cuelga-comandas) ---- */}
              <div style={{ height: '20px' }} />

              {/* Business name — big and clear */}
              <div style={{ ...S.center, fontSize: '20px', marginBottom: '2px', letterSpacing: '0.5px' }}>{businessName}</div>
              {businessAddress && <div style={{ ...S.center, fontSize: '12px' }}>{businessAddress}</div>}
              {businessPhone && <div style={{ ...S.center, fontSize: '12px' }}>Tel: {businessPhone}</div>}
              {nit && <div style={{ ...S.center, fontSize: '12px' }}>NIT: {nit}</div>}

              <div style={S.divider} />

              {/* Order info — larger & darker */}
              <div style={S.row}><span>Orden:</span><span style={{ fontWeight: '900', fontSize: '16px' }}>#{order.orderNumber}</span></div>
              <div style={S.row}><span>Fecha:</span><span>{date.toLocaleDateString('es-CO')}</span></div>
              <div style={S.row}><span>Hora:</span><span>{date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span></div>
              {order.customerName && order.customerName !== 'POS' && (
                <div style={S.row}><span>Cliente:</span><span>{order.customerName}</span></div>
              )}
              {order.tableNumber && <div style={S.row}><span>Mesa:</span><span style={{ fontSize: '16px' }}>{order.tableNumber}</span></div>}
              {order.orderType === 'delivery' && (
                <>
                  <div style={S.row}><span>Tipo:</span><span style={{ fontWeight: '900' }}>DOMICILIO</span></div>
                  {order.address && <div style={{ fontSize: '12px', marginTop: '2px' }}>Dir: {order.address}</div>}
                  {order.deliveryZoneName && <div style={{ fontSize: '12px' }}>Zona: {order.deliveryZoneName}</div>}
                  {order.phone && <div style={{ fontSize: '12px' }}>Tel: {order.phone}</div>}
                </>
              )}
              {order.orderType === 'inSite' && !order.tableNumber && <div style={S.row}><span>Tipo:</span><span>En mesa</span></div>}
              {order.orderType === 'takeaway' && <div style={S.row}><span>Tipo:</span><span>Para llevar</span></div>}

              <div style={S.divider} />

              {/* Items — extra bold, large, kitchen-readable */}
              {items.map((item, i) => (
                <div key={i} style={{ marginBottom: '6px' }}>
                  <div style={{ ...S.row, fontSize: '16px' }}>
                    <span style={S.itemName}>{item.quantity}x {item.name}</span>
                    <span style={{ fontWeight: '900', fontSize: '15px' }}>${((item.totalPrice || item.price) * item.quantity).toLocaleString()}</span>
                  </div>
                  {item.selectedToppings && item.selectedToppings.map((t, j) => (
                    <div key={j} style={S.topping}>+ {t.optionName || t.name}{t.price > 0 ? ` ($${t.price.toLocaleString()})` : ''}</div>
                  ))}
                </div>
              ))}

              <div style={S.divider} />

              {/* Delivery fee */}
              {order.deliveryFee > 0 && (
                <div style={S.row}>
                  <span>Domicilio:</span>
                  <span>${parseFloat(order.deliveryFee).toLocaleString()}</span>
                </div>
              )}

              {/* Total — huge and unmissable */}
              <div style={S.totalRow}>
                <span>TOTAL</span>
                <span style={S.big}>${parseFloat(total).toLocaleString()}</span>
              </div>

              {/* Payment info */}
              {extra.paymentMethod && (
                <>
                  <div style={S.divider} />
                  <div style={S.row}><span>Pago:</span><span>{extra.paymentMethod === 'cash' ? 'Efectivo' : extra.paymentMethod === 'nequi' ? 'Nequi' : extra.paymentMethod === 'daviplata' ? 'Daviplata' : 'Transferencia'}</span></div>
                  {extra.cashReceived != null && <div style={S.row}><span>Recibido:</span><span>${extra.cashReceived.toLocaleString()}</span></div>}
                  {extra.change != null && extra.change > 0 && <div style={S.row}><span>Cambio:</span><span>${extra.change.toLocaleString()}</span></div>}
                </>
              )}

              <div style={S.divider} />
              <div style={{ ...S.center, marginTop: '6px', fontSize: '14px' }}>¡Gracias por su compra!</div>

              {/* QR code — respects printer settings */}
              {showQR && menuLink && (
                <div style={{ textAlign: 'center', marginTop: '10px' }}>
                  <div style={{ ...S.center, fontSize: '13px', marginBottom: '6px' }}>
                    ¡Pide desde tu celular!
                  </div>
                  <img
                    src={qrUrl(menuLink, 180)}
                    alt="QR Menú"
                    width="160"
                    height="160"
                    style={{ display: 'block', margin: '0 auto' }}
                  />
                  <div style={{ ...S.center, fontSize: '12px', marginTop: '6px' }}>
                    Escanea y pide con descuento
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: '900', color: '#000', marginTop: '2px' }}>{menuLink}</div>
                </div>
              )}

              <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: '900', color: '#333', marginTop: '8px' }}>
                Gracias por usar MenuBy ❤️
              </div>
              <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 'bold', color: '#555', marginTop: '1px' }}>
                menuby.tech
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
