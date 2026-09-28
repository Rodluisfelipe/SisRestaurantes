import { Component } from "react";
import { isChunkLoadError, recoverFromChunkError, chunkReloadAlreadyAttempted, resetChunkReload } from '../utils/chunkReload';
import { reportarError } from '../utils/reportarError';

/**
 * Última línea de defensa de toda la app.
 *
 * - Archivo de pantalla que no bajó (deploy, conexión, caché dañada): se
 *   repara y recarga solo; si no se puede, pantalla de "sin conexión".
 * - Cualquier otro error: mensaje claro y un código corto. El detalle técnico
 *   va al servidor (buscable por ese código), no a la cara del usuario.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, recovering: false, codigo: '', copiado: false };
  }

  static getDerivedStateFromError(error) {
    if (isChunkLoadError(error) && !chunkReloadAlreadyAttempted()) {
      return { hasError: true, error, recovering: true };
    }
    return { hasError: true, error, recovering: false };
  }

  componentDidCatch(error, errorInfo) {
    if (isChunkLoadError(error)) {
      const triggered = recoverFromChunkError('errorboundary', error);
      if (triggered) return; // reparación y recarga en camino
      // Sin conexión: apenas vuelva el internet, se intenta de nuevo solo.
      window.addEventListener('online', this.reintentar, { once: true });
    }
    const codigo = reportarError(error, {
      tipo: isChunkLoadError(error) ? 'carga' : 'pantalla',
      componente: errorInfo?.componentStack || '',
    });
    this.setState({ codigo, recovering: false });
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.reintentar);
  }

  reintentar = () => {
    resetChunkReload();
    window.location.reload();
  };

  irAlInicio = () => {
    const slug = localStorage.getItem('businessSlug');
    window.location.href = localStorage.getItem('accessToken') && slug ? `/${slug}/admin` : '/';
  };

  copiarCodigo = () => {
    navigator.clipboard?.writeText(this.state.codigo).then(() => {
      this.setState({ copiado: true });
      setTimeout(() => this.setState({ copiado: false }), 2000);
    }).catch(() => {});
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.state.recovering) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-red-100" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-red-500 animate-spin" style={{ animationDuration: '0.8s' }} />
            </div>
            <p className="text-slate-500 text-sm">Cargando la última versión…</p>
          </div>
        </div>
      );
    }

    const deConexion = isChunkLoadError(this.state.error);
    const { codigo, copiado } = this.state;

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            {deConexion ? 'No se pudo cargar esta pantalla' : 'Esta pantalla tuvo un problema'}
          </h1>
          <p className="text-slate-600 mb-5">
            {deConexion
              ? 'La conexión a internet falló mientras cargaba. Revisa el wifi o los datos; en cuanto vuelva la conexión se carga sola.'
              : 'Tus datos están a salvo. Vuelve a intentarlo; si se repite, envíanos este código.'}
          </p>

          {codigo && (
            <button
              type="button"
              onClick={this.copiarCodigo}
              className="mb-5 inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-sm text-slate-700 hover:bg-slate-200"
              title="Copiar código"
            >
              {codigo}
              <span className="font-sans text-xs text-slate-500">{copiado ? 'Copiado' : 'Copiar'}</span>
            </button>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={this.reintentar}
              className="flex-1 bg-red-600 text-white py-3 px-4 rounded-xl hover:bg-red-700 transition-colors font-semibold"
            >
              Reintentar
            </button>
            {!deConexion && (
              <button
                onClick={this.irAlInicio}
                className="flex-1 bg-slate-100 text-slate-800 py-3 px-4 rounded-xl hover:bg-slate-200 transition-colors font-semibold"
              >
                Ir al inicio
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
