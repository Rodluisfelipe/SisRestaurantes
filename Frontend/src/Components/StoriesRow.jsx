import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';
import { API_ENDPOINTS } from '../config';
import { isPromoActive, getEffectivePrice } from '../utils/promo';
import ProductToppingsSelector from './ProductToppingsSelector';
import StoryViewer from './StoryViewer';

const seenKey = (bid) => `mb_stories_seen_${bid}`;

const readSeen = (bid) => {
  try { return new Set(JSON.parse(sessionStorage.getItem(seenKey(bid)) || '[]')); }
  catch { return new Set(); }
};
const persistSeen = (bid, set) => {
  try { sessionStorage.setItem(seenKey(bid), JSON.stringify([...set])); } catch {}
};

const money = (n) => `$${Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

/* Las fotos de Google llegan como { name: 'places/.../photos/REF' }, no como
   URL: hay que pasarlas por el proxy del backend (la key está restringida por
   IP y no se puede llamar desde el navegador). */
const googlePhotoUrl = (photo, w = 600) => {
  const name = typeof photo === 'string' ? photo : photo?.name;
  if (!name || !String(name).includes('/photos/')) return null;
  return `${API_ENDPOINTS.BASE_URL}/places/photo?name=${encodeURIComponent(name)}&maxWidthPx=${w}`;
};

/* Convierte un producto en slide de historia */
const productSlide = (p, kicker) => ({
  type: 'product',
  id: p._id,
  image: p.image || null,
  kicker,
  title: p.name,
  body: p.description || '',
  cta: `Agregar · ${money(isPromoActive(p) ? getEffectivePrice(p) : p.price)}`,
  product: p,
});

/**
 * StoriesRow — anillos de historias del menú V2, construidos con datos que ya
 * existen (anuncios, destacados, más pedidos y reseñas). No crea endpoints:
 * reutiliza los mismos que alimentan el resto del menú.
 */
export default function StoriesRow({ products = [], categories = [], addToCart }) {
  const { businessId, businessConfig } = useBusinessConfig();
  const [popups, setPopups] = useState([]);
  const [popularIds, setPopularIds] = useState([]);
  const [openIdx, setOpenIdx] = useState(null);
  const [seen, setSeen] = useState(() => readSeen(businessId));
  const [toppingsProduct, setToppingsProduct] = useState(null);

  useEffect(() => { setSeen(readSeen(businessId)); }, [businessId]);

  // Anuncios activos (mismos que MenuPopup) y ranking de más pedidos
  useEffect(() => {
    if (!businessId) return;
    let alive = true;
    api.get(`/menu-popups/active?businessId=${businessId}`)
      .then((r) => { if (alive) setPopups(Array.isArray(r.data) ? r.data : []); })
      .catch(() => {});
    api.get(`/products/popular?businessId=${businessId}`)
      .then((r) => {
        if (!alive) return;
        const list = r.data?.products || r.data || [];
        setPopularIds(list.slice(0, 3).map((p) => p._id || p.productId).filter(Boolean));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [businessId]);

  const stories = useMemo(() => {
    const out = [];
    const active = products.filter((p) => p.active !== false);

    // 1) Promos — anuncios del negocio
    if (popups.length) {
      out.push({
        key: 'promos',
        label: 'Promos',
        cover: popups[0].image || businessConfig?.logo,
        slides: popups.map((p) => ({
          type: 'promo',
          id: p._id,
          image: p.image || null,
          kicker: 'Promo',
          title: p.title,
          body: p.body || '',
          cta: p.ctaText || null,
          ctaUrl: p.ctaUrl || null,
          popupId: p._id,
        })),
      });
    }

    // 2) Nuevos — destacados y productos en promo
    const nuevos = active.filter((p) => p.isFeatured || isPromoActive(p)).slice(0, 6);
    if (nuevos.length) {
      out.push({
        key: 'nuevos',
        label: 'Nuevos',
        cover: nuevos[0].image || businessConfig?.logo,
        slides: nuevos.map((p) => productSlide(p, isPromoActive(p) ? 'En promo' : 'Destacado')),
      });
    }

    // 3) Categoría estrella — la que más productos aporta
    const byCat = new Map();
    active.forEach((p) => { if (p.category) byCat.set(p.category, (byCat.get(p.category) || 0) + 1); });
    const starCatId = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const starCat = categories.find((c) => String(c._id) === String(starCatId));
    if (starCat) {
      const items = active.filter((p) => String(p.category) === String(starCatId)).slice(0, 6);
      if (items.length) {
        out.push({
          key: `cat-${starCat._id}`,
          label: starCat.name,
          cover: items[0].image || businessConfig?.logo,
          slides: items.map((p) => productSlide(p, starCat.name)),
        });
      }
    }

    // 4) Top — los más pedidos
    if (popularIds.length) {
      const items = popularIds.map((id) => active.find((p) => String(p._id) === String(id))).filter(Boolean);
      if (items.length) {
        out.push({
          key: 'top',
          label: 'Top',
          cover: items[0].image || businessConfig?.logo,
          slides: items.map((p, i) => productSlide(p, `#${i + 1} más pedido`)),
        });
      }
    }

    // 5) Reseñas de Google (si el negocio las muestra)
    const display = businessConfig?.reviewsDisplay || 'both';
    const gReviews = ['both', 'google'].includes(display) ? (businessConfig?.google?.reviews || []) : [];
    const withText = gReviews.filter((r) => r.text).slice(0, 3);
    if (withText.length) {
      out.push({
        key: 'reviews',
        label: 'Reseñas',
        cover: googlePhotoUrl(businessConfig?.google?.photos?.[0], 200) || businessConfig?.logo || businessConfig?.coverImage,
        slides: withText.map((r, i) => ({
          type: 'review',
          id: `rev-${i}`,
          image: googlePhotoUrl(businessConfig?.google?.photos?.[i]) || businessConfig?.coverImage || null,
          kicker: 'Reseña',
          title: r.author || r.authorName || 'Cliente',
          body: r.text,
          rating: r.rating,
          cta: null,
        })),
      });
    }

    return out;
  }, [products, categories, popups, popularIds, businessConfig]);

  const markSeen = useCallback((key) => {
    setSeen((prev) => {
      const nextSet = new Set(prev);
      nextSet.add(key);
      persistSeen(businessId, nextSet);
      return nextSet;
    });
  }, [businessId]);

  // Tracking: una historia de promo cuenta como vista del anuncio
  const handleSlideSeen = useCallback((slide) => {
    if (slide?.type === 'promo' && slide.popupId) {
      api.post(`/menu-popups/${slide.popupId}/view`).catch(() => {});
    }
  }, []);

  const handleCta = useCallback((slide) => {
    if (slide.type === 'promo') {
      if (slide.popupId) api.post(`/menu-popups/${slide.popupId}/click`).catch(() => {});
      const url = (slide.ctaUrl || '').trim();
      if (url) {
        if (/^https?:\/\//i.test(url)) window.open(url, '_blank', 'noopener,noreferrer');
        else window.location.href = url;
      }
      setOpenIdx(null);
      return;
    }
    if (slide.type === 'product' && slide.product) {
      const needsToppings = Array.isArray(slide.product.toppingGroups) && slide.product.toppingGroups.length > 0;
      if (needsToppings) {
        setOpenIdx(null);
        setToppingsProduct(slide.product);
      } else {
        addToCart?.({ ...slide.product, price: getEffectivePrice(slide.product), quantity: 1 });
        setOpenIdx(null);
      }
    }
  }, [addToCart]);

  // Sin contenido, no se dibuja una fila vacía
  if (!stories.length) return null;

  return (
    <>
      <div className="overflow-x-auto scrollbar-hide px-4 pt-4 pb-1">
        <div className="flex gap-3.5 min-w-max">
          {stories.map((s, i) => {
            const isSeen = seen.has(s.key);
            return (
              <motion.button
                key={s.key}
                whileTap={{ scale: 0.94 }}
                onClick={() => { setOpenIdx(i); markSeen(s.key); }}
                className="flex flex-col items-center gap-1.5 w-[66px] shrink-0"
              >
                <span
                  className="w-[62px] h-[62px] rounded-full p-[2.5px] flex items-center justify-center"
                  style={{
                    background: isSeen
                      ? 'var(--mb-line)'
                      : 'conic-gradient(from 200deg, var(--mb-accent), var(--mb-ring-partner), var(--mb-accent))',
                  }}
                >
                  <span
                    className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center"
                    style={{ border: '2.5px solid var(--mb-surface)', background: 'var(--mb-surface-2)' }}
                  >
                    <span className="text-[19px] font-black" style={{ color: 'var(--mb-ink-3)' }} aria-hidden="true">
                      {s.label.charAt(0).toUpperCase()}
                    </span>
                    {s.cover ? (
                      <img
                        src={s.cover}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                        /* Si la foto falla, cae a la inicial en vez de dejar el
                           anillo en blanco. */
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : null}
                  </span>
                </span>
                <span
                  className="text-[11px] font-semibold truncate max-w-[66px]"
                  style={{ color: isSeen ? 'var(--mb-ink-3)' : 'var(--mb-ink-2)' }}
                >
                  {s.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {openIdx !== null && stories[openIdx] && (
        <StoryViewer
          story={stories[openIdx]}
          onClose={() => setOpenIdx(null)}
          onCta={handleCta}
          onSlideSeen={handleSlideSeen}
        />
      )}

      {/* Producto con opciones: se abre el sheet de siempre */}
      {toppingsProduct && (
        <ProductToppingsSelector
          product={{
            ...toppingsProduct,
            price: getEffectivePrice(toppingsProduct),
            toppingGroups: Array.isArray(toppingsProduct.toppingGroups) ? toppingsProduct.toppingGroups : [],
          }}
          onAddToCart={(p) => { addToCart?.(p); setToppingsProduct(null); }}
          onClose={() => setToppingsProduct(null)}
        />
      )}
    </>
  );
}
