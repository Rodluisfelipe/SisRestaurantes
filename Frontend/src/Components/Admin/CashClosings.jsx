import React, { useState, useEffect, useCallback } from 'react';
import { useBusinessConfig } from '../../Context/BusinessContext';
import api from '../../services/api';

const METHOD_LABELS = { cash: 'Efectivo', nequi: 'Nequi', daviplata: 'Daviplata', transfer: 'Transferencia', transferencia: 'Transferencia', card: 'Tarjeta' };

function formatMoney(n) {
  return '$' + (Number(n) || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });
}

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function duration(open, close) {
  if (!open || !close) return '—';
  const ms = new Date(close) - new Date(open);
  const hrs = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

export default function CashClosings() {
  const { businessConfig } = useBusinessConfig();
  const businessId = businessConfig?._id;
  const themeColor = businessConfig?.theme?.buttonColor || '#3B82F6';

  const [registers, setRegisters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchHistory = useCallback(async (p = 1) => {
    if (!businessId) return;
    try {
      setLoading(true);
      const res = await api.get(`/cash-register/history?businessId=${businessId}&page=${p}&limit=10`);
      setRegisters(res.data.registers || []);
      setTotalPages(res.data.totalPages || 1);
      setTotal(res.data.total || 0);
      setPage(res.data.page || 1);
    } catch {
      setRegisters([]);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { fetchHistory(1); }, [fetchHistory]);

  const openDetail = async (reg) => {
    setSelected(reg._id);
    setLoadingDetail(true);
    try {
      const res = await api.get(`/cash-register/${reg._id}`);
      setDetail(res.data);
    } catch {
      setDetail(reg);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetail = () => { setSelected(null); setDetail(null); };

  // Print thermal ticket for a closing
  const handlePrint = useCallback((reg) => {
    if (!reg) return;
    const paperSize = businessConfig?.printerSettings?.paperSize || 58;
    const bName = businessConfig?.businessName || 'Negocio';
    const summary = reg.salesSummary || {};
    const byMethod = summary.byPaymentMethod || {};
    const posSales = summary.posSales || { total: 0, count: 0 };
    const menubySales = summary.menubySales || { total: 0, count: 0 };

    const S = { ff: 'Courier New, monospace', fw: '900', c: '#000', dash: '- - - - - - - - - - - - - -' };
    let rows = '';

    rows += `<div style="text-align:center;font-size:14px;font-weight:${S.fw};margin-bottom:6px">${bName}</div>`;
    rows += `<div style="text-align:center;font-size:11px;margin-bottom:2px">CIERRE DE CAJA</div>`;
    rows += `<div style="text-align:center;font-size:10px;margin-bottom:6px">${formatDate(reg.closedAt)} ${formatTime(reg.closedAt)}</div>`;
    rows += `<div style="text-align:center;font-size:9px;color:#555;margin-bottom:6px">${S.dash}</div>`;

    rows += `<div style="display:flex;justify-content:space-between;font-size:11px"><span>Apertura:</span><span>${formatMoney(reg.openingAmount)}</span></div>`;
    rows += `<div style="display:flex;justify-content:space-between;font-size:11px"><span>Duración:</span><span>${duration(reg.openedAt, reg.closedAt)}</span></div>`;
    rows += `<div style="text-align:center;font-size:9px;color:#555;margin:4px 0">${S.dash}</div>`;

    if (posSales.count > 0) {
      rows += `<div style="font-size:11px;font-weight:${S.fw};margin-bottom:2px">VENTAS POS (${posSales.count})</div>`;
      rows += `<div style="display:flex;justify-content:space-between;font-size:11px"><span>Total POS:</span><span>${formatMoney(posSales.total)}</span></div>`;
    }
    if (menubySales.count > 0) {
      rows += `<div style="font-size:11px;font-weight:${S.fw};margin:4px 0 2px">VENTAS MENUBY (${menubySales.count})</div>`;
      rows += `<div style="display:flex;justify-content:space-between;font-size:11px"><span>Total MenuBy:</span><span>${formatMoney(menubySales.total)}</span></div>`;
    }

    rows += `<div style="text-align:center;font-size:9px;color:#555;margin:4px 0">${S.dash}</div>`;
    rows += `<div style="font-size:11px;font-weight:${S.fw};margin-bottom:2px">POR MÉTODO DE PAGO</div>`;
    const methods = byMethod instanceof Map ? Object.fromEntries(byMethod) : (typeof byMethod === 'object' ? byMethod : {});
    Object.entries(methods).forEach(([m, v]) => {
      rows += `<div style="display:flex;justify-content:space-between;font-size:10px"><span>${METHOD_LABELS[m] || m} (${v.count || 0})</span><span>${formatMoney(v.total || 0)}</span></div>`;
    });

    rows += `<div style="text-align:center;font-size:9px;color:#555;margin:4px 0">${S.dash}</div>`;
    rows += `<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:${S.fw}"><span>TOTAL VENTAS:</span><span>${formatMoney(summary.totalSales)}</span></div>`;
    rows += `<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:${S.fw}"><span>ESPERADO:</span><span>${formatMoney(reg.expectedAmount)}</span></div>`;
    rows += `<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:${S.fw}"><span>EN CAJA:</span><span>${formatMoney(reg.closingAmount)}</span></div>`;

    const diff = (reg.closingAmount || 0) - (reg.expectedAmount || 0);
    const diffColor = diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#000';
    rows += `<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:${S.fw};color:${diffColor}"><span>DIFERENCIA:</span><span>${diff >= 0 ? '+' : ''}${formatMoney(diff)}</span></div>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@page{size:${paperSize}mm auto;margin:0}body{font-family:${S.ff};width:${paperSize}mm;margin:0;padding:4mm 3mm;color:${S.c};font-weight:${S.fw}}</style></head><body>${rows}</body></html>`;
    const win = window.open('', '_blank', 'width=300,height=600');
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => { win.print(); win.close(); }, 400); }
  }, [businessConfig]);

  // ---- DETAIL VIEW ----
  if (selected && detail) {
    const summary = detail.salesSummary || {};
    const byMethod = summary.byPaymentMethod || {};
    const methods = byMethod instanceof Map ? Object.fromEntries(byMethod) : (typeof byMethod === 'object' ? byMethod : {});
    const posSales = summary.posSales || { total: 0, count: 0 };
    const menubySales = summary.menubySales || { total: 0, count: 0 };
    const diff = (detail.closingAmount || 0) - (detail.expectedAmount || 0);
    const movements = detail.movements || [];
    const sales = movements.filter(m => m.type === 'sale');
    const incomes = movements.filter(m => m.type === 'income');
    const expenses = movements.filter(m => m.type === 'expense');
    const refunds = movements.filter(m => m.type === 'refund');

    return (
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={closeDetail} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-slate-800">Cierre de Caja</h2>
            <p className="text-xs text-slate-500">{formatDate(detail.closedAt)} — {formatTime(detail.openedAt)} a {formatTime(detail.closedAt)} ({duration(detail.openedAt, detail.closedAt)})</p>
          </div>
          <button onClick={() => handlePrint(detail)} className="flex items-center gap-2 px-4 py-2.5 lg:py-2 rounded-xl lg:rounded-lg text-white text-[13px] lg:text-xs font-semibold lg:font-bold active:scale-[0.97] lg:active:scale-100" style={{ backgroundColor: themeColor }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            Imprimir
          </button>
        </div>

        {loadingDetail ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="bg-white rounded-2xl lg:rounded-xl border border-slate-100 lg:border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-none p-4">
                <p className="text-xs lg:text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Apertura</p>
                <p className="text-[20px] lg:text-lg font-black text-slate-800 leading-tight">{formatMoney(detail.openingAmount)}</p>
              </div>
              <div className="bg-white rounded-2xl lg:rounded-xl border border-slate-100 lg:border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-none p-4">
                <p className="text-xs lg:text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Ventas</p>
                <p className="text-[20px] lg:text-lg font-black text-slate-800 leading-tight">{formatMoney(summary.totalSales)}</p>
                <p className="text-xs lg:text-xs text-slate-400">{summary.totalOrders || 0} órdenes</p>
              </div>
              <div className="bg-white rounded-2xl lg:rounded-xl border border-slate-100 lg:border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-none p-4">
                <p className="text-xs lg:text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">En Caja</p>
                <p className="text-[20px] lg:text-lg font-black text-slate-800 leading-tight">{formatMoney(detail.closingAmount)}</p>
              </div>
              <div className={`rounded-2xl lg:rounded-xl border p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-none ${diff > 0 ? 'bg-emerald-50 border-emerald-200' : diff < 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                <p className="text-xs lg:text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Diferencia</p>
                <p className={`text-[20px] lg:text-lg font-black leading-tight ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                  {diff >= 0 ? '+' : ''}{formatMoney(diff)}
                </p>
              </div>
            </div>

            {/* POS / MenuBy breakdown */}
            {(posSales.count > 0 || menubySales.count > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                {posSales.count > 0 && (
                  <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      <p className="text-xs font-bold text-indigo-700">Ventas POS</p>
                    </div>
                    <p className="text-xl font-black text-indigo-800">{formatMoney(posSales.total)}</p>
                    <p className="text-xs text-indigo-500">{posSales.count} órdenes</p>
                  </div>
                )}
                {menubySales.count > 0 && (
                  <div className="bg-violet-50 rounded-xl border border-violet-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-violet-500" />
                      <p className="text-xs font-bold text-violet-700">Ventas MenuBy</p>
                    </div>
                    <p className="text-xl font-black text-violet-800">{formatMoney(menubySales.total)}</p>
                    <p className="text-xs text-violet-500">{menubySales.count} órdenes</p>
                  </div>
                )}
              </div>
            )}

            {/* Payment methods */}
            {Object.keys(methods).length > 0 && (
              <div className="bg-white rounded-2xl lg:rounded-xl border border-slate-100 lg:border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-none p-4 mb-6">
                <h3 className="text-xs font-bold text-slate-700 mb-3">Métodos de pago</h3>
                <div className="space-y-2">
                  {Object.entries(methods).map(([m, v]) => (
                    <div key={m} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-400" />
                        <span className="text-sm text-slate-700">{METHOD_LABELS[m] || m}</span>
                        <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{v.count || 0}</span>
                      </div>
                      <span className="text-sm font-bold text-slate-800">{formatMoney(v.total || 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Operator info */}
            <div className="bg-white rounded-2xl lg:rounded-xl border border-slate-100 lg:border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-none p-4 mb-6">
              <h3 className="text-xs font-bold text-slate-700 mb-3">Información</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-400 text-xs">Abierta por:</span><p className="font-semibold text-slate-700">{detail.openedBy?.name || detail.openedBy?.username || '—'}</p></div>
                <div><span className="text-slate-400 text-xs">Cerrada por:</span><p className="font-semibold text-slate-700">{detail.closedBy?.name || detail.closedBy?.username || '—'}</p></div>
                <div><span className="text-slate-400 text-xs">Apertura:</span><p className="font-semibold text-slate-700">{formatTime(detail.openedAt)}</p></div>
                <div><span className="text-slate-400 text-xs">Cierre:</span><p className="font-semibold text-slate-700">{formatTime(detail.closedAt)}</p></div>
              </div>
            </div>

            {/* Movements */}
            <div className="bg-white rounded-2xl lg:rounded-xl border border-slate-100 lg:border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-none p-4 mb-6">
              <h3 className="text-xs font-bold text-slate-700 mb-3">Movimientos ({movements.length})</h3>
              {movements.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Sin movimientos</p>
              ) : (
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {[
                    { label: 'Ventas', items: sales, color: 'emerald' },
                    { label: 'Ingresos', items: incomes, color: 'blue' },
                    { label: 'Gastos', items: expenses, color: 'red' },
                    { label: 'Reembolsos', items: refunds, color: 'amber' },
                  ].filter(g => g.items.length > 0).map(group => (
                    <div key={group.label} className="mb-3">
                      <p className={`text-xs font-bold uppercase tracking-wider text-${group.color}-600 mb-1.5`}>{group.label} ({group.items.length})</p>
                      {group.items.map((m, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50 text-sm">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className={`w-1.5 h-1.5 rounded-full bg-${group.color}-400 shrink-0`} />
                            <span className="text-slate-600 truncate text-xs">{m.description || m.type}</span>
                            {m.orderChannel && (
                              <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${m.orderChannel === 'pos' ? 'bg-indigo-100 text-indigo-600' : 'bg-violet-100 text-violet-600'}`}>
                                {m.orderChannel === 'pos' ? 'POS' : 'MenuBy'}
                              </span>
                            )}
                          </div>
                          <span className={`font-bold text-xs shrink-0 ${m.type === 'expense' || m.type === 'refund' ? 'text-red-600' : 'text-emerald-600'}`}>
                            {m.type === 'expense' || m.type === 'refund' ? '-' : '+'}{formatMoney(m.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // ---- LIST VIEW ----
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Cierres de Caja</h2>
          <p className="text-xs text-slate-500">{total} cierre{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : registers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 lg:border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-none p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"/></svg>
          </div>
          <h3 className="font-bold text-slate-700 mb-1">Sin cierres de caja</h3>
          <p className="text-sm text-slate-400">Los cierres de caja aparecerán aquí cuando se cierre una caja desde el POS.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {registers.map(reg => {
              const summary = reg.salesSummary || {};
              const diff = (reg.closingAmount || 0) - (reg.expectedAmount || 0);
              return (
                <button
                  key={reg._id}
                  onClick={() => openDetail(reg)}
                  className="w-full bg-white rounded-2xl lg:rounded-xl border border-slate-100 lg:border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-none hover:border-slate-300 hover:shadow-sm transition-all p-4 text-left group active:scale-[0.98] lg:active:scale-100"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                        <svg className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"/></svg>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{formatDate(reg.closedAt)}</p>
                        <p className="text-xs text-slate-400">{formatTime(reg.openedAt)} — {formatTime(reg.closedAt)} · {duration(reg.openedAt, reg.closedAt)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-800">{formatMoney(summary.totalSales)}</p>
                      <p className="text-xs text-slate-400">{summary.totalOrders || 0} órdenes</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>Apertura: {formatMoney(reg.openingAmount)}</span>
                      <span>Cierre: {formatMoney(reg.closingAmount)}</span>
                      {reg.closedBy && <span>Por: {reg.closedBy.name || reg.closedBy.username}</span>}
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      diff > 0 ? 'bg-emerald-100 text-emerald-700' : diff < 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {diff >= 0 ? '+' : ''}{formatMoney(diff)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                disabled={page <= 1}
                onClick={() => fetchHistory(page - 1)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                Anterior
              </button>
              <span className="text-xs text-slate-500">
                Página {page} de {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => fetchHistory(page + 1)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
