/**
 * POS Sync Engine — Syncs offline orders when connection returns.
 * 
 * - Watches navigator.onLine and periodic checks
 * - Processes pending orders one by one
 * - Retries on failure with backoff
 * - Emits events so UI can react
 */

import api from './api';
import {
  getPendingSyncOrders,
  updateQueuedOrder,
  removeQueuedOrder,
} from './posOfflineStore';

const MAX_RETRIES = 5;
let syncing = false;
let listeners = [];

// Event system
export function onSyncEvent(callback) {
  listeners.push(callback);
  return () => { listeners = listeners.filter(l => l !== callback); };
}

function emit(event, data) {
  listeners.forEach(cb => cb(event, data));
}

/**
 * Attempt to sync all pending offline orders.
 * Returns { synced: number, failed: number, errors: [] }
 */
export async function syncPendingOrders() {
  if (syncing) return { synced: 0, failed: 0, errors: [] };
  if (!navigator.onLine) return { synced: 0, failed: 0, errors: ['offline'] };

  syncing = true;
  emit('sync_start', null);

  const pending = await getPendingSyncOrders();
  let synced = 0;
  let failed = 0;
  const errors = [];

  for (const offlineOrder of pending) {
    try {
      await updateQueuedOrder(offlineOrder.offlineId, { status: 'syncing' });
      emit('order_syncing', offlineOrder);

      const res = await api.post('/orders', offlineOrder.orderData);
      const serverOrder = res.data?.order || res.data;

      // Mark as synced with server data
      await updateQueuedOrder(offlineOrder.offlineId, {
        status: 'synced',
        serverOrderId: serverOrder._id,
        serverOrderNumber: serverOrder.orderNumber,
        syncedAt: new Date().toISOString(),
      });

      emit('order_synced', { ...offlineOrder, serverOrder });
      synced++;

      // Clean up synced orders after a delay
      setTimeout(() => removeQueuedOrder(offlineOrder.offlineId), 60000);
    } catch (err) {
      const attempts = (offlineOrder.attempts || 0) + 1;
      const errorMsg = err.response?.data?.message || err.message || 'Error desconocido';

      if (attempts >= MAX_RETRIES) {
        await updateQueuedOrder(offlineOrder.offlineId, {
          status: 'error',
          attempts,
          lastError: errorMsg,
        });
        failed++;
        errors.push({ offlineId: offlineOrder.offlineId, error: errorMsg });
        emit('order_failed', { ...offlineOrder, error: errorMsg });
      } else {
        await updateQueuedOrder(offlineOrder.offlineId, {
          status: 'pending_sync',
          attempts,
          lastError: errorMsg,
        });
        emit('order_retry', { ...offlineOrder, attempts, error: errorMsg });
      }
    }
  }

  syncing = false;
  emit('sync_complete', { synced, failed, errors });
  return { synced, failed, errors };
}

/**
 * Start auto-sync: listens for online events and polls periodically.
 * Returns cleanup function.
 */
export function startAutoSync(intervalMs = 15000) {
  const handleOnline = () => {
    emit('connection_restored', null);
    syncPendingOrders();
  };

  const handleOffline = () => {
    emit('connection_lost', null);
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Periodic sync check
  const timer = setInterval(() => {
    if (navigator.onLine) {
      syncPendingOrders();
    }
  }, intervalMs);

  // Initial sync if online
  if (navigator.onLine) {
    syncPendingOrders();
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    clearInterval(timer);
  };
}
