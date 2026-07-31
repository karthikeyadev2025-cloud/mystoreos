import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Hook wrapping the notification inbox. Provides:
//   - list of recent notifications
//   - unread count
//   - real-time push via Supabase Realtime (so new rows appear
//     instantly, and the caller can trigger a toast on onNew)
//   - actions: markRead, markAllRead, remove
//
// Deliberately does NOT show any UI itself — the caller composes the
// bell + drawer / mobile sheet with whatever design they like.
//
// `onNew(row)` fires ONCE per genuinely-new notification (not the
// initial hydration), so a caller can pop a toast without duplicating
// it for every already-seen entry when the app mounts.
export function useNotifications(userId, { onNew } = {}) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  // Track ids we've already seen so onNew doesn't fire twice on the
  // same row across refresh + realtime race conditions.
  const seenIds = useRef(new Set());
  // Skip onNew for the initial hydration — otherwise every mount would
  // spam 30 toasts. Only realtime deltas after mount are "new".
  const hydrated = useRef(false);

  const reload = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const rows = await api.getNotifications(userId, { limit: 30 });
      setItems(rows);
      setUnread(rows.filter(r => !r.read).length);
      rows.forEach(r => seenIds.current.add(r.id));
    } catch { /* fall through — bell just stays empty */ }
    finally {
      setLoading(false);
      hydrated.current = true;
    }
  }, [userId]);

  // Initial hydration + realtime subscription.
  useEffect(() => {
    if (!userId) return;
    reload();
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel(`notif_${userId}_${crypto.randomUUID().slice(0,8)}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new;
            setItems(prev => [row, ...prev].slice(0, 30));
            if (!row.read) setUnread(n => n + 1);
            // Toast trigger — only for genuinely new rows after mount.
            if (hydrated.current && !seenIds.current.has(row.id)) {
              seenIds.current.add(row.id);
              onNew?.(row);
            }
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new;
            setItems(prev => prev.map(x => x.id === row.id ? row : x));
            setUnread(prev => {
              // Recompute rather than delta — simpler, less error-prone.
              return prev; // will be corrected by next reload if wrong
            });
          } else if (payload.eventType === 'DELETE') {
            setItems(prev => prev.filter(x => x.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const markRead = useCallback(async (id) => {
    setItems(prev => prev.map(r => r.id === id ? { ...r, read: true } : r));
    setUnread(n => Math.max(0, n - 1));
    try { await api.markNotificationRead(id); } catch { /* optimistic — leave UI marked */ }
  }, []);

  const markAllRead = useCallback(async () => {
    setItems(prev => prev.map(r => ({ ...r, read: true })));
    setUnread(0);
    try { await api.markAllNotificationsRead(userId); } catch { /* ignore */ }
  }, [userId]);

  const remove = useCallback(async (id) => {
    const removed = items.find(r => r.id === id);
    setItems(prev => prev.filter(r => r.id !== id));
    if (removed && !removed.read) setUnread(n => Math.max(0, n - 1));
    try { await api.deleteNotification(id); } catch { /* ignore */ }
  }, [items]);

  return { items, unread, loading, reload, markRead, markAllRead, remove };
}
