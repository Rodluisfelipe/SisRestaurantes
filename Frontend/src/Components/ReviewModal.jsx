import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

/**
 * Modal para que el cliente deje una reseña después de completar un pedido
 * Incluye rating general + "¿Qué tal estuvo?" con thumbs up/down + producto destacado
 */
const ReviewModal = ({ show, onClose, businessId, orderId, customerName, customerPhone, theme, topProduct, googleReviewUrl, reviewMode = 'funnel', googleThreshold = 4 }) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [thumbsUp, setThumbsUp] = useState(null); // null | true | false
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [productImageError, setProductImageError] = useState(false);
  // Elección de dónde calificar: null = aún no elige (solo si hay Google), 'internal' = aquí
  const [choice, setChoice] = useState('internal');

  const buttonColor = theme?.buttonColor || '#f97316';

  // URL de Google efectiva (nula en modo "solo interna")
  const gUrl = reviewMode === 'internal' ? null : googleReviewUrl;
  const showChoice = reviewMode === 'choice' && !!gUrl;
  // ¿Mostrar el CTA a Google tras enviar? (modo embudo + calificación alta)
  const showFunnelCta = reviewMode === 'funnel' && !!gUrl && rating >= googleThreshold;

  // Reset state when modal opens with new order
  useEffect(() => {
    if (show) {
      setRating(0);
      setHoverRating(0);
      setComment('');
      setThumbsUp(null);
      setSubmitted(false);
      setError(null);
      setProductImageError(false);
      // En modo "elección" preguntamos primero dónde calificar
      setChoice(reviewMode === 'choice' && !!gUrl ? null : 'internal');
    }
  }, [show, orderId, reviewMode, gUrl]);

  const goToGoogle = () => {
    window.open(gUrl, '_blank', 'noopener');
    onClose(true);
  };

  const handleSubmit = async () => {
    if (rating === 0) return;
    try {
      setSubmitting(true);
      setError(null);
      const payload = {
        phone: customerPhone,
        businessId,
        orderId,
        customerName,
        rating,
        comment: comment.trim()
      };
      if (thumbsUp !== null) {
        payload.thumbsUp = thumbsUp;
      }
      await api.post('/reviews', payload);
      setSubmitted(true);
      // En modo embudo con calificación alta, mostramos el CTA a Google (no auto-cerramos)
      if (!showFunnelCta) {
        setTimeout(() => { onClose(true); }, 1800);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Error al enviar reseña';
      if (msg.includes('Ya existe')) {
        setError('Ya dejaste una reseña para este pedido');
        setTimeout(() => onClose(false), 1500);
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    onClose(false);
  };

  const starLabels = ['', 'Malo', 'Regular', 'Bueno', 'Muy bueno', 'Excelente'];

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4"
          onClick={handleSkip}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {submitted ? (
              showFunnelCta ? (
                /* Embudo: calificación alta → invitar a reseñar en Google */
                <div className="p-7 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 12 }}
                    className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"
                    style={{ backgroundColor: buttonColor + '15' }}
                  >
                    <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke={buttonColor} strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </motion.div>
                  <h3 className="text-lg font-bold text-gray-800">¡Gracias! 🎉</h3>
                  <p className="text-sm text-gray-500 mt-1 mb-4">
                    ¿Nos ayudas con una reseña en Google? Solo te toma 10 segundos y nos ayuda muchísimo.
                  </p>
                  <a
                    href={gUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setTimeout(() => onClose(true), 400)}
                    className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-95 mb-2"
                    style={{ backgroundColor: buttonColor }}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" opacity=".9"/><path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z" opacity=".75"/><path fill="#fff" d="M5.84 14.1a6.6 6.6 0 010-4.2V7.06H2.18a11 11 0 000 9.88l3.66-2.84z" opacity=".6"/><path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" opacity=".85"/></svg>
                    Reseñar en Google
                  </a>
                  <button
                    onClick={() => onClose(true)}
                    className="w-full py-2 text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Ahora no
                  </button>
                </div>
              ) : (
              /* Success state */
              <div className="p-8 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12 }}
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"
                  style={{ backgroundColor: buttonColor + '15' }}
                >
                  <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke={buttonColor} strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </motion.div>
                <h3 className="text-lg font-bold text-gray-800">¡Gracias por tu reseña!</h3>
                <p className="text-sm text-gray-500 mt-1">Tu opinión nos ayuda a mejorar</p>
              </div>
              )
            ) : (showChoice && choice === null) ? (
              /* Elección: dónde calificar (solo si el negocio tiene Google vinculado) */
              <div className="p-6 text-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: buttonColor + '15' }}>
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill={buttonColor}>
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-800">¿Dónde quieres calificarnos?</h3>
                <p className="text-sm text-gray-500 mt-1 mb-5">Tu opinión nos ayuda a crecer 💜</p>

                {/* Calificar aquí (interna) */}
                <button
                  onClick={() => setChoice('internal')}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl border mb-2.5 active:scale-[0.98] transition-transform text-left"
                  style={{ borderColor: buttonColor + '33', backgroundColor: buttonColor + '0a' }}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: buttonColor + '1f' }}>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill={buttonColor}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800">Calificar aquí</p>
                    <p className="text-xs text-gray-500">Rápido, en el mismo menú</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
                </button>

                {/* Reseñar en Google */}
                <button
                  onClick={goToGoogle}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-gray-200 active:scale-[0.98] transition-transform text-left hover:bg-gray-50"
                >
                  <div className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 010-4.2V7.06H2.18a11 11 0 000 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800">Reseñar en Google</p>
                    <p className="text-xs text-gray-500">Ayuda al negocio a crecer en Google</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
                </button>

                <button onClick={handleSkip} className="mt-3 text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors">
                  Ahora no
                </button>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="p-5 pb-3 text-center" style={{ background: `linear-gradient(180deg, ${buttonColor}0d 0%, transparent 100%)` }}>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: buttonColor + '15' }}>
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill={buttonColor} stroke="none">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">¿Cómo fue tu experiencia?</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Tu opinión es muy importante</p>
                </div>

                {/* Stars */}
                <div className="px-5 pb-2">
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setRating(star)}
                        className="p-1 transition-transform active:scale-90"
                        style={{ transform: (hoverRating || rating) >= star ? 'scale(1.15)' : 'scale(1)' }}
                      >
                        <svg
                          className="w-10 h-10 transition-colors"
                          viewBox="0 0 24 24"
                          fill={(hoverRating || rating) >= star ? '#facc15' : '#e5e7eb'}
                          stroke={(hoverRating || rating) >= star ? '#eab308' : '#d1d5db'}
                          strokeWidth="0.5"
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </button>
                    ))}
                  </div>
                  {(hoverRating || rating) > 0 && (
                    <p className="text-center text-sm font-medium mt-1" style={{ color: buttonColor }}>
                      {starLabels[hoverRating || rating]}
                    </p>
                  )}
                </div>

                {/* Thumbs Up/Down — "¿Qué tal estuvo?" with top product */}
                {rating > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.3 }}
                    className="px-5 pb-3"
                  >
                    <div className="rounded-xl p-3 border" style={{ backgroundColor: buttonColor + '0a', borderColor: buttonColor + '20' }}>
                      <p className="text-xs text-gray-400 text-center mb-2.5">¿Qué tal estuvo?</p>
                      {/* Top product highlight */}
                      {topProduct && (
                        <div className="flex items-center gap-3 mb-3">
                          {topProduct.image && !productImageError ? (
                            <img
                              src={topProduct.image}
                              alt={topProduct.name}
                              className="w-14 h-14 rounded-xl object-cover shadow-sm"
                              onError={() => setProductImageError(true)}
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ backgroundColor: buttonColor + '15' }}>
                              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke={buttonColor} strokeWidth={1.5}>
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <path d="M21 15l-5-5L5 21" />
                              </svg>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-700 truncate">{topProduct.name}</p>
                            {topProduct.price > 0 && (
                              <p className="text-xs text-gray-400">
                                ${Number(topProduct.price).toLocaleString('es-CO')}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      {/* Thumbs buttons */}
                      <div className="flex justify-center gap-4">
                        <button
                          type="button"
                          onClick={() => setThumbsUp(thumbsUp === true ? null : true)}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 border"
                          style={thumbsUp === true
                            ? { backgroundColor: buttonColor, color: '#ffffff', borderColor: buttonColor, boxShadow: `0 4px 10px ${buttonColor}30` }
                            : { backgroundColor: '#ffffff', color: '#6b7280', borderColor: '#e5e7eb' }}
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M2 20h2c.55 0 1-.45 1-1v-9c0-.55-.45-1-1-1H2v11zm19.83-7.12c.11-.25.17-.52.17-.8V11c0-1.1-.9-2-2-2h-5.5l.92-4.65c.05-.22.02-.46-.08-.66-.23-.45-.52-.86-.88-1.22L14 2 7.59 8.41C7.21 8.79 7 9.3 7 9.83v7.84C7 18.95 8.05 20 9.34 20h8.11c.7 0 1.36-.37 1.72-.97l2.66-6.15z" />
                          </svg>
                          Me gustó
                        </button>
                        <button
                          type="button"
                          onClick={() => setThumbsUp(thumbsUp === false ? null : false)}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 border"
                          style={thumbsUp === false
                            ? { backgroundColor: buttonColor, color: '#ffffff', borderColor: buttonColor, boxShadow: `0 4px 10px ${buttonColor}30` }
                            : { backgroundColor: '#ffffff', color: '#6b7280', borderColor: '#e5e7eb' }}
                        >
                          <svg className="w-5 h-5 rotate-180" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M2 20h2c.55 0 1-.45 1-1v-9c0-.55-.45-1-1-1H2v11zm19.83-7.12c.11-.25.17-.52.17-.8V11c0-1.1-.9-2-2-2h-5.5l.92-4.65c.05-.22.02-.46-.08-.66-.23-.45-.52-.86-.88-1.22L14 2 7.59 8.41C7.21 8.79 7 9.3 7 9.83v7.84C7 18.95 8.05 20 9.34 20h8.11c.7 0 1.36-.37 1.72-.97l2.66-6.15z" />
                          </svg>
                          No tanto
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Comment */}
                {rating > 0 && (
                  <div className="px-5 pb-3">
                    <textarea
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      placeholder="Cuéntanos más sobre tu experiencia (opcional)"
                      maxLength={500}
                      rows={3}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-800 bg-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:border-transparent"
                      style={{ '--tw-ring-color': buttonColor + '40' }}
                    />
                    <p className="text-right text-xs text-gray-400 mt-0.5">{comment.length}/500</p>
                  </div>
                )}

                {error && (
                  <p className="px-5 pb-2 text-center text-sm text-red-500">{error}</p>
                )}

                {/* Actions */}
                <div className="p-5 pt-2 flex gap-3">
                  <button
                    onClick={handleSkip}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors border"
                    style={{ color: buttonColor, backgroundColor: buttonColor + '0a', borderColor: buttonColor + '25' }}
                  >
                    Ahora no
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={rating === 0 || submitting}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
                    style={{ backgroundColor: buttonColor }}
                  >
                    {submitting ? (
                      <span className="inline-flex items-center gap-1.5">
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
                        </svg>
                        Enviando...
                      </span>
                    ) : 'Enviar reseña'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ReviewModal;
