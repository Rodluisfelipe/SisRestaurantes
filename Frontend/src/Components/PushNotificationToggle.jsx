import React, { useState, useEffect } from 'react';
import { 
  subscribeToPush, 
  unsubscribeFromPush, 
  checkSubscriptionStatus,
  isPushSupported 
} from '../utils/pushNotifications';

/**
 * Componente para activar/desactivar notificaciones push
 * @param {string} businessId - ID del negocio actual
 * @param {string} userId - ID del usuario (opcional)
 */
const PushNotificationToggle = ({ businessId, userId = null }) => {
  const [status, setStatus] = useState({
    supported: false,
    permission: 'default',
    subscribed: false,
    loading: true
  });
  const [error, setError] = useState(null);

  // Verificar estado inicial
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const currentStatus = await checkSubscriptionStatus();
        setStatus({ ...currentStatus, loading: false });
      } catch (err) {
        console.error('[PushToggle] Error checking status:', err);
        setStatus(prev => ({ ...prev, loading: false }));
      }
    };

    checkStatus();
  }, []);

  const handleSubscribe = async () => {
    setError(null);
    setStatus(prev => ({ ...prev, loading: true }));

    try {
      await subscribeToPush(businessId, userId);
      const newStatus = await checkSubscriptionStatus();
      setStatus({ ...newStatus, loading: false });
      
      // Mostrar notificación de prueba
      if (Notification.permission === 'granted') {
        new Notification('¡Alertas activadas!', {
          body: 'Recibirás notificaciones de pedidos en tiempo real',
          icon: '/icon-192x192.png'
        });
      }
    } catch (err) {
      console.error('[PushToggle] Subscribe error:', err);
      setError(err.message || 'Error al activar alertas');
      setStatus(prev => ({ ...prev, loading: false }));
    }
  };

  const handleUnsubscribe = async () => {
    setError(null);
    setStatus(prev => ({ ...prev, loading: true }));

    try {
      await unsubscribeFromPush();
      const newStatus = await checkSubscriptionStatus();
      setStatus({ ...newStatus, loading: false });
    } catch (err) {
      console.error('[PushToggle] Unsubscribe error:', err);
      setError(err.message || 'Error al desactivar alertas');
      setStatus(prev => ({ ...prev, loading: false }));
    }
  };

  // Si no está soportado, no mostrar nada
  if (!status.supported && !status.loading) {
    return (
      <div style={styles.container}>
        <div style={styles.unsupported}>
          <span style={styles.icon}>ℹ️</span>
          <div>
            <div style={styles.title}>Notificaciones no disponibles</div>
            <div style={styles.subtitle}>
              Tu navegador no soporta notificaciones push.
              {navigator.userAgent.includes('iPhone') && (
                <span> En iOS, instala la app en tu pantalla de inicio primero.</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status.loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Cargando...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={styles.icon}>🔔</span>
          <div>
            <div style={styles.title}>Alertas de Pedidos</div>
            <div style={styles.subtitle}>
              {status.subscribed 
                ? 'Recibirás notificaciones en tiempo real' 
                : 'Activa las notificaciones para no perderte ningún pedido'}
            </div>
          </div>
        </div>

        {error && (
          <div style={styles.error}>
            <span>⚠️</span> {error}
          </div>
        )}

        <button
          onClick={status.subscribed ? handleUnsubscribe : handleSubscribe}
          disabled={status.loading}
          style={{
            ...styles.button,
            ...(status.subscribed ? styles.buttonDanger : styles.buttonPrimary)
          }}
        >
          {status.loading ? 'Procesando...' : status.subscribed ? 'Desactivar Alertas' : 'Activar Alertas'}
        </button>

        {status.permission === 'denied' && (
          <div style={styles.warning}>
            <span>⚠️</span>
            <div>
              Has bloqueado las notificaciones. Para activarlas, ve a la configuración de tu navegador.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '16px',
    maxWidth: '600px',
    margin: '0 auto'
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    border: '1px solid #e0e0e0'
  },
  header: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px'
  },
  icon: {
    fontSize: '32px',
    flexShrink: 0
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '4px'
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    lineHeight: '1.4'
  },
  button: {
    width: '100%',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginTop: '12px'
  },
  buttonPrimary: {
    backgroundColor: '#4CAF50',
    color: '#fff'
  },
  buttonDanger: {
    backgroundColor: '#f44336',
    color: '#fff'
  },
  error: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    padding: '12px',
    borderRadius: '8px',
    marginTop: '12px',
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    fontSize: '14px'
  },
  warning: {
    backgroundColor: '#fff3e0',
    color: '#e65100',
    padding: '12px',
    borderRadius: '8px',
    marginTop: '12px',
    display: 'flex',
    gap: '8px',
    fontSize: '14px',
    lineHeight: '1.4'
  },
  unsupported: {
    display: 'flex',
    gap: '12px',
    padding: '16px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
    border: '1px solid #e0e0e0'
  },
  loading: {
    textAlign: 'center',
    padding: '20px',
    color: '#666'
  }
};

export default PushNotificationToggle;

