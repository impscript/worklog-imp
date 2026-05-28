import { Routes, Route } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import LogWorkPage from './pages/LogWorkPage';
import LoginPage from './pages/LoginPage';
import CalendarPage from './pages/CalendarPage';
import ReportsPage from './pages/ReportsPage';
import HrbpPage from './pages/HrbpPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import MigratePage from './pages/MigratePage';
import PublicWorklogPage from './pages/PublicWorklogPage';
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
        <Route path="/hrbp" element={<HrbpPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/migrate" element={<MigratePage />} />
        <Route path="/worklog/share/:id" element={<PublicWorklogPage />} />
      </Routes>
    </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;

