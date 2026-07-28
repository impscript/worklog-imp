import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function extractJsonString(text: string): string {
  var cleaned = text.trim();
  var markdownRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  var match = cleaned.match(markdownRegex);
  if (match) {
    cleaned = match[1].trim();
  }
  
  var firstBrace = cleaned.indexOf('{');
  var lastBrace = cleaned.lastIndexOf('}');
  var firstBracket = cleaned.indexOf('[');
  var lastBracket = cleaned.lastIndexOf(']');
  
  var startIdx = -1;
  var endIdx = -1;
  
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = lastBrace;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = lastBracket;
  }
  
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return cleaned.substring(startIdx, endIdx + 1);
  }
  
  if (startIdx !== -1) {
    var sub = cleaned.substring(startIdx);
    sub = sub.replace(/\s*```\s*$/, '');
    return sub;
  }
  
  return cleaned;
}

function repairTruncatedJson(raw: string): string {
  var insideString = false;
  var escaped = false;
  var stack: string[] = [];
  var result = '';

  for (var i = 0; i < raw.length; i++) {
    var char = raw[i];
    
    if (char === '"' && !escaped) {
      insideString = !insideString;
      result += char;
    } else if (char === '\\' && insideString) {
      escaped = !escaped;
      result += char;
    } else {
      if (!insideString) {
        if (char === '{' || char === '[') {
          stack.push(char);
        } else if (char === '}') {
          if (stack[stack.length - 1] === '{') {
            stack.pop();
          }
        } else if (char === ']') {
          if (stack[stack.length - 1] === '[') {
            stack.pop();
          }
        }
      }
      result += char;
      escaped = false;
    }
  }

  if (insideString) {
    result += '"';
  }

  while (stack.length > 0) {
    var open = stack.pop();
    if (open === '{') {
      result += '}';
    } else if (open === '[') {
      result += ']';
    }
  }

  return result;
}

function sanitizeJsonString(raw: string): string {
  var insideString = false;
  var escaped = false;
  var result = '';
  for (var i = 0; i < raw.length; i++) {
    var char = raw[i];
    
    if (char === '"' && !escaped) {
      if (insideString) {
        var lookAheadIdx = i + 1;
        while (lookAheadIdx < raw.length && /\s/.test(raw[lookAheadIdx])) {
          lookAheadIdx++;
        }
        var nextChar = raw[lookAheadIdx];
        if (nextChar === ',' || nextChar === '}' || nextChar === ']' || nextChar === ':' || nextChar === undefined) {
          insideString = false;
          result += char;
        } else {
          result += '\\"';
        }
      } else {
        insideString = true;
        result += char;
      }
    } else if (char === '\\' && insideString) {
      escaped = !escaped;
      result += char;
    } else {
      if (insideString) {
        if (char === '\n') {
          result += '\\n';
        } else if (char === '\r') {
          result += '\\r';
        } else if (char === '\t') {
          result += '\\t';
        } else if (char.charCodeAt(0) < 32) {
          // ignore or escape control chars
        } else {
          result += char;
        }
      } else {
        result += char;
      }
      escaped = false;
    }
  }
  return result;
}

function robustParseJson(raw: string): any {
  var extracted = extractJsonString(raw);
  var repaired = repairTruncatedJson(extracted);
  var sanitized = sanitizeJsonString(repaired);
  var lastError: any = null;
  try {
    return JSON.parse(sanitized);
  } catch (e) {
    lastError = e;
    console.warn('[JSON Parse] First attempt failed (' + (e as any).message + '). Trying comma cleaning fallback.');
  }
  var noTrailingCommas = sanitized.replace(/,(\s*[}\]])/g, '$1');
  try {
    return JSON.parse(noTrailingCommas);
  } catch (e) {
    lastError = e;
    console.warn('[JSON Parse] Second attempt failed (' + (e as any).message + ').');
  }
  throw new Error("Invalid JSON format from AI: " + (lastError ? lastError.message : "unknown error") + "\nRaw response from AI was:\n" + raw);
}

interface FallbackResult {
  response: Response;
  actualModel: string;
  modelsTried: string[];
  fallbackOccurred: boolean;
}

async function callLlmWithFallback(
  endpoint: string,
  headers: Record<string, string>,
  provider: string,
  configuredModel: string,
  systemPrompt: string,
  userPrompt: string,
  isJson: boolean = false
): Promise<FallbackResult> {
  const modelsToTry = [configuredModel];

  if (provider === 'openrouter') {
    const fallbacks = [
      'google/gemini-2.0-flash:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'openai/gpt-4o-mini',
      'deepseek/deepseek-chat',
      'meta-llama/llama-3.3-70b-instruct',
    ];
    for (const fb of fallbacks) { if (fb !== configuredModel) modelsToTry.push(fb); }
  } else if (provider === 'opencode') {
    const fallbacks = [
      'big-pickle',
      'deepseek-v4-flash-free',
      'nemotron-3-super-free',
    ];
    for (const fb of fallbacks) { if (fb !== configuredModel) modelsToTry.push(fb); }
  } else if (provider === 'cloudflare') {
    const fallbacks = [
      '@cf/meta/llama-3.1-8b-instruct',
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      '@cf/qwen/qwen2.5-72b-instruct',
    ];
    for (const fb of fallbacks) { if (fb !== configuredModel) modelsToTry.push(fb); }
  }

  const modelsTried: string[] = [];
  let lastError: Error | null = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];
    modelsTried.push(currentModel);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn(`[AI] Model ${currentModel} timed out after 45 seconds. Aborting request.`);
      controller.abort();
    }, 45000);

    try {
      console.log(`[AI] Trying model: ${currentModel} (${i + 1}/${modelsToTry.length})`);
      const bodyPayload: any = {
        model: currentModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 6000
      };
      // Cloudflare Workers AI uses OpenAI-compat endpoint but does NOT support response_format natively
      // JSON compliance is enforced via prompt engineering instead
      if (isJson && provider !== 'cloudflare') {
        bodyPayload.response_format = { type: "json_object" };
      }

      let response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(bodyPayload),
        signal: controller.signal
      });

      // Handle structured output format errors from smaller/unsupported models
      if (!response.ok && response.status === 400 && bodyPayload.response_format) {
        let errorText = '';
        try {
          errorText = await response.clone().text();
        } catch (_) {}

        const errLower = errorText.toLowerCase();
        if (
          errLower.includes('response_format') ||
          errLower.includes('json_object') ||
          errLower.includes('structured_outputs') ||
          errLower.includes('json mode')
        ) {
          console.warn(`[AI] Model ${currentModel} failed with response_format error. Retrying without JSON mode constraint.`);
          delete bodyPayload.response_format;
          response = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify(bodyPayload),
            signal: controller.signal
          });
        }
      }

      clearTimeout(timeoutId);

      if (response.ok) {
        const fallbackOccurred = currentModel !== configuredModel;
        if (fallbackOccurred) {
          console.log(`[AI] ⚠️ Fallback! Primary model "${configuredModel}" failed. Using "${currentModel}" instead.`);
        } else {
          console.log(`[AI] ✅ Success with primary model: ${currentModel}`);
        }
        return { response, actualModel: currentModel, modelsTried, fallbackOccurred };
      }

      const errorText = await response.text();
      console.warn(`[AI] Model ${currentModel} failed ${response.status}: ${errorText.substring(0, 200)}`);
      
      let parsedErrorMsg = '';
      try {
        const parsed = JSON.parse(errorText);
        parsedErrorMsg = parsed.error?.message || parsed.message || '';
      } catch {}

      const detail = parsedErrorMsg || errorText.substring(0, 150);
      const formattedDetail = detail ? ` - ${detail}` : '';

      // If we encounter a definitive credentials or authorization error (e.g. 401 Unauthorized or 403 Forbidden),
      // we exit early and fail fast to avoid wasting resource quota on cascaded retries.
      if (response.status === 401 || response.status === 403) {
        console.error(`[AI] Definitive credentials/auth error (${response.status}) on model ${currentModel}. Exiting fallback chain early.`);
        throw new Error(`Definitive AI API Auth error (${response.status})${formattedDetail}`);
      }

      lastError = new Error(`AI API (${currentModel}) failed: ${response.status}${formattedDetail}`);
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.warn(`[AI] Fetch error for ${currentModel}:`, err.message);
      
      if (err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('abort')) {
        lastError = new Error(`AI API request timed out (exceeded 45s) for model: ${currentModel}`);
      } else {
        lastError = err;
      }
      
      // If the error was explicitly thrown by the definitive auth early exit check, propagate it immediately.
      if (err.message && err.message.includes("Definitive AI API Auth error")) {
        throw err;
      }
    }
  }
  throw lastError || new Error("All models failed to respond.");
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, debug: includeDebug } = body;

    // ── ACTION: test_connection ───────────────────────────────────────────────
    // Called before loading DB configs so user can test credentials before saving
    if (action === 'test_connection') {
      const { provider: testProvider, account_id, api_token, api_key } = body;

      if (testProvider === 'cloudflare') {
        if (!account_id) {
          return new Response(JSON.stringify({ success: false, message: 'กรุณากรอก Cloudflare Account ID ก่อนทดสอบ' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        if (!api_token) {
          return new Response(JSON.stringify({ success: false, message: 'กรุณากรอก Cloudflare API Token ก่อนทดสอบ' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        try {
          // Test via models/search (server-side, no CORS)
          const modelsRes = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${account_id}/ai/models/search?limit=5`,
            { headers: { Authorization: `Bearer ${api_token}` } }
          );
          const modelsData = await modelsRes.json();

          if (!modelsRes.ok || !modelsData.success) {
            const errMsg = modelsData.errors?.[0]?.message || `HTTP ${modelsRes.status}`;
            return new Response(JSON.stringify({ success: false, message: `ไม่สามารถเชื่อมต่อ Cloudflare ได้: ${errMsg}` }), {
              status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Also fetch Neurons usage
          let neuronsUsed = null;
          let neuronsLimit = 10000;
          try {
            const usageRes = await fetch(
              `https://api.cloudflare.com/client/v4/accounts/${account_id}/ai/usage`,
              { headers: { Authorization: `Bearer ${api_token}` } }
            );
            if (usageRes.ok) {
              const usageData = await usageRes.json();
              if (usageData.success && usageData.result) {
                neuronsUsed = usageData.result.neurons_used ?? usageData.result.usage?.neurons ?? 0;
              }
            }
          } catch (_) {
            // Usage fetch is optional, don't fail the whole test
          }

          return new Response(JSON.stringify({
            success: true,
            message: `✅ เชื่อมต่อ Cloudflare Workers AI สำเร็จ! พบโมเดล ${modelsData.result?.length || '?'} รายการ (Account: ${account_id.slice(0, 8)}...)`,
            modelsCount: modelsData.result?.length || 0,
            neuronsUsed,
            neuronsLimit,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        } catch (err: any) {
          return new Response(JSON.stringify({ success: false, message: `ไม่สามารถเชื่อมต่อได้: ${err.message}` }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Generic provider test — just return success (validated on first use)
      return new Response(JSON.stringify({ success: true, message: 'รูปแบบ credentials ถูกต้อง (จะ validate จริงเมื่อใช้งาน AI ครั้งแรก)' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Resolve Workspace ID ─────────────────────────────────────────────────
    // Priority: 1) Explicit workspace_id in body (most reliable for mock/HRMS logins)
    //           2) JWT sub → users.active_workspace_id lookup
    //           3) Default IMP workspace
    let workspaceId = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001'; // Default IMP Workspace UUID

    if (body.workspace_id) {
      // Explicit workspace_id sent from frontend — most reliable signal
      workspaceId = body.workspace_id;
      console.log(`[WS] Using explicit workspace_id from body: ${workspaceId}`);
    } else {
      // Try to resolve from JWT sub → users table
      let userId = null;
      const authHeader = req.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            userId = payload.sub || null;
          }
        } catch (err) {
          console.warn('Error decoding JWT payload in Edge Function:', err);
        }
      }
      // Fallback to body.user_id if JWT gave nothing
      if (!userId && body.user_id) userId = body.user_id;

      if (userId) {
        const { data: userProfile } = await supabase
          .from('users')
          .select('active_workspace_id')
          .eq('id', userId)
          .maybeSingle();
        if (userProfile?.active_workspace_id) {
          workspaceId = userProfile.active_workspace_id;
          console.log(`[WS] Resolved workspace_id from JWT user: ${workspaceId}`);
        }
      }
    }

    // Load AI config for the resolved workspace
    const { data: configsData, error: configError } = await supabase
      .from('tb_system_config')
      .select('config_key, config_value')
      .eq('workspace_id', workspaceId);

    if (configError) throw new Error('ไม่สามารถอ่านข้อมูลการตั้งค่า AI ของ Workspace ได้ กรุณาลองใหม่อีกครั้งหรือติดต่อผู้ดูแลระบบ');

    const configs: Record<string, string> = {};
    if (configsData) {
      configsData.forEach((row: any) => { configs[row.config_key] = row.config_value; });
    }

    const provider = configs.ai_provider || 'openrouter';
    const model = configs.ai_model || 'google/gemini-2.0-flash:free';

    let apiKey = '';
    let endpoint = '';
    if (provider === 'openrouter') {
      apiKey = configs.openrouter_api_key;
      endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    } else if (provider === 'gemini') {
      apiKey = configs.gemini_api_key;
      endpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
    } else if (provider === 'openai') {
      apiKey = configs.openai_api_key;
      endpoint = 'https://api.openai.com/v1/chat/completions';
    } else if (provider === 'opencode') {
      apiKey = configs.opencode_api_key;
      endpoint = 'https://opencode.ai/zen/v1/chat/completions';
    } else if (provider === 'cloudflare') {
      const accountId = configs.cloudflare_account_id;
      const cfModel = model || '@cf/meta/llama-3.1-8b-instruct';
      apiKey = configs.cloudflare_api_token;
      // Use Cloudflare OpenAI-compatible endpoint (supports chat/completions format)
      endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;
      if (!accountId) throw new Error('ไม่พบข้อมูล Cloudflare Account ID สำหรับ Workspace นี้ กรุณาติดต่อผู้ดูแลระบบ (Admin) เพื่อทำการตั้งค่าที่เมนู Admin → AI Settings');
    }

    if (!apiKey) {
      throw new Error(`Workspace นี้ยังไม่ได้ตั้งค่าเชื่อมต่อระบบ AI (ไม่พบ API Key สำหรับผู้ให้บริการ ${provider}) กรุณาติดต่อผู้ดูแลระบบ (Admin) ให้ระบุคีย์ผ่านเมนู 'ตั้งค่า AI' (Admin → AI Settings)`);
    }

    const llmHeaders: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    };
    if (provider === 'openrouter') {
      llmHeaders["HTTP-Referer"] = "https://vibecode.net";
      llmHeaders["X-Title"] = "Worklog HRBP";
    }

    // ── ACTION: recommend_jd ─────────────────────────────────────────────────
    if (action === 'recommend_jd') {
      const { position, target_weights } = body;

      const weightsText = Array.isArray(target_weights) && target_weights.length > 0
        ? target_weights.map((w: any) => `- ${w.category}: ${w.weight}%`).join('\n')
        : 'ไม่ได้ระบุ (ให้ AI กำหนดตามความเหมาะสม รวม 100%)';

      const systemPrompt = `คุณคือผู้เชี่ยวชาญด้าน HR วิเคราะห์และออกแบบ Job Description เชิงวิชาชีพ ตอบเป็น raw JSON เท่านั้น ห้ามครอบด้วย markdown หรือมี prefix ใดๆ`;

      const userPrompt = `สร้าง Job Description สำหรับตำแหน่ง: "${position || 'General Staff'}"

เป้าหมายสัดส่วนงาน (Target Weights ที่ผู้ใช้กำหนด):
${weightsText}

กฎ:
- หาก target_weights มีข้อมูล → ใช้ category และ weight ตามที่กำหนดทุกข้อ (ห้ามเปลี่ยน)
- หาก target_weights ว่าง → ประมาณ weight ให้เหมาะกับตำแหน่ง (รวม = 100%)
- jd_text ให้เป็นภาษาอังกฤษเชิงวิชาชีพ 4-6 bullet points

ตอบเป็น JSON ดังนี้:
{
  "jd_text": "ข้อความ JD ภาษาอังกฤษ (เริ่มด้วย role title แล้วตามด้วย bullet points)",
  "key_responsibilities": [
    { "category": "ชื่อหมวดงาน", "weight": <integer> }
  ]
}`;

      console.log(`[PROMPT:recommend_jd] system="${systemPrompt.substring(0, 100)}..." user="${userPrompt.substring(0, 200)}..."`);

      const { response, actualModel, modelsTried, fallbackOccurred } = await callLlmWithFallback(
        endpoint, llmHeaders, provider, model, systemPrompt, userPrompt, true
      );

      const aiResult = await response.json();
      const rawContent = aiResult.choices?.[0]?.message?.content || '{}';
      const parsed = robustParseJson(rawContent);

      return new Response(JSON.stringify({
        jd_text: parsed.jd_text || '',
        key_responsibilities: parsed.key_responsibilities || [],
        actualModel,
        provider,
        fallbackOccurred,
        modelsTried,
        ...(includeDebug ? { debug_prompts: { system: systemPrompt, user: userPrompt } } : {}),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── ACTION: enhance_description ──────────────────────────────────────────
    if (action === 'enhance_description') {
      const { description, project_name, action_name, duration } = body;

      const isMeeting = /meeting|discuss|sync|ประชุม|คุย/i.test(action_name || '') || /ประชุม|คุย/i.test(description || '');

      const systemPrompt = configs.prompt_enhance_system ||
        `You are an expert HR Coach, Work Measurement Specialist, and Executive Technical Writer.
Rephrase raw work logs into highly detailed, professional, business-oriented descriptions in Thai language to maximize business impact, and estimate the standard time duration required for the task.
You must return your output strictly in JSON format.`;

      let defaultUserTemplate = '';
      if (isMeeting) {
        defaultUserTemplate = `Context:
- Project: {project_name}
- Category: {action_name}
- Actual Duration Spent: {duration} hours

RAW LOG (Meeting):
{description}

INSTRUCTION:
1. Rephrase, polish, and significantly expand this raw meeting log in Thai to showcase high business impact, professional terminology, and value.
2. You can write long and detailed descriptions to make the work look highly impactful ("เขียนยาวๆ และเพิ่มรายละเอียดให้มี impact มากยิ่งขึ้น").
3. Detect the structure/headings in the RAW LOG:
   - If Meeting structure is used (contains วัตถุประสงค์, บทบาทของคุณ, ข้อสรุป, Next Steps, etc.): Use these headings.
   - If other headers are found, preserve and expand them accordingly.
4. You MUST ALWAYS include the "[Project Background]" heading as the very first section in the "enhanced_text" output.
5. Apply the following headings in the "enhanced_text" output:
   - [Project Background]: (ภูมิหลังและบริบทของโครงการหรือกิจกรรมนี้ อธิบายที่มาที่ไปและความเชื่อมโยงเชิงกลยุทธ์อย่างมืออาชีพ)
   - [วัตถุประสงค์และบทบาท]: (จุดประสงค์หลักของการประชุมและบทบาทหน้าที่ของเราในที่ประชุมอย่างละเอียดและมีพลัง)
   - [ข้อสรุป]: (มติ สาระสำคัญ ผลสรุป และประเด็นตัดสินใจสำคัญจากการประชุมอย่างละเอียดและชัดเจน)
   - [Next Steps]: (แผนการดำเนินงานและสิ่งที่จะต้องทำต่อหลังจากการประชุม)

6. Estimate the "Standard Time" (ช่วงเวลามาตรฐานเป็นชั่วโมง เช่น min: 1.0, max: 2.0) ที่ปกติงานประชุมลักษณะนี้ควรใช้
7. Compare the Actual Duration Spent ({duration} hours) against this standard range and evaluate:
   - "มาก" (หากเวลาที่ใช้จริง มากกว่า max)
   - "น้อย" (หากเวลาที่ใช้จริง น้อยกว่า min)
   - "ดี" (หากเวลาที่ใช้จริง อยู่ในช่วง [min, max] หรือสอดคล้องอย่างสมเหตุสมผล)
8. Provide a 1-2 sentence constructive reasoning ("time_assessment_reason") in Thai.

You MUST respond ONLY with a raw JSON object matching this schema (do NOT wrap in markdown block, do NOT write other text):
{
  "enhanced_text": "Polished text in Thai with [Project Background] and the other headings...",
  "standard_time_min": number,
  "standard_time_max": number,
  "time_assessment": "มาก" | "น้อย" | "ดี",
  "time_assessment_reason": "คำอธิบายวิเคราะห์ความเหมาะสมของเวลาเป็นภาษาไทย..."
}`;
      } else {
        defaultUserTemplate = `Context:
- Project: {project_name}
- Category: {action_name}
- Actual Duration Spent: {duration} hours

RAW LOG (Task/Work):
{description}

INSTRUCTION:
1. Rephrase, polish, and significantly expand this raw work log in Thai to showcase high business impact, professional terminology, and value.
2. You can write long and detailed descriptions to make the work look highly impactful ("เขียนยาวๆ และเพิ่มรายละเอียดให้มี impact มากยิ่งขึ้น").
3. Detect the structure/headings in the RAW LOG:
   - If PARIL structure is used (contains Plan, Action, Result, Impact, Lesson Learned): Preserve these headings and expand each section.
   - If General Task structure is used (contains งานที่ทำ, ผลลัพธ์ที่ได้, KPI/เป้าหมาย, Next Steps) or no headers are found: Use the General Task headings.
4. You MUST ALWAYS include the "[Project Background]" heading as the very first section in the "enhanced_text" output.
5. Apply the following headings in the "enhanced_text" output:
   - [Project Background]: (ภูมิหลังและบริบทของโครงการหรือกิจกรรมนี้ อธิบายที่มาที่ไปและความเชื่อมโยงเชิงกลยุทธ์อย่างมืออาชีพ)
   - [งานที่ทำ]: (ขยายความสิ่งที่ปฏิบัติอย่างละเอียด เป็นขั้นตอน ชัดเจน และเป็นมืออาชีพ)
   - [ผลลัพธ์ที่ได้]: (วิเคราะห์และสรุปผลสำเร็จอย่างเป็นรูปธรรม ชิ้นงาน ผลกระทบเชิงบวก และคุณค่าที่เกิดขึ้น)
   - [KPI/เป้าหมาย]: (วิเคราะห์และเชื่อมโยงกับ KPI หรือเป้าหมายองค์กรอย่างมีพลัง)
   - [Next Steps]: (แผนงานขั้นตอนถัดไป ความคืบหน้า หรือการดำเนินการลำดับถัดไป)
   (Note: If PARIL structure was detected, use [Project Background] followed by [Plan], [Action], [Result], [Impact], [Lesson Learned] instead).

6. Estimate the "Standard Time" (ช่วงเวลามาตรฐานเป็นชั่วโมง เช่น min: 2.0, max: 4.0) ที่ปกติงานลักษณะนี้ควรใช้
7. Compare the Actual Duration Spent ({duration} hours) against this standard range and evaluate:
   - "มาก" (หากเวลาที่ใช้จริง มากกว่า max)
   - "น้อย" (หากเวลาที่ใช้จริง น้อยกว่า min)
   - "ดี" (หากเวลาที่ใช้จริง อยู่ในช่วง [min, max] หรือสอดคล้องอย่างสมเหตุสมผล)
8. Provide a 1-2 sentence constructive reasoning ("time_assessment_reason") in Thai.

You MUST respond ONLY with a raw JSON object matching this schema (do NOT wrap in markdown block, do NOT write other text):
{
  "enhanced_text": "Polished text in Thai with [Project Background] and the other headings...",
  "standard_time_min": number,
  "standard_time_max": number,
  "time_assessment": "มาก" | "น้อย" | "ดี",
  "time_assessment_reason": "คำอธิบายวิเคราะห์ความเหมาะสมของเวลาเป็นภาษาไทย..."
}`;
      }

      const rawUserTemplate = configs.prompt_enhance_user || defaultUserTemplate;

      const userPrompt = rawUserTemplate
        .replace('{project_name}', project_name || 'N/A')
        .replace('{action_name}', action_name || 'N/A')
        .replace(/{duration}/g, duration ? String(duration) : 'N/A')
        .replace('{description}', description || '(Empty)');

      const { response, actualModel, modelsTried, fallbackOccurred } = await callLlmWithFallback(
        endpoint, llmHeaders, provider, model, systemPrompt, userPrompt, false
      );

      const aiResult = await response.json();
      const rawContent = aiResult.choices?.[0]?.message?.content || '';

      let parsed = {
        enhanced_text: rawContent,
        standard_time_min: null,
        standard_time_max: null,
        time_assessment: null,
        time_assessment_reason: null
      };

      try {
        const jsonParsed = robustParseJson(rawContent);
        if (jsonParsed.enhanced_text) {
          parsed = {
            enhanced_text: jsonParsed.enhanced_text,
            standard_time_min: jsonParsed.standard_time_min,
            standard_time_max: jsonParsed.standard_time_max,
            time_assessment: jsonParsed.time_assessment,
            time_assessment_reason: jsonParsed.time_assessment_reason
          };
        }
      } catch (err) {
        console.warn('Failed to parse AI response as JSON:', (err as any).message, 'Raw content was:', rawContent);
      }

      return new Response(JSON.stringify({
        enhanced_text: parsed.enhanced_text,
        standard_time_min: parsed.standard_time_min,
        standard_time_max: parsed.standard_time_max,
        time_assessment: parsed.time_assessment,
        time_assessment_reason: parsed.time_assessment_reason,
        actualModel,
        provider,
        fallbackOccurred,
        modelsTried,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── ACTION: classify_work_description ────────────────────────────────────
    if (action === 'classify_work_description') {
      const { description, workspace_projects, master_actions } = body;

      if (!description) {
        throw new Error('Missing description to classify.');
      }

      const projectsListText = Array.isArray(workspace_projects) && workspace_projects.length > 0
        ? workspace_projects.map((p: any) => `- Holding: ${p.holding} | Operator: ${p.department_operator} | Project Type: ${p.project_type} | Project Name: ${p.project_name} | Module: ${p.module || '-'} | BU: ${p.bu} | Dept: ${p.department}`).join('\n')
        : 'None available';

      const actionsListText = Array.isArray(master_actions) && master_actions.length > 0
        ? master_actions.map((a: any) => `- Category: ${a.action_category} | Action Name: ${a.action_name}`).join('\n')
        : 'None available';

      const systemPrompt = `You are an expert HR operation classifier and database mapping AI.
Your job is to analyze a raw worklog description and map it to the most relevant project from the provided "Workspace Projects" list and the most relevant action from the "Master Actions" list.
You must return your output strictly in JSON format.`;

      const userPrompt = `Raw Worklog Description:
"${description}"

---------------------------
Available Workspace Projects:
${projectsListText}

---------------------------
Available Master Actions:
${actionsListText}

---------------------------
Task instructions:
1. Find the project in "Available Workspace Projects" that matches the raw description best.
2. Find the action in "Available Master Actions" that matches the raw description best.
3. If no project matches at all, select the first project or a general project but output a low confidence score.
4. Output your response strictly as a JSON object containing the matched fields exactly as they appear in the lists:
{
  "holding": "Matched holding",
  "department_operator": "Matched operator",
  "project_type": "Matched project type",
  "project_name": "Matched project name",
  "module": "Matched module",
  "bu": "Matched BU",
  "department": "Matched department",
  "action_name": "Matched action name",
  "confidence_score": number (0.0 to 1.0),
  "reason": "Thai reasoning explaining why this project and action were matched"
}`;

      console.log(`[PROMPT:classify_work_description] description="${description.substring(0, 100)}..."`);

      const { response, actualModel, modelsTried, fallbackOccurred } = await callLlmWithFallback(
        endpoint, llmHeaders, provider, model, systemPrompt, userPrompt, true
      );

      const aiResult = await response.json();
      const rawContent = aiResult.choices?.[0]?.message?.content || '{}';
      const parsed = robustParseJson(rawContent);

      return new Response(JSON.stringify({
        classification: parsed,
        actualModel,
        provider,
        fallbackOccurred,
        modelsTried,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── DEFAULT: Performance Diagnostics ─────────────────────────────────────
    const {
      user_id,
      start_date,
      end_date,
      force_refresh,
      template_id = 'master',       // 'master' | 'individual_coach'
      cadence_type,                  // 'weekly' | 'monthly' | 'quarterly'
      employee_level,                // override
      manager_name                   // override
    } = body;

    if (!user_id || !start_date || !end_date) {
      throw new Error('Missing required fields: user_id, start_date, end_date');
    }

    // Check cache
    if (!force_refresh) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data: existingReport } = await supabase
        .from('tb_ai_individual_analysis')
        .select('*')
        .eq('user_id', user_id)
        .eq('start_date', start_date)
        .eq('end_date', end_date)
        .eq('template_id', template_id)
        .gte('created_at', yesterday.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingReport) {
        const { data: logs } = await supabase
          .from('col_worklog')
          .select('total_hours')
          .eq('user_id', user_id)
          .gte('work_date', start_date)
          .lte('work_date', end_date);
        const totalHours = (logs || []).reduce((sum: number, e: any) => sum + Number(e.total_hours || 0), 0);

        return new Response(JSON.stringify({
          id: existingReport.id,
          created_at: existingReport.created_at,
          share_token: existingReport.share_token,
          is_public: existingReport.is_public,
          expires_at: existingReport.expires_at,
          acknowledged_at: existingReport.acknowledged_at,
          acknowledged_by: existingReport.acknowledged_by,
          template_id: existingReport.template_id,
          jd_alignment_score: existingReport.jd_alignment_score,
          burnout_risk_score: existingReport.burnout_risk_score,
          reflection_level: existingReport.reflection_level,
          value_mix: existingReport.value_mix,
          overall_health: existingReport.overall_health,
          workload_allocation: existingReport.actual_vs_target,
          headline_insight: existingReport.headline_insight,
          strengths: existingReport.strengths,
          improvements: existingReport.improvements,
          coaching_guide: existingReport.coaching_guide,
          development_plan: existingReport.development_plan,
          well_being_signal: existingReport.well_being_signal,
          message_to_employee: existingReport.message_to_employee,
          markdown_executive_summary: existingReport.raw_ai_report,
          cached: true,
          actualModel: existingReport.engine_model || model,
          provider,
          fallbackOccurred: false,
          modelsTried: [existingReport.engine_model || model],
          totalHours,
          logsCount: logs?.length || 0,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Fetch user + JD
    const { data: userProfile } = await supabase.from('users').select('*').eq('id', user_id).single();
    let jdText = "ไม่ได้ระบุ Job Description";
    let keyResponsibilities: any[] = [];

    const { data: userJd } = await supabase.from('tb_user_jd').select('*').eq('user_id', user_id).maybeSingle();
    if (userJd) {
      jdText = userJd.jd_text;
      keyResponsibilities = userJd.key_responsibilities || [];
    }

    // Fetch worklogs
    const { data: logs } = await supabase
      .from('col_worklog')
      .select('project_name, action_name, description, total_hours, work_date, is_ot')
      .eq('user_id', user_id)
      .gte('work_date', start_date)
      .lte('work_date', end_date);

    if (!logs || logs.length === 0) {
      return new Response(JSON.stringify({
        error: 'No logs found',
        message: 'ไม่พบข้อมูลบันทึกเวลาทำงานของพนักงานในช่วงเวลาที่เลือก'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch prompt template scoped to workspace, fallback to default workspace if not found
    let { data: template, error: templateErr } = await supabase
      .from('tb_ai_prompt_templates')
      .select('*')
      .eq('template_key', template_id)
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .maybeSingle();

    if (!template && !templateErr && workspaceId !== 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001') {
      const { data: fallbackTemplate, error: fallbackErr } = await supabase
        .from('tb_ai_prompt_templates')
        .select('*')
        .eq('template_key', template_id)
        .eq('workspace_id', 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001')
        .eq('is_active', true)
        .maybeSingle();
      if (!fallbackErr && fallbackTemplate) {
        template = fallbackTemplate;
      }
    }

    // Fallback 2: company-wide Core / Public template (workspace_id IS NULL)
    if (!template && !templateErr) {
      const { data: coreTemplate, error: coreErr } = await supabase
        .from('tb_ai_prompt_templates')
        .select('*')
        .eq('template_key', template_id)
        .is('workspace_id', null)
        .eq('is_active', true)
        .maybeSingle();
      if (!coreErr && coreTemplate) {
        template = coreTemplate;
      }
    }

    if (templateErr) throw new Error(`Template query error: ${templateErr.message}`);
    if (!template) {
      throw new Error(`ไม่พบรูปแบบการวิเคราะห์ "${template_id}" หรือรูปแบบดังกล่าวถูกปิดใช้งานอยู่ กรุณาติดต่อผู้ดูแลระบบ (Admin) เพื่อตรวจสอบที่เมนู Admin → AI Prompts`);
    }

    // Log Aggregation
    const totalHours = logs.reduce((s: number, l: any) => s + (parseFloat(l.total_hours) || 0), 0);
    const otLogs = logs.filter((l: any) => l.is_ot);
    const otHours = otLogs.reduce((s: number, l: any) => s + (parseFloat(l.total_hours) || 0), 0);
    const otRate = totalHours > 0 ? Math.round((otHours / totalHours) * 100) : 0;

    const durationDays = Math.round((new Date(end_date).getTime() - new Date(start_date).getTime()) / (1000 * 3600 * 24)) + 1;
    const avgHoursPerDay = (totalHours / durationDays).toFixed(1);

    // Adaptive sample constraints based on duration
    let maxSamples = 0;
    let maxChars = 0;
    if (durationDays <= 7) {
      maxSamples = 3;
      maxChars = 120;
    } else if (durationDays <= 35) {
      maxSamples = 2;
      maxChars = 100;
    } else if (durationDays <= 100) {
      maxSamples = 1;
      maxChars = 80;
    } else {
      maxSamples = 0;
      maxChars = 0;
    }

    const aggregatedGroups: Record<string, any> = {};
    logs.forEach((l: any) => {
      const key = `${l.project_name || 'General'} | ${l.action_name || 'Task'}`;
      if (!aggregatedGroups[key]) {
        aggregatedGroups[key] = { project: l.project_name || 'General', action: l.action_name || 'Task', hours: 0, descriptions: new Set<string>() };
      }
      aggregatedGroups[key].hours += parseFloat(l.total_hours) || 0;
      if (maxSamples > 0 && l.description?.trim()) {
        aggregatedGroups[key].descriptions.add(l.description.trim().substring(0, maxChars));
      }
    });

    const aggregatedLogsText = Object.values(aggregatedGroups)
      .sort((a: any, b: any) => b.hours - a.hours)
      .map((g: any) => {
        const pct = totalHours > 0 ? ((g.hours / totalHours) * 100).toFixed(1) : '0.0';
        const samples = maxSamples > 0 ? Array.from(g.descriptions).slice(0, maxSamples).join('; ') : '';
        return `- Project: ${g.project} | Action: ${g.action} → ${g.hours.toFixed(1)} hrs (${pct}%)${samples ? ` | Samples: "${samples}"` : ''}`;
      }).join('\n');

    // Fetch Previous Period Summary
    const prevEnd = new Date(start_date);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - durationDays);

    const { data: prevAnalysis } = await supabase
      .from('tb_ai_individual_analysis')
      .select('jd_alignment_score, burnout_risk_score, raw_ai_report, headline_insight, cadence_type')
      .eq('user_id', user_id)
      .eq('template_id', template_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const previousPeriodSummary = prevAnalysis
      ? `Period ก่อนหน้า: JD Alignment ${prevAnalysis.jd_alignment_score}/100, Burnout Risk ${prevAnalysis.burnout_risk_score}/100. ${prevAnalysis.headline_insight || 'ไม่มีข้อมูลเพิ่มเติม'}`
      : 'ไม่มีข้อมูล period ก่อนหน้าสำหรับเปรียบเทียบ';

    const resolvedLevel = employee_level || userProfile?.employee_level || 'Senior';
    const resolvedManager = manager_name || userProfile?.manager_name || 'หัวหน้างาน';

    const cadenceResolved = cadence_type || detectCadence(durationDays);
    const periodLabel = buildPeriodLabel(cadenceResolved, start_date, end_date);

    const cadenceInstructions: Record<string, string> = {
      weekly: 'CADENCE = Weekly → เน้น tactical observation และ immediate adjustment. ระบุ Coaching Question 2-3 ข้อสำหรับ 1:1 สัปดาห์นี้โดยเฉพาะ',
      monthly: 'CADENCE = Monthly → เน้น pattern emergence และ habit formation. Compare กับ previous month ถ้ามี. Identify trend ที่ก่อตัว (positive/negative)',
      quarterly: 'CADENCE = Quarterly → เน้น development planning และ career trajectory. ประเมิน Skill development. Review ว่า JD ยัง fit งานจริงหรือไม่. Recommendation for next quarter'
    };

    const levelInstructions: Record<string, string> = {
      Director: 'EMPLOYEE_LEVEL = Director → เน้น Leadership Effectiveness, Delegation Quality, Strategic Time Investment. ระวัง "Leadership Trap" (จมงาน operational). ประเมิน Coaching Time ที่ใช้พัฒนาทีม',
      Manager: 'EMPLOYEE_LEVEL = Manager/Lead → เน้น Team Output, Project Delivery, People Development. Balance ระหว่าง Doing และ Managing',
      Senior: 'EMPLOYEE_LEVEL = Senior → เน้น Technical Depth, Mentoring, Initiative Taking. ดูว่าเริ่ม transition สู่ leadership หรือยัง',
      Junior: 'EMPLOYEE_LEVEL = Junior → เน้น Skill Building, Learning Velocity, Task Mastery. ระวัง Overload หรือ Under-challenge'
    };

    const todayStr = new Date().toISOString().split('T')[0];
    const yearsInRole = userProfile?.role_start_date 
      ? ((new Date().getTime() - new Date(userProfile.role_start_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1) 
      : 'N/A';

    const keyResponsibilitiesJson = JSON.stringify(
      keyResponsibilities.length > 0 ? keyResponsibilities : [{ category: 'Core Responsibilities', weight: 100 }]
    );

    const userPromptFilled = template.user_prompt_template
      .replace(/{{TODAY}}/g, todayStr)
      .replace(/{{CADENCE_TYPE}}/g, cadenceResolved.toUpperCase())
      .replace(/{{PERIOD_START_DATE}}/g, start_date)
      .replace(/{{PERIOD_END_DATE}}/g, end_date)
      .replace(/{{PERIOD_LABEL}}/g, periodLabel)
      .replace(/{{EMPLOYEE_NAME}}/g, userProfile?.full_name || 'Teammate')
      .replace(/{{EMPLOYEE_NICKNAME}}/g, userProfile?.nickname || 'N/A')
      .replace(/{{EMPLOYEE_ROLE}}/g, userProfile?.position || 'General Staff')
      .replace(/{{EMPLOYEE_LEVEL}}/g, resolvedLevel)
      .replace(/{{YEARS_IN_ROLE}}/g, String(yearsInRole))
      .replace(/{{MANAGER_NAME}}/g, resolvedManager)
      .replace(/{{EMPLOYEE_DEPARTMENT}}/g, userProfile?.department || 'N/A')
      .replace(/{{TOTAL_HOURS}}/g, totalHours.toFixed(1))
      .replace(/{{AVG_HOURS_PER_DAY}}/g, avgHoursPerDay)
      .replace(/{{OT_RATE}}/g, String(otRate))
      .replace(/{{DURATION_DAYS}}/g, String(durationDays))
      .replace(/{{LOGS_COUNT}}/g, String(logs.length))
      .replace(/{{INDIVIDUAL_WORKLOG_JSON_OR_CSV}}/g, aggregatedLogsText)
      .replace(/{{INDIVIDUAL_JD_DATA}}/g, jdText)
      .replace(/{{KEY_RESPONSIBILITIES_JSON}}/g, keyResponsibilitiesJson)
      .replace(/{{PREVIOUS_PERIOD_SUMMARY}}/g, previousPeriodSummary)
      .replace(/{{CADENCE_INSTRUCTION}}/g, cadenceInstructions[cadenceResolved] || cadenceInstructions.monthly)
      .replace(/{{ROLE_LEVEL_INSTRUCTION}}/g, levelInstructions[resolvedLevel] || levelInstructions.Senior);

    const systemPrompt = template.system_prompt;

    console.log(`[PROMPT:audit] template=${template_id} employee=${userProfile?.full_name} period=${start_date}~${end_date} logs=${logs.length} hours=${totalHours}`);
    console.log(`[PROMPT:audit:system] ${systemPrompt.substring(0, 150)}`);
    console.log(`[PROMPT:audit:user] ${userPromptFilled.substring(0, 300)}...`);

    const { response, actualModel, modelsTried, fallbackOccurred } = await callLlmWithFallback(
      endpoint, llmHeaders, provider, model, systemPrompt, userPromptFilled, true
    );

    console.log('[AI] callLlmWithFallback returned successfully.');
    const aiResult = await response.json();
    console.log('[AI] Parsed response JSON successfully.');
    const rawContent = aiResult.choices?.[0]?.message?.content || '';
    console.log(`[AI] Content length: ${rawContent.length}`);

    const parsedReport = robustParseJson(rawContent);
    console.log('[AI] Successfully parsed content JSON.');

    const isCoachTemplate = template_id === 'individual_coach' || template_id === 'coaching_fairness';

    const dbRecord = {
      user_id,
      analysis_date: todayStr,
      start_date,
      end_date,
      template_id,
      cadence_type: cadenceResolved,
      engine_model: actualModel || model,

      // Common fields
      jd_alignment_score: parsedReport.jd_alignment_score || 0,
      burnout_risk_score: parsedReport.burnout_risk_score || 0,
      actual_vs_target: parsedReport.workload_allocation || parsedReport.actual_vs_target || [],
      strengths: isCoachTemplate
        ? (parsedReport.strengths || []).map((s: any) => typeof s === 'string' ? s : JSON.stringify(s))
        : (parsedReport.strengths || []),
      improvements: isCoachTemplate
        ? (parsedReport.improvements || []).map((i: any) => typeof i === 'string' ? i : JSON.stringify(i))
        : (parsedReport.improvements || []),
      development_plan: parsedReport.development_plan || {},
      raw_ai_report: parsedReport.markdown_executive_summary || '',

      // Extended fields
      reflection_level: parsedReport.reflection_level || null,
      value_mix: parsedReport.value_mix || null,
      headline_insight: parsedReport.headline_insight || null,
      coaching_guide: parsedReport.coaching_guide || null,
      well_being_signal: parsedReport.well_being_signal || null,
      message_to_employee: parsedReport.message_to_employee || null,

      // Point-in-time identity snapshot (see migration 20260721000000).
      // Stored so the shared/public view works for anon viewers and so historical
      // reports keep the correct identity even if the employee later changes
      // position / department / JD.
      evaluated_full_name: userProfile?.full_name || null,
      evaluated_nickname: userProfile?.nickname || null,
      evaluated_position: userProfile?.position || null,
      evaluated_department: userProfile?.department || null,
      evaluated_jd_text: jdText || null,
      evaluated_avatar_emp_id: userProfile?.emp_id || null,

      // Snapshot of the JD's key responsibilities / weights so the shared
      // (public) view can display the full target weight structure without
      // querying tb_user_jd (anon viewers are blocked by RLS).
      evaluated_key_responsibilities: keyResponsibilities.length > 0 ? keyResponsibilities : null,

      // Worklog snapshot so the shared (public) view can show hours without
      // querying col_worklog (anon readers are blocked by workspace RLS).
      total_hours: totalHours,
      logs_count: logs.length,

      // Per-dimension structured scores (perf_evaluation template)
      dimension_scores: parsedReport.dimension_scores || null,
    };

    console.log('[AI] Inserting report into tb_ai_individual_analysis...');
    const { data: insertedRow, error: insertError } = await supabase
      .from('tb_ai_individual_analysis')
      .insert(dbRecord)
      .select('*')
      .single();

    if (insertError) {
      console.error('Failed to insert analysis history:', insertError.message);
    }

    const responsePayload = {
      ...parsedReport,
      id: insertedRow?.id,
      created_at: insertedRow?.created_at,
      share_token: insertedRow?.share_token,
      is_public: insertedRow?.is_public || false,
      expires_at: insertedRow?.expires_at,
      acknowledged_at: insertedRow?.acknowledged_at,
      acknowledged_by: insertedRow?.acknowledged_by,
      template_id,
      cadence_type: cadenceResolved,
      workload_allocation: parsedReport.workload_allocation || parsedReport.actual_vs_target || [],
      markdown_executive_summary: parsedReport.markdown_executive_summary || '',
      cached: false,
      actualModel,
      provider,
      fallbackOccurred,
      modelsTried,
      logsCount: logs.length,
      totalHours,
      ...(includeDebug ? {
        debug_prompts: {
          system: systemPrompt,
          user: userPromptFilled,
        }
      } : {}),
    };

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error('Edge function error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});

function detectCadence(durationDays: number): string {
  if (durationDays <= 9) return 'weekly';
  if (durationDays <= 35) return 'monthly';
  return 'quarterly';
}

function buildPeriodLabel(cadence: string, start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const monthTh = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  if (cadence === 'weekly') return `สัปดาห์ ${start} ถึง ${end}`;
  if (cadence === 'monthly') return `${monthTh[s.getMonth()]} ${s.getFullYear() + 543}`;
  return `${monthTh[s.getMonth()]}–${monthTh[e.getMonth()]} ${s.getFullYear() + 543}`;
}

