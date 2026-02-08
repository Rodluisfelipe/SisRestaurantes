/**
 * Wrapper reutilizable para cada pestaña del Admin.
 * Incluye el botón "Volver al inicio" en móvil que se repetía 15+ veces.
 */
export default function AdminTabWrapper({ children, setActiveTab }) {
  return (
    <div className="space-y-6">
      {/* Botón Volver - Solo móvil */}
      <button
        onClick={() => setActiveTab('dashboard')}
        className="lg:hidden flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-4 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
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
