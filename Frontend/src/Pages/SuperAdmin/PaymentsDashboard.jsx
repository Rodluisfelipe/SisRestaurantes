import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaChartLine, FaExclamationTriangle, FaCheckCircle, FaTimesCircle, FaMoneyBillWave, FaUsers } from 'react-icons/fa';
import { subscriptionApi } from '../../services/superadminApi';

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
      'active': { color: 'green', icon: <FaCheckCircle />, text: 'Activo' },
      'past_due': { color: 'orange', icon: <FaExclamationTriangle />, text: 'Vencido' },
      'grace': { color: 'yellow', icon: <FaExclamationTriangle />, text: 'En Gracia' },
      'suspended': { color: 'red', icon: <FaTimesCircle />, text: 'Suspendido' },
      'canceled': { color: 'gray', icon: <FaTimesCircle />, text: 'Cancelado' }
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
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="bg-gray-200 rounded-lg h-24"></div>
            ))}
          </div>
          <div className="bg-gray-200 rounded-lg h-96"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center">
          <FaMoneyBillWave className="mr-3 text-blue-600" />
          Dashboard de Pagos y Suscripciones
        </h1>
        <p className="text-gray-600">Vista global de todos los negocios y su estado de suscripción</p>
      </div>

      {/* KPIs Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <KPICard 
          label="Activos" 
          value={kpis?.active || 0} 
          icon={<FaCheckCircle />}
          color="green" 
        />
        <KPICard 
          label="En Gracia" 
          value={kpis?.grace || 0} 
          icon={<FaExclamationTriangle />}
          color="yellow" 
        />
        <KPICard 
          label="Suspendidos" 
          value={kpis?.suspended || 0} 
          icon={<FaTimesCircle />}
          color="red" 
        />
        <KPICard 
          label="Churn 30d" 
          value={kpis?.churn30d || 0} 
          icon={<FaUsers />}
          color="orange" 
        />
        <KPICard 
          label="MRR 30d" 
          value={formatCurrency(kpis?.mrr30d || 0)} 
          icon={<FaChartLine />}
          color="blue" 
        />
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-lg p-4 flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
          <select 
            value={filters.range} 
            onChange={e => handleFilterChange('range', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="90d">Últimos 90 días</option>
          </select>
        </div>
        
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
          <select 
            value={filters.status} 
            onChange={e => handleFilterChange('status', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Todos los estados</option>
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
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            🔄 Actualizar
          </button>
        </div>
      </div>

      {/* Tabla */}
      <PaymentsTable 
        businesses={businesses} 
        getStatusBadge={getStatusBadge}
        formatCurrency={formatCurrency}
      />

      {/* Paginación */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2">
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="px-4 py-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Anterior
          </button>
          
          <span className="px-4 py-2 text-gray-700">
            Página {pagination.page} de {pagination.totalPages}
          </span>
          
          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
            className="px-4 py-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
};

const KPICard = ({ label, value, icon, color }) => {
  const colors = {
    green: 'from-green-500 to-emerald-600',
    yellow: 'from-yellow-500 to-orange-500',
    red: 'from-red-500 to-pink-600',
    orange: 'from-orange-500 to-red-600',
    blue: 'from-blue-500 to-indigo-600'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gradient-to-br ${colors[color]} rounded-xl shadow-lg p-6 text-white`}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium opacity-90">{label}</h3>
        <div className="text-2xl">{icon}</div>
      </div>
      <p className="text-3xl font-bold">{value}</p>
    </motion.div>
  );
};

const PaymentsTable = ({ businesses, getStatusBadge, formatCurrency }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-white rounded-lg shadow-lg overflow-hidden"
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Negocio
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Plan
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Vence
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Último pago
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {businesses.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center">
                    <div className="text-6xl mb-4">📋</div>
                    <p className="text-gray-600 font-medium">No hay resultados</p>
                    <p className="text-gray-500 text-sm mt-1">Ajusta los filtros para ver más resultados</p>
                  </div>
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
                    transition={{ delay: idx * 0.05 }}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="font-semibold text-gray-800">{business.name}</p>
                        <p className="text-xs text-gray-500">{business.slug}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-${badge.color}-100 text-${badge.color}-800`}>
                        {badge.icon}
                        <span className="ml-2">{badge.text}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      <span className="flex items-center">
                        <span className="mr-2">{business.plan === 'annual' ? '👑' : '📅'}</span>
                        {business.plan === 'annual' ? 'Anual' : 'Mensual'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600 text-sm">
                      {new Date(business.periodEnd).toLocaleDateString('es-CO', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {business.lastPayment ? (
                        <div>
                          <p className="text-sm text-gray-800">
                            {formatCurrency(business.lastPayment.amount)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(business.lastPayment.date).toLocaleDateString('es-CO', {
                              day: '2-digit',
                              month: 'short'
                            })}
                          </p>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default PaymentsDashboard;

