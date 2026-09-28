import { Component } from 'react';
import { isChunkLoadError, recoverFromChunkError, resetChunkReload } from '../../utils/chunkReload';
import { reportarError } from '../../utils/reportarError';

/**
 * Error boundary granular para secciones del Admin.
 * Si un tab (Orders, Delivery, Products, etc.) crashea, solo esa sección
 * muestra el aviso — el resto del panel sigue funcionando.
 *
 * Si lo que falló es la descarga del archivo de la sección, "Reintentar" no
 * puede resolverlo en el sitio (React recuerda el fallo): se repara la caché
 * y se recarga la página.
 */
class AdminSectionErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, codigo: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const codigo = reportarError(error, {
      tipo: isChunkLoadError(error) ? 'carga' : 'seccion',
      seccion: this.props.sectionName || '',
      componente: errorInfo?.componentStack || '',
    });
    this.setState({ codigo });
  }

  handleRetry = () => {
    if (isChunkLoadError(this.state.error)) {
      resetChunkReload();
      if (!recoverFromChunkError('seccion', this.state.error)) window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null, codigo: '' });
  };

  render() {
    if (this.state.hasError) {
      const deConexion = isChunkLoadError(this.state.error);
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">
            {deConexion
              ? `No se pudo cargar ${this.props.sectionName || 'esta sección'}`
              : `${this.props.sectionName || 'Esta sección'} tuvo un problema`}
          </h3>
          <p className="text-sm text-slate-600 mb-4 max-w-md">
            {deConexion
              ? 'La conexión falló mientras cargaba. Revisa el internet y vuelve a intentarlo.'
              : 'Tus datos están a salvo. Vuelve a intentarlo; si se repite, envíanos este código.'}
          </p>
          {this.state.codigo && !deConexion && (
            <p className="mb-4 rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-sm text-slate-700 select-all">{this.state.codigo}</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-semibold"
            >
              Reintentar
            </button>
            {this.props.onGoBack && (
              <button
                onClick={() => { this.setState({ hasError: false, error: null, codigo: '' }); this.props.onGoBack(); }}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-semibold"
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
