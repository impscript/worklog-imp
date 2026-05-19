import { useState, useEffect, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, FileText, User, PlusCircle, Menu, X, LogOut, Database, Cpu, Sparkles, UploadCloud, ChevronLeft, ChevronRight, Sun, Moon } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function AppLayout({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    return saved === 'true';
  });
  const [user, setUser] = useState<{ name: string; role: string; empId?: string } | null>(null);
  const navigate = useNavigate();

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved || 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    const session = sessionStorage.getItem('worklog_session');
    if (session) {
      setUser(JSON.parse(session));
    }
  }, []);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  
  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  const handleLogout = () => {
    sessionStorage.removeItem('worklog_session');
    navigate('/login');
  };

  const getFormattedDate = () => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return new Date().toLocaleDateString('en-US', options);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#030712] ai-cyber-grid text-slate-200 font-sans relative">
      
      {/* Dynamic Background Glowing Blobs */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" />
      <div className="absolute bottom-12 right-1/4 w-[350px] h-[350px] bg-violet-600/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 ai-glass border-r border-slate-800/80 flex flex-col transform transition-all duration-300 ease-in-out md:relative md:translate-x-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          isCollapsed ? "md:w-20" : "md:w-64"
        )}
      >
        <div className={cn(
          "h-16 flex items-center justify-between border-b border-slate-800/60 bg-slate-950/20 transition-all duration-300",
          isCollapsed ? "px-4 justify-center" : "px-6"
        )}>
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-500 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/25 border border-indigo-400/20 shrink-0">
              <Sparkles size={15} className="text-white animate-pulse" />
            </div>
            {!isCollapsed && (
              <span className="text-base font-extrabold tracking-wider bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent ml-3 whitespace-nowrap animate-fade-in">
                IMP WORKLOG
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Desktop Collapse Button */}
            <button 
              onClick={toggleCollapse} 
              className="hidden md:flex items-center justify-center p-1.5 rounded-lg border border-slate-800/80 hover:border-indigo-500/50 bg-slate-900/50 hover:bg-indigo-500/10 text-slate-400 hover:text-indigo-400 transition-all duration-200"
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>

            {/* Close button for mobile */}
            <button onClick={toggleSidebar} className="md:hidden text-slate-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
        </div>
        
        {/* Connection status box */}
        {!isCollapsed ? (
          <div className="mt-4 mx-4 px-4 py-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80 flex items-center justify-between text-[11px] backdrop-blur-md animate-fade-in">
            <div className="flex items-center gap-2 text-slate-400 font-mono">
              <Cpu size={12} className="text-indigo-400 animate-pulse" />
              <span className="font-semibold tracking-wider">AI COPILOT</span>
            </div>
            <div className="flex items-center gap-1.5 font-bold text-emerald-400 tracking-wider">
              <span className="ai-pulse-dot" />
              <span>ONLINE</span>
            </div>
          </div>
        ) : (
          <div 
            className="mt-4 mx-auto w-10 h-10 rounded-xl bg-slate-950/50 border border-slate-800/80 flex items-center justify-center backdrop-blur-md relative group cursor-pointer"
            title="AI Copilot: Online"
          >
            <Cpu size={16} className="text-indigo-400 animate-pulse" />
            <span className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-emerald-400 border border-[#030712]" />
          </div>
        )}

        <nav className="flex-1 px-4 py-2 space-y-1.5 overflow-y-auto">
          <NavItem to="/" icon={<LayoutDashboard size={18} />} label="Dashboard" isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
          <NavItem to="/log" icon={<PlusCircle size={18} />} label="Log Work" isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
          <NavItem to="/calendar" icon={<Calendar size={18} />} label="Calendar" isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
          <NavItem to="/reports" icon={<FileText size={18} />} label="Reports" isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
          <NavItem to="/migrate" icon={<UploadCloud size={18} />} label="Data Migration" isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
          <NavItem to="/admin" icon={<Database size={18} />} label="Master Data" isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
          <NavItem to="/profile" icon={<User size={18} />} label="Profile" isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
        </nav>

        {/* Logout button at bottom of sidebar */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/20">
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center rounded-xl text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all text-sm font-semibold tracking-wide w-full",
              isCollapsed ? "md:justify-center space-x-3 md:space-x-0 py-3" : "space-x-3 px-4 py-3"
            )}
            title={isCollapsed ? "Sign Out" : undefined}
          >
            <LogOut size={18} className="shrink-0" />
            {!isCollapsed ? (
              <span className="whitespace-nowrap animate-fade-in">Sign Out</span>
            ) : (
              <span className="whitespace-nowrap animate-fade-in md:hidden">Sign Out</span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gradient-to-b from-[#030712] via-[#050b18] to-[#030712] relative z-10">
        
        {/* Header */}
        <header className="h-16 flex-shrink-0 flex items-center justify-between md:justify-end px-4 md:px-8 border-b border-slate-800/50 bg-slate-950/25 backdrop-blur-md relative z-20">
          {/* Mobile menu button */}
          <button 
            onClick={toggleSidebar}
            className="md:hidden p-2 -ml-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/60"
          >
            <Menu size={24} />
          </button>

          <div className="flex items-center space-x-4">
            <span className="hidden sm:inline-block text-xs font-semibold text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800/60 font-mono tracking-wide">{getFormattedDate()}</span>
            
            {/* Theme Toggle Button */}
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-slate-800 bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-white transition-all duration-200 active:scale-95"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>

            <div className="flex items-center space-x-3 pl-4 border-l border-slate-800">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden ring-2 ring-indigo-500/20 shadow-lg shadow-indigo-500/5">
                <img 
                  src={`https://wms.advanceagro.net/WSVIS/api/Face/GetImage?CardID=${user?.empId}`}
                  alt="Avatar" 
                  className="w-full h-full object-cover" 
                  onError={(e) => {
                    e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'Guest')}&background=818cf8&color=fff`;
                  }}
                />
              </div>
              <span className="text-sm font-semibold text-slate-200 hidden sm:inline-block">{user?.name || 'Loading...'}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

interface NavItemProps {
  to: string;
  icon: ReactNode;
  label: string;
  isCollapsed?: boolean;
  onClick?: () => void;
}

function NavItem({ to, icon, label, isCollapsed, onClick }: NavItemProps) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "flex items-center rounded-xl transition-all duration-300 group text-sm font-semibold relative overflow-hidden",
          isCollapsed ? "md:justify-center space-x-3 md:space-x-0 py-3" : "space-x-3 px-4 py-3",
          isActive 
            ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/25 after:absolute after:left-0 after:top-1/4 after:h-1/2 after:w-1 after:bg-indigo-500 after:rounded-r-full" 
            : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 border border-transparent"
        )
      }
      title={isCollapsed ? label : undefined}
    >
      <span className={cn(
        "transition-all duration-300 group-hover:scale-110 shrink-0",
        "text-slate-400 group-hover:text-indigo-400"
      )}>
        {icon}
      </span>
      {!isCollapsed ? (
        <span className="tracking-wide whitespace-nowrap animate-fade-in">{label}</span>
      ) : (
        <span className="tracking-wide whitespace-nowrap animate-fade-in md:hidden">{label}</span>
      )}
    </NavLink>
  );
}
