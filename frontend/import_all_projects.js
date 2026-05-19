import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Read and parse CSV file
const csvPath = path.join(__dirname, '../all_project.csv');
const content = fs.readFileSync(csvPath, 'utf8');

// Extract CSV content between ```csv and ```
const csvMatch = content.match(/```csv([\s\S]*?)```/);
if (!csvMatch) {
  console.error("Error: Could not find CSV block in all_project.csv");
  process.exit(1);
}

const csvData = csvMatch[1].trim();
const lines = csvData.split('\n');
const headers = lines[0].split(',').map(h => h.trim());

console.log('Detected headers:', headers);

const rows = [];
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  // Safe CSV parser (handles commas within quotes if any)
  const cols = [];
  let current = '';
  let inQuotes = false;
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cols.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cols.push(current.trim());
  
  // Map row object
  const row = {};
  headers.forEach((h, idx) => {
    row[h] = cols[idx] || '';
  });
  rows.push(row);
}

console.log(`Parsed ${rows.length} rows from CSV.`);

// 2. Extract unique master data values to update master tables on conflict
const holdings = [...new Set(rows.map(r => r.Holding).filter(Boolean))];
const roles = [...new Set(rows.map(r => r.department_operator).filter(Boolean))];
const projectTypes = [...new Set(rows.map(r => r.Project_Type).filter(Boolean))];

// 3. Generate SQL script
let sql = `-- Automatically generated import SQL script\n`;
sql += `BEGIN;\n\n`;

sql += `-- 1. Insert unique Holdings into tb_master_holding\n`;
holdings.forEach(h => {
  sql += `INSERT INTO tb_master_holding (holding_name) VALUES (${escapeSql(h)}) ON CONFLICT (holding_name) DO NOTHING;\n`;
});
sql += `\n`;

sql += `-- 2. Insert unique Roles into tb_master_role\n`;
roles.forEach(r => {
  sql += `INSERT INTO tb_master_role (role_name) VALUES (${escapeSql(r)}) ON CONFLICT (role_name) DO NOTHING;\n`;
});
sql += `\n`;

sql += `-- 3. Insert unique Project Types into tb_master_project_type\n`;
projectTypes.forEach(t => {
  sql += `INSERT INTO tb_master_project_type (type_name) VALUES (${escapeSql(t)}) ON CONFLICT (type_name) DO NOTHING;\n`;
});
sql += `\n`;

sql += `-- 4. Delete old project structure mapping table as requested ("ล้างของเก่า เอาของใหม่ไปแทน")\n`;
sql += `DELETE FROM tb_map_project_structure;\n\n`;

sql += `-- 5. Insert all rows into tb_map_project_structure\n`;
rows.forEach((r, idx) => {
  const holding = escapeSql(r.Holding);
  const deptOp = escapeSql(r.department_operator);
  const projType = escapeSql(r.Project_Type);
  const projName = escapeSql(r.Project_Name);
  
  // Map empty module to NULL or '-'
  const moduleVal = r.Module ? escapeSql(r.Module) : 'NULL';
  const bu = r.BU ? escapeSql(r.BU) : `'-'`;
  const department = r.Department ? escapeSql(r.Department) : `'-'`;
  
  sql += `INSERT INTO tb_map_project_structure (holding, department_operator, project_type, project_name, module, bu, department) VALUES (${holding}, ${deptOp}, ${projType}, ${projName}, ${moduleVal}, ${bu}, ${department});\n`;
});

sql += `\nCOMMIT;\n`;

// Helper to escape SQL string values safely
function escapeSql(val) {
  if (val === undefined || val === null || val === '') return 'NULL';
  return `'${val.replace(/'/g, "''")}'`;
}

// 4. Write generated SQL to file
const sqlOutputPath = path.join(__dirname, 'import_project_structure.sql');
fs.writeFileSync(sqlOutputPath, sql, 'utf8');
console.log(`Generated SQL transaction file at: ${sqlOutputPath}`);
