import React, { useState, useRef } from 'react';
import {
  Globe,
  ImagePlus,
  Loader2,
  Lock,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import ModalPortal from '../modals/ModalPortal';
import { supabase } from '../../lib/supabase';
import { useNotification } from '../../context/NotificationContext';
import {
  createDefaultDossierConfig,
  type DossierAccentTheme,
  type DossierFeaturedProject,
  type DossierTrackMode,
  type UserDossierConfig,
} from '../../lib/dossier-types';

export interface DossierEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  initialConfig: UserDossierConfig | null;
  availableProjects: string[];
  onSaved: (saved: UserDossierConfig) => void;
}

const ACCENT_OPTIONS: { id: DossierAccentTheme; label: string; dotClass: string }[] = [
  { id: 'indigo', label: 'Indigo Executive', dotClass: 'bg-indigo-600' },
  { id: 'emerald', label: 'Emerald Growth', dotClass: 'bg-emerald-600' },
  { id: 'cyan', label: 'Cyan Tech', dotClass: 'bg-cyan-600' },
  { id: 'violet', label: 'Violet Creative', dotClass: 'bg-violet-600' },
];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

async function uploadDossierImage(userId: string, file: File, folder: 'hero' | 'projects'): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('กรุณาเลือกไฟล์รูปภาพ (JPG, PNG, WebP) เท่านั้น');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('ขนาดรูปภาพต้องไม่เกิน 5 MB');
  }
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const filePath = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from('dossier-assets')
    .upload(filePath, file, { upsert: true, contentType: file.type });

  if (uploadErr) {
    throw new Error(uploadErr.message);
  }

  const { data } = supabase.storage.from('dossier-assets').getPublicUrl(filePath);
  return data.publicUrl;
}

const DossierEditorModalContent: React.FC<Omit<DossierEditorModalProps, 'isOpen'>> = ({
  onClose,
  userId,
  userName,
  initialConfig,
  availableProjects,
  onSaved,
}) => {
  const { showToast } = useNotification();
  const base = initialConfig || createDefaultDossierConfig(userId);

  const [isPublic, setIsPublic] = useState<boolean>(base.is_public);
  const [trackMode, setTrackMode] = useState<DossierTrackMode>(base.track_mode);
  const [targetRole, setTargetRole] = useState<string>(base.target_role || '');
  const [accentTheme, setAccentTheme] = useState<DossierAccentTheme>(base.accent_theme || 'indigo');
  const [headline, setHeadline] = useState<string>(base.headline || '');
  const [bio, setBio] = useState<string>(base.bio || '');
  const [heroImageUrl, setHeroImageUrl] = useState<string>(base.hero_image_url || '');
  const [featuredProjects, setFeaturedProjects] = useState<DossierFeaturedProject[]>(
    Array.isArray(base.featured_projects) ? base.featured_projects : []
  );
  const [supervisorQuote, setSupervisorQuote] = useState<string>(base.supervisor_quote || '');
  const [supervisorName, setSupervisorName] = useState<string>(base.supervisor_name || '');
  const [supervisorTitle, setSupervisorTitle] = useState<string>(base.supervisor_title || '');

  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const heroInputRef = useRef<HTMLInputElement>(null);

  const handleUploadHero = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingKey('hero');
    try {
      const url = await uploadDossierImage(userId, file, 'hero');
      setHeroImageUrl(url);
      showToast('อัปโหลดรูปโปรไฟล์เรียบร้อยแล้ว', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'อัปโหลดรูปไม่สำเร็จ';
      showToast(`อัปโหลดรูปไม่สำเร็จ: ${msg}`, 'error', 5000);
    } finally {
      setUploadingKey(null);
    }
  };

  const handleUploadProjectImage = async (projectId: string, file: File) => {
    setUploadingKey(projectId);
    try {
      const url = await uploadDossierImage(userId, file, 'projects');
      setFeaturedProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, image_url: url } : p))
      );
      showToast('อัปโหลดรูปภาพผลงานเรียบร้อยแล้ว', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'อัปโหลดรูปไม่สำเร็จ';
      showToast(`อัปโหลดรูปไม่สำเร็จ: ${msg}`, 'error', 5000);
    } finally {
      setUploadingKey(null);
    }
  };

  const handleAddFeaturedProject = (presetName?: string) => {
    const chosen = presetName || availableProjects[0] || '';
    setFeaturedProjects((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        project_name: chosen,
        title: chosen,
        category: '',
        summary: '',
        impact_metric: '',
        image_url: '',
        live_url: '',
      },
    ]);
  };

  const handleUpdateProject = (id: string, patch: Partial<DossierFeaturedProject>) => {
    setFeaturedProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const handleRemoveProject = (id: string) => {
    setFeaturedProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const cleanProjects = featuredProjects
        .map((p) => ({
          ...p,
          project_name: p.project_name.trim(),
          title: (p.title || p.project_name).trim(),
          category: (p.category || '').trim(),
          summary: p.summary.trim(),
          impact_metric: (p.impact_metric || '').trim(),
          image_url: (p.image_url || '').trim(),
          live_url: (p.live_url || '').trim(),
        }))
        .filter((p) => p.title.length > 0 || p.project_name.length > 0);

      const payload: UserDossierConfig = {
        user_id: userId,
        is_public: isPublic,
        track_mode: trackMode,
        target_role: targetRole.trim(),
        accent_theme: accentTheme,
        headline: headline.trim(),
        bio: bio.trim(),
        hero_image_url: heroImageUrl.trim(),
        featured_projects: cleanProjects,
        supervisor_quote: supervisorQuote.trim(),
        supervisor_name: supervisorName.trim(),
        supervisor_title: supervisorTitle.trim(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('tb_user_dossier')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) {
        if (error.message.includes('tb_user_dossier') || error.code === '42P01') {
          throw new Error('ยังไม่ได้รัน SQL migration สร้างตาราง tb_user_dossier บน Supabase');
        }
        throw new Error(error.message);
      }

      showToast('บันทึกการปรับแต่ง Portfolio เรียบร้อยแล้ว', 'success');
      onSaved(payload);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถบันทึกข้อมูลได้';
      showToast(msg, 'error', 6000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto">
        <div className="w-full max-w-3xl my-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden text-slate-900 dark:text-white">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/70 via-white to-cyan-50/50 dark:from-indigo-950/30 dark:via-slate-900 dark:to-cyan-950/20 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-cyan-600 text-white flex items-center justify-center shadow-md shrink-0">
                <Sparkles size={19} />
              </div>
              <div>
                <h3 className="text-base font-extrabold tracking-tight">
                  Personal Portfolio Studio
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ปรับแต่งแฟ้มผลงาน โทนสี และอัปโหลดรูปภาพผลงานของ {userName}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
            {/* 1. Visibility, Track Mode & Theme */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 space-y-2.5">
                <label className="text-xs font-bold block">สถานะการเข้าถึง (Visibility)</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPublic(true)}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      isPublic
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                        : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Globe size={13} />
                    <span>Public (เปิดแชร์)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPublic(false)}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      !isPublic
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                        : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Lock size={13} />
                    <span>Private</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 space-y-2.5">
                <label className="text-xs font-bold block">รูปแบบแฟ้มผลงาน (Track Mode)</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTrackMode('career_review')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                      trackMode === 'career_review'
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700'
                        : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Career Review (ทั่วไป)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrackMode('promotion_track')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                      trackMode === 'promotion_track'
                        ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700'
                        : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Promotion Track
                  </button>
                </div>
              </div>
            </div>

            {trackMode === 'promotion_track' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold">ตำแหน่งเป้าหมาย (Target Role)</label>
                <input
                  type="text"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="เช่น Senior Specialist, Section Manager, Department Manager"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            )}

            {/* Accent Theme */}
            <div className="space-y-2">
              <label className="text-xs font-bold block">โทนสีหลัก (Editorial Accent Theme)</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ACCENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAccentTheme(opt.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-all ${
                      accentTheme === opt.id
                        ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full ${opt.dotClass}`} />
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Hero Headline, Bio & Custom Photo */}
            <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/70">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Hero Narrative &amp; Profile Photo
                </span>
                <div>
                  <input
                    ref={heroInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleUploadHero}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => heroInputRef.current?.click()}
                    disabled={uploadingKey === 'hero'}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 cursor-pointer disabled:opacity-50"
                  >
                    {uploadingKey === 'hero' ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    <span>{heroImageUrl ? 'เปลี่ยนรูปโปรไฟล์ใหม่' : 'อัปโหลดรูปโปรไฟล์เอง (ไม่บังคับ)'}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Headline / สโลแกนการทำงาน (ไม่บังคับ — ถ้าว่างระบบสร้างให้อัตโนมัติ)
                </label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="เช่น Project Lead Process Improvement — ขับเคลื่อนระบบดิจิทัลและ AI ลดงานซ้ำซ้อน"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  บทสรุปตัวตนและเป้าหมายงาน (Bio / Executive Summary)
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="สรุปจุดเด่น ภารกิจหลัก และผลลัพธ์ที่ภูมิใจในรอบปีนี้..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 resize-y"
                />
              </div>
            </div>

            {/* 3. Featured Projects + Image Uploader */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    ไฮไลต์ผลงาน &amp; รูปภาพประกอบ (Featured Projects)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    เพิ่มการ์ดโครงการเด่นพร้อมอัปโหลดภาพหน้าจอ/ผลงาน (ไม่เกิน 5 MB)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddFeaturedProject()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 cursor-pointer"
                >
                  <Plus size={13} />
                  <span>เพิ่มการ์ดผลงาน</span>
                </button>
              </div>

              {featuredProjects.length === 0 ? (
                <div className="p-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500">
                  ยังไม่มีการ์ดไฮไลต์ — ระบบจะแสดงรายการโครงการจากบันทึก Worklog ให้อัตโนมัติ หรือกด &quot;เพิ่มการ์ดผลงาน&quot; เพื่อแนบรูปภาพผลงาน
                </div>
              ) : (
                <div className="space-y-3">
                  {featuredProjects.map((proj, idx) => (
                    <div
                      key={proj.id}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          ผลงานเด่น #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveProject(proj.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          title="ลบการ์ดนี้"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-500">ชื่อโครงการ (เลือกหรือพิมพ์)</label>
                          <input
                            type="text"
                            list={`dossier-projects-${proj.id}`}
                            value={proj.project_name}
                            onChange={(e) =>
                              handleUpdateProject(proj.id, {
                                project_name: e.target.value,
                                title: proj.title || e.target.value,
                              })
                            }
                            placeholder="เช่น 304IP CRM Sales"
                            className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                          />
                          <datalist id={`dossier-projects-${proj.id}`}>
                            {availableProjects.map((name) => (
                              <option key={name} value={name} />
                            ))}
                          </datalist>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-500">หัวข้อแสดงบนการ์ด</label>
                          <input
                            type="text"
                            value={proj.title}
                            onChange={(e) => handleUpdateProject(proj.id, { title: e.target.value })}
                            placeholder="เช่น ระบบ CRM บริหารงานขายและติดตามลูกค้า"
                            className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-500">หมวดหมู่ / เสาหลัก</label>
                          <input
                            type="text"
                            value={proj.category || ''}
                            onChange={(e) => handleUpdateProject(proj.id, { category: e.target.value })}
                            placeholder="เช่น Digital Automation, CRM, ERP"
                            className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-500">ตัวเลขผลลัพธ์ (Impact Metric)</label>
                          <input
                            type="text"
                            value={proj.impact_metric || ''}
                            onChange={(e) => handleUpdateProject(proj.id, { impact_metric: e.target.value })}
                            placeholder="เช่น ลดเวลางาน 40 ชม./เดือน"
                            className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-500">สรุปผลงานและสิ่งที่ทำ</label>
                        <textarea
                          rows={2}
                          value={proj.summary}
                          onChange={(e) => handleUpdateProject(proj.id, { summary: e.target.value })}
                          placeholder="อธิบายปัญหาเดิม สิ่งที่พัฒนา และผลลัพธ์ที่ได้..."
                          className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 resize-y"
                        />
                      </div>

                      {/* Project Screenshot Uploader + Preview */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                        <div className="flex items-center gap-3">
                          {proj.image_url ? (
                            <img
                              src={proj.image_url}
                              alt={proj.title || 'Preview'}
                              className="w-20 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                            />
                          ) : (
                            <div className="w-20 h-12 rounded-lg bg-slate-200/70 dark:bg-slate-700/60 flex items-center justify-center text-slate-400">
                              <ImagePlus size={16} />
                            </div>
                          )}
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 cursor-pointer">
                            {uploadingKey === proj.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <ImagePlus size={12} />
                            )}
                            <span>{proj.image_url ? 'เปลี่ยนรูปผลงาน' : 'อัปโหลดรูปผลงาน'}</span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              disabled={uploadingKey === proj.id}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = '';
                                if (file) handleUploadProjectImage(proj.id, file);
                              }}
                            />
                          </label>
                        </div>

                        <input
                          type="url"
                          value={proj.live_url || ''}
                          onChange={(e) => handleUpdateProject(proj.id, { live_url: e.target.value })}
                          placeholder="ลิงก์ระบบจริง (ถ้ามี https://...)"
                          className="w-full sm:w-56 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Optional Supervisor Quote */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/70 space-y-2.5">
              <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                คำรับรองจากหัวหน้างาน (ไม่บังคับ)
              </span>
              <textarea
                rows={2}
                value={supervisorQuote}
                onChange={(e) => setSupervisorQuote(e.target.value)}
                placeholder="เช่น สามารถบริหารโครงการได้ด้วยตนเองอย่างเป็นระบบ และนำ AI มาลดเวลางานทีมได้จริง..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={supervisorName}
                  onChange={(e) => setSupervisorName(e.target.value)}
                  placeholder="ชื่อหัวหน้างาน (เช่น ชัชวาลย์ ตุลาผล)"
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <input
                  type="text"
                  value={supervisorTitle}
                  onChange={(e) => setSupervisorTitle(e.target.value)}
                  placeholder="ตำแหน่งหัวหน้างาน (เช่น Section Manager)"
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || uploadingKey !== null}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>บันทึก Portfolio</span>
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export const DossierEditorModal: React.FC<DossierEditorModalProps> = (props) => {
  if (!props.isOpen) return null;
  return (
    <DossierEditorModalContent
      key={`${props.userId}-${props.initialConfig?.updated_at || 'new'}`}
      {...props}
    />
  );
};

export default DossierEditorModal;
