import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { API_URL } from "../../config";
import { socket } from "../../services/socket";

/**
 * DashboardMetrics — Real-time business intelligence panel.
 *
 * Fetches GET /api/dashboard/stats and renders:
 * - KPI cards with yesterday comparison
 * - 7-day revenue/orders bar chart (pure CSS)
 * - Top 5 products
 * - Channel / Payment / OrderType breakdowns
 * - Customer metrics
 * - Recent orders timeline
 *
 * Zero external chart deps — everything is Tailwind + CSS.
 */

/* ═══ Helpers ═══ */
const COP = (n) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n || 0);

const pct = (a, b) => {
  if (!b) return a > 0 ? 100 : 0;
  return Math.round(((a - b) / b) * 100);
};

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const dayAbbr = (dateStr) => {
  const d = new Date(dateStr + "T12:00:00");
  return DAY_NAMES[d.getDay()] || dateStr.slice(-2);
};

const STATUS_LABELS = {
  pending: "Pendiente",
  pending_payment: "Pago pendiente",
  payment_uploaded: "Pago enviado",
  payment_confirmed: "Pago confirmado",
  confirmed: "Confirmado",
  preparing: "Preparando",
  ready: "Listo",
  inProgress: "En progreso",
  on_the_way: "En camino",
  delivered: "Entregado",
  completed: "Completado",
  cancelled: "Cancelado",
};

const STATUS_COLORS = {
  pending: "bg-amber-400",
  pending_payment: "bg-yellow-400",
  payment_uploaded: "bg-indigo-400",
  payment_confirmed: "bg-teal-400",
  confirmed: "bg-blue-400",
  preparing: "bg-orange-400",
  ready: "bg-emerald-400",
  inProgress: "bg-sky-400",
  on_the_way: "bg-cyan-400",
  delivered: "bg-green-500",
  completed: "bg-emerald-500",
  cancelled: "bg-red-400",
};

const CHANNEL_LABELS = { whatsapp: "WhatsApp", inapp: "En App", unknown: "Otro", null: "Otro" };
const CHANNEL_COLORS = { whatsapp: "bg-green-400", inapp: "bg-blue-400", unknown: "bg-slate-300", null: "bg-slate-300" };

const PAYMENT_COLORS = {
  cash: "bg-emerald-400",
  nequi: "bg-purple-400",
  daviplata: "bg-red-400",
  bancolombia: "bg-yellow-400",
  card: "bg-blue-400",
  transfer: "bg-cyan-400",
  other: "bg-slate-300",
  unknown: "bg-slate-200",
  null: "bg-slate-200",
};
const PAYMENT_LABELS = {
  cash: "Efectivo",
  nequi: "Nequi",
  daviplata: "Daviplata",
  bancolombia: "Bancolombia",
  card: "Tarjeta",
  transfer: "Transferencia",
  other: "Otro",
  unknown: "En local",
  null: "En local",
};

const TYPE_LABELS = { inSite: "En mesa", takeaway: "Para llevar", delivery: "Domicilio", unknown: "Otro", null: "Otro" };
const TYPE_COLORS = { inSite: "bg-blue-400", takeaway: "bg-amber-400", delivery: "bg-emerald-400", unknown: "bg-slate-300", null: "bg-slate-300" };

/* ═══ SVG Icons ═══ */
const Icons = {
  revenue: (c) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  ),
  orders: (c) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  ),
  ticket: (c) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a3 3 0 013-3h14a3 3 0 013 3v0a3 3 0 01-3 3v0a3 3 0 01-3 3H5a3 3 0 01-3-3z" />
      <path d="M13 6v12" strokeDasharray="2 2" />
    </svg>
  ),
  pending: (c) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
    </svg>
  ),
  customers: (c) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  star: (c) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  refresh: (c) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  ),
  chart: (c) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  ),
  fire: (c) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 12c2-2.96 0-7-1-8 0 3.038-1.773 4.741-3 6-1.226 1.26-2 3.24-2 5a6 6 0 1012 0c0-1.532-1-3.05-2-4-1 2.35-2.5 3-4 1z" />
    </svg>
  ),
  up: (c) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 15l-6-6-6 6" />
    </svg>
  ),
  down: (c) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  clock: (c) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
    </svg>
  ),
};

/* ═══ Live Viewers Widget ═══ */
const ViewerIcons = {
  eye: (c) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  cart: (c) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
    </svg>
  ),
  repeat: (c) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" />
    </svg>
  ),
};

function LiveViewers({ viewers = [], count = 0 }) {
  if (count === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-2.5 sm:p-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center">
            {ViewerIcons.eye("w-2.5 h-2.5 text-slate-300")}
          </div>
          <span className="text-[11px] font-semibold text-slate-400">Nadie viendo tu menú ahora</span>
        </div>
      </div>
    );
  }

  const withCart = viewers.filter(v => v.cartItems > 0);
  const totalCartValue = withCart.reduce((s, v) => s + (v.cartTotal || 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className="bg-white rounded-xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-2.5 sm:p-3 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-12 h-12 bg-blue-500 opacity-[0.04] rounded-full -translate-y-5 translate-x-5" />

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md bg-blue-500 bg-opacity-10 flex items-center justify-center">
            {ViewerIcons.eye("w-2.5 h-2.5 text-blue-500")}
          </div>
          <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">En vivo</span>
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inset-0 rounded-full bg-green-400 opacity-60" />
            <span className="relative rounded-full h-1.5 w-1.5 bg-green-500" />
          </span>
        </div>

        <div className="flex items-center gap-2">
          {withCart.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
              {ViewerIcons.cart("w-2.5 h-2.5")}
              {withCart.length} · {COP(totalCartValue)}
            </span>
          )}
          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
            {count}
          </span>
        </div>
      </div>

      {/* Viewer list */}
      <div className="space-y-1">
        {viewers.slice(0, 6).map((v, i) => (
          <div key={i} className="flex items-center justify-between bg-slate-50/60 rounded-lg px-2 py-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${
                v.isReturning ? 'bg-blue-500' : 'bg-slate-400'
              }`}>
                {v.customerName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-[11px] font-semibold text-slate-700 truncate">{v.customerName}</p>
                  {v.isReturning && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-blue-500 bg-blue-50 px-1 py-0.5 rounded shrink-0">
                      {ViewerIcons.repeat("w-2 h-2")}
                      {v.previousOrders}
                    </span>
                  )}
                </div>
                <p className="text-[9px] text-slate-400">
                  {v.phone || ''} · {v.device || ''} · {formatDuration(v.duration)}
                </p>
              </div>
            </div>
            {v.cartItems > 0 && (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">
                {ViewerIcons.cart("w-2.5 h-2.5")}
                {v.cartItems} · {COP(v.cartTotal)}
              </span>
            )}
          </div>
        ))}
        {viewers.length > 6 && (
          <p className="text-[10px] text-center text-slate-400 font-medium pt-0.5">
            +{viewers.length - 6} más
          </p>
        )}
      </div>
    </motion.div>
  );
}

function formatDuration(seconds) {
  if (!seconds || seconds < 60) return 'ahora';
  const min = Math.floor(seconds / 60);
  return `hace ${min} min`;
}

/* ═══ Skeleton placeholder ═══ */
function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-slate-200/60 rounded-lg ${className}`} />;
}

function SkeletonKPIs() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-slate-100 p-3.5 sm:p-4">
          <Skeleton className="h-3 w-16 mb-3" />
          <Skeleton className="h-7 w-24 mb-2" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4">
      <Skeleton className="h-4 w-32 mb-4" />
      <div className="flex items-end gap-2 h-28">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <Skeleton className={`w-full rounded-md`} style={{ height: `${30 + Math.random() * 60}%` }} />
            <Skeleton className="h-3 w-6" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══ Delta badge (comparison with yesterday) ═══ */
function DeltaBadge({ current, previous, isRevenue = false }) {
  const delta = pct(current, previous);
  if (delta === 0 && current === 0 && previous === 0) {
    return <span className="text-[10px] font-semibold text-slate-400">Sin datos ayer</span>;
  }
  const isUp = delta > 0;
  const isDown = delta < 0;
  const color = isUp ? "text-emerald-600 bg-emerald-50" : isDown ? "text-red-500 bg-red-50" : "text-slate-500 bg-slate-50";
  const Arrow = isUp ? Icons.up : isDown ? Icons.down : null;

  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${color}`}>
      {Arrow && Arrow("w-3 h-3")}
      {Math.abs(delta)}% vs ayer
    </span>
  );
}

/* ═══ KPI Card ═══ */
function KPICard({ icon, label, value, subtitle, delta, color, pulse }) {
  const Icon = icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className="bg-white rounded-xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-2.5 sm:p-3 relative overflow-hidden group"
    >
      <div className={`absolute top-0 right-0 w-12 h-12 ${color} opacity-[0.04] rounded-full -translate-y-5 translate-x-5`} />

      <div className="flex items-center gap-1.5 mb-1">
        <div className={`w-5 h-5 rounded-md ${color} bg-opacity-10 flex items-center justify-center`}>
          {Icon && Icon(`w-2.5 h-2.5 ${color.replace("bg-", "text-")}`)}
        </div>
        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
        {pulse && (
          <span className="relative flex h-1.5 w-1.5 ml-auto">
            <span className="animate-ping absolute inset-0 rounded-full bg-amber-400 opacity-60" />
            <span className="relative rounded-full h-1.5 w-1.5 bg-amber-400" />
          </span>
        )}
      </div>

      <p className="text-base sm:text-lg font-extrabold text-slate-800 tracking-tight leading-none">
        {value}
      </p>

      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
        {delta}
        {subtitle && <span className="text-[9px] text-slate-400 font-medium">{subtitle}</span>}
      </div>
    </motion.div>
  );
}

/* ═══ Mini Bar Chart (CSS-only) ═══ */
function WeeklyChart({ data, loading }) {
  if (loading) return <SkeletonChart />;
  if (!data || !data.length) return null;

  const maxRev = Math.max(...data.map((d) => d.revenue), 1);
  const maxOrd = Math.max(...data.map((d) => d.orders), 1);
  const totalRev = data.reduce((s, d) => s + d.revenue, 0);
  const totalOrd = data.reduce((s, d) => s + d.orders, 0);
  const isEmpty = totalRev === 0 && totalOrd === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
      className="bg-white rounded-xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-3 sm:p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          {Icons.chart("w-3.5 h-3.5 text-blue-500")}
          <h3 className="text-[11px] font-bold text-slate-700">Últimos 7 días</h3>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-semibold">
          <span className="flex items-center gap-1 text-blue-500">
            <span className="w-2 h-2 rounded-sm bg-blue-400" />
            {COP(totalRev)}
          </span>
          <span className="flex items-center gap-1 text-slate-400">
            <span className="w-2 h-2 rounded-sm bg-slate-300" />
            {totalOrd} pedidos
          </span>
        </div>
      </div>

      {/* Bars */}
      <div className="relative flex gap-1.5 sm:gap-2">
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <p className="text-xs text-slate-400 font-medium bg-white/80 px-3 py-1.5 rounded-lg">Sin ventas esta semana — ¡tu primer pedido aparecerá aquí!</p>
          </div>
        )}
        {data.map((day, i) => {
          const revH = isEmpty ? 8 : (day.revenue / maxRev) * 100;
          const isToday = i === data.length - 1;
          return (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group/bar">
              {/* Revenue value on hover */}
              {!isEmpty && (
                <div className="text-[9px] font-bold text-slate-400 opacity-0 group-hover/bar:opacity-100 transition-opacity truncate max-w-full h-3">
                  {day.orders > 0 ? COP(day.revenue) : ""}
                </div>
              )}

              {/* Bar — fixed height container with absolute positioned bar */}
              <div className="w-full h-20 sm:h-24 relative">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(revH, 4)}%` }}
                  transition={{ duration: 0.5, delay: i * 0.05, ease: [0.25, 0.1, 0.25, 1] }}
                  className={`absolute bottom-0 inset-x-0 rounded-md transition-colors ${
                    isEmpty
                      ? "bg-slate-100"
                      : isToday
                        ? "bg-blue-500 shadow-sm shadow-blue-500/20"
                        : "bg-blue-200/70 group-hover/bar:bg-blue-300/80"
                  }`}
                />
              </div>

              {/* Orders count */}
              {!isEmpty && day.orders > 0 && (
                <span className={`text-[9px] font-bold ${isToday ? "text-blue-600" : "text-slate-400"}`}>
                  {day.orders}
                </span>
              )}

              {/* Day label */}
              <span className={`text-[10px] font-semibold ${isToday ? "text-blue-600" : "text-slate-400"}`}>
                {isToday ? "Hoy" : dayAbbr(day.date)}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ═══ Horizontal Breakdown Bar ═══ */
function BreakdownBar({ title, data, labels, colors, icon }) {
  const entries = Object.entries(data || {}).filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  if (!total) {
    const Icon = icon;
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-3"
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          {Icon && Icon("w-3 h-3 text-slate-400")}
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{title}</h4>
        </div>
        <div className="h-2.5 rounded-full bg-slate-100 mb-2" />
        <p className="text-[10px] text-slate-400 text-center">Sin datos aún</p>
      </motion.div>
    );
  }

  const Icon = icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-3"
    >
      <div className="flex items-center gap-2 mb-2">
        {Icon && Icon("w-3 h-3 text-slate-400")}
        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{title}</h4>
        <span className="ml-auto text-[9px] font-bold text-slate-400">{total}</span>
      </div>

      {/* Stacked bar */}
      <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100 mb-2.5">
        {entries.map(([key, val]) => (
          <div
            key={key}
            className={`${colors[key] || "bg-slate-300"} transition-all duration-500`}
            style={{ width: `${(val / total) * 100}%` }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {entries.map(([key, val]) => (
          <span key={key} className="flex items-center gap-1 text-[10px] font-medium text-slate-500">
            <span className={`w-2 h-2 rounded-sm ${colors[key] || "bg-slate-300"}`} />
            {labels[key] || key} <span className="font-bold text-slate-700">{val}</span>
          </span>
        ))}
      </div>
    </motion.div>
  );
}

/* ═══ Top Products List ═══ */
function TopProducts({ products, loading }) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <Skeleton className="h-4 w-28 mb-4" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 mb-3">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (!products?.length) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
        className="bg-white rounded-2xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-4 sm:p-5"
      >
        <div className="flex items-center gap-2 mb-3">
          {Icons.fire("w-4 h-4 text-orange-500")}
          <h3 className="text-xs sm:text-sm font-bold text-slate-700">Top productos</h3>
        </div>
        <div className="text-center py-4">
          <p className="text-xs text-slate-400">Aquí verás tus productos más vendidos</p>
          <p className="text-[10px] text-slate-300 mt-1">Los datos se acumulan con cada pedido completado</p>
        </div>
      </motion.div>
    );
  }

  const maxQty = Math.max(...products.map((p) => p.quantity), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.15 }}
      className="bg-white rounded-xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-3 sm:p-4"
    >
      <div className="flex items-center gap-1.5 mb-2.5">
        {Icons.fire("w-3.5 h-3.5 text-orange-500")}
        <h3 className="text-[11px] font-bold text-slate-700">Top productos</h3>
        <span className="ml-auto text-[9px] text-slate-400 font-semibold">Últimos 30 días</span>
      </div>

      <div className="space-y-2">
        {products.map((p, i) => (
          <div key={p.name} className="flex items-center gap-2">
            {/* Rank */}
            <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-extrabold ${
              i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-slate-100 text-slate-600" : "bg-slate-50 text-slate-400"
            }`}>
              {i + 1}
            </span>

            {/* Name + bar */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate">{p.name}</p>
              <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(p.quantity / maxQty) * 100}%` }}
                  transition={{ duration: 0.6, delay: i * 0.08 }}
                  className={`h-full rounded-full ${i === 0 ? "bg-orange-400" : i === 1 ? "bg-orange-300" : "bg-orange-200"}`}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="text-right flex-shrink-0">
              <p className="text-[11px] font-bold text-slate-700">{p.quantity} uds</p>
              <p className="text-[9px] font-medium text-slate-400">{COP(p.revenue)}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ═══ Customer Summary ═══ */
function CustomerSummary({ customers, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-100 p-3">
            <Skeleton className="h-6 w-10 mb-1" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
    );
  }
  if (!customers) customers = { total: 0, newToday: 0, vip: 0 };

  const items = [
    { label: "Total", value: customers.total || 0, icon: Icons.customers, color: "text-blue-500" },
    { label: "Nuevos hoy", value: customers.newToday || 0, icon: Icons.star, color: "text-emerald-500" },
    { label: "VIP", value: customers.vip || 0, icon: Icons.fire, color: "text-amber-500" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      <div className="flex items-center gap-2 mb-2.5">
        {Icons.customers("w-4 h-4 text-blue-500")}
        <h3 className="text-xs sm:text-sm font-bold text-slate-700">Clientes</h3>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <div key={item.label} className="bg-white rounded-xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-3 text-center">
            <p className={`text-lg sm:text-xl font-extrabold ${item.color}`}>{item.value}</p>
            <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ═══ Recent Orders Timeline ═══ */
function RecentOrders({ orders, loading, onViewOrders }) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <Skeleton className="h-4 w-32 mb-4" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 mb-3">
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (!orders?.length) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.25 }}
        className="bg-white rounded-2xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-4 sm:p-5"
      >
        <div className="flex items-center gap-2 mb-3">
          {Icons.clock("w-4 h-4 text-slate-400")}
          <h3 className="text-xs sm:text-sm font-bold text-slate-700">Actividad reciente</h3>
        </div>
        <div className="text-center py-4">
          <p className="text-xs text-slate-400">Aún no hay pedidos recientes</p>
          <p className="text-[10px] text-slate-300 mt-1">Tu actividad del día aparecerá aquí en tiempo real</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.25 }}
      className="bg-white rounded-xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-3 sm:p-4"
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          {Icons.clock("w-3.5 h-3.5 text-slate-400")}
          <h3 className="text-[11px] font-bold text-slate-700">Actividad reciente</h3>
        </div>
        {onViewOrders && (
          <button
            onClick={onViewOrders}
            className="text-[10px] font-bold text-blue-500 hover:text-blue-600 hover:underline transition-colors"
          >
            Ver todos →
          </button>
        )}
      </div>

      <div className="space-y-1">
        {orders.map((order, i) => {
          const statusKey = order.status || "pending";
          const time = order.createdAt
            ? new Date(order.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
            : "";
          return (
            <div key={order._id || i} className="flex items-center gap-2.5 py-1">
              {/* Status dot */}
              <div className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[statusKey] || "bg-slate-300"} flex-shrink-0`} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">
                  {order.customerName || "Cliente"}{" "}
                  <span className="font-normal text-slate-400">
                    · {STATUS_LABELS[statusKey] || statusKey}
                  </span>
                </p>
                <p className="text-[10px] text-slate-400 font-medium">
                  {order.itemCount ?? order.items?.length ?? 0} items · {time}
                </p>
              </div>

              {/* Amount */}
              <span className="text-xs font-bold text-slate-700 flex-shrink-0">
                {COP(order.totalAmount)}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ═══ Pending Orders Banner ═══ */
function PendingBanner({ pending, onViewOrders }) {
  if (!pending?.total) return null;
  const statuses = Object.entries(pending.byStatus || {}).filter(([, v]) => v > 0);

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      whileTap={{ scale: 0.98 }}
      onClick={onViewOrders}
      className="w-full flex items-center gap-2.5 px-3 py-2 bg-amber-50 hover:bg-amber-100/70 rounded-xl border border-amber-200/60 transition-all group"
    >
      <div className="relative flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-amber-400/15 flex items-center justify-center">
          {Icons.pending("w-3.5 h-3.5 text-amber-600")}
        </div>
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center shadow-sm">
          {pending.total}
        </span>
      </div>

      <div className="flex-1 min-w-0 text-left">
        <p className="text-xs font-bold text-amber-800">
          {pending.total} {pending.total === 1 ? "pedido pendiente" : "pedidos pendientes"}
        </p>
        {statuses.length > 0 && (
          <p className="text-[10px] text-amber-600/70 font-medium mt-0.5 truncate">
            {statuses.map(([s, c]) => `${STATUS_LABELS[s] || s}: ${c}`).join(" · ")}
          </p>
        )}
      </div>

      <svg className="w-4 h-4 text-amber-400 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </motion.button>
  );
}

/* ═══ MAIN COMPONENT ═══ */
export default function DashboardMetrics({ setActiveTab, businessId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [liveViewers, setLiveViewers] = useState({ count: 0, viewers: [] });

  // Live viewers: socket listener + initial fetch
  useEffect(() => {
    if (!businessId) return;

    // Initial fetch via REST
    const fetchViewers = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(`${API_URL}/dashboard/viewers?businessId=${businessId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          setLiveViewers(json);
        }
      } catch { /* silent */ }
    };
    fetchViewers();

    // Listen for real-time updates via socket
    const handleViewersUpdated = (data) => {
      setLiveViewers(data);
    };
    socket.on('viewers_updated', handleViewersUpdated);

    return () => {
      socket.off('viewers_updated', handleViewersUpdated);
    };
  }, [businessId]);

  const fetchStats = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const token = localStorage.getItem("accessToken");
      // Include businessId as query param (needed when logged in as SuperAdmin)
      const qs = businessId ? `?businessId=${businessId}` : '';
      const res = await fetch(`${API_URL}/dashboard/stats${qs}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Dashboard stats error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchStats();
    // Auto-refresh every 2 minutes
    const interval = setInterval(() => fetchStats(true), 120_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const handleViewOrders = useCallback(() => setActiveTab("orders"), [setActiveTab]);

  /* ═══ Render ═══ */

  // Error state
  if (error && !data) {
    return (
      <div className="bg-red-50 rounded-2xl border border-red-200/60 p-4 text-center">
        <p className="text-sm font-semibold text-red-700 mb-1">No se pudieron cargar las métricas</p>
        <p className="text-xs text-red-500 mb-3">{error}</p>
        <button
          onClick={() => fetchStats()}
          className="text-xs font-bold text-red-600 bg-red-100 hover:bg-red-200 px-4 py-2 rounded-xl transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Refresh button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-0.5 h-3 rounded-full bg-blue-500" />
          <h2 className="text-[11px] font-extrabold text-slate-700 tracking-tight">Resumen del día</h2>
        </div>
        <button
          onClick={() => fetchStats(true)}
          disabled={refreshing}
          className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-blue-500 disabled:opacity-50 transition-colors px-1.5 py-0.5 rounded-lg hover:bg-blue-50/50"
        >
          <motion.div animate={refreshing ? { rotate: 360 } : { rotate: 0 }} transition={{ duration: 0.8, repeat: refreshing ? Infinity : 0, ease: "linear" }}>
            {Icons.refresh("w-3 h-3")}
          </motion.div>
          {refreshing ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {/* ═══ Live Viewers ═══ */}
      <LiveViewers count={liveViewers.count} viewers={liveViewers.viewers} />

      {/* ═══ KPI Cards ═══ */}
      {loading ? (
        <SkeletonKPIs />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2">
          <KPICard
            icon={Icons.revenue}
            label="Ventas"
            value={COP(data?.today?.revenue)}
            delta={<DeltaBadge current={data?.today?.revenue} previous={data?.comparison?.revenue} isRevenue />}
            color="bg-emerald-500"
            subtitle={data?.today?.maxOrder > 0 ? `Máx ${COP(data.today.maxOrder)}` : ""}
          />
          <KPICard
            icon={Icons.orders}
            label="Pedidos"
            value={data?.today?.orders || 0}
            delta={<DeltaBadge current={data?.today?.orders} previous={data?.comparison?.orders} />}
            color="bg-blue-500"
          />
          <KPICard
            icon={Icons.ticket}
            label="Ticket prom."
            value={COP(data?.today?.avgTicket)}
            color="bg-violet-500"
            subtitle={data?.today?.orders > 0 ? `${data.today.orders} ventas` : ""}
          />
          <KPICard
            icon={Icons.pending}
            label="Pendientes"
            value={data?.pending?.total || 0}
            color="bg-amber-500"
            pulse={data?.pending?.total > 0}
            subtitle={data?.pending?.total > 0 ? "Requieren atención" : "Todo al día"}
          />
        </div>
      )}

      {/* ═══ Pending orders banner ═══ */}
      {!loading && <PendingBanner pending={data?.pending} onViewOrders={handleViewOrders} />}

      {/* ═══ Weekly Chart ═══ */}
      <WeeklyChart data={data?.weeklyChart} loading={loading} />

      {/* ═══ Top Products ═══ */}
      <TopProducts products={data?.topProducts} loading={loading} />

      {/* ═══ Breakdowns (grid of 2 or 3) ═══ */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 sm:gap-2">
          <BreakdownBar
            title="Canales"
            data={data?.channels}
            labels={CHANNEL_LABELS}
            colors={CHANNEL_COLORS}
            icon={Icons.orders}
          />
          <BreakdownBar
            title="Pagos"
            data={data?.payments}
            labels={PAYMENT_LABELS}
            colors={PAYMENT_COLORS}
            icon={Icons.revenue}
          />
          <BreakdownBar
            title="Tipo de pedido"
            data={data?.orderTypes}
            labels={TYPE_LABELS}
            colors={TYPE_COLORS}
            icon={Icons.ticket}
          />
        </div>
      )}

      {/* ═══ Customer metrics ═══ */}
      <CustomerSummary customers={data?.customers} loading={loading} />

      {/* ═══ Recent Activity ═══ */}
      <RecentOrders orders={data?.recentOrders} loading={loading} onViewOrders={handleViewOrders} />
    </div>
  );
}
