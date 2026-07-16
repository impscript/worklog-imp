import { Routes, Route } from 'react-router-dom';
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

function App() {
  return (
    <ThemeProvider>
    <NotificationProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<DashboardPage />} />
        <Route path="/log" element={<LogWorkPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/hrbp" element={<HrbpPage />} />
        <Route path="/ai-chat" element={<AiChatPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/projects" element={<ProjectRegistryPage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/workspaces" element={<WorkspacesPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/migrate" element={<MigratePage />} />
        <Route path="/worklog/share/:id" element={<PublicWorklogPage />} />
      </Routes>
    </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;

