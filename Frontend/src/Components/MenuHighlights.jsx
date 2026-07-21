import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import logger from '../utils/logger';
import ProductCard from './Productcard';
import { isPromoActive } from '../utils/promo';

const HI = {
  star: (cls = 'w-3.5 h-3.5') => <svg className={cls} viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  flame: (cls = 'w-3.5 h-3.5') => <svg className={cls} viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 23c-3.6 0-7-2.4-7-7 0-3.2 2.1-5.8 3.8-7.8L12 4l3.2 4.2C16.9 10.2 19 12.8 19 16c0 4.6-3.4 7-7 7z"/></svg>,
};

/**
 * Sección unificada de "destacados": una sola franja con chips para alternar
 * entre ⭐ Destacados y 🔥 Más pedidos (ahorra espacio vs dos secciones apiladas).
 * Si hay promo del día activa, ese producto va como PRIMERA card (con su badge,
 * cuenta regresiva y precio promo, todo vía ProductCard).
 */
export default function MenuHighlights({
  businessId, products, addToCart, onToppingsOpen = () => {}, onToppingsClose = () => {},
  subscriptionStatus = null, isViewOnly = false, theme,
}) {
  const [featured, setFeatured] = useState([]);
  const [popular, setPopular] = useState({ enabled: false, products: [], title: 'Los más pedidos' });
  const [tab, setTab] = useState('featured'); // 'featured' | 'popular'

  useEffect(() => {
    if (!businessId) return;
    api.get(`/products/featured?businessId=${businessId}`)
      .then(r => setFeatured(r.data || [])).catch((e) => { logger.error('featured', e); setFeatured([]); });
    api.get(`/products/popular?businessId=${businessId}`)
      .then(r => setPopular(r.data || { enabled: false, products: [] }))
      .catch((e) => { logger.error('popular', e); setPopular({ enabled: false, products: [] }); });
  }, [businessId]);

  const promoList = useMemo(() => (products || []).filter(isPromoActive), [products]);

  const featuredList = Array.isArray(featured) ? featured : [];
  const popularList = popular?.enabled ? (popular.products || []) : [];
  const hasFeatured = featuredList.length > 0;
  const hasPopular = popularList.length > 0;

  // Pestaña por defecto: destacados; si no hay, más pedidos.
  useEffect(() => {
    if (!hasFeatured && hasPopular) setTab('popular');
  }, [hasFeatured, hasPopular]);

  const baseList = tab === 'popular' ? popularList : (hasFeatured ? featuredList : popularList);
  const promoIds = new Set(promoList.map(p => p._id));
  const displayList = [...promoList, ...baseList.filter(p => !promoIds.has(p._id))];

  if (displayList.length === 0) return null;

  const showChips = hasFeatured && hasPopular;
  const buttonColor = theme?.buttonColor || '#f97316';

  return (
    <div className="mb-5 sm:mb-6 px-3 sm:px-4 lg:px-6">
      {/* Header con chips (o título si solo hay una lista) */}
      <div className="flex items-center justify-between mb-3 gap-2">
        {showChips ? (
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            <button
              type="button" onClick={() => setTab('featured')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${tab === 'featured' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <span style={{ color: tab === 'featured' ? buttonColor : undefined }}>{HI.star('w-3 h-3')}</span> Destacados
            </button>
            <button
              type="button" onClick={() => setTab('popular')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${tab === 'popular' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <span style={{ color: tab === 'popular' ? buttonColor : undefined }}>{HI.flame('w-3 h-3')}</span> {popular?.title || 'Más pedidos'}
            </button>
          </div>
        ) : (
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <span style={{ color: buttonColor }}>{hasPopular && !hasFeatured ? HI.flame('w-4 h-4') : HI.star('w-4 h-4')}</span>
            {hasPopular && !hasFeatured ? (popular?.title || 'Los más pedidos') : 'Destacados'}
          </h2>
        )}
        <span className="text-[11px] font-semibold text-slate-400">{displayList.length}</span>
      </div>

      {/* Scroll horizontal de cards (ProductCard → soporta promo/toppings/animación) */}
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
