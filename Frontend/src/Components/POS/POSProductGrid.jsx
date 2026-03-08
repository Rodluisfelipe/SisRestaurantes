import React, { useState, useMemo } from 'react';

export default function POSProductGrid({ products, categories, onProductClick, themeColor }) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const filtered = useMemo(() => {
    let items = products;
    if (activeCategory !== 'all') {
      items = items.filter(p => {
        const catId = typeof p.category === 'object' ? p.category?._id : p.category;
        return catId === activeCategory;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(p => p.name.toLowerCase().includes(q));
    }
    return items.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }, [products, activeCategory, search]);

  return (
    <div className="h-full flex flex-col">
      {/* Search bar */}
      <div className="p-3 pb-0">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
            style={{ '--tw-ring-color': `${themeColor}40` }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors">
              <svg className="w-3 h-3 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Category pills */}
      <div className="flex gap-1.5 px-3 py-2.5 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveCategory('all')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeCategory === 'all'
              ? 'text-white shadow-md'
              : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
          }`}
          style={activeCategory === 'all' ? { backgroundColor: themeColor } : undefined}
        >
          Todos
        </button>
        {categories.map(cat => (
          <button
            key={cat._id}
            onClick={() => setActiveCategory(cat._id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeCategory === cat._id
                ? 'text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
            }`}
            style={activeCategory === cat._id ? { backgroundColor: themeColor } : undefined}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="w-12 h-12 text-slate-300 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <p className="text-sm text-slate-400 font-medium">No se encontraron productos</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
            {filtered.map(product => (
              <button
                key={product._id}
                onClick={() => onProductClick(product)}
                className="group bg-white rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all duration-150 active:scale-[0.96] text-left overflow-hidden flex flex-col"
              >
                {/* Image */}
                {product.image ? (
                  <div className="aspect-square w-full overflow-hidden bg-slate-50">
                    <img src={product.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" loading="lazy" />
                  </div>
                ) : (
                  <div className="aspect-square w-full bg-slate-50 flex items-center justify-center">
                    <svg className="w-8 h-8 text-slate-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                  </div>
                )}

                {/* Info */}
                <div className="p-2 flex-1 flex flex-col justify-between min-h-[52px]">
                  <p className="text-[11px] sm:text-xs font-semibold text-slate-700 leading-tight line-clamp-2">{product.name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs sm:text-sm font-bold text-slate-900">${product.price?.toLocaleString()}</span>
                    {product.toppingGroups && product.toppingGroups.length > 0 && (
                      <span className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: `${themeColor}15` }}>
                        <svg className="w-2.5 h-2.5" style={{ color: themeColor }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
