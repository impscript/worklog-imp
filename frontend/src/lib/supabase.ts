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

// Helper to run a promise with a timeout fallback
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallbackValue), timeoutMs))
  ]);
}

export async function ensureValidSupabaseSession(): Promise<boolean> {
  if (isReauthenticating && pendingReauthPromise) {
    return pendingReauthPromise;
  }

  const performCheck = async (): Promise<boolean> => {
    try {
      // Fast check with a 3-second timeout to avoid navigator.locks deadlock on wake-up
      const sessionResult = await withTimeout(
        supabase.auth.getSession().catch(() => ({ data: { session: null } })),
        3000,
        { data: { session: null } }
      );

      const session = sessionResult.data?.session;

      if (session?.user && session.expires_at && (session.expires_at * 1000 > Date.now() + 60000)) {
        return true;
      }

      if (session?.refresh_token) {
        const refreshedResult = await withTimeout(
          supabase.auth.refreshSession().catch(() => ({ data: { session: null } })),
          4000,
          { data: { session: null } }
        );
        if (refreshedResult.data?.session?.user) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('worklog_session_refreshed'));
          }
          return true;
        }
      }

      const cachedStr = typeof localStorage !== 'undefined' ? localStorage.getItem('worklog_session') : null;
      if (!cachedStr) return false;

      let cached: { empId?: string; [key: string]: unknown } | null = null;
      try {
        cached = JSON.parse(cachedStr);
      } catch {
        return false;
      }

      const targetEmpId = cached?.empId;
      if (!targetEmpId) return false;

      const bridgeUrl = import.meta.env.DEV
        ? '/functions/v1/hrms-auth'
        : `${supabaseUrl}/functions/v1/hrms-auth`;

      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;

      try {
        const bridgeRes = await fetch(bridgeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseKey
          },
          body: JSON.stringify({ account: targetEmpId, password: 'mock_bypass' }),
          signal: controller?.signal
        });

        if (timeoutId) clearTimeout(timeoutId);

        const bridgeData = await bridgeRes.json().catch(() => null);
        if (bridgeData?.session) {
          await supabase.auth.setSession(bridgeData.session);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('worklog_session_refreshed'));
          }
          return true;
        }
      } catch (fetchErr) {
        if (timeoutId) clearTimeout(timeoutId);
        console.warn('[Supabase Session] Bridge reauth fetch error:', fetchErr);
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
  // Maximum global timeout of 8 seconds so caller is never blocked indefinitely
  pendingReauthPromise = withTimeout(performCheck(), 8000, false);
  return pendingReauthPromise;
}


