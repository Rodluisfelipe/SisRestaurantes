/**
 * Wrapper reutilizable para cada pestaña del Admin.
 * Mobile: no "Volver" button (MobileBottomNav handles navigation).
 * Tablet/small desktop (md-lg): shows back button as breadcrumb.
 */
export default function AdminTabWrapper({ children, setActiveTab }) {
  return (
    <div className="space-y-6">
      {/* Botón Volver - Solo tablet (md-lg), hidden on mobile (bottom nav) and desktop (sidebar) */}
      <button
        onClick={() => setActiveTab('dashboard')}
        className="hidden md:flex lg:hidden items-center space-x-2 text-slate-600 hover:text-slate-900 mb-4 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span className="font-medium">Volver al inicio</span>
      </button>
      {children}
    </div>
  );
}
