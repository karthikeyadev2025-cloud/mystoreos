import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mock.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'mock-key'

// If no environment variables are provided, we will mock the backend logic in api.js
export const supabase = createClient(supabaseUrl, supabaseKey)

// A flag to check if real Supabase is configured
export const isSupabaseConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;
