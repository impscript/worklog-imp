import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

// Authentication is handled by the HRMS/IDMS handshake, not Supabase Auth.
// Do not persist or refresh a stale Supabase session: an invalid access token
// would override the anon key and make otherwise permitted REST requests fail
// with 401 Unauthorized.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});
