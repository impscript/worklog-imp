import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Clock, Briefcase, Layers, Tag, CheckCircle2, Award, Calendar, FileText, Phone, MessageSquare, Sun, Moon } from 'lucide-react';

interface Worklog {
  id: string;
  work_date: string;
  start_time: string;
  end_time: string;
  break_time: boolean;
  total_hours: number;
  holding: string;
  department_operator: string;
  project_type: string;
  project_name: string;
  module: string;
  bu: string;
  department: string;
  action_name: string;
  action_channel: string;
  description: string;
  image_urls?: string[];
  created_at: string;
  is_ot?: boolean;
  is_implied_ot?: boolean;
}

interface UserProfile {
  emp_id: string;
  full_name: string;
  nickname: string;
  position: string;
  department: string;
  role: string;
  employee_level?: string;
  phone?: string;
}

export default function PublicWorklogPage() {
  const { id } = useParams<{ id: string }>();
  const [log, setLog] = useState<Worklog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [isDark, setIsDark] = useState(false); // Default to Light Mode for better readability, can toggle to Dark

  useEffect(() => {
    async function fetchWorklog() {
      if (!id) return;
      try {
        setLoading(true);
        // Query the worklog
        const { data: worklogData, error: worklogErr } = await supabase
          .from('col_worklog')
          .select('*')
          .eq('id', id)
          .single();

        if (worklogErr || !worklogData) {
          throw new Error(worklogErr?.message || 'ไม่พบข้อมูลใบงานนี้ / Worklog not found');
        }

        setLog(worklogData);

        // Fetch User profile to display operator name and employee details
        if (worklogData.user_id) {
          const { data: userData } = await supabase
            .from('users')
            .select('emp_id, full_name, nickname, position, department, role, employee_level, phone')
            .eq('id', worklogData.user_id)
            .single();
          
          if (userData) {
            setUserProfile(userData);
          }
        }
      } catch (err: any) {
        setError(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setLoading(false);
      }
    }

    fetchWorklog();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-400">กำลังโหลดรายละเอียดใบงาน...</p>
      </div>
    );
  }

  if (error || !log) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center text-rose-400 text-2xl mb-4">
          ⚠️
        </div>
        <h1 className="text-xl font-bold text-slate-200 mb-2">ไม่พบรายละเอียดใบงาน</h1>
        <p className="text-sm text-slate-400 max-w-md leading-relaxed mb-6">
          {error || 'ใบงานนี้อาจถูกลบ หรือคุณใช้ลิงก์ที่ไม่ถูกต้อง'}
        </p>
      </div>
    );
  }

  const isOtLog = log.is_ot || log.is_implied_ot;

  const profileImgUrl = userProfile?.emp_id 
    ? `${import.meta.env.VITE_HRMS_FACE_IMAGE_URL || 'https://wms.advanceagro.net/WSVIS/api/Face/GetImage?CardID='}${userProfile.emp_id}`
    : null;

  return (
    <div className={`min-h-screen py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-indigo-500 selection:text-white transition-colors duration-300 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Background gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] transition-opacity duration-300 ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-500/5'}`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] transition-opacity duration-300 ${isDark ? 'bg-teal-500/5' : 'bg-teal-500/3'}`} />
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Brand header */}
        <div className={`flex items-center justify-between mb-8 pb-6 border-b transition-colors duration-300 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-teal-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              W
            </div>
            <div>
              <span className="text-sm font-bold tracking-wider bg-gradient-to-r from-indigo-500 to-teal-500 bg-clip-text text-transparent uppercase">WORKLOG NEWGEN</span>
              <p className={`text-[10px] uppercase tracking-widest font-semibold mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>Shareable Public Reference</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Theme Toggle Button */}
            <button
              onClick={() => setIsDark(!isDark)}
              className={`p-2 rounded-xl border transition-all duration-200 hover:scale-105 mr-1 ${isDark ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-amber-400' : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700 shadow-sm'}`}
              title={isDark ? "สลับเป็นโหมดสว่าง (แนะนำสำหรับผู้บริหาร)" : "สลับเป็นโหมดมืด"}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {isOtLog && (
              <span className={`px-3 py-1 text-[11px] font-bold border rounded-full uppercase tracking-wider ${isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-500/5 text-amber-700 border-amber-500/20'}`}>
                🌟 Overtime
              </span>
            )}
            <span className={`px-3 py-1 text-[11px] font-bold border rounded-full uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-indigo-500/5 text-indigo-700 border-indigo-500/20'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
              Verified Log
            </span>
          </div>
        </div>

        {/* Premium Worklog Card */}
        <div className={`backdrop-blur-xl border rounded-3xl p-6 sm:p-8 transition-all duration-300 space-y-8 ${isDark ? 'bg-slate-900/60 border-slate-800/80 shadow-2xl' : 'bg-white border-slate-200/80 shadow-xl'}`}>
          
          {/* Section: Employee Profile Section */}
          <div className={`flex flex-col sm:flex-row items-center gap-6 p-6 border rounded-2xl relative overflow-hidden transition-colors duration-300 ${isDark ? 'bg-slate-950/40 border-slate-800/50' : 'bg-slate-50/80 border-slate-200/80 shadow-sm'}`}>
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-xl -mr-8 -mt-8 pointer-events-none ${isDark ? 'bg-indigo-500/5' : 'bg-indigo-500/10'}`}></div>
            
            {/* Profile Avatar Container */}
            <div className="w-20 h-20 shrink-0 relative">
              <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center font-bold text-white shadow-lg border border-indigo-400/20 bg-gradient-to-tr from-indigo-500 to-violet-600">
                {profileImgUrl && !imgError ? (
                  <img 
                    src={profileImgUrl} 
                    alt={userProfile?.full_name} 
                    onError={() => setImgError(true)} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl tracking-tight select-none">
                    {userProfile?.nickname?.slice(0, 2).toUpperCase() || userProfile?.full_name?.slice(0, 1) || 'E'}
                  </span>
                )}
              </div>
              
              {userProfile?.employee_level && (
                <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[8px] font-black uppercase bg-emerald-500 text-slate-950 rounded-md border border-slate-900 shadow-sm whitespace-nowrap z-10" title="Employee Level">
                  {userProfile.employee_level}
                </span>
              )}
            </div>

            <div className="flex-1 text-center sm:text-left space-y-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className={`text-xl font-black ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{userProfile?.full_name || 'Teammate'}</h2>
                {userProfile?.nickname && (
                  <span className={`px-2 py-0.5 text-[10px] font-bold border rounded-md ${isDark ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-indigo-500/5 text-indigo-700 border-indigo-500/20'}`}>
                    @{userProfile.nickname}
                  </span>
                )}
              </div>
              <p className="text-sm text-indigo-600 dark:text-indigo-400 font-bold tracking-wide uppercase">{userProfile?.position || 'ตำแหน่งงานไม่ได้ระบุ'}</p>
              
              <div className={`flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-xs md:text-sm pt-2.5 border-t mt-2 transition-colors duration-300 ${isDark ? 'text-slate-400 border-slate-800/60' : 'text-slate-600 border-slate-200'}`}>
                <span className="flex items-center gap-1">
                  <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>รหัสพนักงาน:</span> <strong className={isDark ? 'text-slate-300' : 'text-slate-800'}>{userProfile?.emp_id || 'N/A'}</strong>
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 hidden sm:inline"></span>
                <span className="flex items-center gap-1">
                  <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>สังกัดแผนก:</span> <strong className={isDark ? 'text-slate-300' : 'text-slate-800'}>{userProfile?.department || 'N/A'}</strong>
                </span>
                {userProfile?.phone && (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 hidden sm:inline"></span>
                    <span className="flex items-center gap-1">
                      <Phone size={11} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
                      <strong className={isDark ? 'text-slate-300' : 'text-slate-800'}>{userProfile.phone}</strong>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Section 1: Header Info & Work Hours details */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <span className={`px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider border rounded-md ${isDark ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' : 'bg-teal-500/5 text-teal-700 border-teal-500/20'}`}>
                {log.project_type}
              </span>
              <h1 className={`text-2xl sm:text-3xl font-black tracking-tight leading-tight mt-1.5 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{log.project_name}</h1>
              <p className={`text-xs md:text-sm mt-1.5 flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                <Briefcase size={13} className="text-indigo-500 shrink-0" />
                <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>{log.holding}</span>
                <span className="text-slate-400">•</span>
                <span>Role Mapped: {log.department_operator}</span>
              </p>
            </div>
            
            <div className={`border rounded-2xl p-4 flex items-center gap-6 shadow-inner shrink-0 justify-around sm:justify-start transition-colors duration-300 ${isDark ? 'bg-slate-950/50 border-slate-800/80' : 'bg-slate-50 border-slate-200'}`}>
              <div>
                <span className={`text-[9px] md:text-[10px] uppercase tracking-wider block font-bold mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Hours Spent</span>
                <div className="flex items-baseline">
                  <span className="text-3xl font-extrabold text-indigo-500 tracking-tight">{Number(log.total_hours).toFixed(1)}</span>
                  <span className={`text-xs ml-1 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>hrs</span>
                </div>
              </div>
              <div className={`w-px h-8 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
              <div>
                <span className={`text-[9px] md:text-[10px] uppercase tracking-wider block font-bold mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Shift Date</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <Calendar size={14} className="text-indigo-500" />
                  <span className={`text-sm font-black ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{log.work_date}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Metadata Grid */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 border rounded-2xl transition-colors duration-300 ${isDark ? 'bg-slate-950/40 border-slate-800/50' : 'bg-slate-50/80 border-slate-200'}`}>
            <div className="flex items-center gap-3 text-xs md:text-sm">
              <Layers size={18} className="text-slate-400 shrink-0" />
              <div>
                <span className={`block uppercase text-[9px] md:text-[10px] tracking-wider font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Module / Phase</span>
                <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>{log.module || '—'}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs md:text-sm">
              <Tag size={18} className="text-slate-400 shrink-0" />
              <div>
                <span className={`block uppercase text-[9px] md:text-[10px] tracking-wider font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Action / กิจกรรม</span>
                <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>{log.action_name}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs md:text-sm">
              <Clock size={18} className="text-slate-400 shrink-0" />
              <div>
                <span className={`block uppercase text-[9px] md:text-[10px] tracking-wider font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Time Range / ช่วงเวลา</span>
                <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
                  {log.start_time.slice(0, 5)} - {log.end_time.slice(0, 5)} 
                  {log.break_time ? ' (หักพักเที่ยง)' : ''}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs md:text-sm">
              <Award size={18} className="text-slate-400 shrink-0" />
              <div>
                <span className={`block uppercase text-[9px] md:text-[10px] tracking-wider font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Business Unit & Target Dept</span>
                <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>{log.bu} ({log.department})</span>
              </div>
            </div>
            {log.action_channel && (
              <div className={`flex items-center gap-3 text-xs md:text-sm sm:col-span-2 border-t pt-3 mt-1 ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
                <MessageSquare size={18} className="text-slate-400 shrink-0" />
                <div>
                  <span className={`block uppercase text-[9px] md:text-[10px] tracking-wider font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Channel / ช่องทางติดต่อ</span>
                  <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>{log.action_channel}</span>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Work Description */}
          <div className="space-y-3">
            <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <CheckCircle2 size={14} className="text-indigo-500" />
              <span>รายละเอียดการปฏิบัติงาน / Work Description</span>
            </h3>
            <div className={`p-6 rounded-2xl border text-base md:text-lg leading-relaxed md:leading-loose whitespace-pre-wrap font-sans shadow-inner transition-colors duration-300 ${isDark ? 'bg-slate-950/20 border-slate-800/80 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
              {log.description}
            </div>
          </div>

          {/* Section 4: Attached Images */}
          {log.image_urls && log.image_urls.length > 0 && (
            <div className="space-y-4">
              <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                <FileText size={14} className="text-indigo-500" />
                <span>รูปภาพประกอบใบงาน / Attached Images ({log.image_urls.length})</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {log.image_urls.map((url, idx) => (
                  <div 
                    key={idx}
                    onClick={() => setSelectedImage(url)}
                    className={`relative group aspect-video rounded-2xl overflow-hidden border cursor-pointer shadow-lg hover:border-indigo-500/50 transition-all duration-300 ${isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-100'}`}
                  >
                    <img 
                      src={url} 
                      alt={`Attachment ${idx + 1}`} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                    />
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                      <span className="px-3 py-1.5 text-xs font-bold bg-slate-900/90 text-white rounded-lg border border-slate-700 shadow-md">
                        🔍 คลิกเพื่อขยาย
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className={`mt-8 text-center text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
          <p>Worklog NewGen system is secure and verified. All logs are digitally signed by their respective creators.</p>
        </div>
      </div>

      {/* Image Modal Lightbox */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/95 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedImage(null)}
        >
          <button 
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 p-2 bg-slate-900 border border-slate-800 rounded-full hover:bg-slate-800 transition-colors text-white"
          >
            ✕
          </button>
          <img 
            src={selectedImage} 
            alt="Enlarged view" 
            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl border border-slate-800 animate-in zoom-in-95 duration-200"
          />
        </div>
      )}
    </div>
  );
}
