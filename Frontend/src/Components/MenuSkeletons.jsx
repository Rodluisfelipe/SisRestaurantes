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
export const ProductCardSkeleton = () => (
  <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
    {/* Image placeholder */}
    <div className={`aspect-square bg-gray-200 ${shimmerClass}`} />
    {/* Info */}
    <div className="p-3 sm:p-4 space-y-2.5">
      <div className={`h-4 w-3/4 rounded-full bg-gray-200 ${shimmerClass}`} />
      <div className={`h-3 w-full rounded-full bg-gray-100 ${shimmerClass}`} />
      <div className="flex items-end justify-between pt-1">
        <div className={`h-5 w-16 rounded-full bg-gray-200 ${shimmerClass}`} />
        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gray-200 ${shimmerClass}`} />
      </div>
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
/*  BusinessHeaderSkeleton                                             */
/* ------------------------------------------------------------------ */
export const BusinessHeaderSkeleton = () => (
  <div className="w-full text-center relative bg-gray-100 animate-fadeIn">
    {/* Cover area */}
    <div className={`h-48 sm:h-56 bg-gray-200 ${shimmerClass}`} />

    {/* Overlaid content */}
    <div className="relative -mt-14 z-10 flex flex-col items-center">
      {/* Logo */}
      <div className={`w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-gray-300 border-[3px] border-white shadow-lg ${shimmerClass}`} />
      {/* Name */}
      <div className={`mt-2 h-7 w-48 rounded-full bg-gray-200 ${shimmerClass}`} />
      {/* Address */}
      <div className={`mt-2 h-4 w-36 rounded-full bg-gray-100 ${shimmerClass}`} />
      {/* Social icons */}
      <div className="flex gap-4 mt-2 mb-3">
        {[1, 2, 3].map(i => (
          <div key={i} className={`w-5 h-5 rounded-full bg-gray-200 ${shimmerClass}`} />
        ))}
      </div>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  FeaturedProductsSkeleton                                           */
/* ------------------------------------------------------------------ */
export const FeaturedProductsSkeleton = () => (
  <div className="mb-4 sm:mb-5 px-3 sm:px-4 lg:px-6 animate-fadeIn">
    <div className="flex items-center gap-2 mb-3">
      <div className={`w-7 h-7 rounded-lg bg-gray-200 ${shimmerClass}`} />
      <div className={`h-4 w-24 rounded-full bg-gray-200 ${shimmerClass}`} />
    </div>
    <div className="flex gap-3 overflow-hidden -mx-3 px-3 sm:-mx-4 sm:px-4">
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
);
