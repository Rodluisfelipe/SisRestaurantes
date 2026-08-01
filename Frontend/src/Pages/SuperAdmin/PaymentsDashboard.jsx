import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { subscriptionApi } from '../../services/superadminApi';
import { SABadge, SATable } from '../../Components/SuperAdmin/ui';

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
            <div key={i} className="bg-white border border-slate-200 rounded-xl h-20 animate-pulse" />
          ))}
        </div>
        <div className="bg-white border border-slate-200 rounded-xl h-80 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Activos', value: kpis?.active || 0, color: 'text-emerald-600' },
          { label: 'En Gracia', value: kpis?.grace || 0, color: 'text-amber-600' },
          { label: 'Suspendidos', value: kpis?.suspended || 0, color: 'text-red-600' },
          { label: 'Churn 30d', value: kpis?.churn30d || 0, color: 'text-orange-600' },
          { label: 'MRR 30d', value: formatCurrency(kpis?.mrr30d || 0), color: 'text-cyan-600' },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
            className="bg-white border border-slate-200 rounded-xl p-4"
          >
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{kpi.label}</span>
            <p className={`text-2xl font-semibold mt-1 tabular-nums ${kpi.color}`}>{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Período</label>
          <select
            value={filters.range}
            onChange={e => handleFilterChange('range', e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm outline-none focus:border-cyan-500 transition-all [&>option]:bg-white"
          >
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="90d">Últimos 90 días</option>
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Estado</label>
          <select
            value={filters.status}
            onChange={e => handleFilterChange('status', e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm outline-none focus:border-cyan-500 transition-all [&>option]:bg-white"
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
            className="px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 text-sm hover:text-slate-900 hover:bg-slate-300 transition-all"
          >
            Actualizar
          </button>
        </div>
      </div>

      {/* Tabla — en móvil SATable la convierte en tarjetas apiladas, en vez
          del scroll lateral que había antes */}
      <SATable
        rowKey="slug"
        data={businesses}
        emptyMessage="No hay resultados. Ajusta los filtros."
        columns={[
          {
            key: 'name',
            label: 'Negocio',
            width: '1.6fr',
            primary: true,
            render: (b) => (
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{b.name}</p>
                <p className="text-[11px] text-slate-500 font-mono truncate">{b.slug}</p>
              </div>
            ),
          },
          {
            key: 'status',
            label: 'Estado',
            render: (b) => {
              const badge = getStatusBadge(b.status);
              return <SABadge variant={badge.variant} dot>{badge.text}</SABadge>;
            },
          },
          {
            key: 'plan',
            label: 'Plan',
            render: (b) => <span className="text-sm text-slate-600">{b.plan === 'annual' ? '👑 Anual' : '📅 Mensual'}</span>,
          },
          {
            key: 'periodEnd',
            label: 'Vence',
            render: (b) => (
              <span className="text-sm text-slate-500">
                {new Date(b.periodEnd).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            ),
          },
          {
            key: 'lastPayment',
            label: 'Último pago',
            render: (b) => (b.lastPayment ? (
              <div>
                <p className="text-sm text-slate-600 tabular-nums">{formatCurrency(b.lastPayment.amount)}</p>
                <p className="text-[11px] text-slate-400">{new Date(b.lastPayment.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</p>
              </div>
            ) : <span className="text-slate-400 text-sm">—</span>),
          },
        ]}
      />

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-900 bg-slate-100 border border-slate-200 disabled:opacity-30 transition-all"
          >
            ← Anterior
          </button>
          <span className="text-xs text-slate-500 tabular-nums">
            {pagination.page} / {pagination.totalPages}
          </span>
          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
            className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-900 bg-slate-100 border border-slate-200 disabled:opacity-30 transition-all"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
};

export default PaymentsDashboard;

