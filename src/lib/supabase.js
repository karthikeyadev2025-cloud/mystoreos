import { createClient } from '@supabase/supabase-js'

const _url = import.meta.env.VITE_SUPABASE_URL;
const _key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validates that env vars are real values — not missing, "undefined", or the mock placeholder
export const isSupabaseConfigured =
  typeof _url === 'string' && _url.startsWith('https://') &&
  _url !== 'https://mock.supabase.co' &&
  typeof _key === 'string' && _key.length > 10 &&
  _key !== 'mock-key';

// When env vars are absent, create a client that never makes network requests.
// Without this guard the Supabase SDK calls auth.initialize() internally on
// createClient(), which tries to restore a stored session against the placeholder
// URL — that cross-origin request gets CORB-blocked by the browser.
export const supabase = isSupabaseConfigured
  ? createClient(_url, _key)
  : createClient('https://placeholder.supabase.co', 'placeholder-anon-key', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      },
      global: {
        fetch: () => Promise.reject(new Error('Supabase not configured')),
      },
    });
