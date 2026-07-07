import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { installPushNavHandler } from '../lib/pushClient';

// Listens for messages posted from the push service worker when a
// user taps a notification. Routes the navigation through React
// Router so we don't do a full page reload. Renders nothing.
export default function PushNavigationBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    return installPushNavHandler(navigate);
  }, [navigate]);
  return null;
}
