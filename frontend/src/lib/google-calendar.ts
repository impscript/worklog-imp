// Google Calendar Service for Worklog NewGen Web App
// Uses client-side OAuth 2.0 Implicit Flow + Google Calendar API v3 REST

import { supabase, supabaseUrl, supabaseKey } from './supabase';

const GCAL_API_BASE = 'https://www.googleapis.com/calendar/v3';
const GCAL_CLIENT_ID = '854811423030-gb2805ivlc8psvhg4lsgdike0q7t01it.apps.googleusercontent.com';
const GCAL_SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email';

export interface GCalConnection {
  connected: boolean;
  email?: string;
  calendarName?: string;
}

class GoogleCalendarService {
  private _cachedToken: string | null = null;
  private _tokenExpiry: number = 0;
  private _connectedEmail: string | null = null;

  constructor() {
    this._loadCache();
  }

  private _loadCache() {
    try {
      this._cachedToken = localStorage.getItem('gcal_access_token');
      const expiry = localStorage.getItem('gcal_token_expiry');
      this._tokenExpiry = expiry ? parseInt(expiry, 10) : 0;
      this._connectedEmail = localStorage.getItem('gcal_connected_email');
    } catch {
      // Ignore localStorage errors
    }
  }

  /**
   * Generates the Google OAuth 2.0 Auth URL
   */
  getAuthUrl(): string {
    const redirectUri = window.location.origin + '/profile';
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', GCAL_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code'); // Requesting Authorization Code
    authUrl.searchParams.set('scope', GCAL_SCOPES);
    authUrl.searchParams.set('access_type', 'offline'); // Requesting Refresh Token
    authUrl.searchParams.set('prompt', 'consent'); // Force consent screen to get refresh token
    return authUrl.toString();
  }

  /**
   * Handles exchanging code and caching the OAuth tokens
   */
  async handleCallbackCode(code: string, redirectUri: string, userId: string): Promise<GCalConnection> {
    const res = await fetch(`${supabaseUrl}/functions/v1/google-calendar-oauth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        action: 'exchange-code',
        code,
        redirectUri,
        userId,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to exchange code: ${errText}`);
    }

    const data = await res.json();
    const duration = data.expires_in || 3600;
    const expiry = Date.now() + duration * 1000 - 60000;

    this._cachedToken = data.access_token;
    this._tokenExpiry = expiry;
    this._connectedEmail = data.email || null;

    localStorage.setItem('gcal_access_token', data.access_token);
    localStorage.setItem('gcal_token_expiry', expiry.toString());
    if (data.email) {
      localStorage.setItem('gcal_connected_email', data.email);
    }

    return {
      connected: true,
      email: data.email || undefined,
      calendarName: 'Primary'
    };
  }

  /**
   * Handles parsing and caching the OAuth access token from the URL hash fragment (Legacy)
   */
  async handleCallbackHash(hash: string): Promise<GCalConnection> {
    const hashParams = new URLSearchParams(hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const expiresIn = hashParams.get('expires_in');

    if (!accessToken) {
      throw new Error('No access token found in redirect URL');
    }

    const duration = expiresIn ? parseInt(expiresIn, 10) : 3600;
    const expiry = Date.now() + duration * 1000 - 60000; // 1-minute buffer

    this._cachedToken = accessToken;
    this._tokenExpiry = expiry;

    localStorage.setItem('gcal_access_token', accessToken);
    localStorage.setItem('gcal_token_expiry', expiry.toString());

    // Fetch user email using userinfo endpoint
    const email = await this._fetchUserEmail(accessToken);
    if (email) {
      this._connectedEmail = email;
      localStorage.setItem('gcal_connected_email', email);
    }

    return {
      connected: true,
      email: email || undefined,
      calendarName: 'Primary'
    };
  }

  private async _fetchUserEmail(token: string): Promise<string | null> {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const info = await res.json();
        return info.email || null;
      }
    } catch (e) {
      console.warn('[GCal] Failed to fetch user email:', e);
    }
    return null;
  }

  /**
   * Retrieves active Google Access Token or null if expired/not connected
   */
  getAccessToken(): string | null {
    if (this._cachedToken && Date.now() < this._tokenExpiry) {
      return this._cachedToken;
    }
    // Try to load fresh from storage in case another tab wrote it
    this._loadCache();
    if (this._cachedToken && Date.now() < this._tokenExpiry) {
      return this._cachedToken;
    }
    return null;
  }

  /**
   * Retrieves active Google Access Token asynchronously or attempts to refresh it using the Edge Function.
   */
  async getAccessTokenAsync(userId: string): Promise<string | null> {
    if (this._cachedToken && Date.now() < this._tokenExpiry) {
      return this._cachedToken;
    }
    // Try to load fresh from storage in case another tab wrote it
    this._loadCache();
    if (this._cachedToken && Date.now() < this._tokenExpiry) {
      return this._cachedToken;
    }

    if (!userId) return null;

    // Call Supabase Edge Function to refresh token
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/google-calendar-oauth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          action: 'refresh-token',
          userId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          const duration = data.expires_in || 3600;
          const expiry = Date.now() + duration * 1000 - 60000; // 1-minute buffer

          this._cachedToken = data.access_token;
          this._tokenExpiry = expiry;

          localStorage.setItem('gcal_access_token', data.access_token);
          localStorage.setItem('gcal_token_expiry', expiry.toString());

          return data.access_token;
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        console.warn('[GCal] Token refresh endpoint returned error:', errData.error);
        if (errData.error && errData.error.includes('No refresh token found')) {
          this.disconnect();
        }
      }
    } catch (e) {
      console.warn('[GCal] Auto refresh token failed:', e);
    }

    return null;
  }

  /**
   * Revoke connection and clear credentials
   */
  disconnect() {
    const token = this._cachedToken;
    this._cachedToken = null;
    this._tokenExpiry = 0;
    this._connectedEmail = null;

    localStorage.removeItem('gcal_access_token');
    localStorage.removeItem('gcal_token_expiry');
    localStorage.removeItem('gcal_connected_email');

    if (token) {
      fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`).catch(() => {});
    }
  }

  /**
   * Tests connection by listing events
   */
  async testConnection(): Promise<GCalConnection> {
    const token = this.getAccessToken();
    if (!token) {
      return { connected: false };
    }

    const now = new Date().toISOString();
    const response = await fetch(
      `${GCAL_API_BASE}/calendars/primary/events?maxResults=1&timeMin=${encodeURIComponent(now)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      this.disconnect();
      return { connected: false };
    }

    const data = await response.json();
    return {
      connected: true,
      email: this._connectedEmail || localStorage.getItem('gcal_connected_email') || 'Google Account',
      calendarName: data.summary || 'Primary Calendar'
    };
  }

  // ==========================================
  // Calendar Event API Requests
  // ==========================================

  private async _request(userId: string, method: string, path: string, body: any = null): Promise<any> {
    const token = await this.getAccessTokenAsync(userId);
    if (!token) {
      throw new Error('Google Calendar not connected or session expired');
    }

    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${GCAL_API_BASE}${path}`, options);

    if (response.status === 401) {
      this.disconnect();
      throw new Error('Google Calendar authorization expired. Please reconnect.');
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Google Calendar API error: ${response.status}`);
    }

    if (response.status === 204) return null;
    return await response.json();
  }

  async createEvent(userId: string, calendarId: string, eventData: any): Promise<string> {
    const res = await this._request(userId, 'POST', `/calendars/${encodeURIComponent(calendarId)}/events`, eventData);
    return res.id;
  }

  async updateEvent(userId: string, calendarId: string, eventId: string, eventData: any): Promise<any> {
    return await this._request(userId, 'PATCH', `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, eventData);
  }

  async deleteEvent(userId: string, calendarId: string, eventId: string): Promise<void> {
    return await this._request(userId, 'DELETE', `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`);
  }

  async listEventsForDay(userId: string, calendarId: string, dateStr: string): Promise<any[]> {
    const timeMin = `${dateStr}T00:00:00+07:00`;
    const timeMax = `${dateStr}T23:59:59+07:00`;
    try {
      const path = `/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true`;
      const res = await this._request(userId, 'GET', path);
      return res.items || [];
    } catch (err) {
      console.warn('[GCal] listEventsForDay failed:', err);
      return [];
    }
  }

  async listEventsForRange(userId: string, calendarId: string, startDateStr: string, endDateStr: string): Promise<any[]> {
    const timeMin = `${startDateStr}T00:00:00+07:00`;
    const timeMax = `${endDateStr}T23:59:59+07:00`;
    try {
      const path = `/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&maxResults=250`;
      const res = await this._request(userId, 'GET', path);
      return res.items || [];
    } catch (err) {
      console.warn('[GCal] listEventsForRange failed:', err);
      return [];
    }
  }

  // ==========================================
  // Payload Builder
  // ==========================================

  /**
   * Normalizes end_time=24:00:00 → next day 00:00:00
   * Google Calendar API does NOT accept T24:00:00 — it must be T00:00:00 of the following day
   */
  private _normalizeEndDateTime(date: string, endTime: string): { date: string; time: string } {
    const t = endTime.slice(0, 8);
    if (t.startsWith('24:')) {
      const d = new Date(date + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      return { date: d.toISOString().split('T')[0], time: '00:00:00' };
    }
    return { date, time: t };
  }

  buildEventPayload(entry: any, projectTitle: string, actionName: string, projectDescription?: string) {
    const isOT = entry.is_ot === true || entry.is_ot === 'true';
    const projectType = entry.project_type || 'Task';
    
    // Format Title: (Type) Project Name - Action Name / Module (instead of using the long description)
    const titleText = entry.module 
      ? `${projectTitle} (${entry.module}) - ${actionName}`
      : `${projectTitle} - ${actionName}`;
      
    const typeLabel = isOT ? `OT / ${projectType}` : projectType;
    const summary = `(${typeLabel}) ${titleText}`;

    const hasProjectBackgroundInDesc = entry.description && (
      entry.description.toLowerCase().includes('project background') || 
      entry.description.toLowerCase().includes('projectbackground')
    );

    let origin = window.location.origin;
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      origin = import.meta.env.VITE_PRODUCTION_URL || 'https://worklog-imp.pages.dev';
    }
    const shareUrl = `${origin}/worklog/share/${entry.id}`;

    const lines = [
      `🔗 Public Reference Link: ${shareUrl}`,
      '📋 Worklog Entry',
      '━━━━━━━━━━━━━━━━━━━━━━━━',
      `🎯 Project: ${projectTitle}`,
      (projectDescription && !hasProjectBackgroundInDesc) ? `📖 Project Background: ${projectDescription}` : null,
      entry.module ? `📦 Module: ${entry.module}` : null,
      entry.bu || entry.department ? `🏢 BU: ${entry.bu || 'N/A'} | Dept: ${entry.department || 'N/A'}` : null,
      `⏱ Hours: ${Number(entry.total_hours).toFixed(1)}h (${entry.start_time.slice(0, 5)} - ${entry.end_time.slice(0, 5)})`,
      `⚡ Action: ${actionName}`,
      isOT ? '🔥 Category: Overtime (OT)' : null,
      entry.description ? `📝 ${entry.description}` : '📝 No description',
      '━━━━━━━━━━━━━━━━━━━━━━━━',
      `🆔 ID: ${entry.id}`,
      `📌 Synced from Worklog NewGen Web App`
    ].filter(Boolean);

    const description = lines.join('\n');
    const timeZone = 'Asia/Bangkok';

    // Fix: end_time="24:00:00" is rejected by Google API → convert to next-day midnight
    const endNormalized = this._normalizeEndDateTime(entry.work_date, entry.end_time);

    const event: any = {
      summary,
      description,
      start: {
        dateTime: `${entry.work_date}T${entry.start_time.slice(0, 8)}`,
        timeZone
      },
      end: {
        dateTime: `${endNormalized.date}T${endNormalized.time}`,
        timeZone
      }
    };

    // Assign colorId based on event category
    // Google Calendar API Color IDs:
    // '9' = Blueberry/Blue (Project)
    // '2' = Sage/Green (Support)
    // '6' = Tangerine/Orange (OT)
    // '5' = Banana/Yellow (Fallback for other types)
    if (isOT) {
      event.colorId = '6'; // Orange
    } else if (projectType.toLowerCase() === 'project' || projectType.toLowerCase() === 'upgrade') {
      event.colorId = '9'; // Blue
    } else if (projectType.toLowerCase().includes('support')) {
      event.colorId = '2'; // Green
    } else {
      event.colorId = '5'; // Fallback Yellow
    }

    return event;
  }

  async isSyncEnabled(userId: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('users')
        .select('gcal_sync_enabled')
        .eq('id', userId)
        .maybeSingle();
      return !!data?.gcal_sync_enabled;
    } catch {
      return false;
    }
  }

  async checkSessionReady(userId: string): Promise<{ ready: boolean; syncEnabled: boolean }> {
    const syncEnabled = await this.isSyncEnabled(userId);
    if (!syncEnabled) {
      return { ready: true, syncEnabled: false };
    }
    const token = await this.getAccessTokenAsync(userId);
    return { ready: !!token, syncEnabled: true };
  }
}

export const googleCalendar = new GoogleCalendarService();

// ==========================================
// Database Transaction Sync Trigger
// ==========================================

export async function syncWorklogToGCal(logId: string, action: 'insert' | 'update'): Promise<void> {
  try {
    // 1. Fetch worklog details
    const { data: log, error: logErr } = await supabase
      .from('col_worklog')
      .select('*')
      .eq('id', logId)
      .maybeSingle();

    if (logErr || !log) {
      console.warn('[GCal Sync] Worklog not found:', logErr);
      return;
    }

    // 2. Fetch user settings
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('gcal_sync_enabled, gcal_calendar_id')
      .eq('id', log.user_id)
      .maybeSingle();

    if (userErr || !user || !user.gcal_sync_enabled) {
      // Sync is not enabled
      return;
    }

    // 3. Verify client-side token exists and is valid
    const token = await googleCalendar.getAccessTokenAsync(log.user_id);
    if (!token) {
      // Re-throw so callers can show a toast to reconnect Google Calendar
      throw new Error('Google Calendar session expired. Please reconnect in Profile settings.');
    }

    const calendarId = user.gcal_calendar_id || 'primary';

    // 4. Fetch project description
    let projectDescription = '';
    if (log.project_name) {
      try {
        const { data: projData } = await supabase
          .from('tb_map_project_structure')
          .select('project_description')
          .eq('project_name', log.project_name)
          .eq('holding', log.holding)
          .eq('department_operator', log.department_operator)
          .limit(1)
          .maybeSingle();
        if (projData?.project_description) {
          projectDescription = projData.project_description;
        }
      } catch (err) {
        console.warn('[GCal Sync] Failed to fetch project description context:', err);
      }
    }

    // 5. Build event payload
    const payload = googleCalendar.buildEventPayload(
      log,
      log.project_name || 'Work Log',
      log.action_name || 'Work Log Entry',
      projectDescription
    );

    let eventId = log.gcal_event_id;
    let finalAction = action;

    // Check if event already exists on Google Calendar by matching summary or content details
    // to prevent duplicate creation on calendar
    if (!eventId || finalAction === 'insert') {
      console.log('[GCal Sync] Checking existing calendar events for date:', log.work_date);
      const existingEvents = await googleCalendar.listEventsForDay(log.user_id, calendarId, log.work_date);
      
      const match = existingEvents.find((evt: any) => {
        // High confidence match: event contains the worklog ID in the description
        const idMatch = evt.description && evt.description.includes(`🆔 ID: ${log.id}`);
        
        // Fallback match for legacy events that don't have the ID in description yet
        const hasAnyId = evt.description && evt.description.includes('🆔 ID:');
        const titleMatch = evt.summary === payload.summary;
        const descMatch = evt.description && 
          evt.description.includes(`🎯 Project: ${log.project_name}`) && 
          evt.description.includes(`⚡ Action: ${log.action_name}`);
        
        const fallbackMatch = !hasAnyId && (titleMatch || descMatch);
        
        return idMatch || fallbackMatch;
      });

      if (match) {
        console.log('[GCal Sync] Found matching event on Google Calendar, linking event ID:', match.id);
        eventId = match.id;
        finalAction = 'update';
        
        // Link and store the event ID in our database
        await supabase
          .from('col_worklog')
          .update({ gcal_event_id: match.id })
          .eq('id', logId);
      }
    }

    if (finalAction === 'insert' || !eventId) {
      // Create new event
      console.log('[GCal Sync] Creating event in Google Calendar...');
      const newEventId = await googleCalendar.createEvent(log.user_id, calendarId, payload);
      
      // Save event ID back to DB
      await supabase
        .from('col_worklog')
        .update({ gcal_event_id: newEventId })
        .eq('id', logId);
      
      console.log('[GCal Sync] Event created successfully:', newEventId);
    } else {
      // Update existing event
      console.log('[GCal Sync] Updating event in Google Calendar:', eventId);
      try {
        await googleCalendar.updateEvent(log.user_id, calendarId, eventId, payload);
        console.log('[GCal Sync] Event updated successfully.');
      } catch (err: any) {
        if (err.message && (err.message.includes('Not Found') || err.message.includes('404'))) {
          // Event was deleted, recreate it
          console.warn('[GCal Sync] Event not found on Google Calendar, recreating...');
          const newEventId = await googleCalendar.createEvent(log.user_id, calendarId, payload);
          await supabase
            .from('col_worklog')
            .update({ gcal_event_id: newEventId })
            .eq('id', logId);
        } else {
          throw err;
        }
      }
    }
  } catch (err) {
    console.error('[GCal Sync] Error syncing worklog:', err);
  }
}
