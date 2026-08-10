import { supabase } from './supabase';

/**
 * Hash a 6-digit PIN string using standard SHA-256 Web Crypto API
 */
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`imp_vault_pin_salt_${pin}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface VerifyPinResult {
  valid: boolean;
  superadminId?: string;
  superadminName?: string;
  error?: string;
}

/**
 * Verify if the entered PIN matches any active SuperAdmin PIN
 */
export async function verifySuperAdminPin(pin: string): Promise<VerifyPinResult> {
  if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
    return { valid: false, error: 'กรุณากรอก PIN เป็นตัวเลข 6 หลัก' };
  }

  try {
    const hashed = await hashPin(pin);

    const { data: matchedUsers, error } = await supabase
      .from('users')
      .select('id, full_name, role')
      .eq('security_pin_hash', hashed);

    if (error) throw error;

    if (matchedUsers && matchedUsers.length > 0) {
      const admin = matchedUsers[0];
      return {
        valid: true,
        superadminId: admin.id,
        superadminName: admin.full_name
      };
    }

    return { valid: false, error: 'Security PIN ไม่ถูกต้อง' };
  } catch (err: any) {
    console.error('Error verifying SuperAdmin PIN:', err);
    return { valid: false, error: 'เกิดข้อผิดพลาดในการตรวจสอบ PIN' };
  }
}

/**
 * Set or Update PIN for a SuperAdmin with collision check
 */
export async function setSuperAdminPin(userId: string, pin: string): Promise<{ success: boolean; message: string }> {
  if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
    return { success: false, message: 'PIN ต้องเป็นตัวเลข 6 หลักเท่านั้น' };
  }

  try {
    const hashed = await hashPin(pin);

    // Collision check: Make sure no OTHER admin is using this exact PIN
    const { data: existingAdmins, error: searchErr } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('security_pin_hash', hashed)
      .neq('id', userId);

    if (searchErr) throw searchErr;

    if (existingAdmins && existingAdmins.length > 0) {
      return { 
        success: false, 
        message: `PIN นี้ถูกใช้งานโดย SuperAdmin ท่านอื่น (${existingAdmins[0].full_name}) แล้ว กรุณาเลือก PIN 6 หลักใหม่` 
      };
    }

    // Save hashed PIN to user profile
    const { error: updateErr } = await supabase
      .from('users')
      .update({ 
        security_pin_hash: hashed,
        security_pin_updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateErr) throw updateErr;

    return { success: true, message: 'บันทึก 6-Digit Security PIN เรียบร้อยแล้ว' };
  } catch (err: any) {
    console.error('Error setting PIN:', err);
    return { success: false, message: err.message || 'ไม่สามารถบันทึก PIN ได้' };
  }
}

/**
 * Reset / Remove PIN for a SuperAdmin
 */
export async function clearSuperAdminPin(userId: string): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase
      .from('users')
      .update({ 
        security_pin_hash: null,
        security_pin_updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) throw error;
    return { success: true, message: 'ยกเลิก PIN เรียบร้อยแล้ว' };
  } catch (err: any) {
    return { success: false, message: err.message || 'ไม่สามารถยกเลิก PIN ได้' };
  }
}

export interface LogSecretAccessParams {
  projectId: string;
  workspaceId?: string;
  userId: string;
  authorizedBySuperadminId?: string;
  actionType: 'OPEN_VAULT' | 'REVEAL_SECRET' | 'COPY_SECRET' | 'COPY_ENV_BLOCK';
  secretKey?: string;
  environment?: string;
  status: 'SUCCESS' | 'FAILED_PIN';
}

/**
 * Record an entry into tb_secret_access_logs
 */
export async function logSecretAccess(params: LogSecretAccessParams): Promise<void> {
  try {
    let finalUserId = params.userId;
    if (!finalUserId) {
      const sessionStr = localStorage.getItem('worklog_session');
      if (sessionStr) {
        try {
          const sessionData = JSON.parse(sessionStr);
          finalUserId = sessionData.id || sessionData.userId;
        } catch (e) {
          // ignore
        }
      }
    }

    if (!finalUserId) {
      console.warn('logSecretAccess: Cannot write audit log, missing user_id.');
      return;
    }

    const { error } = await supabase.from('tb_secret_access_logs').insert([{
      project_id: params.projectId,
      workspace_id: params.workspaceId || null,
      user_id: finalUserId,
      authorized_by_superadmin_id: params.authorizedBySuperadminId || null,
      action_type: params.actionType,
      secret_key: params.secretKey || null,
      environment: params.environment || null,
      status: params.status
    }]);

    if (error) {
      console.error('Supabase error inserting tb_secret_access_logs:', error);
    }
  } catch (err) {
    console.error('Failed to write secret access log:', err);
  }
}
