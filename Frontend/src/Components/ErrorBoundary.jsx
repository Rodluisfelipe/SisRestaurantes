import { useRouteError } from 'react-router-dom';

export default function ErrorBoundary() {
  const error = useRouteError();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold text-red-600 mb-4">¡Oops! Algo salió mal</h1>
        <p className="text-gray-600 mb-4">
          {error.message || 'Ha ocurrido un error inesperado.'}
        </p>
        <button
          onClick={() => window.location.href = '/'}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Volver al inicio
        </button>
      </div>
    </div>
  );
} 