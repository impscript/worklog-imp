import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import DashboardPage from './pages/DashboardPage';
import LogWorkPage from './pages/LogWorkPage';
import LoginPage from './pages/LoginPage';
import CalendarPage from './pages/CalendarPage';
import ReportsPage from './pages/ReportsPage';
import HrbpPage from './pages/HrbpPage';
import AiChatPage from './pages/AiChatPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import MigratePage from './pages/MigratePage';
import ProjectRegistryPage from './pages/ProjectRegistryPage';
import PublicWorklogPage from './pages/PublicWorklogPage';
import LeaderboardPage from './pages/LeaderboardPage';
import TeamPage from './pages/TeamPage';
import WorkspacesPage from './pages/WorkspacesPage';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [state, setState] = useState<'loading' | 'authenticated' | 'anonymous'>('loading');

  useEffect(() => {
    let active = true;
    const checkSession = async () => {
      // 1. Check local cached user session first (instant PWA startup)
      const cached = localStorage.getItem('worklog_session');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.id) {
            if (active) setState('authenticated');
            return;
          }
        } catch {
          // invalid JSON, fall through
        }
      }

      // 2. Check Supabase Auth session as secondary check
      try {
        const { data } = await supabase.auth.getSession();
        if (active) setState(data?.session ? 'authenticated' : 'anonymous');
      } catch (err) {
        console.warn('ProtectedRoute auth check error:', err);
        if (active) setState(cached ? 'authenticated' : 'anonymous');
      }
    };

    checkSession();
    return () => { active = false; };
  }, []);

  // Public share links (?share=token) must open without a login session,
  // so the router does not redirect anonymous viewers to /login.
  const isPublicShare = new URLSearchParams(window.location.search).has('share');

  if (state === 'loading') return <div className="min-h-screen bg-slate-950" />;
  if (state === 'anonymous' && !isPublicShare) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/worklog/share/:id" element={<PublicWorklogPage />} />
          <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/log" element={<ProtectedRoute><LogWorkPage /></ProtectedRoute>} />
          <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
          <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
          <Route path="/hrbp" element={<ProtectedRoute><HrbpPage /></ProtectedRoute>} />
          <Route path="/ai-chat" element={<ProtectedRoute><AiChatPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
          <Route path="/projects" element={<ProtectedRoute><ProjectRegistryPage /></ProtectedRoute>} />
          <Route path="/team" element={<ProtectedRoute><TeamPage /></ProtectedRoute>} />
          <Route path="/workspaces" element={<ProtectedRoute><WorkspacesPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/migrate" element={<ProtectedRoute><MigratePage /></ProtectedRoute>} />
        </Routes>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;

