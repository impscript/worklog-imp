import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Returns both the Response AND the actual model that successfully responded
async function callLlmWithFallback(
  endpoint: string,
  headers: Record<string, string>,
  provider: string,
  configuredModel: string,
  systemPrompt: string,
  userPrompt: string,
  isJson: boolean = false
): Promise<{ response: Response; actualModel: string }> {
  const modelsToTry = [configuredModel];

  if (provider === 'openrouter') {
    const fallbacks = [
      'google/gemini-2.0-flash-exp:free',
      'google/gemini-2.0-pro-exp:free',
      'meta-llama/llama-3-8b-instruct:free',
    ];
    for (const fb of fallbacks) { if (fb !== configuredModel) modelsToTry.push(fb); }
  } else if (provider === 'opencode') {
    const fallbacks = [
      'big-pickle',
      'deepseek-v4-flash-free',
      'minimax-m2.5-free',
      'nemotron-3-super-free',
      'qwen3.6-plus-free',
    ];
    for (const fb of fallbacks) { if (fb !== configuredModel) modelsToTry.push(fb); }
  }

  let lastError: Error | null = null;
  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];
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
        body: JSON.stringify(bodyPayload)
      });

      if (response.ok) {
        console.log(`[AI] Success with model: ${currentModel}`);
        return { response, actualModel: currentModel };
      }

      const errorText = await response.text();
      console.warn(`[AI] Model ${currentModel} failed ${response.status}: ${errorText}`);
      lastError = new Error(`AI API (${currentModel}) failed: ${response.status}`);
    } catch (err: any) {
      console.warn(`[AI] Fetch error for ${currentModel}:`, err.message);
      lastError = err;
    }
  }
  throw lastError || new Error("All models failed to respond.");
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body;

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
      endpoint = 'https://api.opencode.so/v1/chat/completions';
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

      const { response, actualModel } = await callLlmWithFallback(
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
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── ACTION: enhance_description ──────────────────────────────────────────
    if (action === 'enhance_description') {
      const { description, project_name, action_name, duration } = body;

      const systemPrompt = configs.prompt_enhance_system ||
        `You are an expert HR Coach and Technical Writer. Rewrite raw work logs into professional, business-oriented descriptions. Result must be in Thai language.`;

      const rawUserTemplate = configs.prompt_enhance_user ||
        `Context:\n- Project: {project_name}\n- Category: {action_name}\n- Duration: {duration} hours\n\nRAW LOG:\n{description}\n\nINSTRUCTION: Rephrase professionally in the same language (Thai/English). Keep 1-3 sentences. Return only the final text.`;

      const userPrompt = rawUserTemplate
        .replace('{project_name}', project_name || 'N/A')
        .replace('{action_name}', action_name || 'N/A')
        .replace('{duration}', duration ? String(duration) : 'N/A')
        .replace('{description}', description || '(Empty)');

      const { response, actualModel } = await callLlmWithFallback(
        endpoint, llmHeaders, provider, model, systemPrompt, userPrompt, false
      );

      const aiResult = await response.json();
      let enhancedText = aiResult.choices?.[0]?.message?.content || '';
      enhancedText = enhancedText.replace(/^```[a-zA-Z]*/, '').replace(/```$/, '').trim();

      return new Response(JSON.stringify({ enhanced_text: enhancedText, actualModel, provider }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── DEFAULT: Performance Diagnostics ─────────────────────────────────────
    const { user_id, start_date, end_date, force_refresh } = body;
    if (!user_id || !start_date || !end_date) {
      throw new Error('Missing required fields: user_id, start_date, end_date');
    }

    // Check cache
    if (!force_refresh) {
      const { data: existingReport } = await supabase
        .from('tb_ai_individual_analysis')
        .select('*')
        .eq('user_id', user_id)
        .gte('start_date', start_date)
        .lte('end_date', end_date)
        .order('analysis_date', { ascending: false })
        .limit(1)
        .single();

      if (existingReport) {
        return new Response(JSON.stringify({
          jd_alignment_score: existingReport.jd_alignment_score,
          burnout_risk_score: existingReport.burnout_risk_score,
          workload_allocation: existingReport.actual_vs_target,
          strengths: existingReport.strengths,
          improvements: existingReport.improvements,
          development_plan: existingReport.development_plan,
          markdown_executive_summary: existingReport.raw_ai_report,
          cached: true,
          actualModel: existingReport.engine_model || model,
          provider,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Fetch user + JD
    const { data: userProfile } = await supabase.from('users').select('*').eq('id', user_id).single();
    let jdText = "ไม่ได้ระบุ Job Description";
    let keyResponsibilities: any[] = [];

    const { data: userJd } = await supabase.from('tb_user_jd').select('*').eq('user_id', user_id).single();
    if (userJd) {
      jdText = userJd.jd_text;
      keyResponsibilities = userJd.key_responsibilities || [];
    }

    // Fetch worklogs
    const { data: logs } = await supabase
      .from('col_worklog')
      .select('project_name, action_name, description, total_hours')
      .eq('user_id', user_id)
      .gte('work_date', start_date)
      .lte('work_date', end_date);

    let totalHours = 0;
    const aggregatedLogs = aggregateWorklogs(logs || [], (h) => { totalHours += h; });
    const durationDays = Math.round((new Date(end_date).getTime() - new Date(start_date).getTime()) / (1000 * 3600 * 24)) + 1;
    const avgHoursPerDay = (totalHours / durationDays).toFixed(2);

    // Build weight summary (passed to prompt)
    const weightSummary = keyResponsibilities.length > 0
      ? keyResponsibilities.map((r: any) => `- ${r.category}: เป้าหมาย ${r.weight}%`).join('\n')
      : 'ไม่ได้กำหนด target weights';

    // Build prompts (use DB overrides if available, else Thai built-in)
    const systemPrompt = configs.prompt_audit_system ||
      `คุณคือผู้เชี่ยวชาญ HR วิเคราะห์ผลการปฏิบัติงานพนักงานอย่างเป็นระบบ ตอบเป็น raw JSON เท่านั้น ห้ามครอบด้วย markdown`;

    const rawAuditTemplate = configs.prompt_audit_user || '';
    let userPrompt: string;

    if (rawAuditTemplate) {
      userPrompt = rawAuditTemplate
        .replace('{employee_name}', userProfile?.full_name || 'ไม่ระบุ')
        .replace('{position}', userJd?.position_name || userProfile?.position || 'General Staff')
        .replace('{role}', userProfile?.role || 'ไม่ระบุ')
        .replace('{department}', userProfile?.department || 'ไม่ระบุ')
        .replace('{job_description}', jdText)
        .replace('{weight_summary}', weightSummary)
        .replace('{duration_days}', String(durationDays))
        .replace('{total_hours}', String(totalHours))
        .replace('{avg_hours_per_day}', String(avgHoursPerDay))
        .replace('{worklog_summary}', aggregatedLogs);
    } else {
      userPrompt = `[ข้อมูลพนักงาน]
ชื่อ: ${userProfile?.full_name || 'ไม่ระบุ'}
ตำแหน่ง: ${userJd?.position_name || userProfile?.position || 'General Staff'}
แผนก: ${userProfile?.department || 'ไม่ระบุ'}

[Job Description เป้าหมาย]
${jdText}

[เป้าหมายสัดส่วนงาน (Target Weights)]
${weightSummary}

[งานที่บันทึกจริง (ย้อนหลัง ${durationDays} วัน)]
รวมทั้งหมด: ${totalHours} ชั่วโมง | เฉลี่ยต่อวัน: ${avgHoursPerDay} ชั่วโมง
${aggregatedLogs}

คำสั่ง: วิเคราะห์และเปรียบเทียบงานที่ทำจริงกับ JD และ target weights
ตอบเป็น raw JSON ภาษาไทย ดังนี้:
{
  "jd_alignment_score": <0-100 ความสอดคล้องกับ JD>,
  "burnout_risk_score": <0-100 ความเสี่ยง burnout>,
  "workload_allocation": [
    {
      "category": "ชื่อหมวดงาน (ตรงกับ target weights)",
      "target_weight_pct": <เปอร์เซ็นต์เป้าหมาย>,
      "actual_weight_pct": <เปอร์เซ็นต์จริงจากชั่วโมง>,
      "evaluation": "สอดคล้อง | เกินเป้า | ต่ำกว่าเป้า"
    }
  ],
  "strengths": ["จุดเด่นที่ 1", "จุดเด่นที่ 2"],
  "improvements": ["สิ่งที่ควรปรับปรุงที่ 1", "สิ่งที่ 2"],
  "development_plan": {
    "short_term_90_days": "แผนพัฒนาระยะสั้น 90 วัน (เชิงปฏิบัติ)",
    "long_term_goals": "เป้าหมายการเติบโตระยะยาว"
  },
  "markdown_executive_summary": "## สรุปผลการวิเคราะห์\\n\\n**ความสอดคล้องกับ JD:** ...\\n\\n**ความเสี่ยง Burnout:** ...\\n\\n**การกระจายงาน:**\\n- ...\\n\\n**จุดเด่น:**\\n- ...\\n\\n**ข้อแนะนำ:**\\n- ..."
}`;
    }

    const { response, actualModel } = await callLlmWithFallback(
      endpoint, llmHeaders, provider, model, systemPrompt, userPrompt, true
    );

    const aiResult = await response.json();
    let content = aiResult.choices?.[0]?.message?.content || '';
    if (content.startsWith('```json')) {
      content = content.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (content.startsWith('```')) {
      content = content.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const parsedReport = JSON.parse(content);

    // Save to cache (record actualModel for display)
    await supabase.from('tb_ai_individual_analysis').insert({
      user_id,
      analysis_date: new Date().toISOString().split('T')[0],
      start_date,
      end_date,
      jd_alignment_score: parsedReport.jd_alignment_score || 0,
      burnout_risk_score: parsedReport.burnout_risk_score || 0,
      actual_vs_target: parsedReport.workload_allocation || [],
      strengths: parsedReport.strengths || [],
      improvements: parsedReport.improvements || [],
      development_plan: parsedReport.development_plan || {},
      raw_ai_report: parsedReport.markdown_executive_summary || 'ไม่มีสรุปผล',
      engine_model: actualModel,
    });

    return new Response(JSON.stringify({
      ...parsedReport,
      cached: false,
      actualModel,
      provider,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error('Edge function error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});

function aggregateWorklogs(logs: any[], onAddHours: (h: number) => void): string {
  const map = new Map<string, { hours: number; descList: Set<string> }>();
  logs.forEach(log => {
    const key = `${log.project_name} > ${log.action_name}`;
    if (!map.has(key)) map.set(key, { hours: 0, descList: new Set() });
    const val = map.get(key)!;
    val.hours += Number(log.total_hours || 0);
    onAddHours(Number(log.total_hours || 0));
    if (log.description) val.descList.add(log.description.substring(0, 80));
  });
  return Array.from(map.entries())
    .map(([k, v]) => `- [${k}]: รวม ${v.hours.toFixed(1)} ชม. (${Array.from(v.descList).slice(0, 3).join(', ')})`)
    .join('\n');
}
