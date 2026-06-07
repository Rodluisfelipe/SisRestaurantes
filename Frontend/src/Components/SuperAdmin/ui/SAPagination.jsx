export default function SAPagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const getPages = () => {
    const pages = [];
    const delta = 2;
    const left = Math.max(1, page - delta);
    const right = Math.min(totalPages, page + delta);

    if (left > 1) { pages.push(1); if (left > 2) pages.push('...'); }
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages) { if (right < totalPages - 1) pages.push('...'); pages.push(totalPages); }
    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-1 pt-4">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="px-2.5 py-1.5 text-xs text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white/70 hover:bg-slate-100 dark:hover:bg-white/[0.04] rounded-lg transition disabled:opacity-25 disabled:cursor-not-allowed"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>

      {getPages().map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className="w-8 text-center text-xs text-slate-400 dark:text-white/20">...</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`w-8 h-8 text-xs rounded-lg transition-all ${
              p === page
                ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-white font-medium border border-slate-200 dark:border-white/[0.1]'
                : 'text-slate-500 dark:text-white/35 hover:text-slate-900 dark:hover:text-white/60 hover:bg-slate-100 dark:hover:bg-white/[0.04]'
            }`}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="px-2.5 py-1.5 text-xs text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white/70 hover:bg-slate-100 dark:hover:bg-white/[0.04] rounded-lg transition disabled:opacity-25 disabled:cursor-not-allowed"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>
    </div>
  );
}
