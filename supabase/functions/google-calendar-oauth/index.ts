import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLIENT_ID = '854811423030-gb2805ivlc8psvhg4lsgdike0q7t01it.apps.googleusercontent.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, userId } = body;

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';

    if (!clientSecret) {
      throw new Error('GOOGLE_CLIENT_SECRET environment variable is not configured.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    if (action === 'exchange-code') {
      const { code, redirectUri } = body;
      if (!code || !redirectUri || !userId) {
        throw new Error('Missing code, redirectUri, or userId');
      }

      // Exchange code for tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: CLIENT_ID,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        throw new Error(`Google token exchange failed: ${errText}`);
      }

      const tokens = await tokenRes.json();
      const { access_token, refresh_token, expires_in } = tokens;

      // Fetch user email using access_token
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const userInfo = userRes.ok ? await userRes.json() : {};
      const gcalEmail = userInfo.email || '';

      // Save refresh_token and sync status to database
      const updatePayload: any = {
        gcal_sync_enabled: true,
        gcal_email: gcalEmail,
      };
      if (refresh_token) {
        updatePayload.gcal_refresh_token = refresh_token;
      }

      const { error: dbError } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', userId);

      if (dbError) throw dbError;

      return new Response(JSON.stringify({
        access_token,
        expires_in,
        email: gcalEmail,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'refresh-token') {
      if (!userId) throw new Error('Missing userId');

      // Fetch refresh token from DB
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('gcal_refresh_token')
        .eq('id', userId)
        .single();

      if (userError || !user?.gcal_refresh_token) {
        throw new Error('No refresh token found for this user. Please reconnect.');
      }

      // Exchange refresh token for new access token
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: clientSecret,
          refresh_token: user.gcal_refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        throw new Error(`Google token refresh failed: ${errText}`);
      }

      const tokens = await tokenRes.json();
      const { access_token, expires_in } = tokens;

      return new Response(JSON.stringify({
        access_token,
        expires_in,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    throw new Error(`Unsupported action: ${action}`);
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
