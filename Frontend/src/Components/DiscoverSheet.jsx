import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Plus, Sparkles, Flame, Star, X } from 'lucide-react';
import ProductToppingsSelector from './ProductToppingsSelector';
import { useBusinessConfig } from '../Context/BusinessContext';
import { isPromoActive, getEffectivePrice } from '../utils/promo';

const money = (n) => `$${Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

/**
 * DiscoverSheet — descubrir el menú a pantalla completa, una tarjeta por
 * pantalla, tipo historias.
 *
 * El desplazamiento lo hace scroll-snap del navegador, no JavaScript: así no
 * se traba al pasar de una a otra aunque haya decenas de productos. Tampoco
 * hay animación de entrada por tarjeta (era justo lo que causaba el tirón).
 */
export default function DiscoverSheet({ open, onClose, products = [], categories = [], addToCart }) {
  const { businessConfig } = useBusinessConfig();
  const [toppingsProduct, setToppingsProduct] = useState(null);
  const [added, setAdded] = useState(null);
  const reduceMotion = useReducedMotion();

  const catName = useMemo(() => {
    const m = new Map();
    categories.forEach((c) => m.set(String(c._id), c.name));
    return m;
  }, [categories]);

  const feed = useMemo(() => {
    const active = products.filter((p) => p.active !== false && p.image);
    const promo = active.filter((p) => isPromoActive(p));
    const featured = active.filter((p) => p.isFeatured && !isPromoActive(p));
    const rest = active.filter((p) => !p.isFeatured && !isPromoActive(p));
    const tag = (list, label, Icon) => list.map((p) => ({ p, label, Icon }));
    return [
      ...tag(promo, 'En promo', Flame),
      ...tag(featured, 'Destacado', Star),
      ...tag(rest, null, null),
    ].slice(0, 40);
  }, [products]);

  // Bloquear el scroll del fondo mientras está abierto
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleAdd = (p) => {
    if (Array.isArray(p.toppingGroups) && p.toppingGroups.length > 0) { setToppingsProduct(p); return; }
    addToCart?.({ ...p, price: getEffectivePrice(p), quantity: 1 });
    if (navigator.vibrate) navigator.vibrate(10);
    setAdded(p._id);
    setTimeout(() => setAdded(null), 1200);
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="hidden md:block fixed inset-0 z-[109] bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
            transition={reduceMotion ? { duration: 0.15 } : { type: 'spring', damping: 30, stiffness: 320 }}
            /* En escritorio, columna centrada tipo teléfono: una foto a 1900px
               de ancho se ve descomunal. */
            className="fixed inset-0 z-[110] bg-black md:inset-y-4 md:left-[calc(50%-215px)] md:w-[430px] md:rounded-3xl md:overflow-hidden md:shadow-2xl"
          >
            {/* Cerrar */}
            <button
              onClick={onClose}
              className="absolute z-20 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
              style={{ top: 'calc(12px + env(safe-area-inset-top, 0px))', background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(8px)' }}
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>

            {feed.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center px-10 text-center">
                <Sparkles size={48} className="mb-3 text-white/25" />
                <p className="text-white font-bold text-[17px]">Todavía no hay nada que mostrar</p>
                <p className="text-white/60 text-[13.5px] mt-1 mb-6">Este negocio aún no ha subido fotos de sus productos.</p>
                <button
                  onClick={onClose}
                  className="px-6 py-3 rounded-2xl text-[14px] font-extrabold"
                  style={{ background: 'var(--mb-accent)', color: 'var(--mb-on-accent)' }}
                >
                  Ver el menú
                </button>
              </div>
            ) : (
              <div
                className="h-full overflow-y-auto snap-y snap-mandatory scrollbar-hide"
                style={{ scrollBehavior: reduceMotion ? 'auto' : 'smooth', WebkitOverflowScrolling: 'touch' }}
              >
                {feed.map(({ p, label, Icon }) => {
                  const promoOn = isPromoActive(p);
                  const price = getEffectivePrice(p);
                  const cat = p.category && catName.get(String(p.category));
                  return (
                    <section key={p._id} className="h-full w-full snap-start relative shrink-0">
                      <img
                        src={p.image}
                        alt={p.name}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div
                        className="absolute inset-0"
                        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.02) 34%, rgba(0,0,0,0.82) 100%)' }}
                      />

                      {/* Etiquetas */}
                      <div className="absolute left-4 flex items-center gap-2" style={{ top: 'calc(16px + env(safe-area-inset-top, 0px))' }}>
                        {label && (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-black"
                            style={{ background: 'var(--mb-accent)', color: 'var(--mb-on-accent)' }}
                          >
                            <Icon size={12} /> {label}
                          </span>
                        )}
                        {cat && (
                          <span
                            className="px-2.5 py-1 rounded-full text-[11.5px] font-bold text-white"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }}
                          >
                            {cat}
                          </span>
                        )}
                      </div>

                      {/* Info + acción */}
                      <div
                        className="absolute inset-x-0 bottom-0 px-5"
                        style={{ paddingBottom: 'calc(28px + env(safe-area-inset-bottom, 0px))' }}
                      >
                        <h3 className="text-white text-[26px] font-black leading-tight drop-shadow-lg">{p.name}</h3>
                        {p.description && (
                          <p className="text-white/80 text-[14px] leading-snug mt-1.5 line-clamp-2 drop-shadow">{p.description}</p>
                        )}
                        <div className="flex items-center justify-between gap-4 mt-4">
                          <div className="flex items-baseline gap-2 min-w-0">
                            {promoOn && <span className="text-white/55 line-through text-[14px] tabular-nums">{money(p.price)}</span>}
                            <span className="text-white text-[30px] font-black tabular-nums drop-shadow-lg">{money(price)}</span>
                          </div>
                          <button
                            onClick={() => handleAdd(p)}
                            className="shrink-0 h-14 px-6 rounded-2xl flex items-center gap-2 text-[15px] font-black active:scale-95 transition-transform shadow-xl"
                            style={{ background: 'var(--mb-accent)', color: 'var(--mb-on-accent)' }}
                            aria-label={`Agregar ${p.name}`}
                          >
                            {added === p._id ? '¡Agregado!' : <><Plus size={20} strokeWidth={2.8} /> Agregar</>}
                          </button>
                        </div>
                        <p className="text-white/35 text-[11.5px] text-center mt-4">Desliza para ver más</p>
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Con opciones, se abre el sheet de siempre: agregar directo se saltaría
          los toppings obligatorios y llegaría mal a cocina. */}
      {toppingsProduct && (
        <ProductToppingsSelector
          product={{
            ...toppingsProduct,
            price: getEffectivePrice(toppingsProduct),
            toppingGroups: Array.isArray(toppingsProduct.toppingGroups) ? toppingsProduct.toppingGroups : [],
          }}
          onAddToCart={(prod) => { addToCart?.(prod); setToppingsProduct(null); }}
          onClose={() => setToppingsProduct(null)}
        />
      )}
    </>
  );
}
