import React, { useState, useEffect, useCallback } from 'react';
import { Star, X } from 'lucide-react';
import api from '../services/api';
import { imageAt } from '../utils/imageCdn';

/**
 * "¿Qué tal estuvo tu pedido?": recuerda calificar el último pedido entregado.
 *
 * Las estrellas se tocan aquí mismo: la que toque abre el modal con esa
 * calificación ya puesta (un toque menos). Antes era un botón de color con
 * un texto, y después de calificar seguía ahí hasta recargar la página: nadie
 * le avisaba. Ahora escucha `mb:resena` (lo manda el menú al cerrar el
 * modal) y se va en ese momento.
 */
const PendingReviewCard = ({ businessId, customerPhone, themeColor, onReview }) => {
  const [pendingOrder, setPendingOrder] = useState(null);
  const [oculta, setOculta] = useState(false);
  const [imageError, setImageError] = useState(false);

  const fetchPending = useCallback(async () => {
    if (!customerPhone || !businessId) return;
    try {
      const { data } = await api.get('/reviews/pending', { params: { phone: customerPhone, businessId } });
      const order = data?.pendingOrder;
      if (order && !localStorage.getItem(`dismissed_review_${order._id}`)) {
        setImageError(false);
        setPendingOrder(order);
      } else {
        setPendingOrder(null);
      }
    } catch {
      setPendingOrder(null);
    }
  }, [customerPhone, businessId]);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  // Calificado o cerrado el modal: la tarjeta se va ya.
  useEffect(() => {
    const alCalificar = (e) => {
      if (!e.detail?.orderId || e.detail.orderId === pendingOrder?._id) setOculta(true);
    };
    window.addEventListener('mb:resena', alCalificar);
    return () => window.removeEventListener('mb:resena', alCalificar);
  }, [pendingOrder?._id]);

  const ahoraNo = () => {
    if (pendingOrder) localStorage.setItem(`dismissed_review_${pendingOrder._id}`, '1');
    setOculta(true);
  };

  if (!pendingOrder || oculta) return null;

  const color = themeColor || '#f97316';
  const product = pendingOrder.topProduct;
  const cuantos = pendingOrder.itemCount || 0;

  return (
    <div className="w-full mb-3 rounded-2xl border border-slate-200 bg-white shadow-sm p-3.5 animate-aparecer">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onReview?.(pendingOrder, 0)}
          className="flex-shrink-0"
          aria-label="Calificar tu pedido"
        >
          {product?.image && !imageError ? (
            <img src={imageAt(product.image, 120)} alt="" className="w-14 h-14 rounded-2xl object-cover" onError={() => setImageError(true)} />
          ) : (
            <span className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
              <Star className="w-6 h-6" style={{ color }} fill={color} />
            </span>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-black text-slate-900 leading-tight">¿Qué tal estuvo tu pedido?</p>
          <p className="text-xs text-slate-500 truncate mt-0.5">
            {product?.name || `Pedido #${pendingOrder.orderNumber}`}{cuantos > 1 ? ` y ${cuantos - 1} más` : ''}
          </p>
          {/* Un toque en una estrella y el modal abre con esa calificación. */}
          <div className="flex items-center gap-1 mt-1.5" role="group" aria-label="Califica de 1 a 5 estrellas">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onReview?.(pendingOrder, n)}
                className="w-9 h-9 -ml-1 first:ml-0 flex items-center justify-center rounded-full active:scale-90 transition-transform"
                aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
              >
                <Star className="w-7 h-7 text-slate-300" strokeWidth={1.6} />
              </button>
            ))}
          </div>
        </div>
        <button type="button" onClick={ahoraNo} className="w-8 h-8 -mt-1 -mr-1 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 flex-shrink-0" aria-label="Ahora no">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default PendingReviewCard;
