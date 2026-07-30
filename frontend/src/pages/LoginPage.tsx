import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, KeyRound, User as UserIcon, Sparkles, ChevronDown, ChevronUp, UserCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { MOCK_USERS } from '../lib/mockUsers';
import type { MockHRMSUser } from '../lib/mockUsers';
import { useTranslation } from 'react-i18next';
import LanguageToggle from '../components/LanguageToggle';

export default function LoginPage() {
  const { t } = useTranslation();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSimPanel, setShowSimPanel] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>('Improvement');
  const [customEmpId, setCustomEmpId] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const username = account.trim();
      if (!username) {
        throw new Error(t('login.enterUsername'));
      }

      const inviteCode = new URLSearchParams(window.location.search).get('invite') || undefined;
      // Call our centralized useAuth hook login (which auto-handles Dev vs Prod proxy & JIT provisioning)
      await login(username, password, inviteCode);

      // Success
      navigate('/');

    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleMockLogin = async (user: MockHRMSUser) => {
    setIsLoading(true);
    setError('');
    try {
      const inviteCode = new URLSearchParams(window.location.search).get('invite') || undefined;
      await login(user.emp_id, 'mock_bypass', inviteCode);
      navigate('/');
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomMockLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedId = customEmpId.trim();
    if (!trimmedId) return;

    setIsLoading(true);
    setError('');
    try {
      const inviteCode = new URLSearchParams(window.location.search).get('invite') || undefined;
      const matchedUser = MOCK_USERS.find(
        (u) => u.emp_id === trimmedId || u.nickname.toLowerCase() === trimmedId.toLowerCase()
      );
      if (matchedUser) {
        await login(matchedUser.emp_id, 'mock_bypass', inviteCode);
      } else {
        await login(trimmedId, 'mock_bypass', inviteCode);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setIsLoading(false);
    }
  };

  // Group users logically for testing UI
  const groups: Record<string, MockHRMSUser[]> = {
    'Improvement': MOCK_USERS.filter(u => u.line_of_work === 'Improvement'),
    'RE Marketing': MOCK_USERS.filter(u => u.line_of_work === 'Sales & Marketing' || u.line_of_work === 'Project BU 2+3'),
    'RE Construction': MOCK_USERS.filter(u => u.line_of_work === 'Project BU 2' || u.line_of_work === 'Project BU 3' || u.line_of_work === 'Project BU 4'),
    'RE Commercial': MOCK_USERS.filter(u => u.bu_working === 'Real Estate_COM&RES' && u.line_of_work === 'Operation'),
    'Industrial': MOCK_USERS.filter(u => u.line_of_work === 'Industrial - Operation'),
    'Marine': MOCK_USERS.filter(u => u.bu_working === 'Marine'),
    'HR / HRBP': MOCK_USERS.filter(u => u.line_of_work === 'HR'),
    'Accounting': MOCK_USERS.filter(u => u.line_of_work === 'Account RE' || u.line_of_work === 'Cockpit room Center')
  };

  return (
    <div className="min-h-screen bg-white dark:bg-theme-bg-page ai-cyber-grid flex flex-col items-center justify-center p-4 relative overflow-y-auto">

      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[450px] h-[450px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-violet-600/5 blur-[100px] pointer-events-none"></div>

      <div className="absolute top-4 right-4 z-20">
        <LanguageToggle />
      </div>

      <div className="w-full max-w-lg flex flex-col gap-6 relative z-10 py-8">

        {/* Main Login Card */}
        <div className="w-full ai-glass rounded-3xl p-8 shadow-2xl border border-theme-border/80">

          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-500 to-indigo-500 flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/25 border border-indigo-400/20">
              <Sparkles className="w-8 h-8 text-theme-text dark:text-theme-text-invert animate-pulse" />
            </div>
            <h1 className="text-2xl font-extrabold text-theme-text dark:text-theme-text-invert tracking-wider theme-heading-gradient">
              IMP WORKLOG
            </h1>
            <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mt-2 flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-200 dark:border-indigo-500/10 px-3 py-1 rounded-full">
              <span className="ai-pulse-dot" />
              <span>AI COPILOT SECURE ACCESS</span>
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-500/10 dark:bg-red-500/5 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold text-center tracking-wide rounded-xl">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 ml-1">{t('login.username')}</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <UserIcon size={18} className="text-slate-500 dark:text-slate-400" />
                </div>
                <input
                  type="text"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  placeholder={t('login.usernamePlaceholder')}
                  autoCapitalize="none"
                  autoCorrect="off"
                  inputMode="text"
                  className="w-full bg-slate-50 dark:bg-theme-bg-page/60 border border-slate-300 dark:border-theme-border rounded-xl py-3.5 pl-11 pr-4 text-slate-900 dark:text-white text-base sm:text-sm min-h-[48px] placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all font-semibold shadow-xs"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 ml-1">{t('login.password')}</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <KeyRound size={18} className="text-slate-500 dark:text-slate-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 dark:bg-theme-bg-page/60 border border-slate-300 dark:border-theme-border rounded-xl py-3.5 pl-11 pr-4 text-slate-900 dark:text-white text-base sm:text-sm min-h-[48px] placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all font-semibold shadow-xs"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-[48px] bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold uppercase tracking-wider text-xs rounded-xl py-3.5 shadow-lg shadow-indigo-500/25 transition-all active:scale-[0.98] mt-6 flex items-center justify-center gap-2 border border-indigo-400/20"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <LogIn size={18} />
                  <span>{t('login.submit')}</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Mobile PWA Installation Guide Card */}
        <div className="w-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/90 dark:border-indigo-500/20 rounded-2xl p-4 text-xs space-y-2 text-indigo-950 dark:text-indigo-300 shadow-sm">
          <div className="font-bold flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>แนะนำ: เพิ่มเข้าหน้าจอโฮมมือถือ (Add to Home Screen)</span>
          </div>
          <p className="text-[11px] leading-relaxed text-indigo-950 dark:text-indigo-200">
            เปิดบน Safari (iOS) ให้กดไอคอน <strong className="text-indigo-950 dark:text-white font-black">Share</strong> ➔ เลือก <strong className="text-indigo-950 dark:text-white font-black">"Add to Home Screen"</strong><br />
            เปิดบน Chrome (Android) ให้กด <strong className="text-indigo-950 dark:text-white font-black">⋮</strong> ➔ เลือก <strong className="text-indigo-950 dark:text-white font-black">"Install App"</strong> เพื่อให้จำ Login ยาวนานและโหลดแอปได้เร็วขึ้น!
          </p>
        </div>

        {/* Development Workspace Mock Profiles Simulator */}
        <div className="w-full ai-glass rounded-3xl border border-indigo-200/80 dark:border-indigo-500/20 overflow-hidden shadow-xl transition-all duration-300">
          <button
            onClick={() => {
              if (!showSimPanel) {
                // When opening, we prompt for passcode if not already verified
                const code = prompt(t('login.simPasscodePrompt', { defaultValue: 'กรุณากรอกรหัสผ่านเพื่อเข้าใช้งานจำลองสิทธิ์:' }));
                if (code === '337999') {
                  setShowSimPanel(true);
                } else {
                  setError(t('login.simPasscodeWrong', { defaultValue: 'รหัสผ่านไม่ถูกต้อง ❌' }));
                }
              } else {
                setShowSimPanel(false);
              }
            }}
            className="w-full px-6 py-4 flex items-center justify-between bg-indigo-50/50 dark:bg-indigo-500/5 hover:bg-indigo-100/60 dark:hover:bg-indigo-500/10 transition-colors text-left border-b border-theme-border/40"
          >
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm tracking-wider">
              <UserCheck size={16} />
              <span>DEV TOOLS</span>
            </div>
            {showSimPanel ? <ChevronUp size={16} className="text-indigo-600 dark:text-indigo-400" /> : <ChevronDown size={16} className="text-indigo-600 dark:text-indigo-400" />}
          </button>

          {showSimPanel && (
            <div className="p-6 bg-theme-surface-secondary/40 border-t border-theme-border/60 space-y-4">
              <p className="text-xs text-theme-text-secondary leading-relaxed">
                {t('login.simDescription', { defaultValue: 'Select a mock user profile or enter a custom employee ID to test JIT user provisioning and automatic workspace assignment.' })}
              </p>

              {/* Custom Employee ID Simulation Form */}
              <div className="bg-theme-surface/70 dark:bg-slate-900/40 p-3 rounded-xl border border-indigo-500/30 space-y-2">
                <label className="block text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                  {t('login.customEmpIdLabel', { defaultValue: 'จำลองด้วยรหัสพนักงาน (Custom Employee ID)' })}
                </label>
                <form onSubmit={handleCustomMockLogin} className="flex gap-2 items-center">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={customEmpId}
                      onChange={(e) => setCustomEmpId(e.target.value)}
                      placeholder={t('login.customEmpIdPlaceholder', { defaultValue: 'ระบุรหัสพนักงาน เช่น 638089, 648087...' })}
                      className="w-full bg-theme-surface border border-theme-border rounded-lg py-2 px-3 text-xs font-semibold text-theme-text placeholder:text-theme-text-muted focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading || !customEmpId.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all shrink-0 flex items-center gap-1.5 shadow-md shadow-indigo-500/20"
                  >
                    {isLoading ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <UserCheck size={14} />
                        <span>{t('login.simulateBtn', { defaultValue: 'จำลองสิทธิ์' })}</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Section Divider */}
              <div className="flex items-center gap-2 py-1">
                <div className="h-px bg-theme-border/60 flex-1" />
                <span className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">
                  {t('login.orPresetProfiles', { defaultValue: 'หรือเลือกโปรไฟล์ทดสอบที่เตรียมไว้' })}
                </span>
                <div className="h-px bg-theme-border/60 flex-1" />
              </div>

              {/* Group Selector Tabs */}
              <div className="flex flex-wrap gap-1.5 border-b border-theme-border/40 pb-2">
                {Object.keys(groups).map((groupName) => (
                  <button
                    key={groupName}
                    onClick={() => setSelectedGroup(groupName)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      selectedGroup === groupName
                        ? 'bg-indigo-500 text-white shadow-md'
                        : 'bg-theme-surface border border-theme-border/60 text-theme-text-secondary hover:text-theme-text'
                    }`}
                  >
                    {groupName} ({groups[groupName].length})
                  </button>
                ))}
              </div>

              {/* Users List for the Active Tab */}
              <div className="grid grid-cols-1 gap-2.5 max-h-[300px] overflow-y-auto pr-1.5 custom-scrollbar">
                {groups[selectedGroup]?.map((u) => (
                  <button
                    key={u.emp_id}
                    onClick={() => handleMockLogin(u)}
                    disabled={isLoading}
                    className="w-full text-left bg-theme-surface/70 dark:bg-slate-900/30 hover:bg-indigo-500/10 border border-theme-border hover:border-indigo-500/40 rounded-xl p-3 flex justify-between items-center transition-all hover:scale-[1.01] group"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-theme-text group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {u.full_name} ({u.nickname})
                        </span>
                        <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-theme-surface-secondary border border-theme-border text-theme-text-secondary">
                          ID: {u.emp_id}
                        </span>
                      </div>
                      <p className="text-[10px] text-theme-text-secondary mt-1 truncate">
                        {u.position} • {u.department}
                      </p>
                      <p className="text-[9px] text-theme-text-muted mt-0.5 font-mono truncate">
                        BU: {u.bu_working} | Line: {u.line_of_work}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center justify-center h-7 w-7 rounded-lg bg-indigo-500/5 group-hover:bg-indigo-500/20 text-indigo-500 transition-all font-bold text-xs">
                      →
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
