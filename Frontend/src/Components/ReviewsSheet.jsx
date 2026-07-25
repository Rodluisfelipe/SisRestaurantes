import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';
import { X, NotebookPen, Bike, ShoppingBag, Calendar, UtensilsCrossed } from 'lucide-react';

/**
 * Bottom sheet que muestra las reseñas de un restaurante
 * Incluye distribución de estrellas y lista paginada
 */
const ReviewsSheet = ({ show, onClose, businessId, reviewStats, theme, initialSource = 'internal' }) => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filterRating, setFilterRating] = useState(null);
  const listRef = useRef(null);
  const { businessConfig } = useBusinessConfig();
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);

  const buttonColor = theme?.buttonColor || '#f97316';
  const stats = reviewStats || { averageRating: 0, totalReviews: 0, ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };

  // ── Fuente de reseñas: internas / Google, según preferencia del negocio ──
  const mode = businessConfig?.reviewsDisplay || 'both';
  const googleData = businessConfig?.google || {};
  const googleReviews = Array.isArray(googleData.reviews) ? googleData.reviews : [];
  const showInternalTab = mode === 'both' || mode === 'internal';
  const showGoogleTab = (mode === 'both' || mode === 'google') && (googleReviews.length > 0 || googleData.rating > 0);
  const [source, setSource] = useState(showInternalTab ? 'internal' : 'google');

  const loadReviews = useCallback(async (pageNum = 1, ratingFilter = null, append = false) => {
    try {
      setLoading(true);
      let url = `/reviews?businessId=${businessId}&page=${pageNum}&limit=10`;
      if (ratingFilter) url += `&rating=${ratingFilter}`;
      const res = await api.get(url);
      if (res.data.success) {
        setReviews(prev => append ? [...prev, ...res.data.reviews] : res.data.reviews);
        setHasMore(pageNum < res.data.pagination.pages);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (show && businessId) {
      setPage(1);
      setReviews([]);
      loadReviews(1, filterRating);
    }
  }, [show, businessId, filterRating, loadReviews]);

  // Al abrir, respeta la fuente pedida (p. ej. tap en el badge de Google)
  useEffect(() => {
    if (!show) return;
    if (initialSource === 'google' && showGoogleTab) setSource('google');
    else if (showInternalTab) setSource('internal');
    else if (showGoogleTab) setSource('google');
  }, [show, initialSource]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    loadReviews(next, filterRating, true);
  };

  const handleFilterChange = (r) => {
    setFilterRating(prev => prev === r ? null : r);
    setPage(1);
  };

  const getPercentage = (count) => {
    if (!stats.totalReviews) return 0;
    return (count / stats.totalReviews) * 100;
  };

  const timeAgo = (date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'Ahora';
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
    if (diff < 2592000) return `Hace ${Math.floor(diff / 86400)}d`;
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  };

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-[180]"
            onClick={onClose}
          />
          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-[181] bg-white rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl"
          >
            {/* Handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {/* Tabs: internas / Google (solo si ambas disponibles) */}
            {showInternalTab && showGoogleTab && (
              <div className="flex gap-2 px-5 pt-1 pb-2">
                <button
                  onClick={() => setSource('internal')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${source === 'internal' ? 'text-white' : 'text-gray-500 bg-gray-100'}`}
                  style={source === 'internal' ? { backgroundColor: buttonColor } : undefined}
                >
                  Del negocio
                </button>
                <button
                  onClick={() => setSource('google')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors inline-flex items-center justify-center gap-1.5 ${source === 'google' ? 'bg-gray-900 text-white' : 'text-gray-500 bg-gray-100'}`}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24"><path fill={source === 'google' ? '#fff' : '#4285F4'} d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill={source === 'google' ? '#fff' : '#34A853'} d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z"/><path fill={source === 'google' ? '#fff' : '#FBBC05'} d="M5.84 14.1a6.6 6.6 0 010-4.2V7.06H2.18a11 11 0 000 9.88l3.66-2.84z"/><path fill={source === 'google' ? '#fff' : '#EA4335'} d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
                  Google
                </button>
              </div>
            )}

            {source === 'internal' && (<>
            {/* Stats header */}
            <div className="px-5 pt-2 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-4">
                {/* Average */}
                <div className="text-center">
                  <div className="text-4xl font-bold text-gray-800">
                    {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '—'}
                  </div>
                  <div className="flex items-center justify-center gap-0.5 mt-0.5">
                    {[1, 2, 3, 4, 5].map(s => (
                      <svg key={s} className="w-3.5 h-3.5" viewBox="0 0 24 24"
                        fill={s <= Math.round(stats.averageRating) ? '#facc15' : '#e5e7eb'}
                      >
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{stats.totalReviews} reseña{stats.totalReviews !== 1 ? 's' : ''}</p>
                </div>

                {/* Distribution bars */}
                <div className="flex-1 space-y-1">
                  {[5, 4, 3, 2, 1].map(star => {
                    const count = stats.ratingBreakdown?.[star] || 0;
                    const pct = getPercentage(count);
                    const isActive = filterRating === star;
                    return (
                      <button
                        key={star}
                        onClick={() => handleFilterChange(star)}
                        className={`flex items-center gap-2 w-full group transition-opacity ${filterRating && !isActive ? 'opacity-40' : ''}`}
                      >
                        <span className="text-xs font-medium text-gray-500 w-3">{star}</span>
                        <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="#facc15">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: isActive ? buttonColor : '#facc15' }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-6 text-right">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {filterRating && (
                <button
                  onClick={() => setFilterRating(null)}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full bg-gray-100 text-gray-600"
                >
                  Limpiar filtro <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Reviews list */}
            <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain px-5 py-3 space-y-4">
              {loading && reviews.length === 0 ? (
                // Skeleton
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-gray-200 rounded-full" />
                      <div className="flex-1">
                        <div className="w-24 h-3 bg-gray-200 rounded" />
                        <div className="w-16 h-2 bg-gray-100 rounded mt-1" />
                      </div>
                    </div>
                    <div className="w-full h-3 bg-gray-100 rounded mt-2" />
                    <div className="w-3/4 h-3 bg-gray-100 rounded mt-1" />
                  </div>
                ))
              ) : reviews.length === 0 ? (
                <div className="text-center py-10">
                  <NotebookPen className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-500">
                    {filterRating ? 'No hay reseñas con esta calificación' : 'Aún no hay reseñas'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Sé el primero en dejar tu opinión</p>
                </div>
              ) : (
                <>
                  {reviews.map((review) => (
                    <div key={review._id} className="pb-4 border-b border-gray-50 last:border-0">
                      {/* Review header */}
                      <div className="flex items-start gap-2.5">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: buttonColor }}
                        >
                          {review.customerName?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-gray-800 truncate">
                              {review.customerName}
                            </span>
                            <span className="text-xs text-gray-400 flex-shrink-0">
                              {timeAgo(review.createdAt)}
                            </span>
                          </div>
                          {/* Stars */}
                          <div className="flex items-center gap-0.5 mt-0.5">
                            {[1, 2, 3, 4, 5].map(s => (
                              <svg key={s} className="w-3 h-3" viewBox="0 0 24 24"
                                fill={s <= review.rating ? '#facc15' : '#e5e7eb'}
                              >
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                              </svg>
                            ))}
                            {review.orderType && (
                              <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">
                                {review.orderType === 'delivery' ? <><Bike className="w-2.5 h-2.5" /> Delivery</> : review.orderType === 'takeaway' ? <><ShoppingBag className="w-2.5 h-2.5" /> Para llevar</> : isService ? <><Calendar className="w-2.5 h-2.5" /> Cita</> : <><UtensilsCrossed className="w-2.5 h-2.5" /> En mesa</>}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Comment */}
                      {review.comment && (
                        <p className="text-sm text-gray-600 mt-2 leading-relaxed">{review.comment}</p>
                      )}

                      {/* Admin reply */}
                      {review.reply && (
                        <div className="mt-2 ml-6 p-2.5 bg-gray-50 rounded-xl border-l-2" style={{ borderLeftColor: buttonColor }}>
                          <p className="text-xs font-semibold text-gray-700 mb-0.5">Respuesta del negocio</p>
                          <p className="text-xs text-gray-600">{review.reply}</p>
                        </div>
                      )}
                    </div>
                  ))}

                  {hasMore && (
                    <button
                      onClick={handleLoadMore}
                      disabled={loading}
                      className="w-full py-2.5 text-sm font-medium rounded-xl transition-colors"
                      style={{ color: buttonColor }}
                    >
                      {loading ? 'Cargando...' : 'Ver más reseñas'}
                    </button>
                  )}
                </>
              )}
            </div>
            </>)}

            {/* ── Google reviews ── */}
            {source === 'google' && (
              <>
                <div className="px-5 pt-2 pb-4 border-b border-gray-100 flex items-center gap-3">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-gray-800">{googleData.rating ? googleData.rating.toFixed(1) : '—'}</div>
                    <div className="flex items-center justify-center gap-0.5 mt-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <svg key={s} className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={s <= Math.round(googleData.rating || 0) ? '#facc15' : '#e5e7eb'}>
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{googleData.reviewCount || 0} en Google</p>
                  </div>
                  <div className="flex-1" />
                  {(googleData.mapsUrl || googleData.reviewUrl) && (
                    <a
                      href={googleData.mapsUrl || googleData.reviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-xl transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 010-4.2V7.06H2.18a11 11 0 000 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
                      Ver en Google
                    </a>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-3 space-y-4">
                  {googleReviews.length === 0 ? (
                    <div className="text-center py-10">
                      <NotebookPen className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm text-gray-500">No hay reseñas escritas de Google</p>
                      <p className="text-xs text-gray-400 mt-1">Google comparte hasta 5 reseñas destacadas</p>
                    </div>
                  ) : (
                    googleReviews.map((r, i) => (
                      <div key={i} className="pb-4 border-b border-gray-50 last:border-0">
                        <div className="flex items-start gap-2.5">
                          {r.photo ? (
                            <img src={r.photo} alt={r.author} referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 bg-gray-400">
                              {r.author?.[0]?.toUpperCase() || '?'}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-gray-800 truncate">{r.author}</span>
                              <span className="text-xs text-gray-400 flex-shrink-0">{r.relativeTime}</span>
                            </div>
                            <div className="flex items-center gap-0.5 mt-0.5">
                              {[1, 2, 3, 4, 5].map(s => (
                                <svg key={s} className="w-3 h-3" viewBox="0 0 24 24" fill={s <= r.rating ? '#facc15' : '#e5e7eb'}>
                                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                </svg>
                              ))}
                            </div>
                          </div>
                        </div>
                        {r.text && <p className="text-sm text-gray-600 mt-2 leading-relaxed">{r.text}</p>}
                      </div>
                    ))
                  )}
                  <p className="text-[10px] text-gray-300 text-center pt-1">Reseñas provistas por Google</p>
                </div>
              </>
            )}

            {/* Close button */}
            <div className="p-4 pt-2 border-t border-gray-100">
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 active:bg-gray-200 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ReviewsSheet;
