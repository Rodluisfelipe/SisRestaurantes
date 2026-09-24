import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Star } from 'lucide-react';
import api from '../services/api';
import logger from '../utils/logger';
import ProductCard from './Productcard';
import { Insignia } from './ui';
import { esTienda, palabras } from '../utils/tienda';
import { isPromoActive } from '../utils/promo';
import { FeaturedProductsSkeleton } from './MenuSkeletons';
import { useBusinessConfig } from '../Context/BusinessContext';

/**
 * Componente para mostrar productos destacados del negocio
 * Estos son seleccionados por el administrador, no son favoritos personales
 */
const FeaturedProducts = ({ businessId, products, onAddToCart, theme, onToppingsOpen, onToppingsClose, isViewOnly = false }) => {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);
  const { businessConfig } = useBusinessConfig();
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);
  const tienda = esTienda(businessConfig);
  const copy = palabras(tienda);

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

      <div className="relative px-3 sm:px-4 lg:px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div 
              className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm"
              style={{ backgroundColor: buttonColor, boxShadow: `0 4px 12px ${buttonColor}30` }}
            >
              <Sparkles className="w-4 h-4" style={{ color: buttonTextColor }} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight leading-tight">Destacados</h2>
              <p className="text-2xs text-tinta-3 font-medium -mt-0.5">{isService ? 'Los más solicitados' : copy.destacados}</p>
            </div>
          </div>
          <span className="text-2xs font-semibold text-tinta-3">{featuredToShow.length + promoProducts.length} {isService ? 'servicios' : 'productos'}</span>
        </div>

        {/* ── Horizontal scroll — 2 cards visible at a time ── */}
        <div
          ref={scrollRef}
          className="flex overflow-x-auto gap-3 pb-1 snap-x snap-mandatory scrollbar-hide -mx-3 px-3 sm:-mx-4 sm:px-4"
        >
          {promoProducts.map((product) => (
            <div key={`promo-${product._id}`} className="flex-shrink-0 snap-start" style={{ width: 'min(calc(50% - 6px), 260px)' }}>
              <ProductCard
                product={product}
                addToCart={onAddToCart}
                onToppingsOpen={onToppingsOpen}
                onToppingsClose={onToppingsClose}
                isViewOnly={isViewOnly}
              />
            </div>
          ))}
          {featuredToShow.map((product) => (
            <div
              key={product._id}
              className="flex-shrink-0 snap-start"
              style={{ width: 'min(calc(50% - 6px), 260px)' }}
            >
              <ProductCard
                product={product}
                addToCart={onAddToCart}
                onToppingsOpen={onToppingsOpen}
                onToppingsClose={onToppingsClose}
                isViewOnly={isViewOnly}
                insignia={
                  <Insignia tono="marca" className="shadow-sm" icono={<Star className="w-3 h-3 fill-current" />}>
                    <span className="hidden sm:inline">Destacado</span>
                  </Insignia>
                }
              />
            </div>
          ))}
        </div>
      </div>

      {/* CSS for line-clamp + scrollbar hide */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </motion.div>
  );
};

export default FeaturedProducts;
