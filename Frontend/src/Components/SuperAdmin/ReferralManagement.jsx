import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { subscriptionApi as adminApi } from '../../services/superadminApi';

const STATUS_LABELS = {
  pending: 'Pendiente',
  qualified: 'Calificado',
  approved: 'Aprobado',
  credited: 'Acreditado',
  rejected: 'Rechazado',
};

const STATUS_COLORS = {
  pending: 'bg-yellow-100/80 text-yellow-300 border-yellow-500/20',
  qualified: 'bg-blue-100/80 text-blue-300 border-blue-500/20',
  approved: 'bg-indigo-100/80 text-indigo-300 border-indigo-500/20',
  credited: 'bg-emerald-100/80 text-emerald-300 border-emerald-500/20',
  rejected: 'bg-red-100/80 text-red-300 border-red-500/20',
};

function formatCurrency(amount) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount || 0);
}

function formatDate(date) {
  if (!date) return 'â€”';
  return new Date(date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ReferralManagement() {
  const [tab, setTab] = useState('overview'); // overview | config | top
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // Config
  const [config, setConfig] = useState(null);
  const [configDraft, setConfigDraft] = useState(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState('');

  // Overview
  const [referrals, setReferrals] = useState([]);
  const [kpis, setKpis] = useState({});
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [statusFilter, setStatusFilter] = useState('all');

  // Top referrers
  const [topReferrers, setTopReferrers] = useState([]);

  // Reject modal
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchConfig = useCallback(async () => {
    try {
      const { data } = await adminApi.get('/admin/referrals/config');
      if (data.success) {
        setConfig(data.config);
        setConfigDraft(data.config);
      }
    } catch { /* silent */ }
  }, []);

  const fetchOverview = useCallback(async (page = 1, status = 'all') => {
    try {
      const params = { page, limit: 15 };
      if (status !== 'all') params.status = status;
      const { data } = await adminApi.get('/admin/referrals/overview', { params });
      if (data.success) {
        setReferrals(data.referrals);
        setKpis(data.kpis);
        setPagination(data.pagination);
      }
    } catch { /* silent */ }
  }, []);

  const fetchTop = useCallback(async () => {
    try {
      const { data } = await adminApi.get('/admin/referrals/top-referrers');
      if (data.success) setTopReferrers(data.topReferrers);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchConfig(), fetchOverview(), fetchTop()]);
      setLoading(false);
    };
    load();
  }, [fetchConfig, fetchOverview, fetchTop]);

  const saveConfig = async () => {
    setConfigSaving(true);
    setConfigMsg('');
    try {
      const { data } = await adminApi.put('/admin/referrals/config', configDraft);
      if (data.success) {
        setConfig(data.config);
        setConfigDraft(data.config);
        setConfigMsg('ConfiguraciÃ³n guardada');
        setTimeout(() => setConfigMsg(''), 3000);
      }
    } catch (err) {
      setConfigMsg(err.response?.data?.message || 'Error al guardar');
    } finally {
      setConfigSaving(false);
    }
  };

  const handleApprove = async (id) => {
    setActionLoading(id);
    try {
      await adminApi.patch(`/admin/referrals/${id}/approve`);
      await fetchOverview(pagination.page, statusFilter);
    } catch { /* silent */ }
    setActionLoading(null);
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setActionLoading(rejectModal);
    try {
      await adminApi.patch(`/admin/referrals/${rejectModal}/reject`, { reason: rejectReason });
      await fetchOverview(pagination.page, statusFilter);
    } catch { /* silent */ }
    setActionLoading(null);
    setRejectModal(null);
    setRejectReason('');
  };

  const handleFilterChange = (status) => {
    setStatusFilter(status);
    fetchOverview(1, status);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-white/10 border-t-blue-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: kpis.total || 0, color: 'text-white' },
          { label: 'Pendientes', value: kpis.pending || 0, color: 'text-yellow-400' },
          { label: 'Calificados', value: kpis.qualified || 0, color: 'text-blue-400' },
          { label: 'Acreditados', value: kpis.credited || 0, color: 'text-emerald-400' },
          { label: 'Rechazados', value: kpis.rejected || 0, color: 'text-red-400' },
          { label: 'ConversiÃ³n', value: `${kpis.conversionRate || 0}%`, color: 'text-indigo-400' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
            <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-[10px] text-white/30 uppercase tracking-wider mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: 'overview', label: 'Referidos' },
          { id: 'config', label: 'ConfiguraciÃ³n' },
          { id: 'top', label: 'Top Referentes' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                : 'text-white/40 hover:text-white/60 border border-transparent'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {/* Status filter */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {['all', 'pending', 'qualified', 'credited', 'rejected'].map(s => (
                <button
                  key={s}
                  onClick={() => handleFilterChange(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    statusFilter === s
                      ? 'bg-white/10 text-white border border-white/20'
                      : 'text-white/30 hover:text-white/50 border border-transparent'
                  }`}
                >
                  {s === 'all' ? 'Todos' : STATUS_LABELS[s]}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
              {referrals.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-white/30">No hay referidos {statusFilter !== 'all' ? `con estado "${STATUS_LABELS[statusFilter]}"` : ''}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left px-4 py-3 text-[11px] text-white/30 uppercase tracking-wider font-semibold">Referente</th>
                        <th className="text-left px-4 py-3 text-[11px] text-white/30 uppercase tracking-wider font-semibold">Referido</th>
                        <th className="text-left px-4 py-3 text-[11px] text-white/30 uppercase tracking-wider font-semibold">Estado</th>
                        <th className="text-left px-4 py-3 text-[11px] text-white/30 uppercase tracking-wider font-semibold">CrÃ©ditos</th>
                        <th className="text-left px-4 py-3 text-[11px] text-white/30 uppercase tracking-wider font-semibold">Fecha</th>
                        <th className="text-right px-4 py-3 text-[11px] text-white/30 uppercase tracking-wider font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {referrals.map(r => (
                        <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-white/80 font-medium truncate max-w-[140px]">{r.referrer?.name || 'â€”'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-white/80 font-medium truncate max-w-[140px]">{r.referred?.name || 'â€”'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${STATUS_COLORS[r.status] || 'text-white/40'}`}>
                              {STATUS_LABELS[r.status] || r.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-white/60">
                            {r.referrerCreditsAwarded > 0 ? formatCurrency(r.referrerCreditsAwarded) : 'â€”'}
                          </td>
                          <td className="px-4 py-3 text-white/40 text-xs">{formatDate(r.createdAt)}</td>
                          <td className="px-4 py-3 text-right">
                            {['pending', 'qualified'].includes(r.status) && (
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => handleApprove(r.id)}
                                  disabled={actionLoading === r.id}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20 transition-all disabled:opacity-50"
                                >
                                  {actionLoading === r.id ? '...' : 'Aprobar'}
                                </button>
                                <button
                                  onClick={() => setRejectModal(r.id)}
                                  disabled={actionLoading === r.id}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20 transition-all disabled:opacity-50"
                                >
                                  Rechazar
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
                  <p className="text-xs text-white/30">PÃ¡gina {pagination.page} de {pagination.totalPages}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchOverview(pagination.page - 1, statusFilter)}
                      disabled={pagination.page <= 1}
                      className="px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 bg-white/[0.04] disabled:opacity-30 transition-all"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => fetchOverview(pagination.page + 1, statusFilter)}
                      disabled={pagination.page >= pagination.totalPages}
                      className="px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 bg-white/[0.04] disabled:opacity-30 transition-all"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* CONFIG TAB */}
        {tab === 'config' && configDraft && (
          <motion.div key="config" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-5 max-w-xl">
              {/* Toggle active */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white/80">Programa activo</p>
                  <p className="text-xs text-white/30">Habilitar o deshabilitar el programa de referidos</p>
                </div>
                <button
                  onClick={() => setConfigDraft(d => ({ ...d, isActive: !d.isActive }))}
                  className={`w-12 h-7 rounded-full transition-colors relative ${configDraft.isActive ? 'bg-emerald-500' : 'bg-white/10'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow absolute top-1 transition-transform ${configDraft.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* Require approval */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white/80">Requerir aprobaciÃ³n</p>
                  <p className="text-xs text-white/30">Los crÃ©ditos se otorgan solo tras aprobaciÃ³n manual</p>
                </div>
                <button
                  onClick={() => setConfigDraft(d => ({ ...d, requireApproval: !d.requireApproval }))}
                  className={`w-12 h-7 rounded-full transition-colors relative ${configDraft.requireApproval ? 'bg-blue-500' : 'bg-white/10'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow absolute top-1 transition-transform ${configDraft.requireApproval ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* Number fields */}
              {[
                { key: 'referrerDiscountPercent', label: '% descuento referente', min: 1, max: 50 },
                { key: 'referredDiscountPercent', label: '% descuento referido', min: 1, max: 50 },
                { key: 'maxCreditsPerBusiness', label: 'MÃ¡x crÃ©ditos por negocio', min: 0, max: 10000000, step: 10000 },
                { key: 'maxReferralsPerBusiness', label: 'MÃ¡x referidos por negocio', min: 1, max: 1000 },
                { key: 'minSubscriptionMonths', label: 'MÃ­n meses suscripciÃ³n', min: 1, max: 24 },
              ].map(field => (
                <div key={field.key}>
                  <label className="text-sm font-medium text-white/80 block mb-1">{field.label}</label>
                  <input
                    type="number"
                    value={configDraft[field.key] ?? ''}
                    onChange={(e) => setConfigDraft(d => ({ ...d, [field.key]: Number(e.target.value) }))}
                    min={field.min}
                    max={field.max}
                    step={field.step || 1}
                    className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.1] rounded-lg text-white/80 text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 outline-none"
                  />
                </div>
              ))}

              {/* Save */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={saveConfig}
                  disabled={configSaving}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-50"
                >
                  {configSaving ? 'Guardando...' : 'Guardar configuraciÃ³n'}
                </button>
                {configMsg && (
                  <motion.p
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`text-sm font-medium ${configMsg.includes('Error') ? 'text-red-400' : 'text-emerald-400'}`}
                  >
                    {configMsg}
                  </motion.p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* TOP REFERRERS TAB */}
        {tab === 'top' && (
          <motion.div key="top" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
              {topReferrers.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-white/30">No hay referentes acreditados aÃºn</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left px-4 py-3 text-[11px] text-white/30 uppercase tracking-wider font-semibold">#</th>
                      <th className="text-left px-4 py-3 text-[11px] text-white/30 uppercase tracking-wider font-semibold">Negocio</th>
                      <th className="text-left px-4 py-3 text-[11px] text-white/30 uppercase tracking-wider font-semibold">Referidos</th>
                      <th className="text-left px-4 py-3 text-[11px] text-white/30 uppercase tracking-wider font-semibold">CrÃ©ditos ganados</th>
                      <th className="text-left px-4 py-3 text-[11px] text-white/30 uppercase tracking-wider font-semibold">Saldo actual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {topReferrers.map((r, i) => (
                      <tr key={r.businessId} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold ${
                            i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                            i === 1 ? 'bg-slate-400/20 text-slate-300' :
                            i === 2 ? 'bg-orange-500/20 text-orange-400' :
                            'bg-white/5 text-white/30'
                          }`}>{i + 1}</span>
                        </td>
                        <td className="px-4 py-3 text-white/80 font-medium">{r.businessName || 'â€”'}</td>
                        <td className="px-4 py-3 text-white/60">{r.totalReferrals}</td>
                        <td className="px-4 py-3 text-emerald-400 font-medium">{formatCurrency(r.totalCredits)}</td>
                        <td className="px-4 py-3 text-blue-400">{formatCurrency(r.currentCredits)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reject Modal */}
      <AnimatePresence>
        {rejectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setRejectModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-4"
            >
              <h3 className="text-lg font-bold text-white">Rechazar referido</h3>
              <div>
                <label className="text-sm text-white/60 block mb-1">RazÃ³n (opcional)</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.1] rounded-lg text-white/80 text-sm resize-none focus:ring-2 focus:ring-red-500/30 outline-none"
                  placeholder="Motivo del rechazo..."
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setRejectModal(null); setRejectReason(''); }}
                  className="px-4 py-2 rounded-lg text-sm text-white/40 hover:text-white/60 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleReject}
                  disabled={actionLoading === rejectModal}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
                >
                  {actionLoading === rejectModal ? 'Rechazando...' : 'Rechazar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
