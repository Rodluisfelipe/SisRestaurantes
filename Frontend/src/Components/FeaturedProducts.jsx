import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import logger from '../utils/logger';
import ProductToppingsSelector from './ProductToppingsSelector';
import ProductCard from './Productcard';
import { isPromoActive } from '../utils/promo';
import { FeaturedProductsSkeleton } from './MenuSkeletons';
import { useFlyToCart } from './FlyToCart';
import { useBusinessConfig } from '../Context/BusinessContext';

/* ── SVG Icons ── */
const FI = {
  star: (cls = 'w-3.5 h-3.5') => <svg className={cls} viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  plus: (cls = 'w-3.5 h-3.5') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  cart: (cls = 'w-3.5 h-3.5') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>,
  flame: (cls = 'w-3.5 h-3.5') => <svg className={cls} viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 23c-3.87 0-7-3.13-7-7 0-2.38 1.19-4.47 3-5.74C8 10.26 8.5 9.5 8.5 8c0-.28.22-.5.5-.5s.5.22.5.5c0 1.5-.5 2.66-.84 3.35A5.98 5.98 0 006 16c0 3.31 2.69 6 6 6s6-2.69 6-6c0-2.15-1.14-4.04-2.86-5.08A7.97 7.97 0 0112 4c0-1-.5-1.5-1-2-.5.5-1 1.5-1 2a7.97 7.97 0 01-3.14 6.92C5.14 11.96 4 13.85 4 16c0 4.42 3.58 8 8 8s8-3.58 8-8c0-4.15-3.17-7.56-7.22-7.96C13.56 7.37 14 6.74 14 6c0-1.38-1.12-3-2-4-1.5 1.5-2 3-2 4 0 .74.44 1.37 1.22 1.72C7.17 8.44 4 11.85 4 16c0 3.87 3.13 7 7 7h1z"/></svg>,
  sparkles: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z"/><path d="M5 16l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z"/><path d="M19 14l.75 2.25L22 17l-2.25.75L19 20l-.75-2.25L16 17l2.25-.75L19 14z"/></svg>,
  arrowRight: (cls = 'w-3.5 h-3.5') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
};

/**
 * Componente para mostrar productos destacados del negocio
 * Estos son seleccionados por el administrador, no son favoritos personales
 */
const FeaturedProducts = ({ businessId, products, onAddToCart, theme, onToppingsOpen, onToppingsClose, isViewOnly = false }) => {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showToppings, setShowToppings] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef(null);
  const flyToCart = useFlyToCart();
  const { businessConfig } = useBusinessConfig();
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);

  const buttonColor = theme?.buttonColor || '#f97316';
  const buttonTextColor = theme?.buttonTextColor || '#ffffff';

  useEffect(() => {
    if (businessId) {
      loadFeaturedProducts();
    }
  }, [businessId]);

  const loadFeaturedProducts = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/products/featured?businessId=${businessId}`);
      setFeaturedProducts(response.data || []);
    } catch (err) {
      logger.error('Error loading featured products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProductClick = (product) => {
    const hasToppings = product.toppingGroups && product.toppingGroups.length > 0;
    
    if (hasToppings) {
      // Si tiene toppings, abrir selector
      setSelectedProduct(product);
      setShowToppings(true);
      if (onToppingsOpen) onToppingsOpen();
    } else {
      // Si no tiene toppings, agregar directamente
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

  if (loading) {
    return <FeaturedProductsSkeleton />;
  }

  // Promo del día: va como primera(s) card(s) de la sección, sin duplicar.
  const promoProducts = (products || []).filter(isPromoActive);
  const promoIds = new Set(promoProducts.map(p => p._id));
  const featuredToShow = featuredProducts.filter(p => !promoIds.has(p._id));

  if (featuredToShow.length === 0 && promoProducts.length === 0) {
    return <div className="h-0" />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-5 sm:mb-6 relative"
    >
      {/* ── Glowing Aura backdrop ── */}
      <div
        className="absolute -inset-x-4 -top-6 -bottom-4 rounded-3xl opacity-[0.07] blur-3xl pointer-events-none"
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
              <span style={{ color: buttonTextColor }}>{FI.sparkles('w-4 h-4')}</span>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight leading-tight">Destacados</h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium -mt-0.5">{isService ? 'Los más solicitados' : 'Selección del chef'}</p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-slate-400">{featuredToShow.length + promoProducts.length} {isService ? 'servicios' : 'productos'}</span>
        </div>

        {/* ── Horizontal scroll — 2 cards visible at a time ── */}
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
          {featuredToShow.map((product, index) => {
            const hasToppings = product.toppingGroups && product.toppingGroups.length > 0;
            return (
              <motion.div
                key={product._id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.06 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleProductClick(product)}
                className="flex-shrink-0 snap-start cursor-pointer group border border-slate-100 overflow-hidden bg-white transition-shadow duration-300"
                style={{ width: 'calc(50% - 6px)', borderRadius: '20px', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)' }}
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
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${buttonColor}08, ${buttonColor}03)` }}
                    >
                      <span className="text-slate-200">{FI.star('w-10 h-10')}</span>
                    </div>
                  )}

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent pointer-events-none" />

                  {/* Featured badge — top left */}
                  <span 
                    className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold shadow-sm overflow-hidden backdrop-blur-sm"
                    style={{ 
                      backgroundColor: `${buttonColor}d0`,
                      color: buttonTextColor,
                    }}
                  >
                    {FI.star('w-2.5 h-2.5')}
                    <span className="hidden sm:inline">Destacado</span>
                  </span>

                  {/* Price — bottom left */}
                  <div className="absolute bottom-2.5 left-3 z-[2]">
                    <span className="text-[15px] sm:text-lg font-black text-white drop-shadow-lg">
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
                    className="absolute bottom-2 right-2.5 z-[2] w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shadow-lg backdrop-blur-md transition-all active:scale-90"
                    style={{ 
                      backgroundColor: `${buttonColor}e0`,
                      color: buttonTextColor,
                      boxShadow: `0 4px 16px ${buttonColor}40`
                    }}
                    aria-label={hasToppings ? `Personalizar ${product.name}` : `Agregar ${product.name} al carrito`}
                  >
                    {hasToppings ? FI.plus('w-4 h-4') : FI.cart('w-4 h-4')}
                  </button>
                </div>

                {/* Product Info — compact */}
                <div className="px-3 py-2 sm:px-3.5">
                  <h3 className="font-bold text-[13px] sm:text-sm text-slate-800 leading-tight line-clamp-1">
                    {product.name}
                  </h3>
                  {product.description && (
                    <p className="text-[10px] sm:text-[11px] text-slate-400 leading-relaxed mt-0.5 line-clamp-1">
                      {product.description}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Modal de Toppings */}
      {showToppings && selectedProduct && (
        <div onClick={(e) => e.stopPropagation()}>
          <ProductToppingsSelector
            product={{
              ...selectedProduct,
              toppingGroups: Array.isArray(selectedProduct.toppingGroups) ? selectedProduct.toppingGroups : []
            }}
            onAddToCart={(p) => {
              // Fly animation after toppings are configured
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

      {/* CSS for line-clamp + scrollbar hide */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
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

export default FeaturedProducts;
