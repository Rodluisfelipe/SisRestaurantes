import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaCrown, FaCalendarAlt, FaExclamationTriangle, FaArrowRight, FaClock } from 'react-icons/fa';

/**
 * Componente de presentacion puro.
 * Recibe toda la data de suscripcion via props (de useSubscriptionData).
 * NO hace API calls, NO registra socket listeners, NO corre timers propios.
 */
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

  const getPlanIcon = (planType) => (planType === 'annual' ? FaCrown : FaCalendarAlt);
  const getPlanText = (planType) => (planType === 'annual' ? 'Plan Anual' : 'Plan Mensual');

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
    const PlanIcon = getPlanIcon(subscription.planType);
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200/80">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <PlanIcon className={`text-xs ${subscription.planType === 'annual' ? 'text-yellow-500' : 'text-slate-500'}`} />
          <span className="text-[11px] font-semibold text-slate-700 truncate">
            {getPlanText(subscription.planType)}
          </span>
          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full uppercase leading-none">
            Activo
          </span>
        </div>
        <span className="text-[11px] font-bold text-slate-500 tabular-nums shrink-0">
          {subscription.daysRemaining > 0 ? `${subscription.daysRemaining}d` : <span className="text-emerald-500">OK</span>}
        </span>
      </div>
    );
  }

  const PlanIcon = getPlanIcon(subscription.planType);

  return (
    <div
      className={`rounded-xl p-2 md:p-3 border ${
        isExpired
          ? 'bg-red-50 border-red-200'
          : isInGracePeriod
          ? 'bg-yellow-50 border-yellow-200'
          : 'bg-emerald-50 border-emerald-200'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <PlanIcon className={`text-lg shrink-0 ${subscription.planType === 'annual' ? 'text-yellow-500' : 'text-slate-500'}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-sm font-bold text-slate-800 truncate">
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
