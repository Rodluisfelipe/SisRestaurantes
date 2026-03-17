import React, { useState, useMemo } from 'react';
import { useBusinessConfig } from '../../Context/BusinessContext';

export default function POSProductGrid({ products, categories, onProductClick, themeColor }) {
  const { businessConfig } = useBusinessConfig();
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);
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

  const categoryCounts = useMemo(() => {
    const counts = { all: products.length };
    categories.forEach(cat => {
      counts[cat._id] = products.filter(p => {
        const catId = typeof p.category === 'object' ? p.category?._id : p.category;
        return catId === cat._id;
      }).length;
    });
    return counts;
  }, [products, categories]);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Search & Categories */}
      <div className="bg-white border-b border-slate-100 px-4 pt-3 pb-2 space-y-2.5">
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isService ? 'Buscar servicio...' : 'Buscar producto...'}
            aria-label={isService ? 'Buscar servicio' : 'Buscar producto'}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 border-none text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:bg-white transition-all"
            style={{ '--tw-ring-color': `${themeColor}50` }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors">
              <svg className="w-3 h-3 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          <button
            onClick={() => setActiveCategory('all')}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeCategory === 'all'
                ? 'text-white shadow-md shadow-black/10'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            style={activeCategory === 'all' ? { backgroundColor: themeColor } : undefined}
          >
            Todos
            <span className={`text-[10px] ${activeCategory === 'all' ? 'bg-white/25' : 'bg-slate-200/80'} px-1.5 py-0.5 rounded-full`}>
              {categoryCounts.all}
            </span>
          </button>
          {categories.map(cat => (
            <button
              key={cat._id}
              onClick={() => setActiveCategory(cat._id)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeCategory === cat._id
                  ? 'text-white shadow-md shadow-black/10'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              style={activeCategory === cat._id ? { backgroundColor: themeColor } : undefined}
            >
              {cat.name}
              <span className={`text-[10px] ${activeCategory === cat._id ? 'bg-white/25' : 'bg-slate-200/80'} px-1.5 py-0.5 rounded-full`}>
                {categoryCounts[cat._id] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center mb-4 shadow-sm">
              <svg className="w-10 h-10 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            </div>
            <p className="text-base font-semibold text-slate-400">{isService ? 'No se encontraron servicios' : 'No se encontraron productos'}</p>
            <p className="text-sm text-slate-300 mt-1">Intenta con otro término</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
            {filtered.map(product => {
              const hasExtras = product.toppingGroups && product.toppingGroups.length > 0;
              return (
                <button
                  key={product._id}
                  onClick={() => onProductClick(product)}
                  className="group bg-white rounded-xl shadow-sm hover:shadow-md border border-slate-100 hover:border-slate-200 transition-all duration-150 active:scale-[0.96] text-left p-3.5 flex flex-col justify-between relative"
                >
                  <p className="text-sm font-bold text-slate-800 leading-snug line-clamp-2">{product.name}</p>

                  <div className="flex items-center gap-2 mt-2.5">
                    <span className="text-base font-black" style={{ color: themeColor }}>${product.price?.toLocaleString()}</span>
                    {hasExtras && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500">
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

    </div>
  );
}
