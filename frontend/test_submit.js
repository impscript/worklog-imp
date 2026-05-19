import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://mcrmkyppxoityveebgex.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jcm1reXBweG9pdHl2ZWViZ2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMTQwNTAsImV4cCI6MjA5NDY5MDA1MH0.l_i-trILv4NYsUIalQEOuy4-wW7y7XZiVrhMjEQ7Mzs'
);

async function run() {
  console.log('🚀 Initiating Mock Cascading Submission Test...');

  // 1. Get or Create user 'Chatchawan'
  let { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('nickname', 'Chatchawan')
    .maybeSingle();

  if (userError) {
    console.error('❌ Error finding user:', userError);
    return;
  }

  if (!user) {
    console.log('👤 User Chatchawan not found, creating user...');
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        emp_id: 'EMP-99999',
        email: 'chatchawan@doublea1991.com',
        full_name: 'Chatchawan (Dev)',
        nickname: 'Chatchawan',
        role: 'user',
        department: 'IMP'
      })
      .select('*')
      .single();

    if (createError) {
      console.error('❌ Error creating user:', createError);
      return;
    }
    user = newUser;
  }

  console.log('✅ User resolved:', user.full_name, `(ID: ${user.id})`);

  // 2. Query Cascading Values for Double A & IMP
  console.log('\n🔍 Verifying tb_map_user_role relationship...');
  const { data: userRoles, error: userRolesErr } = await supabase
    .from('tb_map_user_role')
    .select('*')
    .eq('name', 'Chatchawan');

  if (userRolesErr) {
    console.error('❌ Error querying user roles:', userRolesErr);
    return;
  }
  console.log('Holdings & Roles available for Chatchawan:', userRoles.map(r => `${r.holding} (${r.department_operator})`));

  // 3. Query Project Structure Match
  console.log('\n🔍 Querying tb_map_project_structure for Double A -> IMP -> Support Go-Live -> ERP - Netsuite -> Item Master...');
  const { data: projStructure, error: projErr } = await supabase
    .from('tb_map_project_structure')
    .select('*')
    .eq('holding', 'Double A')
    .eq('department_operator', 'IMP')
    .eq('project_type', 'Support Go-Live')
    .eq('project_name', 'ERP - Netsuite')
    .eq('module', 'Item Master')
    .maybeSingle();

  if (projErr) {
    console.error('❌ Error querying project structure:', projErr);
    return;
  }

  if (!projStructure) {
    console.error('❌ Expected project structure mapping not found in database!');
    return;
  }
  console.log('✅ Project Structure verified! BU:', projStructure.bu, '| Dept:', projStructure.department);

  // 4. Submit Mock Worklog entry
  console.log('\n📝 Inserting mock worklog entry into col_worklog...');
  const worklogEntry = {
    user_id: user.id,
    work_date: new Date().toISOString().split('T')[0],
    start_time: '08:00:00',
    end_time: '12:00:00',
    break_time: false,
    total_hours: 4.0,
    holding: 'Double A',
    department_operator: 'IMP',
    project_type: 'Support Go-Live',
    project_name: 'ERP - Netsuite',
    module: 'Item Master',
    bu: projStructure.bu,
    department: projStructure.department,
    action_name: 'Data Preparation / Cleansing',
    description: 'Testing the cascading dropdown work log submission via script.',
    channel: 'Test Script'
  };

  const { data: newLog, error: logError } = await supabase
    .from('col_worklog')
    .insert(worklogEntry)
    .select('*')
    .single();

  if (logError) {
    console.error('❌ Error inserting worklog:', logError);
    return;
  }

  console.log('🎉 WORKLOG INSERTED SUCCESSFULLY!');
  console.log('ID:', newLog.id);
  console.log('Work Date:', newLog.work_date);
  console.log('Logged Hours:', newLog.total_hours);
  console.log('Holding:', newLog.holding);
  console.log('Project:', newLog.project_name);
  console.log('Action:', newLog.action_name);
  console.log('Description:', newLog.description);

  // 5. Query sum of hours
  console.log('\n📊 Aggregating all logged hours for Chatchawan...');
  const { data: allLogs, error: sumErr } = await supabase
    .from('col_worklog')
    .select('total_hours')
    .eq('user_id', user.id);

  if (sumErr) {
    console.error('❌ Error aggregating hours:', sumErr);
    return;
  }

  const sum = allLogs.reduce((acc, log) => acc + Number(log.total_hours), 0);
  console.log(`✅ Total Hours Logged by Chatchawan across all logs: ${sum} hours`);
}

run();
