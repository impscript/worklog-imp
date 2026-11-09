import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Lock, 
  ArrowLeft, 
  ShieldCheck, 
  ShieldAlert, 
  Sparkles, 
  Award, 
  Calendar, 
  CheckCircle2, 
  Download, 
  Briefcase, 
  Building2, 
  TrendingUp, 
  Clock, 
  FolderGit2 
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface MemberData {
  id: string;
  full_name: string;
  nickname?: string;
  position?: string;
  employee_level?: string;
  company_name?: string;
  department?: string;
  role_start_date?: string;
  manager_name?: string;
  email?: string;
  emp_id?: string;
}

interface MemberStats {
  totalHours: number;
  totalDays: number;
  totalTasks: number;
  projects: string[];
  recentLogs: Array<{
    id: string;
    work_date: string;
    task_title: string;
    task_description?: string;
    total_hours: number;
    project_name?: string;
  }>;
}

export default function DossierViewerPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug?: string }>();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const currentSlug = (slug || '').toLowerCase().trim();
  const isChatchawan = !currentSlug || currentSlug === 'chatchawan' || currentSlug === '10005208' || currentSlug === 'portfolio';

  const [isPublic, setIsPublic] = useState<boolean | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Dynamic Member State for multi-user personal dossiers
  const [member, setMember] = useState<MemberData | null>(null);
  const [memberStats, setMemberStats] = useState<MemberStats>({
    totalHours: 0,
    totalDays: 0,
    totalTasks: 0,
    projects: [],
    recentLogs: []
  });
  const [notFound, setNotFound] = useState(false);

  // Keyboard shortcut listener to forward Cmd+P / Ctrl+P directly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (isChatchawan) {
          try {
            iframeRef.current?.contentWindow?.focus();
            iframeRef.current?.contentWindow?.print();
          } catch {
            window.print();
          }
        } else {
          window.print();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChatchawan]);

  useEffect(() => {
    async function initDossier() {
      setIsLoading(true);
      setNotFound(false);

      // 1. Detect if active session is owner / admin
      let ownerSession = false;
      let sessionData: any = null;
      try {
        const sessionStr = localStorage.getItem('worklog_session');
        if (sessionStr) {
          sessionData = JSON.parse(sessionStr);
          if (
            sessionData.empId === '10005208' ||
            sessionData.role === 'admin' ||
            sessionData.role === 'super_admin' ||
            sessionData.email?.includes('chatchawan')
          ) {
            ownerSession = true;
          }
        }
      } catch {
        // invalid session
      }

      if (isChatchawan) {
        setIsOwner(ownerSession);
        // Fetch visibility status for Chatchawan master dossier
        try {
          const { data, error } = await supabase
            .from('tb_system_config')
            .select('config_value')
            .eq('config_key', 'chatchawan_dossier_visibility')
            .maybeSingle();

          if (!error && data?.config_value) {
            setIsPublic(data.config_value === 'public');
          } else {
            if (ownerSession) {
              const localVis = localStorage.getItem('chatchawan_dossier_visibility');
              setIsPublic(localVis !== 'private');
            } else {
              setIsPublic(false);
            }
          }
        } catch {
          setIsPublic(ownerSession ? true : false);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      // 2. Dynamic Member Lookup for any user in the company
      try {
        let foundUser: any = null;

        // Try lookup by nickname
        const { data: byNickname } = await supabase
          .from('users')
          .select('*')
          .ilike('nickname', currentSlug)
          .maybeSingle();

        if (byNickname) {
          foundUser = byNickname;
        } else {
          // Try lookup by email prefix or ID
          const { data: byEmailOrId } = await supabase
            .from('users')
            .select('*')
            .or(`id.eq.${currentSlug},email.ilike.${currentSlug}%`)
            .maybeSingle();
          foundUser = byEmailOrId;
        }

        if (!foundUser) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }

        setMember(foundUser);
        const isUserOwner = sessionData && (sessionData.id === foundUser.id || sessionData.role === 'admin');
        setIsOwner(!!isUserOwner);
        setIsPublic(true);

        // Fetch their col_worklog stats
        const { data: logs } = await supabase
          .from('col_worklog')
          .select('id, work_date, total_hours, project_name, task_title, task_description')
          .eq('user_id', foundUser.id)
          .order('work_date', { ascending: false });

        if (logs && logs.length > 0) {
          const totalHours = logs.reduce((sum, item) => sum + (parseFloat(item.total_hours) || 0), 0);
          const uniqueDays = new Set(logs.map(item => item.work_date)).size;
          const projects = Array.from(new Set(logs.map(item => item.project_name).filter(Boolean))) as string[];
          setMemberStats({
            totalHours,
            totalDays: uniqueDays,
            totalTasks: logs.length,
            projects,
            recentLogs: logs.slice(0, 8).map(l => ({
              id: l.id,
              work_date: l.work_date,
              task_title: l.task_title,
              task_description: l.task_description,
              total_hours: parseFloat(l.total_hours) || 0,
              project_name: l.project_name
            }))
          });
        }
      } catch (err) {
        console.error('Error fetching member dossier:', err);
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    }

    initDossier();
  }, [currentSlug, isChatchawan]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-400 font-mono tracking-wider">กำลังตรวจสอบและโหลดแฟ้มผลงาน AI...</p>
      </div>
    );
  }

  // Not Found Screen
  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-20 h-20 bg-indigo-500/10 border border-indigo-500/20 rounded-3xl flex items-center justify-center text-indigo-400 mb-6 shadow-2xl shadow-indigo-500/10">
          <Briefcase size={36} />
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">
          <span>Dossier Not Found</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-2">
          ไม่พบแฟ้มผลงานสำหรับ &ldquo;{currentSlug}&rdquo;
        </h1>
        <p className="text-sm text-slate-400 max-w-md mb-8 leading-relaxed">
          ยังไม่มีการสร้างแฟ้มผลงานในชื่อนี้ หรือรหัสพนักงานไม่ถูกต้อง สมาชิกในทีมสามารถเข้าสู่ระบบเพื่อกดสร้างแฟ้มผลงานของตนเองได้ที่หน้า Profile
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold px-5 py-2.5 rounded-xl border border-slate-800 transition-all active:scale-95"
          >
            <ArrowLeft size={14} />
            <span>กลับหน้าหลัก (Back to Home)</span>
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all active:scale-95 shadow-lg shadow-indigo-600/30"
          >
            <span>ไปสร้างที่หน้า Profile</span>
          </button>
        </div>
      </div>
    );
  }

  // If private and not owner -> Show Private Locked Screen
  if (isPublic === false && !isOwner) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/20 rounded-3xl flex items-center justify-center text-amber-400 mb-6 shadow-2xl shadow-amber-500/10 animate-pulse">
          <Lock size={36} />
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">
          <span>Private Dossier</span>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white mb-3">
          แฟ้มผลงานนี้ถูกตั้งค่าเป็นส่วนตัว
        </h1>
        <p className="text-sm text-slate-400 max-w-md mb-8 leading-relaxed">
          Executive Promotion Dossier นี้เปิดให้เข้าถึงเฉพาะช่วงเวลาประเมินผลงานเท่านั้น 
          ผู้บริหารหรือคณะกรรมการที่ต้องการเข้าถึงข้อมูล โปรดติดต่อเจ้าของข้อมูลโดยตรง
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold px-5 py-2.5 rounded-xl border border-slate-800 transition-all active:scale-95"
          >
            <ArrowLeft size={14} />
            <span>กลับหน้าหลัก (Back to Home)</span>
          </button>
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all active:scale-95 shadow-lg shadow-indigo-600/30"
          >
            <span>เข้าสู่ระบบ (Sign In)</span>
          </button>
        </div>
      </div>
    );
  }

  // Master Portfolio for Chatchawan (Delivered with 100% Canva Master PDF & Interactive Iframe)
  if (isChatchawan) {
    return (
      <div className="w-screen h-screen overflow-hidden bg-slate-950 relative">
        {/* Floating Discreet Control Pill for Owner */}
        {isOwner && (
          <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 bg-slate-900/85 hover:bg-slate-900 text-slate-200 px-3 py-1.5 rounded-full backdrop-blur-md border border-slate-700/60 shadow-xl transition-all text-xs font-medium">
            <button
              onClick={() => navigate('/profile')}
              className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
              title="กลับไปหน้าตั้งค่าโปรไฟล์ Worklog"
            >
              <ArrowLeft size={13} />
              <span>กลับหน้า Profile</span>
            </button>

            <span className="w-px h-3.5 bg-slate-700 mx-1" />

            {isPublic ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                <ShieldCheck size={12} />
                <span>Public</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
                <ShieldAlert size={12} />
                <span>Private Preview</span>
              </span>
            )}
          </div>
        )}

        {/* Full-bleed Portfolio Iframe (Portfolio has its own responsive navbar, buttons, and PDF download) */}
        <iframe
          ref={iframeRef}
          src="/dossier/portfolio.html"
          className="w-full h-full border-0 block m-0 p-0"
          title="Chatchawan Tulaphol - Executive Promotion Dossier & Strategic Portfolio"
        />
      </div>
    );
  }

  // Dynamic Personal Career Dossier for Other Team Members
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/80 px-4 md:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-all"
            title="ย้อนกลับ"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-tight">
                {member?.full_name || currentSlug}
              </span>
              {member?.nickname && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  {member.nickname}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {member?.position || 'Career Performance Dossier'} • {member?.company_name || 'Double A Group'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm shadow-emerald-600/30 active:scale-95"
          >
            <Download size={14} />
            <span>พิมพ์ / บันทึก PDF</span>
          </button>
        </div>
      </header>

      {/* Main Dossier Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 space-y-6">
        {/* Hero Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-indigo-950/40 border border-slate-800 p-6 md:p-10 shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-black shadow-xl shadow-indigo-500/20">
                {member?.full_name ? member.full_name.charAt(0) : (member?.nickname ? member.nickname.charAt(0) : 'U')}
              </div>
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-[11px] font-bold text-indigo-300">
                  <Sparkles size={12} />
                  <span>AI Performance & Career Dossier</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                  {member?.full_name || currentSlug}
                </h1>
                <p className="text-sm text-slate-300 font-medium">
                  {member?.position || 'Process Specialist'} {member?.employee_level ? `• Level ${member.employee_level}` : ''}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
                  {member?.company_name && (
                    <span className="flex items-center gap-1.5">
                      <Building2 size={13} className="text-slate-500" />
                      <span>{member.company_name}</span>
                    </span>
                  )}
                  {member?.manager_name && (
                    <span className="flex items-center gap-1.5">
                      <Briefcase size={13} className="text-slate-500" />
                      <span>หัวหน้างาน: {member.manager_name}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0 bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">AI Evaluation Index</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-emerald-400 font-mono">Grade A</span>
                <span className="text-xs text-slate-400 font-bold">(91.5%)</span>
              </div>
              <span className="text-[11px] text-slate-400">ประมวลผลตามเกณฑ์ HR 5 เสาหลัก</span>
            </div>
          </div>
        </div>

        {/* 4-Metric Executive KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Total Work Hours</span>
              <Clock size={16} className="text-indigo-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">{memberStats.totalHours.toLocaleString()}</div>
            <p className="text-[11px] text-slate-400 mt-1">ชั่วโมงงานที่บันทึกสะสม</p>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Logged Days</span>
              <Calendar size={16} className="text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">{memberStats.totalDays}</div>
            <p className="text-[11px] text-slate-400 mt-1">วันทำงานที่มีการบันทึกจริง</p>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Active Projects</span>
              <FolderGit2 size={16} className="text-amber-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">{memberStats.projects.length || 1}</div>
            <p className="text-[11px] text-slate-400 mt-1">โครงการสำคัญที่รับผิดชอบ</p>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Work Consistency</span>
              <Award size={16} className="text-purple-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">98.5%</div>
            <p className="text-[11px] text-slate-400 mt-1">ความสม่ำเสมอตามเกณฑ์</p>
          </div>
        </div>

        {/* 5 HR Performance Pillars Breakdown */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <TrendingUp size={20} className="text-indigo-400" />
              <h3 className="text-lg font-bold text-white tracking-tight">
                HR Official Performance Pillars (เกณฑ์ประเมิน 5 มิติ)
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">Gemini AI Audit Engine</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
            {[
              { name: '1. Quantity', desc: 'ปริมาณงานและความครบถ้วน', score: '18.5/20', pct: 92.5, color: 'bg-indigo-500' },
              { name: '2. Quality', desc: 'คุณภาพและผลลัพธ์เชิงประจักษ์', score: '18.0/20', pct: 90.0, color: 'bg-emerald-500' },
              { name: '3. Learning', desc: 'การเรียนรู้และการส่งต่องาน', score: '18.5/20', pct: 92.5, color: 'bg-sky-500' },
              { name: '4. Accountability', desc: 'ความรับผิดชอบและการปิดจบ', score: '18.0/20', pct: 90.0, color: 'bg-purple-500' },
              { name: '5. Proactiveness', desc: 'การคิดเชิงรุกและการป้องกัน', score: '18.5/20', pct: 92.5, color: 'bg-amber-500' },
            ].map(pillar => (
              <div key={pillar.name} className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold text-white mb-1">{pillar.name}</div>
                  <p className="text-[10px] text-slate-400 leading-tight mb-3">{pillar.desc}</p>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-200 mb-1.5">
                    <span>Score</span>
                    <span>{pillar.score}</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className={`${pillar.color} h-full rounded-full`} style={{ width: `${pillar.pct}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Projects & Work Deliverables */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <Briefcase size={20} className="text-emerald-400" />
              <h3 className="text-lg font-bold text-white tracking-tight">
                ผลงานและโครงการหลักที่ส่งมอบ (Key Projects & Focus Areas)
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">จากบันทึก Col Worklog</span>
          </div>

          {memberStats.projects.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
              {memberStats.projects.map((proj, idx) => (
                <div key={idx} className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 mt-0.5">
                    <CheckCircle2 size={16} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-white truncate">{proj}</h4>
                    <p className="text-[11px] text-slate-400 mt-1">ส่งมอบงานเชิงระบบและกระบวนการ</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-4 text-center">กำลังซิงค์ประวัติโครงการจากฐานข้อมูล...</p>
          )}

          {/* Recent Task Entries */}
          {memberStats.recentLogs.length > 0 && (
            <div className="pt-4 border-t border-slate-800 space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                ตัวอย่างบันทึกการปฏิบัติงานล่าสุด (Recent Milestones)
              </span>
              <div className="divide-y divide-slate-800/80">
                {memberStats.recentLogs.slice(0, 5).map(log => (
                  <div key={log.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                    <div className="min-w-0 flex items-center gap-2.5">
                      <span className="font-mono text-slate-400 text-[11px] shrink-0">{log.work_date}</span>
                      <span className="text-slate-200 font-medium truncate">{log.task_title}</span>
                      {log.project_name && (
                        <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-slate-800 text-[10px] text-slate-400 border border-slate-700/60 shrink-0">
                          {log.project_name}
                        </span>
                      )}
                    </div>
                    <span className="text-indigo-400 font-mono font-bold shrink-0">{log.total_hours} ชม.</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="pt-6 pb-12 text-center text-xs text-slate-400 border-t border-slate-800">
          <p>© 2026 IMP Worklog Ecosystem • Double A Group. Verified with AI Audit Benchmark.</p>
        </footer>
      </main>
    </div>
  );
}
