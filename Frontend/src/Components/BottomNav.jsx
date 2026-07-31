import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Home, Star, ShoppingBag, Search, User } from 'lucide-react';

/**
 * BottomNav — pill flotante del menú V2.
 * Todo apunta a los sheets/modales que ya existen (no hay rutas de carrito ni
 * de producto), así que este componente es puramente presentacional.
 */
export default function BottomNav({
  totalItems = 0,
  onShowCart,
  onShowReviews,
  onShowHistory,
  customerName,
  hasActiveOrder = false,
  disabled = false,
}) {
  const [pop, setPop] = useState(false);
  const prevCount = useRef(totalItems);
  const reduceMotion = useReducedMotion();

  /* Pop del badge cada vez que entra algo al carrito (venga de la card, del
     sheet de toppings o de una historia). */
  useEffect(() => {
    if (totalItems > prevCount.current) {
      setPop(true);
      const t = setTimeout(() => setPop(false), 420);
      prevCount.current = totalItems;
      return () => clearTimeout(t);
    }
    prevCount.current = totalItems;
  }, [totalItems]);

  const goTop = () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });

  const focusSearch = () => {
    const el = document.getElementById('menu-search-input');
    if (!el) return;
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    // Esperar al scroll para que el teclado móvil no lo desplace de vuelta
    setTimeout(() => el.focus({ preventScroll: true }), reduceMotion ? 0 : 320);
  };

  const iconBtn = 'flex-1 h-12 flex items-center justify-center transition-colors active:scale-90';
  const iconColor = 'rgba(255,255,255,0.62)';

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-40"
      style={{
        bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        width: 'min(390px, calc(100% - 40px))',
      }}
    >
      <div
        className="flex items-center rounded-full px-2"
        style={{
          background: '#101319ee',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 12px 34px rgba(0,0,0,0.34)',
        }}
      >
        <button onClick={goTop} className={iconBtn} aria-label="Inicio" title="Inicio">
          <Home size={21} style={{ color: iconColor }} strokeWidth={1.9} />
        </button>

        {/* El ítem 2 sería "Videos", pero el campo de video por producto aún no
            existe: en su lugar va Reseñas para no dejar un ícono muerto. */}
        <button onClick={onShowReviews} className={iconBtn} aria-label="Reseñas" title="Reseñas">
          <Star size={21} style={{ color: iconColor }} strokeWidth={1.9} />
        </button>

        {/* Carrito — centro */}
        <div className="px-1.5">
          <motion.button
            data-cart-target
            onClick={disabled ? undefined : onShowCart}
            disabled={disabled}
            whileTap={reduceMotion || disabled ? undefined : { scale: 0.92 }}
            animate={pop && !reduceMotion ? { scale: [1, 1.16, 1] } : { scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="relative w-[54px] h-[54px] rounded-full flex items-center justify-center disabled:opacity-50"
            style={{
              background: 'var(--mb-accent)',
              color: 'var(--mb-on-accent)',
              boxShadow: '0 8px 22px rgba(0,0,0,0.35)',
            }}
            aria-label={totalItems > 0 ? `Ver carrito, ${totalItems} artículo(s)` : 'Ver carrito'}
          >
            <ShoppingBag size={23} strokeWidth={2} />
            <AnimatePresence>
              {totalItems > 0 && (
                <motion.span
                  initial={reduceMotion ? { opacity: 0 } : { scale: 0, opacity: 0 }}
                  animate={reduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
                  exit={reduceMotion ? { opacity: 0 } : { scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 18 }}
                  className="absolute -top-0.5 -right-0.5 min-w-[21px] h-[21px] px-1 rounded-full flex items-center justify-center text-[11px] font-black text-white tabular-nums"
                  style={{ background: '#EF4444', border: '2px solid #101319' }}
                >
                  {totalItems > 99 ? '99+' : totalItems}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>

        <button onClick={focusSearch} className={iconBtn} aria-label="Buscar" title="Buscar">
          <Search size={21} style={{ color: iconColor }} strokeWidth={1.9} />
        </button>

        <button onClick={onShowHistory} className={`${iconBtn} relative`} aria-label="Mis pedidos" title="Mis pedidos">
          {customerName ? (
            <span
              className="w-[27px] h-[27px] rounded-full flex items-center justify-center text-[12px] font-black"
              style={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }}
            >
              {customerName.trim().charAt(0).toUpperCase()}
            </span>
          ) : (
            <User size={21} style={{ color: iconColor }} strokeWidth={1.9} />
          )}
          {hasActiveOrder && (
            <span
              className="absolute top-2.5 right-[22%] w-2.5 h-2.5 rounded-full"
              style={{ background: '#EF4444', border: '2px solid #101319' }}
            />
          )}
        </button>
      </div>
    </div>
  );
}
