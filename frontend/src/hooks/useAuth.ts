import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import md5 from 'js-md5';
import { MOCK_USERS } from '../lib/mockUsers';

export interface UserSession {
  id: string;
  empId: string;
  name: string;
  nickname: string;
  role: 'user' | 'admin';
  workspaceRole?: 'admin' | 'manager' | 'user';
  department: string;
  position?: string;
  email?: string;
  activeWorkspaceId?: string;
  workspaceInviteCode?: string;
}

export function useAuth() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const sessionStr = localStorage.getItem('worklog_session');
    if (sessionStr) {
      try {
        setUser(JSON.parse(sessionStr));
      } catch (e) {
        console.error('Failed to parse active session:', e);
        localStorage.removeItem('worklog_session');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (account: string, password?: string, inviteCode?: string): Promise<UserSession> => {
    setIsLoading(true);
    try {
      const username = account.trim();
      if (!username) {
        throw new Error('Please enter a username');
      }

      let userRecord: any = null;
      let employeeData: any = null;
      let email = '';
      let fullName = '';
      let position = '';
      let empId = '';

      // Check if it matches a mock user simulation
      const mockUser = (import.meta.env.DEV || password === 'mock_bypass')
        ? MOCK_USERS.find(u => u.emp_id === username || u.nickname.toLowerCase() === username.toLowerCase() || (password === 'mock_bypass' && u.emp_id === username))
        : null;

      // ==========================================
      // Mode 1: Local / Developer Staging Auth
      // ==========================================
      if (import.meta.env.DEV && !password && !mockUser) {
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

        email = userRecord?.email || '';
        fullName = userRecord?.full_name || '';
        position = userRecord?.position || 'Specialist';
        empId = userRecord?.emp_id || '';
      }
      // ==========================================
      // Mode 2: Live Enterprise IDMS/HRMS Auth
      // ==========================================
      else {
        const isMockSimulation = !!mockUser;
        const modeLabel = isMockSimulation ? '[MOCK SIMULATION]' : (import.meta.env.DEV ? '[DEV+REAL API]' : '[PROD]');
        console.log(`${modeLabel} Routing handshake to HRMS/IDMS proxy gateway...`);

        if (!password && !isMockSimulation) {
          throw new Error('Please enter a password');
        }

        if (isMockSimulation && mockUser) {
          empId = mockUser.emp_id;
          employeeData = {
            EmpName: mockUser.full_name,
            EMail: mockUser.email,
            Department: mockUser.department,
            Position: mockUser.position,
            Sim_Number: mockUser.phone || '',
            Emp_BUWorking: mockUser.bu_working,
            Emp_LineOfWork: mockUser.line_of_work,
            CompanyName: mockUser.company_name,
            LevelName: mockUser.level_name || 'Senior',
            Company_Code: '',
            StartDate: '2023-06-12T00:00:00.000Z' // Default fallback date for this user
          };

          // Try to fetch real HRMS profile to get the absolute real StartDate from API
          try {
            const hrmsRes = await fetch(`/api/hrms/employee/${empId}`);
            if (hrmsRes.ok) {
              const hrmsText = await hrmsRes.text();
              const hrmsData = JSON.parse(hrmsText);
              const realEmp = hrmsData?.data?.employee || hrmsData || null;
              if (realEmp) {
                employeeData = realEmp;
              }
            }
          } catch (err) {
            console.warn('[MOCK] Failed to fetch real HRMS profile fallback, using mock template', err);
          }
          console.log(`${modeLabel} Prepared mock/fetched profile:`, employeeData);
        } else {
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

          let fetchedEmpId: string | null = null;
          let isSuccess = false;
          
          try {
            const authData = JSON.parse(authText);
            isSuccess = authData.Result === 'OK' || authData.status === 'success' || authData.Status === 'Success' || authData.Code === 200 || authData.code === '200';
            fetchedEmpId = authData.EmpId || authData.emp_id || authData.EmpID || authData.EmpId?.trim() || null;
            if (fetchedEmpId === '0') {
              isSuccess = false;
              fetchedEmpId = null;
            }
          } catch {
            if (authText.includes('OK') || authText.includes('Success') || authText.includes('true')) {
              isSuccess = true;
              const match = authText.match(/EmpId["']?\s*[:=]\s*["']?(\d+)/i);
              if (match) fetchedEmpId = match[1];
            }
          }

          if (!isSuccess || !fetchedEmpId) {
            console.error('IDMS Raw Response:', authText);
            throw new Error('ชื่อผู้ใช้หรือรหัสผ่านของระบบ IDMS ไม่ถูกต้อง');
          }

          empId = fetchedEmpId;
          console.log(`${modeLabel} IDMS auth OK — EmpId: ${empId}`);

          // 2. Fetch Employee Data from HRMS
          try {
            const hrmsRes = await fetch(`/api/hrms/employee/${empId}`);
            if (hrmsRes.ok) {
              const hrmsText = await hrmsRes.text();
              const hrmsData = JSON.parse(hrmsText);
              employeeData = hrmsData?.data?.employee || hrmsData || null;
              console.log(`${modeLabel} HRMS profile fetched:`, employeeData);
            } else {
              console.warn(`${modeLabel} HRMS API returned status: ${hrmsRes.status}`);
            }
          } catch (err) {
            console.warn('Failed to fetch full employee profile from HRMS:', err);
          }
        }

        // 1.5 Fetch existing user record from database (if any) to preserve cached values if API fails
        const { data: existingUser } = await supabase
          .from('users')
          .select('*')
          .eq('emp_id', empId)
          .maybeSingle();

        // Map data from HRMS response with fallback to existing DB record, then to hardcoded defaults
        empId = empId || '';
        email = employeeData?.EMail || employeeData?.email || existingUser?.email || `${username.toLowerCase()}@doublea1991.com`;
        fullName = employeeData?.EmpName || employeeData?.full_name || existingUser?.full_name || username;
        const department = employeeData?.Department || employeeData?.department || existingUser?.department || 'IMP';
        position = employeeData?.Position || employeeData?.position || existingUser?.position || 'Specialist';
        const phone = employeeData?.Sim_Number || employeeData?.phone || existingUser?.phone || '';
        
        // Extract new profile fields
        const roleStartDate = employeeData?.StartDate 
          ? employeeData.StartDate.split('T')[0] 
          : (existingUser?.role_start_date || null);
        const employeeLevel = employeeData?.LevelName || existingUser?.employee_level || 'Senior';
        const companyCode = employeeData?.Company_Code || existingUser?.company_code || '';
        const companyName = employeeData?.CompanyName || existingUser?.company_name || '';

        // Upsert corporate profile dynamically (Just-In-Time provisioning)
        const { data: upsertedUser, error: upsertErr } = await supabase
          .rpc('provision_hrms_user', {
            p_emp_id: empId,
            p_email: email,
            p_full_name: fullName,
            p_nickname: username,
            p_department: department,
            p_position: position,
            p_phone: phone,
            p_employee_level: employeeLevel,
            p_role_start_date: roleStartDate,
            p_company_code: companyCode,
            p_company_name: companyName
          });

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

      // Handle Invite Code Workspace Joining if provided
      if (userRecord && inviteCode) {
        const { data: wData } = await supabase
          .from('workspaces')
          .select('id, workspace_name')
          .eq('invite_code', inviteCode.trim())
          .maybeSingle();

        if (wData) {
          const { error: updateErr } = await supabase
            .from('users')
            .update({ active_workspace_id: wData.id })
            .eq('id', userRecord.id);

          if (!updateErr) {
            const isManager = /section manager|sec mgr|department manager|dept mgr|head of|director|ผู้จัดการ/i.test(position || '');
            const mappedRole = isManager ? 'admin' : 'user';

            await supabase.from('workspace_users').upsert({
              workspace_id: wData.id,
              user_id: userRecord.id,
              role: mappedRole
            }, { onConflict: 'workspace_id,user_id' });

            userRecord.active_workspace_id = wData.id;
          }
        }
      }

      // Perform Workspace Onboarding Sync if active_workspace_id is not set
      if (userRecord && !userRecord.active_workspace_id) {
        // Mode 1: Dev Simulated mapping fallback
        if (import.meta.env.DEV && !password) {
          const defaultWorkspaceId = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001'; // IMP Workspace UUID
          const { error: updateErr } = await supabase
            .from('users')
            .update({ active_workspace_id: defaultWorkspaceId })
            .eq('id', userRecord.id);

          if (!updateErr) {
            await supabase.from('workspace_users').upsert({
              workspace_id: defaultWorkspaceId,
              user_id: userRecord.id,
              role: username.toLowerCase() === 'admin' ? 'admin' : 'user'
            }, { onConflict: 'workspace_id,user_id' });
            
            userRecord.active_workspace_id = defaultWorkspaceId;
          }
        }
        // Mode 2: Live mapping based on HRMS BU & Line of work
        else {
          const hrmsBu = employeeData?.Emp_BUWorking || employeeData?.EMp_BUWorking || employeeData?.BUWorking || '';
          const hrmsLine = employeeData?.Emp_LineOfWork || employeeData?.LineOfWork || '';

          if (hrmsBu && hrmsLine) {
            const { data: rule } = await supabase
              .from('tb_hrms_mapping_rule')
              .select('mapped_workspace_id')
              .eq('hrms_bu_working', hrmsBu)
              .eq('hrms_line_of_work', hrmsLine)
              .maybeSingle();

            if (rule?.mapped_workspace_id) {
              const { error: updateErr } = await supabase
                .from('users')
                .update({ active_workspace_id: rule.mapped_workspace_id })
                .eq('id', userRecord.id);

              if (!updateErr) {
                const isManager = /section manager|sec mgr|department manager|dept mgr|head of|director|ผู้จัดการ/i.test(position || '');
                const mappedRole = isManager ? 'admin' : 'user';

                await supabase.from('workspace_users').upsert({
                  workspace_id: rule.mapped_workspace_id,
                  user_id: userRecord.id,
                  role: mappedRole
                }, { onConflict: 'workspace_id,user_id' });
                
                userRecord.active_workspace_id = rule.mapped_workspace_id;
              }
            } else {
              // Log onboarding exception for manual review
              await supabase.from('tb_onboarding_exceptions').insert({
                emp_id: empId,
                email: email,
                full_name: fullName,
                hrms_bu_working: hrmsBu,
                hrms_line_of_work: hrmsLine,
                position: position
              });
            }
          }
        }
      }

      // Retrieve actual workspace user role and invite code
      let workspaceRole: 'admin' | 'manager' | 'user' = 'user';
      let workspaceInviteCode = '';
      if (userRecord.active_workspace_id) {
        const [resMember, resWS] = await Promise.all([
          supabase.from('workspace_users').select('role').eq('workspace_id', userRecord.active_workspace_id).eq('user_id', userRecord.id).maybeSingle(),
          supabase.from('workspaces').select('invite_code').eq('id', userRecord.active_workspace_id).maybeSingle()
        ]);
        if (resMember.data) {
          workspaceRole = resMember.data.role as 'admin' | 'manager' | 'user';
        }
        if (resWS.data) {
          workspaceInviteCode = resWS.data.invite_code;
        }
      }

      // Success - Save session state
      const sessionObj: UserSession & { 
        role_start_date?: string; 
        employee_level?: string; 
        company_name?: string; 
        manager_name?: string; 
      } = {
        id: userRecord.id,
        empId: userRecord.emp_id,
        name: userRecord.full_name,
        nickname: userRecord.nickname || userRecord.full_name.split(' ')[0],
        role: userRecord.role as 'user' | 'admin',
        workspaceRole,
        department: userRecord.department || 'IMP',
        position: userRecord.position,
        email: userRecord.email,
        activeWorkspaceId: userRecord.active_workspace_id || undefined,
        workspaceInviteCode: workspaceInviteCode || undefined,
        role_start_date: userRecord.role_start_date || undefined,
        employee_level: userRecord.employee_level || undefined,
        company_name: userRecord.company_name || undefined,
        manager_name: userRecord.manager_name || undefined
      };

      localStorage.setItem('worklog_session', JSON.stringify(sessionObj));
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
    localStorage.removeItem('worklog_session');
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
