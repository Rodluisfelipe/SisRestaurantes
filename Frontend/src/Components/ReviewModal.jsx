import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

/**
 * Modal para que el cliente deje una reseña después de completar un pedido
 * Se muestra después de que el pedido es marcado como completado/entregado
 */
const ReviewModal = ({ show, onClose, businessId, orderId, customerName, customerPhone, theme }) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const buttonColor = theme?.buttonColor || '#f97316';

  const handleSubmit = async () => {
    if (rating === 0) return;
    try {
      setSubmitting(true);
      setError(null);
      await api.post('/reviews', {
        phone: customerPhone,
        businessId,
        orderId,
        customerName,
        rating,
        comment: comment.trim()
      });
      setSubmitted(true);
      setTimeout(() => {
        onClose(true); // true = review submitted
      }, 1800);
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
              /* Success state */
              <div className="p-8 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12 }}
                  className="text-5xl mb-3"
                >
                  🎉
                </motion.div>
                <h3 className="text-lg font-bold text-gray-800">¡Gracias por tu reseña!</h3>
                <p className="text-sm text-gray-500 mt-1">Tu opinión nos ayuda a mejorar</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="p-5 pb-3 text-center">
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
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 bg-gray-100 active:bg-gray-200 transition-colors"
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
