import { createClient } from '@supabase/supabase-js';

export async function onRequest(context) {
  // CORS setup
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, start_date, end_date, force_refresh } = await context.request.json();

    if (!user_id || !start_date || !end_date) {
      return new Response(JSON.stringify({ error: 'Missing required parameters: user_id, start_date, end_date' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Retrieve Supabase environment variables from Cloudflare Pages environment
    const supabaseUrl = context.env.VITE_SUPABASE_URL || 'https://mcrmkyppxoityveebgex.supabase.co';
    const supabaseKey = context.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jcm1reXBweG9pdHl2ZWViZ2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMTQwNTAsImV4cCI6MjA5NDY5MDA1MH0.l_i-trILv4NYsUIalQEOuy4-wW7y7XZiVrhMjEQ7Mzs';
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Caching Strategy (Stale-While-Revalidate / Cache Check)
    if (!force_refresh) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const { data: cached, error: cacheErr } = await supabase
        .from('tb_ai_individual_analysis')
        .select('*')
        .eq('user_id', user_id)
        .eq('start_date', start_date)
        .eq('end_date', end_date)
        .gte('created_at', yesterday.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached) {
        return new Response(JSON.stringify({
          cached: true,
          jd_alignment_score: cached.jd_alignment_score,
          burnout_risk_score: cached.burnout_risk_score,
          workload_allocation: cached.actual_vs_target,
          strengths: cached.strengths,
          improvements: cached.improvements,
          development_plan: cached.development_plan,
          markdown_executive_summary: cached.raw_ai_report
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 2. Fetch User Profile, JD and Worklogs
    const [userRes, jdRes, logsRes] = await Promise.all([
      supabase.from('users').select('*').eq('id', user_id).single(),
      supabase.from('tb_user_jd').select('*').eq('user_id', user_id).maybeSingle(),
      supabase.from('col_worklog')
        .select('project_name, action_name, description, total_hours, work_date, is_ot')
        .eq('user_id', user_id)
        .gte('work_date', start_date)
        .lte('work_date', end_date)
    ]);

    if (userRes.error) throw new Error(`User profile not found: ${userRes.error.message}`);
    const userProfile = userRes.data;
    const userJd = jdRes.data;
    const rawLogs = logsRes.data || [];

    if (rawLogs.length === 0) {
      return new Response(JSON.stringify({
        error: 'No logs found',
        message: 'ไม่พบข้อมูลบันทึกเวลาทำงานของพนักงานในช่วงเวลาที่เลือก จึงไม่สามารถวิเคราะห์ข้อมูลได้'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Log Aggregation / Semantic Clustering (Optimize token usage)
    const totalHours = rawLogs.reduce((sum, l) => sum + (parseFloat(l.total_hours) || 0), 0);
    const otLogs = rawLogs.filter(l => l.is_ot);
    const otHours = otLogs.reduce((sum, l) => sum + (parseFloat(l.total_hours) || 0), 0);
    const otRate = totalHours > 0 ? Math.round((otHours / totalHours) * 100) : 0;
    
    // Group logs by project + action
    const aggregatedGroups = {};
    rawLogs.forEach(l => {
      const key = `${l.project_name || 'General'} | ${l.action_name || 'Task'}`;
      if (!aggregatedGroups[key]) {
        aggregatedGroups[key] = {
          project: l.project_name || 'General',
          action: l.action_name || 'Task',
          hours: 0,
          descriptions: new Set(),
        };
      }
      aggregatedGroups[key].hours += parseFloat(l.total_hours) || 0;
      if (l.description && l.description.trim()) {
        aggregatedGroups[key].descriptions.add(l.description.trim().substring(0, 100));
      }
    });

    const aggregatedLogsText = Object.values(aggregatedGroups)
      .map(g => {
        const samples = Array.from(g.descriptions).slice(0, 3).join('; ');
        const percent = totalHours > 0 ? ((g.hours / totalHours) * 100).toFixed(1) : '0.0';
        return `- **Project: ${g.project}**, Action: ${g.action} - ${g.hours.toFixed(1)} hrs (${percent}%) ${samples ? `(Samples: "${samples}")` : ''}`;
      })
      .join('\n');

    // Calculate duration in days
    const diffTime = Math.abs(new Date(end_date) - new Date(start_date));
    const durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const avgHoursPerDay = (totalHours / durationDays).toFixed(1);

    // 4. Fetch AI configurations from tb_system_config
    const { data: configRows, error: configErr } = await supabase
      .from('tb_system_config')
      .select('config_key, config_value');

    if (configErr) throw new Error(`Failed to load tb_system_config: ${configErr.message}`);

    const configs = {};
    configRows.forEach(row => {
      configs[row.config_key] = row.config_value;
    });

    const aiProvider = configs.ai_provider || 'openrouter';
    const aiModel = configs.ai_model || 'google/gemini-2.0-flash-exp:free';
    const openaiKey = configs.openai_api_key;
    const geminiKey = configs.gemini_api_key;
    const openrouterKey = configs.openrouter_api_key;

    // 5. Construct Prompts
    const jdText = userJd?.jd_text || `Standard job description for role ${userProfile.position || 'Employee'}`;
    const keyResponsibilities = userJd?.key_responsibilities 
      ? JSON.stringify(userJd.key_responsibilities)
      : JSON.stringify([{ category: "Core Responsibilities", weight: 100 }]);

    const systemPrompt = `You are an expert HR Business Partner (HRBP) and senior organizational talent diagnostics AI.
Your task is to analyze an employee's actual work logs against their target Job Description (JD) and produce a high-fidelity diagnostic report.

You must strictly return a valid JSON object matching the JSON schema below. Do not output conversational filler, preamble, markdown code blocks, or HTML tags. Just return the raw JSON object.

JSON FORMAT REQUIRED:
{
  "jd_alignment_score": integer (range 0 to 100 representing how well actual logs align with core JD tasks),
  "burnout_risk_score": integer (range 0 to 100, calculate based on daily average hours, OT frequency, and task scattering),
  "workload_allocation": [
    {
      "category": "string (name of category in JD or detected from logs)",
      "target_weight_pct": number (percent expected from JD),
      "actual_weight_pct": number (percent calculated from actual hours),
      "evaluation": "string (e.g. 'Aligned', 'Overloaded', 'Underutilized')"
    }
  ],
  "strengths": ["array of 3 specific areas where the employee demonstrated high achievement or alignment"],
  "improvements": ["array of 2-3 concrete areas where work shows deviation from JD or potential operational inefficiency"],
  "development_plan": {
    "short_term_90_days": "string (highly specific advice on what task boundaries to set, resources to read, or skills to acquire)",
    "long_term_goals": "string (career progression tips based on their current strengths)"
  },
  "markdown_executive_summary": "string (a beautifully formatted Markdown brief that will render in a professional card on our UI, highlighting why their allocation is structured this way, what needs adjustments, in a professional Thai language context)"
}`;

    const userPrompt = `[EMPLOYEE PROFILE]
- Name: ${userProfile.full_name || 'Teammate'} (${userProfile.nickname || 'N/A'})
- Current Role: ${userProfile.position || 'General Staff'}
- Department: ${userProfile.department || 'N/A'}

[TARGET JOB DESCRIPTION]
${jdText}

[TARGET RESPONSIBILITIES WEIGHTS]
${keyResponsibilities}

[ACTUAL LOGGED WORK DATA (Past ${durationDays} Days)]
Total effort hours logged: ${totalHours.toFixed(1)} hours
Average hours per day: ${avgHoursPerDay} hours
Overtime (OT) rate: ${otRate}%
Key tasks done with total duration and percentage:
${aggregatedLogsText}

Analyze this data and return the JSON response. Remember, output only valid JSON.`;

    let aiResponseText = '';

    // 6. Call the appropriate AI API Provider
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
      if (!response.ok) throw new Error(data.error?.message || 'Failed to fetch from OpenRouter');
      aiResponseText = data.choices?.[0]?.message?.content;

    } else if (aiProvider === 'openai') {
      if (!openaiKey) throw new Error('OpenAI API Key is not set in tb_system_config.');
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: aiModel || 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Failed to fetch from OpenAI');
      aiResponseText = data.choices?.[0]?.message?.content;

    } else if (aiProvider === 'gemini') {
      if (!geminiKey) throw new Error('Gemini API Key is not set in tb_system_config.');

      const modelId = aiModel.includes('/') ? aiModel.split('/')[1] : 'gemini-1.5-flash';
      const cleanModelId = modelId.replace(':free', '');
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${cleanModelId}:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
          ],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Failed to fetch from Gemini');
      aiResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    } else {
      throw new Error(`Unsupported AI Provider: ${aiProvider}`);
    }

    if (!aiResponseText) {
      throw new Error('AI Provider returned an empty response.');
    }

    // Clean response (sometimes models still put markdown fences even if json_object is requested)
    let cleanedJson = aiResponseText.trim();
    if (cleanedJson.startsWith('```json')) {
      cleanedJson = cleanedJson.substring(7);
    }
    if (cleanedJson.startsWith('```')) {
      cleanedJson = cleanedJson.substring(3);
    }
    if (cleanedJson.endsWith('```')) {
      cleanedJson = cleanedJson.substring(0, cleanedJson.length - 3);
    }
    cleanedJson = cleanedJson.trim();

    const parsedReport = JSON.parse(cleanedJson);

    // 7. Save cache in tb_ai_individual_analysis
    const dbRecord = {
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
      raw_ai_report: parsedReport.markdown_executive_summary || ''
    };

    // Insert new cache record
    const { error: insertErr } = await supabase
      .from('tb_ai_individual_analysis')
      .insert([dbRecord]);

    if (insertErr) {
      console.error('Failed to cache AI analysis:', insertErr);
    }

    return new Response(JSON.stringify(parsedReport), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('API Error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
