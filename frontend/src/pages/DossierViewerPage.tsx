import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowLeft, ShieldCheck, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function DossierViewerPage() {
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isPublic, setIsPublic] = useState<boolean | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Keyboard shortcut listener to forward Cmd+P / Ctrl+P directly to the portfolio iframe
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        try {
          iframeRef.current?.contentWindow?.focus();
          iframeRef.current?.contentWindow?.print();
        } catch {
          window.print();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    async function checkAccess() {
      // 1. Detect if active session is owner (คุณชัชวาลย์ / Admin)
      let ownerSession = false;
      try {
        const sessionStr = localStorage.getItem('worklog_session');
        if (sessionStr) {
          const parsed = JSON.parse(sessionStr);
          if (
            parsed.empId === '10005208' ||
            parsed.role === 'admin' ||
            parsed.role === 'super_admin' ||
            parsed.email?.includes('chatchawan')
          ) {
            ownerSession = true;
          }
        }
      } catch {
        // invalid JSON in local session
      }
      setIsOwner(ownerSession);

      // 2. Fetch visibility status from tb_system_config (Public policy enabled)
      try {
        const { data, error } = await supabase
          .from('tb_system_config')
          .select('config_value')
          .eq('config_key', 'chatchawan_dossier_visibility')
          .maybeSingle();

        if (!error && data?.config_value) {
          setIsPublic(data.config_value === 'public');
        } else {
          // If query returns null/error, owner falls back to local storage, but anonymous defaults to locked
          if (ownerSession) {
            const localVis = localStorage.getItem('chatchawan_dossier_visibility');
            setIsPublic(localVis !== 'private');
          } else {
            setIsPublic(false);
          }
        }
      } catch (err) {
        console.warn('Error reading dossier visibility from Supabase:', err);
        if (ownerSession) {
          const localVis = localStorage.getItem('chatchawan_dossier_visibility');
          setIsPublic(localVis !== 'private');
        } else {
          setIsPublic(false);
        }
      } finally {
        setIsLoading(false);
      }
    }

    checkAccess();
  }, []);

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

  // Allowed to view (Public or Owner): Open Web Portfolio full-screen directly with NO top wrapper nav
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
