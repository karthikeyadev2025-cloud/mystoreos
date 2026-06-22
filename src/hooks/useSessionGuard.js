import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useSubscription } from './useSubscription';
import { api } from '../lib/api';
import { getDeviceFingerprint } from '../lib/sessionManager';
import { isSupabaseConfigured } from '../lib/supabase';

// Registers this device as an active session and enforces the plan's maxDevices limit.
// Returns { deviceLimitExceeded, activeSessions, forceRevokeOthers }.
export function useSessionGuard() {
  const { user } = useAuth();
  const { capabilities } = useSubscription();
  const [deviceLimitExceeded, setDeviceLimitExceeded] = useState(false);
  const [activeSessions, setActiveSessions] = useState([]);

  const forceRevokeOthers = useCallback(async () => {
    if (!user) return;
    const fp = getDeviceFingerprint();
    await api.revokeOtherSessions(user.id, fp);
    // Re-register this device
    const sessions = await api.getActiveSessions(user.id);
    const thisDevice = sessions.find(s => s.deviceFingerprint === fp);
    if (!thisDevice) await api.registerSession(user.id, fp);
    setActiveSessions(await api.getActiveSessions(user.id));
    setDeviceLimitExceeded(false);
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== 'shop' || !isSupabaseConfigured) return;

    const fp = getDeviceFingerprint();
    const maxDevices = capabilities?.maxDevices ?? 1;

    // Dedupe guard — prevents two concurrent mounts from both calling
    // registerSession simultaneously and hitting a 409 conflict.
    let registering = false;
    const checkAndRegister = async () => {
      if (registering) return;
      registering = true;
      try {
        const sessions = await api.getActiveSessions(user.id);
        setActiveSessions(sessions);
        const thisDevice = sessions.find(s => s.deviceFingerprint === fp);

        if (thisDevice) {
          await api.updateSessionLastSeen(thisDevice.id);
          return;
        }

        if (sessions.length >= maxDevices) {
          setDeviceLimitExceeded(true);
          return;
        }

        await api.registerSession(user.id, fp);
      } finally {
        registering = false;
      }
    };

    checkAndRegister();

    // Heartbeat every 2 minutes to keep last_seen fresh
    const hb = setInterval(async () => {
      const sessions = await api.getActiveSessions(user.id);
      const thisDevice = sessions.find(s => s.deviceFingerprint === fp);
      if (thisDevice) await api.updateSessionLastSeen(thisDevice.id);
    }, 120_000);

    return () => clearInterval(hb);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, capabilities?.maxDevices]);

  return { deviceLimitExceeded, activeSessions, forceRevokeOthers };
}
