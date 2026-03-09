import React, { useMemo, useState, useCallback } from 'react';
import ProductToppingsSelector from './ProductToppingsSelector';

function SuggestedProducts({ allProducts, cart, onAddToCart, themeColor }) {
  const [toppingsProduct, setToppingsProduct] = useState(null);
  const btnColor = themeColor || '#f97316';

  const suggestions = useMemo(() => {
    if (!cart.length || !allProducts?.length) return [];

    const cartIds = new Set(cart.map(i => i._id));
    const cartCategories = new Set(cart.map(i => i.category));

    const available = allProducts.filter(
      p => !cartIds.has(p._id) && p.price > 0 && p.isAvailable !== false
    );

    // Prioritize products from OTHER categories, then same category
    const other = [];
    const same = [];
    available.forEach(p => {
      if (cartCategories.has(p.category)) same.push(p);
      else other.push(p);
    });

    // Sort each group by price ascending (cheaper = easier impulse buy)
    const byPrice = (a, b) => a.price - b.price;
    other.sort(byPrice);
    same.sort(byPrice);

    return [...other, ...same].slice(0, 6);
  }, [allProducts, cart]);

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
