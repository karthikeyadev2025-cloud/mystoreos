import { createClient } from '@supabase/supabase-js'

const _url = import.meta.env.VITE_SUPABASE_URL;
const _key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validates that env vars are real values — not missing, "undefined", or the mock placeholder
export const isSupabaseConfigured =
  typeof _url === 'string' && _url.startsWith('https://') &&
  _url !== 'https://mock.supabase.co' &&
  typeof _key === 'string' && _key.length > 10 &&
  _key !== 'mock-key';

const supabaseUrl = isSupabaseConfigured ? _url : 'https://mock.supabase.co';
const supabaseKey = isSupabaseConfigured ? _key : 'mock-key';

export const supabase = createClient(supabaseUrl, supabaseKey);
