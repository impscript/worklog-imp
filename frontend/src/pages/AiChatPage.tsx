import { useState, useCallback } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { useNotification } from '../context/NotificationContext';
import { useChatSessions } from '../hooks/useChatSessions';
import { useOpenRouterModels } from '../hooks/useOpenRouterModels';
import { useChatStreaming } from '../hooks/useChatStreaming';
import { ChatSidebar } from '../components/aichat/layout/ChatSidebar';
import { ChatHeader } from '../components/aichat/layout/ChatHeader';
import { ArtifactDrawer } from '../components/aichat/layout/ArtifactDrawer';
import type { ArtifactData } from '../components/aichat/layout/ArtifactDrawer';
import { MessageFeed } from '../components/aichat/messages/MessageFeed';
import { PromptInputBar } from '../components/aichat/input/PromptInputBar';
import { ImageStudioModal } from '../components/aichat/input/ImageStudioModal';
import type { ImageStudioConfig } from '../components/aichat/input/ImageStudioModal';
import { ModelSearchModal } from '../components/aichat/modals/ModelSearchModal';
import { ApiKeySettingsModal } from '../components/aichat/modals/ApiKeySettingsModal';
import { ClearConfirmModal } from '../components/aichat/modals/ClearConfirmModal';
import { AI_SKILLS } from '../components/aichat/input/QuickToolChips';
import type { ChatAttachment } from '../lib/chat-files';
import { processChatFile } from '../lib/chat-files';
import { fetchUserWorklogContext } from '../lib/worklog-context';
import type { WorklogSummaryContext } from '../lib/worklog-context';

export default function AiChatPage() {
  const { showToast } = useNotification();

  // API Key Management (Local-First)
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('openrouter_chat_api_key') || '');

  // Hooks
  const {
    sessions,
    activeSessionId,
    activeSession,
    createSession,
    selectSession,
    deleteSession,
    togglePinSession,
    clearAllSessions,
    updateSessionMessages,
  } = useChatSessions(showToast);

  const {
    selectedModel,
    setSelectedModel,
    thinkingLevel,
    setThinkingLevel,
    fetchedModels,
    isLoadingModels,
    refreshModels,
    favoriteModelIds,
    favoriteModelsList,
    toggleFavoriteModel,
    activeModelInfo,
  } = useOpenRouterModels(showToast);

  const { isGenerating, abortGeneration, executeChatStream } = useChatStreaming(showToast);

  // Input & Tools State
  const [input, setInput] = useState<string>('');
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState<boolean>(false);
  const [webSearch, setWebSearch] = useState<boolean>(false);
  const [isDrawMode, setIsDrawMode] = useState<boolean>(false);
  const [activeSkillId, setActiveSkillId] = useState<string>('none');
  const [worklogContextData, setWorklogContextData] = useState<WorklogSummaryContext | null>(null);

  // Layout & Drawers State
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [activeArtifact, setActiveArtifact] = useState<ArtifactData | null>(null);
  const [isArtifactDrawerOpen, setIsArtifactDrawerOpen] = useState<boolean>(false);

  // Modals State
  const [isModelSearchOpen, setIsModelSearchOpen] = useState<boolean>(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
  const [isImageStudioOpen, setIsImageStudioOpen] = useState<boolean>(false);
  const [clearModalType, setClearModalType] = useState<'history' | 'key' | null>(null);

  // Image Studio Config
  const [imageStudioConfig, setImageStudioConfig] = useState<ImageStudioConfig>({
    engine: (localStorage.getItem('openrouter_draw_engine') as 'flux_cf' | 'openrouter') || 'openrouter',
    modelId: localStorage.getItem('openrouter_image_model') || 'google/gemini-3.1-flash-image',
    ratio: '1:1',
    style: 'none',
    intent: 'illustration',
  });

  const handleUpdateImageConfig = (newCfg: Partial<ImageStudioConfig>) => {
    setImageStudioConfig((prev) => {
      const next = { ...prev, ...newCfg };
      if (newCfg.engine) localStorage.setItem('openrouter_draw_engine', newCfg.engine);
      if (newCfg.modelId) localStorage.setItem('openrouter_image_model', newCfg.modelId);
      return next;
    });
  };

  const handleSaveApiKey = (newKey: string) => {
    setApiKey(newKey);
    localStorage.setItem('openrouter_chat_api_key', newKey);
    showToast('บันทึก OpenRouter API Key สำเร็จ!', 'success');
  };

  const handleClearApiKey = () => {
    setApiKey('');
    localStorage.removeItem('openrouter_chat_api_key');
    showToast('ลบ OpenRouter API Key เรียบร้อยแล้ว', 'success');
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('คัดลอกข้อความแล้ว', 'success');
  };

  // Open Canvas Artifact Preview
  const handleOpenInCanvas = (content: string, title?: string) => {
    const isImg = content.startsWith('http') || content.startsWith('data:image');
    setActiveArtifact({
      id: `art_${Date.now()}`,
      type: isImg ? 'image' : 'document',
      title: title || (isImg ? 'Image Canvas' : 'Document View'),
      content,
      timestamp: new Date().toISOString(),
    });
    setIsArtifactDrawerOpen(true);
  };

  // File Upload Handler
  const handlePickFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setIsProcessingFiles(true);
    try {
      const next: ChatAttachment[] = [...pendingAttachments];
      for (const file of Array.from(fileList).slice(0, 5)) {
        if (next.length >= 5) {
          showToast('แนบได้สูงสุด 5 ไฟล์ต่อข้อความ', 'warning');
          break;
        }
        try {
          const att = await processChatFile(file);
          next.push(att);
        } catch (err: unknown) {
          const e = err as { message?: string };
          showToast(`${file.name}: ${e?.message || 'อ่านไฟล์ไม่สำเร็จ'}`, 'error');
        }
      }
      setPendingAttachments(next);
      if (next.length > pendingAttachments.length) {
        showToast(`แนบไฟล์แล้ว ${next.length - pendingAttachments.length} รายการ`, 'success');
      }
    } finally {
      setIsProcessingFiles(false);
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Superpower: Fetch real user worklogs from Supabase
  const handleFetchWorklogContext = async () => {
    showToast('กำลังดึงประวัติ Worklog ของคุณจากฐานข้อมูล...', 'info');
    const result = await fetchUserWorklogContext('this_week');
    if (result && result.totalEntries > 0) {
      setWorklogContextData(result);
      showToast(`ดึงข้อมูลสำเร็จ: ${result.totalEntries} รายการ (${result.totalHours.toFixed(1)} ชม.)`, 'success');
    } else {
      showToast('ไม่พบข้อมูล Worklog สัปดาห์นี้ หรือยังไม่ได้ล็อกอิน', 'warning');
    }
  };

  // One-click generate image from message
  const handleGenerateImageFromText = (text: string) => {
    const clean = text
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      .replace(/```[\s\S]*?```/g, '[code]')
      .trim();
    if (!clean) return;

    setIsDrawMode(true);
    setInput(clean.slice(0, 160));
    setIsImageStudioOpen(true);
  };

  // Send Message Handler
  const handleSendMessage = useCallback(
    (customText?: string, forceDraw?: boolean) => {
      const textToSend = (customText !== undefined ? customText : input).trim();
      const currentAttachments = [...pendingAttachments];

      if (!textToSend && currentAttachments.length === 0) return;
      if (isGenerating || isProcessingFiles) return;

      const drawing = forceDraw !== undefined ? forceDraw : isDrawMode;

      // API Key check
      if ((!drawing || imageStudioConfig.engine === 'openrouter') && !apiKey.trim()) {
        showToast('กรุณากรอก OpenRouter API Key ก่อนเริ่มใช้งาน', 'warning');
        setIsApiKeyModalOpen(true);
        return;
      }

      // Ensure active session
      let targetSessionId = activeSessionId;
      if (!targetSessionId || sessions.length === 0) {
        targetSessionId = createSession(textToSend || currentAttachments[0]?.name);
      }

      const userDisplay =
        textToSend || (currentAttachments.length ? `📎 แนบ ${currentAttachments.map((a) => a.name).join(', ')}` : '');

      const userMsg = {
        role: 'user' as const,
        content: userDisplay,
        timestamp: new Date().toISOString(),
        attachmentMeta: currentAttachments.map((a) => ({
          name: a.name,
          kind: a.kind,
          summary: a.summary,
        })),
      };

      const assistantPlaceholder = {
        role: 'assistant' as const,
        content: drawing ? '⏳ กำลังสร้างรูปภาพ...' : webSearch ? '🌐 กำลังค้นหาเว็บและเรียบเรียงคำตอบ...' : 'กำลังพิมพ์...',
        timestamp: new Date().toISOString(),
      };

      // Update session with user msg + assistant placeholder
      updateSessionMessages(targetSessionId, (prev) => {
        return [...prev, userMsg, assistantPlaceholder];
      });

      // Clear input & pending attachments
      setInput('');
      setPendingAttachments([]);

      const activeSkill = AI_SKILLS.find((s) => s.id === activeSkillId);

      const existingHistory = activeSession ? activeSession.messages : [];

      executeChatStream(
        targetSessionId,
        textToSend,
        existingHistory,
        {
          apiKey,
          selectedModel,
          thinkingLevel,
          webSearch,
          activeSkillSystemPrompt: activeSkill?.systemPrompt,
          worklogContextMarkdown: worklogContextData?.markdownSummary,
          attachments: currentAttachments,
          isDrawMode: drawing,
          drawEngine: imageStudioConfig.engine,
          drawModelId: imageStudioConfig.modelId,
          drawRatio: imageStudioConfig.ratio,
          drawStyle: imageStudioConfig.style,
          drawIntent: imageStudioConfig.intent,
          drawSourceText: textToSend,
        },
        (updater) => {
          updateSessionMessages(targetSessionId!, updater);
        },
        () => {
          // Finished
        }
      );
    },
    [
      input,
      pendingAttachments,
      isGenerating,
      isProcessingFiles,
      isDrawMode,
      imageStudioConfig,
      apiKey,
      activeSessionId,
      sessions,
      createSession,
      updateSessionMessages,
      activeSkillId,
      activeSession,
      executeChatStream,
      selectedModel,
      thinkingLevel,
      webSearch,
      worklogContextData,
      showToast,
    ]
  );

  // Regenerate last assistant response
  const handleRegenerateLast = () => {
    if (!activeSession || activeSession.messages.length < 2 || isGenerating) return;
    const msgs = activeSession.messages;
    const lastUserIdx = msgs.map((m) => m.role).lastIndexOf('user');
    if (lastUserIdx === -1) return;

    const lastUserMsg = msgs[lastUserIdx];
    // Remove messages after lastUserIdx
    updateSessionMessages(activeSession.id, () => msgs.slice(0, lastUserIdx));
    handleSendMessage(lastUserMsg.content);
  };

  const handleEditPrompt = (content: string) => {
    setInput(content);
  };

  const activePlaceholder = AI_SKILLS.find((s) => s.id === activeSkillId)?.placeholder;

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-7rem)] w-full overflow-hidden rounded-3xl border border-theme-border/60 bg-theme-surface/40 dark:bg-theme-bg-page/20 backdrop-blur-xl shadow-xl relative">
        {/* LEFT COLUMN: Collapsible Sidebar */}
        <ChatSidebar
          isOpen={isSidebarOpen}
          onToggleOpen={() => setIsSidebarOpen((v) => !v)}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={selectSession}
          onCreateNewChat={() => createSession()}
          onDeleteSession={(id, e) => {
            e.stopPropagation();
            deleteSession(id);
          }}
          onTogglePinSession={togglePinSession}
          onOpenClearModal={(type) => setClearModalType(type)}
          onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
          hasApiKey={!!apiKey.trim()}
        />

        {/* CENTER COLUMN: Chat Stream & Prompt Bar */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-transparent">
          {/* Header */}
          <ChatHeader
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen((v) => !v)}
            onOpenMobileHistory={() => setIsMobileSidebarOpen(true)}
            activeModelInfo={activeModelInfo}
            selectedModel={selectedModel}
            onSelectModel={setSelectedModel}
            favoriteModelsList={favoriteModelsList}
            thinkingLevel={thinkingLevel}
            onChangeThinkingLevel={setThinkingLevel}
            onOpenModelSearch={() => setIsModelSearchOpen(true)}
            onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
            hasArtifacts={!!activeArtifact}
            isArtifactDrawerOpen={isArtifactDrawerOpen}
            onToggleArtifactDrawer={() => setIsArtifactDrawerOpen((v) => !v)}
          />

          {/* Messages Feed */}
          <MessageFeed
            messages={activeSession ? activeSession.messages : []}
            isStreaming={isGenerating}
            hasApiKey={!!apiKey.trim()}
            onSendQuickPrompt={handleSendMessage}
            onCopyText={handleCopyText}
            onRegenerateLast={handleRegenerateLast}
            onEditPrompt={handleEditPrompt}
            onGenerateImageFromText={handleGenerateImageFromText}
            onOpenInCanvas={handleOpenInCanvas}
            onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
            onFetchWorklogSummary={() => {
              handleFetchWorklogContext();
              handleSendMessage(
                'ช่วยสรุปประวัติการลงเวลา Worklog ของฉันในรอบสัปดาห์นี้ให้เป็นรายงานผลงานประจำวันแบบมืออาชีพ'
              );
            }}
          />

          {/* Bottom Floating Prompt Input Bar */}
          <PromptInputBar
            input={input}
            setInput={setInput}
            isGenerating={isGenerating}
            onSendMessage={() => handleSendMessage()}
            onAbortGeneration={abortGeneration}
            attachments={pendingAttachments}
            onPickFiles={handlePickFiles}
            onRemoveAttachment={handleRemoveAttachment}
            isProcessingFiles={isProcessingFiles}
            webSearch={webSearch}
            onToggleWebSearch={() => setWebSearch((v) => !v)}
            isDrawMode={isDrawMode}
            onToggleDrawMode={() => setIsDrawMode((v) => !v)}
            onOpenImageStudio={() => setIsImageStudioOpen(true)}
            hasWorklogContext={!!worklogContextData}
            onFetchWorklogContext={handleFetchWorklogContext}
            onClearWorklogContext={() => {
              setWorklogContextData(null);
              showToast('ยกเลิกการแนบข้อมูล Worklog แล้ว', 'info');
            }}
            activeSkillId={activeSkillId}
            onSelectSkill={setActiveSkillId}
            placeholder={activePlaceholder}
          />
        </div>

        {/* RIGHT COLUMN: Artifact / Canvas Side Drawer */}
        <ArtifactDrawer
          isOpen={isArtifactDrawerOpen}
          onClose={() => setIsArtifactDrawerOpen(false)}
          artifact={activeArtifact}
        />
      </div>

      {/* MODALS */}
      {/* Model Search Modal */}
      <ModelSearchModal
        isOpen={isModelSearchOpen}
        onClose={() => setIsModelSearchOpen(false)}
        models={fetchedModels}
        isLoading={isLoadingModels}
        onRefresh={refreshModels}
        onSelectModel={setSelectedModel}
        favoriteModelIds={favoriteModelIds}
        onToggleFavorite={toggleFavoriteModel}
      />

      {/* API Key Settings Modal */}
      <ApiKeySettingsModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
        onClearApiKey={handleClearApiKey}
      />

      {/* Image Studio Config Modal */}
      <ImageStudioModal
        isOpen={isImageStudioOpen}
        onClose={() => setIsImageStudioOpen(false)}
        config={imageStudioConfig}
        onChangeConfig={handleUpdateImageConfig}
        hasApiKey={!!apiKey.trim()}
      />

      {/* Custom Confirm Clear Modal (AGENTS.md rule: NO native browser alerts/confirms) */}
      <ClearConfirmModal
        isOpen={clearModalType !== null}
        type={clearModalType}
        onClose={() => setClearModalType(null)}
        onConfirm={() => {
          if (clearModalType === 'history') {
            clearAllSessions();
          } else if (clearModalType === 'key') {
            handleClearApiKey();
          }
        }}
      />
    </AppLayout>
  );
}
