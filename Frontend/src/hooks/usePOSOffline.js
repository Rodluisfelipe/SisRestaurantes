import { useState, useEffect, useCallback, useRef } from 'react';
import { onSyncEvent, startAutoSync, syncPendingOrders } from '../services/posSyncEngine';
import { getPendingSyncOrders, getCacheStatus } from '../services/posOfflineStore';

/**
 * Hook that provides offline status and sync info for POS.
 * 
 * Returns:
 *   isOnline        — current connection status
 *   pendingSyncCount — number of orders waiting to sync
 *   isSyncing       — true while sync is in progress
 *   lastSyncResult  — { synced, failed, errors } from last sync
 *   syncNow         — manually trigger sync
 *   hasCachedData   — whether products/categories are cached
 */
export default function usePOSOffline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null);
  const [hasCachedData, setHasCachedData] = useState(false);
  const cleanupRef = useRef(null);

  // Refresh pending count
  const refreshPending = useCallback(async () => {
    try {
      const pending = await getPendingSyncOrders();
      setPendingSyncCount(pending.length);
    } catch {}
  }, []);

  useEffect(() => {
    // Check cache status
    getCacheStatus().then(status => {
      setHasCachedData(status.hasCachedData);
      setPendingSyncCount(status.pendingSyncCount);
    }).catch(() => {});

    // Listen to online/offline
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Listen to sync events
    const unsubscribe = onSyncEvent((event, data) => {
      switch (event) {
        case 'sync_start':
          setIsSyncing(true);
          break;
        case 'sync_complete':
          setIsSyncing(false);
          setLastSyncResult(data);
          refreshPending();
          break;
        case 'connection_restored':
          setIsOnline(true);
          break;
        case 'connection_lost':
          setIsOnline(false);
          break;
        case 'order_synced':
        case 'order_failed':
          refreshPending();
          break;
      }
    });

    // Start auto-sync
    cleanupRef.current = startAutoSync(15000);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      unsubscribe();
      if (cleanupRef.current) cleanupRef.current();
    };
  }, [refreshPending]);

  const syncNow = useCallback(() => {
    return syncPendingOrders();
  }, []);

  return {
    isOnline,
    pendingSyncCount,
    isSyncing,
    lastSyncResult,
    syncNow,
    hasCachedData,
  };
}
