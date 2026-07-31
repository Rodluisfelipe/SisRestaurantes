import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Sparkles, Flame, Star } from 'lucide-react';
import MenuScreen from './MenuScreen';
import ProductToppingsSelector from './ProductToppingsSelector';
import { useBusinessConfig } from '../Context/BusinessContext';
import { isPromoActive, getEffectivePrice } from '../utils/promo';

const money = (n) => `$${Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

/**
 * DiscoverSheet — feed vertical para descubrir el menú sin recorrer categorías.
 * Orden: en promo → destacados → el resto con foto. Cuando exista video por
 * producto, este mismo feed pasa a reels con snap vertical.
 */
export default function DiscoverSheet({ open, onClose, products = [], categories = [], addToCart }) {
  const { businessConfig } = useBusinessConfig();
  const [toppingsProduct, setToppingsProduct] = useState(null);
  const [added, setAdded] = useState(null);

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
    ].slice(0, 30);
  }, [products]);

  const handleAdd = (p) => {
    const needsToppings = Array.isArray(p.toppingGroups) && p.toppingGroups.length > 0;
    if (needsToppings) { setToppingsProduct(p); return; }
    addToCart?.({ ...p, price: getEffectivePrice(p), quantity: 1 });
    if (navigator.vibrate) navigator.vibrate(10);
    setAdded(p._id);
    setTimeout(() => setAdded(null), 1200);
  };

  return (
    <>
      <MenuScreen open={open} onClose={onClose} title="Descubre" subtitle="Lo que no te puedes perder">
        {feed.length === 0 ? (
          <div className="py-20 px-8 text-center">
            <Sparkles size={44} className="mx-auto mb-3" style={{ color: 'var(--mb-accent)', opacity: 0.2 }} />
            <p className="font-bold" style={{ color: 'var(--mb-ink)' }}>Todavía no hay nada que mostrar</p>
            <p className="text-[13px] mt-1 mb-5" style={{ color: 'var(--mb-ink-2)' }}>
              Este negocio aún no ha subido fotos de sus productos.
            </p>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-[var(--mb-radius-btn)] text-[14px] font-extrabold"
              style={{ background: 'var(--mb-accent)', color: 'var(--mb-on-accent)' }}
            >
              Ver el menú
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {feed.map(({ p, label, Icon }, i) => {
              const promoOn = isPromoActive(p);
              const price = getEffectivePrice(p);
              return (
                <motion.article
                  key={p._id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 6) * 0.04, duration: 0.28 }}
                  className="rounded-[var(--mb-radius-card)] overflow-hidden border"
                  style={{ background: 'var(--mb-card)', borderColor: 'var(--mb-line)' }}
                >
                  <div className="relative aspect-[4/3] bg-slate-100">
                    <img src={p.image} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent 45%)' }} />
                    {label && (
                      <span
                        className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black"
                        style={{ background: 'var(--mb-accent)', color: 'var(--mb-on-accent)' }}
                      >
                        <Icon size={12} /> {label}
                      </span>
                    )}
                    {p.category && catName.get(String(p.category)) && (
                      <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-bold text-white" style={{ background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(6px)' }}>
                        {catName.get(String(p.category))}
                      </span>
                    )}
                    <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-white text-[18px] font-black leading-tight drop-shadow">{p.name}</h3>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          {promoOn && <span className="text-white/60 line-through text-[12.5px] tabular-nums">{money(p.price)}</span>}
                          <span className="text-white text-[20px] font-black tabular-nums drop-shadow">{money(price)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAdd(p)}
                        className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 active:scale-90 transition-transform shadow-lg"
                        style={{ background: 'var(--mb-accent)', color: 'var(--mb-on-accent)' }}
                        aria-label={`Agregar ${p.name}`}
                      >
                        {added === p._id ? '✓' : <Plus size={22} strokeWidth={2.6} />}
                      </button>
                    </div>
                  </div>
                  {p.description && (
                    <p className="px-4 py-3 text-[13px] leading-snug line-clamp-2" style={{ color: 'var(--mb-ink-2)' }}>
                      {p.description}
                    </p>
                  )}
                </motion.article>
              );
            })}
          </div>
        )}
      </MenuScreen>

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
