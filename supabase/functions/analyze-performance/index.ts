import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      'openrouter/free',
      'google/gemma-4-31b-it:free',
      'openai/gpt-oss-20b:free',
      'z-ai/glm-4.5-air:free',
      'deepseek/deepseek-v4-flash:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'meta-llama/llama-3.2-3b-instruct:free',
    ];
    for (const fb of fallbacks) { if (fb !== configuredModel) modelsToTry.push(fb); }
  } else if (provider === 'opencode') {
    const fallbacks = [
      'big-pickle',
      'deepseek-v4-flash-free',
      'nemotron-3-super-free',
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
      console.warn(`[AI] Model ${currentModel} timed out after 15 seconds. Aborting request.`);
      controller.abort();
    }, 15000);

    try {
      console.log(`[AI] Trying model: ${currentModel} (${i + 1}/${modelsToTry.length})`);
      const bodyPayload: any = {
        model: currentModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      };
      if (isJson) bodyPayload.response_format = { type: "json_object" };

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(bodyPayload),
        signal: controller.signal
      });
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
      
      // If we encounter a definitive credentials or authorization error (e.g. 401 Unauthorized or 403 Forbidden),
      // we exit early and fail fast to avoid wasting resource quota on cascaded retries.
      if (response.status === 401 || response.status === 403) {
        console.error(`[AI] Definitive credentials/auth error (${response.status}) on model ${currentModel}. Exiting fallback chain early.`);
        throw new Error(`Definitive AI API Auth error (${response.status}): ${errorText.substring(0, 200)}`);
      }

      lastError = new Error(`AI API (${currentModel}) failed: ${response.status}`);
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.warn(`[AI] Fetch error for ${currentModel}:`, err.message);
      lastError = err;
      
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Load AI config
    const { data: configsData, error: configError } = await supabase
      .from('tb_system_config')
      .select('config_key, config_value');
    if (configError) throw new Error('Cannot read AI config: ' + configError.message);

    const configs: Record<string, string> = {};
    configsData.forEach((row: any) => { configs[row.config_key] = row.config_value; });

    const provider = configs.ai_provider || 'openrouter';
    const model = configs.ai_model || 'google/gemini-2.0-flash-exp:free';

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
    }

    if (!apiKey) throw new Error(`API Key for provider "${provider}" is not configured.`);

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
      let content = aiResult.choices?.[0]?.message?.content || '{}';
      content = content.replace(/^```json?/, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(content);

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
Rephrase raw work logs into professional, business-oriented descriptions in Thai language, and estimate the standard time duration required for the task.
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
1. Rephrase this raw meeting log professionally in Thai, structured under these headers:
   - [วัตถุประสงค์และบทบาท]: 
   - [ข้อสรุป]: 
   - [Next Steps]:
2. Estimate the "Standard Time" (ช่วงเวลามาตรฐานเป็นชั่วโมง เช่น min: 1.0, max: 2.0) ที่ปกติงานประชุมลักษณะนี้ควรใช้
3. Compare the Actual Duration Spent ({duration} hours) against this standard range and evaluate:
   - "มาก" (หากเวลาที่ใช้จริง มากกว่า max)
   - "น้อย" (หากเวลาที่ใช้จริง น้อยกว่า min)
   - "ดี" (หากเวลาที่ใช้จริง อยู่ในช่วง [min, max] หรือสอดคล้องอย่างสมเหตุสมผล)
4. Provide a 1-2 sentence constructive reasoning ("time_assessment_reason") in Thai.

You MUST respond ONLY with a raw JSON object matching this schema (do NOT wrap in markdown block, do NOT write other text):
{
  "enhanced_text": "Polished text in Thai...",
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
1. Rephrase this raw work log professionally in Thai, structured under these headers:
   - [งานที่ทำ]: 
   - [ผลลัพธ์และเป้าหมาย]: 
   - [Next Steps]:
2. Estimate the "Standard Time" (ช่วงเวลามาตรฐานเป็นชั่วโมง เช่น min: 2.0, max: 4.0) ที่ปกติงานลักษณะนี้ควรใช้
3. Compare the Actual Duration Spent ({duration} hours) against this standard range and evaluate:
   - "มาก" (หากเวลาที่ใช้จริง มากกว่า max)
   - "น้อย" (หากเวลาที่ใช้จริง น้อยกว่า min)
   - "ดี" (หากเวลาที่ใช้จริง อยู่ในช่วง [min, max] หรือสอดคล้องอย่างสมเหตุสมผล)
4. Provide a 1-2 sentence constructive reasoning ("time_assessment_reason") in Thai.

You MUST respond ONLY with a raw JSON object matching this schema (do NOT wrap in markdown block, do NOT write other text):
{
  "enhanced_text": "Polished text in Thai...",
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
      let rawContent = aiResult.choices?.[0]?.message?.content || '';
      rawContent = rawContent.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();

      let parsed = {
        enhanced_text: rawContent,
        standard_time_min: null,
        standard_time_max: null,
        time_assessment: null,
        time_assessment_reason: null
      };

      try {
        const jsonParsed = JSON.parse(rawContent);
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
        console.warn('Failed to parse AI response as JSON:', err, 'Raw content was:', rawContent);
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

    // Fetch prompt template
    const { data: template, error: templateErr } = await supabase
      .from('tb_ai_prompt_templates')
      .select('*')
      .eq('template_key', template_id)
      .eq('is_active', true)
      .maybeSingle();

    if (templateErr) throw new Error(`Template query error: ${templateErr.message}`);
    if (!template) {
      throw new Error(`Prompt template "${template_id}" not found or inactive. Please check Admin → AI Prompts.`);
    }

    // Log Aggregation
    const totalHours = logs.reduce((s: number, l: any) => s + (parseFloat(l.total_hours) || 0), 0);
    const otLogs = logs.filter((l: any) => l.is_ot);
    const otHours = otLogs.reduce((s: number, l: any) => s + (parseFloat(l.total_hours) || 0), 0);
    const otRate = totalHours > 0 ? Math.round((otHours / totalHours) * 100) : 0;

    const aggregatedGroups: Record<string, any> = {};
    logs.forEach((l: any) => {
      const key = `${l.project_name || 'General'} | ${l.action_name || 'Task'}`;
      if (!aggregatedGroups[key]) {
        aggregatedGroups[key] = { project: l.project_name || 'General', action: l.action_name || 'Task', hours: 0, descriptions: new Set<string>() };
      }
      aggregatedGroups[key].hours += parseFloat(l.total_hours) || 0;
      if (l.description?.trim()) aggregatedGroups[key].descriptions.add(l.description.trim().substring(0, 120));
    });

    const aggregatedLogsText = Object.values(aggregatedGroups)
      .sort((a: any, b: any) => b.hours - a.hours)
      .map((g: any) => {
        const pct = totalHours > 0 ? ((g.hours / totalHours) * 100).toFixed(1) : '0.0';
        const samples = Array.from(g.descriptions).slice(0, 3).join('; ');
        return `- Project: ${g.project} | Action: ${g.action} → ${g.hours.toFixed(1)} hrs (${pct}%)${samples ? ` | Samples: "${samples}"` : ''}`;
      }).join('\n');

    const durationDays = Math.round((new Date(end_date).getTime() - new Date(start_date).getTime()) / (1000 * 3600 * 24)) + 1;
    const avgHoursPerDay = (totalHours / durationDays).toFixed(1);

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
    let content = aiResult.choices?.[0]?.message?.content || '';
    console.log(`[AI] Content length: ${content.length}`);
    if (content.startsWith('```json')) {
      content = content.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (content.startsWith('```')) {
      content = content.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const parsedReport = JSON.parse(content);
    console.log('[AI] Successfully parsed content JSON.');

    const isCoachTemplate = template_id === 'individual_coach';

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

