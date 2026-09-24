import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Home, ReceiptText, ShoppingBag, Sparkles, Star, UserRound, Gift, Wifi, CalendarCheck, Heart } from 'lucide-react';
import { useBusinessConfig } from '../Context/BusinessContext';
import useResumenCuenta from '../hooks/useResumenCuenta';

/* Nav claro: gris medio sobre superficie clara — legible sin competir con el
   carrito, que es el único elemento a color. */
const INACTIVE = '#6B7280';

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
            style={{ background: '#EF4444', border: '1.5px solid #fff' }}
          />
        )}
      </span>
      <span className="text-2xs font-medium leading-none" style={{ color: INACTIVE }}>{label}</span>
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
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--mb-line)',
          boxShadow: '0 10px 30px rgba(15,23,42,0.14)',
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
            /* Píldora clara: el acento del negocio se usa tal cual, que ya
               tiene contraste AA garantizado contra su propio texto. */
            style={{
              background: 'var(--mb-accent)',
              color: 'var(--mb-on-accent)',
              boxShadow: '0 8px 20px rgba(15,23,42,0.22)',
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
                  style={{ background: '#EF4444', border: '2px solid #fff' }}
                >
                  {totalItems > 99 ? '99+' : totalItems}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>

        <Item icon={Sparkles} label="Descubre" onClick={onDiscover} />
        <ItemMas onClick={onShowMore} />
      </div>
    </div>
  );
}

/* "Más" va mostrando lo que tiene adentro —tu cuenta, tus puntos, el Wi-Fi,
   reservar— para que el cliente sepa que existe sin tener que entrar. Empieza
   y vuelve siempre a "Más", para que se entienda qué pestaña es. Con
   "reducir movimiento" se queda quieta. */
const CADA_MS = 3000;

function ItemMas({ onClick }) {
  const { businessConfig } = useBusinessConfig();
  const { resumen } = useResumenCuenta();
  const reduceMotion = useReducedMotion();

  const vistas = [{ clave: 'mas', Icono: Star, texto: 'Más' }, { clave: 'cuenta', Icono: UserRound, texto: 'Cuenta' }];
  if (resumen?.puntos) vistas.push({ clave: 'puntos', Icono: Gift, texto: `${compacto(resumen.puntos.puntos)} pts` });
  if (businessConfig?.wifi?.enabled && businessConfig?.wifi?.ssid) vistas.push({ clave: 'wifi', Icono: Wifi, texto: 'Wi-Fi' });
  if (businessConfig?.enableBookings) vistas.push({ clave: 'reservar', Icono: CalendarCheck, texto: 'Reservar' });
  const social = businessConfig?.socialMedia || {};
  if (['instagram', 'tiktok', 'facebook'].some((k) => social[k]?.isVisible && social[k]?.url)) {
    vistas.push({ clave: 'redes', Icono: Heart, texto: 'Redes' });
  }

  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduceMotion || vistas.length < 2) return undefined;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') setI((n) => n + 1);
    }, CADA_MS);
    return () => clearInterval(t);
  }, [reduceMotion, vistas.length]);

  const v = reduceMotion ? vistas[0] : vistas[i % vistas.length];

  return (
    <button
      onClick={onClick}
      className="flex-1 py-1.5 flex flex-col items-center justify-center gap-0.5 active:scale-90 transition-transform overflow-hidden"
      aria-label="Más: tu cuenta, puntos, Wi-Fi y más"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={v.clave}
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -12, opacity: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="flex flex-col items-center gap-0.5"
        >
          <v.Icono size={20} strokeWidth={1.8} style={{ color: v.clave === 'mas' ? INACTIVE : 'var(--mb-accent)' }} />
          <span
            className="text-2xs font-medium leading-none whitespace-nowrap"
            style={{ color: v.clave === 'mas' ? INACTIVE : 'var(--mb-ink)' }}
          >
            {v.texto}
          </span>
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

/** 1.250 → "1,2k": la pestaña es angosta. */
function compacto(n) {
  const v = Number(n) || 0;
  if (v < 1000) return String(v);
  return `${(v / 1000).toFixed(v < 10000 ? 1 : 0).replace('.', ',')}k`;
}
