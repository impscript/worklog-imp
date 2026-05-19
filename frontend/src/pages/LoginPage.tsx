import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, KeyRound, User as UserIcon, Sparkles } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const username = account.trim();
      if (!username) {
        throw new Error('Please enter a username');
      }

      // Call our centralized useAuth hook login (which auto-handles Dev vs Prod proxy & JIT provisioning)
      await login(username, password);
      
      // Success
      navigate('/');
      
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] ai-cyber-grid flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[450px] h-[450px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-violet-600/5 blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md ai-glass rounded-3xl p-8 shadow-2xl relative z-10 border border-slate-800/80">
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-500 to-indigo-500 flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/25 border border-indigo-400/20">
            <Sparkles className="w-8 h-8 text-white animate-pulse" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-wider bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
            IMP WORKLOG
          </h1>
          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-2 flex items-center gap-1.5 bg-indigo-500/5 border border-indigo-500/10 px-3 py-1 rounded-full">
            <span className="ai-pulse-dot" />
            <span>AI COPILOT SECURE ACCESS</span>
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/5 border border-red-500/15 rounded-xl text-red-400 text-xs font-semibold text-center tracking-wide">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Username</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <UserIcon size={16} className="text-slate-500" />
              </div>
              <input 
                type="text" 
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="HRMS Username"
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500/30 transition-all font-semibold text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <KeyRound size={16} className="text-slate-500" />
              </div>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500/30 transition-all font-semibold text-sm"
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 disabled:cursor-not-allowed text-white font-extrabold uppercase tracking-wider text-xs rounded-xl py-3.5 shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all active:scale-[0.98] mt-6 flex items-center justify-center gap-2 border border-indigo-400/20"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <LogIn size={15} />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-900 text-center">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            For development, use <span className="text-indigo-400 font-extrabold font-mono">chatchawan</span> as username
          </p>
        </div>
      </div>
    </div>
  );
}
