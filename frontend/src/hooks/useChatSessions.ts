import { useState, useMemo, useCallback } from 'react';
import { prepareSessionsForStorage } from '../lib/chat-files';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  modelUsed?: string;
  reasoningContent?: string;
  thinkingDurationSeconds?: number;
  attachmentMeta?: { name: string; kind: string; summary: string }[];
  isError?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
  messages: Message[];
  isPinned?: boolean;
}

export interface GroupedSessions {
  today: ChatSession[];
  yesterday: ChatSession[];
  last7Days: ChatSession[];
  older: ChatSession[];
}

const STORAGE_KEY = 'worklog_ai_chat_sessions';

function loadInitialSessions(): ChatSession[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      if (stored.length > 4_500_000) {
        console.warn('Chat history too large — clearing to recover memory');
        localStorage.removeItem(STORAGE_KEY);
        return [];
      }
      const parsed = JSON.parse(stored) as ChatSession[];
      return prepareSessionsForStorage(parsed);
    }
  } catch (e) {
    console.error('Failed to load chat sessions:', e);
    localStorage.removeItem(STORAGE_KEY);
  }
  return [];
}

export function useChatSessions(showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void) {
  const [sessions, setSessions] = useState<ChatSession[]>(loadInitialSessions);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    const initial = loadInitialSessions();
    return initial.length > 0 ? initial[0].id : null;
  });

  // Safe save sessions to localStorage with auto-pruning if quota is exceeded
  const safeSaveSessions = useCallback((sessionsToSave: ChatSession[]) => {
    const light = prepareSessionsForStorage(sessionsToSave);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(light));
    } catch (err: unknown) {
      const e = err as { name?: string; code?: number };
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        console.warn('LocalStorage quota exceeded — pruning old chat sessions...');
        const cloned = JSON.parse(JSON.stringify(light)) as ChatSession[];
        while (cloned.length > 1) {
          cloned.pop();
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cloned));
            setSessions(cloned);
            showToast?.('พื้นที่เบราว์เซอร์เต็ม: ลบประวัติเก่าบางส่วนแล้ว', 'info');
            return;
          } catch {
            /* continue pruning */
          }
        }
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cloned));
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
        showToast?.('พื้นที่เต็มมาก: ล้างประวัติแชทบางส่วนแล้ว', 'warning');
      } else {
        console.error('Failed to save sessions to localStorage:', err);
      }
    }
  }, [showToast]);

  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId);
  }, [sessions, activeSessionId]);

  const createSession = useCallback((titleSeed?: string): string => {
    const newSessionId = 'session_' + Date.now();
    const title = titleSeed ? titleSeed.slice(0, 32) : 'บทสนทนาใหม่';
    const newSession: ChatSession = {
      id: newSessionId,
      title,
      createdAt: new Date().toISOString(),
      messages: [],
    };

    setSessions((prev) => {
      const updated = [newSession, ...prev];
      safeSaveSessions(updated);
      return updated;
    });
    setActiveSessionId(newSessionId);
    return newSessionId;
  }, [safeSaveSessions]);

  const selectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== sessionId);
      safeSaveSessions(updated);
      return updated;
    });

    setActiveSessionId((current) => {
      if (current === sessionId) {
        const remaining = sessions.filter((s) => s.id !== sessionId);
        return remaining.length > 0 ? remaining[0].id : null;
      }
      return current;
    });
    showToast?.('ลบบทสนทนาสำเร็จ', 'success');
  }, [safeSaveSessions, sessions, showToast]);

  const renameSession = useCallback((sessionId: string, newTitle: string) => {
    const clean = newTitle.trim().slice(0, 45) || 'บทสนทนา';
    setSessions((prev) => {
      const updated = prev.map((s) => (s.id === sessionId ? { ...s, title: clean } : s));
      safeSaveSessions(updated);
      return updated;
    });
  }, [safeSaveSessions]);

  const togglePinSession = useCallback((sessionId: string) => {
    setSessions((prev) => {
      const updated = prev.map((s) => (s.id === sessionId ? { ...s, isPinned: !s.isPinned } : s));
      safeSaveSessions(updated);
      return updated;
    });
  }, [safeSaveSessions]);

  const clearAllSessions = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSessions([]);
    setActiveSessionId(null);
    showToast?.('ลบประวัติการแชททั้งหมดเรียบร้อยแล้ว', 'success');
  }, [showToast]);

  const updateSessionMessages = useCallback((sessionId: string, updater: (msgs: Message[]) => Message[]) => {
    setSessions((prev) => {
      const updated = prev.map((s) => {
        if (s.id === sessionId) {
          const nextMsgs = updater(s.messages);
          return {
            ...s,
            messages: nextMsgs,
            updatedAt: new Date().toISOString(),
          };
        }
        return s;
      });
      safeSaveSessions(updated);
      return updated;
    });
  }, [safeSaveSessions]);

  // Group sessions by relative date
  const groupedSessions = useMemo((): GroupedSessions => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const last7DaysStart = todayStart - 86400000 * 7;

    const groups: GroupedSessions = {
      today: [],
      yesterday: [],
      last7Days: [],
      older: [],
    };

    sessions.forEach((s) => {
      const time = new Date(s.createdAt).getTime();
      if (s.isPinned) {
        groups.today.push(s);
      } else if (time >= todayStart) {
        groups.today.push(s);
      } else if (time >= yesterdayStart) {
        groups.yesterday.push(s);
      } else if (time >= last7DaysStart) {
        groups.last7Days.push(s);
      } else {
        groups.older.push(s);
      }
    });

    return groups;
  }, [sessions]);

  return {
    sessions,
    setSessions,
    activeSessionId,
    setActiveSessionId,
    activeSession,
    createSession,
    selectSession,
    deleteSession,
    renameSession,
    togglePinSession,
    clearAllSessions,
    updateSessionMessages,
    groupedSessions,
    safeSaveSessions,
  };
}
