import { useState, useEffect } from 'react';
import { 
  Trophy, 
  Flame, 
  Coffee, 
  Sparkles, 
  Zap, 
  UserCheck, 
  Clock, 
  HelpCircle,
  Search
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { useNotification } from '../context/NotificationContext';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

interface TeamMember {
  rank: number;
  id: string;
  name: string;
  nickname: string;
  empId: string;
  avatarUrl: string;
  department: string;
  totalHours: number;
  flameScore: number;
  badge: string;
  badgeIcon: string;
  badgeColor: string;
  status: 'active' | 'warning' | 'chill';
  activeDays: number;
  sameDayLogs: number;
  coffeeBoostCount: number;
}

export default function LeaderboardPage() {
  const { showToast } = useNotification();
  const [searchTerm, setSearchTerm] = useState('');
  const [sentCoffee, setSentCoffee] = useState<Record<string, boolean>>({});
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [overallStats, setOverallStats] = useState({
    complianceRate: 0,
    topPerformer: '',
    totalHours: 0
  });

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        setIsLoading(true);

        // 1. Fetch real users (including coffee_boost_count)
        const { data: users, error: userErr } = await supabase
          .from('users')
          .select('id, full_name, department, nickname, emp_id, coffee_boost_count')
          .eq('status', 'Active');
        
        if (userErr) throw userErr;

        // 2. Fetch real worklogs
        const { data: logs, error: logErr } = await supabase
          .from('col_worklog')
          .select('user_id, work_date, total_hours, created_at');

        if (logErr) throw logErr;

        // 3. Process logs and calculate scores
        const processed = users.map(user => {
          const userLogs = logs.filter(log => log.user_id === user.id);
          
          // Sum hours
          const totalHours = userLogs.reduce((sum, log) => sum + parseFloat(log.total_hours || '0'), 0);
          
          // Distinct work dates
          const distinctDates = new Set(userLogs.map(log => log.work_date));
          const activeDays = distinctDates.size;
          
          // Same-day logging count
          const sameDayLogs = userLogs.filter(log => {
            const createdDate = new Date(log.created_at).toISOString().split('T')[0];
            return createdDate === log.work_date;
          }).length;

          // Dynamic score formula
          const flameScore = (activeDays * 25) + Math.round(totalHours * 2.5) + (sameDayLogs * 10);

          // Assign Badges dynamically based on performance
          let badge = "Steady Jogger 🏃";
          let badgeIcon = "👟";
          let badgeColor = "text-orange-400 bg-orange-500/10 border-orange-500/20";
          let status: 'active' | 'warning' | 'chill' = 'active';

          if (flameScore > 2500) {
            badge = "Log Master 🚀";
            badgeIcon = "👾";
            badgeColor = "text-pink-400 bg-pink-500/10 border-pink-500/20";
          } else if (flameScore > 1000) {
            badge = "Consistent Legend 🛡️";
            badgeIcon = "🔥";
            badgeColor = "text-indigo-400 bg-indigo-500/10 border-indigo-500/20";
          } else if (flameScore > 500) {
            badge = "Early Bird 🐦";
            badgeIcon = "☀️";
            badgeColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
          } else if (flameScore <= 400) {
            badge = "Chilled Turtle 🐢";
            badgeIcon = "💤";
            badgeColor = "text-teal-400 bg-teal-500/10 border-teal-500/20";
            status = 'chill';
          }

          return {
            id: user.id,
            name: user.full_name,
            nickname: user.nickname || '',
            empId: user.emp_id,
            avatarUrl: `https://wms.advanceagro.net/WSVIS/api/Face/GetImage?CardID=${user.emp_id}`,
            department: user.department || 'General',
            totalHours,
            flameScore,
            badge,
            badgeIcon,
            badgeColor,
            status,
            activeDays,
            sameDayLogs,
            coffeeBoostCount: user.coffee_boost_count || 0
          };
        });

        // Sort by flameScore descending
        processed.sort((a, b) => b.flameScore - a.flameScore);

        // Map ranking position
        const ranked = processed.map((member, index) => ({
          ...member,
          rank: index + 1
        }));

        setMembers(ranked);

        // Overall stats
        const totalHrs = logs.reduce((sum, log) => sum + parseFloat(log.total_hours || '0'), 0);
        const topPerf = ranked[0]?.name || 'N/A';
        const avgActiveDays = ranked.reduce((sum, m) => sum + m.activeDays, 0) / (ranked.length || 1);
        const compliance = Math.min(100, Math.round((avgActiveDays / 40) * 100));

        setOverallStats({
          complianceRate: compliance || 85,
          topPerformer: topPerf,
          totalHours: Math.round(totalHrs)
        });

      } catch (err) {
        console.error('Error fetching leaderboard data:', err);
        showToast('ไม่สามารถโหลดข้อมูล Leaderboard ได้', 'error');
      } finally {
        setIsLoading(false);
      }
    }

    fetchLeaderboard();
  }, [showToast]);

  const handleSendCoffee = async (member: TeamMember) => {
    setSentCoffee(prev => ({ ...prev, [member.id]: true }));
    
    try {
      const newCount = member.coffeeBoostCount + 1;
      const { error } = await supabase
        .from('users')
        .update({ coffee_boost_count: newCount })
        .eq('id', member.id);

      if (error) throw error;

      // Update state locally
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, coffeeBoostCount: newCount } : m));
      
      showToast(`ส่งกาแฟ Boost ให้ ${member.name} แล้ว! ☕️ / Coffee boost sent!`, 'success');
    } catch (err) {
      console.error('Error updating coffee boost:', err);
      showToast('ไม่สามารถส่งกาแฟได้ในขณะนี้', 'error');
    }

    setTimeout(() => {
      setSentCoffee(prev => ({ ...prev, [member.id]: false }));
    }, 3000);
  };

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Top 3 Podium
  const top1 = members.find(m => m.rank === 1);
  const top2 = members.find(m => m.rank === 2);
  const top3 = members.find(m => m.rank === 3);
  
  // Table results (Ranks greater than 3)
  const restOfTeam = filteredMembers.filter(m => m.rank > 3);

  return (
    <AppLayout>
      {/* Dynamic styles injection for Premium Champion Glowing Line */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes gold-glow-run {
          0%, 100% { border-color: rgba(245, 158, 11, 0.4); box-shadow: 0 0 20px rgba(245, 158, 11, 0.15); }
          50% { border-color: rgba(251, 191, 36, 0.8); box-shadow: 0 0 35px rgba(251, 191, 36, 0.35); }
        }
        .gold-champion-glow {
          animation: gold-glow-run 3s ease-in-out infinite;
        }
      `}} />

      <div className="max-w-6xl mx-auto space-y-8 pb-12">
        
        {/* Banner Title */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-theme-border dark:border-theme-border/60 pb-5">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              <Trophy className="text-amber-500 dark:text-amber-400 animate-bounce" size={32} />
              <span className="bg-gradient-to-r from-slate-800 to-slate-500 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                Team Worklog Leaderboard
              </span>
            </h1>
            <p className="text-sm text-theme-text-secondary mt-1">
              ท้าทายความสม่ำเสมอในการบันทึก Worklog ภายในทีม ยิ่งไว ยิ่งสม่ำเสมอ คะแนนไฟยิ่งลุก!
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-full">
            <Flame className="h-4.5 w-4.5 text-amber-500 animate-pulse" />
            <span className="text-xs font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-widest font-mono">
              Season 1: Active Challenges
            </span>
          </div>
        </div>

        {isLoading ? (
          // Glass loader skeleton
          <div className="space-y-8 animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-theme-surface-tertiary dark:bg-theme-surface-tertiary/40 rounded-2xl border border-theme-border"></div>
              ))}
            </div>
            <div className="h-80 bg-theme-surface-tertiary dark:bg-theme-surface-tertiary/40 rounded-2xl border border-theme-border"></div>
          </div>
        ) : (
          <>
            {/* Highlight Stats Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="ai-glass rounded-2xl p-5 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-theme-text-muted uppercase tracking-wider">Average Compliance</span>
                  <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">{overallStats.complianceRate}%</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
                  <UserCheck size={20} />
                </div>
              </div>
              
              <div className="ai-glass rounded-2xl p-5 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-theme-text-muted uppercase tracking-wider">Top Performer</span>
                  <p className="text-xl font-black text-emerald-500 truncate max-w-[200px]" title={overallStats.topPerformer}>
                    {overallStats.topPerformer}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                  <Zap size={20} />
                </div>
              </div>

              <div className="ai-glass rounded-2xl p-5 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-theme-text-muted uppercase tracking-wider">Overall Logged Hours</span>
                  <p className="text-2xl font-black text-amber-500 font-mono">{overallStats.totalHours.toLocaleString()} hrs 🔥</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                  <Flame size={20} />
                </div>
              </div>
            </div>

            {/* 🏆 TOP 3 PODIUM SECTION */}
            <div className="space-y-4">
              <h2 className="text-base font-black text-slate-800 dark:text-slate-300 uppercase tracking-widest font-mono flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500" />
                <span>Top Contributors</span>
              </h2>
              
              {/* Aligned to bottom to construct a real 3D podium height distribution on desktop */}
              <div className="flex flex-col md:flex-row items-stretch md:items-end justify-center gap-6">
                
                {/* Rank 2 (Left on desktop - Medium Height) */}
                {top2 && (
                  <div className="w-full md:w-1/3 min-h-[220px] md:h-[240px] ai-glass rounded-2xl p-6 border-slate-300 dark:border-indigo-500/20 bg-gradient-to-b from-slate-100/50 to-white dark:from-[#0b0f1d] dark:to-slate-900/10 relative overflow-hidden flex flex-col items-center justify-between text-center transition-all duration-300 hover:scale-[1.02]">
                    <div className="absolute top-3 left-4 text-3xl font-black text-slate-400 font-mono">2.</div>
                    
                    {/* Silver Medal/Badge */}
                    <div className="absolute top-3 right-4 flex items-center gap-1 bg-slate-300/20 dark:bg-slate-500/10 px-2 py-0.5 rounded-full border border-slate-400/20">
                      <Trophy size={14} className="text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300">SILVER</span>
                    </div>

                    {/* Coffee Count Badge */}
                    {top2.coffeeBoostCount > 0 && (
                      <div className="absolute top-12 right-4 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 text-amber-500 text-[10px] font-bold animate-pulse">
                        ☕ {top2.coffeeBoostCount} Boosts
                      </div>
                    )}

                    <div className="flex flex-col items-center space-y-3 mt-6">
                      <div className="w-16 h-16 rounded-full overflow-hidden ring-4 ring-slate-300/40 shadow-lg relative bg-slate-800">
                        <img 
                          src={top2.avatarUrl} 
                          alt={top2.name} 
                          className="w-full h-full object-cover" 
                          onError={(e) => {
                            e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(top2.name)}&background=818cf8&color=fff`;
                          }}
                        />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-theme-text leading-tight">{top2.name}</h3>
                        <p className="text-xs text-theme-text-secondary truncate max-w-[180px]" title={top2.department}>
                          {top2.department}
                        </p>
                      </div>
                    </div>

                    <div className="w-full grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-theme-border/60">
                      <div>
                        <p className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">Total Hours</p>
                        <p className="text-sm font-extrabold text-theme-text font-mono">{top2.totalHours.toFixed(1)} hrs</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">Flame Score</p>
                        <p className="text-sm font-extrabold text-amber-500 font-mono flex items-center justify-center gap-1">
                          {top2.flameScore} <Flame size={12} className="fill-amber-500 text-amber-500" />
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Rank 1 (Center - Raised Higher & Custom Gold glowing running border) */}
                {top1 && (
                  <div className="w-full md:w-1/3 min-h-[250px] md:h-[280px] md:-translate-y-6 md:scale-105 ai-glass rounded-2xl p-6 border-2 border-amber-400 dark:border-amber-500/50 bg-gradient-to-b from-amber-50/20 to-white dark:from-[#0a0f1d] dark:to-amber-950/5 relative overflow-hidden flex flex-col items-center justify-between text-center transition-all duration-300 gold-champion-glow shadow-[0_0_30px_rgba(245,158,11,0.2)]">
                    <div className="absolute top-3 left-4 text-4xl font-black text-amber-500 font-mono">1.</div>
                    
                    {/* Gold Trophy Badge */}
                    <div className="absolute top-3 right-4 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-400/30">
                      <Trophy size={14} className="text-amber-500 animate-pulse" />
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">CHAMPION</span>
                    </div>

                    {/* Coffee Count Badge */}
                    {top1.coffeeBoostCount > 0 && (
                      <div className="absolute top-12 right-4 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 text-amber-500 text-[10px] font-bold animate-pulse">
                        ☕ {top1.coffeeBoostCount} Boosts
                      </div>
                    )}

                    <div className="flex flex-col items-center space-y-3 mt-6">
                      <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-amber-400 shadow-xl relative bg-slate-800">
                        <img 
                          src={top1.avatarUrl} 
                          alt={top1.name} 
                          className="w-full h-full object-cover" 
                          onError={(e) => {
                            e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(top1.name)}&background=facc15&color=fff`;
                          }}
                        />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-theme-text leading-tight">{top1.name}</h3>
                        <p className="text-xs text-theme-text-secondary truncate max-w-[180px]" title={top1.department}>
                          {top1.department}
                        </p>
                      </div>
                    </div>

                    <div className="w-full grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-theme-border/60">
                      <div>
                        <p className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">Total Hours</p>
                        <p className="text-sm font-extrabold text-theme-text font-mono">{top1.totalHours.toFixed(1)} hrs</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">Flame Score</p>
                        <p className="text-sm font-extrabold text-amber-500 font-mono flex items-center justify-center gap-1">
                          {top1.flameScore} <Flame size={14} className="fill-amber-500 text-amber-500 animate-pulse" />
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Rank 3 (Right on desktop - Lowest Height) */}
                {top3 && (
                  <div className="w-full md:w-1/3 min-h-[210px] md:h-[220px] ai-glass rounded-2xl p-6 border-orange-200 dark:border-amber-700/20 bg-gradient-to-b from-orange-50/20 to-white dark:from-[#0b0f1d] dark:to-orange-950/5 relative overflow-hidden flex flex-col items-center justify-between text-center transition-all duration-300 hover:scale-[1.02]">
                    <div className="absolute top-3 left-4 text-3xl font-black text-amber-700 font-mono">3.</div>
                    
                    {/* Bronze Medal/Badge */}
                    <div className="absolute top-3 right-4 flex items-center gap-1 bg-amber-700/10 px-2 py-0.5 rounded-full border border-amber-700/20">
                      <Trophy size={14} className="text-amber-700" />
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-500">BRONZE</span>
                    </div>

                    {/* Coffee Count Badge */}
                    {top3.coffeeBoostCount > 0 && (
                      <div className="absolute top-12 right-4 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 text-amber-500 text-[10px] font-bold animate-pulse">
                        ☕ {top3.coffeeBoostCount} Boosts
                      </div>
                    )}

                    <div className="flex flex-col items-center space-y-3 mt-6">
                      <div className="w-16 h-16 rounded-full overflow-hidden ring-4 ring-amber-700/40 shadow-lg relative bg-slate-800">
                        <img 
                          src={top3.avatarUrl} 
                          alt={top3.name} 
                          className="w-full h-full object-cover" 
                          onError={(e) => {
                            e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(top3.name)}&background=818cf8&color=fff`;
                          }}
                        />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-theme-text leading-tight">{top3.name}</h3>
                        <p className="text-xs text-theme-text-secondary truncate max-w-[180px]" title={top3.department}>
                          {top3.department}
                        </p>
                      </div>
                    </div>

                    <div className="w-full grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-theme-border/60">
                      <div>
                        <p className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">Total Hours</p>
                        <p className="text-sm font-extrabold text-theme-text font-mono">{top3.totalHours.toFixed(1)} hrs</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">Flame Score</p>
                        <p className="text-sm font-extrabold text-amber-500 font-mono flex items-center justify-center gap-1">
                          {top3.flameScore} <Flame size={12} className="fill-amber-500 text-amber-500" />
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 📋 RANKINGS LIST TABLE */}
            <div className="space-y-4">
              
              {/* Controls Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-base font-black text-slate-800 dark:text-slate-300 uppercase tracking-widest font-mono flex items-center gap-2">
                  <Clock size={16} className="text-indigo-500" />
                  <span>Rankings &amp; Teams</span>
                </h2>

                {/* Search filter */}
                <div className="w-full sm:w-64 relative">
                  <input
                    type="text"
                    placeholder="Search team member..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 pl-10 rounded-xl bg-theme-surface-secondary border border-theme-border text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  {/* Magnifying glass fixed to vertical center */}
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none" />
                </div>
              </div>

              {/* Table Container */}
              <div className="ai-glass rounded-2xl overflow-hidden shadow-xl border border-theme-border/80">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-theme-border/60 bg-theme-surface-secondary/40 text-theme-text-muted text-[10px] font-bold uppercase tracking-wider">
                        <th className="px-6 py-4 w-16 text-center">Rank</th>
                        <th className="px-6 py-4">Name</th>
                        <th className="px-6 py-4">Flame Score</th>
                        <th className="px-6 py-4">Total Hours</th>
                        <th className="px-6 py-4">Status &amp; Badge</th>
                        <th className="px-6 py-4 text-center">Interactions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-border/40 text-sm">
                      {restOfTeam.length > 0 ? (
                        restOfTeam.map((member) => (
                          <tr 
                            key={member.id} 
                            className={cn(
                              "hover:bg-theme-surface-secondary/20 transition-all",
                              member.status === 'chill' && "bg-rose-500/5 hover:bg-rose-500/10"
                            )}
                          >
                            {/* Rank */}
                            <td className="px-6 py-4 text-center font-bold font-mono text-theme-text-secondary">
                              {member.rank}.
                            </td>

                            {/* Name & Avatar */}
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-indigo-500/10 shadow-sm bg-slate-800">
                                  <img 
                                    src={member.avatarUrl} 
                                    alt={member.name} 
                                    className="w-full h-full object-cover" 
                                    onError={(e) => {
                                      e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=818cf8&color=fff`;
                                    }}
                                  />
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <p className="font-bold text-theme-text leading-tight">{member.name}</p>
                                    
                                    {/* Persisted Coffee Boost Display */}
                                    {member.coffeeBoostCount > 0 && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/15 animate-pulse">
                                        ☕ {member.coffeeBoostCount}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-theme-text-muted font-mono truncate max-w-[160px]" title={member.department}>
                                    {member.department}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Flame Score */}
                            <td className="px-6 py-4 font-bold font-mono text-amber-500">
                              <div className="flex items-center gap-1.5">
                                {member.flameScore}
                                <Flame size={14} className="fill-amber-500 text-amber-500" />
                              </div>
                            </td>

                            {/* Total Hours */}
                            <td className="px-6 py-4 font-semibold font-mono text-theme-text-secondary">
                              {member.totalHours.toFixed(1)} hrs
                            </td>

                            {/* Badges / Funny status */}
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold font-mono leading-none",
                                  member.badgeColor
                                )}>
                                  <span>{member.badgeIcon}</span>
                                  <span>{member.badge}</span>
                                </span>
                                
                                {member.status === 'chill' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-500 border border-rose-500/20 animate-pulse">
                                    💤 Needs Nudge
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Friendly Interactions (Calls handleSendCoffee with full member object) */}
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => handleSendCoffee(member)}
                                disabled={sentCoffee[member.id]}
                                className={cn(
                                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95",
                                  sentCoffee[member.id]
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500 cursor-default"
                                    : member.status === 'chill'
                                    ? "bg-rose-500/10 border-rose-500/20 hover:border-rose-500/40 text-rose-500 hover:bg-rose-500/20"
                                    : "bg-indigo-500/10 border-indigo-500/20 hover:border-indigo-500/40 text-indigo-500 hover:bg-indigo-500/20"
                                )}
                              >
                                <Coffee size={13} className={cn(!sentCoffee[member.id] && "animate-pulse")} />
                                <span>{sentCoffee[member.id] ? 'Sent!' : member.status === 'chill' ? 'Nudge Coffee' : 'Send Coffee'}</span>
                              </button>
                            </td>

                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-theme-text-muted">
                            No team members found matching search parameters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 📘 GAMIFICATION EXPLANATION SECTION */}
            <div className="ai-glass bg-theme-surface dark:bg-theme-bg-page/50 rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-base font-semibold text-theme-text flex items-center gap-2 border-b border-theme-border/60 pb-3">
                <HelpCircle size={18} className="text-indigo-600 dark:text-indigo-400" />
                <span>กติกาการสะสมคะแนน (Gamification Rules)</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs leading-relaxed text-theme-text-secondary">
                <div className="space-y-1.5">
                  <h3 className="font-bold text-theme-text flex items-center gap-1">
                    <span className="text-amber-500">🔥</span> สถิติไฟลุก (Streak)
                  </h3>
                  <p>
                    การบันทึกงานในวันอื่นที่ไม่ซ้ำกันจะได้ +25 คะแนนต่อวัน ยิ่งสะสมวันทำงานมากยิ่งได้คะแนนหลักเยอะขึ้น
                  </p>
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-bold text-theme-text flex items-center gap-1">
                    <span className="text-indigo-500">⚡</span> ความไว (Punctuality)
                  </h3>
                  <p>
                    ส่งบันทึกงานแบบ Real-time (บันทึกงานตรงกับวันที่ทำงานจริง) จะได้รับแต้มความซื่อตรงและความเร็วเพิ่ม +10 คะแนนต่อรายการ
                  </p>
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-bold text-theme-text flex items-center gap-1">
                    <span className="text-emerald-500">⚖️</span> ปริมาณงาน (Volume of Hours)
                  </h3>
                  <p>
                    ทุกๆ 1 ชั่วโมงการทำงานที่ส่งเข้าระบบจะถูกคำนวณสัดส่วนแต้มเพิ่ม +2.5 คะแนน ช่วยเพิ่มค่าประสบการณ์ให้กับผู้ขยันบันทึก
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
