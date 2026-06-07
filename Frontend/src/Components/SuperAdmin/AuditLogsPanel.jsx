import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BACKEND_URL } from '../../config';

const API = `${BACKEND_URL}/api/audit-logs`;
const getToken = () => localStorage.getItem('superadmin_token');
const headers = () => ({ 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' });

const ACTION_LABELS = {
  create: { label: 'Creado', color: 'bg-emerald-200 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400', icon: '+' },
  update: { label: 'Editado', color: 'bg-cyan-200 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400', icon: '✎' },
  delete: { label: 'Eliminado', color: 'bg-red-200 dark:bg-red-500/20 text-red-600 dark:text-red-400', icon: '×' },
  toggle: { label: 'Toggle', color: 'bg-amber-200 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400', icon: '⇄' },
  reorder: { label: 'Reordenado', color: 'bg-purple-200 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400', icon: '↕' },
};

const RESOURCE_LABELS = {
  product: 'Producto',
  category: 'Categoría',
  toppingGroup: 'Grupo de Toppings',
  businessConfig: 'Config. Negocio',
  order: 'Pedido',
  subscription: 'Suscripción',
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `hace ${days}d`;
  return new Date(dateStr).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

// Renders a diff view between before and after snapshots
function DiffView({ before, after, action }) {
  if (action === 'delete' && before) {
    return (
      <div>
        <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-2">Datos eliminados:</p>
        <pre className="text-xs text-slate-600 dark:text-white/60 bg-black/30 rounded-lg p-3 overflow-auto max-h-72 whitespace-pre-wrap break-words">
          {JSON.stringify(before, null, 2)}
        </pre>
      </div>
    );
  }
  if (action === 'create' && after) {
    return (
      <div>
        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-2">Datos creados:</p>
        <pre className="text-xs text-slate-600 dark:text-white/60 bg-black/30 rounded-lg p-3 overflow-auto max-h-72 whitespace-pre-wrap break-words">
          {JSON.stringify(after, null, 2)}
        </pre>
      </div>
    );
  }
  if ((action === 'update' || action === 'toggle') && before && after) {
    // Find changed keys
    const allKeys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
    const changes = allKeys.filter(k => {
      if (k === '__v' || k === 'updatedAt') return false;
      return JSON.stringify(before[k]) !== JSON.stringify(after[k]);
    });
    if (changes.length === 0) return <p className="text-xs text-slate-500 dark:text-white/40">Sin cambios detectados</p>;
    return (
      <div className="space-y-2">
        <p className="text-xs text-cyan-600 dark:text-cyan-400 font-medium mb-2">Campos modificados ({changes.length}):</p>
        {changes.map(key => (
          <div key={key} className="bg-black/30 rounded-lg p-2.5 text-xs">
            <span className="text-slate-600 dark:text-white/50 font-mono">{key}</span>
            <div className="mt-1 flex flex-col gap-1">
              <div className="flex items-start gap-2">
                <span className="text-red-600 dark:text-red-400 font-mono shrink-0">−</span>
                <span className="text-red-300/70 break-all">{typeof before[key] === 'object' ? JSON.stringify(before[key]) : String(before[key] ?? '')}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-600 dark:text-emerald-400 font-mono shrink-0">+</span>
                <span className="text-emerald-300/70 break-all">{typeof after[key] === 'object' ? JSON.stringify(after[key]) : String(after[key] ?? '')}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return <p className="text-xs text-slate-500 dark:text-white/40">Sin datos de snapshot disponibles</p>;
}

export default function AuditLogsPanel() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState([]);
  const [stats, setStats] = useState(null);

  // Filters
  const [filterBusiness, setFilterBusiness] = useState('');
  const [filterResource, setFilterResource] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  // Detail
  const [expandedId, setExpandedId] = useState(null);

  // Revert
  const [reverting, setReverting] = useState(null);
  const [revertConfirm, setRevertConfirm] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, limit: 30 });
      if (filterBusiness) params.set('businessId', filterBusiness);
      if (filterResource) params.set('resource', filterResource);
      if (filterAction) params.set('action', filterAction);
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo) params.set('to', filterTo);

      const res = await fetch(`${API}?${params}`, { headers: headers() });
      if (!res.ok) throw new Error('Error cargando logs');
      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [page, filterBusiness, filterResource, filterAction, filterFrom, filterTo]);

  const fetchBusinesses = useCallback(async () => {
    try {
      const res = await fetch(`${API}/businesses`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setBusinesses(data);
      }
    } catch { /* silent */ }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const params = filterBusiness ? `?businessId=${filterBusiness}` : '';
      const res = await fetch(`${API}/stats${params}`, { headers: headers() });
      if (res.ok) setStats(await res.json());
    } catch { /* silent */ }
  }, [filterBusiness]);

  useEffect(() => { fetchBusinesses(); }, [fetchBusinesses]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleRevert = async (logId) => {
    try {
      setReverting(logId);
      const res = await fetch(`${API}/${logId}/revert`, { method: 'POST', headers: headers() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al revertir');
      setFeedback({ type: 'success', text: data.message });
      setRevertConfirm(null);
      fetchLogs();
      fetchStats();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setReverting(null);
    }
  };

  const clearFilters = () => {
    setFilterBusiness('');
    setFilterResource('');
    setFilterAction('');
    setFilterFrom('');
    setFilterTo('');
    setPage(1);
  };

  const hasFilters = filterBusiness || filterResource || filterAction || filterFrom || filterTo;

  return (
    <div className="space-y-6">
      {/* Feedback toast */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg ${
              feedback.type === 'success' ? 'bg-emerald-500/90 text-slate-900 dark:text-white' : 'bg-red-500/90 text-slate-900 dark:text-white'
            }`}
            onClick={() => setFeedback(null)}
          >
            {feedback.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-slate-500 dark:text-white/40 text-xs uppercase tracking-wider">Total Logs</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.total.toLocaleString()}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-slate-500 dark:text-white/40 text-xs uppercase tracking-wider">Hoy</p>
            <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 mt-1">{stats.today}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-slate-500 dark:text-white/40 text-xs uppercase tracking-wider">Por Acción</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {stats.byAction?.map(a => (
                <span key={a._id} className={`text-xs px-2 py-0.5 rounded-full ${ACTION_LABELS[a._id]?.color || 'bg-white/10 text-slate-600 dark:text-white/60'}`}>
                  {ACTION_LABELS[a._id]?.label || a._id}: {a.count}
                </span>
              ))}
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-slate-500 dark:text-white/40 text-xs uppercase tracking-wider">Por Recurso</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {stats.byResource?.map(r => (
                <span key={r._id} className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-600 dark:text-white/50">
                  {RESOURCE_LABELS[r._id] || r._id}: {r.count}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <svg className="w-4 h-4 text-slate-500 dark:text-white/40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
          </svg>
          <span className="text-slate-600 dark:text-white/60 text-sm font-medium">Filtros</span>
          {hasFilters && (
            <button onClick={clearFilters} className="ml-auto text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-300 transition">
              Limpiar filtros
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <select
            value={filterBusiness}
            onChange={e => { setFilterBusiness(e.target.value); setPage(1); }}
            className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500/40 [&>option]:bg-white dark:[&>option]:bg-[#141419]"
          >
            <option value="">Todos los negocios</option>
            {businesses.map(b => (
              <option key={b.id} value={b.id}>{b.name} ({b.count})</option>
            ))}
          </select>
          <select
            value={filterResource}
            onChange={e => { setFilterResource(e.target.value); setPage(1); }}
            className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500/40 [&>option]:bg-white dark:[&>option]:bg-[#141419]"
          >
            <option value="">Todos los recursos</option>
            {Object.entries(RESOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select
            value={filterAction}
            onChange={e => { setFilterAction(e.target.value); setPage(1); }}
            className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500/40 [&>option]:bg-white dark:[&>option]:bg-[#141419]"
          >
            <option value="">Todas las acciones</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <input
            type="date"
            value={filterFrom}
            onChange={e => { setFilterFrom(e.target.value); setPage(1); }}
            className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500/40 [color-scheme:dark]"
            placeholder="Desde"
          />
          <input
            type="date"
            value={filterTo}
            onChange={e => { setFilterTo(e.target.value); setPage(1); }}
            className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500/40 [color-scheme:dark]"
            placeholder="Hasta"
          />
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-slate-500 dark:text-white/40 text-sm">{total} registro{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}</p>
        {totalPages > 1 && (
          <p className="text-slate-500 dark:text-white/30 text-xs">Página {page} de {totalPages}</p>
        )}
      </div>

      {/* Logs list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-12 h-12 text-slate-400 dark:text-white/20 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <p className="text-slate-500 dark:text-white/30 text-sm">No hay registros de auditoría</p>
          {hasFilters && <p className="text-slate-400 dark:text-white/20 text-xs mt-1">Intenta cambiar los filtros</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(log => {
            const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: 'bg-white/10 text-slate-600 dark:text-white/50', icon: '?' };
            const isExpanded = expandedId === log._id;
            return (
              <motion.div
                key={log._id}
                layout
                className={`bg-white/5 border rounded-xl overflow-hidden transition-colors ${
                  log.reverted ? 'border-yellow-500/30 opacity-60' : 'border-white/10 hover:border-white/20'
                }`}
              >
                {/* Row header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : log._id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                >
                  {/* Action badge */}
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${actionInfo.color}`}>
                    {actionInfo.icon} {actionInfo.label}
                  </span>

                  {/* Resource type */}
                  <span className="text-xs text-slate-500 dark:text-white/40 shrink-0 hidden sm:inline">
                    {RESOURCE_LABELS[log.resource] || log.resource}
                  </span>

                  {/* Resource name */}
                  <span className="text-sm text-slate-900 dark:text-white font-medium truncate">
                    {log.resourceName || log.resourceId}
                  </span>

                  {/* Business name */}
                  <span className="text-xs text-slate-500 dark:text-white/30 truncate hidden md:inline">
                    {log.businessName}
                  </span>

                  {/* Spacer */}
                  <span className="flex-1" />

                  {/* Reverted badge */}
                  {log.reverted && (
                    <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full shrink-0">
                      Revertido
                    </span>
                  )}

                  {/* User */}
                  <span className="text-xs text-slate-500 dark:text-white/30 shrink-0 hidden lg:inline">
                    {log.userEmail || 'desconocido'}
                  </span>

                  {/* Time */}
                  <span className="text-xs text-slate-400 dark:text-white/25 shrink-0 w-20 text-right">
                    {timeAgo(log.createdAt)}
                  </span>

                  {/* Chevron */}
                  <svg className={`w-4 h-4 text-slate-500 dark:text-white/30 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {/* Expanded detail */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3">
                        {/* Metadata */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-slate-500 dark:text-white/30">Fecha:</span>
                            <span className="text-slate-600 dark:text-white/60 ml-1">{formatDate(log.createdAt)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-white/30">Usuario:</span>
                            <span className="text-slate-600 dark:text-white/60 ml-1">{log.userEmail || '—'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-white/30">Rol:</span>
                            <span className="text-slate-600 dark:text-white/60 ml-1">{log.userRole || '—'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-white/30">IP:</span>
                            <span className="text-slate-600 dark:text-white/60 ml-1 font-mono">{log.ip || '—'}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-slate-500 dark:text-white/30">Resource ID:</span>
                            <span className="text-slate-600 dark:text-white/60 ml-1 font-mono text-[11px]">{log.resourceId}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-slate-500 dark:text-white/30">Negocio:</span>
                            <span className="text-slate-600 dark:text-white/60 ml-1">{log.businessName || '—'}</span>
                          </div>
                          {log.reverted && (
                            <>
                              <div>
                                <span className="text-slate-500 dark:text-white/30">Revertido por:</span>
                                <span className="text-yellow-400/70 ml-1">{log.revertedBy}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 dark:text-white/30">Fecha revert:</span>
                                <span className="text-yellow-400/70 ml-1">{log.revertedAt ? formatDate(log.revertedAt) : '—'}</span>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Diff view */}
                        <DiffView before={log.before} after={log.after} action={log.action} />

                        {/* Revert button */}
                        {!log.reverted && log.action !== 'reorder' && (
                          <div className="flex justify-end pt-2">
                            {revertConfirm === log._id ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-amber-600 dark:text-amber-400">Confirmar revert?</span>
                                <button
                                  onClick={() => handleRevert(log._id)}
                                  disabled={reverting === log._id}
                                  className="text-xs bg-red-200 dark:bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/30 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                                >
                                  {reverting === log._id ? 'Revirtiendo...' : 'Sí, revertir'}
                                </button>
                                <button
                                  onClick={() => setRevertConfirm(null)}
                                  className="text-xs text-slate-500 dark:text-white/40 hover:text-slate-600 dark:hover:text-slate-900 dark:hover:text-slate-600 dark:text-white/60 px-2 py-1.5 transition"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setRevertConfirm(log._id)}
                                className="text-xs bg-white/5 text-slate-600 dark:text-white/50 hover:bg-white/10 hover:text-slate-700 dark:hover:text-slate-900 dark:hover:text-slate-700 dark:text-white/70 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                                </svg>
                                Revertir
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-xs text-slate-600 dark:text-white/50 bg-white/5 rounded-lg hover:bg-white/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (page <= 3) {
              pageNum = i + 1;
            } else if (page >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = page - 2 + i;
            }
            return (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className={`w-8 h-8 text-xs rounded-lg transition ${
                  pageNum === page
                    ? 'bg-cyan-500/30 text-cyan-600 dark:text-cyan-400 font-medium'
                    : 'text-slate-500 dark:text-white/40 hover:bg-white/10'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-xs text-slate-600 dark:text-white/50 bg-white/5 rounded-lg hover:bg-white/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>
      )}

      {/* Revert confirmation modal */}
    </div>
  );
}
