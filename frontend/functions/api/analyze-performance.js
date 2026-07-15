import { createClient } from '@supabase/supabase-js';

export async function onRequest(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await context.request.json();
    const {
      user_id,
      start_date,
      end_date,
      force_refresh,
      template_id = 'master',       // 'master' | 'individual_coach'
      cadence_type,                  // 'weekly' | 'monthly' | 'quarterly'
      employee_level,                // override ถ้า UI ส่งมา
      manager_name,                  // override ถ้า UI ส่งมา
      action                         // 'recommend_jd' หรือ undefined
    } = body;

    const supabaseUrl = context.env.VITE_SUPABASE_URL || 'https://mcrmkyppxoityveebgex.supabase.co';
    const supabaseKey = context.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jcm1reXBweG9pdHl2ZWViZ2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMTQwNTAsImV4cCI6MjA5NDY5MDA1MH0.l_i-trILv4NYsUIalQEOuy4-wW7y7XZiVrhMjEQ7Mzs';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Resolve workspace ID from JWT
    let jwtUserId = null;
    const authHeader = context.request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          jwtUserId = payload.sub || null;
        }
      } catch (err) {
        console.warn('Error decoding JWT payload in Cloudflare Function:', err);
      }
    }
    const targetUserId = jwtUserId || user_id;

    let workspaceId = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001'; // Default
    if (targetUserId) {
      const { data: userProfile } = await supabase
        .from('users')
        .select('active_workspace_id')
        .eq('id', targetUserId)
        .maybeSingle();
      if (userProfile?.active_workspace_id) {
        workspaceId = userProfile.active_workspace_id;
      }
    }

    // ── Handle Sub-actions (recommend_jd) ──────────────────────────────
    if (action === 'recommend_jd') {
      const { position, target_weights } = body;
      const { data: configRows } = await supabase
        .from('tb_system_config')
        .select('config_key, config_value')
        .eq('workspace_id', workspaceId);
      const configs = Object.fromEntries((configRows || []).map(r => [r.config_key, r.config_value]));

      const jdPrompt = `You are an expert HR consultant. Recommend a realistic Job Description and key responsibility weights for the following position.
Position: ${position || 'General Staff'}
${target_weights && target_weights.length > 0 ? `Current weights hint: ${JSON.stringify(target_weights)}` : ''}

Return ONLY valid JSON in this format:
{
  "jd_text": "Full job description text in Thai language",
  "key_responsibilities": [
    { "category": "string", "weight": number }
  ]
}
Weights must sum to exactly 100.`;

      const aiText = await callAI(configs, jdPrompt, jdPrompt);
      const parsed = parseAIJson(aiText);
      return new Response(JSON.stringify({ ...parsed, actualModel: configs.ai_model }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── Validate required params ───────────────────────────────────────
    if (!user_id || !start_date || !end_date) {
      return new Response(JSON.stringify({ error: 'Missing required parameters: user_id, start_date, end_date' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── 1. Cache Check ─────────────────────────────────────────────────
    if (!force_refresh) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data: cached } = await supabase
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

      if (cached) {
        return new Response(JSON.stringify({
          cached: true,
          id: cached.id,
          share_token: cached.share_token,
          is_public: cached.is_public,
          acknowledged_at: cached.acknowledged_at,
          acknowledged_by: cached.acknowledged_by,
          template_id: cached.template_id,
          jd_alignment_score: cached.jd_alignment_score,
          burnout_risk_score: cached.burnout_risk_score,
          reflection_level: cached.reflection_level,
          value_mix: cached.value_mix,
          overall_health: cached.overall_health,
          workload_allocation: cached.actual_vs_target,
          headline_insight: cached.headline_insight,
          strengths: cached.strengths,
          improvements: cached.improvements,
          coaching_guide: cached.coaching_guide,
          development_plan: cached.development_plan,
          well_being_signal: cached.well_being_signal,
          message_to_employee: cached.message_to_employee,
          markdown_executive_summary: cached.raw_ai_report,
          engine_model: cached.engine_model,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ── 2. Fetch User, JD, Worklogs, Template ─────────────────────────
    const [userRes, jdRes, logsRes, templateRes, configRes] = await Promise.all([
      supabase.from('users').select('*').eq('id', user_id).single(),
      supabase.from('tb_user_jd').select('*').eq('user_id', user_id).maybeSingle(),
      supabase.from('col_worklog')
        .select('project_name, action_name, description, total_hours, work_date, is_ot')
        .eq('user_id', user_id)
        .gte('work_date', start_date)
        .lte('work_date', end_date),
      supabase.from('tb_ai_prompt_templates')
        .select('*')
        .eq('template_key', template_id)
        .eq('is_active', true)
        .maybeSingle(),
      supabase.from('tb_system_config')
        .select('config_key, config_value')
        .eq('workspace_id', workspaceId)
    ]);

    if (userRes.error) throw new Error(`User not found: ${userRes.error.message}`);
    const userProfile = userRes.data;
    const userJd = jdRes.data;
    const rawLogs = logsRes.data || [];
    const template = templateRes.data;
    const configs = Object.fromEntries((configRes.data || []).map(r => [r.config_key, r.config_value]));

    if (!template) {
      throw new Error(`Prompt template "${template_id}" not found or inactive. Please check Admin → AI Prompts.`);
    }

    if (rawLogs.length === 0) {
      return new Response(JSON.stringify({
        error: 'No logs found',
        message: 'ไม่พบข้อมูลบันทึกเวลาทำงานของพนักงานในช่วงเวลาที่เลือก'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── 3. Log Aggregation ─────────────────────────────────────────────
    const totalHours = rawLogs.reduce((s, l) => s + (parseFloat(l.total_hours) || 0), 0);
    const otLogs = rawLogs.filter(l => l.is_ot);
    const otHours = otLogs.reduce((s, l) => s + (parseFloat(l.total_hours) || 0), 0);
    const otRate = totalHours > 0 ? Math.round((otHours / totalHours) * 100) : 0;

    const aggregatedGroups = {};
    rawLogs.forEach(l => {
      const key = `${l.project_name || 'General'} | ${l.action_name || 'Task'}`;
      if (!aggregatedGroups[key]) {
        aggregatedGroups[key] = { project: l.project_name || 'General', action: l.action_name || 'Task', hours: 0, descriptions: new Set() };
      }
      aggregatedGroups[key].hours += parseFloat(l.total_hours) || 0;
      if (l.description?.trim()) aggregatedGroups[key].descriptions.add(l.description.trim().substring(0, 120));
    });

    const aggregatedLogsText = Object.values(aggregatedGroups)
      .sort((a, b) => b.hours - a.hours)
      .map(g => {
        const pct = totalHours > 0 ? ((g.hours / totalHours) * 100).toFixed(1) : '0.0';
        const samples = [...g.descriptions].slice(0, 3).join('; ');
        return `- Project: ${g.project} | Action: ${g.action} → ${g.hours.toFixed(1)} hrs (${pct}%)${samples ? ` | Samples: "${samples}"` : ''}`;
      }).join('\n');

    const diffTime = Math.abs(new Date(end_date) - new Date(start_date));
    const durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const avgHoursPerDay = (totalHours / durationDays).toFixed(1);

    // ── 4. Fetch Previous Period Summary (for historical baseline) ─────
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

    // ── 5. Build Prompt Variables ──────────────────────────────────────
    const jdText = userJd?.jd_text || `Standard job description for ${userProfile.position || 'Employee'}`;
    const keyResponsibilitiesJson = JSON.stringify(
      userJd?.key_responsibilities || [{ category: 'Core Responsibilities', weight: 100 }]
    );

    const resolvedLevel = employee_level || userProfile.employee_level || 'Senior';
    const resolvedManager = manager_name || userProfile.manager_name || 'หัวหน้างาน';

    // Cadence logic
    const cadenceResolved = cadence_type || detectCadence(durationDays);
    const periodLabel = buildPeriodLabel(cadenceResolved, start_date, end_date);

    const cadenceInstructions = {
      weekly: 'CADENCE = Weekly → เน้น tactical observation และ immediate adjustment. ระบุ Coaching Question 2-3 ข้อสำหรับ 1:1 สัปดาห์นี้โดยเฉพาะ',
      monthly: 'CADENCE = Monthly → เน้น pattern emergence และ habit formation. Compare กับ previous month ถ้ามี. Identify trend ที่ก่อตัว (positive/negative)',
      quarterly: 'CADENCE = Quarterly → เน้น development planning และ career trajectory. ประเมิน Skill development. Review ว่า JD ยัง fit งานจริงหรือไม่. Recommendation for next quarter'
    };

    const levelInstructions = {
      Director: 'EMPLOYEE_LEVEL = Director → เน้น Leadership Effectiveness, Delegation Quality, Strategic Time Investment. ระวัง "Leadership Trap" (จมงาน operational). ประเมิน Coaching Time ที่ใช้พัฒนาทีม',
      Manager: 'EMPLOYEE_LEVEL = Manager/Lead → เน้น Team Output, Project Delivery, People Development. Balance ระหว่าง Doing และ Managing',
      Senior: 'EMPLOYEE_LEVEL = Senior → เน้น Technical Depth, Mentoring, Initiative Taking. ดูว่าเริ่ม transition สู่ leadership หรือยัง',
      Junior: 'EMPLOYEE_LEVEL = Junior → เน้น Skill Building, Learning Velocity, Task Mastery. ระวัง Overload หรือ Under-challenge'
    };

    // ── 6. Variable Injection into template ───────────────────────────
    const today = new Date().toISOString().split('T')[0];
    const yearsInRole = userProfile.role_start_date 
      ? ((new Date() - new Date(userProfile.role_start_date)) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1) 
      : 'N/A';

    let userPromptFilled = template.user_prompt_template
      .replace(/{{TODAY}}/g, today)
      .replace(/{{CADENCE_TYPE}}/g, cadenceResolved.toUpperCase())
      .replace(/{{PERIOD_START_DATE}}/g, start_date)
      .replace(/{{PERIOD_END_DATE}}/g, end_date)
      .replace(/{{PERIOD_LABEL}}/g, periodLabel)
      .replace(/{{EMPLOYEE_NAME}}/g, userProfile.full_name || 'Teammate')
      .replace(/{{EMPLOYEE_NICKNAME}}/g, userProfile.nickname || 'N/A')
      .replace(/{{EMPLOYEE_ROLE}}/g, userProfile.position || 'General Staff')
      .replace(/{{EMPLOYEE_LEVEL}}/g, resolvedLevel)
      .replace(/{{YEARS_IN_ROLE}}/g, String(yearsInRole))
      .replace(/{{MANAGER_NAME}}/g, resolvedManager)
      .replace(/{{EMPLOYEE_DEPARTMENT}}/g, userProfile.department || 'N/A')
      .replace(/{{TOTAL_HOURS}}/g, totalHours.toFixed(1))
      .replace(/{{AVG_HOURS_PER_DAY}}/g, avgHoursPerDay)
      .replace(/{{OT_RATE}}/g, String(otRate))
      .replace(/{{DURATION_DAYS}}/g, String(durationDays))
      .replace(/{{LOGS_COUNT}}/g, String(rawLogs.length))
      .replace(/{{INDIVIDUAL_WORKLOG_JSON_OR_CSV}}/g, aggregatedLogsText)
      .replace(/{{INDIVIDUAL_JD_DATA}}/g, jdText)
      .replace(/{{KEY_RESPONSIBILITIES_JSON}}/g, keyResponsibilitiesJson)
      .replace(/{{PREVIOUS_PERIOD_SUMMARY}}/g, previousPeriodSummary)
      .replace(/{{CADENCE_INSTRUCTION}}/g, cadenceInstructions[cadenceResolved] || cadenceInstructions.monthly)
      .replace(/{{ROLE_LEVEL_INSTRUCTION}}/g, levelInstructions[resolvedLevel] || levelInstructions.Senior);

    // ── 7. Call AI ────────────────────────────────────────────────────
    const aiResponseText = await callAI(configs, template.system_prompt, userPromptFilled);
    const parsedReport = parseAIJson(aiResponseText);

    // ── 8. Map result to DB record ─────────────────────────────────────
    const isCoachTemplate = template_id === 'individual_coach';

    const dbRecord = {
      user_id,
      analysis_date: today,
      start_date,
      end_date,
      template_id,
      cadence_type: cadenceResolved,
      engine_model: configs.ai_model || 'unknown',

      // Common fields
      jd_alignment_score: parsedReport.jd_alignment_score || 0,
      burnout_risk_score: parsedReport.burnout_risk_score || 0,
      actual_vs_target: parsedReport.workload_allocation || parsedReport.actual_vs_target || [],
      strengths: isCoachTemplate
        ? (parsedReport.strengths || []).map(s => typeof s === 'string' ? s : JSON.stringify(s))
        : (parsedReport.strengths || []),
      improvements: isCoachTemplate
        ? (parsedReport.improvements || []).map(i => typeof i === 'string' ? i : JSON.stringify(i))
        : (parsedReport.improvements || []),
      development_plan: parsedReport.development_plan || {},
      raw_ai_report: parsedReport.markdown_executive_summary || '',

      // Extended fields (individual_coach)
      reflection_level: parsedReport.reflection_level || null,
      value_mix: parsedReport.value_mix || null,
      headline_insight: parsedReport.headline_insight || null,
      coaching_guide: parsedReport.coaching_guide || null,
      well_being_signal: parsedReport.well_being_signal || null,
      message_to_employee: parsedReport.message_to_employee || null,
    };

    const { data: inserted, error: insertErr } = await supabase
      .from('tb_ai_individual_analysis')
      .insert([dbRecord])
      .select()
      .single();

    if (insertErr) console.error('Cache insert error:', insertErr);

    const responsePayload = {
      id: inserted?.id,
      share_token: inserted?.share_token,
      is_public: inserted?.is_public || false,
      template_id,
      cadence_type: cadenceResolved,
      ...parsedReport,
      workload_allocation: parsedReport.workload_allocation || parsedReport.actual_vs_target || [],
      markdown_executive_summary: parsedReport.markdown_executive_summary,
      actualModel: configs.ai_model,
      provider: configs.ai_provider,
    };

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('API Error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function detectCadence(durationDays) {
  if (durationDays <= 9) return 'weekly';
  if (durationDays <= 35) return 'monthly';
  return 'quarterly';
}

function buildPeriodLabel(cadence, start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const monthTh = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  if (cadence === 'weekly') return `สัปดาห์ ${start} ถึง ${end}`;
  if (cadence === 'monthly') return `${monthTh[s.getMonth()]} ${s.getFullYear() + 543}`;
  return `${monthTh[s.getMonth()]}–${monthTh[e.getMonth()]} ${s.getFullYear() + 543}`;
}

async function callAI(configs, systemPrompt, userPrompt) {
  const aiProvider = configs.ai_provider || 'openrouter';
  const aiModel = configs.ai_model || 'google/gemini-2.0-flash-exp:free';
  const openrouterKey = configs.openrouter_api_key;
  const openaiKey = configs.openai_api_key;
  const geminiKey = configs.gemini_api_key;

  let aiResponseText = '';

  if (aiProvider === 'openrouter') {
    if (!openrouterKey) throw new Error('OpenRouter API Key is not set in tb_system_config.');
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://worklog-newgen.advanceagro.com',
        'X-Title': 'Worklog NewGen Diagnostics'
      },
      body: JSON.stringify({
        model: aiModel,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'OpenRouter error');
    aiResponseText = data.choices?.[0]?.message?.content;

  } else if (aiProvider === 'openai') {
    if (!openaiKey) throw new Error('OpenAI API Key is not set.');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: aiModel || 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'OpenAI error');
    aiResponseText = data.choices?.[0]?.message?.content;

  } else if (aiProvider === 'gemini') {
    if (!geminiKey) throw new Error('Gemini API Key is not set.');
    const modelId = (aiModel.includes('/') ? aiModel.split('/')[1] : 'gemini-1.5-flash').replace(':free', '');
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Gemini error');
    aiResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  } else if (aiProvider === 'opencode') {
    // opencode uses openai-compatible endpoint
    const openCodeBase = configs.opencode_base_url || 'https://api.opencode.ai/v1';
    const openCodeKey = configs.opencode_api_key;
    if (!openCodeKey) throw new Error('OpenCode API Key is not set in tb_system_config.');
    const response = await fetch(`${openCodeBase}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openCodeKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: aiModel,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'OpenCode error');
    aiResponseText = data.choices?.[0]?.message?.content;

  } else {
    throw new Error(`Unsupported AI Provider: ${aiProvider}`);
  }

  if (!aiResponseText) throw new Error('AI returned empty response.');
  return aiResponseText;
}

function parseAIJson(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  return JSON.parse(cleaned.trim());
}
