import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { subscriptionApi } from '../../services/superadminApi';
import { SABadge } from '../../Components/SuperAdmin/ui';

const PaymentsDashboard = () => {
  const [kpis, setKpis] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    range: '30d',
    status: 'all',
    page: 1,
    limit: 20
  });
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    try {
      const params = new URLSearchParams({
        range: filters.range,
        status: filters.status,
        page: filters.page,
        limit: filters.limit
      }).toString();
      
      const res = await subscriptionApi.get(`/admin/subscriptions/overview?${params}`);
      
      if (res.data.success) {
        setKpis(res.data.kpis);
        setBusinesses(res.data.businesses);
        setPagination(res.data.pagination);
      }
    } catch (error) {
      console.error('Error loading payments data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // Reset to first page on filter change
    }));
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({
      ...prev,
      page: newPage
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getStatusBadge = (status) => {
    const badges = {
      'active': { variant: 'success', text: 'Activo' },
      'past_due': { variant: 'warning', text: 'Vencido' },
      'grace': { variant: 'warning', text: 'En Gracia' },
      'suspended': { variant: 'danger', text: 'Suspendido' },
      'canceled': { variant: 'neutral', text: 'Cancelado' }
    };
    return badges[status] || badges.canceled;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-xl h-20 animate-pulse" />
          ))}
        </div>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl h-80 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Activos', value: kpis?.active || 0, color: 'text-emerald-400' },
          { label: 'En Gracia', value: kpis?.grace || 0, color: 'text-amber-400' },
          { label: 'Suspendidos', value: kpis?.suspended || 0, color: 'text-red-400' },
          { label: 'Churn 30d', value: kpis?.churn30d || 0, color: 'text-orange-400' },
          { label: 'MRR 30d', value: formatCurrency(kpis?.mrr30d || 0), color: 'text-cyan-400' },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
            className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4"
          >
            <span className="text-[11px] font-medium text-white/35 uppercase tracking-wider">{kpi.label}</span>
            <p className={`text-2xl font-semibold mt-1 tabular-nums ${kpi.color}`}>{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-[11px] font-medium text-white/35 uppercase tracking-wider mb-1.5">Período</label>
          <select
            value={filters.range}
            onChange={e => handleFilterChange('range', e.target.value)}
            className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white text-sm outline-none focus:border-cyan-500/40 transition-all [&>option]:bg-[#141419]"
          >
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="90d">Últimos 90 días</option>
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-[11px] font-medium text-white/35 uppercase tracking-wider mb-1.5">Estado</label>
          <select
            value={filters.status}
            onChange={e => handleFilterChange('status', e.target.value)}
            className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white text-sm outline-none focus:border-cyan-500/40 transition-all [&>option]:bg-[#141419]"
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="past_due">Vencidos</option>
            <option value="grace">En gracia</option>
            <option value="suspended">Suspendidos</option>
            <option value="canceled">Cancelados</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={loadData}
            className="px-4 py-2.5 bg-white/[0.06] border border-white/[0.08] rounded-lg text-white/60 text-sm hover:text-white hover:bg-white/[0.1] transition-all"
          >
            Actualizar
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left py-3 px-4 text-[11px] font-medium text-white/30 uppercase tracking-wider">Negocio</th>
                <th className="text-left py-3 px-4 text-[11px] font-medium text-white/30 uppercase tracking-wider">Estado</th>
                <th className="text-left py-3 px-4 text-[11px] font-medium text-white/30 uppercase tracking-wider">Plan</th>
                <th className="text-left py-3 px-4 text-[11px] font-medium text-white/30 uppercase tracking-wider">Vence</th>
                <th className="text-left py-3 px-4 text-[11px] font-medium text-white/30 uppercase tracking-wider">Último pago</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {businesses.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-12 text-center">
                    <p className="text-sm text-white/30">No hay resultados</p>
                    <p className="text-xs text-white/20 mt-1">Ajusta los filtros</p>
                  </td>
                </tr>
              ) : (
                businesses.map((business, idx) => {
                  const badge = getStatusBadge(business.status);
                  return (
                    <motion.tr
                      key={idx}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.03 }}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-white">{business.name}</p>
                        <p className="text-[11px] text-white/30 font-mono">{business.slug}</p>
                      </td>
                      <td className="px-4 py-3">
                        <SABadge variant={badge.variant} dot>{badge.text}</SABadge>
                      </td>
                      <td className="px-4 py-3 text-sm text-white/50">
                        {business.plan === 'annual' ? '👑 Anual' : '📅 Mensual'}
                      </td>
                      <td className="px-4 py-3 text-sm text-white/40">
                        {new Date(business.periodEnd).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        {business.lastPayment ? (
                          <div>
                            <p className="text-sm text-white/60">{formatCurrency(business.lastPayment.amount)}</p>
                            <p className="text-[11px] text-white/25">{new Date(business.lastPayment.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</p>
                          </div>
                        ) : (
                          <span className="text-white/20 text-sm">—</span>
                        )}
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white bg-white/[0.04] border border-white/[0.06] disabled:opacity-30 transition-all"
          >
            ← Anterior
          </button>
          <span className="text-xs text-white/30 tabular-nums">
            {pagination.page} / {pagination.totalPages}
          </span>
          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
            className="px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white bg-white/[0.04] border border-white/[0.06] disabled:opacity-30 transition-all"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
};

export default PaymentsDashboard;

