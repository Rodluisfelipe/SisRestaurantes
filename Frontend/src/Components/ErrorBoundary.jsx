import React, { Component } from 'react';
import { isChunkLoadError, recoverFromChunkError, chunkReloadAlreadyAttempted } from '../utils/chunkReload';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, recovering: false };
  }

  static getDerivedStateFromError(error) {
    // Un chunk viejo tras un deploy (React.lazy/Suspense traga la promesa y el
    // error llega aquí como render error). No es un bug de la app: mostramos
    // spinner y disparamos la auto-recuperación (limpiar SW/cachés + reload)
    // en vez de la pantalla roja de "¡Oops!".
    if (isChunkLoadError(error) && !chunkReloadAlreadyAttempted()) {
      return { hasError: true, error, recovering: true };
    }
    return { hasError: true, error, recovering: false };
  }

  componentDidCatch(error, errorInfo) {
    if (isChunkLoadError(error)) {
      // Intentar recuperarse (no-op si ya se intentó en esta sesión).
      const triggered = recoverFromChunkError('errorboundary');
      if (triggered) return; // reload en camino; no es un fallo real de la app
    }
    /* Sin Sentry, el error solo queda en la consola del navegador: si un
       usuario reporta la pantalla de "¡Oops!", hay que pedirle la consola
       porque ya no llega a ningún panel. */
    console.error("Error capturado por ErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRedirect = () => {
    // Si hay token, redirigir al admin
    const hasToken = localStorage.getItem('accessToken');
    const businessSlug = localStorage.getItem('businessSlug');
    const userStr = localStorage.getItem('user');
    
    if (hasToken && businessSlug) {
      window.location.href = `/${businessSlug}/admin`;
    } else if (hasToken && userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.businessId) {
          window.location.href = `/${user.businessId}/admin`;
        } else {
          window.location.href = '/';
        }
      } catch (e) {
        window.location.href = '/';
      }
    } else {
      window.location.href = '/';
    }
  };

  render() {
    // Chunk viejo tras deploy: mostramos un spinner neutro mientras la
    // auto-recuperación limpia SW/cachés y recarga con cache-bust.
    if (this.state.hasError && this.state.recovering) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-red-100" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-red-500 animate-spin" style={{ animationDuration: '0.8s' }} />
            </div>
            <p className="text-slate-500 text-sm">Actualizando a la última versión...</p>
          </div>
        </div>
      );
    }

    if (this.state.hasError) {
      const err = this.state.error;
      const stack = this.state.errorInfo?.componentStack || err?.stack || '';
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 sm:p-8 rounded-lg shadow-lg max-w-2xl w-full">
            <h1 className="text-2xl font-bold text-red-600 mb-2">¡Oops! Algo salió mal</h1>
            <p className="text-gray-600 mb-4">Ha ocurrido un error inesperado. El equipo técnico ha sido notificado.</p>

            {/* Debug panel — mostrar el error real para que se pueda diagnosticar */}
            {err && (
              <details open className="mb-4 bg-red-50 border border-red-200 rounded-lg overflow-hidden">
                <summary className="px-4 py-2 text-sm font-semibold text-red-700 cursor-pointer select-none">
                  Detalles del error (click para expandir/colapsar)
                </summary>
                <div className="px-4 py-3 border-t border-red-200 space-y-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-red-700 mb-1">Mensaje</p>
                    <p className="text-sm text-red-900 font-mono break-all">{err.message || String(err)}</p>
                  </div>
                  {stack && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-red-700 mb-1">Stack</p>
                      <pre className="text-[11px] text-red-900 font-mono whitespace-pre-wrap break-all max-h-80 overflow-y-auto bg-white/60 p-2 rounded">{stack}</pre>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      const text = `${err.message || String(err)}\n\n${stack}`;
                      navigator.clipboard?.writeText(text).then(() => alert('Copiado'));
                    }}
                    className="text-xs font-semibold text-red-700 underline hover:text-red-900"
                  >
                    Copiar al portapapeles
                  </button>
                </div>
              </details>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
              >
                Recargar
              </button>
              <button
                onClick={this.handleRedirect}
                className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors text-sm font-semibold"
              >
                Volver al inicio
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Si no hay error, renderizar los children normalmente
    return this.props.children;
  }
}

export default ErrorBoundary; 