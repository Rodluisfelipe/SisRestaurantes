import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import logger from '../utils/logger';
import ProductCard from './Productcard';
import { Flame, Trophy } from 'lucide-react';
import { Insignia } from './ui';
import { esTienda, palabras } from '../utils/tienda';
import { isPromoActive } from '../utils/promo';
import { FeaturedProductsSkeleton } from './MenuSkeletons';
import { useBusinessConfig } from '../Context/BusinessContext';

/* Umbral de prueba social: por debajo de esto el número resta en vez de sumar
   ("1 pedido esta semana" no vende). Si no llega, se muestra otra cosa. */
const SOCIAL_PROOF_MIN = 15;

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
  const scrollRef = useRef(null);
  const { businessConfig } = useBusinessConfig();
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);
  const copy = palabras(esTienda(businessConfig));

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

  if (loading) return <FeaturedProductsSkeleton />;

  const products = data?.products || [];
  if (!data?.enabled || products.length === 0) return <div className="h-0" />;

  // Promo del día: primera(s) card(s) de la sección, sin duplicar.
  const promoProducts = (allMenuProducts || []).filter(isPromoActive);
  const promoIds = new Set(promoProducts.map(p => p._id));
  const popularToShow = products.filter(p => !promoIds.has(p._id));

  const showBadges = data.showBadges !== false;
  const showCounts = data.showOrderCounts !== false;
  const title = data.title || copy.masPedidos;

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
              <Flame className="w-4 h-4" style={{ color: buttonTextColor }} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight leading-tight flex items-center gap-1.5">
                {title}
                <Insignia tono="suave" className="rounded-md">POPULAR</Insignia>
              </h2>
              <p className="text-2xs text-tinta-3 font-medium -mt-0.5">{isService ? 'Los más solicitados por clientes' : 'Lo que más piden los clientes'}</p>
            </div>
          </div>
          <span className="text-2xs font-semibold text-tinta-3">{popularToShow.length + promoProducts.length}</span>
        </div>

        {/* Horizontal scroll carousel */}
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
          {popularToShow.map((product, index) => {
            const pop = product.popular || {};
            const medal = pop.rank && MEDALS[pop.rank];
            /* Prueba social: el número solo se muestra si de verdad impresiona.
               Por debajo del umbral, un sello cualitativo vende más; el sello
               es solo del #1: repetido en tres deja de significar algo. */
            const meta = showCounts && pop.weeklyCount >= SOCIAL_PROOF_MIN ? (
              <p className="text-xs font-bold line-clamp-1 flex items-center gap-1 text-marca-fuerte">
                <Flame className="w-3.5 h-3.5" /> {pop.weeklyCount} {copy.estaSemana}
              </p>
            ) : index === 0 ? (
              <p className="text-xs font-bold line-clamp-1 flex items-center gap-1 text-marca-fuerte">
                <Trophy className="w-3.5 h-3.5" /> {copy.favorito}
              </p>
            ) : null;
            return (
              <motion.div
                key={product._id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.06 }}
                className="flex-shrink-0 snap-start"
                style={{ width: 'min(calc(50% - 6px), 260px)' }}
              >
                <ProductCard
                  product={product}
                  addToCart={onAddToCart}
                  onToppingsOpen={onToppingsOpen}
                  onToppingsClose={onToppingsClose}
                  isViewOnly={isViewOnly}
                  meta={meta}
                  insignia={showBadges && medal ? (
                    <Insignia className="text-white text-xs font-black min-w-[26px] justify-center shadow-md" style={{ background: medal.bg }}>
                      {medal.label}
                    </Insignia>
                  ) : showBadges && pop.isTopSeller ? (
                    <Insignia tono="marca" className="shadow-sm" icono={<Flame className="w-3 h-3" />}>Top</Insignia>
                  ) : null}
                />
              </motion.div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </motion.div>
  );
};

export default PopularProducts;
