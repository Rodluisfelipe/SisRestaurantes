import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaCrown, FaCalendarAlt, FaExclamationTriangle, FaArrowRight, FaClock } from 'react-icons/fa';

/**
 * Componente de presentacion puro.
 * Recibe toda la data de suscripcion via props (de useSubscriptionData).
 * NO hace API calls, NO registra socket listeners, NO corre timers propios.
 */

/* ── Plan tier config ── */
const PLAN_TIERS = {
  monthly: {
    label: 'Mensual',
    shortLabel: 'MES',
    tier: 1,
    bg: 'bg-slate-50',
    border: 'border-slate-200/80',
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-500',
    textColor: 'text-slate-700',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-600',
    daysBg: 'text-slate-500',
    gradient: null,
  },
  quarterly: {
    label: 'Trimestral',
    shortLabel: 'TRI',
    tier: 2,
    bg: 'bg-sky-50/80',
    border: 'border-sky-200/70',
    iconBg: 'bg-gradient-to-br from-sky-100 to-blue-100',
    iconColor: 'text-sky-600',
    textColor: 'text-sky-800',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-700',
    daysBg: 'text-sky-600',
    gradient: null,
  },
  semiannual: {
    label: 'Semestral',
    shortLabel: 'SEM',
    tier: 3,
    bg: 'bg-amber-50/70',
    border: 'border-amber-300/60',
    iconBg: 'bg-gradient-to-br from-amber-100 to-yellow-100',
    iconColor: 'text-amber-600',
    textColor: 'text-amber-800',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    daysBg: 'text-amber-600',
    gradient: 'from-amber-400/10 via-yellow-300/5 to-transparent',
  },
  annual: {
    label: 'Anual',
    shortLabel: 'PRO',
    tier: 4,
    bg: 'bg-violet-50/60',
    border: 'border-violet-300/50',
    iconBg: 'bg-gradient-to-br from-violet-200 to-purple-200',
    iconColor: 'text-violet-600',
    textColor: 'text-violet-900',
    badgeBg: 'bg-gradient-to-r from-violet-100 to-purple-100',
    badgeText: 'text-violet-700',
    daysBg: 'text-violet-600',
    gradient: 'from-violet-400/10 via-purple-300/5 to-transparent',
  },
};

const getTier = (planType) => PLAN_TIERS[planType] || PLAN_TIERS.monthly;

/* ── Inline SVG icons per tier ── */
const TierIcon = ({ planType, className = '' }) => {
  const t = planType;
  if (t === 'annual') {
    // Crown
    return (
      <svg className={className} viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 2l2.5 4 4.5-1.5-2 5L16 16H4l1-6.5-2-5L7.5 6z" />
      </svg>
    );
  }
  if (t === 'semiannual') {
    // Shield with star
    return (
      <svg className={className} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 1L3 4v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V4l-7-3zm0 7.5l1.1 2.2 2.4.4-1.7 1.7.4 2.4L10 13.9l-2.2 1.3.4-2.4-1.7-1.7 2.4-.4L10 8.5z" clipRule="evenodd" />
      </svg>
    );
  }
  if (t === 'quarterly') {
    // Diamond
    return (
      <svg className={className} viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 1L5 7l5 12 5-12-5-6zM6.5 7L10 2.5 13.5 7 10 17 6.5 7z" />
        <path d="M10 2.5L6.5 7h7L10 2.5z" opacity="0.5" />
      </svg>
    );
  }
  // Monthly — calendar
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
    </svg>
  );
};
const SubscriptionStatus = ({
  subscription,
  loading,
  error,
  timeRemaining,
  graceUntilDate,
  currentStatus,
  isActive,
  isInGracePeriod,
  isExpired,
  onNavigateToSubscription,
  compact = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const getPlanText = (planType) => {
    const tier = getTier(planType);
    return `Plan ${tier.label}`;
  };

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

  const formatDateTime = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (status, grace) => {
    if (grace) return 'text-yellow-600';
    if (status === 'active') return 'text-emerald-600';
    if (status === 'expired') return 'text-red-600';
    return 'text-slate-500';
  };

  const getStatusText = (status, grace) => {
    if (grace) return 'Periodo de Gracia';
    if (status === 'active') return 'Activo';
    if (status === 'expired') return 'Expirado';
    return 'Inactivo';
  };

  const handleNavigate = () => {
    if (onNavigateToSubscription) {
      onNavigateToSubscription();
    } else if (location.pathname.includes('/admin')) {
      window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'subscription' }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/admin');
    }
  };

  if (loading) {
    if (compact) return null;
    return (
      <div className="rounded-xl p-3 border border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-300 border-t-slate-600" />
          <span className="text-xs text-slate-500">Cargando suscripcion...</span>
        </div>
      </div>
    );
  }

  if (error) {
    if (compact) return null;
    return (
      <div className="rounded-xl p-3 border border-red-200 bg-red-50">
        <div className="flex items-center gap-2">
          <FaExclamationTriangle className="text-red-400 text-xs" />
          <span className="text-xs text-red-600">{error}</span>
        </div>
      </div>
    );
  }

  if (!subscription) {
    if (compact) return null;
    return (
      <div className="rounded-xl p-3 border border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <FaCalendarAlt className="text-slate-400 text-xs" />
          <div>
            <p className="text-xs font-semibold text-slate-700">Sin Suscripcion Activa</p>
            <p className="text-[11px] text-slate-500">Contacta al administrador para activar tu plan</p>
          </div>
        </div>
      </div>
    );
  }

  if (compact && !isActive) return null;
  if (!compact && isActive) return null;

  let graceDaysRemaining = 0;
  const now = new Date();
  const periodEnd = subscription.periodEnd ? new Date(subscription.periodEnd) : null;
  const graceUntil = subscription.graceUntil || subscription.gracePeriodEnd
    ? new Date(subscription.graceUntil || subscription.gracePeriodEnd)
    : null;

  if (graceUntil) {
    const nowN = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const graceN = new Date(graceUntil.getFullYear(), graceUntil.getMonth(), graceUntil.getDate());
    graceDaysRemaining = Math.max(0, Math.floor((graceN - nowN) / 86400000));
  } else if (periodEnd && isInGracePeriod) {
    const calc = new Date(periodEnd);
    calc.setDate(calc.getDate() + 5);
    const nowN = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const graceN = new Date(calc.getFullYear(), calc.getMonth(), calc.getDate());
    graceDaysRemaining = Math.max(0, Math.floor((graceN - nowN) / 86400000));
  } else if (subscription.graceDaysRemaining != null) {
    graceDaysRemaining = subscription.graceDaysRemaining;
  }

  if (compact) {
    const tier = getTier(subscription.planType);
    const isHighTier = tier.tier >= 3;
    const isAnnual = tier.tier === 4;

    /* ── ANNUAL: Premium animated card ── */
    if (isAnnual) {
      return (
        <button
          onClick={handleNavigate}
          className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-br from-violet-950/90 via-purple-900/80 to-indigo-950/90 border border-violet-400/20 transition-all duration-500 hover:border-violet-400/50 hover:shadow-[0_0_20px_rgba(139,92,246,0.15),0_0_40px_rgba(139,92,246,0.05)] active:scale-[0.97]"
        >
          {/* Animated background glow orbs — intensify on hover */}
          <div className="absolute -top-6 -right-6 w-20 h-20 bg-violet-500/20 rounded-full animate-premium-glow pointer-events-none transition-all duration-500 group-hover:bg-violet-500/35 group-hover:w-24 group-hover:h-24" />
          <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-purple-500/15 rounded-full animate-premium-glow pointer-events-none transition-all duration-500 group-hover:bg-purple-500/25 group-hover:w-20 group-hover:h-20" style={{ animationDelay: '1.5s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-indigo-400/[0.08] rounded-full blur-xl pointer-events-none transition-all duration-500 group-hover:w-32 group-hover:h-32 group-hover:bg-indigo-400/[0.12]" />

          {/* Shimmer sweep */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
            <div className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent animate-premium-shimmer transition-opacity duration-300 group-hover:via-white/[0.12]" />
          </div>

          {/* Sparkle particles — brighter on hover */}
          <div className="absolute top-2 right-4 w-1 h-1 bg-violet-300/80 rounded-full animate-premium-sparkle-1 pointer-events-none transition-colors duration-300 group-hover:bg-violet-200" />
          <div className="absolute bottom-3 right-8 w-0.5 h-0.5 bg-purple-300/70 rounded-full animate-premium-sparkle-2 pointer-events-none transition-colors duration-300 group-hover:bg-purple-200" />
          <div className="absolute top-3 left-10 w-0.5 h-0.5 bg-indigo-300/60 rounded-full animate-premium-sparkle-3 pointer-events-none transition-colors duration-300 group-hover:bg-indigo-200" />
          {/* Extra sparkles on hover */}
          <div className="absolute top-1 left-6 w-0.5 h-0.5 bg-violet-300/0 rounded-full animate-premium-sparkle-2 pointer-events-none transition-colors duration-300 group-hover:bg-violet-300/80" />
          <div className="absolute bottom-2 right-3 w-1 h-1 bg-purple-300/0 rounded-full animate-premium-sparkle-3 pointer-events-none transition-colors duration-300 group-hover:bg-purple-300/70" />

          {/* Content */}
          <div className="relative flex items-center gap-2.5 px-3 py-3">
            {/* Crown icon with glow — lifts on hover */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/30 to-purple-600/30 border border-violet-400/20 flex items-center justify-center shrink-0 animate-premium-float transition-all duration-500 group-hover:from-violet-500/40 group-hover:to-purple-600/40 group-hover:border-violet-400/40 group-hover:shadow-[0_0_12px_rgba(139,92,246,0.3)] group-hover:-translate-y-0.5">
              <svg className="w-4 h-4 text-violet-300 animate-premium-crown-glow transition-colors duration-300 group-hover:text-violet-200" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2l2.5 4 4.5-1.5-2 5L16 16H4l1-6.5-2-5L7.5 6z" />
              </svg>
            </div>

            {/* Plan info — brightens on hover */}
            <div className="flex flex-col min-w-0 flex-1 text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-violet-100 leading-tight tracking-tight transition-colors duration-300 group-hover:text-white">
                  Plan Anual
                </span>
                <span className="text-[7px] font-black bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent px-1.5 py-0.5 rounded-full border border-violet-400/30 uppercase leading-none tracking-[0.15em] transition-all duration-300 group-hover:border-violet-300/50 group-hover:from-violet-300 group-hover:to-purple-300">
                  PRO
                </span>
              </div>
              <span className="text-[9px] text-violet-300/60 leading-tight font-medium transition-colors duration-300 group-hover:text-violet-300/90">
                Activo
              </span>
            </div>

            {/* Days remaining — glows on hover */}
            <div className="shrink-0 text-right">
              <span className="text-sm font-bold tabular-nums bg-gradient-to-b from-violet-200 to-purple-300 bg-clip-text text-transparent transition-all duration-300 group-hover:from-white group-hover:to-violet-200">
                {subscription.daysRemaining > 0 ? subscription.daysRemaining : '∞'}
              </span>
              <span className="block text-[8px] text-violet-400/50 font-medium leading-tight transition-colors duration-300 group-hover:text-violet-300/70">días</span>
            </div>
          </div>

          {/* Bottom accent line — brightens on hover */}
          <div className="h-[1px] bg-gradient-to-r from-transparent via-violet-400/30 to-transparent transition-all duration-500 group-hover:via-violet-400/60" />
        </button>
      );
    }

    /* ── Semiannual / Quarterly / Monthly ── */
    return (
      <button
        onClick={handleNavigate}
        className={`group relative w-full overflow-hidden rounded-xl ${tier.bg} border ${tier.border} transition-all duration-200 hover:shadow-sm active:scale-[0.98]`}
      >
        {/* Shimmer on high tiers */}
        {isHighTier && (
          <div className={`absolute inset-0 bg-gradient-to-r ${tier.gradient} pointer-events-none`} />
        )}
        <div className="relative flex items-center gap-2.5 px-3 py-2.5">
          {/* Tier icon */}
          <div className={`w-7 h-7 rounded-lg ${tier.iconBg} flex items-center justify-center shrink-0`}>
            <TierIcon planType={subscription.planType} className={`w-3.5 h-3.5 ${tier.iconColor}`} />
          </div>
          {/* Plan info */}
          <div className="flex flex-col min-w-0 flex-1 text-left">
            <div className="flex items-center gap-1.5">
              <span className={`text-[11px] font-bold ${tier.textColor} leading-tight tracking-tight`}>
                {getPlanText(subscription.planType)}
              </span>
              {tier.tier >= 3 && (
                <span className={`text-[8px] font-extrabold ${tier.badgeText} ${tier.badgeBg} px-1.5 py-0.5 rounded-full uppercase leading-none tracking-wider`}>
                  {tier.shortLabel}
                </span>
              )}
            </div>
            <span className="text-[9px] text-slate-400 leading-tight font-medium">
              Activo
            </span>
          </div>
          {/* Days remaining */}
          <div className="shrink-0 text-right">
            <span className={`text-xs font-bold tabular-nums ${tier.daysBg}`}>
              {subscription.daysRemaining > 0 ? subscription.daysRemaining : '∞'}
            </span>
            <span className="block text-[8px] text-slate-400 font-medium leading-tight">días</span>
          </div>
        </div>
      </button>
    );
  }

  const tier = getTier(subscription.planType);

  return (
    <div
      className={`rounded-xl p-2 md:p-3 border ${
        isExpired
          ? 'bg-red-50 border-red-200'
          : isInGracePeriod
          ? 'bg-yellow-50 border-yellow-200'
          : `${tier.bg} ${tier.border}`
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-8 h-8 rounded-lg ${tier.iconBg} flex items-center justify-center shrink-0`}>
            <TierIcon planType={subscription.planType} className={`w-4 h-4 ${tier.iconColor}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className={`text-sm font-bold ${tier.textColor} truncate`}>
                {getPlanText(subscription.planType)}
              </h3>
            </div>
            <p className={`text-[11px] font-medium ${getStatusColor(subscription.status, isInGracePeriod)}`}>
              {getStatusText(subscription.status, isInGracePeriod)}
            </p>
            <p className="text-slate-500 text-[11px] truncate">
              ${subscription.price?.toLocaleString('es-CO') || '0'} COP · Hasta {formatDate(subscription.periodEnd || subscription.endDate)}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          {isExpired ? (
            <div className="text-red-600">
              <FaExclamationTriangle className="mx-auto mb-0.5 text-sm" />
              <p className="text-[10px] font-semibold">DESACTIVADO</p>
            </div>
          ) : isInGracePeriod ? (
            <div className="text-yellow-600">
              <FaClock className="mx-auto mb-0.5 text-sm" />
              <p className="text-[10px] font-semibold">
                {subscription.daysRemaining < 0 ? 'EXPIRO' : `${subscription.daysRemaining}d`}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {isInGracePeriod && (() => {
        const totalHours = timeRemaining.days * 24 + timeRemaining.hours;
        const isUrgent = totalHours < 24 && timeRemaining.days === 0;
        const urgentBg = isUrgent ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200';
        const urgentText = isUrgent ? 'text-red-800' : 'text-yellow-800';
        const urgentAccent = isUrgent ? 'text-red-600' : 'text-yellow-600';
        const urgentBadge = isUrgent ? 'bg-red-100' : 'bg-yellow-100';

        return (
          <div className={`mt-2 p-2.5 rounded-xl border ${urgentBg}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <FaClock className={`text-xs ${urgentAccent}`} />
                  <span className={`text-[11px] font-bold ${urgentText}`}>Periodo de Gracia</span>
                </div>

                {graceUntilDate && (timeRemaining.days > 0 || timeRemaining.hours > 0 || timeRemaining.minutes > 0 || timeRemaining.seconds > 0) ? (
                  <div className={`${urgentBadge} rounded-lg p-2`}>
                    <p className={`text-[10px] font-medium ${urgentText} text-center mb-1`}>Tiempo restante:</p>
                    <div className="flex items-center justify-center gap-1.5 tabular-nums">
                      {timeRemaining.days > 0 && (
                        <div className="text-center">
                          <div className={`text-base font-bold ${urgentText}`}>{timeRemaining.days}</div>
                          <div className={`text-[9px] ${urgentAccent}`}>dias</div>
                        </div>
                      )}
                      <div className="text-center">
                        <div className={`text-base font-bold ${urgentText}`}>{String(timeRemaining.hours).padStart(2, '0')}</div>
                        <div className={`text-[9px] ${urgentAccent}`}>hrs</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-base font-bold ${urgentText}`}>{String(timeRemaining.minutes).padStart(2, '0')}</div>
                        <div className={`text-[9px] ${urgentAccent}`}>min</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-base font-bold ${urgentText}`}>{String(timeRemaining.seconds).padStart(2, '0')}</div>
                        <div className={`text-[9px] ${urgentAccent}`}>seg</div>
                      </div>
                    </div>
                    <p className={`text-[9px] ${urgentAccent} mt-1 text-center`}>
                      Desactivacion: {formatDateTime(graceUntilDate)}
                    </p>
                  </div>
                ) : (
                  <div className="bg-red-100 rounded-lg p-2 text-center">
                    <p className="text-xs font-bold text-red-800">Desactivacion inminente</p>
                    {graceUntilDate && <p className="text-[10px] text-red-600 mt-0.5">{formatDateTime(graceUntilDate)}</p>}
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-between">
                <div>
                  <p className={`text-[11px] ${urgentText} mb-1`}>
                    Tu suscripcion expiro el {formatDate(subscription.periodEnd || subscription.endDate)}.
                    Tienes <strong>{graceDaysRemaining} dias</strong> para renovar.
                  </p>
                  <p className={`text-[10px] ${urgentAccent} font-medium mb-2`}>
                    Despues del periodo de gracia el menu quedara desactivado.
                  </p>
                </div>
                <button
                  onClick={handleNavigate}
                  className={`w-full px-3 py-1.5 ${isUrgent ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700'} text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5`}
                >
                  <span>Renovar Ahora</span>
                  <FaArrowRight className="text-[10px]" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {isExpired && (
        <div className="mt-2 p-2.5 rounded-xl border bg-red-50 border-red-200">
          <div className="flex items-start gap-2">
            <FaExclamationTriangle className="text-red-500 text-sm shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-bold text-red-800 mb-1">Menu desactivado</p>
              <p className="text-[11px] text-red-700 mb-1">
                Tu suscripcion expiro y el periodo de gracia finalizo. Los usuarios pueden ver el menu pero no realizar pedidos.
              </p>
              <button
                onClick={handleNavigate}
                className="w-full mt-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Renovar Suscripcion</span>
                <FaArrowRight className="text-[10px]" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionStatus;
