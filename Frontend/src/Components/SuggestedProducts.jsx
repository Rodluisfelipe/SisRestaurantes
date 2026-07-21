import React, { useMemo, useState, useCallback, useEffect } from 'react';
import ProductToppingsSelector from './ProductToppingsSelector';
import api from '../services/api';

// Palabras clave de complementos de alto margen (bebidas, postres, adiciones…)
const COMPLEMENT_RE = /(bebida|gaseosa|refresco|jugo|agua|cerveza|limonada|malteada|postre|helado|torta|brownie|adici|acompa|papas|snack|entrada|salsa|combo|dip|topping)/i;

function SuggestedProducts({ allProducts, cart, onAddToCart, themeColor, businessId }) {
  const [toppingsProduct, setToppingsProduct] = useState(null);
  const [boughtTogetherIds, setBoughtTogetherIds] = useState([]);
  const btnColor = themeColor || '#f97316';

  // Clave estable de los productos del carrito
  const cartKey = useMemo(() => cart.map(i => i._id).sort().join(','), [cart]);

  // A) "Se piden juntos" (datos reales de pedidos completados), con debounce.
  useEffect(() => {
    if (!businessId || !cartKey) { setBoughtTogetherIds([]); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      api.get(`/orders/bought-together?businessId=${encodeURIComponent(businessId)}&productIds=${encodeURIComponent(cartKey)}`)
        .then(res => { if (!cancelled) setBoughtTogetherIds(res.data?.productIds || []); })
        .catch(() => { if (!cancelled) setBoughtTogetherIds([]); });
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [businessId, cartKey]);

  const suggestions = useMemo(() => {
    if (!cart.length || !allProducts?.length) return [];

    const cartIds = new Set(cart.map(i => i._id));
    const cartCategories = new Set(cart.map(i => i.category));

    const available = allProducts.filter(
      p => !cartIds.has(p._id) && p.price > 0 && p.isAvailable !== false
    );
    const byId = new Map(available.map(p => [p._id, p]));

    // A) Datos reales ("se piden juntos"), en orden de ranking.
    const listA = boughtTogetherIds.map(id => byId.get(id)).filter(Boolean);
    const inA = new Set(listA.map(p => p._id));

    // B) Reglas: complementos (bebidas/postres/adiciones) → otras categorías → más barato.
    const isComplement = (p) => COMPLEMENT_RE.test(`${p.categoryName || ''} ${p.category || ''} ${p.name || ''}`);
    const listB = available.filter(p => !inA.has(p._id)).sort((a, b) => {
      const ca = isComplement(a) ? 1 : 0, cb = isComplement(b) ? 1 : 0;
      if (ca !== cb) return cb - ca;                       // complementos primero
      const oa = cartCategories.has(a.category) ? 0 : 1, ob = cartCategories.has(b.category) ? 0 : 1;
      if (oa !== ob) return ob - oa;                       // otras categorías primero
      return a.price - b.price;                            // más barato primero
    });

    // Intercalar: uno de A (datos reales) y uno de B (reglas), alternando, para
    // que siempre se combinen ambas fuentes. Si A está vacío (negocio nuevo),
    // queda todo B (fallback). Sin duplicados.
    const result = [];
    const used = new Set();
    let ia = 0, ib = 0;
    while (result.length < 6 && (ia < listA.length || ib < listB.length)) {
      if (ia < listA.length) {
        const p = listA[ia++];
        if (!used.has(p._id)) { result.push(p); used.add(p._id); }
      }
      if (result.length < 6 && ib < listB.length) {
        const p = listB[ib++];
        if (!used.has(p._id)) { result.push(p); used.add(p._id); }
      }
    }

    return result.slice(0, 6);
  }, [allProducts, cart, boughtTogetherIds]);

  const handleAdd = useCallback((product) => {
    const hasToppings = product.toppingGroups && product.toppingGroups.length > 0;
    if (hasToppings) {
      setToppingsProduct(product);
    } else {
      onAddToCart({ ...product, quantity: 1 });
    }
  }, [onAddToCart]);

  const handleToppingsAdd = useCallback((productWithToppings) => {
    onAddToCart(productWithToppings);
    setToppingsProduct(null);
  }, [onAddToCart]);

  if (!suggestions.length) return null;

  return (
    <>
      <div className="mt-3 pt-3 border-t border-slate-100">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">
          Complementa tu pedido
        </p>
        <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
          {suggestions.map(product => (
            <div
              key={product._id}
              className="flex-shrink-0 w-28 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden"
            >
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-20 object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-20 bg-slate-50 flex items-center justify-center">
                  <svg className="w-6 h-6 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="m21 15-5-5L5 21" />
                  </svg>
                </div>
              )}
              <div className="p-1.5">
                <p className="text-[11px] font-medium text-slate-700 leading-tight line-clamp-2 min-h-[28px]">
                  {product.name}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[11px] font-bold text-slate-800">
                    ${Number(product.price).toLocaleString('es-CO')}
                  </span>
                  <button
                    onClick={() => handleAdd(product)}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white transition-transform active:scale-90"
                    style={{ backgroundColor: btnColor }}
                    aria-label={`Agregar ${product.name}`}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {toppingsProduct && (
        <ProductToppingsSelector
          product={{
            ...toppingsProduct,
            toppingGroups: Array.isArray(toppingsProduct.toppingGroups) ? toppingsProduct.toppingGroups : []
          }}
          onAddToCart={handleToppingsAdd}
          onClose={() => setToppingsProduct(null)}
        />
      )}
    </>
  );
}

export default React.memo(SuggestedProducts);
