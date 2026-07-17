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
  private _tokens: Record<string, { token: string; expiry: number; email?: string }> = {};

  constructor() {
    // Cache is loaded dynamically on-demand using userId
  }

  getLoggedInUserId(): string | null {
    try {
      const sessionStr = localStorage.getItem('worklog_session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        return session.id || null;
      }
    } catch {}
    return null;
  }

  private _loadCache(userId: string) {
    if (!userId) return;
    try {
      const token = localStorage.getItem(`gcal_access_token_${userId}`);
      const expiry = localStorage.getItem(`gcal_token_expiry_${userId}`);
      const email = localStorage.getItem(`gcal_connected_email_${userId}`);
      
      this._tokens[userId] = {
        token: token || '',
        expiry: expiry ? parseInt(expiry, 10) : 0,
        email: email || undefined
      };
    } catch {
      // Ignore localStorage errors
    }
  }

  private _saveCache(userId: string, token: string, expiry: number, email?: string) {
    if (!userId) return;
    this._tokens[userId] = { token, expiry, email };
    try {
      localStorage.setItem(`gcal_access_token_${userId}`, token);
      localStorage.setItem(`gcal_token_expiry_${userId}`, expiry.toString());
      if (email) {
        localStorage.setItem(`gcal_connected_email_${userId}`, email);
      }
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

    this._saveCache(userId, data.access_token, expiry, data.email);

    return {
      connected: true,
      email: data.email || undefined,
      calendarName: 'Primary'
    };
  }

  /**
   * Handles parsing and caching the OAuth access token from the URL hash fragment (Legacy)
   */
  async handleCallbackHash(hash: string, userId?: string): Promise<GCalConnection> {
    const resolvedUserId = userId || this.getLoggedInUserId();
    if (!resolvedUserId) {
      throw new Error('User not logged in');
    }
    const hashParams = new URLSearchParams(hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const expiresIn = hashParams.get('expires_in');

    if (!accessToken) {
      throw new Error('No access token found in redirect URL');
    }

    const duration = expiresIn ? parseInt(expiresIn, 10) : 3600;
    const expiry = Date.now() + duration * 1000 - 60000; // 1-minute buffer

    // Fetch user email using userinfo endpoint
    const email = await this._fetchUserEmail(accessToken);
    this._saveCache(resolvedUserId, accessToken, expiry, email || undefined);

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
  getAccessToken(userId?: string): string | null {
    const resolvedUserId = userId || this.getLoggedInUserId();
    if (!resolvedUserId) return null;

    const cached = this._tokens[resolvedUserId];
    if (cached && cached.token && Date.now() < cached.expiry) {
      return cached.token;
    }
    // Try to load fresh from storage in case another tab wrote it
    this._loadCache(resolvedUserId);
    const reCached = this._tokens[resolvedUserId];
    if (reCached && reCached.token && Date.now() < reCached.expiry) {
      return reCached.token;
    }
    return null;
  }

  /**
   * Retrieves active Google Access Token asynchronously or attempts to refresh it using the Edge Function.
   */
  async getAccessTokenAsync(userId: string): Promise<string | null> {
    if (!userId) return null;

    const cached = this._tokens[userId];
    if (cached && cached.token && Date.now() < cached.expiry) {
      return cached.token;
    }
    // Try to load fresh from storage in case another tab wrote it
    this._loadCache(userId);
    const reCached = this._tokens[userId];
    if (reCached && reCached.token && Date.now() < reCached.expiry) {
      return reCached.token;
    }

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

          this._saveCache(userId, data.access_token, expiry, data.email);

          return data.access_token;
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        console.warn('[GCal] Token refresh endpoint returned error:', errData.error);
        if (errData.error && errData.error.includes('No refresh token found')) {
          this.disconnect(userId);
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
  disconnect(userId?: string) {
    const resolvedUserId = userId || this.getLoggedInUserId();
    if (!resolvedUserId) return;

    const token = this._tokens[resolvedUserId]?.token || localStorage.getItem(`gcal_access_token_${resolvedUserId}`);
    delete this._tokens[resolvedUserId];

    try {
      localStorage.removeItem(`gcal_access_token_${resolvedUserId}`);
      localStorage.removeItem(`gcal_token_expiry_${resolvedUserId}`);
      localStorage.removeItem(`gcal_connected_email_${resolvedUserId}`);
    } catch {}

    if (token) {
      fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`).catch(() => {});
    }
  }

  /**
   * Tests connection by listing events
   */
  async testConnection(userId?: string): Promise<GCalConnection> {
    const resolvedUserId = userId || this.getLoggedInUserId();
    if (!resolvedUserId) return { connected: false };

    const token = this.getAccessToken(resolvedUserId);
    if (!token) {
      return { connected: false };
    }

    const now = new Date().toISOString();
    const response = await fetch(
      `${GCAL_API_BASE}/calendars/primary/events?maxResults=1&timeMin=${encodeURIComponent(now)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      this.disconnect(resolvedUserId);
      return { connected: false };
    }

    const data = await response.json();
    const email = this._tokens[resolvedUserId]?.email || localStorage.getItem(`gcal_connected_email_${resolvedUserId}`) || 'Google Account';
    return {
      connected: true,
      email,
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
    
    const typeLabel = isOT ? `OT / ${projectType}` : projectType;
    
    // Format Title: [Type] Action Name - Project Name / Module
    const detailsSuffix = entry.module ? ` (${entry.module})` : '';
    const summary = `[${typeLabel}] ${actionName}${detailsSuffix} - ${projectTitle}`;

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
    } else if (projectType.toLowerCase().includes('e-learning') || projectType.toLowerCase() === 'elearning') {
      event.colorId = '4'; // Flamingo Pink
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

  /**
   * Parses the structured description string of a synced Google Calendar event
   * back into a valid col_worklog object format.
   */
  parseEventDescriptionToWorklog(evt: any, userId: string): any | null {
    const desc = evt.description || '';
    if (!desc.includes('Synced from Worklog NewGen Web App') && !desc.includes('📋 Worklog Entry')) {
      return null;
    }

    try {
      // 1. Extract UUID ID
      const idMatch = desc.match(/🆔 ID:\s*([0-9a-fA-F-]{36})/);
      const logId = idMatch ? idMatch[1] : null;
      if (!logId) return null;

      // 2. Extract Project Name
      const projectMatch = desc.match(/🎯 Project:\s*([^\n]+)/);
      const projectName = projectMatch ? projectMatch[1].trim() : 'Work Log';

      // 3. Extract BU and Dept
      const buDeptMatch = desc.match(/🏢 BU:\s*([^|]+)\s*\|\s*Dept:\s*([^\n]+)/);
      const bu = buDeptMatch ? buDeptMatch[1].trim() : 'N/A';
      const department = buDeptMatch ? buDeptMatch[2].trim() : 'N/A';

      // 4. Extract Hours
      const hoursMatch = desc.match(/⏱ Hours:\s*([0-9.]+)/);
      const totalHours = hoursMatch ? parseFloat(hoursMatch[1]) : 8.0;

      // 5. Extract Action Name
      const actionMatch = desc.match(/⚡ Action:\s*([^\n]+)/);
      const actionName = actionMatch ? actionMatch[1].trim() : 'Others';

      // 6. Extract Category (OT)
      const isOT = desc.includes('Category: Overtime (OT)');

      // Extract Project Type from summary/title bracket prefix (e.g. "[Management] COACH - TeamOps" or "[OT / Management]")
      let parsedProjectType = 'Project';
      const summary = evt.summary || '';
      const typeMatch = summary.match(/^\[([^\]]+)\]/);
      if (typeMatch) {
        let typeStr = typeMatch[1].trim();
        if (typeStr.startsWith('OT / ')) {
          typeStr = typeStr.replace('OT / ', '').trim();
        }
        parsedProjectType = typeStr;
      }

      // 7. Extract Description (between 📝 and the next line/divider)
      let description = '';
      const descLines = desc.split('\n');
      const startIndex = descLines.findIndex((line: string) => line.startsWith('📝'));
      if (startIndex !== -1) {
        const remaining = descLines.slice(startIndex);
        // Find next divider or ID line
        const endIndex = remaining.findIndex((line: string, i: number) => i > 0 && (line.startsWith('━━') || line.startsWith('🆔') || line.startsWith('📌')));
        const descriptionLines = endIndex !== -1 ? remaining.slice(0, endIndex) : remaining;
        description = descriptionLines.join('\n').replace(/^📝\s*/, '').trim();
      }

      // 8. Extract Date and Times from the event object
      const startDateTime = evt.start?.dateTime || evt.start?.date;
      const endDateTime = evt.end?.dateTime || evt.end?.date;
      
      const work_date = startDateTime ? startDateTime.split('T')[0] : new Date().toISOString().split('T')[0];
      const start_time = startDateTime && startDateTime.includes('T') ? startDateTime.split('T')[1].slice(0, 8) : '08:00:00';
      let end_time = endDateTime && endDateTime.includes('T') ? endDateTime.split('T')[1].slice(0, 8) : '17:00:00';

      return {
        id: logId,
        user_id: userId,
        work_date,
        start_time,
        end_time,
        total_hours: totalHours,
        project_name: projectName,
        project_type: parsedProjectType,
        bu: bu === 'N/A' ? '' : bu,
        department: department === 'N/A' ? '' : department,
        action_name: actionName,
        description: description,
        channel: 'Web App',
        is_ot: isOT,
        gcal_event_id: evt.id
      };
    } catch (err) {
      console.warn('[GCal Recovery] Failed to parse event:', evt.id, err);
      return null;
    }
  }

  /**
   * Scan and recover missing worklogs from Google Calendar events for the month range
   */
  async recoverWorklogsFromGCal(userId: string, calendarId: string, monthStart: string, monthEnd: string): Promise<{ total: number; recovered: number; updated: number }> {
    // 1. Fetch all events from Google Calendar for the month
    const allEvents = await this.listEventsForRange(userId, calendarId, monthStart, monthEnd);
    
    // 2. Filter and parse events created by the app
    const parsedLogs: any[] = [];
    allEvents.forEach(evt => {
      const parsed = this.parseEventDescriptionToWorklog(evt, userId);
      if (parsed) {
        parsedLogs.push(parsed);
      }
    });

    if (parsedLogs.length === 0) {
      return { total: 0, recovered: 0, updated: 0 };
    }

    // 3. Query the database to find which IDs already exist in col_worklog
    const parsedIds = parsedLogs.map(l => l.id);
    const { data: existingLogs, error: checkErr } = await supabase
      .from('col_worklog')
      .select('id, project_type')
      .in('id', parsedIds);

    if (checkErr) {
      throw new Error(`Failed to check existing worklogs: ${checkErr.message}`);
    }

    const existingLogsMap = new Map<string, string>((existingLogs || []).map(l => [l.id, l.project_type || '']));
    
    // 4. Filter out the ones that already exist in DB
    const missingLogs = parsedLogs.filter(l => !existingLogsMap.has(l.id));
    const logsNeedingTypeUpdate = parsedLogs.filter(l => {
      if (!existingLogsMap.has(l.id)) return false;
      const currentType = existingLogsMap.get(l.id);
      return !currentType || (currentType === 'Project' && l.project_type !== 'Project');
    });

    let updatedCount = 0;
    if (logsNeedingTypeUpdate.length > 0) {
      for (const logToUpdate of logsNeedingTypeUpdate) {
        const { error: updateErr } = await supabase
          .from('col_worklog')
          .update({ project_type: logToUpdate.project_type })
          .eq('id', logToUpdate.id);
        if (!updateErr) {
          updatedCount++;
        }
      }
    }

    if (missingLogs.length === 0) {
      return { total: parsedLogs.length, recovered: 0, updated: updatedCount };
    }

    // 5. Build full records including required mapping fallbacks for holding, department_operator, etc.
    // Fetch user details first to assign default holding/role mappings
    const { data: dbUser } = await supabase
      .from('users')
      .select('emp_id, active_workspace_id, nickname, full_name')
      .eq('id', userId)
      .maybeSingle();

    const workspaceId = dbUser?.active_workspace_id || 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001';
    
    // Query mapping rules
    const { data: userMapping } = await supabase
      .from('tb_map_user_role')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    const defaultHolding = userMapping?.holding || 'Double A';
    const defaultRole = userMapping?.department_operator || 'IMP';

    // Fetch existing projects from registry to check/add in memory
    const { data: allProjects, error: projFetchErr } = await supabase
      .from('tb_project_registry')
      .select('id, project_name');
    
    if (projFetchErr) {
      throw new Error(`Failed to fetch project registry: ${projFetchErr.message}`);
    }

    const projectsMap = new Map<string, string>(); // name -> id
    allProjects.forEach(p => projectsMap.set(p.project_name.toLowerCase(), p.id));

    // Fetch existing project structure mappings
    const { data: allMappings, error: mapFetchErr } = await supabase
      .from('tb_map_project_structure')
      .select('id, project_name, module, project_type, holding, department_operator')
      .eq('workspace_id', workspaceId);

    if (mapFetchErr) {
      throw new Error(`Failed to fetch project structure mappings: ${mapFetchErr.message}`);
    }

    const getMappingKey = (projName: string, mod: string | null, type: string, hold: string, deptOp: string) => {
      return `${projName.toLowerCase()}|${(mod || '').toLowerCase()}|${type.toLowerCase()}|${hold.toLowerCase()}|${deptOp.toLowerCase()}`;
    };

    const mappingsSet = new Set<string>();
    allMappings.forEach(m => {
      mappingsSet.add(getMappingKey(m.project_name, m.module, m.project_type || '', m.holding || '', m.department_operator || ''));
    });

    // Ensure projects and mappings exist for all missingLogs
    for (const log of missingLogs) {
      const lowerProjName = log.project_name.toLowerCase();
      let projectId = projectsMap.get(lowerProjName);

      // 1. If project doesn't exist in registry, create it!
      if (!projectId) {
        console.log(`[Auto-provision] Creating missing project in registry: ${log.project_name}`);
        const { data: newProj, error: newProjErr } = await supabase
          .from('tb_project_registry')
          .insert({
            project_name: log.project_name,
            project_type: 'other',
            status: 'active',
            workspace_id: workspaceId
          })
          .select('id')
          .maybeSingle();

        if (newProjErr) {
          console.warn(`[Auto-provision] Failed to create project ${log.project_name}:`, newProjErr);
        } else if (newProj) {
          projectId = newProj.id;
          projectsMap.set(lowerProjName, newProj.id);
        }
      }

      // Assign projectId to the log payload
      log.project_id = projectId || null;

      // 2. If project mapping doesn't exist in tb_map_project_structure, create it!
      const mappingKey = getMappingKey(
        log.project_name,
        log.module || null,
        log.project_type || 'Project',
        defaultHolding,
        defaultRole
      );

      if (!mappingsSet.has(mappingKey)) {
        console.log(`[Auto-provision] Creating missing structure mapping: ${log.project_name} -> ${log.module || 'None'}`);
        const { error: newMapErr } = await supabase
          .from('tb_map_project_structure')
          .insert({
            workspace_id: workspaceId,
            project_id: projectId || null,
            project_name: log.project_name,
            project_type: log.project_type || 'Project',
            module: log.module || null,
            holding: defaultHolding,
            department_operator: defaultRole,
            bu: log.bu || '-',
            department: log.department || '-'
          });

        if (newMapErr) {
          console.warn(`[Auto-provision] Failed to create mapping:`, newMapErr);
        } else {
          mappingsSet.add(mappingKey);
        }
      }
    }

    const inserts = missingLogs.map(log => ({
      ...log,
      holding: defaultHolding,
      department_operator: defaultRole,
      project_type: log.project_type || (log.project_name === 'TeamOps' || log.project_name === 'Policy' ? 'Management' : 'Project'),
      workspace_id: workspaceId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    // 6. Insert missing records back into database in batches of 50
    const batchSize = 50;
    for (let i = 0; i < inserts.length; i += batchSize) {
      const batch = inserts.slice(i, i + batchSize);
      const { error: insertErr } = await supabase
        .from('col_worklog')
        .insert(batch);
      
      if (insertErr) {
        throw new Error(`Failed to restore batch starting at index ${i}: ${insertErr.message}`);
      }
    }

    return {
      total: parsedLogs.length,
      recovered: inserts.length,
      updated: updatedCount
    };
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
