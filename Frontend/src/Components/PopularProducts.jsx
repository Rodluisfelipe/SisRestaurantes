import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import logger from '../utils/logger';
import ProductToppingsSelector from './ProductToppingsSelector';
import ProductCard from './Productcard';
import { isPromoActive } from '../utils/promo';
import { FeaturedProductsSkeleton } from './MenuSkeletons';
import { useFlyToCart } from './FlyToCart';
import { useBusinessConfig } from '../Context/BusinessContext';
import { radii, shadows, productNameSize, alpha, TOUCH_TARGET } from '../utils/menuTokens';

/* Umbral de prueba social: por debajo de esto el número resta en vez de sumar
   ("1 pedido esta semana" no vende). Si no llega, se muestra otra cosa. */
const SOCIAL_PROOF_MIN = 15;

/* ── SVG Icons ── */
const PI = {
  flame: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M13.5 0.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"/></svg>,
  plus: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  cart: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>,
  heart: (cls = 'w-3 h-3') => <svg className={cls} viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>,
  trophy: (cls = 'w-3 h-3') => <svg className={cls} viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>,
};

const MEDALS = {
  1: { bg: 'linear-gradient(135deg,#FFD700,#F0A500)', label: '#1' },
  2: { bg: 'linear-gradient(135deg,#C0C0C0,#9CA3AF)', label: '#2' },
  3: { bg: 'linear-gradient(135deg,#CD7F32,#B45309)', label: '#3' },
};

/**
 * "Los más pedidos" — sección premium del menú.
 * Ranking dinámico por ventas reales + híbrido (destacados/favoritos) con badges de prueba social.
 */
const PopularProducts = ({ businessId, products: allMenuProducts, onAddToCart, theme, onToppingsOpen, onToppingsClose, isViewOnly = false }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showToppings, setShowToppings] = useState(false);
  const scrollRef = useRef(null);
  const flyToCart = useFlyToCart();
  const { businessConfig } = useBusinessConfig();
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);

  const buttonColor = theme?.buttonColor || '#f97316';
  const buttonTextColor = theme?.buttonTextColor || '#ffffff';

  useEffect(() => {
    if (businessId) loadPopular();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const loadPopular = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/products/popular?businessId=${businessId}`);
      setData(response.data || null);
    } catch (err) {
      logger.error('Error loading popular products:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleProductClick = (product) => {
    const hasToppings = product.toppingGroups && product.toppingGroups.length > 0;
    if (hasToppings) {
      setSelectedProduct(product);
      setShowToppings(true);
      if (onToppingsOpen) onToppingsOpen();
    } else {
      handleAddToCart(product);
    }
  };

  const handleAddToCart = (product) => {
    if (onAddToCart) {
      onAddToCart({
        ...product,
        quantity: 1,
        selectedToppings: product.selectedToppings || [],
        selectedOptions: product.selectedOptions || {}
      });
    }
  };

  const handleCloseToppings = () => {
    setShowToppings(false);
    setSelectedProduct(null);
    if (onToppingsClose) onToppingsClose();
  };

  if (loading) return <FeaturedProductsSkeleton />;

  const products = data?.products || [];
  if (!data?.enabled || products.length === 0) return <div className="h-0" />;

  // Promo del día: primera(s) card(s) de la sección, sin duplicar.
  const promoProducts = (allMenuProducts || []).filter(isPromoActive);
  const promoIds = new Set(promoProducts.map(p => p._id));
  const popularToShow = products.filter(p => !promoIds.has(p._id));

  const showBadges = data.showBadges !== false;
  const showCounts = data.showOrderCounts !== false;
  const title = data.title || 'Los más pedidos';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-5 sm:mb-6 relative"
    >
      {/* Glowing aura backdrop */}
      <div
        className="absolute -inset-x-4 -top-6 -bottom-4 rounded-3xl opacity-[0.08] blur-3xl pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 40%, ${buttonColor}, transparent 70%)` }}
      />

      <div className="relative px-3 sm:px-4 lg:px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm"
              style={{ backgroundColor: buttonColor, boxShadow: `0 4px 12px ${buttonColor}30` }}
            >
              <span style={{ color: buttonTextColor }}>{PI.flame('w-4 h-4')}</span>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight leading-tight flex items-center gap-1.5">
                {title}
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: `${buttonColor}1a`, color: buttonColor }}>POPULAR</span>
              </h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium -mt-0.5">{isService ? 'Los más solicitados por clientes' : 'Lo que más piden los clientes'}</p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-slate-400">{popularToShow.length + promoProducts.length}</span>
        </div>

        {/* Horizontal scroll carousel */}
        <div
          ref={scrollRef}
          className="flex overflow-x-auto gap-3 pb-1 snap-x snap-mandatory scrollbar-hide -mx-3 px-3 sm:-mx-4 sm:px-4"
        >
          {promoProducts.map((product) => (
            <div key={`promo-${product._id}`} className="flex-shrink-0 snap-start" style={{ width: 'calc(50% - 6px)' }}>
              <ProductCard
                product={product}
                addToCart={onAddToCart}
                onToppingsOpen={onToppingsOpen}
                onToppingsClose={onToppingsClose}
                isViewOnly={isViewOnly}
              />
            </div>
          ))}
          {popularToShow.map((product, index) => {
            const hasToppings = product.toppingGroups && product.toppingGroups.length > 0;
            const pop = product.popular || {};
            const medal = pop.rank && MEDALS[pop.rank];
            return (
              <motion.div
                key={product._id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.06 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleProductClick(product)}
                className="flex-shrink-0 snap-start cursor-pointer group border border-slate-100 overflow-hidden bg-white transition-shadow duration-300"
                style={{ width: 'calc(50% - 6px)', borderRadius: radii.card, boxShadow: shadows.card }}
              >
                {/* Image — 4:3, igual que ProductCard */}
                <div className="relative aspect-[4/3] bg-slate-50 overflow-hidden">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    /* Placeholder de marca, nunca un gris genérico */
                    <div
                      className="w-full h-full flex items-center justify-center relative overflow-hidden"
                      style={{ background: `linear-gradient(135deg, ${alpha(buttonColor, 0.14)}, ${alpha(buttonColor, 0.05)})` }}
                    >
                      <div
                        className="absolute inset-0 opacity-[0.07]"
                        style={{ backgroundImage: `radial-gradient(${buttonColor} 1.5px, transparent 1.5px)`, backgroundSize: '14px 14px' }}
                      />
                      {businessConfig?.logo ? (
                        <img
                          src={businessConfig.logo}
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          className="relative w-12 h-12 rounded-full object-cover opacity-30"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <span className="relative opacity-25" style={{ color: buttonColor }}>{PI.flame('w-10 h-10')}</span>
                      )}
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent pointer-events-none" />

                  {/* Rank medal — top left */}
                  {medal ? (
                    <span
                      className="absolute top-2 left-2 inline-flex items-center justify-center min-w-[26px] h-[26px] px-1.5 rounded-lg text-[12px] font-black text-white shadow-md"
                      style={{ background: medal.bg }}
                    >
                      {medal.label}
                    </span>
                  ) : pop.isTopSeller ? (
                    <span
                      className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold shadow-sm backdrop-blur-sm"
                      style={{ backgroundColor: `${buttonColor}d0`, color: buttonTextColor }}
                    >
                      {PI.flame('w-2.5 h-2.5')} Top
                    </span>
                  ) : null}

                  {/* Favorite badge — top right */}
                  {showBadges && pop.isFavorite && (
                    <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[9px] font-bold shadow-sm backdrop-blur-sm bg-rose-500/90 text-white">
                      {PI.heart('w-2.5 h-2.5')} Favorito
                    </span>
                  )}

                  {/* Price — bottom left */}
                  <div className="absolute bottom-2.5 left-3 z-[2]">
                    <span className="text-[17px] tabular-nums text-white drop-shadow-lg" style={{ fontWeight: 800 }}>
                      ${product.price?.toLocaleString()}
                    </span>
                  </div>

                  {/* Add button — bottom right */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (flyToCart?.triggerFly && !hasToppings) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        flyToCart.triggerFly({
                          x: rect.left + rect.width / 2,
                          y: rect.top + rect.height / 2,
                          image: product.image,
                          color: buttonColor
                        });
                      }
                      handleProductClick(product);
                    }}
                    className="absolute bottom-2 right-2.5 z-[2] flex items-center justify-center shadow-lg backdrop-blur-md transition-all active:scale-90"
                    style={{ width: TOUCH_TARGET, height: TOUCH_TARGET, borderRadius: radii.button, backgroundColor: `${buttonColor}e0`, color: buttonTextColor, boxShadow: `0 4px 16px ${alpha(buttonColor, 0.25)}` }}
                    aria-label={hasToppings ? `Personalizar ${product.name}` : `Agregar ${product.name} al carrito`}
                  >
                    {hasToppings ? PI.plus('w-4 h-4') : PI.cart('w-4 h-4')}
                  </button>
                </div>

                {/* Product Info */}
                <div className="px-3 py-2 sm:px-3.5">
                  <h3
                    className={`font-semibold text-slate-800 leading-tight line-clamp-2 ${productNameSize(product.name)}`}
                    style={{ minHeight: '2.4em' }}
                    title={product.name}
                  >
                    {product.name}
                  </h3>
                  {/* Prueba social: el número solo se muestra si de verdad impresiona.
                      Por debajo del umbral, un sello cualitativo vende más. */}
                  {showCounts && pop.weeklyCount >= SOCIAL_PROOF_MIN ? (
                    <p className="text-[10px] sm:text-[11px] font-semibold mt-0.5 line-clamp-1 flex items-center gap-1" style={{ color: buttonColor }}>
                      {PI.flame('w-2.5 h-2.5')} {pop.weeklyCount} pedidos esta semana
                    </p>
                  ) : (medal || pop.isTopSeller) ? (
                    <p className="text-[10px] sm:text-[11px] font-semibold mt-0.5 line-clamp-1 flex items-center gap-1" style={{ color: buttonColor }}>
                      {PI.trophy('w-2.5 h-2.5')} El favorito de la casa
                    </p>
                  ) : product.description ? (
                    <p className="text-[10px] sm:text-[11px] text-slate-400 leading-relaxed mt-0.5 line-clamp-1">
                      {product.description}
                    </p>
                  ) : null}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Toppings modal */}
      {showToppings && selectedProduct && (
        <div onClick={(e) => e.stopPropagation()}>
          <ProductToppingsSelector
            product={{
              ...selectedProduct,
              toppingGroups: Array.isArray(selectedProduct.toppingGroups) ? selectedProduct.toppingGroups : []
            }}
            onAddToCart={(p) => {
              if (flyToCart?.triggerFly) {
                flyToCart.triggerFly({
                  x: window.innerWidth / 2,
                  y: window.innerHeight / 2,
                  image: p.image,
                  color: buttonColor
                });
              }
              handleAddToCart(p);
              handleCloseToppings();
            }}
            onClose={handleCloseToppings}
          />
        </div>
      )}

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .line-clamp-1 {
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </motion.div>
  );
};

export default PopularProducts;
