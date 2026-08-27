import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { ensureValidSupabaseSession } from './lib/supabase';
import ErrorBoundary from './components/common/ErrorBoundary';
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
import ProjectGanttPage from './pages/ProjectGanttPage';
import PublicWorklogPage from './pages/PublicWorklogPage';
import LeaderboardPage from './pages/LeaderboardPage';
import TeamPage from './pages/TeamPage';
import WorkspacesPage from './pages/WorkspacesPage';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';


function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [state, setState] = useState<'loading' | 'authenticated' | 'anonymous'>(() => {
    // Instant synchronous check from localStorage so existing sessions don't flash a blank screen
    const cached = typeof localStorage !== 'undefined' ? localStorage.getItem('worklog_session') : null;
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && (parsed.id || parsed.empId)) {
          return 'authenticated';
        }
      } catch {
        // invalid JSON
      }
    }
    return 'loading';
  });

  useEffect(() => {
    let active = true;
    const checkSession = async () => {
      // Check and restore valid Supabase Auth JWT token
      const isValid = await ensureValidSupabaseSession();

      if (!active) return;

      if (isValid) {
        setState('authenticated');
      } else {
        const cached = localStorage.getItem('worklog_session');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed && (parsed.id || parsed.empId)) {
              setState('authenticated');
              return;
            }
          } catch {
            // invalid JSON
          }
        }
        setState('anonymous');
      }
    };

    checkSession();
    return () => { active = false; };
  }, []);

  // Public share links (?share=token) must open without a login session,
  // so the router does not redirect anonymous viewers to /login.
  const isPublicShare = new URLSearchParams(window.location.search).has('share');

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-500 font-mono tracking-wider">กำลังตรวจสอบข้อมูลการเข้าใช้งาน...</span>
      </div>
    );
  }

  if (state === 'anonymous' && !isPublicShare) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary>
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
            <Route path="/projects/gantt" element={<ProtectedRoute><ProjectGanttPage /></ProtectedRoute>} />
            <Route path="/projects/roadmap" element={<ProtectedRoute><ProjectGanttPage /></ProtectedRoute>} />
            <Route path="/team" element={<ProtectedRoute><TeamPage /></ProtectedRoute>} />
            <Route path="/workspaces" element={<ProtectedRoute><WorkspacesPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/migrate" element={<ProtectedRoute><MigratePage /></ProtectedRoute>} />
          </Routes>
        </NotificationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;


