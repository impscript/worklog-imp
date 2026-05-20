import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function callLlmWithFallback(
  endpoint: string,
  headers: Record<string, string>,
  provider: string,
  configuredModel: string,
  systemPrompt: string,
  userPrompt: string,
  isJson: boolean = false
): Promise<Response> {
  const modelsToTry = [configuredModel];
  if (provider === 'openrouter') {
    // List of fallback free models on OpenRouter
    const fallbacks = [
      'google/gemini-2.0-flash-exp:free',
      'google/gemini-2.0-pro-exp:free',
      'openrouter/free',
      'meta-llama/llama-3-8b-instruct:free'
    ];
    for (const fb of fallbacks) {
      if (fb !== configuredModel) {
        modelsToTry.push(fb);
      }
    }
  }

  let lastError: Error | null = null;
  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];
    try {
      console.log(`[AI Request] Trying model: ${currentModel} (${i + 1}/${modelsToTry.length})`);
      const bodyPayload: any = {
        model: currentModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      };
      if (isJson) {
        bodyPayload.response_format = { type: "json_object" };
      }
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(bodyPayload)
      });

      if (response.ok) {
        console.log(`[AI Request] Successfully got response from model: ${currentModel}`);
        return response;
      }
      
      const errorText = await response.text();
      console.warn(`[AI Request] Model ${currentModel} failed with status ${response.status}: ${errorText}`);
      lastError = new Error(`AI API (${currentModel}) failed: ${response.status} ${errorText}`);
    } catch (err: any) {
      console.warn(`[AI Request] Network or fetch error for model ${currentModel}:`, err.message);
      lastError = err;
    }
  }
  throw lastError || new Error("All models failed to respond.");
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    // 1. Initialize Supabase Client with Service Role Key for Admin Access
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Fetch AI Configurations from tb_system_config
    const { data: configsData, error: configError } = await supabase
      .from('tb_system_config')
      .select('config_key, config_value');

    if (configError) throw new Error('Cannot read AI configuration: ' + configError.message);

    const configs: Record<string, string> = {};
    configsData.forEach(row => { configs[row.config_key] = row.config_value; });

    const provider = configs.ai_provider || 'openrouter';
    const model = configs.ai_model || 'google/gemini-2.0-flash-exp:free';
    
    let apiKey = '';
    let endpoint = '';

    if (provider === 'openrouter') {
      apiKey = configs.openrouter_api_key;
      endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    } else if (provider === 'gemini') {
      apiKey = configs.gemini_api_key;
      endpoint = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`; 
    } else if (provider === 'openai') {
      apiKey = configs.openai_api_key;
      endpoint = 'https://api.openai.com/v1/chat/completions';
    } else if (provider === 'opencode') {
      apiKey = configs.opencode_api_key;
      endpoint = 'https://api.opencode.so/v1/chat/completions';
    }

    if (!apiKey) {
      throw new Error(`API Key for ${provider} is not configured.`);
    }

    const llmHeaders: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    };

    if (provider === 'openrouter') {
      llmHeaders["HTTP-Referer"] = "https://vibecode.net"; 
      llmHeaders["X-Title"] = "Worklog HRBP";
    }

    // 2.1 Description Enhancement branch
    if (action === 'enhance_description') {
      const { description, project_name, action_name, duration } = body;
      
      const customPromptOverride = configs.ai_enhancement_prompt || '';

      const systemPrompt = `You are a professional HR assistant specialized in refining work logs.
Your task is to rephrase the given work description to highlight business impact, process improvements, cost savings, time saved, and overall value added for executives and managers.
Keep it highly professional, positive, clear, and action-oriented.
Return ONLY the rephrased text. Do not add intro/outro text, conversational remarks, or markdown code blocks.
${customPromptOverride ? `\nFollow these custom guidelines: ${customPromptOverride}` : ''}`;

      const userPrompt = `
[CONTEXT]
Project: ${project_name || 'N/A'}
Action Category: ${action_name || 'N/A'}
Duration: ${duration ? `${duration} hours` : 'N/A'}

[ORIGINAL WORK DESCRIPTION]
${description || '(Empty)'}

INSTRUCTION:
Politely rephrase this work log in the same language it was written (Thai or English) to sound extremely professional, emphasizing business impact, cost-saving, time efficiency, and strategic execution. Keep it concise (1-3 sentences). Only return the final refined description text.`;

      const response = await callLlmWithFallback(
        endpoint,
        llmHeaders,
        provider,
        model,
        systemPrompt,
        userPrompt,
        false
      );

      const aiResult = await response.json();
      let enhancedText = aiResult.choices?.[0]?.message?.content || '';
      
      // Clean up any markdown blocks if the LLM returned it wrapped
      enhancedText = enhancedText.replace(/^```[a-zA-Z]*/, '').replace(/```$/, '').trim();

      return new Response(JSON.stringify({ enhanced_text: enhancedText }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Default performance diagnostics logic
    const { user_id, start_date, end_date, force_refresh } = body;
    
    if (!user_id || !start_date || !end_date) {
      throw new Error('Missing required fields (user_id, start_date, end_date)');
    }

    // 3. Check Cache
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
          cached: true
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // 4. Fetch User Data and JD
    const { data: userProfile } = await supabase.from('users').select('*').eq('id', user_id).single();
    let jdText = "No Job Description provided.";
    let keyResponsibilities = [];
    
    const { data: userJd } = await supabase.from('tb_user_jd').select('*').eq('user_id', user_id).single();
    if (userJd) {
      jdText = userJd.jd_text;
      keyResponsibilities = userJd.key_responsibilities || [];
    }

    // 5. Fetch Worklogs and Aggregate
    const { data: logs } = await supabase
      .from('col_worklog')
      .select('project_name, action_name, description, total_hours')
      .eq('user_id', user_id)
      .gte('work_date', start_date)
      .lte('work_date', end_date);

    let totalHours = 0;
    const aggregatedLogs = aggregateWorklogs(logs || [], (hours) => { totalHours += hours; });
    const durationDays = (new Date(end_date).getTime() - new Date(start_date).getTime()) / (1000 * 3600 * 24) + 1;
    const avgHoursPerDay = (totalHours / durationDays).toFixed(2);

    // 6. Call LLM API
    const systemPrompt = `You are a professional HR diagnostic agent analyzing employee performance and workload.
You must STRICTLY return a JSON object containing the exact keys requested. Do not return markdown wrapped JSON blocks.`;

    const userPrompt = `
[EMPLOYEE PROFILE]
Name: ${userProfile?.full_name || 'Unknown'}
Position: ${userJd?.position_name || userProfile?.position || 'General Staff'}
Role: ${userProfile?.role || 'Unknown'}
Department: ${userProfile?.department || 'Unknown'}

[TARGET JOB DESCRIPTION]
${jdText}

[ACTUAL LOGGED WORK DATA (Past ${durationDays} Days)]
Total effort hours logged: ${totalHours} hours
Average hours per day: ${avgHoursPerDay} hours
Key tasks done:
${aggregatedLogs}

INSTRUCTION:
Strictly return a raw JSON object (no markdown wrapping) matching this schema:
{
  "jd_alignment_score": integer (0 to 100),
  "burnout_risk_score": integer (0 to 100),
  "workload_allocation": [
    {
      "category": "string (name of category)",
      "target_weight_pct": number (percent expected from JD),
      "actual_weight_pct": number (percent calculated from actual hours),
      "evaluation": "string (e.g. 'Aligned', 'Overloaded', 'Underutilized')"
    }
  ],
  "strengths": ["string"],
  "improvements": ["string"],
  "development_plan": {
    "short_term_90_days": "string",
    "long_term_goals": "string"
  },
  "markdown_executive_summary": "string (formatted markdown)"
}
`;

    const response = await callLlmWithFallback(
      endpoint,
      llmHeaders,
      provider,
      model,
      systemPrompt,
      userPrompt,
      true
    );

    const aiResult = await response.json();
    let content = aiResult.choices?.[0]?.message?.content;
    
    // Strip markdown formatting if the model still wraps it
    if (content.startsWith('```json')) {
      content = content.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (content.startsWith('```')) {
      content = content.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const parsedReport = JSON.parse(content);

    // 7. Save to Cache
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
      raw_ai_report: parsedReport.markdown_executive_summary || "No summary provided."
    });

    return new Response(JSON.stringify({ ...parsedReport, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error('Edge function error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders
    });
  }
});

function aggregateWorklogs(logs: any[], onAddHours: (h: number) => void) {
  const map = new Map();
  logs.forEach(log => {
    const key = `${log.project_name} > ${log.action_name}`;
    if (!map.has(key)) map.set(key, { hours: 0, descList: new Set() });
    const val = map.get(key);
    val.hours += Number(log.total_hours || 0);
    onAddHours(Number(log.total_hours || 0));
    if (log.description) val.descList.add(log.description.substring(0, 80));
  });
  return Array.from(map.entries()).map(([k, v]) => `- [${k}]: Total ${v.hours.toFixed(1)}h. (Details: ${Array.from(v.descList).slice(0, 3).join(', ')})`).join('\n');
}
