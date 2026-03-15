import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

/**
 * Bottom sheet que muestra las reseñas de un restaurante
 * Incluye distribución de estrellas y lista paginada
 */
const ReviewsSheet = ({ show, onClose, businessId, reviewStats, theme }) => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filterRating, setFilterRating] = useState(null);
  const listRef = useRef(null);

  const buttonColor = theme?.buttonColor || '#f97316';
  const stats = reviewStats || { averageRating: 0, totalReviews: 0, ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };

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
                  className="mt-2 text-xs font-medium px-3 py-1 rounded-full bg-gray-100 text-gray-600"
                >
                  Limpiar filtro ✕
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
                  <p className="text-3xl mb-2">📝</p>
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
                              <span className="ml-1.5 text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">
                                {review.orderType === 'delivery' ? '🛵 Delivery' : review.orderType === 'takeaway' ? '🥡 Para llevar' : '🍽️ En mesa'}
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
