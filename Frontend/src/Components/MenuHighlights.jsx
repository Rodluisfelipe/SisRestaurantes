import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import logger from '../utils/logger';
import ProductCard from './Productcard';
import { isPromoActive } from '../utils/promo';

const HI = {
  star: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
};

/**
 * Sección unificada de destacados: UNA sola franja que mezcla ⭐ Destacados y
 * 🔥 Más pedidos, ALTERNANDO uno y otro sin repetir (ahorra espacio vs dos
 * secciones apiladas). Si hay promo del día activa, ese producto va PRIMERO,
 * con su badge, cuenta regresiva y precio promo (todo vía ProductCard).
 */
export default function MenuHighlights({
  businessId, products, addToCart, onToppingsOpen = () => {}, onToppingsClose = () => {},
  subscriptionStatus = null, isViewOnly = false, theme,
}) {
  const [featured, setFeatured] = useState([]);
  const [popular, setPopular] = useState({ enabled: false, products: [] });

  useEffect(() => {
    if (!businessId) return;
    api.get(`/products/featured?businessId=${businessId}`)
      .then(r => setFeatured(r.data || [])).catch((e) => { logger.error('featured', e); setFeatured([]); });
    api.get(`/products/popular?businessId=${businessId}`)
      .then(r => setPopular(r.data || { enabled: false, products: [] }))
      .catch((e) => { logger.error('popular', e); setPopular({ enabled: false, products: [] }); });
  }, [businessId]);

  const displayList = useMemo(() => {
    const featuredList = Array.isArray(featured) ? featured : [];
    const popularList = popular?.enabled ? (popular.products || []) : [];
    const promoList = (products || []).filter(isPromoActive);

    const used = new Set();
    const out = [];
    const push = (p) => { if (p && !used.has(p._id)) { out.push(p); used.add(p._id); } };

    // 1) Promo del día primero.
    promoList.forEach(push);

    // 2) Mezclar destacados y más pedidos alternando, sin repetir.
    const max = Math.max(featuredList.length, popularList.length);
    for (let i = 0; i < max; i++) {
      push(featuredList[i]);
      push(popularList[i]);
    }
    return out;
  }, [featured, popular, products]);

  if (displayList.length === 0) return null;

  const buttonColor = theme?.buttonColor || '#f97316';

  return (
    <div className="mb-5 sm:mb-6 px-3 sm:px-4 lg:px-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
          <span style={{ color: buttonColor }}>{HI.star('w-4 h-4')}</span>
          Destacados
        </h2>
        <span className="text-[11px] font-semibold text-slate-400">{displayList.length}</span>
      </div>

      {/* Scroll horizontal de cards (ProductCard → promo/toppings/animación incluidos) */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
        {displayList.map(product => (
          <div key={product._id} className="w-40 sm:w-44 flex-shrink-0">
            <ProductCard
              product={product}
              addToCart={addToCart}
              onToppingsOpen={onToppingsOpen}
              onToppingsClose={onToppingsClose}
              subscriptionStatus={subscriptionStatus}
              isViewOnly={isViewOnly}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
