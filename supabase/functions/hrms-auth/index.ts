import "@supabase/functions-js/edge-runtime.d.ts";
import md5 from "npm:js-md5@0.7.3";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { account, password } = await req.json();
    if (typeof account !== "string" || typeof password !== "string" || !account || !password) {
      return json({ error: "account and password are required" }, 400);
    }

    const idmsBaseUrl = requiredEnv("IDMS_BASE_URL").replace(/\/$/, "");
    const agentId = requiredEnv("IDMS_AGENT_ID");
    const agentCode = requiredEnv("IDMS_AGENT_CODE");
    const serviceCode = requiredEnv("IDMS_SERVICE_CODE");
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = requiredEnv("SUPABASE_ANON_KEY");

    // Preserve the existing IDMS contract while keeping agent credentials server-side.
    const hashedPassword = md5(password);
    const idmsUrl = new URL(`${idmsBaseUrl}/authentication/`);
    idmsUrl.searchParams.set("account", account);
    idmsUrl.searchParams.set("password", hashedPassword);
    idmsUrl.searchParams.set("Service", serviceCode);
    idmsUrl.searchParams.set("AgentId", agentId);
    idmsUrl.searchParams.set("AgentCode", agentCode);

    let idmsResponse: Response;
    try {
      idmsResponse = await fetch(idmsUrl, { headers: { Accept: "application/json" } });
    } catch (error) {
      console.error("IDMS upstream request failed", error instanceof Error ? error.message : error);
      return json({ error: "IDMS authentication service unavailable" }, 502);
    }
    const idms = parseIdmsResponse(await idmsResponse.text());
    if (!idmsResponse.ok || !idms.success || !idms.empId) return json({ error: "Invalid credentials" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const publicClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: employee, error: employeeError } = await admin
      .from("users").select("*").eq("emp_id", idms.empId).maybeSingle();
    if (employeeError) throw employeeError;
    if (!employee) return json({ error: "Employee is not provisioned" }, 403);

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

    return json({ session: session.session, employee: { ...employee, auth_user_id: authUserId } });
  } catch (error) {
    console.error("HRMS auth bridge failed", error instanceof Error ? error.message : error);
    return json({ error: "Authentication service unavailable" }, 500);
  }
});
