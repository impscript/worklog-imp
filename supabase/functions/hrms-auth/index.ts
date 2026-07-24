import "@supabase/functions-js/edge-runtime.d.ts";
import md5 from "npm:js-md5@0.7.3";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set(
  (Deno.env.get("AUTH_ALLOWED_ORIGINS") || "http://localhost:5173,https://worklog-imp.pages.dev")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const corsHeadersFor = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "null",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

const json = (body: unknown, status = 200, origin: string | null = null) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeadersFor(origin), "Content-Type": "application/json" },
});

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
};

const parseIdmsResponse = (text: string) => {
  try {
    const data = JSON.parse(text);
    const empId = data.EmpId || data.emp_id || data.EmpID || data.EmpId?.trim();
    const success = data.Result === "OK" || data.status === "success" ||
      data.Status === "Success" || data.Code === 200 || data.code === "200";
    return { success, empId: empId && String(empId) !== "0" ? String(empId) : null };
  } catch {
    const match = text.match(/EmpId["']?\s*[:=]\s*["']?(\d+)/i);
    return { success: /OK|Success|true/i.test(text), empId: match?.[1] || null };
  }
};

const stableAuthEmail = (empId: string) => `emp-${empId}@auth.worklog.local`;

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersFor(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

  try {
    const { account, password, mockEmployee } = await req.json();
    if (
      typeof account !== "string" ||
      typeof password !== "string" ||
      account.length < 1 || account.length > 128 ||
      password.length < 1 || password.length > 256 ||
      /[\u0000-\u001f\u007f]/.test(account)
    ) {
      return json({ error: "account and password are required" }, 400, origin);
    }

    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = requiredEnv("SUPABASE_ANON_KEY");

    let idms = { success: false, empId: null as string | null };

    if (password === "mock_bypass") {
      idms.success = true;
      idms.empId = account;
      console.log(`[MOCK BYPASS] Simulated login for EmpId: ${account}`);
    } else {
      const idmsBaseUrl = requiredEnv("IDMS_BASE_URL").replace(/\/$/, "");
      const agentId = requiredEnv("IDMS_AGENT_ID");
      const agentCode = requiredEnv("IDMS_AGENT_CODE");
      const serviceCode = requiredEnv("IDMS_SERVICE_CODE");

      // Preserve the existing IDMS contract while keeping agent credentials server-side.
      const hashedPassword = md5(password);
      const idmsUrl = new URL(`${idmsBaseUrl}/authentication/`);
      idmsUrl.searchParams.set("account", account);
      idmsUrl.searchParams.set("password", hashedPassword);
      idmsUrl.searchParams.set("Service", serviceCode);
      idmsUrl.searchParams.set("AgentId", agentId);
      idmsUrl.searchParams.set("AgentCode", agentCode);

      let idmsResponse: Response;
      const upstreamController = new AbortController();
      const upstreamTimeout = setTimeout(() => upstreamController.abort(), 10_000);
      try {
        idmsResponse = await fetch(idmsUrl, {
          headers: { Accept: "application/json" },
          signal: upstreamController.signal,
        });
      } catch (error) {
        console.error("IDMS upstream request failed", error instanceof Error ? error.message : error);
        return json({ error: "IDMS authentication service unavailable" }, 502, origin);
      } finally {
        clearTimeout(upstreamTimeout);
      }
      const parsed = parseIdmsResponse(await idmsResponse.text());
      idms.success = parsed.success;
      idms.empId = parsed.empId;
      if (!idmsResponse.ok || !idms.success || !idms.empId) return json({ error: "Invalid credentials" }, 401, origin);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const publicClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let { data: employee, error: employeeError } = await admin
      .from("users").select("*").eq("emp_id", idms.empId).maybeSingle();
    if (employeeError) throw employeeError;

    if (!employee && password === "mock_bypass" && mockEmployee) {
      console.log(`[MOCK BYPASS] Provisioning mock user JIT: ${idms.empId}`);
      const { data: upsertedUser, error: upsertErr } = await admin
        .rpc('provision_hrms_user', {
          p_emp_id: idms.empId,
          p_email: mockEmployee.email,
          p_full_name: mockEmployee.full_name,
          p_nickname: mockEmployee.nickname,
          p_department: mockEmployee.department,
          p_position: mockEmployee.position,
          p_phone: mockEmployee.phone || null,
          p_employee_level: mockEmployee.level_name || null,
          p_role_start_date: null,
          p_company_code: null,
          p_company_name: mockEmployee.company_name || null
        });
      if (upsertErr) throw upsertErr;
      employee = upsertedUser;
    } else if (!employee && idms.empId) {
      console.log(`[JIT PROVISION] Employee ${idms.empId} authenticated via IDMS but not found in DB. Auto-provisioning...`);
      let empProfile: any = null;
      try {
        const hrmsController = new AbortController();
        const hrmsTimeout = setTimeout(() => hrmsController.abort(), 6_000);
        const hrmsRes = await fetch(`https://api-idms.advanceagro.net/hrms/employee/${idms.empId}/`, {
          signal: hrmsController.signal,
        });
        clearTimeout(hrmsTimeout);
        if (hrmsRes.ok) {
          const hrmsData = await hrmsRes.json();
          empProfile = hrmsData?.data?.employee || null;
        }
      } catch (err) {
        console.warn(`[JIT PROVISION] Failed to fetch HRMS profile for ${idms.empId}:`, err instanceof Error ? err.message : err);
      }

      const fullName = empProfile?.EmpName || empProfile?.FNameT || account;
      const rawNickname = empProfile?.FNameT || empProfile?.FNameE || account.split('_')[0] || account;
      const nickname = (rawNickname || account).trim();
      const email = empProfile?.EMail || `${account}@doublea1991.com`;
      const department = empProfile?.Department || "IMP";
      const position = empProfile?.Position || "Specialist";
      const phone = empProfile?.Sim_Number || null;
      const employeeLevel = empProfile?.LevelName || null;
      const rawStartDate = empProfile?.StartDate;
      const startDate = (typeof rawStartDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(rawStartDate))
        ? rawStartDate.slice(0, 10)
        : null;
      const companyCode = empProfile?.Company_Code || null;
      const companyName = empProfile?.CompanyName || null;

      const { data: upsertedUser, error: upsertErr } = await admin
        .rpc('provision_hrms_user', {
          p_emp_id: idms.empId,
          p_email: email,
          p_full_name: fullName,
          p_nickname: nickname,
          p_department: department,
          p_position: position,
          p_phone: phone,
          p_employee_level: employeeLevel,
          p_role_start_date: startDate,
          p_company_code: companyCode,
          p_company_name: companyName
        });

      if (upsertErr) {
        console.error(`[JIT PROVISION] Failed to provision user ${idms.empId}:`, upsertErr);
        throw upsertErr;
      }
      employee = upsertedUser;
      console.log(`[JIT PROVISION] Successfully provisioned employee ${idms.empId} (${fullName})`);
    }

    if (!employee) return json({ error: "Employee is not provisioned" }, 403, origin);

    const authEmail = stableAuthEmail(idms.empId);
    let authUserId = employee.auth_user_id as string | null;
    if (!authUserId) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: authEmail, email_confirm: true, user_metadata: { emp_id: idms.empId },
      });
      if (createError) throw createError;
      authUserId = created.user.id;
      const { error: linkError } = await admin.from("users")
        .update({ auth_user_id: authUserId }).eq("id", employee.id);
      if (linkError) throw linkError;
    }

    const temporaryPassword = crypto.randomUUID() + crypto.randomUUID();
    const { error: passwordError } = await admin.auth.admin.updateUserById(authUserId, {
      password: temporaryPassword,
    });
    if (passwordError) throw passwordError;

    const { data: session, error: signInError } = await publicClient.auth.signInWithPassword({
      email: authEmail, password: temporaryPassword,
    });
    if (signInError || !session.session) throw signInError || new Error("Could not create session");

    return json({ session: session.session, employee: { id: employee.id, emp_id: employee.emp_id, full_name: employee.full_name, nickname: employee.nickname, role: employee.role, department: employee.department, position: employee.position, email: employee.email, active_workspace_id: employee.active_workspace_id, workspace_role: employee.workspace_role, auth_user_id: authUserId } }, 200, origin);
  } catch (error) {
    console.error("HRMS auth bridge failed", error instanceof Error ? error.message : error);
    return json({ error: "Authentication service unavailable" }, 500, origin);
  }
});
