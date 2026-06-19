/**
 * OfflineContext.jsx
 * ------------------------------------------------------------------
 * Provides:
 *   isOnline       – Boolean, current network status
 *   isSyncing      – Boolean, drain in progress
 *   pendingCount   – Number, actions waiting to sync
 *   syncProgress   – { done, total } during drain
 *   triggerSync    – () => Promise, manually start drain
 * ------------------------------------------------------------------
 */
import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef
} from 'react';
import {
  getPendingCount,
  drainQueue,
  enqueueAction,
} from '../utils/offlineQueue';

const OfflineCtx = createContext({
  isOnline:     true,
  isSyncing:    false,
  pendingCount: 0,
  syncProgress: { done: 0, total: 0 },
  triggerSync:  () => {},
  enqueue:      () => {},
});

export const useOffline = () => useContext(OfflineCtx);

export const OfflineProvider = ({ children }) => {
  const [isOnline,     setIsOnline]     = useState(() => navigator.onLine);
  const [isSyncing,    setIsSyncing]    = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncProgress, setSyncProgress] = useState({ done: 0, total: 0 });
  const syncLock = useRef(false);

  /* ── Refresh pending count ──────────────────────────────────── */
  const refreshCount = useCallback(async () => {
    const n = await getPendingCount();
    setPendingCount(n);
  }, []);

  /* ── Drain the queue ────────────────────────────────────────── */
  const triggerSync = useCallback(async () => {
    if (syncLock.current || !navigator.onLine) return;
    syncLock.current = true;
    setIsSyncing(true);
    setSyncProgress({ done: 0, total: 0 });

    try {
      const synced = await drainQueue((done, total) => {
        setSyncProgress({ done, total });
      });
      if (synced > 0) {
        console.log(`[Offline] Synced ${synced} queued actions`);
      }
    } finally {
      await refreshCount();
      setIsSyncing(false);
      setSyncProgress({ done: 0, total: 0 });
      syncLock.current = false;
    }
  }, [refreshCount]);

  /* ── Listen to online/offline events ───────────────────────── */
  useEffect(() => {
    const goOnline = async () => {
      setIsOnline(true);
      // Small delay so the browser stabilises the connection
      await new Promise(r => setTimeout(r, 800));
      await triggerSync();
    };
    const goOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);

    // Initial count poll
    refreshCount();

    // Poll count every 30 s so badge stays accurate across tabs
    const interval = setInterval(refreshCount, 30_000);

    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
      clearInterval(interval);
    };
  }, [triggerSync, refreshCount]);

  /* ── Listen for SW background-sync message ──────────────────── */
  useEffect(() => {
    const handleSWMsg = (event) => {
      if (event.data?.type === 'DRAIN_OFFLINE_QUEUE') {
        triggerSync();
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleSWMsg);
    return () => navigator.serviceWorker?.removeEventListener('message', handleSWMsg);
  }, [triggerSync]);

  /* ── Public enqueue wrapper (increments count) ──────────────── */
  const enqueue = useCallback(async (action) => {
    await enqueueAction(action);
    await refreshCount();
  }, [refreshCount]);

  const value = {
    isOnline,
    isSyncing,
    pendingCount,
    syncProgress,
    triggerSync,
    enqueue,
  };

  return (
    <OfflineCtx.Provider value={value}>
      {children}
    </OfflineCtx.Provider>
  );
};

export default OfflineProvider;
