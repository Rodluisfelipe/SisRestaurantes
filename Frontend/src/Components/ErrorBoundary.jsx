import React, { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Actualizar el estado para mostrar la UI de fallback
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // También puedes registrar el error en un servicio de reporte de errores
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
    if (this.state.hasError) {
      // Renderizar UI de fallback personalizada
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
            <h1 className="text-2xl font-bold text-red-600 mb-4">¡Oops! Algo salió mal</h1>
            <p className="text-gray-600 mb-4">
              {this.state.error?.message || 'Ha ocurrido un error inesperado.'}
            </p>
            <button
              onClick={this.handleRedirect}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      );
    }

    // Si no hay error, renderizar los children normalmente
    return this.props.children;
  }
}

export default ErrorBoundary; 