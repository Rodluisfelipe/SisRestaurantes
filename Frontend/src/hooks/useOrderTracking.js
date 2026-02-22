import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { socket } from '../services/socket';
import logger from '../utils/logger';

/**
 * Custom hook for tracking the active in-app order status.
 * Uses Socket.IO for real-time updates with HTTP polling as fallback.
 *
 * @param {boolean} isInAppMode - Whether in-app ordering is enabled
 * @returns {object} Active order state and controls
 */
export default function useOrderTracking(isInAppMode) {
  const [activeOrderId, setActiveOrderId] = useState(
    () => sessionStorage.getItem('activeOrderId') || null
  );
  const [activeCustomerToken, setActiveCustomerToken] = useState(
    () => sessionStorage.getItem('activeCustomerToken') || null
  );
  const [activeOrderStatus, setActiveOrderStatus] = useState(null);

  // Real-time status tracking via socket + fallback polling
  useEffect(() => {
    if (!activeOrderId || !activeCustomerToken || !isInAppMode) {
      setActiveOrderStatus(null);
      return;
    }

    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const res = await api.get(`/orders/track/${activeOrderId}`, {
          headers: { 'X-Customer-Token': activeCustomerToken }
        });
        if (!cancelled) setActiveOrderStatus(res.data.status || null);
      } catch {
        if (!cancelled) setActiveOrderStatus(null);
      }
    };
    fetchStatus();

    // Socket-based real-time tracking
    if (socket) {
      if (!socket.connected) socket.connect();
      socket.emit('trackOrder', { orderId: activeOrderId, customerToken: activeCustomerToken });

      const handleStatusChange = (data) => {
        if ((data.orderId === activeOrderId || data.orderId?.toString() === activeOrderId) && !cancelled) {
          setActiveOrderStatus(data.status || null);
        }
      };
      socket.on('order_status_changed', handleStatusChange);

      // Reduced fallback polling (30s instead of 6s)
      const interval = setInterval(fetchStatus, 30000);
      return () => {
        cancelled = true;
        socket.off('order_status_changed', handleStatusChange);
        socket.emit('untrackOrder', activeOrderId);
        clearInterval(interval);
      };
    }

    // Fallback: polling only if socket unavailable
    const interval = setInterval(fetchStatus, 6000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [activeOrderId, activeCustomerToken, isInAppMode]);

  const clearActiveOrder = useCallback(() => {
    const orderId = activeOrderId;
    setActiveOrderId(null);
    setActiveCustomerToken(null);
    setActiveOrderStatus(null);
    sessionStorage.removeItem('activeOrderId');
    sessionStorage.removeItem('activeCustomerToken');
    return orderId; // Return for caller to trigger review modal
  }, [activeOrderId]);

  const setActiveOrder = useCallback((orderId, customerToken) => {
    sessionStorage.setItem('activeOrderId', orderId);
    sessionStorage.setItem('activeCustomerToken', customerToken);
    setActiveOrderId(orderId);
    setActiveCustomerToken(customerToken);
  }, []);

  return {
    activeOrderId,
    activeCustomerToken,
    activeOrderStatus,
    clearActiveOrder,
    setActiveOrder,
  };
}
