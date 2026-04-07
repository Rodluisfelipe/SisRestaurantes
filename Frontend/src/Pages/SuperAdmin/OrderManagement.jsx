import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SAToast } from "../../Components/SuperAdmin/ui";

const API_URL = (import.meta.env.VITE_API_URL || "https://157-245-125-216.nip.io") + "/api";

const STATUS_CONFIG = {
  pending:           { label: "Pendiente",        color: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  pending_payment:   { label: "Pago pendiente",   color: "bg-orange-500/15 text-orange-400 border-orange-500/20" },
  payment_uploaded:  { label: "Pago subido",      color: "bg-sky-500/15 text-sky-400 border-sky-500/20" },
  payment_confirmed: { label: "Pago confirmado",  color: "bg-teal-500/15 text-teal-400 border-teal-500/20" },
  confirmed:         { label: "Confirmado",       color: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  preparing:         { label: "Preparando",       color: "bg-violet-500/15 text-violet-400 border-violet-500/20" },
  ready:             { label: "Listo",            color: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20" },
  inProgress:        { label: "En curso",         color: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20" },
  completed:         { label: "Completado",       color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  delivered:         { label: "Entregado",        color: "bg-green-500/15 text-green-400 border-green-500/20" },
  cancelled:         { label: "Cancelado",        color: "bg-red-500/15 text-red-400 border-red-500/20" },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG);

const FILTER_TABS = [
  { id: "all", label: "Todos" },
  { id: "active", label: "Activos", statuses: ["pending", "pending_payment", "payment_uploaded", "payment_confirmed", "confirmed", "preparing", "ready", "inProgress"] },
  { id: "completed", label: "Completados", statuses: ["completed", "delivered"] },
  { id: "cancelled", label: "Cancelados", statuses: ["cancelled"] },
];

export default function OrderManagement() {
  const [orders, setOrders] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterTab, setFilterTab] = useState("all");
  const [businessFilter, setBusinessFilter] = useState("");
  const [search, setSearch] = useState("");
  const [toastData, setToastData] = useState({ visible: false, message: '', type: 'success' });
  const [changingId, setChangingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const getToken = () => localStorage.getItem("superadmin_token");

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (businessFilter) params.set("businessId", businessFilter);
      const resp = await fetch(`${API_URL}/superadmin/orders?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (!resp.ok) throw new Error("Error al cargar pedidos");
      const data = await resp.json();
      setOrders(data.orders || []);
      setBusinesses(data.businesses || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [businessFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const showToast = (msg, type = "success") => {
    setToastData({ visible: true, message: msg, type });
  };
  const closeToast = () => setToastData(prev => ({ ...prev, visible: false }));

  const changeStatus = async (orderId, newStatus, fromCollection) => {
    setChangingId(orderId);
    try {
      const resp = await fetch(`${API_URL}/superadmin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, fromCollection })
      });
      if (!resp.ok) { const d = await resp.json(); throw new Error(d.message || "Error"); }
      const data = await resp.json();
      showToast(data.message);
      fetchOrders();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setChangingId(null);
    }
  };

  // Filter orders
  const filtered = orders.filter(o => {
    const tab = FILTER_TABS.find(t => t.id === filterTab);
    if (tab?.statuses && !tab.statuses.includes(o.status)) return false;
    if (search) {
      const s = search.toLowerCase();
      const name = (o.customerName || "").toLowerCase();
      const biz = (o.businessId?.businessName || "").toLowerCase();
      const num = String(o.orderNumber || "");
      if (!name.includes(s) && !biz.includes(s) && !num.includes(s)) return false;
    }
    return true;
  });

  // Stats
  const stats = {
    total: orders.length,
    active: orders.filter(o => !["completed", "delivered", "cancelled"].includes(o.status)).length,
    completed: orders.filter(o => o.status === "completed" || o.status === "delivered").length,
    cancelled: orders.filter(o => o.status === "cancelled").length,
  };

  const formatDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const formatCurrency = (n) => {
    if (!n && n !== 0) return "$0";
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      <SAToast message={toastData.message} type={toastData.type} visible={toastData.visible} onClose={closeToast} />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, accent: "text-white/80" },
          { label: "Activos", value: stats.active, accent: "text-cyan-400" },
          { label: "Completados", value: stats.completed, accent: "text-emerald-400" },
          { label: "Cancelados", value: stats.cancelled, accent: "text-red-400" },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
            <p className="text-[11px] text-white/30 uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${s.accent}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por cliente, negocio o #pedido..."
            aria-label="Buscar pedidos"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/10 transition-all"
          />
        </div>

        {/* Business filter */}
        <select
          value={businessFilter}
          onChange={e => setBusinessFilter(e.target.value)}
          className="px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm outline-none focus:border-cyan-500/40 transition-all appearance-none cursor-pointer sm:w-52"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.3)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
        >
          <option value="" className="bg-[#141419]">Todos los negocios</option>
          {businesses.map(b => (
            <option key={b.id} value={b.id} className="bg-[#141419]">{b.name}</option>
          ))}
        </select>
      </div>

      {/* Tab filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilterTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 border ${
              filterTab === tab.id
                ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/20"
                : "text-white/40 hover:text-white/60 hover:bg-white/[0.04] border-transparent"
            }`}
          >
            {tab.label}
            {tab.id === "all" && ` (${stats.total})`}
            {tab.id === "active" && ` (${stats.active})`}
            {tab.id === "completed" && ` (${stats.completed})`}
            {tab.id === "cancelled" && ` (${stats.cancelled})`}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          {error}
          <button onClick={fetchOrders} className="ml-auto text-xs text-red-400 hover:text-red-300 underline">Reintentar</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-white/10 border-t-cyan-400 rounded-full animate-spin" />
        </div>
      )}

      {/* Orders list */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-16">
          <svg className="w-12 h-12 mx-auto text-white/10 mb-3" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
          </svg>
          <p className="text-white/30 text-sm">No se encontraron pedidos</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map(order => {
            const st = STATUS_CONFIG[order.status] || { label: order.status, color: "bg-white/10 text-white/50 border-white/10" };
            const isExpanded = expandedId === (order._id || order.id);
            const orderId = order._id || order.id;
            const bizName = order.businessId?.businessName || "—";
            const isChanging = changingId === orderId;

            return (
              <motion.div
                key={orderId}
                layout
                className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden hover:border-white/[0.1] transition-colors"
              >
                {/* Order row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : orderId)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                >
                  {/* Order number */}
                  <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-white/60">#{order.orderNumber}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white truncate">{order.customerName || "Sin nombre"}</span>
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium border ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px] text-white/30 truncate">{bizName}</span>
                      <span className="text-[11px] text-white/20">•</span>
                      <span className="text-[11px] text-white/30">{formatDate(order.completedAt || order.createdAt)}</span>
                      {order.total > 0 && (
                        <>
                          <span className="text-[11px] text-white/20">•</span>
                          <span className="text-[11px] text-emerald-400/60">{formatCurrency(order.total)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Collection badge */}
                  <span className={`hidden sm:inline-flex px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                    order._collection === "orders"
                      ? "bg-cyan-500/10 text-cyan-400/60 border-cyan-500/15"
                      : "bg-white/[0.04] text-white/30 border-white/[0.06]"
                  }`}>
                    {order._collection === "orders" ? "Activo" : "Historial"}
                  </span>

                  {/* Chevron */}
                  <svg className={`w-4 h-4 text-white/20 transition-transform duration-200 shrink-0 ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {/* Expanded details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-1 border-t border-white/[0.04]">
                        {/* Order details grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                          <div>
                            <p className="text-[10px] text-white/25 uppercase tracking-wider">Tipo</p>
                            <p className="text-sm text-white/70 mt-0.5">
                              {order.orderType === "delivery" ? "Domicilio" : order.orderType === "takeaway" ? "Para llevar" : "En sitio"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-white/25 uppercase tracking-wider">Teléfono</p>
                            <p className="text-sm text-white/70 mt-0.5">{order.phone || "—"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-white/25 uppercase tracking-wider">Total</p>
                            <p className="text-sm text-white/70 mt-0.5">{formatCurrency(order.total)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-white/25 uppercase tracking-wider">Colección</p>
                            <p className="text-sm text-white/70 mt-0.5">{order._collection === "orders" ? "Pedidos activos" : "Completados"}</p>
                          </div>
                        </div>

                        {/* Items */}
                        {order.items && order.items.length > 0 && (
                          <div className="mb-4">
                            <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1.5">Items ({order.items.length})</p>
                            <div className="space-y-1">
                              {order.items.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between px-3 py-1.5 bg-white/[0.02] rounded-lg">
                                  <span className="text-xs text-white/60">
                                    <span className="text-white/30 mr-1.5">{item.quantity || 1}x</span>
                                    {item.name}
                                  </span>
                                  {item.price > 0 && (
                                    <span className="text-xs text-white/30">{formatCurrency(item.price * (item.quantity || 1))}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Address for delivery */}
                        {order.orderType === "delivery" && order.address && (
                          <div className="mb-4">
                            <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1">Dirección</p>
                            <p className="text-xs text-white/50">{typeof order.address === 'string' ? order.address : JSON.stringify(order.address)}</p>
                          </div>
                        )}

                        {/* Status changer */}
                        <div>
                          <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">Cambiar estado</p>
                          <div className="flex flex-wrap gap-1.5">
                            {ALL_STATUSES.map(s => {
                              const sc = STATUS_CONFIG[s];
                              const isCurrent = order.status === s;
                              return (
                                <button
                                  key={s}
                                  disabled={isCurrent || isChanging}
                                  onClick={() => changeStatus(orderId, s, order._collection)}
                                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all duration-200 ${
                                    isCurrent
                                      ? `${sc.color} ring-1 ring-current opacity-100 cursor-default`
                                      : isChanging
                                        ? "bg-white/[0.02] text-white/15 border-white/[0.04] cursor-wait"
                                        : `bg-white/[0.02] text-white/40 border-white/[0.06] hover:${sc.color}`
                                  }`}
                                >
                                  {isChanging && changingId === orderId ? (
                                    <span className="flex items-center gap-1">
                                      <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                                    </span>
                                  ) : (
                                    <>
                                      {isCurrent && "● "}
                                      {sc.label}
                                    </>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                          {order._collection === "orders" && ["completed", "delivered", "cancelled"].includes(order.status) && (
                            <p className="mt-2 text-[10px] text-amber-400/50 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                              Al cambiar a completado/entregado/cancelado se moverá a historial
                            </p>
                          )}
                          {order._collection === "completedorders" && !["completed", "delivered", "cancelled"].includes(order.status) && (
                            <p className="mt-2 text-[10px] text-cyan-400/50 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                              Al cambiar a un estado activo se moverá a pedidos activos
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Count footer */}
      {!loading && filtered.length > 0 && (
        <p className="text-center text-xs text-white/20 pt-2">
          Mostrando {filtered.length} de {orders.length} pedidos
        </p>
      )}
    </div>
  );
}
