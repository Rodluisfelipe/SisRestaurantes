import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';

const STATUS_LABELS = {
  pending: 'Pendiente',
  qualified: 'Calificado',
  approved: 'Aprobado',
  credited: 'Acreditado',
  rejected: 'Rechazado',
};

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  qualified: 'bg-blue-100 text-blue-700',
  approved: 'bg-indigo-100 text-indigo-700',
  credited: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};

function formatCurrency(amount) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ReferralsPanel({ businessId }) {
  const [tab, setTab] = useState('share'); // 'share' | 'referrals' | 'credits'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Data
  const [codeData, setCodeData] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [stats, setStats] = useState({});
  const [credits, setCredits] = useState({ credits: 0, history: [] });
  const [copied, setCopied] = useState(false);
  const [programInactive, setProgramInactive] = useState(false);

  const fetchCode = useCallback(async () => {
    try {
      const { data } = await api.get(`/referrals/my-code?businessId=${businessId}`);
      if (data.success) setCodeData(data);
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.message?.includes('no está activo')) {
        setProgramInactive(true);
      } else {
        setError(err.response?.data?.message || 'Error al cargar datos');
      }
    }
  }, [businessId]);

  const fetchReferrals = useCallback(async () => {
    try {
      const { data } = await api.get(`/referrals/my-referrals?businessId=${businessId}`);
      if (data.success) {
        setReferrals(data.referrals);
        setStats(data.stats);
      }
    } catch { /* silent */ }
  }, [businessId]);

  const fetchCredits = useCallback(async () => {
    try {
      const { data } = await api.get(`/referrals/my-credits?businessId=${businessId}`);
      if (data.success) setCredits(data);
    } catch { /* silent */ }
  }, [businessId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchCode(), fetchReferrals(), fetchCredits()]);
      setLoading(false);
    };
    load();
  }, [fetchCode, fetchReferrals, fetchCredits]);

  const copyCode = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback ignored */ }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (programInactive) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 px-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">Programa no disponible</h3>
        <p className="text-sm text-slate-500">El programa de referidos no está activo en este momento.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 px-6">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  const tabs = [
    { id: 'share', label: 'Compartir', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
      </svg>
    )},
    { id: 'referrals', label: 'Referidos', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    )},
    { id: 'credits', label: 'Créditos', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )},
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg lg:text-xl font-bold text-slate-800">Programa de Referidos</h2>
        <p className="hidden lg:block text-sm text-slate-500 mt-1">Invita otros negocios y gana créditos para tu suscripción</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl lg:rounded-xl border border-slate-100 lg:border-slate-100 p-4 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-sm">
          <p className="text-[20px] lg:text-2xl font-bold text-slate-800">{stats.totalReferred || codeData?.referralCount || 0}</p>
          <p className="text-[11px] lg:text-xs text-slate-400 mt-1">Referidos</p>
        </div>
        <div className="bg-white rounded-2xl lg:rounded-xl border border-slate-100 lg:border-slate-100 p-4 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-sm">
          <p className="text-[20px] lg:text-2xl font-bold text-emerald-600">{stats.totalCredited || 0}</p>
          <p className="text-[11px] lg:text-xs text-slate-400 mt-1">Acreditados</p>
        </div>
        <div className="bg-white rounded-2xl lg:rounded-xl border border-slate-100 lg:border-slate-100 p-4 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-sm">
          <p className="text-[20px] lg:text-2xl font-bold text-blue-600">{formatCurrency(credits.credits || 0)}</p>
          <p className="text-[11px] lg:text-xs text-slate-400 mt-1">Créditos</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100/80 lg:bg-slate-100 rounded-xl p-[3px] lg:p-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all active:scale-[0.97] lg:active:scale-100 ${
              tab === t.id
                ? 'bg-white text-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {tab === 'share' && codeData && (
          <motion.div key="share" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Code Display */}
              <div className="p-6 text-center border-b border-slate-100">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-3">Tu código de referido</p>
                <div className="inline-flex items-center gap-3 bg-slate-50 rounded-xl px-6 py-3 border border-slate-200">
                  <span className="text-2xl font-mono font-bold text-slate-800 tracking-[0.15em]">{codeData.referralCode}</span>
                  <button
                    onClick={() => copyCode(codeData.referralCode)}
                    className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                    title="Copiar código"
                  >
                    {copied ? (
                      <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Share Link */}
              <div className="p-6">
                <p className="text-xs text-slate-400 font-medium mb-2">Enlace de invitación</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200 overflow-hidden">
                    <p className="text-sm text-slate-600 truncate font-mono">{codeData.shareUrl}</p>
                  </div>
                  <button
                    onClick={() => copyCode(codeData.shareUrl)}
                    className="shrink-0 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    {copied ? '¡Copiado!' : 'Copiar'}
                  </button>
                </div>

                {/* Benefits info */}
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                    <p className="text-xs text-emerald-600 font-semibold">Tú ganas</p>
                    <p className="text-lg font-bold text-emerald-700">{codeData.config.referrerDiscountPercent}%</p>
                    <p className="text-xs text-emerald-500">de su primer pago en créditos</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                    <p className="text-xs text-blue-600 font-semibold">Tu referido gana</p>
                    <p className="text-lg font-bold text-blue-700">{codeData.config.referredDiscountPercent}%</p>
                    <p className="text-xs text-blue-500">de descuento en su primer pago</p>
                  </div>
                </div>

                <p className="text-xs text-slate-400 mt-4 text-center">
                  Máximo {codeData.maxReferrals} referidos por negocio
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {tab === 'referrals' && (
          <motion.div key="referrals" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {referrals.length === 0 ? (
                <div className="text-center py-12 px-6">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-700">Sin referidos aún</p>
                  <p className="text-xs text-slate-400 mt-1">Comparte tu código para empezar a ganar créditos</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {referrals.map(r => (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016A3.001 3.001 0 0021 9.349m-18 0V3.25A2.25 2.25 0 015.25 1h13.5A2.25 2.25 0 0121 3.25v6.1" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">{r.referredBusiness?.name || 'Negocio'}</p>
                        <p className="text-xs text-slate-400">{formatDate(r.createdAt)}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[r.status] || 'bg-slate-100 text-slate-500'}`}>
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                      {r.creditsAwarded > 0 && (
                        <span className="text-xs font-bold text-emerald-600">+{formatCurrency(r.creditsAwarded)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {tab === 'credits' && (
          <motion.div key="credits" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Balance */}
              <div className="p-6 text-center bg-gradient-to-br from-emerald-50 to-teal-50 border-b border-emerald-100">
                <p className="text-xs text-emerald-500 font-semibold uppercase tracking-wider mb-1">Saldo disponible</p>
                <p className="text-3xl font-bold text-emerald-700">{formatCurrency(credits.credits || 0)}</p>
                <p className="text-xs text-emerald-400 mt-2">Se aplica automáticamente al renovar suscripción</p>
              </div>

              {/* History */}
              {credits.history?.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  <div className="px-4 py-2 bg-slate-50">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Historial de créditos</p>
                  </div>
                  {credits.history.map((h, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{h.referredBusiness}</p>
                        <p className="text-xs text-slate-400">{formatDate(h.date)}</p>
                      </div>
                      <span className="text-sm font-bold text-emerald-600">+{formatCurrency(h.amount)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 px-6">
                  <p className="text-sm text-slate-400">Aún no tienes créditos. ¡Comparte tu código!</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
