import { useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Subscribes to Supabase Realtime postgres_changes for a table (with optional row filter).
// Falls back to polling every pollInterval ms when Supabase is not configured.
// The polling also runs alongside Realtime as a safety net for missed events.
//
// Usage:
//   useRealtimeTable({ table: 'orders', filter: `shop_id=eq.${shopId}`, onRefresh: loadData })
//
// onRefresh should be a stable useCallback reference to avoid unnecessary re-subscriptions.
export function useRealtimeTable({ table, filter = null, onRefresh, pollInterval = 30_000 }) {
  useEffect(() => {
    const refresh = () => onRefresh?.();

    // Polling runs regardless of Realtime status — catches missed events and covers
    // the localStorage-only (non-Supabase) development mode.
    const pollId = setInterval(refresh, pollInterval);

    if (!isSupabaseConfigured) {
      return () => clearInterval(pollId);
    }

    const channelConfig = { event: '*', schema: 'public', table };
    if (filter) channelConfig.filter = filter;

    // Channel name only needs to be unique within this effect lifecycle.
    // crypto.randomUUID() inside an effect is fine — not during render.
    const channelName = `mystore_rt_${table}_${crypto.randomUUID().slice(0, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', channelConfig, () => refresh())
      .subscribe();

    return () => {
      clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, [table, filter, pollInterval, onRefresh]);
}
