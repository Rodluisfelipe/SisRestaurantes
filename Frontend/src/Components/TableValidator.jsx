import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { validateTable, getInvalidTableRedirectUrl } from '../utils/tableUtils';
import { useBusinessConfig } from '../Context/BusinessContext';
import logger from '../utils/logger';

/**
 * Component that validates if a table exists and shows an error message if not
 * Acts as a wrapper for the child component that should only be shown for valid tables
 */
const TableValidator = ({ children }) => {
  const { businessId, tableNumber } = useParams();
  const navigate = useNavigate();
  const { businessConfig } = useBusinessConfig();
  
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);

  useEffect(() => {
    const checkTable = async () => {
      if (!businessId || !tableNumber) {
        logger.error('TableValidator: Missing params', { businessId, tableNumber });
        setIsValid(false);
        setError('Información de mesa incompleta');
        setIsValidating(false);
        return;
      }

      try {
        logger.info('TableValidator: Validating table', { businessId, tableNumber });
        // Agregar un poco de retraso para asegurarse de que el BusinessProvider haya terminado de cargar
        setTimeout(async () => {
          try {
            const result = await validateTable(businessId, tableNumber);
            
            if (result.exists) {
              logger.info('TableValidator: Table is valid', result.table);
              setIsValid(true);
            } else {
              logger.warn('TableValidator: Invalid table', { error: result.error });
              setIsValid(false);
              setError(result.error || 'Mesa no encontrada');
              setDebugInfo({
                request: { businessId, tableNumber },
                response: result
              });
              
              // Redirect after a short delay so the user can see the error
              setTimeout(() => {
                navigate(getInvalidTableRedirectUrl(businessId));
              }, 5000);
            }
          } catch (err) {
            logger.error('TableValidator: Error in delayed validation', err);
            setIsValid(false);
            setError(`Error al validar la mesa: ${err.message}`);
            setDebugInfo({
              error: err.message,
              stack: err.stack,
              request: { businessId, tableNumber }
            });
          } finally {
            setIsValidating(false);
          }
        }, 500); // Pequeño retraso para asegurar que BusinessContext esté listo
      } catch (err) {
        logger.error('TableValidator: Error validating table', err);
        setIsValid(false);
        setError(`Error al validar la mesa: ${err.message}`);
        setDebugInfo({
          error: err.message,
          stack: err.stack,
          request: { businessId, tableNumber }
        });
        setIsValidating(false);
      }
    };

    checkTable();
  }, [businessId, tableNumber, navigate]);

  if (isValidating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-700 text-lg">Validando mesa {tableNumber}...</p>
        <p className="text-gray-500 text-sm mt-2">Negocio: {businessId}</p>
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Mesa no válida</h2>
          <p className="text-gray-600 mb-4">{error || 'La mesa que intentas acceder no existe.'}</p>
          <p className="text-gray-500 mb-2">Mesa: {tableNumber}</p>
          <p className="text-gray-500 mb-6">Serás redirigido automáticamente...</p>
          
          {debugInfo && (
            <div className="text-left bg-gray-100 p-3 rounded mb-4 text-xs overflow-auto max-h-40">
              <p className="font-bold mb-1">Información de depuración:</p>
              <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
            </div>
          )}
          
          <button
            onClick={() => navigate(getInvalidTableRedirectUrl(businessId))}
            style={{ 
              backgroundColor: businessConfig?.theme?.buttonColor || '#3B82F6', 
              color: businessConfig?.theme?.buttonTextColor || 'white'
            }}
            className="px-4 py-2 rounded-md font-medium transition-colors duration-300"
          >
            Ir al menú principal
          </button>
        </div>
      </div>
    );
  }

  // If the table is valid, render the children
  return children;
};

export default TableValidator; 