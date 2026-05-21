require('dotenv').config({ path: 'frontend/.env.local' });
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const USER_ID = '4288a292-cac9-494e-ad72-a8c0628cce42'; // Jintana (Suay) UUID
const CSV_FILE = 'Worklog_2026 - Suay-cutoff.csv';

function convertDate(dStr) {
  if (!dStr) return null;
  if (dStr.includes('/')) {
    const parts = dStr.split('/');
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    return `${y}-${m}-${d}`;
  }
  return dStr;
}

function timeToMins(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

function minsToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

function getEndOfWorkdayTime(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return null;
  if (day === 5) return '17:00'; // Friday
  return '18:00'; // Mon-Thu
}

function calculateSegmentHours(startMins, endMins, deductLunch) {
  let totalMinutes = endMins - startMins;
  if (totalMinutes < 0) totalMinutes = 0;

  if (deductLunch) {
    const lunchStart = 12 * 60;
    const lunchEnd = 13 * 60;
    const overlapStart = Math.max(startMins, lunchStart);
    const overlapEnd = Math.min(endMins, lunchEnd);
    if (overlapEnd > overlapStart) {
      totalMinutes -= (overlapEnd - overlapStart);
    }
  }

  return Math.round((totalMinutes / 60) * 100) / 100;
}

function mapActionName(actionStr, description) {
  if (!actionStr || actionStr.trim() === '') {
    const desc = (description || '').toLowerCase();
    if (desc.includes('requirement') || desc.includes('gather') || desc.includes('คุยความต้องการ')) {
      return 'User Requirement Gathering';
    }
    if (desc.includes('cleansing') || desc.includes('clean') || desc.includes('ล้าง') || desc.includes('ข้อมูล')) {
      return 'Data Preparation / Cleansing';
    }
    if (desc.includes('design') || desc.includes('ออกแบบ')) {
      return 'Report / Dashboard Design';
    }
    if (desc.includes('plan') || desc.includes('ประชุม') || desc.includes('meeting') || desc.includes('หารือ') || desc.includes('ปรึกษา') || desc.includes('สรุป')) {
      return 'Planning';
    }
    return 'Others';
  }

  const act = actionStr.trim();
  const masterActions = [
    'User Requirement Gathering',
    'Planning',
    'Report / Dashboard Design',
    'Process Mapping / Optimization',
    'Set template',
    'Data Preparation / Cleansing',
    'System Setup / Configuration',
    'Research/Develop/Implement',
    'Testing / UAT Support',
    'Document work',
    'CRUD Account',
    'CRUD Authorization',
    'Training / Knowledge Transfer / Consult',
    'Issue Resolution / Troubleshooting',
    'Check & Correction',
    'Others',
    'CRUD Form',
    'CRUD Function',
    'CRUD List',
    'CRUD Master Data',
    'CRUD Record',
    'CRUD Report',
    'CRUD System',
    'Reset password',
    'Receive Policy',
    'Plan/Strategy/Review/Delegate/Resolve/Coach'
  ];

  const exactMatch = masterActions.find(m => m.toLowerCase() === act.toLowerCase());
  if (exactMatch) return exactMatch;

  const actLower = act.toLowerCase();
  if (actLower.includes('requirement')) return 'User Requirement Gathering';
  if (actLower.includes('plan') || actLower.includes('meeting')) return 'Planning';
  if (actLower.includes('design') || actLower.includes('report')) return 'Report / Dashboard Design';
  if (actLower.includes('process') || actLower.includes('optimize')) return 'Process Mapping / Optimization';
  if (actLower.includes('template')) return 'Set template';
  if (actLower.includes('cleansing') || actLower.includes('clean')) return 'Data Preparation / Cleansing';
  if (actLower.includes('setup') || actLower.includes('config')) return 'System Setup / Configuration';
  if (actLower.includes('develop') || actLower.includes('implement') || actLower.includes('research')) return 'Research/Develop/Implement';
  if (actLower.includes('testing') || actLower.includes('uat')) return 'Testing / UAT Support';
  if (actLower.includes('document')) return 'Document work';
  if (actLower.includes('account')) return 'CRUD Account';
  if (actLower.includes('auth')) return 'CRUD Authorization';
  if (actLower.includes('training') || actLower.includes('consult') || actLower.includes('knowledge')) return 'Training / Knowledge Transfer / Consult';
  if (actLower.includes('trouble') || actLower.includes('issue') || actLower.includes('bug') || actLower.includes('solve')) return 'Issue Resolution / Troubleshooting';
  if (actLower.includes('check') || actLower.includes('correct')) return 'Check & Correction';
  if (actLower.includes('coach') || actLower.includes('review')) return 'Plan/Strategy/Review/Delegate/Resolve/Coach';

  return 'Others';
}

async function run() {
  const commit = process.argv.includes('--commit');
  console.log(`=== SUAY (JINTANA) WORKLOG 2026 MIGRATION ===`);
  console.log(`Mode: ${commit ? 'COMMIT (WRITE TO DB)' : 'DRY RUN (READ ONLY)'}\n`);

  // 1. Fetch Master Holidays
  console.log('Fetching master holidays from DB...');
  const { data: dbHolidays, error: holidayErr } = await supabase.from('tb_master_holiday').select('date');
  if (holidayErr) {
    console.error('Error fetching holidays:', holidayErr);
    return;
  }
  const holidays = dbHolidays.map(h => h.date);
  console.log(`Loaded ${holidays.length} holidays from DB.\n`);

  // 2. Read and Parse CSV
  if (!fs.existsSync(CSV_FILE)) {
    console.error(`Error: File ${CSV_FILE} not found.`);
    return;
  }
  const csvContent = fs.readFileSync(CSV_FILE, 'utf8');
  const records = parse(csvContent, { columns: true, skip_empty_lines: true });
  console.log(`Loaded ${records.length} records from CSV.`);

  const insertPayloads = [];
  let filledTimesCount = 0;
  let singleNormalCount = 0;
  let singleOTCount = 0;
  let splitCount = 0;

  // Process each record
  records.forEach((r, idx) => {
    const lineNum = idx + 2;
    const dateStr = convertDate(r.work_date);
    
    // Resolve project structure components
    let holding = r.Holding ? r.Holding.trim() : '';
    let deptOp = r.department_operator ? r.department_operator.trim() : '';
    let projType = r.Type ? r.Type.trim() : '';
    let projName = r.project_name ? r.project_name.trim() : '';
    let mod = r.Module ? r.Module.trim() : '';
    let bu = r.BU ? r.BU.trim() : '';
    let dept = r.Department ? r.Department.trim() : '';

    // If 'Module : BU : Department' is populated, split it if components are missing
    const structCol = r['Module : BU : Department'];
    if (structCol && structCol.includes(':')) {
      const parts = structCol.split(':').map(p => p.trim());
      if (!mod && parts[0]) mod = parts[0];
      if (!bu && parts[1]) bu = parts[1];
      if (!dept && parts[2]) dept = parts[2];
    }

    // Resolve empty project names
    if (!projName) {
      if (mod === 'Function Readiness - MFG' || mod === 'Function Readiness - MRP' || mod === 'Function Readiness - O2C' || mod === 'Function Readiness - ABB' || mod === 'Function Readiness - MPS') {
        projName = 'ERP - Netsuite';
      } else if (mod === 'Corporate' || dept === 'IT') {
        projName = 'TeamOps';
      } else {
        projName = 'ERP - Netsuite';
      }
    }

    // Fallbacks
    if (!holding) holding = 'Double A';
    if (!deptOp) deptOp = 'IT';
    if (!projType) {
      if (projName === 'TeamOps' || projName === 'Policy') projType = 'Management';
      else projType = 'Project';
    }
    if (!bu || bu.trim() === '') {
      if (projName === 'ERP - Netsuite') bu = 'Production';
      else if (projName === 'TeamOps' || projName === 'Policy') bu = 'Corporate';
      else bu = 'Corporate';
    }
    if (!dept || dept.trim() === '') {
      if (projName === 'ERP - Netsuite') dept = 'Converting';
      else if (projName === 'TeamOps') dept = 'IT';
      else if (projName === 'Policy') dept = 'Improvement';
      else dept = 'IT';
    }

    // Map Action Name
    const action_name = mapActionName(r.action_name, r.description);

    // Get times
    let start_time = r.start_time ? r.start_time.trim() : '';
    let end_time = r.end_time ? r.end_time.trim() : '';
    let defaultBreak = false;

    // Custom handling for dates with missing times
    if (!start_time || !end_time) {
      filledTimesCount++;
      if (dateStr === '2026-01-13') {
        // Line 2: Netsuite (4.0 hrs)
        // Line 3: TeamOps (1.25 hrs, "Urgent Steering...")
        // Line 4: TeamOps (1.0 hr, "Internal update...") -> Description says (9-10)
        // Line 5: TeamOps (2.0 hrs, "Preparing meeting...")
        const hoursFloat = parseFloat(r.hours);
        if (projName === 'ERP - Netsuite' && hoursFloat === 4) {
          start_time = '08:00';
          end_time = '12:00';
        } else if (projName === 'TeamOps' && hoursFloat === 1.25) {
          start_time = '13:00';
          end_time = '14:15';
        } else if (projName === 'TeamOps' && hoursFloat === 1) {
          start_time = '09:00';
          end_time = '10:00';
        } else if (projName === 'TeamOps' && hoursFloat === 2) {
          start_time = '19:30';
          end_time = '21:30';
        } else {
          // generic fallback for date 2026-01-13
          start_time = '08:00';
          end_time = '12:00';
        }
      } else if (dateStr === '2026-01-15') {
        // Line 9: Netsuite (1.0 hr) -> "VPL & Item Sub Contract Master..."
        start_time = '19:40';
        end_time = '20:40';
      } else {
        // General fallback if any other has missing times
        const hoursFloat = parseFloat(r.hours) || 8;
        start_time = '08:00';
        end_time = minsToTime(8 * 60 + Math.round(hoursFloat * 60));
      }
    }

    // Ensure format HH:MM:SS
    const formatTime = (tStr) => {
      const parts = tStr.split(':');
      if (parts.length === 2) return `${tStr}:00`;
      if (parts.length === 3) return tStr;
      return `${tStr.padStart(2, '0')}:00:00`;
    };

    const startFormatted = formatTime(start_time);
    const endFormatted = formatTime(end_time);

    // Parse minutes
    const startMins = timeToMins(startFormatted);
    const endMins = timeToMins(endFormatted);

    // Determine weekend/holiday
    const d = new Date(dateStr);
    const day = d.getDay();
    const isWeekend = (day === 0 || day === 6);
    const isHoliday = holidays.includes(dateStr);

    // Calculate hours if the column was empty (like lines 178-250)
    let totalHours = parseFloat(r.hours);
    if (isNaN(totalHours)) {
      totalHours = calculateSegmentHours(startMins, endMins, (startMins <= 12 * 60 && endMins >= 13 * 60) && !(isWeekend || isHoliday));
    }

    const basePayload = {
      user_id: USER_ID,
      work_date: dateStr,
      holding,
      department_operator: deptOp,
      project_type: projType,
      project_name: projName,
      module: mod || null,
      bu: bu || null,
      department: dept || null,
      action_name: action_name,
      action_channel: r.Channel || null,
      description: r.description || '',
      channel: 'Web App',
      created_at: new Date().toISOString()
    };

    if (isWeekend || isHoliday) {
      // Weekend or Holiday -> ALL OT
      if (totalHours > 0) {
        insertPayloads.push({
          ...basePayload,
          start_time: startFormatted,
          end_time: endFormatted,
          break_time: false,
          total_hours: totalHours,
          is_ot: true,
          is_implied_ot: true
        });
        singleOTCount++;
      }
    } else {
      // Weekday
      const endOfWorkday = getEndOfWorkdayTime(dateStr);
      const endOfDayMins = timeToMins(endOfWorkday);

      if (startMins >= endOfDayMins) {
        // Starts after workday -> ALL OT
        if (totalHours > 0) {
          insertPayloads.push({
            ...basePayload,
            start_time: startFormatted,
            end_time: endFormatted,
            break_time: false,
            total_hours: totalHours,
            is_ot: true,
            is_implied_ot: true
          });
          singleOTCount++;
        }
      } else if (endMins <= endOfDayMins) {
        // Ends before or at workday -> ALL NORMAL
        const break_time = defaultBreak || (startMins <= 12 * 60 && endMins >= 13 * 60);
        if (totalHours > 0) {
          insertPayloads.push({
            ...basePayload,
            start_time: startFormatted,
            end_time: endFormatted,
            break_time,
            total_hours: totalHours,
            is_ot: false,
            is_implied_ot: false
          });
          singleNormalCount++;
        }
      } else {
        // Crosses boundary -> SPLIT IT
        const normalMins = endOfDayMins - startMins;
        const otMins = endMins - endOfDayMins;
        const totalElapsed = endMins - startMins;

        // Pro-rate hours if the hours was manually specified and didn't match the elapsed mins
        const hasCustomHours = !isNaN(parseFloat(r.hours));
        let normalHours, otHours;

        if (hasCustomHours) {
          const ratioNormal = normalMins / totalElapsed;
          normalHours = Math.round((totalHours * ratioNormal) * 100) / 100;
          otHours = Math.round((totalHours - normalHours) * 100) / 100;
        } else {
          normalHours = calculateSegmentHours(startMins, endOfDayMins, startMins <= 12 * 60 && endOfDayMins >= 13 * 60);
          otHours = calculateSegmentHours(endOfDayMins, endMins, false);
        }

        if (normalHours > 0) {
          insertPayloads.push({
            ...basePayload,
            start_time: startFormatted,
            end_time: formatTime(endOfWorkday),
            break_time: (startMins <= 12 * 60 && endOfDayMins >= 13 * 60),
            total_hours: normalHours,
            is_ot: false,
            is_implied_ot: false,
            description: basePayload.description ? `[Normal] ${basePayload.description}` : 'Normal portion'
          });
        }

        if (otHours > 0) {
          insertPayloads.push({
            ...basePayload,
            start_time: formatTime(endOfWorkday),
            end_time: endFormatted,
            break_time: false,
            total_hours: otHours,
            is_ot: true,
            is_implied_ot: true,
            description: basePayload.description ? `[OT] ${basePayload.description}` : 'OT portion'
          });
        }

        splitCount++;
      }
    }
  });

  console.log(`\n=== PROCESSING STATISTICS ===`);
  console.log(`Total CSV records parsed: ${records.length}`);
  console.log(`Records with empty times auto-filled: ${filledTimesCount}`);
  console.log(`Single Normal records created: ${singleNormalCount}`);
  console.log(`Single OT records created (weekends/holidays/late starts): ${singleOTCount}`);
  console.log(`Weekday records split (Normal + OT portions): ${splitCount}`);
  console.log(`Total DB payloads generated for insert: ${insertPayloads.length}`);

  // Calculate sum of total_hours
  const totalHoursSum = insertPayloads.reduce((sum, p) => sum + p.total_hours, 0);
  console.log(`Sum of all generated work hours: ${totalHoursSum.toFixed(2)} hrs`);

  if (!commit) {
    console.log(`\n=== PREVIEW OF FIRST 10 GENERATED PAYLOADS ===`);
    console.log(JSON.stringify(insertPayloads.slice(0, 10), null, 2));
    console.log(`\n[DRY RUN COMPLETED] To write these changes to Supabase, run this script with the --commit flag:`);
    console.log(`  node migrate_suay_data.js --commit`);
  } else {
    console.log(`\nInserting ${insertPayloads.length} payloads into public.col_worklog in batches of 100...`);
    const batchSize = 100;
    let successCount = 0;
    
    for (let i = 0; i < insertPayloads.length; i += batchSize) {
      const batch = insertPayloads.slice(i, i + batchSize);
      const { error: insertErr } = await supabase.from('col_worklog').insert(batch);
      if (insertErr) {
        console.error(`Error inserting batch starting at index ${i}:`, insertErr);
        return;
      }
      successCount += batch.length;
      console.log(`  Successfully inserted batch ${i / batchSize + 1} (${batch.length} records)`);
    }

    console.log(`\n=== MIGRATION COMPLETE ===`);
    console.log(`Successfully migrated ${successCount} records to Supabase for Jintana (Suay).`);
  }
}

run();
