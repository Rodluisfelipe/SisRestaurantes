import { Component } from 'react';

/**
 * Error boundary granular para secciones del Admin.
 * Si un tab (Orders, Delivery, Products, etc.) crashea,
 * solo muestra error en esa sección — no tumba toda la app.
 */
class AdminSectionErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[AdminSection] Error en "${this.props.sectionName || 'desconocido'}":`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] bg-red-50 rounded-2xl border border-red-200 p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-red-700 mb-2">
            Error en {this.props.sectionName || 'esta sección'}
          </h3>
          <p className="text-sm text-red-600 mb-4 max-w-md">
            Ocurrió un error inesperado. Puedes intentar de nuevo o volver al inicio.
          </p>
          <div className="flex gap-3">
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
            >
              Reintentar
            </button>
            {this.props.onGoBack && (
              <button
                onClick={this.props.onGoBack}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
              >
                Volver al inicio
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AdminSectionErrorBoundary;
