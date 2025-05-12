import React, { useEffect, useState } from 'react';

/**
 * Componente simple que sirve como endpoint de health check para mantener la aplicación activa
 * Puede ser usado como ruta pública (/health) para Uptime Robot
 */
export default function HealthCheck() {
  const [healthInfo, setHealthInfo] = useState({
    status: 'loading',
    timestamp: new Date().toISOString()
  });

  useEffect(() => {
    // Intentar conectar al backend para verificar disponibilidad
    const checkBackendHealth = async () => {
      try {
        const response = await fetch('https://sisrestaurantes.onrender.com/api/health');
        const data = await response.json();
        
        setHealthInfo({
          status: 'online',
          timestamp: new Date().toISOString(),
          frontend: {
            env: import.meta.env.MODE || 'development',
          },
          backend: data
        });
      } catch (error) {
        console.error('Error al verificar el backend:', error);
        setHealthInfo({
          status: 'online',
          timestamp: new Date().toISOString(),
          frontend: {
            env: import.meta.env.MODE || 'development',
          },
          backend: {
            status: 'error',
            message: 'No se pudo conectar con el backend'
          }
        });
      }
    };

    checkBackendHealth();
  }, []);

  return (
    <div style={{ 
      padding: '20px',
      fontFamily: 'monospace',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      <h1>Sistema de Restaurantes - Health Check</h1>
      <pre style={{ 
        background: '#f5f5f5',
        padding: '15px',
        borderRadius: '5px',
        overflow: 'auto'
      }}>
        {JSON.stringify(healthInfo, null, 2)}
      </pre>
    </div>
  );
}
