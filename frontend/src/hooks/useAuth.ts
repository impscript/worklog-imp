import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import md5 from 'js-md5';

export interface UserSession {
  id: string;
  empId: string;
  name: string;
  nickname: string;
  role: 'user' | 'admin';
  department: string;
  position?: string;
  email?: string;
}

export function useAuth() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const sessionStr = sessionStorage.getItem('worklog_session');
    if (sessionStr) {
      try {
        setUser(JSON.parse(sessionStr));
      } catch (e) {
        console.error('Failed to parse active session:', e);
        sessionStorage.removeItem('worklog_session');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (account: string, password?: string): Promise<UserSession> => {
    setIsLoading(true);
    try {
      const username = account.trim();
      if (!username) {
        throw new Error('Please enter a username');
      }

      let userRecord: any = null;

      // ==========================================
      // Mode 1: Local / Developer Staging Auth
      // ==========================================
      if (import.meta.env.DEV && !password) {
        // --- Simulated (no password) — quick dev iteration ---
        console.log('[DEV SIMULATED] No password, using simulated auth...', { username });
        await new Promise((resolve) => setTimeout(resolve, 600));

        const { data: matchedUsers, error: queryErr } = await supabase
          .from('users')
          .select('*')
          .ilike('nickname', username)
          .order('created_at', { ascending: false })
          .limit(1);

        if (queryErr) throw queryErr;
        userRecord = matchedUsers?.[0] ?? null;

        if (!userRecord) {
          const formattedFullName = username.charAt(0).toUpperCase() + username.slice(1);
          const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert({
              emp_id: `EMP-${Math.floor(Math.random() * 90000 + 10000)}`,
              email: `${username.toLowerCase()}@doublea1991.com`,
              full_name: `${formattedFullName} (Dev)`,
              nickname: formattedFullName,
              role: username.toLowerCase() === 'admin' ? 'admin' : 'user',
              department: 'IMP',
              position: 'Specialist'
            })
            .select('*')
            .maybeSingle();

          if (createError) throw createError;
          userRecord = newUser;
        }
      }
      // ==========================================
      // Mode 2: Live Enterprise IDMS/HRMS Auth
      // (PROD always, DEV when password is provided)
      // ==========================================
      else {
        const modeLabel = import.meta.env.DEV ? '[DEV+REAL API]' : '[PROD]';
        console.log(`${modeLabel} Routing handshake to HRMS/IDMS proxy gateway...`);

        if (!password) {
          throw new Error('Please enter a password');
        }

        // 1. Authenticate with IDMS
        const agentId = import.meta.env.VITE_IDMS_AGENT_ID || 'SystemMango';
        const agentCode = import.meta.env.VITE_IDMS_AGENT_CODE || 'Np4kfRh5';
        const serviceCode = import.meta.env.VITE_IDMS_SERVICE_CODE || '0000';
        const hashedPassword = (md5 as any)(password);

        const idmsUrl = `/api/idms/authentication/?account=${encodeURIComponent(username)}&password=${encodeURIComponent(hashedPassword)}&Service=${serviceCode}&AgentId=${agentId}&AgentCode=${agentCode}`;
        
        let authText = '';
        try {
          const authRes = await fetch(idmsUrl);
          authText = await authRes.text();
        } catch (fetchErr: any) {
          throw new Error('ไม่สามารถเชื่อมต่อระบบ HRMS ได้ (Proxy Error)');
        }

        let empId: string | null = null;
        let isSuccess = false;
        
        try {
          const authData = JSON.parse(authText);
          isSuccess = authData.Result === 'OK' || authData.status === 'success' || authData.Status === 'Success' || authData.Code === 200 || authData.code === '200';
          empId = authData.EmpId || authData.emp_id || authData.EmpID || authData.EmpId?.trim() || null;
          if (empId === '0') {
            isSuccess = false;
            empId = null;
          }
        } catch {
          if (authText.includes('OK') || authText.includes('Success') || authText.includes('true')) {
            isSuccess = true;
            const match = authText.match(/EmpId["']?\s*[:=]\s*["']?(\d+)/i);
            if (match) empId = match[1];
          }
        }

        if (!isSuccess || !empId) {
          console.error('IDMS Raw Response:', authText);
          throw new Error('ชื่อผู้ใช้หรือรหัสผ่านของระบบ IDMS ไม่ถูกต้อง');
        }

        console.log(`${modeLabel} IDMS auth OK — EmpId: ${empId}`);

        // 2. Fetch Employee Data from HRMS
        let employeeData: any = {};
        try {
          const hrmsRes = await fetch(`/api/hrms/employee/${empId}`);
          const hrmsText = await hrmsRes.text();
          const hrmsData = JSON.parse(hrmsText);
          employeeData = hrmsData?.data?.employee || hrmsData || {};
          console.log(`${modeLabel} HRMS profile fetched:`, employeeData);
        } catch (err) {
          console.warn('Failed to fetch full employee profile from HRMS:', err);
        }

        // Map data from HRMS response
        const email = employeeData.EMail || employeeData.email || `${username.toLowerCase()}@doublea1991.com`;
        const fullName = employeeData.EmpName || employeeData.full_name || username;
        const department = employeeData.Department || employeeData.department || 'IMP';
        const position = employeeData.Position || employeeData.position || 'Specialist';
        const phone = employeeData.Sim_Number || employeeData.phone || '';

        // Upsert corporate profile dynamically (Just-In-Time provisioning)
        const { data: upsertedUser, error: upsertErr } = await supabase
          .from('users')
          .upsert({
            emp_id: empId,
            email: email,
            full_name: fullName,
            nickname: username,
            department: department,
            position: position,
            phone: phone,
            status: 'Active',
            updated_at: new Date().toISOString()
          }, { onConflict: 'emp_id' })
          .select('*')
          .maybeSingle();

        if (upsertErr) throw upsertErr;

        // Fallback: if upsert didn't return data (RLS blocks read-after-write),
        // do a plain SELECT to retrieve the user record
        if (!upsertedUser) {
          const { data: fetchedUser, error: fetchErr } = await supabase
            .from('users')
            .select('*')
            .eq('emp_id', empId)
            .maybeSingle();
          if (fetchErr) throw fetchErr;
          if (!fetchedUser) throw new Error('ไม่สามารถดึงข้อมูลผู้ใช้งานได้หลังจาก Login');
          userRecord = fetchedUser;
        } else {
          userRecord = upsertedUser;
        }
      }

      // Success - Save session state
      const sessionObj: UserSession = {
        id: userRecord.id,
        empId: userRecord.emp_id,
        name: userRecord.full_name,
        nickname: userRecord.nickname || userRecord.full_name.split(' ')[0],
        role: userRecord.role as 'user' | 'admin',
        department: userRecord.department || 'IMP',
        position: userRecord.position,
        email: userRecord.email
      };

      sessionStorage.setItem('worklog_session', JSON.stringify(sessionObj));
      setUser(sessionObj);
      return sessionObj;

    } catch (err: any) {
      console.error('Authentication process failed:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem('worklog_session');
    setUser(null);
  };

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout
  };
}
