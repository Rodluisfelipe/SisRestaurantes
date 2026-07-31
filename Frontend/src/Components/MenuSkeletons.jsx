import React from 'react';

/**
 * Shimmer base — used by all skeleton variants.
 * The shimmer is a CSS-only gradient sweep (no JS timers).
 */
const shimmerClass =
  'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent';

/* ------------------------------------------------------------------ */
/*  ProductCardSkeleton                                                */
/* ------------------------------------------------------------------ */
/* Debe calcar la geometría de ProductCard (4:3 + radio 20px) para que al
   cargar no haya salto de layout. */
export const ProductCardSkeleton = () => (
  <div className="bg-white border border-gray-100 overflow-hidden" style={{ borderRadius: '20px', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)' }}>
    {/* Image placeholder */}
    <div className={`aspect-[4/3] bg-gray-200 ${shimmerClass}`} />
    {/* Info */}
    <div className="px-3 py-2 sm:px-3.5 space-y-2">
      <div className={`h-4 w-3/4 rounded-full bg-gray-200 ${shimmerClass}`} />
      <div className={`h-3 w-1/2 rounded-full bg-gray-100 ${shimmerClass}`} />
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  CategoryHeaderSkeleton                                             */
/* ------------------------------------------------------------------ */
export const CategoryHeaderSkeleton = () => (
  <div className="flex items-center gap-3 mb-3 sm:mb-4">
    <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gray-200 ${shimmerClass}`} />
    <div className={`h-5 w-32 rounded-full bg-gray-200 ${shimmerClass}`} />
    <div className="flex-1 h-px bg-gray-100" />
  </div>
);

/* ------------------------------------------------------------------ */
/*  FilterableMenuSkeleton — full menu placeholder                     */
/* ------------------------------------------------------------------ */
export const FilterableMenuSkeleton = () => (
  <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-2 animate-fadeIn">
    {/* Search bar skeleton */}
    <div className="mb-4 sm:mb-5">
      <div className={`h-12 sm:h-[52px] w-full rounded-xl bg-gray-200 ${shimmerClass}`} />
    </div>

    {/* Category pills skeleton */}
    <div className="mb-4 sm:mb-5 flex gap-2 overflow-hidden">
      {[80, 100, 90, 75, 110].map((w, i) => (
        <div
          key={i}
          className={`h-9 rounded-full bg-gray-200 flex-shrink-0 ${shimmerClass}`}
          style={{ width: w }}
        />
      ))}
    </div>

    {/* Featured products skeleton */}
    <div className="mb-4 sm:mb-5">
      <div className="flex items-center gap-2 mb-3 px-0">
        <div className={`w-7 h-7 rounded-lg bg-gray-200 ${shimmerClass}`} />
        <div className={`h-4 w-24 rounded-full bg-gray-200 ${shimmerClass}`} />
      </div>
      <div className="flex gap-3 overflow-hidden">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex-shrink-0 w-40 sm:w-48 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className={`aspect-[4/3] bg-gray-200 ${shimmerClass}`} />
            <div className="p-2.5 space-y-2">
              <div className={`h-3.5 w-3/4 rounded-full bg-gray-200 ${shimmerClass}`} />
              <div className="flex items-center justify-between">
                <div className={`h-4 w-14 rounded-full bg-gray-200 ${shimmerClass}`} />
                <div className={`w-7 h-7 rounded-lg bg-gray-200 ${shimmerClass}`} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Product grid skeleton (2 category groups) */}
    {[1, 2].map(group => (
      <div key={group} className="mb-6 sm:mb-8">
        <CategoryHeaderSkeleton />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: group === 1 ? 4 : 3 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    ))}
  </div>
);

/* ------------------------------------------------------------------ */
/*  BusinessHeaderSkeleton — matches immersive header                  */
/* ------------------------------------------------------------------ */
export const BusinessHeaderSkeleton = () => (
  <div className="w-full relative animate-fadeIn">
    {/* Immersive cover area */}
    {/* Debe calcar la portada real (44vh) para que no salte al cargar */}
    <div className={`relative bg-gray-200 ${shimmerClass}`} style={{ minHeight: '44vh' }}>
      {/* Status badge skeleton — top left */}
      <div className="absolute left-3 top-3 z-10">
        <div className={`h-6 w-16 rounded-full bg-gray-300/50 ${shimmerClass}`} />
      </div>
      {/* Action pill skeleton — top right */}
      <div className="absolute right-3 top-3 z-10">
        <div className={`h-8 w-28 rounded-2xl bg-gray-300/50 ${shimmerClass}`} />
      </div>
      {/* Centered content over cover */}
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-4">
        {/* Logo */}
        <div className={`w-[68px] h-[68px] sm:w-[80px] sm:h-[80px] rounded-full bg-gray-300 border-2 border-white/50 shadow-lg ${shimmerClass}`} />
        {/* Name */}
        <div className={`mt-2 h-5 w-36 rounded-full bg-gray-300/60 ${shimmerClass}`} />
        {/* Meta chips */}
        <div className="flex items-center gap-2 mt-1.5">
          <div className={`h-4 w-14 rounded-full bg-gray-300/40 ${shimmerClass}`} />
          <div className={`h-3 w-28 rounded-full bg-gray-300/30 ${shimmerClass}`} />
        </div>
      </div>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  FeaturedProductsSkeleton — panoramic 16:9 snap cards               */
/* ------------------------------------------------------------------ */
export const FeaturedProductsSkeleton = () => (
  <div className="mb-4 sm:mb-5 px-3 sm:px-4 lg:px-6 animate-fadeIn">
    <div className="flex items-center gap-2 mb-3">
      <div className={`w-7 h-7 rounded-lg bg-gray-200 ${shimmerClass}`} />
      <div className={`h-4 w-24 rounded-full bg-gray-200 ${shimmerClass}`} />
    </div>
    <div className="flex gap-3 overflow-hidden -mx-3 px-3 sm:-mx-4 sm:px-4">
      {[1, 2].map(i => (
        <div key={i} className="flex-shrink-0 w-[80%] sm:w-[70%] rounded-2xl overflow-hidden bg-gray-200 shadow-sm">
          <div className={`aspect-[16/9] bg-gray-200 ${shimmerClass}`} />
        </div>
      ))}
    </div>
    {/* Pagination dots */}
    <div className="flex justify-center gap-1.5 mt-3">
      {[1, 2, 3].map(i => (
        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === 1 ? 'bg-gray-400' : 'bg-gray-200'}`} />
      ))}
    </div>
  </div>
);
