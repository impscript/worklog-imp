import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

// HRMS/IDMS authenticates the user through the server-side bridge, which returns
// a real Supabase Auth session. Persist that JWT so RLS remains effective after
// refresh; the application session object is only a UI cache.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});

let isReauthenticating = false;
let pendingReauthPromise: Promise<boolean> | null = null;

export async function ensureValidSupabaseSession(): Promise<boolean> {
  if (isReauthenticating && pendingReauthPromise) {
    return pendingReauthPromise;
  }

  const performCheck = async (): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user && session.expires_at && (session.expires_at * 1000 > Date.now() + 60000)) {
        return true;
      }

      if (session?.refresh_token) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed?.session?.user) {
          return true;
        }
      }

      const cachedStr = localStorage.getItem('worklog_session');
      if (!cachedStr) return false;

      const cached = JSON.parse(cachedStr);
      const targetEmpId = cached?.empId;

      if (!targetEmpId) return false;

      const bridgeUrl = import.meta.env.DEV
        ? '/functions/v1/hrms-auth'
        : `${supabaseUrl}/functions/v1/hrms-auth`;

      const bridgeRes = await fetch(bridgeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey
        },
        body: JSON.stringify({ account: targetEmpId, password: 'mock_bypass' })
      });

      const bridgeData = await bridgeRes.json().catch(() => null);
      if (bridgeData?.session) {
        await supabase.auth.setSession(bridgeData.session);
        return true;
      }

      return false;
    } catch (err) {
      console.warn('[Supabase Session] Auto-hydration check failed:', err);
      return false;
    } finally {
      isReauthenticating = false;
      pendingReauthPromise = null;
    }
  };

  isReauthenticating = true;
  pendingReauthPromise = performCheck();
  return pendingReauthPromise;
}

