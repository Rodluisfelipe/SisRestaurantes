import React, { useState, useEffect } from 'react';
import api from '../services/api';

/**
 * Modal para que el cliente deje una reseña después de completar un pedido
 * Usa CSS transitions (no framer-motion) para evitar TDZ en producción
 */
const ReviewModal = ({ show, onClose, businessId, orderId, customerName, customerPhone, theme }) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [visible, setVisible] = useState(false);

  const buttonColor = theme?.buttonColor || '#f97316';

  useEffect(() => {
    if (show) {
      setRating(0);
      setHoverRating(0);
      setComment('');
      setSubmitted(false);
      setError(null);
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [show]);

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
      setTimeout(() => onClose(true), 1800);
    } catch (err) {
      const msg = err.response?.data?.message || 'Error al enviar reseña';
      if (msg.includes('Ya existe') || msg.includes('Ya calificaste')) {
        setError('Ya dejaste una reseña para este pedido');
        setTimeout(() => onClose(false), 1500);
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => onClose(false);
  const starLabels = ['', 'Malo', 'Regular', 'Bueno', 'Muy bueno', 'Excelente'];

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center p-4 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={handleSkip}
    >
      <div
        className={`bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden transition-transform duration-200 ${visible ? 'scale-100' : 'scale-95'}`}
        onClick={e => e.stopPropagation()}
      >
        {submitted ? (
          <div className="p-8 text-center">
            <div className="text-5xl mb-3">🎉</div>
            <h3 className="text-lg font-bold text-gray-800">¡Gracias por tu reseña!</h3>
            <p className="text-sm text-gray-500 mt-1">Tu opinión nos ayuda a mejorar</p>
          </div>
        ) : (
          <>
            <div className="p-5 pb-3 text-center">
              <h3 className="text-lg font-bold text-gray-800">¿Cómo fue tu experiencia?</h3>
              <p className="text-sm text-gray-500 mt-0.5">Tu opinión es muy importante</p>
            </div>

            <div className="px-5 pb-2">
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="p-1 active:scale-90 transition-transform"
                    style={{ transform: (hoverRating || rating) >= star ? 'scale(1.15)' : 'scale(1)' }}
                  >
                    <svg className="w-10 h-10" viewBox="0 0 24 24"
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

            {rating > 0 && (
              <div className="px-5 pb-3">
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Cuéntanos más sobre tu experiencia (opcional)"
                  maxLength={500}
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': buttonColor + '40' }}
                />
                <p className="text-right text-xs text-gray-400 mt-0.5">{comment.length}/500</p>
              </div>
            )}

            {error && (
              <p className="px-5 pb-2 text-center text-sm text-red-500">{error}</p>
            )}

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
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-opacity"
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
      </div>
    </div>
  );
};

export default ReviewModal;
