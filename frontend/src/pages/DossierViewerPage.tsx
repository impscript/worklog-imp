import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, ExternalLink, Download, ArrowLeft, FileText, Presentation, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function DossierViewerPage({ defaultTab = 'portfolio' }: { defaultTab?: 'portfolio' | 'presentation' }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as 'portfolio' | 'presentation' | null;
  const [activeTab, setActiveTab] = useState<'portfolio' | 'presentation'>(tabParam || defaultTab);
  
  const [isPublic, setIsPublic] = useState<boolean | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAccess() {
      try {
        // 1. Check if viewer is owner from cached session
        const sessionStr = localStorage.getItem('worklog_session');
        let ownerSession = false;
        if (sessionStr) {
          try {
            const parsed = JSON.parse(sessionStr);
            if (parsed.empId === '10005208' || parsed.role === 'admin' || parsed.email?.includes('chatchawan')) {
              ownerSession = true;
            }
          } catch {
            // invalid json
          }
        }
        setIsOwner(ownerSession);

        // 2. Fetch public/private state from tb_system_config
        const { data, error } = await supabase
          .from('tb_system_config')
          .select('config_value')
          .eq('config_key', 'chatchawan_dossier_visibility')
          .maybeSingle();

        if (!error && data?.config_value) {
          setIsPublic(data.config_value === 'public');
        } else {
          // Fallback to localStorage if table row not created yet
          const localState = localStorage.getItem('chatchawan_dossier_visibility');
          setIsPublic(localState !== 'private'); // default to public if not explicitly private
        }
      } catch (err) {
        console.warn('Error checking dossier visibility, falling back to local state:', err);
        const localState = localStorage.getItem('chatchawan_dossier_visibility');
        setIsPublic(localState !== 'private');
      } finally {
        setIsLoading(false);
      }
    }

    checkAccess();
  }, []);

  const handleTabChange = (tab: 'portfolio' | 'presentation') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-400 font-mono tracking-wider">กำลังตรวจสอบสิทธิ์เข้าถึงแฟ้มผลงาน...</p>
      </div>
    );
  }

  // If private and not owner -> Show Private Locked Screen
  if (isPublic === false && !isOwner) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/20 rounded-3xl flex items-center justify-center text-amber-400 mb-6 shadow-2xl shadow-amber-500/10">
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
          ผู้บริหารหรือผู้เกี่ยวข้องที่ต้องการเข้าถึงข้อมูล โปรดติดต่อเจ้าของข้อมูลโดยตรง
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
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all active:scale-95"
          >
            <span>เข้าสู่ระบบ (Sign In)</span>
          </button>
        </div>
      </div>
    );
  }

  // Allowed to view (Public or Owner)
  const currentIframeSrc = activeTab === 'portfolio' ? '/dossier/portfolio.html' : '/dossier/presentation.html';

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col overflow-hidden text-slate-100">
      {/* Top Navigation Bar */}
      <header className="h-16 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 md:px-6 flex items-center justify-between gap-4 shrink-0 z-50">
        {/* Left: Branding & Candidate Profile */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/profile')}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="กลับไปหน้า Profile"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2.5">
            <img
              src="/dossier/assets/chatchawan_headshot.jpg"
              alt="ชัชวาลย์ ตุลาผล"
              className="w-9 h-9 rounded-full object-cover border-2 border-indigo-500/50"
            />
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">ชัชวาลย์ ตุลาผล</span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  Target: Department Manager
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block font-sans">
                Executive Promotion Dossier 2026–2027
              </span>
            </div>
          </div>
        </div>

        {/* Center: Tabs Switcher */}
        <div className="flex items-center bg-slate-950/80 p-1 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => handleTabChange('portfolio')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'portfolio'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText size={14} />
            <span className="hidden md:inline">Executive Portfolio</span>
            <span className="md:hidden">Portfolio</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('presentation')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'presentation'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Presentation size={14} />
            <span className="hidden md:inline">Presentation Deck (14 Slides)</span>
            <span className="md:hidden">Slides</span>
          </button>
        </div>

        {/* Right: Actions & Downloads */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Owner Notice Badge if Private */}
          {isOwner && isPublic === false && (
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-medium">
              <ShieldAlert size={13} />
              <span>Private Preview</span>
            </div>
          )}

          {/* PDF Download Direct Link */}
          <a
            href={activeTab === 'portfolio' ? '/dossier/executive_portfolio.pdf' : '/dossier/promotion_executive_presentation.pdf'}
            download
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 text-xs font-bold transition-all"
            title="ดาวน์โหลด PDF สรุป"
          >
            <Download size={13} />
            <span className="hidden sm:inline">PDF</span>
          </a>

          {/* Standalone Window */}
          <a
            href={currentIframeSrc}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
            title="เปิดในแท็บใหม่แบบ Standalone"
          >
            <ExternalLink size={15} />
          </a>
        </div>
      </header>

      {/* Main View Area (Iframe) */}
      <main className="flex-1 w-full relative bg-slate-950">
        <iframe
          key={currentIframeSrc}
          src={currentIframeSrc}
          className="w-full h-[calc(100vh-64px)] border-0"
          title="Executive Promotion Dossier"
        />
      </main>
    </div>
  );
}
