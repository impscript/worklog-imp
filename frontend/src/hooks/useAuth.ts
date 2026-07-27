import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
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
  workspaceName?: string;
}

export function useAuth() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (session?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('auth_user_id', session.user.id)
          .maybeSingle();
        if (profile) {
          const cached = localStorage.getItem('worklog_session');
          setUser(cached ? JSON.parse(cached) : {
            id: profile.id,
            empId: profile.emp_id,
            name: profile.full_name,
            nickname: profile.nickname || profile.full_name,
            role: profile.role,
            department: profile.department || 'IMP',
            position: profile.position,
            email: profile.email,
            activeWorkspaceId: profile.active_workspace_id
          });
        }
      } else {
        localStorage.removeItem('worklog_session');
      }
      setIsLoading(false);
    };
    hydrate().catch((error) => {
      console.error('Failed to hydrate Supabase Auth session:', error);
      if (mounted) setIsLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        localStorage.removeItem('worklog_session');
        setUser(null);
      }
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
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
      let isBridgeLogin = false;
      let email = '';
      let fullName = '';
      let position = '';
      let empId = '';

      // Check if it matches a mock user simulation
      const mockUser = MOCK_USERS.find(u => u.emp_id === username || u.nickname.toLowerCase() === username.toLowerCase()) || null;

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
        const isMockSimulation = !!mockUser || password === 'mock_bypass';
        const modeLabel = isMockSimulation ? '[MOCK SIMULATION]' : (import.meta.env.DEV ? '[DEV+REAL API]' : '[PROD]');
        console.log(`${modeLabel} Routing handshake to HRMS/IDMS proxy gateway...`);

        if (!password && !isMockSimulation) {
          throw new Error('Please enter a password');
        }

        if (isMockSimulation) {
          empId = mockUser ? mockUser.emp_id : username.trim();
          employeeData = mockUser ? {
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
          } : null;

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

          // Authenticate simulation through the secure hrms-auth Edge Function to establish a real Supabase Auth session
          const bridgeUrl = import.meta.env.DEV
            ? '/functions/v1/hrms-auth'
            : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hrms-auth`;
          const bridgeRes = await fetch(bridgeUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY
            },
            body: JSON.stringify({
              account: empId,
              password: 'mock_bypass',
              mockEmployee: mockUser
            })
          });
          const bridgeData = await bridgeRes.json().catch(() => null);
          if (!bridgeRes.ok || !bridgeData?.session || !bridgeData?.employee) {
            throw new Error(bridgeData?.error || 'ไม่สามารถสร้าง Session จำลองสิทธิ์ได้');
          }

          const { error: sessionError } = await supabase.auth.setSession(bridgeData.session);
          if (sessionError) throw sessionError;

          userRecord = bridgeData.employee;
          isBridgeLogin = true;
        } else {
          // Authentication and HRMS provisioning happen server-side. Credentials and
          // IDMS agent secrets must never be exposed in the browser bundle.
          const bridgeUrl = import.meta.env.DEV
            ? '/functions/v1/hrms-auth'
            : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hrms-auth`;
          const bridgeRes = await fetch(bridgeUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY
            },
            body: JSON.stringify({ account: username, password })
          });
          const bridgeData = await bridgeRes.json().catch(() => null);
          if (!bridgeRes.ok || !bridgeData?.session || !bridgeData?.employee) {
            throw new Error(bridgeData?.error || 'ชื่อผู้ใช้หรือรหัสผ่านของระบบ IDMS ไม่ถูกต้อง');
          }
          const { error: sessionError } = await supabase.auth.setSession(bridgeData.session);
          if (sessionError) throw sessionError;
          userRecord = bridgeData.employee;
          empId = userRecord.emp_id;
          employeeData = userRecord;
          isBridgeLogin = true;
          console.log(`${modeLabel} Supabase Auth session established — EmpId: ${empId}`);
        }

        if (!isBridgeLogin) {
          throw new Error('บัญชีนี้ต้องเข้าสู่ระบบผ่าน HRMS/IDMS Auth Bridge');
        }

        // The bridge returns an authoritative, minimal employee profile.
        empId = userRecord.emp_id || '';
        email = userRecord.email || '';
        fullName = userRecord.full_name || username;
        position = userRecord.position || 'Specialist';
      }

      // Handle Invite Code Workspace Joining if provided
      if (userRecord && inviteCode) {
        const { data: wData } = await supabase
          .from('workspaces')
          .select('id, workspace_name')
          .ilike('invite_code', inviteCode.trim())
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
      let workspaceName = '';
      if (userRecord.active_workspace_id) {
        const [resMember, resWS] = await Promise.all([
          supabase.from('workspace_users').select('role').eq('workspace_id', userRecord.active_workspace_id).eq('user_id', userRecord.id).maybeSingle(),
          supabase.from('workspaces').select('invite_code, workspace_name').eq('id', userRecord.active_workspace_id).maybeSingle()
        ]);
        if (resMember.data) {
          workspaceRole = resMember.data.role as 'admin' | 'manager' | 'user';
        }
        if (resWS.data) {
          workspaceInviteCode = resWS.data.invite_code;
          workspaceName = resWS.data.workspace_name;
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
        workspaceName: workspaceName || undefined,
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

  const logout = async () => {
    await supabase.auth.signOut();
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
