import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaStar, FaReply, FaEye, FaEyeSlash, FaSearch, FaChevronLeft, FaChevronRight, FaSyncAlt, FaBoxOpen, FaStarHalfAlt, FaMagic } from 'react-icons/fa';
import api from '../../services/api';
import { useBusinessConfig } from '../../Context/BusinessContext';
import AI from './AdminIcons';
import { getBusinessSlug } from '../../utils/getBusinessId';

// Star rating display component
const StarRating = ({ rating, size = 'text-sm' }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((star) => (
      <FaStar
        key={star}
        className={`${size} ${star <= rating ? 'text-yellow-400' : 'text-slate-200'}`}
      />
    ))}
  </div>
);

// Rating breakdown bar
const RatingBar = ({ label, count, total, color }) => {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-slate-500 w-4 text-right">{label}</span>
      <FaStar className="text-xs text-yellow-400" />
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className="text-xs text-slate-400 w-8 text-right">{count}</span>
    </div>
  );
};

export default function AdminReviews() {
  const { businessConfig, updateConfig } = useBusinessConfig();
  const businessId = businessConfig?._id || businessConfig?.businessId || getBusinessSlug();

  // ── Preferencia: qué reseñas mostrar en el menú ──
  const [reviewsDisplay, setReviewsDisplayState] = useState(businessConfig?.reviewsDisplay || 'both');
  const [savingDisplay, setSavingDisplay] = useState(false);
  const hasGoogleRating = businessConfig?.google?.rating > 0;

  // ── Cómo recolectar reseñas ──
  const [collection, setCollectionState] = useState(businessConfig?.reviewCollection || { mode: 'funnel', googleThreshold: 4 });
  const [savingCollection, setSavingCollection] = useState(false);

  // State
  const [stats, setStats] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [ratingFilter, setRatingFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [aiReplyLoading, setAiReplyLoading] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);

  // Show toast
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Sincroniza la preferencia si cambia el config externamente
  useEffect(() => {
    setReviewsDisplayState(businessConfig?.reviewsDisplay || 'both');
  }, [businessConfig?.reviewsDisplay]);

  const changeReviewsDisplay = async (val) => {
    if (val === reviewsDisplay) return;
    const prev = reviewsDisplay;
    setReviewsDisplayState(val); // optimista
    setSavingDisplay(true);
    try {
      await updateConfig({ reviewsDisplay: val });
      showToast('Preferencia guardada');
    } catch {
      setReviewsDisplayState(prev);
      showToast('No se pudo guardar', 'error');
    } finally {
      setSavingDisplay(false);
    }
  };

  useEffect(() => {
    if (businessConfig?.reviewCollection) setCollectionState(businessConfig.reviewCollection);
  }, [businessConfig?.reviewCollection?.mode, businessConfig?.reviewCollection?.googleThreshold]);

  const changeCollection = async (patch) => {
    const prev = collection;
    const next = { mode: prev.mode, googleThreshold: prev.googleThreshold || 4, ...patch };
    setCollectionState(next); // optimista
    setSavingCollection(true);
    try {
      await updateConfig({ reviewCollection: next });
      showToast('Guardado');
    } catch {
      setCollectionState(prev);
      showToast('No se pudo guardar', 'error');
    } finally {
      setSavingCollection(false);
    }
  };

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!businessId) return;
    setStatsLoading(true);
    try {
      const { data } = await api.get(`/reviews/stats?businessId=${businessId}`);
      setStats(data.stats);
    } catch (err) {
      console.error('Error fetching review stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [businessId]);

  // Fetch reviews (admin endpoint - all reviews including hidden)
  const fetchReviews = useCallback(async (page = 1) => {
    if (!businessId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        businessId,
        page: String(page),
        limit: '15',
      });
      if (ratingFilter !== 'all') params.append('rating', ratingFilter);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      const { data } = await api.get(`/reviews/admin?${params}`);
      setReviews(data.reviews || []);
      setPagination(data.pagination || {});
      setCurrentPage(page);
    } catch (err) {
      console.error('Error fetching reviews:', err);
      // Fallback to public endpoint if admin endpoint doesn't exist yet
      try {
        const params = new URLSearchParams({
          businessId,
          page: String(page),
          limit: '15',
        });
        if (ratingFilter !== 'all') params.append('rating', ratingFilter);
        const { data } = await api.get(`/reviews?${params}`);
        setReviews(data.reviews || []);
        setPagination(data.pagination || {});
        setCurrentPage(page);
      } catch (fallbackErr) {
        console.error('Fallback also failed:', fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  }, [businessId, ratingFilter, searchTerm]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchReviews(1);
  }, [fetchReviews]);

  // Reply to review
  const handleReply = async (reviewId) => {
    if (!replyText.trim()) return;
    setReplyLoading(true);
    try {
      await api.put(`/reviews/${reviewId}/reply`, { reply: replyText.trim() });
      showToast('Respuesta enviada correctamente');
      setReplyingTo(null);
      setReplyText('');
      fetchReviews(currentPage);
    } catch (err) {
      showToast(err.response?.data?.message || 'Error al enviar respuesta', 'error');
    } finally {
      setReplyLoading(false);
    }
  };

  // Generate AI reply
  const generateAiReply = async (review) => {
    setAiReplyLoading(review._id);
    try {
      const res = await api.post('/ai-tools/review-response', {
        reviewText: review.comment || '',
        rating: review.rating,
        customerName: review.customerName || review.name || '',
        businessName: businessConfig?.name || businessConfig?.businessName || '',
        businessType: businessConfig?.businessType || ''
      });
      setReplyText(res.data.response || '');
    } catch {
      showToast('No se pudo generar la respuesta con IA', 'error');
    } finally {
      setAiReplyLoading(null);
    }
  };

  // Toggle visibility
  const handleToggleVisibility = async (reviewId, currentVisibility) => {
    setActionLoading(reviewId);
    try {
      await api.put(`/reviews/${reviewId}/visibility`, { isVisible: !currentVisibility });
      showToast(currentVisibility ? 'Reseña oculta' : 'Reseña visible');
      fetchReviews(currentPage);
      fetchStats(); // Stats change when visibility changes
    } catch (err) {
      showToast('Error al cambiar visibilidad', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Format date
  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Ahora';
    if (mins < 60) return `Hace ${mins}m`;
    if (hrs < 24) return `Hace ${hrs}h`;
    if (days < 7) return `Hace ${days}d`;
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  };

  // Order type labels
  const orderTypeLabel = (type) => {
    const labels = { inSite: 'En sitio', takeaway: 'Para llevar', delivery: 'Domicilio' };
    return labels[type] || type || '';
  };

  const totalReviews = stats?.totalReviews || 0;
  const avgRating = stats?.averageRating || 0;
  const breakdown = stats?.ratingBreakdown || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const thumbs = stats?.thumbsFeedback || { thumbsUp: 0, thumbsDown: 0, total: 0 };
  const thumbsUpPct = thumbs.total > 0 ? Math.round((thumbs.thumbsUp / thumbs.total) * 100) : 0;

  const GoogleG = ({ className = 'w-3.5 h-3.5' }) => (
    <svg className={className} viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 010-4.2V7.06H2.18a11 11 0 000 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
  );

  const displayOptions = [
    { val: 'both', label: 'Ambas', desc: 'Internas + Google', icon: '⭐' },
    { val: 'google', label: 'Solo Google', desc: 'Rating de Google', icon: '🔵' },
    { val: 'internal', label: 'Solo internas', desc: 'Tus reseñas', icon: '💬' },
    { val: 'none', label: 'Ninguna', desc: 'Ocultar del menú', icon: '🚫' },
  ];

  const collectionOptions = [
    { val: 'funnel', label: 'Embudo inteligente', desc: 'El cliente califica en tu menú; solo las calificaciones altas se invitan a Google.', badge: 'Recomendado', icon: '🎯' },
    { val: 'choice', label: 'Elección libre', desc: 'El cliente decide dónde dejar su reseña: en tu menú o en Google.', icon: '🔀' },
    { val: 'internal', label: 'Solo interna', desc: 'Las reseñas nunca se envían a Google. Todo queda en tu panel.', icon: '🔒' },
  ];

  const cmode = collection.mode || 'funnel';
  const gThreshold = collection.googleThreshold || 4;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Preferencia de reseñas visibles en el menú */}
      <div className="bg-white rounded-2xl border border-slate-100 lg:border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-none p-4">
        <div className="flex items-center gap-2.5 mb-0.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <FaEye className="text-indigo-500 text-xs" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              Qué reseñas ve el cliente
              {savingDisplay && <FaSyncAlt className="text-[10px] text-indigo-300 animate-spin" />}
            </h3>
            <p className="text-[11px] text-slate-400">La calificación que aparece en el encabezado de tu menú.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          {displayOptions.map(opt => {
            const active = reviewsDisplay === opt.val;
            return (
              <button
                key={opt.val}
                type="button"
                onClick={() => changeReviewsDisplay(opt.val)}
                disabled={savingDisplay}
                className={`relative text-left p-3 rounded-xl border-2 transition-all disabled:opacity-60 ${
                  active ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/15' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                }`}
              >
                {active && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  </span>
                )}
                <span className="text-base">{opt.icon}</span>
                <span className={`block text-xs font-bold mt-1 ${active ? 'text-indigo-700' : 'text-slate-700'}`}>{opt.label}</span>
                <span className="block text-[10px] text-slate-400 leading-tight">{opt.desc}</span>
              </button>
            );
          })}
        </div>
        {(reviewsDisplay === 'google' || reviewsDisplay === 'both') && !hasGoogleRating && (
          <p className="mt-3 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
            <span>⚠️</span><span>Aún no vinculas Google. Ve a <strong>Configuración → Conectar con Google</strong> para mostrar tu rating.</span>
          </p>
        )}
      </div>

      {/* Cómo recolectar reseñas */}
      <div className="bg-white rounded-2xl border border-slate-100 lg:border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-none p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <FaMagic className="text-indigo-500 text-xs" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              Cómo se piden las reseñas
              {savingCollection && <FaSyncAlt className="text-[10px] text-indigo-300 animate-spin" />}
            </h3>
            <p className="text-[11px] text-slate-400">Qué pasa cuando un cliente va a calificarte.</p>
          </div>
        </div>

        <div className="space-y-2">
          {collectionOptions.map(opt => {
            const active = cmode === opt.val;
            return (
              <button
                key={opt.val}
                type="button"
                onClick={() => changeCollection({ mode: opt.val })}
                disabled={savingCollection}
                className={`w-full flex items-start gap-3 text-left p-3 rounded-xl border-2 transition-all disabled:opacity-60 ${
                  active ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/15' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                }`}
              >
                {/* Radio */}
                <span className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${active ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'}`}>
                  {active && <span className="w-2 h-2 rounded-full bg-white" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[13px] font-bold ${active ? 'text-indigo-700' : 'text-slate-700'}`}>{opt.icon} {opt.label}</span>
                    {opt.badge && <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">{opt.badge}</span>}
                  </div>
                  <span className="block text-[11px] text-slate-500 leading-snug mt-0.5">{opt.desc}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Configuración + diagrama del embudo */}
        {cmode === 'funnel' && (
          <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 p-3">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="text-[11px] font-semibold text-slate-600">Invitar a Google desde:</span>
              {[3, 4, 5].map(n => {
                const active = gThreshold === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => changeCollection({ googleThreshold: n })}
                    disabled={savingCollection}
                    className={`inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all disabled:opacity-60 ${
                      active ? 'bg-amber-400 text-white shadow-sm ring-2 ring-amber-400/25' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {n}<FaStar className={`text-[9px] ${active ? 'text-white' : 'text-amber-400'}`} />{n < 5 ? '+' : ''}
                  </button>
                );
              })}
            </div>

            {/* Diagrama: qué pasa según la calificación */}
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">Cómo funciona</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-[11px] font-bold flex-shrink-0">
                  {gThreshold}<FaStar className="text-[8px] text-emerald-500" />{gThreshold < 5 ? ' o más' : ''}
                </span>
                <FaChevronRight className="text-[8px] text-slate-300 flex-shrink-0" />
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 font-medium"><GoogleG /> Se le invita a reseñar en Google</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg bg-slate-200 text-slate-500 text-[11px] font-bold flex-shrink-0">
                  menos de {gThreshold}<FaStar className="text-[8px] text-slate-400" />
                </span>
                <FaChevronRight className="text-[8px] text-slate-300 flex-shrink-0" />
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 font-medium">🔒 Queda solo en tu panel (privada)</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2.5 leading-snug">Así proteges tu reputación: las malas experiencias las ves tú primero y no llegan a Google.</p>
          </div>
        )}

        {cmode === 'choice' && (
          <p className="mt-3 text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-2 leading-snug">
            Al calificar, el cliente verá dos botones: <strong>Calificar aquí</strong> o <strong className="inline-flex items-center gap-1"><GoogleG className="w-3 h-3" /> Reseñar en Google</strong>. Ojo: un cliente molesto podría dejar su reseña baja directamente en Google.
          </p>
        )}

        {cmode !== 'internal' && !hasGoogleRating && (
          <p className="mt-3 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
            <span>⚠️</span><span>Para enviar reseñas a Google, primero vincula tu negocio en <strong>Configuración → Conectar con Google</strong>.</span>
          </p>
        )}
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Average Rating Card */}
        <div className="bg-white rounded-2xl border border-slate-100 lg:border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-none p-4 lg:p-6 flex flex-col items-center justify-center">
          {statsLoading ? (
            <div className="animate-pulse space-y-3 w-full flex flex-col items-center">
              <div className="h-12 w-20 bg-slate-200 rounded" />
              <div className="h-4 w-32 bg-slate-200 rounded" />
              <div className="h-3 w-24 bg-slate-100 rounded" />
            </div>
          ) : (
            <>
              <div className="text-5xl font-bold text-slate-800 mb-1">
                {avgRating > 0 ? avgRating.toFixed(1) : '—'}
              </div>
              <StarRating rating={Math.round(avgRating)} size="text-lg" />
              <p className="text-sm text-slate-400 mt-2">
                {totalReviews} {totalReviews === 1 ? 'reseña' : 'reseñas'} en total
              </p>

              {/* Thumbs feedback */}
              {thumbs.total > 0 && (
                <div className="w-full mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">¿Qué tal estuvo?</span>
                    <span className="text-xs font-semibold text-slate-600">{thumbs.total} respuestas</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-emerald-600">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M2 20h2c.55 0 1-.45 1-1v-9c0-.55-.45-1-1-1H2v11zm19.83-7.12c.11-.25.17-.52.17-.8V11c0-1.1-.9-2-2-2h-5.5l.92-4.65c.05-.22.02-.46-.08-.66-.23-.45-.52-.86-.88-1.22L14 2 7.59 8.41C7.21 8.79 7 9.3 7 9.83v7.84C7 18.95 8.05 20 9.34 20h8.11c.7 0 1.36-.37 1.72-.97l2.66-6.15z" />
                      </svg>
                      <span className="text-sm font-bold">{thumbsUpPct}%</span>
                    </div>
                    <div className="flex-1 h-2.5 bg-red-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${thumbsUpPct}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        className="h-full rounded-full bg-emerald-500"
                      />
                    </div>
                    <div className="flex items-center gap-1 text-red-400">
                      <span className="text-sm font-bold">{100 - thumbsUpPct}%</span>
                      <svg className="w-4 h-4 rotate-180" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M2 20h2c.55 0 1-.45 1-1v-9c0-.55-.45-1-1-1H2v11zm19.83-7.12c.11-.25.17-.52.17-.8V11c0-1.1-.9-2-2-2h-5.5l.92-4.65c.05-.22.02-.46-.08-.66-.23-.45-.52-.86-.88-1.22L14 2 7.59 8.41C7.21 8.79 7 9.3 7 9.83v7.84C7 18.95 8.05 20 9.34 20h8.11c.7 0 1.36-.37 1.72-.97l2.66-6.15z" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Rating Breakdown Card */}
        <div className="bg-white rounded-2xl border border-slate-100 lg:border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-none p-4 lg:p-6 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Distribución de calificaciones</h3>
          {statsLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-3 bg-slate-100 rounded-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              <RatingBar label="5" count={breakdown[5]} total={totalReviews} color="bg-emerald-500" />
              <RatingBar label="4" count={breakdown[4]} total={totalReviews} color="bg-lime-500" />
              <RatingBar label="3" count={breakdown[3]} total={totalReviews} color="bg-yellow-500" />
              <RatingBar label="2" count={breakdown[2]} total={totalReviews} color="bg-orange-500" />
              <RatingBar label="1" count={breakdown[1]} total={totalReviews} color="bg-red-500" />
            </div>
          )}
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-2xl border border-slate-100 lg:border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-none p-3 lg:p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
            <input
              type="text"
              placeholder="Buscar por nombre o comentario..."
              aria-label="Buscar reseñas"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 lg:py-2 bg-slate-100/80 lg:bg-white border-0 lg:border lg:border-slate-200 rounded-xl lg:rounded-lg text-[14px] lg:text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 lg:focus:ring-2 lg:focus:ring-blue-500/20 focus:bg-white transition-all"
            />
          </div>

          {/* Rating filter */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setRatingFilter('all')}
              className={`px-3 lg:px-2.5 py-1.5 lg:py-1 text-[13px] lg:text-xs font-semibold lg:font-medium rounded-xl lg:rounded-lg transition-all active:scale-[0.96] lg:active:scale-100 ${
                ratingFilter === 'all'
                  ? 'bg-red-500 lg:bg-blue-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todas
            </button>
            {[5, 4, 3, 2, 1].map((r) => (
              <button
                key={r}
                onClick={() => setRatingFilter(String(r))}
                className={`px-3 lg:px-2.5 py-1.5 lg:py-1 text-[13px] lg:text-xs font-semibold lg:font-medium rounded-xl lg:rounded-lg transition-all flex items-center gap-1 active:scale-[0.96] lg:active:scale-100 ${
                  ratingFilter === String(r)
                    ? 'bg-red-500 lg:bg-blue-500 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {r} <FaStar className="text-[10px]" />
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={() => { fetchReviews(1); fetchStats(); }}
            className="p-2.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-all"
            title="Actualizar"
          >
            <FaSyncAlt className={`text-sm ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-3">
        {loading ? (
          // Skeleton
          [...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 lg:border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-none p-5 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-slate-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-32" />
                  <div className="h-3 bg-slate-100 rounded w-20" />
                  <div className="h-3 bg-slate-100 rounded w-full mt-2" />
                </div>
              </div>
            </div>
          ))
        ) : reviews.length === 0 ? (
          // Empty state
          <div className="bg-white rounded-2xl border border-slate-100 lg:border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-none p-12 text-center">
            <FaBoxOpen className="text-4xl text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-600 mb-1">No hay reseñas</h3>
            <p className="text-sm text-slate-400">
              {ratingFilter !== 'all' || searchTerm
                ? 'No se encontraron reseñas con esos filtros'
                : 'Cuando los clientes dejen reseñas, aparecerán aquí'
              }
            </p>
          </div>
        ) : (
          reviews.map((review) => (
            <motion.div
              key={review._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white rounded-2xl border transition-all ${
                review.isVisible === false
                  ? 'border-red-200 bg-red-50/30 opacity-70'
                  : 'border-slate-100 lg:border-slate-200'
              }`}
            >
              <div className="p-4 sm:p-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${
                      review.rating >= 4 ? 'bg-emerald-500' : review.rating === 3 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}>
                      {(review.customerName || '?')[0].toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-slate-800 truncate">
                          {review.customerName}
                        </span>
                        {review.isVisible === false && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full">
                            Oculta
                          </span>
                        )}
                        {review.orderType && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                            {orderTypeLabel(review.orderType)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StarRating rating={review.rating} size="text-xs" />
                        <span className="text-xs text-slate-400">{formatDate(review.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleToggleVisibility(review._id, review.isVisible !== false)}
                      disabled={actionLoading === review._id}
                      className={`p-2 rounded-lg text-xs transition-all ${
                        review.isVisible === false
                          ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                          : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-red-500'
                      }`}
                      title={review.isVisible === false ? 'Hacer visible' : 'Ocultar'}
                    >
                      {actionLoading === review._id ? (
                        <FaSyncAlt className="text-sm animate-spin" />
                      ) : review.isVisible === false ? (
                        <FaEye className="text-sm" />
                      ) : (
                        <FaEyeSlash className="text-sm" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setReplyingTo(replyingTo === review._id ? null : review._id);
                        setReplyText(review.reply || '');
                      }}
                      className={`p-2 rounded-lg text-xs transition-all ${
                        review.reply
                          ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                          : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-blue-500'
                      }`}
                      title={review.reply ? 'Editar respuesta' : 'Responder'}
                    >
                      <FaReply className="text-sm" />
                    </button>
                  </div>
                </div>

                {/* Comment */}
                {review.comment && (
                  <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                    {review.comment}
                  </p>
                )}

                {/* Thumbs feedback */}
                {review.thumbsUp !== null && review.thumbsUp !== undefined && (
                  <span className={`inline-flex items-center gap-1 mt-2 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    review.thumbsUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                  }`}>
                    <svg className={`w-3 h-3 ${review.thumbsUp ? '' : 'rotate-180'}`} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2 20h2c.55 0 1-.45 1-1v-9c0-.55-.45-1-1-1H2v11zm19.83-7.12c.11-.25.17-.52.17-.8V11c0-1.1-.9-2-2-2h-5.5l.92-4.65c.05-.22.02-.46-.08-.66-.23-.45-.52-.86-.88-1.22L14 2 7.59 8.41C7.21 8.79 7 9.3 7 9.83v7.84C7 18.95 8.05 20 9.34 20h8.11c.7 0 1.36-.37 1.72-.97l2.66-6.15z" />
                    </svg>
                    {review.thumbsUp ? 'Le gustó' : 'No le gustó'}
                  </span>
                )}

                {/* Existing reply */}
                {review.reply && replyingTo !== review._id && (
                  <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <FaReply className="text-[10px] text-blue-500" />
                      <span className="text-[11px] font-semibold text-blue-600">Tu respuesta</span>
                      {review.repliedAt && (
                        <span className="text-[10px] text-blue-400">• {formatDate(review.repliedAt)}</span>
                      )}
                    </div>
                    <p className="text-sm text-blue-700">{review.reply}</p>
                  </div>
                )}

                {/* Reply form */}
                <AnimatePresence>
                  {replyingTo === review._id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Escribe una respuesta al cliente..."
                          maxLength={300}
                          rows={3}
                          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition-all"
                          autoFocus
                        />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">
                              {replyText.length}/300
                            </span>
                            <button
                              type="button"
                              onClick={() => generateAiReply(review)}
                              disabled={aiReplyLoading === review._id}
                              className="flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-700 disabled:text-violet-300 px-2 py-1 rounded-lg hover:bg-violet-50 transition-all"
                              title="Generar respuesta con IA adaptada a tu negocio"
                            >
                              {aiReplyLoading === review._id ? (
                                <FaSyncAlt className="text-[10px] animate-spin" />
                              ) : (
                                <FaMagic className="text-[10px]" />
                              )}
                              {aiReplyLoading === review._id ? 'Generando...' : <><span className="inline-flex items-center gap-0.5">{AI.sparkle('w-3 h-3')} IA</span></>}
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setReplyingTo(null); setReplyText(''); }}
                              className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-all"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleReply(review._id)}
                              disabled={!replyText.trim() || replyLoading}
                              className="px-4 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                            >
                              {replyLoading ? (
                                <FaSyncAlt className="text-[10px] animate-spin" />
                              ) : (
                                <FaReply className="text-[10px]" />
                              )}
                              {review.reply ? 'Actualizar' : 'Enviar'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => fetchReviews(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <FaChevronLeft className="text-xs" />
          </button>
          <span className="text-sm text-slate-500 px-3">
            {currentPage} de {pagination.pages}
          </span>
          <button
            onClick={() => fetchReviews(currentPage + 1)}
            disabled={currentPage >= pagination.pages}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <FaChevronRight className="text-xs" />
          </button>
        </div>
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
              toast.type === 'error'
                ? 'bg-red-500 text-white'
                : 'bg-emerald-500 text-white'
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
