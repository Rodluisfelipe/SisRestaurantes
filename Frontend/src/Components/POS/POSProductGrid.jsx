import React, { useState, useMemo } from 'react';

export default function POSProductGrid({ products, categories, onProductClick, themeColor }) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [previewImage, setPreviewImage] = useState(null);

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

      {/* Product grid — text-only, compact, fast */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="w-12 h-12 text-slate-300 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <p className="text-sm text-slate-400 font-medium">No se encontraron productos</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map(product => {
              const hasExtras = product.toppingGroups && product.toppingGroups.length > 0;
              return (
                <button
                  key={product._id}
                  onClick={() => onProductClick(product)}
                  className="group bg-white rounded-2xl border-2 border-slate-100 hover:border-slate-300 hover:shadow-lg transition-all duration-100 active:scale-[0.97] text-left p-4 flex flex-col justify-between relative min-h-[100px]"
                >
                  {/* Image peek button */}
                  {product.image && (
                    <span
                      onClick={(e) => { e.stopPropagation(); setPreviewImage(product.image); }}
                      className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors z-10 opacity-50 group-hover:opacity-100"
                      title="Ver imagen"
                    >
                      <svg className="w-4.5 h-4.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </span>
                  )}

                  {/* Product name — large and easy to tap */}
                  <p className="text-base font-bold text-slate-800 leading-snug line-clamp-2 pr-8">{product.name}</p>

                  {/* Price + extras indicator */}
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-lg font-black text-slate-900">${product.price?.toLocaleString()}</span>
                    {hasExtras && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg text-white" style={{ backgroundColor: themeColor }}>
                        +Extras
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Image preview overlay */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <img src={previewImage} alt="" className="w-full rounded-2xl shadow-2xl object-contain max-h-[70vh]" />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-slate-100 transition-colors"
            >
              <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
