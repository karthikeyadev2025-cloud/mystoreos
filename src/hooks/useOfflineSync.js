import { useState, useEffect, useCallback } from 'react';
import { flush, getPendingCount } from '../lib/offlineQueue';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Tracks online state, counts queued offline writes, and auto-flushes the queue on reconnect.
// pendingCount > 0 means the user has writes waiting to sync — show a badge in Phase 3 UI.
export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    try { setPendingCount(await getPendingCount()); } catch (_e) { /* IndexedDB unavailable */ }
  }, []);

  const syncNow = useCallback(async () => {
    if (!isSupabaseConfigured || !navigator.onLine) return null;
    setIsSyncing(true);
    try {
      const result = await flush(supabase);
      await refreshCount();
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, [refreshCount]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshCount();
    const handleOnline = () => { setIsOnline(true); syncNow(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshCount, syncNow]);

  return { isOnline, pendingCount, isSyncing, syncNow };
}
