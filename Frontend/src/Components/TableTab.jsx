import React, { useCallback, useEffect, useState } from 'react';
import { ReceiptText } from 'lucide-react';
import api from '../services/api';
import { socket } from '../services/socket';

const money = (n) => `$${Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
const TIP_PCTS = [0, 5, 10];

/**
 * TableTab — lo que la mesa lleva consumido, en vivo.
 *
 * Solo aparece cuando el comensal entró por el QR de una mesa y el negocio
 * tiene POS con cuenta abierta. Es lectura: el cobro lo hace el POS.
 */
export default function TableTab({ businessId, table, onGoToMenu }) {
  const [state, setState] = useState({ loading: true, open: false, items: [], subtotal: 0, orderNumber: null });
  const [tipPct, setTipPct] = useState(10);

  const load = useCallback(() => {
    if (!businessId || !table) return;
    api.get(`/orders/open-tab?businessId=${businessId}&table=${encodeURIComponent(table)}`)
      .then((r) => setState({ loading: false, ...(r.data || { open: false }) }))
      .catch(() => setState((s) => ({ ...s, loading: false })));
  }, [businessId, table]);

  useEffect(() => { load(); }, [load]);

  /* Se actualiza sola cuando el mesero suma algo desde el POS: el room del
     negocio ya emite estos eventos, no hace falta refrescar la página. */
  useEffect(() => {
    if (!businessId) return undefined;
    const refresh = () => load();
    socket.on('order_updated', refresh);
    socket.on('order_items_added', refresh);
    socket.on('order_created', refresh);
    return () => {
      socket.off('order_updated', refresh);
      socket.off('order_items_added', refresh);
      socket.off('order_created', refresh);
    };
  }, [businessId, load]);

  if (state.loading) {
    return <div className="py-16 text-center text-[13px]" style={{ color: 'var(--mb-ink-2)' }}>Cargando la cuenta…</div>;
  }

  if (!state.open) {
    return (
      <div className="py-16 px-8 text-center">
        <ReceiptText size={44} className="mx-auto mb-3" style={{ color: 'var(--mb-accent)', opacity: 0.2 }} />
        <p className="font-bold" style={{ color: 'var(--mb-ink)' }}>Aún no hay consumo en esta mesa</p>
        <p className="text-[13px] mt-1 mb-5" style={{ color: 'var(--mb-ink-2)' }}>
          Cuando pidas, lo verás aquí en tiempo real.
        </p>
        <button
          onClick={onGoToMenu}
          className="px-5 py-2.5 rounded-[var(--mb-radius-btn)] text-[14px] font-extrabold"
          style={{ background: 'var(--mb-accent)', color: 'var(--mb-on-accent)' }}
        >
          Ver el menú
        </button>
      </div>
    );
  }

  const tip = Math.round((state.subtotal || 0) * tipPct / 100);

  return (
    <div className="p-4">
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--mb-card)', borderColor: 'var(--mb-line)' }}>
        <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{ borderColor: 'var(--mb-line)' }}>
          <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--mb-ink-3)' }}>Mesa {table}</span>
          <span className="text-[12px]" style={{ color: 'var(--mb-ink-3)' }}>#{state.orderNumber}</span>
        </div>

        <div className="divide-y" style={{ borderColor: 'var(--mb-line)' }}>
          {state.items.map((it, i) => (
            <div key={i} className="px-4 py-2.5 flex items-start gap-3">
              <span className="text-[13px] font-extrabold tabular-nums shrink-0" style={{ color: 'var(--mb-accent-strong)' }}>{it.quantity}×</span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold leading-tight" style={{ color: 'var(--mb-ink)' }}>{it.name}</p>
                {(it.selectedToppings || []).length > 0 && (
                  <p className="text-[11.5px] leading-tight mt-0.5" style={{ color: 'var(--mb-ink-2)' }}>
                    {it.selectedToppings.map((t) => t.optionName).filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <span className="text-[14px] font-bold tabular-nums shrink-0" style={{ color: 'var(--mb-ink)' }}>
                {money((it.price || 0) * (it.quantity || 1))}
              </span>
            </div>
          ))}
        </div>

        <div className="px-4 py-3 border-t space-y-1.5" style={{ borderColor: 'var(--mb-line)' }}>
          <div className="flex justify-between text-[13.5px]" style={{ color: 'var(--mb-ink-2)' }}>
            <span>Subtotal</span><span className="tabular-nums">{money(state.subtotal)}</span>
          </div>
          {tip > 0 && (
            <div className="flex justify-between text-[13.5px]" style={{ color: 'var(--mb-ink-2)' }}>
              <span>Propina sugerida ({tipPct}%)</span><span className="tabular-nums">{money(tip)}</span>
            </div>
          )}
          <div className="flex justify-between pt-1.5 border-t text-[17px] font-black" style={{ borderColor: 'var(--mb-line)', color: 'var(--mb-ink)' }}>
            <span>Total</span><span className="tabular-nums">{money((state.subtotal || 0) + tip)}</span>
          </div>
        </div>
      </div>

      <p className="text-[11.5px] font-bold uppercase tracking-wider mt-4 mb-2" style={{ color: 'var(--mb-ink-3)' }}>Propina</p>
      <div className="flex gap-2">
        {TIP_PCTS.map((p) => {
          const on = tipPct === p;
          return (
            <button
              key={p}
              onClick={() => setTipPct(p)}
              className="flex-1 py-2.5 rounded-xl text-[13.5px] font-bold transition-all active:scale-[0.97]"
              style={on
                ? { background: 'var(--mb-accent)', color: 'var(--mb-on-accent)' }
                : { background: 'var(--mb-surface-2)', color: 'var(--mb-ink-2)', border: '1px solid var(--mb-line)' }}
            >
              {p === 0 ? 'Sin propina' : `${p}%`}
            </button>
          );
        })}
      </div>

      <p className="text-[12px] text-center mt-4" style={{ color: 'var(--mb-ink-3)' }}>
        Pide la cuenta a tu mesero cuando quieras cerrar.
      </p>
    </div>
  );
}
