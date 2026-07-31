import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Home, ReceiptText, ShoppingBag, Sparkles, Star } from 'lucide-react';

const INACTIVE = '#9AA3B2';

/**
 * BottomNav — pill flotante del menú V2.
 * Todo apunta a los sheets/modales que ya existen (no hay rutas de carrito ni
 * de producto), así que este componente es puramente presentacional.
 */
export default function BottomNav({
  totalItems = 0,
  onShowCart,
  onShowOrders,
  onDiscover,
  onShowMore,
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

  /* Ítem con etiqueta: los íconos mudos obligan a adivinar. */
  const Item = ({ icon: Icon, label, onClick, dot = false }) => (
    <button
      onClick={onClick}
      className="flex-1 py-1.5 flex flex-col items-center justify-center gap-0.5 active:scale-90 transition-transform"
      aria-label={label}
    >
      <span className="relative">
        <Icon size={20} strokeWidth={1.8} style={{ color: INACTIVE }} />
        {dot && (
          <span
            className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full"
            style={{ background: '#EF4444', border: '1.5px solid #101319' }}
          />
        )}
      </span>
      <span className="text-[10px] font-medium leading-none" style={{ color: INACTIVE }}>{label}</span>
    </button>
  );

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
        <Item icon={Home} label="Inicio" onClick={goTop} />
        <Item icon={ReceiptText} label="Pedidos" onClick={onShowOrders} dot={hasActiveOrder} />

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

        <Item icon={Sparkles} label="Descubre" onClick={onDiscover} />
        <Item icon={Star} label="Más" onClick={onShowMore} />
      </div>
    </div>
  );
}
