import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

/**
 * Tarjeta que recuerda al cliente calificar su último pedido completado.
 * Se muestra debajo del banner de pedido activo en el menú.
 * Se puede cerrar (dismiss) y se guarda en localStorage.
 */
const PendingReviewCard = ({ businessId, customerPhone, themeColor, onReview }) => {
  const [pendingOrder, setPendingOrder] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchPending = useCallback(async () => {
    if (!customerPhone || !businessId) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/reviews/pending', {
        params: { phone: customerPhone, businessId }
      });
      if (data.pendingOrder) {
        // Check if already dismissed in localStorage
        const key = `dismissed_review_${data.pendingOrder._id}`;
        if (localStorage.getItem(key)) {
          setPendingOrder(null);
        } else {
          setPendingOrder(data.pendingOrder);
        }
      } else {
        setPendingOrder(null);
      }
    } catch {
      setPendingOrder(null);
    } finally {
      setLoading(false);
    }
  }, [customerPhone, businessId]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleDismiss = (e) => {
    e.stopPropagation();
    if (pendingOrder) {
      localStorage.setItem(`dismissed_review_${pendingOrder._id}`, '1');
    }
    setDismissed(true);
  };

  const handleReview = () => {
    if (pendingOrder && onReview) {
      onReview(pendingOrder);
    }
  };

  if (loading || !pendingOrder || dismissed) return null;

  const color = themeColor || '#f97316';
  const product = pendingOrder.topProduct;

  return (
    <AnimatePresence>
      <motion.div
        key="pending-review-card"
        initial={{ opacity: 0, scaleY: 0 }}
        animate={{ opacity: 1, scaleY: 1 }}
        exit={{ opacity: 0, scaleY: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full mb-3 rounded-2xl overflow-hidden shadow-sm origin-top"
        style={{ backgroundColor: '#f59e0b' }}
      >
        <button
          onClick={handleReview}
          className="w-full active:scale-[0.98] transition-transform"
          aria-label="Califica tu último pedido"
        >
          <div className="flex items-center gap-3 px-4 py-3">
            {/* Product image or star icon */}
            <div className="flex-shrink-0">
              {product?.image ? (
                <img src={product.image} alt={product.name} className="w-10 h-10 rounded-xl object-cover shadow-sm" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-lg">
                  ⭐
                </div>
              )}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-semibold leading-tight text-white">
                ¡Califica tu pedido!
              </p>
              <p className="text-xs mt-0.5 text-white/90 truncate">
                {product?.name ? product.name : `Pedido #${pendingOrder.orderNumber}`} · {pendingOrder.itemCount} {pendingOrder.itemCount === 1 ? 'producto' : 'productos'}
              </p>
            </div>
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </button>
        <button
          onClick={handleDismiss}
          className="w-full py-2 bg-white/20 text-white text-xs font-semibold tracking-wide active:bg-white/30 transition-colors"
        >
          AHORA NO
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

export default PendingReviewCard;
