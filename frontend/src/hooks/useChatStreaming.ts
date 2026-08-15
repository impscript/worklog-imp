import { useState, useRef, useCallback } from 'react';
import type { Message } from './useChatSessions';
import type { ChatAttachment } from '../lib/chat-files';
import {
  stripHeavyMediaFromText,
  buildMessageContentParts,
  attachmentsNeedVision,
  suggestVisionChatModel,
  isRetiredChatModel,
  chatModelFallbackChain,
  DEFAULT_FREE_CHAT_MODEL,
  normalizeImageForChat,
} from '../lib/chat-files';
import type { ThinkingLevel } from './useOpenRouterModels';

export interface SendMessageOptions {
  apiKey: string;
  selectedModel: string;
  thinkingLevel: ThinkingLevel;
  webSearch: boolean;
  activeSkillSystemPrompt?: string;
  worklogContextMarkdown?: string;
  attachments?: ChatAttachment[];
  // Image generation params
  isDrawMode?: boolean;
  drawEngine?: 'flux_cf' | 'openrouter';
  drawModelId?: string;
  drawRatio?: string;
  drawStyle?: string;
  drawIntent?: 'illustration' | 'infographic' | 'thai_text';
  drawSourceText?: string;
}

interface ChatMessagePayload {
  role: string;
  content: unknown;
}

export function useChatStreaming(showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void) {
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const abortGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
      showToast?.('หยุดการสร้างข้อความแล้ว', 'info');
    }
  }, [showToast]);

  // Clean prompt for Flux vs Banana Image Models
  const buildImagePrompt = async (
    userInstruction: string,
    sourceContent: string,
    intent: 'illustration' | 'infographic' | 'thai_text',
    keepThai: boolean,
    apiKey: string,
    activeModel: string
  ): Promise<string> => {
    const sourceBlock = sourceContent.trim()
      ? `\n\n--- SOURCE CONTENT (facts / copy to visualize) ---\n${sourceContent.slice(0, 3500)}\n---`
      : '';

    let systemBrief: string;
    if (intent === 'infographic') {
      systemBrief = keepThai
        ? `You design prompts for an AI image model that CAN render Thai text accurately.
Write ONE detailed image-generation prompt for a clean corporate infographic poster.
Rules:
- Vertical or clear section layout, flat design, large readable titles, icons, whitespace
- Include EXACT Thai (and English if needed) strings that must appear on the image, in quotes
- Max 5 short sections; no tiny paragraph text
- Specify colors, hierarchy (title → sections → footer warning if any)
- Output ONLY the prompt, no markdown fences or intro`
        : `You design prompts for Flux-style models that are WEAK at text.
Write ONE detailed English image prompt for an infographic-style illustration WITHOUT relying on readable body text.
Use icons, shapes, color blocks, big short English labels only (3-5 words max per label).
Output ONLY the prompt.`;
    } else if (intent === 'thai_text' || keepThai) {
      systemBrief = `You design prompts for an AI image model that CAN render Thai text.
Write ONE detailed image-generation prompt. Keep any Thai labels exactly as the user needs them (in quotes).
Describe layout, style, lighting. Output ONLY the prompt.`;
    } else {
      systemBrief = `Translate/expand into a detailed English image prompt for Flux. No Thai characters. Output ONLY the prompt.`;
    }

    const userMsg = `${systemBrief}\n\nUser request: ${userInstruction}${sourceBlock}`;

    if (apiKey.trim()) {
      const modelsToTry = [
        activeModel,
        'google/gemini-2.5-flash',
        'google/gemini-2.5-flash-lite',
        DEFAULT_FREE_CHAT_MODEL,
      ];
      for (const model of modelsToTry) {
        try {
          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'HTTP-Referer': window.location.origin,
              'X-Title': 'Worklog AI Image Prompt Builder',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: userMsg }],
              temperature: 0.4,
              max_tokens: intent === 'infographic' ? 600 : 280,
            }),
          });
          if (!response.ok) continue;
          const data = await response.json();
          const raw = data.choices?.[0]?.message?.content?.trim();
          if (!raw) continue;
          const cleaned = raw.replace(/^```[\w]*\n?|\n?```$/g, '').replace(/^["']|["']$/g, '').trim();
          if (!keepThai && /[\u0e00-\u0e7f]/.test(cleaned)) continue;
          if (cleaned.length > 20) return cleaned;
        } catch {
          /* try next */
        }
      }
    }

    if (sourceContent.trim()) {
      return `${userInstruction}\n\nContent to visualize:\n${sourceContent.slice(0, 1200)}`;
    }
    return userInstruction;
  };

  const executeChatStream = async (
    _sessionId: string,
    userPromptText: string,
    existingMessages: Message[],
    options: SendMessageOptions,
    onUpdateMessages: (updater: (prev: Message[]) => Message[]) => void,
    onFinish: () => void
  ) => {
    const {
      apiKey,
      selectedModel,
      thinkingLevel,
      webSearch,
      activeSkillSystemPrompt,
      worklogContextMarkdown,
      attachments = [],
      isDrawMode = false,
      drawEngine = 'openrouter',
      drawModelId = 'google/gemini-3.1-flash-image',
      drawRatio = '1:1',
      drawStyle = 'none',
      drawIntent = 'illustration',
      drawSourceText = '',
    } = options;

    setIsGenerating(true);
    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    // --- CASE 1: IMAGE GENERATION WORKFLOW ---
    if (isDrawMode) {
      const willUseOpenRouter = drawEngine === 'openrouter';
      if (willUseOpenRouter && !apiKey.trim()) {
        showToast?.('โหมดสร้างภาพแบบคมชัด ต้องมี OpenRouter API Key', 'warning');
        setIsGenerating(false);
        return;
      }

      const keepThai = willUseOpenRouter;

      try {
        let finalPrompt = await buildImagePrompt(
          userPromptText,
          drawSourceText,
          drawIntent,
          keepThai,
          apiKey,
          selectedModel
        );

        if (drawStyle && drawStyle !== 'none') {
          finalPrompt += `, in ${drawStyle} style, high resolution, 8k`;
        }

        if (drawEngine === 'openrouter') {
          // OpenRouter Image API
          const imageRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'HTTP-Referer': window.location.origin,
              'X-Title': 'Worklog AI Image Generator',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: drawModelId,
              messages: [{ role: 'user', content: finalPrompt }],
            }),
            signal: abortCtrl.signal,
          });

          if (!imageRes.ok) {
            const errData = await imageRes.json().catch(() => ({}));
            throw new Error(errData?.error?.message || `HTTP ${imageRes.status}`);
          }

          const resData = await imageRes.json();
          const assistantReply = resData.choices?.[0]?.message?.content || '';
          let imageUrl = '';

          const match = assistantReply.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/);
          if (match) {
            imageUrl = match[1];
          } else if (assistantReply.startsWith('http')) {
            imageUrl = assistantReply.trim();
          }

          if (!imageUrl && resData.choices?.[0]?.message?.image_url) {
            imageUrl = resData.choices[0].message.image_url;
          }

          if (!imageUrl) {
            imageUrl = assistantReply;
          }

          const imageMarkdown = `![${userPromptText.replace(/[\r\n]+/g, ' ').slice(0, 60)}](${imageUrl})`;

          onUpdateMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = {
              role: 'assistant',
              content: imageMarkdown,
              timestamp: new Date().toISOString(),
              modelUsed: drawModelId,
            };
            return copy;
          });
          showToast?.('สร้างรูปภาพสำเร็จ!', 'success');
        } else {
          // Free Cloudflare Flux Worker
          const fluxRes = await fetch('https://flux-image-generator.play2earn.workers.dev/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: finalPrompt,
              steps: 4,
              aspectRatio: drawRatio,
            }),
            signal: abortCtrl.signal,
          });

          if (!fluxRes.ok) {
            throw new Error(`Flux error (${fluxRes.status})`);
          }

          const blob = await fluxRes.blob();
          const compressedDataUrl = await normalizeImageForChat(blob);
          const imageMarkdown = `![${userPromptText.replace(/[\r\n]+/g, ' ').slice(0, 60)}](${compressedDataUrl})`;

          onUpdateMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = {
              role: 'assistant',
              content: imageMarkdown,
              timestamp: new Date().toISOString(),
              modelUsed: 'flux-cloudflare',
            };
            return copy;
          });
          showToast?.('สร้างรูปภาพสำเร็จด้วย Flux ฟรี!', 'success');
        }
      } catch (err: unknown) {
        const e = err as { name?: string; message?: string };
        if (e.name === 'AbortError') {
          showToast?.('ยกเลิกการสร้างรูปภาพแล้ว', 'info');
        } else {
          console.error('Image gen failed:', err);
          showToast?.(`สร้างรูปภาพไม่สำเร็จ: ${e.message || 'Error'}`, 'error');
          onUpdateMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = {
              role: 'assistant',
              content: `❌ สร้างรูปไม่สำเร็จ\n\nสาเหตุ: ${e.message || 'Error'}\n\nคำแนะนำ: ตรวจสอบ API Key หรือสลับไปใช้「ฟรี · Flux」`,
              timestamp: new Date().toISOString(),
              isError: true,
            };
            return copy;
          });
        }
      } finally {
        setIsGenerating(false);
        onFinish();
      }
      return;
    }

    // --- CASE 2: TEXT & MULTIMODAL COMPLETIONS ---
    let requestModel = selectedModel;
    try {
      // Build conversation history (stripping oversized media)
      const historyMsgs = existingMessages.map((m) => {
        let content = stripHeavyMediaFromText(m.content);
        if (m.role === 'assistant') {
          content = content.replace(/!\[[^\]]*\]\(data:image\/[^)]+\)/g, '![Image](generated image omitted)');
        }
        return { role: m.role, content };
      });

      // Multimodal payload for the last user prompt if files attached
      const userContentParts = buildMessageContentParts(userPromptText || 'โปรดวิเคราะห์ไฟล์แนบ', attachments);
      const messagesToSend: ChatMessagePayload[] = [
        ...historyMsgs,
        { role: 'user', content: userContentParts },
      ];

      // System Prompts & Skills injection
      if (activeSkillSystemPrompt) {
        messagesToSend.unshift({ role: 'system', content: activeSkillSystemPrompt });
      }

      if (worklogContextMarkdown) {
        messagesToSend.unshift({
          role: 'system',
          content: `บริบทข้อมูล Worklog ของผู้ใช้จากฐานข้อมูล:\n${worklogContextMarkdown}\nโปรดใช้ข้อมูลนี้ในการตอบคำถาม วิเคราะห์ หรือสรุปงานตามที่ผู้ใช้ร้องขอ`,
        });
      }

      if (attachments.some((a) => a.textContent)) {
        messagesToSend.unshift({
          role: 'system',
          content:
            'The user attached documents (PDF/Excel/CSV/text). Base answers accurately on the provided extract. Prefer Thai responses.',
        });
      }

      if (webSearch) {
        messagesToSend.unshift({
          role: 'system',
          content:
            'You have access to real-time web search. Cite sources with markdown links. Prefer concise Thai answers.',
        });
      }

      // Add identity prompt
      messagesToSend.unshift({
        role: 'system',
        content: `You are an AI assistant executing via model ID "${requestModel}" on OpenRouter API. Respond in Thai when the user writes in Thai. Format responses in clean Markdown with appropriate headings and tables where helpful.`,
      });

      // Model Resolution
      if (attachmentsNeedVision(attachments)) {
        const suggested = suggestVisionChatModel(requestModel);
        if (suggested) {
          requestModel = suggested;
          showToast?.(`แนบรูป: สลับใช้โมเดล Vision (${suggested})`, 'info');
        }
      } else if (isRetiredChatModel(requestModel)) {
        requestModel = DEFAULT_FREE_CHAT_MODEL;
      }

      const buildRequestBody = (modelId: string, searchTool: boolean) => {
        const body: Record<string, unknown> = {
          model: modelId,
          messages: messagesToSend,
          stream: true,
        };

        const isReasoningCapable =
          /deepseek|r1\b|o1\b|o3\b|o4\b|claude-3\.7|sonar-reasoning/.test(modelId.toLowerCase()) ||
          thinkingLevel === 'high';

        if (isReasoningCapable) {
          body.reasoning = { effort: thinkingLevel };
        }

        if (thinkingLevel === 'low') {
          body.temperature = 0.3;
        } else if (thinkingLevel === 'high') {
          body.temperature = 0.7;
        }

        if (searchTool) {
          body.tools = [
            {
              type: 'openrouter:web_search',
              parameters: {
                engine: 'auto',
                max_results: 5,
                max_uses: 3,
              },
            },
          ];
        }
        return body;
      };

      const openRouterHeaders = {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Worklog AI Chat',
        'Content-Type': 'application/json',
      };

      // Fallback chain loop
      const modelsToTry = chatModelFallbackChain(requestModel);
      let response: Response | null = null;
      let lastErrMsg = '';

      for (const candidateModel of modelsToTry) {
        requestModel = candidateModel;
        try {
          response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: openRouterHeaders,
            body: JSON.stringify(buildRequestBody(candidateModel, webSearch)),
            signal: abortCtrl.signal,
          });

          if (response.ok) break;

          const errData = await response.json().catch(() => ({}));
          lastErrMsg = errData?.error?.message || `API Error (${response.status})`;

          if (!/no endpoints found|not found|unavailable/i.test(lastErrMsg) && response.status !== 404) {
            throw new Error(lastErrMsg);
          }
          response = null;
        } catch (e: unknown) {
          const errObj = e as { name?: string; message?: string };
          if (errObj.name === 'AbortError') throw e;
          lastErrMsg = errObj.message || 'Connection error';
        }
      }

      if (!response || !response.ok) {
        throw new Error(lastErrMsg || 'ไม่สามารถเชื่อมต่อโมเดลได้ กรุณาตรวจสอบ API Key หรือเครือข่าย');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Response stream is not readable');

      const decoder = new TextDecoder();
      let assistantContent = '';
      let reasoningContent = '';
      let thinkingStartTime: number | null = null;
      let thinkingDuration = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((l) => l.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') break;

            try {
              const data = JSON.parse(dataStr);
              const delta = data.choices?.[0]?.delta;
              if (!delta) continue;

              // Handle Reasoning Delta
              if (delta.reasoning) {
                if (thinkingStartTime === null) thinkingStartTime = Date.now();
                reasoningContent += delta.reasoning;
                thinkingDuration = Math.round((Date.now() - thinkingStartTime) / 1000);
              }

              // Handle Content Delta
              if (delta.content) {
                assistantContent += delta.content;
              }

              // Check if model outputs inline <think> tags
              if (assistantContent.includes('<think>') && !assistantContent.includes('</think>')) {
                if (thinkingStartTime === null) thinkingStartTime = Date.now();
              } else if (assistantContent.includes('</think>') && thinkingStartTime !== null && thinkingDuration === 0) {
                thinkingDuration = Math.max(1, Math.round((Date.now() - thinkingStartTime) / 1000));
              }

              // Real-time update into session messages
              onUpdateMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = {
                  role: 'assistant',
                  content: assistantContent,
                  reasoningContent: reasoningContent || undefined,
                  thinkingDurationSeconds: thinkingDuration || undefined,
                  timestamp: new Date().toISOString(),
                  modelUsed: requestModel,
                };
                return copy;
              });
            } catch {
              /* ignore parse errors on partial chunks */
            }
          }
        }
      }
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      if (e.name === 'AbortError') {
        showToast?.('หยุดการตอบกลับแล้ว', 'info');
      } else {
        console.error('Chat stream failed:', err);
        showToast?.(`การเชื่อมต่อล้มเหลว: ${e.message || 'Error'}`, 'error');
        onUpdateMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            role: 'assistant',
            content: `⚠️ เกิดข้อผิดพลาด: ${e.message || 'Error'}\n\nกรุณาตรวจสอบความถูกต้องของ OpenRouter API Key / ยอดเครดิต`,
            timestamp: new Date().toISOString(),
            modelUsed: requestModel,
            isError: true,
          };
          return copy;
        });
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
      onFinish();
    }
  };

  return {
    isGenerating,
    abortGeneration,
    executeChatStream,
  };
}
