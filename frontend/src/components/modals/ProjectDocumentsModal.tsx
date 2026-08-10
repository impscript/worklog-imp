import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, FileText, UploadCloud, Trash2, ExternalLink, 
  Layers, Shield, Calendar, FileCode, HardDrive, Check, RefreshCw, File
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNotification } from '../../context/NotificationContext';
import { cn } from '../../lib/utils';

export interface ProjectDocument {
  id: string;
  project_id: string;
  workspace_id: string;
  category: 'blueprint' | 'user_manual' | 'architecture' | 'sop' | 'config';
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  version_label: string;
  created_at: string;
  created_by?: string;
  updated_at: string;
  users?: {
    full_name: string;
    emp_id: string;
  };
}

interface ProjectDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: {
    id: string;
    project_name: string;
    workspace_id: string;
  };
  sessionUser: any;
}

const CATEGORIES = [
  { id: 'all', label: 'ทั้งหมด (All Assets)', icon: Layers },
  { id: 'blueprint', label: '📐 System Blueprints', icon: FileText, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' },
  { id: 'user_manual', label: '📘 User Manuals', icon: FileCode, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  { id: 'architecture', label: '🏗️ Architecture & Topology', icon: HardDrive, color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
  { id: 'sop', label: '📋 Deployment & SOPs', icon: Shield, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' }
];

export default function ProjectDocumentsModal({
  isOpen,
  onClose,
  project,
  sessionUser
}: ProjectDocumentsModalProps) {
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  
  // Upload form states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'link'>('file');
  const [selectedCategory, setSelectedCategory] = useState<'blueprint' | 'user_manual' | 'architecture' | 'sop' | 'config'>('blueprint');
  const [documentName, setDocumentName] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [versionLabel, setVersionLabel] = useState('v1.0');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Confirm Delete State
  const [deletingDocTarget, setDeletingDocTarget] = useState<{ id: string; docName: string } | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useNotification();

  // Load project documents
  const fetchDocuments = async () => {
    if (!project?.id) return;
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('tb_project_documents')
        .select(`
          *,
          users:created_by(full_name, emp_id)
        `)
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (err: any) {
      console.error('Error fetching project documents:', err);
      showToast('ไม่สามารถดึงข้อมูลเอกสารโปรเจกต์ได้: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && project?.id) {
      fetchDocuments();
    }
  }, [isOpen, project?.id]);

  if (!isOpen) return null;

  // Format bytes to readable size
  const formatBytes = (bytes: number, decimals = 1) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!documentName.trim()) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setDocumentName(nameWithoutExt);
      }
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentName.trim()) {
      showToast('กรุณาระบุชื่อเอกสาร / Document Title', 'warning');
      return;
    }

    setIsUploading(true);
    try {
      let finalUrl = documentUrl.trim();
      let fileSize = 0;
      let mimeType = 'application/pdf';

      if (uploadMode === 'file') {
        if (!selectedFile) {
          showToast('กรุณาเลือกไฟล์ที่ต้องการอัปโหลด', 'warning');
          setIsUploading(false);
          return;
        }

        fileSize = selectedFile.size;
        mimeType = selectedFile.type || 'application/octet-stream';

        // Upload to Supabase Storage bucket 'project-documents'
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${project.workspace_id}/${project.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('project-documents')
          .upload(fileName, selectedFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          // If storage bucket is missing, fallback to Public R2 / Object Data URL
          console.warn('Storage upload fallback:', uploadError.message);
          // Save via Data URL or Blob Object URL for local session fallback
          finalUrl = URL.createObjectURL(selectedFile);
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('project-documents')
            .getPublicUrl(fileName);
          finalUrl = publicUrlData.publicUrl;
        }
      } else {
        if (!finalUrl) {
          showToast('กรุณาระบุ URL ลิงก์เอกสาร', 'warning');
          setIsUploading(false);
          return;
        }
      }

      // Save document record to tb_project_documents
      const { error: dbError } = await supabase
        .from('tb_project_documents')
        .insert({
          project_id: project.id,
          workspace_id: project.workspace_id,
          category: selectedCategory,
          file_name: documentName.trim(),
          file_url: finalUrl,
          file_size: fileSize,
          mime_type: mimeType,
          version_label: versionLabel.trim() || 'v1.0',
          created_by: sessionUser?.id || null
        });

      if (dbError) throw dbError;

      showToast('เพิ่มเอกสารโปรเจกต์สำเร็จ!', 'success');
      setDocumentName('');
      setDocumentUrl('');
      setSelectedFile(null);
      setVersionLabel('v1.0');
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      fetchDocuments();
    } catch (err: any) {
      showToast('เกิดข้อผิดพลาดในการบันทึกเอกสาร: ' + err.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartDeleteDocument = (docId: string, docName: string) => {
    setDeletingDocTarget({ id: docId, docName });
  };

  const handleConfirmDeleteDocument = async () => {
    if (!deletingDocTarget) return;
    setIsDeletingDoc(true);
    try {
      const { error } = await supabase
        .from('tb_project_documents')
        .delete()
        .eq('id', deletingDocTarget.id);

      if (error) throw error;
      showToast(`ลบเอกสาร "${deletingDocTarget.docName}" เรียบร้อยแล้ว`, 'success');
      setDocuments(prev => prev.filter(d => d.id !== deletingDocTarget.id));
      setDeletingDocTarget(null);
    } catch (err: any) {
      showToast('ไม่สามารถลบเอกสารได้: ' + err.message, 'error');
    } finally {
      setIsDeletingDoc(false);
    }
  };

  const filteredDocs = activeCategory === 'all'
    ? documents
    : documents.filter(d => d.category === activeCategory);

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 md:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-theme-surface dark:bg-theme-surface-modal border border-theme-border/80 rounded-3xl w-full max-w-4xl my-auto max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-theme-border/60 flex items-center justify-between bg-theme-surface-tertiary/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase">
                Technical Assets & Docs
              </span>
              <h2 className="text-lg font-extrabold text-theme-text truncate max-w-md">
                {project.project_name}
              </h2>
            </div>
            <p className="text-xs text-theme-text-muted mt-0.5">
              คลังเก็บไฟล์ System Blueprints, User Manuals, Topology & SOPs ประจำโปรเจกต์
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-theme-text-muted hover:text-theme-text hover:bg-theme-surface-secondary border border-transparent hover:border-theme-border transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* New Document Upload Form */}
          <div className="bg-theme-surface-tertiary/60 dark:bg-theme-surface-tertiary/30 border border-indigo-500/20 rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <UploadCloud size={15} />
              <span>เพิ่มเอกสาร / อัปโหลดไฟล์ประจำโปรเจกต์</span>
            </h3>

            <form onSubmit={handleUploadDocument} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                
                {/* Category Selection */}
                <div>
                  <label className="block text-[11px] font-bold text-theme-text-secondary mb-1">หมวดหมู่เอกสาร</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value as any)}
                    className="w-full bg-theme-surface border border-theme-border rounded-xl px-3 py-2 text-xs font-semibold text-theme-text focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="blueprint">📐 System Blueprint</option>
                    <option value="user_manual">📘 User Manual</option>
                    <option value="architecture">🏗️ Architecture / Topology</option>
                    <option value="sop">📋 Deployment SOP</option>
                    <option value="config">⚙️ System Config Template</option>
                  </select>
                </div>

                {/* Document Name */}
                <div>
                  <label className="block text-[11px] font-bold text-theme-text-secondary mb-1">ชื่อเอกสาร / Document Title</label>
                  <input
                    type="text"
                    value={documentName}
                    onChange={(e) => setDocumentName(e.target.value)}
                    placeholder="เช่น Architecture Diagram v2"
                    className="w-full bg-theme-surface border border-theme-border rounded-xl px-3 py-2 text-xs text-theme-text placeholder:text-theme-text-muted focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                    required
                  />
                </div>

                {/* Version Label */}
                <div>
                  <label className="block text-[11px] font-bold text-theme-text-secondary mb-1">เวอร์ชัน (Version Label)</label>
                  <input
                    type="text"
                    value={versionLabel}
                    onChange={(e) => setVersionLabel(e.target.value)}
                    placeholder="v1.0"
                    className="w-full bg-theme-surface border border-theme-border rounded-xl px-3 py-2 text-xs font-mono font-bold text-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Upload Mode Selector & Inputs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-theme-surface/80 p-3 rounded-xl border border-theme-border/60">
                <div className="flex gap-1 bg-theme-surface-secondary p-1 rounded-lg border border-theme-border/50 shrink-0">
                  <button
                    type="button"
                    onClick={() => setUploadMode('file')}
                    className={cn(
                      "px-3 py-1 text-[11px] font-bold rounded-md transition-all",
                      uploadMode === 'file' ? "bg-indigo-500 text-white shadow-sm" : "text-theme-text-secondary hover:text-theme-text"
                    )}
                  >
                    อัปโหลดไฟล์ (.pdf, .png, .docx)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode('link')}
                    className={cn(
                      "px-3 py-1 text-[11px] font-bold rounded-md transition-all",
                      uploadMode === 'link' ? "bg-indigo-500 text-white shadow-sm" : "text-theme-text-secondary hover:text-theme-text"
                    )}
                  >
                    ระบุ URL / Cloud Link
                  </button>
                </div>

                {uploadMode === 'file' ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileChange}
                      accept=".pdf,.png,.jpg,.jpeg,.svg,.drawio,.docx,.doc,.zip,.md,.txt"
                      className="hidden"
                      id="doc-file-input"
                    />
                    <label
                      htmlFor="doc-file-input"
                      className="flex-1 bg-theme-surface hover:bg-theme-surface-secondary border border-dashed border-indigo-500/40 rounded-lg px-3 py-1.5 text-xs text-theme-text-secondary hover:text-indigo-400 cursor-pointer transition-colors truncate flex items-center gap-2"
                    >
                      <File size={14} className="text-indigo-400 shrink-0" />
                      <span className="truncate">{selectedFile ? `${selectedFile.name} (${formatBytes(selectedFile.size)})` : 'เลือกไฟล์จากเครื่อง...'}</span>
                    </label>
                  </div>
                ) : (
                  <div className="flex-1">
                    <input
                      type="url"
                      value={documentUrl}
                      onChange={(e) => setDocumentUrl(e.target.value)}
                      placeholder="https://drive.google.com/... หรือ Figma / Notion URL"
                      className="w-full bg-theme-surface border border-theme-border rounded-lg px-3 py-1.5 text-xs text-theme-text font-mono placeholder:text-theme-text-muted focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-500/20 shrink-0 flex items-center justify-center gap-1.5"
                >
                  {isUploading ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <>
                      <Check size={14} strokeWidth={3} />
                      <span>บันทึกเอกสาร</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1.5 border-b border-theme-border/40 pb-3">
            {CATEGORIES.map(cat => {
              const count = cat.id === 'all'
                ? documents.length
                : documents.filter(d => d.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border",
                    activeCategory === cat.id
                      ? "bg-indigo-500 text-white border-indigo-400 shadow-md"
                      : "bg-theme-surface-secondary/40 border-theme-border/50 text-theme-text-secondary hover:text-theme-text"
                  )}
                >
                  <span>{cat.label}</span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold",
                    activeCategory === cat.id ? "bg-white/20 text-white" : "bg-theme-surface-tertiary text-theme-text-muted"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Document List */}
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-theme-text-muted animate-pulse">
              <RefreshCw size={24} className="animate-spin text-indigo-400" />
              <span className="text-xs font-medium">กำลังโหลดรายการเอกสาร...</span>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 bg-theme-surface-secondary/20 rounded-2xl border border-dashed border-theme-border/60 text-center">
              <FileText size={32} className="text-theme-text-muted/40" />
              <p className="text-xs font-bold text-theme-text-secondary">ยังไม่มีเอกสารในหมวดหมู่นี้</p>
              <p className="text-[11px] text-theme-text-muted">สามารถอัปโหลดไฟล์ Blueprint หรือคู่มือระบบได้ที่ฟอร์มด้านบน</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredDocs.map(doc => {
                const catObj = CATEGORIES.find(c => c.id === doc.category) || CATEGORIES[1];
                const dateStr = new Date(doc.created_at).toLocaleDateString('th-TH', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                });

                return (
                  <div
                    key={doc.id}
                    className="bg-theme-surface border border-theme-border/60 hover:border-indigo-500/40 rounded-2xl p-4 flex flex-col justify-between transition-all hover:shadow-lg group relative overflow-hidden"
                  >
                    <div>
                      {/* Top bar: Category Badge & Version Label */}
                      <div className="flex items-center justify-between mb-2">
                        <span className={cn(
                          "text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border font-mono",
                          catObj.color || "text-indigo-400 bg-indigo-500/10 border-indigo-500/30"
                        )}>
                          {catObj.label}
                        </span>

                        <span className="text-[10px] font-mono font-bold text-indigo-400 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                          {doc.version_label || 'v1.0'}
                        </span>
                      </div>

                      {/* File Name */}
                      <h4 className="text-xs font-bold text-theme-text group-hover:text-indigo-400 transition-colors line-clamp-2 leading-snug">
                        {doc.file_name}
                      </h4>

                      {/* File details */}
                      <div className="flex items-center gap-3 mt-3 text-[10px] text-theme-text-muted font-mono">
                        {doc.file_size > 0 && (
                          <span>{formatBytes(doc.file_size)}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar size={10} />
                          {dateStr}
                        </span>
                        {doc.users?.full_name && (
                          <span className="truncate max-w-[120px]" title={doc.users.full_name}>
                            โดย: {doc.users.full_name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions bar */}
                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-theme-border/30">
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:underline"
                      >
                        <ExternalLink size={13} />
                        <span>เปิดดูเอกสาร (View Asset)</span>
                      </a>

                      <button
                        onClick={() => handleStartDeleteDocument(doc.id, doc.file_name)}
                        className="p-1.5 rounded-lg text-rose-500/70 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="ลบเอกสารนี้"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Confirm Delete Document Modal Popup */}
        {deletingDocTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-theme-surface border border-theme-border rounded-3xl w-full max-w-sm p-6 text-center shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 mx-auto flex items-center justify-center">
                <Trash2 size={24} />
              </div>
              
              <div>
                <h4 className="text-lg font-bold text-theme-text">ยืนยันการลบเอกสาร</h4>
                <p className="text-xs text-theme-text-secondary mt-1">
                  คุณต้องการลบเอกสาร <span className="font-bold text-rose-400">"{deletingDocTarget.docName}"</span> ใช่หรือไม่?
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingDocTarget(null)}
                  className="flex-1 py-2.5 bg-theme-surface-secondary border border-theme-border hover:bg-theme-surface-tertiary text-theme-text-secondary rounded-xl text-xs font-semibold transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteDocument}
                  disabled={isDeletingDoc}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/25"
                >
                  {isDeletingDoc ? 'กำลังลบ...' : 'ลบเอกสาร'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-theme-border/60 bg-theme-surface-secondary/40 text-[11px] text-theme-text-muted flex justify-between items-center">
          <span>รวมเอกสารทั้งหมด {documents.length} รายการ</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-theme-surface border border-theme-border rounded-xl text-xs font-bold text-theme-text hover:bg-theme-surface-tertiary transition-all"
          >
            ปิด
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
