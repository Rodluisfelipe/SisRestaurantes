import React, { useState, useMemo, useRef, useCallback } from 'react';
import api from '../../services/api';

// Ticket styles — matches POSTicket for consistency
const S = {
  center: { textAlign: 'center', fontWeight: '900', color: '#000' },
  divider: { borderTop: '2px dashed #000', margin: '8px 0' },
  row: { display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontWeight: '900', fontSize: '15px', color: '#000' },
  sectionTitle: { fontWeight: '900', fontSize: '14px', color: '#000', textAlign: 'center', padding: '4px 0', letterSpacing: '0.5px' },
  totalRow: { display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '20px', fontWeight: '900', color: '#000' },
  big: { fontSize: '22px', fontWeight: '900', color: '#000' },
  small: { fontSize: '13px', fontWeight: '900', color: '#000', paddingLeft: '8px' },
};

export default function POSCashRegister({ mode, businessId, businessConfig, businessName: businessNameProp, cashRegister, onComplete, onMovementAdded, onClose }) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [movementType, setMovementType] = useState('income');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const ticketRef = useRef();

  const businessName = businessConfig?.businessName || businessNameProp || 'Mi Negocio';
  const paperSize = businessConfig?.printerSettings?.paperSize || '55';

  const handleOpen = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/cash-register/open', {
        businessId,
        openingAmount: parseFloat(amount) || 0,
      });
      onComplete(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al abrir caja');
      setSubmitting(false);
    }
  };

  const handleClose = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/cash-register/close', {
        businessId,
        closingAmount: parseFloat(amount) || 0,
      });
      onComplete(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cerrar caja');
      setSubmitting(false);
    }
  };

  const handleAddMovement = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) return setError('Ingresa un monto válido');
    if (!description.trim()) return setError('Ingresa una descripción');
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/cash-register/movement', {
        businessId,
        type: movementType,
        amount: parsedAmount,
        description: description.trim(),
      });
      onMovementAdded(res.data);
      setAmount('');
      setDescription('');
      setSubmitting(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al registrar movimiento');
      setSubmitting(false);
    }
  };

  const methodLabels = { cash: 'Efectivo', nequi: 'Nequi', daviplata: 'Daviplata', transfer: 'Transferencia', transferencia: 'Transferencia' };

  // Pre-calculate close data
  const closeData = useMemo(() => {
    if (!cashRegister) return null;
    const moves = cashRegister.movements || [];
    const allSales = moves.filter(m => m.type === 'sale');
    const posSales = allSales.filter(m => m.orderChannel === 'pos' || !m.orderChannel);
    const menubySales = allSales.filter(m => m.orderChannel === 'menuby');

    const buildMethodBreakdown = (sales) => {
      const byMethod = {};
      sales.forEach(m => {
        const method = m.paymentMethod || 'cash';
        byMethod[method] = (byMethod[method] || 0) + m.amount;
      });
      return byMethod;
    };

    const income = moves.filter(m => m.type === 'income').reduce((s, m) => s + m.amount, 0);
    const expenses = moves.filter(m => m.type === 'expense').reduce((s, m) => s + m.amount, 0);
    const refunds = moves.filter(m => m.type === 'refund').reduce((s, m) => s + m.amount, 0);
    const cashSales = allSales.filter(m => (m.paymentMethod === 'cash' || !m.paymentMethod)).reduce((s, m) => s + m.amount, 0);
    const expected = (cashRegister.openingAmount || 0) + cashSales + income - expenses - refunds;

    return {
      pos: { total: posSales.reduce((s, m) => s + m.amount, 0), count: posSales.length, byMethod: buildMethodBreakdown(posSales) },
      menuby: { total: menubySales.reduce((s, m) => s + m.amount, 0), count: menubySales.length, byMethod: buildMethodBreakdown(menubySales) },
      totalSales: allSales.reduce((s, m) => s + m.amount, 0),
      totalOrders: allSales.length,
      income, expenses, refunds, expected
    };
  }, [cashRegister]);

  const closingNum = parseFloat(amount) || 0;
  const difference = closeData ? closingNum - closeData.expected : 0;

  // Print report — same style as POSTicket, adapted to printer paper size
  const handlePrint = useCallback(() => {
    const content = ticketRef.current;
    if (!content || !closeData) return;

    const printWindow = window.open('', '_blank', 'width=260,height=700');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head>
        <title>Cierre de Caja</title>
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
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 200);
  }, [closeData, paperSize]);

  // Render a sales channel section
  const SalesSection = ({ label, icon, color, data }) => {
    if (data.count === 0) return (
      <div className={`p-3 rounded-lg border ${color.border} ${color.bg}`}>
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <span className={`text-xs font-bold uppercase tracking-wider ${color.label}`}>{label}</span>
        </div>
        <p className="text-xs text-slate-400 text-center py-1">Sin ventas</p>
      </div>
    );
    return (
      <div className={`p-3 rounded-lg border ${color.border} ${color.bg}`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            {icon}
            <span className={`text-xs font-bold uppercase tracking-wider ${color.label}`}>{label}</span>
          </div>
          <span className="text-xs text-slate-400">{data.count} orden{data.count !== 1 ? 'es' : ''}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-lg font-black text-slate-800">${data.total.toLocaleString()}</span>
        </div>
        {Object.keys(data.byMethod).length > 1 && (
          <div className="mt-1.5 space-y-0.5">
            {Object.entries(data.byMethod).map(([method, amt]) => (
              <div key={method} className="flex justify-between text-xs">
                <span className="text-slate-400">{methodLabels[method] || method}</span>
                <span className="font-semibold text-slate-500">${amt.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${mode === 'close' ? 'max-w-lg' : 'max-w-md'} mx-4 max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              mode === 'open' ? 'bg-emerald-100' : mode === 'close' ? 'bg-amber-100' : 'bg-blue-100'
            }`}>
              {mode === 'open' && <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/></svg>}
              {mode === 'close' && <svg className="w-4 h-4 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>}
              {mode === 'movements' && <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>}
            </div>
            <h2 className="text-lg font-bold text-slate-800">
              {mode === 'open' && 'Abrir caja'}
              {mode === 'close' && 'Cerrar caja'}
              {mode === 'movements' && 'Movimientos'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* OPEN MODE */}
          {mode === 'open' && (
            <>
              <p className="text-sm text-slate-500">Ingresa el monto con el que inicias la caja.</p>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Monto inicial</label>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full text-center text-2xl font-bold py-3 rounded-xl border-2 border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-transparent"
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-red-600 text-center">{error}</p>}
              <button onClick={handleOpen} disabled={submitting} className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"/> : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/></svg>
                    Abrir caja
                  </>
                )}
              </button>
            </>
          )}

          {/* CLOSE MODE */}
          {mode === 'close' && closeData && (
            <>
              {/* POS vs MenuBy sales sections */}
              <div className="grid grid-cols-2 gap-3">
                <SalesSection
                  label="POS"
                  icon={<svg className="w-3.5 h-3.5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>}
                  color={{ bg: 'bg-indigo-50/50', border: 'border-indigo-100', label: 'text-indigo-600' }}
                  data={closeData.pos}
                />
                <SalesSection
                  label="MenuBy"
                  icon={<svg className="w-3.5 h-3.5 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>}
                  color={{ bg: 'bg-violet-50/50', border: 'border-violet-100', label: 'text-violet-600' }}
                  data={closeData.menuby}
                />
              </div>

              {/* Combined summary */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Apertura</span>
                  <span className="font-semibold text-slate-700">${(cashRegister?.openingAmount || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Total ventas ({closeData.totalOrders})</span>
                  <span className="font-semibold text-emerald-600">+${closeData.totalSales.toLocaleString()}</span>
                </div>
                {closeData.income > 0 && <div className="flex justify-between text-sm"><span className="text-slate-500">Ingresos</span><span className="font-semibold text-emerald-600">+${closeData.income.toLocaleString()}</span></div>}
                {closeData.expenses > 0 && <div className="flex justify-between text-sm"><span className="text-slate-500">Gastos</span><span className="font-semibold text-red-600">-${closeData.expenses.toLocaleString()}</span></div>}
                {closeData.refunds > 0 && <div className="flex justify-between text-sm"><span className="text-slate-500">Devoluciones</span><span className="font-semibold text-red-600">-${closeData.refunds.toLocaleString()}</span></div>}
                <div className="border-t border-slate-200 pt-2 flex justify-between text-sm">
                  <span className="font-bold text-slate-700">Esperado en caja</span>
                  <span className="font-black text-slate-900">${closeData.expected.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Monto real en caja</label>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full text-center text-2xl font-bold py-3 rounded-xl border-2 border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent"
                  autoFocus
                />
              </div>

              {closingNum > 0 && (
                <div className={`text-center p-3 rounded-xl ${difference === 0 ? 'bg-emerald-50' : difference > 0 ? 'bg-blue-50' : 'bg-red-50'}`}>
                  <p className="text-xs font-medium text-slate-500">Diferencia</p>
                  <p className={`text-xl font-black ${difference === 0 ? 'text-emerald-600' : difference > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {difference === 0 ? 'Cuadre perfecto' : `${difference > 0 ? '+' : ''}$${difference.toLocaleString()}`}
                  </p>
                  {difference > 0 && <p className="text-xs text-blue-500">Sobrante</p>}
                  {difference < 0 && <p className="text-xs text-red-500">Faltante</p>}
                </div>
              )}

              {error && <p className="text-sm text-red-600 text-center">{error}</p>}

              {/* Hidden print ticket template */}
              <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                <div ref={ticketRef}>
                  <div style={{ height: '20px' }} />
                  <div style={{ ...S.center, fontSize: '20px', marginBottom: '2px', letterSpacing: '0.5px' }}>{businessName}</div>
                  <div style={S.divider} />
                  <div style={{ ...S.center, fontSize: '18px', marginBottom: '4px' }}>CIERRE DE CAJA</div>
                  <div style={S.divider} />

                  <div style={S.row}><span>Apertura:</span><span>{cashRegister?.openedAt ? new Date(cashRegister.openedAt).toLocaleString('es-CO', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span></div>
                  <div style={S.row}><span>Cierre:</span><span>{new Date().toLocaleString('es-CO', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>

                  <div style={S.divider} />

                  {/* POS Section */}
                  <div style={S.sectionTitle}>── VENTAS POS ──</div>
                  <div style={S.row}><span>Órdenes:</span><span>{closeData.pos.count}</span></div>
                  <div style={S.row}><span>Total:</span><span>${closeData.pos.total.toLocaleString()}</span></div>
                  {Object.entries(closeData.pos.byMethod).map(([method, amt]) => (
                    <div key={`pos-${method}`} style={{ ...S.small, display: 'flex', justifyContent: 'space-between', padding: '2px 0 2px 8px' }}>
                      <span>{methodLabels[method] || method}</span>
                      <span>${amt.toLocaleString()}</span>
                    </div>
                  ))}

                  <div style={{ height: '6px' }} />

                  {/* MenuBy Section */}
                  <div style={S.sectionTitle}>── VENTAS MENUBY ──</div>
                  <div style={S.row}><span>Órdenes:</span><span>{closeData.menuby.count}</span></div>
                  <div style={S.row}><span>Total:</span><span>${closeData.menuby.total.toLocaleString()}</span></div>
                  {Object.entries(closeData.menuby.byMethod).map(([method, amt]) => (
                    <div key={`mb-${method}`} style={{ ...S.small, display: 'flex', justifyContent: 'space-between', padding: '2px 0 2px 8px' }}>
                      <span>{methodLabels[method] || method}</span>
                      <span>${amt.toLocaleString()}</span>
                    </div>
                  ))}

                  <div style={S.divider} />

                  {/* Combined totals */}
                  <div style={S.totalRow}>
                    <span>VENTAS ({closeData.totalOrders})</span>
                    <span style={S.big}>${closeData.totalSales.toLocaleString()}</span>
                  </div>

                  <div style={S.divider} />

                  {closeData.income > 0 && <div style={S.row}><span>Ingresos:</span><span>+${closeData.income.toLocaleString()}</span></div>}
                  {closeData.expenses > 0 && <div style={S.row}><span>Gastos:</span><span>-${closeData.expenses.toLocaleString()}</span></div>}
                  {closeData.refunds > 0 && <div style={S.row}><span>Devoluciones:</span><span>-${closeData.refunds.toLocaleString()}</span></div>}

                  <div style={S.divider} />

                  <div style={S.row}><span>Apertura:</span><span>${(cashRegister?.openingAmount || 0).toLocaleString()}</span></div>
                  <div style={S.row}><span>Esperado:</span><span>${closeData.expected.toLocaleString()}</span></div>
                  <div style={{ ...S.row, fontSize: '16px' }}><span>Monto real:</span><span>${closingNum.toLocaleString()}</span></div>

                  <div style={S.divider} />

                  <div style={{
                    textAlign: 'center',
                    fontSize: '20px',
                    fontWeight: '900',
                    color: '#000',
                    padding: '6px 0'
                  }}>
                    {difference === 0 ? 'CUADRE PERFECTO ✓' : difference > 0 ? `SOBRANTE: +$${difference.toLocaleString()}` : `FALTANTE: -$${Math.abs(difference).toLocaleString()}`}
                  </div>

                  <div style={S.divider} />
                  <div style={{ ...S.center, fontSize: '11px', marginTop: '6px', color: '#333' }}>Gracias por usar MenuBy</div>
                  <div style={{ ...S.center, fontSize: '10px', color: '#555', marginTop: '1px' }}>menuby.tech</div>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={handlePrint} className="flex-1 py-3.5 rounded-xl border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold transition-colors flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Imprimir
                </button>
                <button onClick={handleClose} disabled={submitting} className="flex-1 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"/> : (
                    <>
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                      Cerrar caja
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {/* MOVEMENTS MODE */}
          {mode === 'movements' && (
            <>
              {/* Movement list */}
              <div className="max-h-48 overflow-y-auto space-y-1">
                {(cashRegister?.movements || []).length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">Sin movimientos</p>
                ) : (
                  [...(cashRegister?.movements || [])].reverse().map((m, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          m.type === 'sale' || m.type === 'income' ? 'bg-emerald-400' : 'bg-red-400'
                        }`} />
                        <span className="text-slate-600 truncate">{m.description || m.type}</span>
                      </div>
                      <span className={`font-bold flex-shrink-0 ml-2 ${
                        m.type === 'sale' || m.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {m.type === 'sale' || m.type === 'income' ? '+' : '-'}${m.amount?.toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Add movement */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Agregar movimiento</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMovementType('income')}
                    className={`py-2 rounded-lg text-sm font-bold border-2 transition-all ${
                      movementType === 'income' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    Ingreso
                  </button>
                  <button
                    onClick={() => setMovementType('expense')}
                    className={`py-2 rounded-lg text-sm font-bold border-2 transition-all ${
                      movementType === 'expense' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    Gasto
                  </button>
                </div>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Monto" className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent" />
                <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripción" className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent" />
                {error && <p className="text-sm text-red-600 text-center">{error}</p>}
                <button onClick={handleAddMovement} disabled={submitting} className="w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"/> : 'Registrar movimiento'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
