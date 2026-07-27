import React, { useState, useMemo } from 'react';
import { useBusinessConfig } from '../../Context/BusinessContext';

// Paleta de azulejos (fondo suave + inicial en tono fuerte) para productos sin foto
const TILE_COLORS = [
  ['#FEF3C7', '#B45309'], ['#DBEAFE', '#1D4ED8'], ['#DCFCE7', '#15803D'],
  ['#FCE7F3', '#BE185D'], ['#EDE9FE', '#6D28D9'], ['#FFEDD5', '#C2410C'],
  ['#CCFBF1', '#0F766E'], ['#E0E7FF', '#4338CA'], ['#FEE2E2', '#B91C1C'],
];
const tileFor = (name = '') => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TILE_COLORS[h % TILE_COLORS.length];
};

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
    <div className="h-full flex flex-col bg-[#F5F6F8]">
      {/* Search & Categories */}
      <div className="bg-white border-b border-slate-200/70 px-3 sm:px-4 pt-3 pb-2.5 space-y-3 flex-shrink-0">
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isService ? 'Buscar servicio…' : 'Buscar producto…'}
            aria-label={isService ? 'Buscar servicio' : 'Buscar producto'}
            className="w-full pl-11 pr-10 py-3 rounded-xl bg-slate-100 border border-transparent text-[15px] text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-200 transition-all"
            style={{ '--tw-ring-color': `${themeColor}45` }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors">
              <svg className="w-3 h-3 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          {[{ _id: 'all', name: 'Todos' }, ...categories].map(cat => {
            const active = activeCategory === cat._id;
            return (
              <button
                key={cat._id}
                onClick={() => setActiveCategory(cat._id)}
                className={`flex-shrink-0 pl-3.5 pr-2.5 py-2 rounded-xl text-[13px] font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                  active ? 'text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                style={active ? { backgroundColor: themeColor } : undefined}
              >
                {cat.name}
                <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-lg ${active ? 'bg-white/25' : 'bg-white text-slate-500'}`}>
                  {categoryCounts[cat._id] || 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-20 h-20 rounded-3xl bg-white flex items-center justify-center mb-4 shadow-sm border border-slate-100">
              <svg className="w-10 h-10 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            </div>
            <p className="text-base font-bold text-slate-500">{isService ? 'Sin servicios' : 'Sin productos'}</p>
            <p className="text-sm text-slate-400 mt-1">Prueba con otro término</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3">
            {filtered.map(product => {
              const hasExtras = product.toppingGroups && product.toppingGroups.length > 0;
              const [tileBg, tileFg] = tileFor(product.name);
              return (
                <button
                  key={product._id}
                  onClick={() => onProductClick(product)}
                  className="group bg-white rounded-2xl overflow-hidden border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_10px_28px_-12px_rgba(15,23,42,0.22)] hover:border-slate-300/80 transition-all duration-150 active:scale-[0.97] text-left flex flex-col"
                >
                  {/* Media */}
                  <div className="relative aspect-[5/4] overflow-hidden">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: tileBg }}>
                        <span className="text-4xl font-black select-none" style={{ color: tileFg, opacity: 0.9 }}>
                          {(product.name || '?').trim().charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    {hasExtras && (
                      <span className="absolute top-2 left-2 text-[10px] font-black px-1.5 py-0.5 rounded-md bg-black/55 text-white backdrop-blur-sm tracking-wide">
                        EXTRAS
                      </span>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-2.5 sm:p-3 flex-1 flex flex-col">
                    <p className="text-[13px] sm:text-sm font-bold text-slate-800 leading-tight line-clamp-2 flex-1">{product.name}</p>
                    <p className="text-[17px] font-black mt-2 leading-none tabular-nums" style={{ color: themeColor }}>
                      ${product.price?.toLocaleString()}
                    </p>
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
