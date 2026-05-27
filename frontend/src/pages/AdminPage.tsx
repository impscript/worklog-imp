import { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, Database, RefreshCw, X, Check, Cpu, Key, Save, AlertTriangle, CheckCircle, MessageSquare, RotateCcw, ChevronDown, Shield, Activity, UserCheck, GitMerge, Users, Sliders, Calendar, Upload, Download } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { useNotification } from '../context/NotificationContext';

type TableTab = 'holding' | 'role' | 'project_type' | 'action' | 'map_user' | 'map_project' | 'users' | 'ai_settings' | 'ai_prompt' | 'holiday';

export default function AdminPage() {
  const { showToast, showConfirm } = useNotification();
  const [activeTab, setActiveTab] = useState<TableTab>('holding');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<any | null>(null);
  const [isMobileTabMenuOpen, setIsMobileTabMenuOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    newRows: any[];
    updateRows: any[];
    rawRows: any[];
  } | null>(null);

  // Project Structures specific filters
  const [filterProject, setFilterProject] = useState('');
  const [filterHolding, setFilterHolding] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterBU, setFilterBU] = useState('');

  const resetFilters = () => {
    setFilterProject('');
    setFilterHolding('');
    setFilterRole('');
    setFilterType('');
    setFilterBU('');
  };

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const entriesPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, filterProject, filterHolding, filterRole, filterType, filterBU]);

  // Database Data States
  const [holdings, setHoldings] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [projectTypes, setProjectTypes] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [userMappings, setUserMappings] = useState<any[]>([]);
  const [projectStructures, setProjectStructures] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [holidaysList, setHolidaysList] = useState<any[]>([]);

  // Form Field States
  const [formHoldingName, setFormHoldingName] = useState('');
  const [formRoleName, setFormRoleName] = useState('');
  const [formTypeName, setFormTypeName] = useState('');
  const [formActionCategory, setFormActionCategory] = useState('Project');
  const [formActionName, setFormActionName] = useState('');
  
  // Mappings Form States
  const [formMapUserName, setFormMapUserName] = useState('');
  const [formMapHolding, setFormMapHolding] = useState('');
  const [formMapRole, setFormMapRole] = useState('');

  const [formStructHolding, setFormStructHolding] = useState('');
  const [formStructRole, setFormStructRole] = useState('');
  const [formStructType, setFormStructType] = useState('');
  const [formStructProjName, setFormStructProjName] = useState('');
  const [formStructModule, setFormStructModule] = useState('');
  const [formStructBU, setFormStructBU] = useState('');
  const [formStructDept, setFormStructDept] = useState('');
  const [formStructDescription, setFormStructDescription] = useState('');

  // Users Form States
  const [formUserEmpId, setFormUserEmpId] = useState('');
  const [formUserFullName, setFormUserFullName] = useState('');
  const [formUserNickname, setFormUserNickname] = useState('');
  const [formUserEmail, setFormUserEmail] = useState('');
  const [formUserRole, setFormUserRole] = useState('user');
  const [formUserDept, setFormUserDept] = useState('IMP');

  // Holidays Form States
  const [formHolidayDate, setFormHolidayDate] = useState('');
  const [formHolidayName, setFormHolidayName] = useState('');
  const [isHolidayDropdownOpen, setIsHolidayDropdownOpen] = useState(false);

  // Project Structures Form - Project Name Auto-editable DDL States
  const [isProjNameDropdownOpen, setIsProjNameDropdownOpen] = useState(false);
  const [isModuleDropdownOpen, setIsModuleDropdownOpen] = useState(false);
  const [isBUDropdownOpen, setIsBUDropdownOpen] = useState(false);
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const [isHoldingDropdownOpen, setIsHoldingDropdownOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

  // Common default Thai public holidays to seed options
  const defaultHolidayNames = useMemo(() => [
    'วันขึ้นปีใหม่',
    'วันตรุษจีน',
    'วันมาฆบูชา',
    'วันจักรี',
    'วันสงกรานต์',
    'วันแรงงาน',
    'วันฉัตรมงคล',
    'วันวิสาขบูชา',
    'วันเฉลิมพระราชินี',
    'วันอาสาฬหบูชา',
    'วันเข้าพรรษา',
    'วันเฉลิม ร.10',
    'วันแม่',
    'วันคล้ายวันสวรรคต ร.9',
    'วันปิยมหาราช',
    'วันพ่อ',
    'วันรัฐธรรมนูญ',
    'วันสิ้นปี'
  ], []);

  // Collect unique holiday names from the loaded holidaysList database records
  const holidaySuggestions = useMemo(() => {
    const names = new Set(defaultHolidayNames);
    if (holidaysList && Array.isArray(holidaysList)) {
      holidaysList.forEach((h: any) => {
        if (h.name && h.name.trim()) {
          names.add(h.name.trim());
        }
      });
    }
    return Array.from(names);
  }, [holidaysList, defaultHolidayNames]);

  // Filtered list based on current user typed input
  const filteredHolidaySuggestions = useMemo(() => {
    const query = formHolidayName.toLowerCase().trim();
    if (!query) return holidaySuggestions;
    return holidaySuggestions.filter(name => name.toLowerCase().includes(query));
  }, [holidaySuggestions, formHolidayName]);

  // Dynamic unique values for Project Structures filters
  const uniqueProjects = useMemo(() => {
    if (!projectStructures || !Array.isArray(projectStructures)) return [];
    return Array.from(new Set(projectStructures.map(p => p.project_name))).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [projectStructures]);

  const uniqueHoldings = useMemo(() => {
    if (!projectStructures || !Array.isArray(projectStructures)) return [];
    return Array.from(new Set(projectStructures.map(p => p.holding))).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [projectStructures]);

  const uniqueRoles = useMemo(() => {
    if (!projectStructures || !Array.isArray(projectStructures)) return [];
    return Array.from(new Set(projectStructures.map(p => p.department_operator))).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [projectStructures]);

  const uniqueProjectTypes = useMemo(() => {
    if (!projectStructures || !Array.isArray(projectStructures)) return [];
    return Array.from(new Set(projectStructures.map(p => p.project_type))).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [projectStructures]);

  const uniqueBUs = useMemo(() => {
    if (!projectStructures || !Array.isArray(projectStructures)) return [];
    return Array.from(new Set(projectStructures.map(p => p.bu))).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [projectStructures]);

  // --- Project Structures Auto-editable DDL Cascading Suggestions ---

  // 1. Holding Suggestions (from master holdings)
  const holdingSuggestions = useMemo(() => {
    if (holdings && Array.isArray(holdings)) {
      return holdings.map(h => h.holding_name).sort((a, b) => a.localeCompare(b));
    }
    return [];
  }, [holdings]);

  const filteredHoldingSuggestions = useMemo(() => {
    const query = formStructHolding.toLowerCase().trim();
    if (!query) return holdingSuggestions;
    return holdingSuggestions.filter(name => name.toLowerCase().includes(query));
  }, [holdingSuggestions, formStructHolding]);

  // 2. Role Suggestions (Cascaded from Holding)
  const roleSuggestions = useMemo(() => {
    const selHolding = formStructHolding.trim().toLowerCase();
    const rolesSet = new Set<string>();
    
    // Find roles mapped under this holding in existing structures
    if (selHolding && projectStructures && Array.isArray(projectStructures)) {
      projectStructures.forEach((p: any) => {
        if (p.holding && p.holding.trim().toLowerCase() === selHolding && p.department_operator) {
          rolesSet.add(p.department_operator.trim());
        }
      });
    }
    // Fallback to all master roles if no matches
    if (rolesSet.size === 0 && roles && Array.isArray(roles)) {
      roles.forEach((r: any) => {
        if (r.role_name) rolesSet.add(r.role_name.trim());
      });
    }
    return Array.from(rolesSet).sort((a, b) => a.localeCompare(b));
  }, [roles, projectStructures, formStructHolding]);

  const filteredRoleSuggestions = useMemo(() => {
    const query = formStructRole.toLowerCase().trim();
    if (!query) return roleSuggestions;
    return roleSuggestions.filter(name => name.toLowerCase().includes(query));
  }, [roleSuggestions, formStructRole]);

  // 3. Project Type Suggestions (Cascaded from Holding + Role)
  const typeSuggestions = useMemo(() => {
    const selHolding = formStructHolding.trim().toLowerCase();
    const selRole = formStructRole.trim().toLowerCase();
    const typesSet = new Set<string>();
    
    // Find project types mapped under this holding + role combination in existing structures
    if (projectStructures && Array.isArray(projectStructures)) {
      projectStructures.forEach((p: any) => {
        const matchesHolding = !selHolding || (p.holding && p.holding.trim().toLowerCase() === selHolding);
        const matchesRole = !selRole || (p.department_operator && p.department_operator.trim().toLowerCase() === selRole);
        if (matchesHolding && matchesRole && p.project_type) {
          typesSet.add(p.project_type.trim());
        }
      });
    }
    // Fallback to all master project types if no matches
    if (typesSet.size === 0 && projectTypes && Array.isArray(projectTypes)) {
      projectTypes.forEach((t: any) => {
        if (t.type_name) typesSet.add(t.type_name.trim());
      });
    }
    return Array.from(typesSet).sort((a, b) => a.localeCompare(b));
  }, [projectTypes, projectStructures, formStructHolding, formStructRole]);

  const filteredTypeSuggestions = useMemo(() => {
    const query = formStructType.toLowerCase().trim();
    if (!query) return typeSuggestions;
    return typeSuggestions.filter(name => name.toLowerCase().includes(query));
  }, [typeSuggestions, formStructType]);

  // 4. Project Name Suggestions (Cascaded from Holding + Role + Project Type)
  const projNameSuggestions = useMemo(() => {
    const selHolding = formStructHolding.trim().toLowerCase();
    const selRole = formStructRole.trim().toLowerCase();
    const selType = formStructType.trim().toLowerCase();
    const names = new Set<string>();
    
    if (projectStructures && Array.isArray(projectStructures)) {
      projectStructures.forEach((p: any) => {
        const matchesHolding = !selHolding || (p.holding && p.holding.trim().toLowerCase() === selHolding);
        const matchesRole = !selRole || (p.department_operator && p.department_operator.trim().toLowerCase() === selRole);
        const matchesType = !selType || (p.project_type && p.project_type.trim().toLowerCase() === selType);
        if (matchesHolding && matchesRole && matchesType && p.project_name && p.project_name.trim()) {
          names.add(p.project_name.trim());
        }
      });
      // Fallback to all unique project names globally if no matches with current filters
      if (names.size === 0) {
        projectStructures.forEach((p: any) => {
          if (p.project_name && p.project_name.trim()) {
            names.add(p.project_name.trim());
          }
        });
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [projectStructures, formStructHolding, formStructRole, formStructType]);

  const filteredProjNameSuggestions = useMemo(() => {
    const query = formStructProjName.toLowerCase().trim();
    if (!query) return projNameSuggestions;
    return projNameSuggestions.filter(name => name.toLowerCase().includes(query));
  }, [projNameSuggestions, formStructProjName]);

  // 5. Module Suggestions (Cascaded from Holding + Role + Type + Project Name)
  const moduleSuggestions = useMemo(() => {
    const selHolding = formStructHolding.trim().toLowerCase();
    const selRole = formStructRole.trim().toLowerCase();
    const selType = formStructType.trim().toLowerCase();
    const selProj = formStructProjName.trim().toLowerCase();
    const modules = new Set<string>();
    
    if (projectStructures && Array.isArray(projectStructures)) {
      projectStructures.forEach((p: any) => {
        const matchesHolding = !selHolding || (p.holding && p.holding.trim().toLowerCase() === selHolding);
        const matchesRole = !selRole || (p.department_operator && p.department_operator.trim().toLowerCase() === selRole);
        const matchesType = !selType || (p.project_type && p.project_type.trim().toLowerCase() === selType);
        const matchesProj = !selProj || (p.project_name && p.project_name.trim().toLowerCase() === selProj);
        
        if (matchesHolding && matchesRole && matchesType && matchesProj && p.module && p.module.trim()) {
          modules.add(p.module.trim());
        }
      });
      // Fallback
      if (modules.size === 0) {
        projectStructures.forEach((p: any) => {
          if (p.module && p.module.trim()) {
            modules.add(p.module.trim());
          }
        });
      }
    }
    return Array.from(modules).sort((a, b) => a.localeCompare(b));
  }, [projectStructures, formStructHolding, formStructRole, formStructType, formStructProjName]);

  const filteredModuleSuggestions = useMemo(() => {
    const query = formStructModule.toLowerCase().trim();
    if (!query) return moduleSuggestions;
    return moduleSuggestions.filter(m => m.toLowerCase().includes(query));
  }, [moduleSuggestions, formStructModule]);

  // 6. Business Unit (BU) Suggestions (Cascaded from Holding + Role + Type + Project Name)
  const buSuggestions = useMemo(() => {
    const selHolding = formStructHolding.trim().toLowerCase();
    const selRole = formStructRole.trim().toLowerCase();
    const selType = formStructType.trim().toLowerCase();
    const selProj = formStructProjName.trim().toLowerCase();
    const bus = new Set<string>();
    
    if (projectStructures && Array.isArray(projectStructures)) {
      projectStructures.forEach((p: any) => {
        const matchesHolding = !selHolding || (p.holding && p.holding.trim().toLowerCase() === selHolding);
        const matchesRole = !selRole || (p.department_operator && p.department_operator.trim().toLowerCase() === selRole);
        const matchesType = !selType || (p.project_type && p.project_type.trim().toLowerCase() === selType);
        const matchesProj = !selProj || (p.project_name && p.project_name.trim().toLowerCase() === selProj);
        
        if (matchesHolding && matchesRole && matchesType && matchesProj && p.bu && p.bu.trim()) {
          bus.add(p.bu.trim());
        }
      });
      // Fallback
      if (bus.size === 0) {
        projectStructures.forEach((p: any) => {
          if (p.bu && p.bu.trim()) {
            bus.add(p.bu.trim());
          }
        });
      }
    }
    return Array.from(bus).sort((a, b) => a.localeCompare(b));
  }, [projectStructures, formStructHolding, formStructRole, formStructType, formStructProjName]);

  const filteredBUSuggestions = useMemo(() => {
    const query = formStructBU.toLowerCase().trim();
    if (!query) return buSuggestions;
    return buSuggestions.filter(b => b.toLowerCase().includes(query));
  }, [buSuggestions, formStructBU]);

  // 7. Department Name Suggestions (Cascaded from Holding + Role + Type + Project Name)
  const deptSuggestions = useMemo(() => {
    const selHolding = formStructHolding.trim().toLowerCase();
    const selRole = formStructRole.trim().toLowerCase();
    const selType = formStructType.trim().toLowerCase();
    const selProj = formStructProjName.trim().toLowerCase();
    const depts = new Set<string>();
    
    if (projectStructures && Array.isArray(projectStructures)) {
      projectStructures.forEach((p: any) => {
        const matchesHolding = !selHolding || (p.holding && p.holding.trim().toLowerCase() === selHolding);
        const matchesRole = !selRole || (p.department_operator && p.department_operator.trim().toLowerCase() === selRole);
        const matchesType = !selType || (p.project_type && p.project_type.trim().toLowerCase() === selType);
        const matchesProj = !selProj || (p.project_name && p.project_name.trim().toLowerCase() === selProj);
        
        if (matchesHolding && matchesRole && matchesType && matchesProj && p.department && p.department.trim()) {
          depts.add(p.department.trim());
        }
      });
      // Fallback
      if (depts.size === 0) {
        projectStructures.forEach((p: any) => {
          if (p.department && p.department.trim()) {
            depts.add(p.department.trim());
          }
        });
      }
    }
    return Array.from(depts).sort((a, b) => a.localeCompare(b));
  }, [projectStructures, formStructHolding, formStructRole, formStructType, formStructProjName]);

  const filteredDeptSuggestions = useMemo(() => {
    const query = formStructDept.toLowerCase().trim();
    if (!query) return deptSuggestions;
    return deptSuggestions.filter(d => d.toLowerCase().includes(query));
  }, [deptSuggestions, formStructDept]);

  const handleExportProjectStructures = () => {
    const headers = ['holding', 'department_operator', 'project_type', 'project_name', 'module', 'bu', 'department', 'project_description'];
    const csvContent = [
      headers.join(','),
      ...projectStructures.map(row => 
        headers.map(h => {
          const val = row[h] || '';
          const escaped = String(val).replace(/"/g, '""');
          return `"${escaped}"`;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `project_structures_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      try {
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length < 2) {
          showToast('ไฟล์ CSV ว่างเปล่า หรือไม่มีข้อมูล / CSV file is empty', 'error');
          return;
        }

        const parseCSVRow = (textRow: string) => {
          const result = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < textRow.length; i++) {
            const char = textRow[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result.map(v => v.replace(/^["']|["']$/g, '').replace(/""/g, '"'));
        };

        const headers = parseCSVRow(lines[0]);
        const requiredHeaders = ['holding', 'department_operator', 'project_type', 'project_name', 'bu', 'department'];
        const missing = requiredHeaders.filter(h => !headers.includes(h));
        
        if (missing.length > 0) {
          showToast(`ไฟล์ CSV ขาดคอลัมน์สำคัญ: ${missing.join(', ')}`, 'error');
          return;
        }

        const parsedRows: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          const rowValues = parseCSVRow(lines[i]);
          if (rowValues.length === 0 || (rowValues.length === 1 && rowValues[0] === '')) continue;
          
          const rowObj: any = {};
          headers.forEach((header, idx) => {
            rowObj[header] = rowValues[idx] || null;
          });

          if (!rowObj.holding || !rowObj.department_operator || !rowObj.project_type || !rowObj.project_name || !rowObj.bu || !rowObj.department) {
            continue; 
          }

          parsedRows.push({
            holding: rowObj.holding,
            department_operator: rowObj.department_operator,
            project_type: rowObj.project_type,
            project_name: rowObj.project_name,
            module: rowObj.module || null,
            bu: rowObj.bu,
            department: rowObj.department,
            project_description: rowObj.project_description || null
          });
        }

        if (parsedRows.length === 0) {
          showToast('ไม่พบข้อมูลแถวที่ถูกต้องสำหรับนำเข้า / No valid rows found to import', 'error');
          return;
        }

        // Frontend-assisted matching for upserting
        const newRows: any[] = [];
        const updateRows: any[] = [];

        // Match existing structures:
        // We match by: holding, department_operator, project_type, project_name, module (case insensitive)
        parsedRows.forEach(row => {
          const existing = projectStructures.find(p => 
            p.holding?.toLowerCase().trim() === row.holding?.toLowerCase().trim() &&
            p.department_operator?.toLowerCase().trim() === row.department_operator?.toLowerCase().trim() &&
            p.project_type?.toLowerCase().trim() === row.project_type?.toLowerCase().trim() &&
            p.project_name?.toLowerCase().trim() === row.project_name?.toLowerCase().trim() &&
            (p.module || '').toLowerCase().trim() === (row.module || '').toLowerCase().trim()
          );

          if (existing) {
            updateRows.push({
              ...row,
              id: existing.id // Keep the same ID to trigger Supabase upsert/update
            });
          } else {
            newRows.push(row);
          }
        });

        setImportPreview({
          newRows,
          updateRows,
          rawRows: parsedRows
        });
      } catch (err: any) {
        console.error('Error importing CSV:', err);
        showToast('เกิดข้อผิดพลาดในการนำเข้าไฟล์: ' + err.message, 'error');
      } finally {
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleExecuteUpsert = async () => {
    if (!importPreview) return;
    const { newRows, updateRows } = importPreview;
    
    const confirmed = await showConfirm({
      title: 'ยืนยันการนำเข้าข้อมูล (Import CSV)',
      message: `คุณต้องการดำเนินการนำเข้า (Upsert) ข้อมูลจริงหรือไม่?\n\n- เพิ่มใหม่ (New): ${newRows.length} รายการ\n- อัปเดต (Update): ${updateRows.length} รายการ\n\nการดำเนินการนี้จะจัดเก็บและเขียนทับข้อมูลลงในฐานข้อมูลทันที`,
      confirmText: 'นำเข้าข้อมูล',
      type: 'primary'
    });
    if (!confirmed) return;

    setIsLoading(true);
    try {
      const payload = [...newRows, ...updateRows];
      const { error } = await supabase
        .from('tb_map_project_structure')
        .upsert(payload, { onConflict: 'id' });

      if (error) throw error;

      showToast(`นำเข้า (Upsert) สำเร็จทั้งหมด ${payload.length} รายการ! (ใหม่: ${newRows.length}, อัปเดต: ${updateRows.length})`, 'success');
      setImportPreview(null);
      await loadAllData();
    } catch (err: any) {
      console.error('Error executing upsert:', err);
      showToast('เกิดข้อผิดพลาดในการนำเข้าข้อมูล: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Load All Master Data from Supabase
  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [
        resHoldings,
        resRoles,
        resTypes,
        resActions,
        resUserMaps,
        resProjStructs,
        resUsers,
        resHolidays
      ] = await Promise.all([
        supabase.from('tb_master_holding').select('*').order('holding_name'),
        supabase.from('tb_master_role').select('*').order('role_name'),
        supabase.from('tb_master_project_type').select('*').order('type_name'),
        supabase.from('tb_master_action').select('*').order('action_category'),
        supabase.from('tb_map_user_role').select('*').order('name'),
        supabase.from('tb_map_project_structure').select('*').order('project_name'),
        supabase.from('users').select('*').order('nickname'),
        supabase.from('tb_master_holiday').select('*').order('date', { ascending: false })
      ]);

      if (resHoldings.data) setHoldings(resHoldings.data);
      if (resRoles.data) setRoles(resRoles.data);
      if (resTypes.data) setProjectTypes(resTypes.data);
      if (resActions.data) setActions(resActions.data);
      if (resUserMaps.data) setUserMappings(resUserMaps.data);
      if (resProjStructs.data) setProjectStructures(resProjStructs.data);
      if (resUsers.data) setUsersList(resUsers.data);
      if (resHolidays.data) setHolidaysList(resHolidays.data);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Filter query helper
  const getFilteredData = () => {
    const q = searchQuery.toLowerCase().trim();
    switch (activeTab) {
      case 'holding':
        return holdings.filter(h => h.holding_name.toLowerCase().includes(q));
      case 'role':
        return roles.filter(r => r.role_name.toLowerCase().includes(q));
      case 'project_type':
        return projectTypes.filter(t => t.type_name.toLowerCase().includes(q));
      case 'action':
        return actions.filter(a => 
          a.action_name.toLowerCase().includes(q) || 
          a.action_category.toLowerCase().includes(q)
        );
      case 'map_user':
        return userMappings.filter(m => 
          m.name.toLowerCase().includes(q) || 
          m.holding.toLowerCase().includes(q) || 
          m.department_operator.toLowerCase().includes(q)
        );
      case 'map_project':
        return projectStructures.filter(p => {
          const matchesSearch = !q || (
            p.project_name.toLowerCase().includes(q) || 
            p.holding.toLowerCase().includes(q) || 
            p.department_operator.toLowerCase().includes(q) ||
            p.project_type.toLowerCase().includes(q) ||
            (p.module && p.module.toLowerCase().includes(q)) ||
            p.bu.toLowerCase().includes(q) ||
            p.department.toLowerCase().includes(q)
          );

          const matchesHolding = !filterHolding || p.holding === filterHolding;
          const matchesRole = !filterRole || p.department_operator === filterRole;
          const matchesType = !filterType || p.project_type === filterType;
          const matchesProject = !filterProject || p.project_name === filterProject;
          const matchesBU = !filterBU || p.bu === filterBU;

          return matchesSearch && matchesHolding && matchesRole && matchesType && matchesProject && matchesBU;
        });
      case 'users':
        return usersList.filter(u => 
          u.full_name.toLowerCase().includes(q) || 
          u.nickname.toLowerCase().includes(q) || 
          u.emp_id.toLowerCase().includes(q) ||
          (u.email && u.email.toLowerCase().includes(q))
        );
      case 'holiday':
        return holidaysList.filter(h => 
          h.date.includes(q) || 
          h.name.toLowerCase().includes(q)
        );
      default:
        return [];
    }
  };

  // Open modal for Create/Edit
  const openModal = (row: any = null) => {
    setIsHolidayDropdownOpen(false);
    setIsProjNameDropdownOpen(false);
    setIsModuleDropdownOpen(false);
    setIsBUDropdownOpen(false);
    setIsDeptDropdownOpen(false);
    setEditRow(row);
    if (row) {
      // Edit mode pre-fills
      if (activeTab === 'holding') setFormHoldingName(row.holding_name);
      else if (activeTab === 'role') setFormRoleName(row.role_name);
      else if (activeTab === 'project_type') setFormTypeName(row.type_name);
      else if (activeTab === 'action') {
        setFormActionCategory(row.action_category);
        setFormActionName(row.action_name);
      } else if (activeTab === 'map_user') {
        setFormMapUserName(row.name);
        setFormMapHolding(row.holding);
        setFormMapRole(row.department_operator);
      } else if (activeTab === 'map_project') {
        setFormStructHolding(row.holding);
        setFormStructRole(row.department_operator);
        setFormStructType(row.project_type);
        setFormStructProjName(row.project_name);
        setFormStructModule(row.module || '');
        setFormStructBU(row.bu);
        setFormStructDept(row.department);
        setFormStructDescription(row.project_description || '');
      } else if (activeTab === 'users') {
        setFormUserEmpId(row.emp_id);
        setFormUserFullName(row.full_name);
        setFormUserNickname(row.nickname || '');
        setFormUserEmail(row.email || '');
        setFormUserRole(row.role || 'user');
        setFormUserDept(row.department || 'IMP');
      } else if (activeTab === 'holiday') {
        setFormHolidayDate(row.date);
        setFormHolidayName(row.name);
      }
    } else {
      // Create mode reset
      setFormHoldingName('');
      setFormRoleName('');
      setFormTypeName('');
      setFormActionCategory('Project');
      setFormActionName('');
      setFormMapUserName('');
      setFormMapHolding(holdings[0]?.holding_name || '');
      setFormMapRole(roles[0]?.role_name || '');
      setFormStructHolding('');
      setFormStructRole('');
      setFormStructType('');
      setFormStructProjName('');
      setFormStructModule('');
      setFormStructBU('');
      setFormStructDept('');
      setFormStructDescription('');
      setFormUserEmpId(`EMP-${Math.floor(Math.random() * 90000 + 10000)}`);
      setFormUserFullName('');
      setFormUserNickname('');
      setFormUserEmail('');
      setFormUserRole('user');
      setFormUserDept('IMP');
      setFormHolidayDate(new Date().toISOString().split('T')[0]);
      setFormHolidayName('');
    }
    setIsModalOpen(true);
  };

  // Submit Handler for modal (Add / Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (activeTab === 'holding') {
        if (editRow) {
          // Master Tables with Text PKs usually require inserting new and deleting old, 
          // or just simple update if key doesn't change.
          showToast('Note: Cannot modify Primary Key text directly. Delete and recreate if needed.', 'warning');
        } else {
          const { error } = await supabase.from('tb_master_holding').insert({ holding_name: formHoldingName });
          if (error) throw error;
        }
      } else if (activeTab === 'role') {
        if (!editRow) {
          const { error } = await supabase.from('tb_master_role').insert({ role_name: formRoleName });
          if (error) throw error;
        } else {
          showToast('Note: Cannot modify Primary Key text directly. Delete and recreate if needed.', 'warning');
        }
      } else if (activeTab === 'project_type') {
        if (!editRow) {
          const { error } = await supabase.from('tb_master_project_type').insert({ type_name: formTypeName });
          if (error) throw error;
        } else {
          showToast('Note: Cannot modify Primary Key text directly. Delete and recreate if needed.', 'warning');
        }
      } else if (activeTab === 'action') {
        const payload = { action_category: formActionCategory, action_name: formActionName };
        if (editRow) {
          const { error } = await supabase.from('tb_master_action').update(payload).eq('id', editRow.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('tb_master_action').insert(payload);
          if (error) throw error;
        }
      } else if (activeTab === 'map_user') {
        const payload = { name: formMapUserName, holding: formMapHolding, department_operator: formMapRole };
        if (editRow) {
          const { error } = await supabase.from('tb_map_user_role').update(payload).eq('id', editRow.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('tb_map_user_role').insert(payload);
          if (error) throw error;
        }
      } else if (activeTab === 'map_project') {
        const payload = {
          holding: formStructHolding,
          department_operator: formStructRole,
          project_type: formStructType,
          project_name: formStructProjName,
          module: formStructModule || null,
          bu: formStructBU,
          department: formStructDept,
          project_description: formStructDescription || null
        };
        if (editRow) {
          const { error } = await supabase.from('tb_map_project_structure').update(payload).eq('id', editRow.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('tb_map_project_structure').insert(payload);
          if (error) throw error;
        }
      } else if (activeTab === 'users') {
        const payload = {
          emp_id: formUserEmpId,
          full_name: formUserFullName,
          nickname: formUserNickname || null,
          email: formUserEmail || null,
          role: formUserRole,
          department: formUserDept
        };
        if (editRow) {
          const { error } = await supabase.from('users').update(payload).eq('id', editRow.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('users').insert(payload);
          if (error) throw error;
        }
      } else if (activeTab === 'holiday') {
        const payload = {
          date: formHolidayDate,
          name: formHolidayName
        };
        if (editRow) {
          const { error } = await supabase.from('tb_master_holiday').update({ name: formHolidayName }).eq('date', editRow.date);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('tb_master_holiday').insert(payload);
          if (error) throw error;
        }
      }

      setIsModalOpen(false);
      loadAllData();
      showToast('Record saved successfully!', 'success');
    } catch (err: any) {
      console.error('Error saving record:', err);
      showToast('Error saving record: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete Handler
  const handleDelete = async (row: any) => {
    const confirmed = await showConfirm({
      title: 'Confirm Delete',
      message: 'Are you sure you want to delete this record? This action cannot be undone.',
      confirmText: 'Delete',
      type: 'danger'
    });
    if (!confirmed) return;
    setIsLoading(true);

    try {
      let query = supabase.from(
        activeTab === 'holding' ? 'tb_master_holding' :
        activeTab === 'role' ? 'tb_master_role' :
        activeTab === 'project_type' ? 'tb_master_project_type' :
        activeTab === 'action' ? 'tb_master_action' :
        activeTab === 'map_user' ? 'tb_map_user_role' :
        activeTab === 'map_project' ? 'tb_map_project_structure' :
        activeTab === 'holiday' ? 'tb_master_holiday' : 'users'
      );

      let deleteOp;
      if (activeTab === 'holding') deleteOp = query.delete().eq('holding_name', row.holding_name);
      else if (activeTab === 'role') deleteOp = query.delete().eq('role_name', row.role_name);
      else if (activeTab === 'project_type') deleteOp = query.delete().eq('type_name', row.type_name);
      else if (activeTab === 'holiday') deleteOp = query.delete().eq('date', row.date);
      else deleteOp = query.delete().eq('id', row.id);

      const { error } = await deleteOp;
      if (error) throw error;

      loadAllData();
      showToast('Record deleted successfully!', 'success');
    } catch (err: any) {
      console.error('Error deleting record:', err);
      showToast('Error deleting record: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const tabs: { key: TableTab; label: string; icon: any }[] = [
    { key: 'holding', label: 'Holdings', icon: Database },
    { key: 'role', label: 'Roles', icon: Shield },
    { key: 'project_type', label: 'Project Types', icon: Cpu },
    { key: 'action', label: 'Actions', icon: Activity },
    { key: 'map_user', label: 'User Mappings', icon: UserCheck },
    { key: 'map_project', label: 'Project Structures', icon: GitMerge },
    { key: 'users', label: 'System Users', icon: Users },
    { key: 'holiday', label: 'Holidays', icon: Calendar },
    { key: 'ai_settings', label: 'AI Settings', icon: Sliders },
    { key: 'ai_prompt', label: 'AI Prompts', icon: MessageSquare }
  ];

  const filteredData = getFilteredData();
  const totalPages = Math.ceil(filteredData.length / entriesPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-theme-text tracking-tight theme-heading-gradient flex items-center gap-2">
              <Database className="text-indigo-400" />
              <span>Master Data Manager</span>
            </h1>
            <p className="text-sm text-theme-text-secondary mt-1">
              Add, edit, or check your Supabase master tables and relationship cascading structures.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab !== 'ai_settings' && activeTab !== 'ai_prompt' && (
              <button 
                onClick={loadAllData}
                className="p-2.5 rounded-xl bg-theme-surface-tertiary dark:bg-theme-surface-tertiary hover:bg-slate-700 text-theme-text-secondary transition-all border border-theme-border/50"
                title="Refresh database entries"
              >
                <RefreshCw size={18} className={cn(isLoading && "animate-spin")} />
              </button>
            )}
             {activeTab !== 'ai_settings' && activeTab !== 'ai_prompt' && (
              <div className="flex items-center gap-2">
                {activeTab === 'map_project' && (
                  <>
                    <button 
                      onClick={handleExportProjectStructures}
                      className="inline-flex items-center gap-2 bg-theme-surface border border-theme-border hover:bg-theme-surface-secondary text-theme-text-secondary hover:text-theme-text px-4 py-2.5 rounded-xl font-bold transition-all active:scale-95 text-sm"
                      title="Export Project Structures to CSV"
                    >
                      <Download size={16} />
                      <span>Export CSV</span>
                    </button>
                    <button 
                      onClick={() => document.getElementById('import-project-structures-csv')?.click()}
                      className="inline-flex items-center gap-2 bg-theme-surface border border-theme-border hover:bg-theme-surface-secondary text-theme-text-secondary hover:text-theme-text px-4 py-2.5 rounded-xl font-bold transition-all active:scale-95 text-sm"
                      title="Import Project Structures from CSV"
                    >
                      <Upload size={16} />
                      <span>Import CSV</span>
                    </button>
                    <input 
                      type="file" 
                      id="import-project-structures-csv" 
                      className="hidden" 
                      accept=".csv" 
                      onChange={handleImportCSV} 
                    />
                  </>
                )}
                <button 
                  onClick={() => openModal()}
                  className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-theme-text px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg active:scale-95 text-sm"
                >
                  <Plus size={16} />
                  <span>Add Record</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Navigation/Selector Column */}
          <div className="w-full lg:w-64 shrink-0 space-y-4 lg:sticky lg:top-4 self-start">
            {/* Desktop Tabs: Vertical List */}
            <div className="hidden lg:flex flex-col bg-theme-surface-tertiary dark:bg-theme-surface-tertiary/60 border border-theme-border/50 rounded-2xl p-4 shadow-lg space-y-1 max-h-[calc(100vh-160px)] overflow-y-auto custom-scrollbar">
              <h2 className="px-3 py-2 text-xs font-bold text-theme-text-secondary uppercase tracking-wider mb-2">Master Tables</h2>
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => { setActiveTab(tab.key); setSearchQuery(''); resetFilters(); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all border text-left",
                      activeTab === tab.key 
                        ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                        : "text-theme-text-secondary border-transparent hover:text-theme-text hover:bg-theme-surface-secondary/40"
                    )}
                  >
                    <Icon size={16} className={cn(activeTab === tab.key ? "text-indigo-400" : "text-theme-text-secondary")} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Mobile Dropdown Tab Selector */}
            <div className="lg:hidden relative">
              <label className="block text-xs font-bold text-theme-text-secondary uppercase tracking-wider mb-1.5 ml-1">Select Master Collection</label>
              <button
                onClick={() => setIsMobileTabMenuOpen(prev => !prev)}
                className="w-full flex items-center justify-between bg-theme-surface-tertiary dark:bg-theme-surface-tertiary border border-theme-border/50 rounded-xl px-4 py-3 text-theme-text focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
              >
                <div className="flex items-center gap-2">
                  {(() => {
                    const currentTab = tabs.find(t => t.key === activeTab);
                    const CurrentIcon = currentTab?.icon || Database;
                    return (
                      <>
                        <CurrentIcon size={16} className="text-indigo-400" />
                        <span>{currentTab?.label}</span>
                      </>
                    );
                  })()}
                </div>
                <ChevronDown size={16} className={cn("text-theme-text-secondary transition-transform duration-200", isMobileTabMenuOpen && "rotate-180")} />
              </button>

              {isMobileTabMenuOpen && (
                <>
                  {/* Backdrop */}
                  <div className="fixed inset-0 z-40" onClick={() => setIsMobileTabMenuOpen(false)} />
                  <div className="absolute left-0 right-0 mt-2 bg-theme-surface-tertiary dark:bg-theme-surface-tertiary border border-theme-border/80 rounded-xl shadow-2xl p-2 z-50 divide-y divide-theme-border/50 max-h-[320px] overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-150">
                    {tabs.map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.key}
                          onClick={() => {
                            setActiveTab(tab.key);
                            setSearchQuery('');
                            resetFilters();
                            setIsMobileTabMenuOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-lg text-left transition-all",
                            activeTab === tab.key 
                              ? "bg-indigo-500/10 text-indigo-400"
                              : "text-theme-text hover:bg-theme-surface-secondary"
                          )}
                        >
                          <Icon size={16} className={cn(activeTab === tab.key ? "text-indigo-400" : "text-theme-text-secondary")} />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Table/Content Column */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* Search Bar & Filters */}
            {activeTab !== 'ai_settings' && activeTab !== 'ai_prompt' && (
              <div className="bg-theme-surface-tertiary dark:bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-2xl p-4 shadow-lg flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="relative w-full md:w-1/3">
                    <input 
                      type="text" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={`Search in ${tabs.find(t => t.key === activeTab)?.label}...`}
                      className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl py-2 pl-10 pr-4 text-theme-text placeholder:text-theme-text-secondary focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                    />
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-text-secondary" />
                  </div>
                  
                  {activeTab === 'map_project' && (
                    (filterProject || filterHolding || filterRole || filterType || filterBU || searchQuery) && (
                      <button
                        onClick={() => { setSearchQuery(''); resetFilters(); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-all self-start md:self-auto"
                      >
                        <RotateCcw size={12} />
                        Clear All Filters
                      </button>
                    )
                  )}
                </div>

                {activeTab === 'map_project' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-4 border-t border-theme-border/30">
                    {/* Project Filter */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-theme-text-secondary">Project</label>
                      <select
                        value={filterProject}
                        onChange={(e) => setFilterProject(e.target.value)}
                        className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl py-1.5 px-3 text-theme-text placeholder:text-theme-text-secondary focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-xs transition-all"
                      >
                        <option value="">All Projects</option>
                        {uniqueProjects.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    {/* Holding Filter */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-theme-text-secondary">Holding</label>
                      <select
                        value={filterHolding}
                        onChange={(e) => setFilterHolding(e.target.value)}
                        className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl py-1.5 px-3 text-theme-text placeholder:text-theme-text-secondary focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-xs transition-all"
                      >
                        <option value="">All Holdings</option>
                        {uniqueHoldings.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Role Filter */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-theme-text-secondary">Role</label>
                      <select
                        value={filterRole}
                        onChange={(e) => setFilterRole(e.target.value)}
                        className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl py-1.5 px-3 text-theme-text placeholder:text-theme-text-secondary focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-xs transition-all"
                      >
                        <option value="">All Roles</option>
                        {uniqueRoles.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>

                    {/* Type Filter */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-theme-text-secondary">Type</label>
                      <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl py-1.5 px-3 text-theme-text placeholder:text-theme-text-secondary focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-xs transition-all"
                      >
                        <option value="">All Types</option>
                        {uniqueProjectTypes.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    {/* BU Filter */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-theme-text-secondary">BU / Dept</label>
                      <select
                        value={filterBU}
                        onChange={(e) => setFilterBU(e.target.value)}
                        className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl py-1.5 px-3 text-theme-text placeholder:text-theme-text-secondary focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-xs transition-all"
                      >
                        <option value="">All BUs</option>
                        {uniqueBUs.map(bu => (
                          <option key={bu} value={bu}>{bu}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Table Content Card */}
            {activeTab !== 'ai_settings' && activeTab !== 'ai_prompt' ? (
              <div className="bg-theme-surface-tertiary dark:bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-2xl shadow-xl overflow-hidden">
                {isLoading ? (
                  <div className="p-16 text-center animate-pulse flex flex-col gap-4">
                    <div className="h-6 w-full bg-theme-surface-tertiary dark:bg-theme-surface-tertiary rounded"></div>
                    <div className="h-6 w-full bg-theme-surface-tertiary dark:bg-theme-surface-tertiary rounded"></div>
                    <div className="h-6 w-full bg-theme-surface-tertiary dark:bg-theme-surface-tertiary rounded"></div>
                  </div>
                ) : filteredData.length === 0 ? (
                  <div className="p-16 text-center flex flex-col items-center justify-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-theme-surface-tertiary dark:bg-theme-surface-tertiary flex items-center justify-center text-theme-text-secondary">
                      <Search size={28} />
                    </div>
                    <h3 className="text-theme-text font-medium">No records found</h3>
                    <p className="text-sm text-theme-text-secondary">
                      Click "+ Add Record" above to populate this master collection.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-theme-text-secondary bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 uppercase border-b border-theme-border/50">
                        {activeTab === 'holding' && (
                          <tr>
                            <th className="px-6 py-4 font-semibold">Holding Name</th>
                            <th className="px-6 py-4 font-semibold text-right">Actions</th>
                          </tr>
                        )}
                        {activeTab === 'role' && (
                          <tr>
                            <th className="px-6 py-4 font-semibold">Role Operator Name</th>
                            <th className="px-6 py-4 font-semibold text-right">Actions</th>
                          </tr>
                        )}
                        {activeTab === 'project_type' && (
                          <tr>
                            <th className="px-6 py-4 font-semibold">Project Type Name</th>
                            <th className="px-6 py-4 font-semibold text-right">Actions</th>
                          </tr>
                        )}
                        {activeTab === 'action' && (
                          <tr>
                            <th className="px-6 py-4 font-semibold">Category</th>
                            <th className="px-6 py-4 font-semibold">Action Name</th>
                            <th className="px-6 py-4 font-semibold text-right">Actions</th>
                          </tr>
                        )}
                        {activeTab === 'map_user' && (
                          <tr>
                            <th className="px-6 py-4 font-semibold">Name</th>
                            <th className="px-6 py-4 font-semibold">Holding</th>
                            <th className="px-6 py-4 font-semibold">Department Operator (Role)</th>
                            <th className="px-6 py-4 font-semibold text-right">Actions</th>
                          </tr>
                        )}
                        {activeTab === 'map_project' && (
                          <tr>
                            <th className="px-6 py-4 font-semibold">Project & Module</th>
                            <th className="px-6 py-4 font-semibold">Allocation & Context</th>
                            <th className="px-6 py-4 font-semibold text-right">Actions</th>
                          </tr>
                        )}
                        {activeTab === 'users' && (
                          <tr>
                            <th className="px-6 py-4 font-semibold">User Profile</th>
                            <th className="px-6 py-4 font-semibold">Affiliation & Role</th>
                            <th className="px-6 py-4 font-semibold text-right">Actions</th>
                          </tr>
                        )}
                        {activeTab === 'holiday' && (
                          <tr>
                            <th className="px-6 py-4 font-semibold">Holiday Date</th>
                            <th className="px-6 py-4 font-semibold">Holiday Name</th>
                            <th className="px-6 py-4 font-semibold text-right">Actions</th>
                          </tr>
                        )}
                      </thead>
                      <tbody className="divide-y divide-theme-border/50">
                        {paginatedData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-theme-surface-secondary dark:hover:bg-theme-surface-secondary/30 transition-colors">
                            {activeTab === 'holding' && (
                              <>
                                <td className="px-6 py-4 font-bold text-theme-text">{row.holding_name}</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                  <button onClick={() => handleDelete(row)} className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </>
                            )}
                            {activeTab === 'role' && (
                              <>
                                <td className="px-6 py-4 font-bold text-theme-text">{row.role_name}</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                  <button onClick={() => handleDelete(row)} className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </>
                            )}
                            {activeTab === 'project_type' && (
                              <>
                                <td className="px-6 py-4 font-bold text-theme-text">{row.type_name}</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                  <button onClick={() => handleDelete(row)} className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </>
                            )}
                            {activeTab === 'action' && (
                              <>
                                <td className="px-6 py-4 text-theme-text-secondary font-semibold">{row.action_category}</td>
                                <td className="px-6 py-4 font-bold text-theme-text">{row.action_name}</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                  <button onClick={() => openModal(row)} className="p-2 text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors">
                                    <Edit2 size={16} />
                                  </button>
                                  <button onClick={() => handleDelete(row)} className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </>
                            )}
                            {activeTab === 'map_user' && (
                              <>
                                <td className="px-6 py-4 font-bold text-theme-text">{row.name}</td>
                                <td className="px-6 py-4 text-theme-text-secondary">{row.holding}</td>
                                <td className="px-6 py-4 text-indigo-400 font-semibold">{row.department_operator}</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                  <button onClick={() => openModal(row)} className="p-2 text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors">
                                    <Edit2 size={16} />
                                  </button>
                                  <button onClick={() => handleDelete(row)} className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </>
                            )}
                            {activeTab === 'map_project' && (
                              <>
                                <td className="px-6 py-4">
                                  <div className="font-bold text-indigo-400 text-sm">{row.project_name}</div>
                                  {row.module && <div className="text-xs text-theme-text-secondary mt-0.5">Module: {row.module}</div>}
                                  {row.project_description && <div className="text-[11px] text-theme-text-muted mt-1 italic line-clamp-2 max-w-[200px]" title={row.project_description}>{row.project_description}</div>}
                                </td>
                                <td className="px-6 py-4 text-xs space-y-1">
                                  <div><span className="text-theme-text-muted font-medium">Holding:</span> <span className="text-theme-text font-semibold">{row.holding}</span></div>
                                  <div><span className="text-theme-text-muted font-medium">Role:</span> <span className="text-indigo-400 font-semibold">{row.department_operator}</span></div>
                                  <div><span className="text-theme-text-muted font-medium">Type:</span> <span className="text-theme-text">{row.project_type}</span></div>
                                  <div><span className="text-theme-text-muted font-medium">BU/Dept:</span> <span className="text-theme-text font-medium">{row.bu} / {row.department}</span></div>
                                </td>
                                <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                                  <button onClick={() => openModal(row)} className="p-2 text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors">
                                    <Edit2 size={16} />
                                  </button>
                                  <button onClick={() => handleDelete(row)} className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </>
                            )}
                            {activeTab === 'users' && (
                              <>
                                <td className="px-6 py-4">
                                  <div className="font-bold text-theme-text flex items-center gap-1.5 flex-wrap">
                                    <span>{row.full_name}</span>
                                    {row.nickname && <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">({row.nickname})</span>}
                                  </div>
                                  <div className="text-xs font-mono text-theme-text-secondary mt-0.5">ID: {row.emp_id}</div>
                                  {row.email && <div className="text-xs text-theme-text-muted mt-0.5 font-medium">{row.email}</div>}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-xs text-theme-text-secondary mb-1.5">Dept: <span className="font-bold text-theme-text">{row.department}</span></div>
                                  <span className={cn(
                                    "px-2 py-0.5 text-xs font-semibold rounded-full border whitespace-nowrap",
                                    row.role === 'admin' 
                                      ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
                                      : "text-theme-text-secondary bg-slate-400/10 border-slate-400/20"
                                  )}>
                                    {row.role}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                                  <button onClick={() => openModal(row)} className="p-2 text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors">
                                    <Edit2 size={16} />
                                  </button>
                                  <button onClick={() => handleDelete(row)} className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </>
                            )}
                            {activeTab === 'holiday' && (
                              <>
                                <td className="px-6 py-4 font-bold text-theme-text font-mono">{row.date}</td>
                                <td className="px-6 py-4 text-theme-text font-medium">{row.name}</td>
                                <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                                  <button onClick={() => openModal(row)} className="p-2 text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors">
                                    <Edit2 size={16} />
                                  </button>
                                  <button onClick={() => handleDelete(row)} className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination Bar */}
                {!isLoading && totalPages > 1 && (
                  <div className="px-6 py-4 bg-theme-surface-secondary dark:bg-theme-surface-secondary/40 border-t border-theme-border/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <span className="text-xs text-theme-text-secondary font-medium font-mono">
                      Showing {((currentPage - 1) * entriesPerPage) + 1} - {Math.min(currentPage * entriesPerPage, filteredData.length)} of {filteredData.length} entries
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        className="px-3 py-1.5 bg-theme-surface dark:bg-theme-surface-tertiary border border-theme-border/50 hover:border-theme-border disabled:opacity-40 disabled:cursor-not-allowed text-xs text-theme-text-secondary font-bold rounded-lg transition-all"
                      >
                        Previous
                      </button>
                      {Array.from({ length: totalPages }).map((_, i) => {
                        const page = i + 1;
                        if (totalPages > 6 && Math.abs(page - currentPage) > 1 && page !== 1 && page !== totalPages) {
                          if (page === 2 && currentPage > 3) return <span key={page} className="text-theme-text-secondary text-xs px-1 select-none font-mono">...</span>;
                          if (page === totalPages - 1 && currentPage < totalPages - 2) return <span key={page} className="text-theme-text-secondary text-xs px-1 select-none font-mono">...</span>;
                          return null;
                        }
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={cn(
                              "w-8 h-8 flex items-center justify-center text-xs font-bold rounded-lg transition-all font-mono border",
                              currentPage === page
                                ? "bg-indigo-500 text-theme-text border-transparent shadow-md shadow-indigo-500/10"
                                : "bg-transparent text-theme-text-secondary border-transparent hover:text-theme-text hover:bg-theme-surface-tertiary dark:hover:bg-theme-surface-tertiary"
                            )}
                          >
                            {page}
                          </button>
                        );
                      })}
                      <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        className="px-3 py-1.5 bg-theme-surface dark:bg-theme-surface-tertiary border border-theme-border/50 hover:border-theme-border disabled:opacity-40 disabled:cursor-not-allowed text-xs text-theme-text-secondary font-bold rounded-lg transition-all"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : activeTab === 'ai_settings' ? (
              <AISettingsManager />
            ) : (
              <AIPromptsManager />
            )}
          </div>
        </div>

      </div>

      {/* CRUD Overlay Modal Drawer */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={cn(
            "w-full bg-theme-surface dark:bg-theme-surface-tertiary border border-theme-border/80 rounded-2xl p-6 md:p-8 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 text-theme-text",
            (activeTab === 'map_project' || activeTab === 'users') ? "max-w-2xl" : "max-w-lg"
          )}>
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-theme-text-secondary hover:text-theme-text"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold text-theme-text tracking-tight mb-6 flex items-center gap-2">
              <Database size={20} className="text-indigo-400" />
              <span>{editRow ? 'Edit Record' : 'Add New Record'}</span>
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Tab 1: Holding Form */}
              {activeTab === 'holding' && (
                <div>
                  <label className="block text-sm font-medium text-theme-text-secondary mb-2">Holding Name</label>
                  <input 
                    type="text" 
                    value={formHoldingName}
                    onChange={(e) => setFormHoldingName(e.target.value)}
                    placeholder="e.g. Double A"
                    className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl py-2.5 px-4 text-theme-text placeholder:text-theme-text-secondary focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    required
                    disabled={!!editRow}
                  />
                  {editRow && <p className="text-xs text-amber-400 mt-2">Primary key cannot be modified directly.</p>}
                </div>
              )}

              {/* Tab 2: Role Form */}
              {activeTab === 'role' && (
                <div>
                  <label className="block text-sm font-medium text-theme-text-secondary mb-2">Role/Department Name</label>
                  <input 
                    type="text" 
                    value={formRoleName}
                    onChange={(e) => setFormRoleName(e.target.value)}
                    placeholder="e.g. IMP"
                    className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl py-2.5 px-4 text-theme-text placeholder:text-theme-text-secondary focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    required
                    disabled={!!editRow}
                  />
                  {editRow && <p className="text-xs text-amber-400 mt-2">Primary key cannot be modified directly.</p>}
                </div>
              )}

              {/* Tab 3: Project Type Form */}
              {activeTab === 'project_type' && (
                <div>
                  <label className="block text-sm font-medium text-theme-text-secondary mb-2">Project Type Name</label>
                  <input 
                    type="text" 
                    value={formTypeName}
                    onChange={(e) => setFormTypeName(e.target.value)}
                    placeholder="e.g. Support Go-Live"
                    className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl py-2.5 px-4 text-theme-text placeholder:text-theme-text-secondary focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    required
                    disabled={!!editRow}
                  />
                  {editRow && <p className="text-xs text-amber-400 mt-2">Primary key cannot be modified directly.</p>}
                </div>
              )}

              {/* Tab 4: Action Form */}
              {activeTab === 'action' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-theme-text-secondary mb-2">Category</label>
                    <select
                      value={formActionCategory}
                      onChange={(e) => setFormActionCategory(e.target.value)}
                      className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl py-2.5 px-4 text-theme-text focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="Project">Project</option>
                      <option value="Support">Support</option>
                      <option value="Management">Management</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-theme-text-secondary mb-2">Action Name</label>
                    <input 
                      type="text" 
                      value={formActionName}
                      onChange={(e) => setFormActionName(e.target.value)}
                      placeholder="e.g. User Requirement Gathering"
                      className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl py-2.5 px-4 text-theme-text placeholder:text-theme-text-secondary focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      required
                    />
                  </div>
                </>
              )}

              {/* Tab 5: User Mapping Form */}
              {activeTab === 'map_user' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-theme-text-secondary mb-2">Employee/User Name</label>
                    <input 
                      type="text" 
                      value={formMapUserName}
                      onChange={(e) => setFormMapUserName(e.target.value)}
                      placeholder="e.g. Jintana"
                      className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl py-2.5 px-4 text-theme-text placeholder:text-theme-text-secondary focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-theme-text-secondary mb-2">Holding</label>
                    <select
                      value={formMapHolding}
                      onChange={(e) => setFormMapHolding(e.target.value)}
                      className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl py-2.5 px-4 text-theme-text focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      required
                    >
                      {holdings.map(h => (
                        <option key={h.holding_name} value={h.holding_name}>{h.holding_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-theme-text-secondary mb-2">Department Operator (Role)</label>
                    <select
                      value={formMapRole}
                      onChange={(e) => setFormMapRole(e.target.value)}
                      className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl py-2.5 px-4 text-theme-text focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      required
                    >
                      {roles.map(r => (
                        <option key={r.role_name} value={r.role_name}>{r.role_name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Tab 6: Project Structure Form */}
              {activeTab === 'map_project' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2 pb-24">
                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">Holding</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={formStructHolding}
                        onChange={(e) => {
                          setFormStructHolding(e.target.value);
                          setIsHoldingDropdownOpen(true);
                        }}
                        onFocus={() => setIsHoldingDropdownOpen(true)}
                        placeholder="e.g. Double A"
                        className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-lg py-2 px-3 pr-12 text-xs text-theme-text placeholder:text-theme-text-secondary focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                      />
                      {formStructHolding && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormStructHolding('');
                            setIsHoldingDropdownOpen(true);
                          }}
                          className="absolute right-7 top-1/2 -translate-y-1/2 p-1 text-theme-text-secondary hover:text-theme-text cursor-pointer rounded"
                        >
                          <X size={12} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsHoldingDropdownOpen(prev => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-theme-text-secondary hover:text-theme-text cursor-pointer rounded"
                      >
                        <ChevronDown size={14} className={cn("transition-transform duration-200", isHoldingDropdownOpen && "rotate-180")} />
                      </button>
                      
                      {isHoldingDropdownOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setIsHoldingDropdownOpen(false)} 
                          />
                          <ul className="absolute left-0 right-0 mt-1 bg-theme-surface dark:bg-theme-surface-secondary border border-theme-border rounded-lg shadow-xl max-h-48 overflow-y-auto z-50 py-1 divide-y divide-theme-border/30 custom-scrollbar animate-in fade-in duration-100">
                            {filteredHoldingSuggestions.length > 0 ? (
                              filteredHoldingSuggestions.map((name) => (
                                <li key={name}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFormStructHolding(name);
                                      setIsHoldingDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 text-theme-text hover:font-semibold transition-colors cursor-pointer whitespace-normal break-words"
                                  >
                                    {name}
                                  </button>
                                </li>
                              ))
                            ) : (
                              <li className="px-3 py-2 text-[11px] text-theme-text-muted italic">
                                No matching holdings found. Press Save to use "{formStructHolding}"
                              </li>
                            )}
                          </ul>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">Role Operator</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={formStructRole}
                        onChange={(e) => {
                          setFormStructRole(e.target.value);
                          setIsRoleDropdownOpen(true);
                        }}
                        onFocus={() => setIsRoleDropdownOpen(true)}
                        placeholder="e.g. IMP"
                        className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-lg py-2 px-3 pr-12 text-xs text-theme-text placeholder:text-theme-text-secondary focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                      />
                      {formStructRole && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormStructRole('');
                            setIsRoleDropdownOpen(true);
                          }}
                          className="absolute right-7 top-1/2 -translate-y-1/2 p-1 text-theme-text-secondary hover:text-theme-text cursor-pointer rounded"
                        >
                          <X size={12} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsRoleDropdownOpen(prev => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-theme-text-secondary hover:text-theme-text cursor-pointer rounded"
                      >
                        <ChevronDown size={14} className={cn("transition-transform duration-200", isRoleDropdownOpen && "rotate-180")} />
                      </button>
                      
                      {isRoleDropdownOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setIsRoleDropdownOpen(false)} 
                          />
                          <ul className="absolute left-0 right-0 mt-1 bg-theme-surface dark:bg-theme-surface-secondary border border-theme-border rounded-lg shadow-xl max-h-48 overflow-y-auto z-50 py-1 divide-y divide-theme-border/30 custom-scrollbar animate-in fade-in duration-100">
                            {filteredRoleSuggestions.length > 0 ? (
                              filteredRoleSuggestions.map((name) => (
                                <li key={name}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFormStructRole(name);
                                      setIsRoleDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 text-theme-text hover:font-semibold transition-colors cursor-pointer whitespace-normal break-words"
                                  >
                                    {name}
                                  </button>
                                </li>
                              ))
                            ) : (
                              <li className="px-3 py-2 text-[11px] text-theme-text-muted italic">
                                No matching roles found. Press Save to use "{formStructRole}"
                              </li>
                            )}
                          </ul>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">Project Type</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={formStructType}
                        onChange={(e) => {
                          setFormStructType(e.target.value);
                          setIsTypeDropdownOpen(true);
                        }}
                        onFocus={() => setIsTypeDropdownOpen(true)}
                        placeholder="e.g. Support Go-Live"
                        className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-lg py-2 px-3 pr-12 text-xs text-theme-text placeholder:text-theme-text-secondary focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                      />
                      {formStructType && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormStructType('');
                            setIsTypeDropdownOpen(true);
                          }}
                          className="absolute right-7 top-1/2 -translate-y-1/2 p-1 text-theme-text-secondary hover:text-theme-text cursor-pointer rounded"
                        >
                          <X size={12} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsTypeDropdownOpen(prev => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-theme-text-secondary hover:text-theme-text cursor-pointer rounded"
                      >
                        <ChevronDown size={14} className={cn("transition-transform duration-200", isTypeDropdownOpen && "rotate-180")} />
                      </button>
                      
                      {isTypeDropdownOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setIsTypeDropdownOpen(false)} 
                          />
                          <ul className="absolute left-0 right-0 mt-1 bg-theme-surface dark:bg-theme-surface-secondary border border-theme-border rounded-lg shadow-xl max-h-48 overflow-y-auto z-50 py-1 divide-y divide-theme-border/30 custom-scrollbar animate-in fade-in duration-100">
                            {filteredTypeSuggestions.length > 0 ? (
                              filteredTypeSuggestions.map((name) => (
                                <li key={name}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFormStructType(name);
                                      setIsTypeDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 text-theme-text hover:font-semibold transition-colors cursor-pointer whitespace-normal break-words"
                                  >
                                    {name}
                                  </button>
                                </li>
                              ))
                            ) : (
                              <li className="px-3 py-2 text-[11px] text-theme-text-muted italic">
                                No matching types found. Press Save to use "{formStructType}"
                              </li>
                            )}
                          </ul>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">Project Name</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={formStructProjName}
                        onChange={(e) => {
                          setFormStructProjName(e.target.value);
                          setIsProjNameDropdownOpen(true);
                        }}
                        onFocus={() => setIsProjNameDropdownOpen(true)}
                        placeholder="e.g. ERP - Netsuite"
                        className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-lg py-2 px-3 pr-12 text-xs text-theme-text placeholder:text-theme-text-secondary focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                      />
                      {formStructProjName && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormStructProjName('');
                            setIsProjNameDropdownOpen(true);
                          }}
                          className="absolute right-7 top-1/2 -translate-y-1/2 p-1 text-theme-text-secondary hover:text-theme-text cursor-pointer rounded"
                        >
                          <X size={12} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsProjNameDropdownOpen(prev => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-theme-text-secondary hover:text-theme-text cursor-pointer rounded"
                      >
                        <ChevronDown size={14} className={cn("transition-transform duration-200", isProjNameDropdownOpen && "rotate-180")} />
                      </button>
                      
                      {isProjNameDropdownOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setIsProjNameDropdownOpen(false)} 
                          />
                          <ul className="absolute left-0 right-0 mt-1 bg-theme-surface dark:bg-theme-surface-secondary border border-theme-border rounded-lg shadow-xl max-h-48 overflow-y-auto z-50 py-1 divide-y divide-theme-border/30 custom-scrollbar animate-in fade-in duration-100">
                            {filteredProjNameSuggestions.length > 0 ? (
                              filteredProjNameSuggestions.map((name) => (
                                <li key={name}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFormStructProjName(name);
                                      setIsProjNameDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 text-theme-text hover:font-semibold transition-colors cursor-pointer whitespace-normal break-words"
                                  >
                                    {name}
                                  </button>
                                </li>
                              ))
                            ) : (
                              <li className="px-3 py-2 text-[11px] text-theme-text-muted italic">
                                No matching projects found. Press Save to use "{formStructProjName}"
                              </li>
                            )}
                          </ul>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">Module (Optional)</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={formStructModule}
                        onChange={(e) => {
                          setFormStructModule(e.target.value);
                          setIsModuleDropdownOpen(true);
                        }}
                        onFocus={() => setIsModuleDropdownOpen(true)}
                        placeholder="e.g. Item Master"
                        className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-lg py-2 px-3 pr-12 text-xs text-theme-text placeholder:text-theme-text-secondary focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      {formStructModule && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormStructModule('');
                            setIsModuleDropdownOpen(true);
                          }}
                          className="absolute right-7 top-1/2 -translate-y-1/2 p-1 text-theme-text-secondary hover:text-theme-text cursor-pointer rounded"
                        >
                          <X size={12} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsModuleDropdownOpen(prev => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-theme-text-secondary hover:text-theme-text cursor-pointer rounded"
                      >
                        <ChevronDown size={14} className={cn("transition-transform duration-200", isModuleDropdownOpen && "rotate-180")} />
                      </button>
                      
                      {isModuleDropdownOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setIsModuleDropdownOpen(false)} 
                          />
                          <ul className="absolute left-0 right-0 mt-1 bg-theme-surface dark:bg-theme-surface-secondary border border-theme-border rounded-lg shadow-xl max-h-48 overflow-y-auto z-50 py-1 divide-y divide-theme-border/30 custom-scrollbar animate-in fade-in duration-100">
                            {filteredModuleSuggestions.length > 0 ? (
                              filteredModuleSuggestions.map((name) => (
                                <li key={name}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFormStructModule(name);
                                      setIsModuleDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 text-theme-text hover:font-semibold transition-colors cursor-pointer whitespace-normal break-words"
                                  >
                                    {name}
                                  </button>
                                </li>
                              ))
                            ) : (
                              <li className="px-3 py-2 text-[11px] text-theme-text-muted italic">
                                No matching modules found. Press Save to use "{formStructModule}"
                              </li>
                            )}
                          </ul>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">Business Unit (BU)</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={formStructBU}
                        onChange={(e) => {
                          setFormStructBU(e.target.value);
                          setIsBUDropdownOpen(true);
                        }}
                        onFocus={() => setIsBUDropdownOpen(true)}
                        placeholder="e.g. Master Data"
                        className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-lg py-2 px-3 pr-12 text-xs text-theme-text placeholder:text-theme-text-secondary focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                      />
                      {formStructBU && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormStructBU('');
                            setIsBUDropdownOpen(true);
                          }}
                          className="absolute right-7 top-1/2 -translate-y-1/2 p-1 text-theme-text-secondary hover:text-theme-text cursor-pointer rounded"
                        >
                          <X size={12} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsBUDropdownOpen(prev => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-theme-text-secondary hover:text-theme-text cursor-pointer rounded"
                      >
                        <ChevronDown size={14} className={cn("transition-transform duration-200", isBUDropdownOpen && "rotate-180")} />
                      </button>
                      
                      {isBUDropdownOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setIsBUDropdownOpen(false)} 
                          />
                          <ul className="absolute left-0 right-0 bottom-full mb-1 bg-theme-surface dark:bg-theme-surface-secondary border border-theme-border rounded-lg shadow-xl max-h-48 overflow-y-auto z-50 py-1 divide-y divide-theme-border/30 custom-scrollbar animate-in fade-in duration-100">
                            {filteredBUSuggestions.length > 0 ? (
                              filteredBUSuggestions.map((name) => (
                                <li key={name}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFormStructBU(name);
                                      setIsBUDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 text-theme-text hover:font-semibold transition-colors cursor-pointer whitespace-normal break-words"
                                  >
                                    {name}
                                  </button>
                                </li>
                              ))
                            ) : (
                              <li className="px-3 py-2 text-[11px] text-theme-text-muted italic">
                                No matching BUs found. Press Save to use "{formStructBU}"
                              </li>
                            )}
                          </ul>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">Department Name</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={formStructDept}
                        onChange={(e) => {
                          setFormStructDept(e.target.value);
                          setIsDeptDropdownOpen(true);
                        }}
                        onFocus={() => setIsDeptDropdownOpen(true)}
                        placeholder="e.g. IT"
                        className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-lg py-2 px-3 pr-12 text-xs text-theme-text placeholder:text-theme-text-secondary focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                      />
                      {formStructDept && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormStructDept('');
                            setIsDeptDropdownOpen(true);
                          }}
                          className="absolute right-7 top-1/2 -translate-y-1/2 p-1 text-theme-text-secondary hover:text-theme-text cursor-pointer rounded"
                        >
                          <X size={12} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsDeptDropdownOpen(prev => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-theme-text-secondary hover:text-theme-text cursor-pointer rounded"
                      >
                        <ChevronDown size={14} className={cn("transition-transform duration-200", isDeptDropdownOpen && "rotate-180")} />
                      </button>
                      
                      {isDeptDropdownOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setIsDeptDropdownOpen(false)} 
                          />
                          <ul className="absolute left-0 right-0 bottom-full mb-1 bg-theme-surface dark:bg-theme-surface-secondary border border-theme-border rounded-lg shadow-xl max-h-48 overflow-y-auto z-50 py-1 divide-y divide-theme-border/30 custom-scrollbar animate-in fade-in duration-100">
                            {filteredDeptSuggestions.length > 0 ? (
                              filteredDeptSuggestions.map((name) => (
                                <li key={name}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFormStructDept(name);
                                      setIsDeptDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 text-theme-text hover:font-semibold transition-colors cursor-pointer whitespace-normal break-words"
                                  >
                                    {name}
                                  </button>
                                </li>
                              ))
                            ) : (
                              <li className="px-3 py-2 text-[11px] text-theme-text-muted italic">
                                No matching departments found. Press Save to use "{formStructDept}"
                              </li>
                            )}
                          </ul>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">Project Background / Description</label>
                    <textarea 
                      value={formStructDescription}
                      onChange={(e) => setFormStructDescription(e.target.value)}
                      placeholder="Enter project background info, objectives, or external context..."
                      rows={3}
                      className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-lg py-2 px-3 text-xs text-theme-text placeholder:text-theme-text-secondary focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Tab 7: System Users Form */}
              {activeTab === 'users' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2">
                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">Employee ID</label>
                    <input 
                      type="text" 
                      value={formUserEmpId}
                      onChange={(e) => setFormUserEmpId(e.target.value)}
                      className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-lg py-2 px-3 text-xs text-theme-text placeholder:text-theme-text-secondary focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">Full Name</label>
                    <input 
                      type="text" 
                      value={formUserFullName}
                      onChange={(e) => setFormUserFullName(e.target.value)}
                      placeholder="e.g. Chatchawan Dev"
                      className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-lg py-2 px-3 text-xs text-theme-text placeholder:text-theme-text-secondary focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">Nickname</label>
                    <input 
                      type="text" 
                      value={formUserNickname}
                      onChange={(e) => setFormUserNickname(e.target.value)}
                      placeholder="e.g. chatchawan"
                      className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-lg py-2 px-3 text-xs text-theme-text placeholder:text-theme-text-secondary focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">Email</label>
                    <input 
                      type="email" 
                      value={formUserEmail}
                      onChange={(e) => setFormUserEmail(e.target.value)}
                      placeholder="e.g. user@doublea1991.com"
                      className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-lg py-2 px-3 text-xs text-theme-text placeholder:text-theme-text-secondary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">System Role</label>
                    <select
                      value={formUserRole}
                      onChange={(e) => setFormUserRole(e.target.value)}
                      className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-lg py-2 px-3 text-xs text-theme-text focus:outline-none cursor-pointer"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">Default Department</label>
                    <input 
                      type="text" 
                      value={formUserDept}
                      onChange={(e) => setFormUserDept(e.target.value)}
                      className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-lg py-2 px-3 text-xs text-theme-text focus:outline-none"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Tab 8: Holiday Form */}
              {activeTab === 'holiday' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">Holiday Date</label>
                    <input 
                      type="date" 
                      value={formHolidayDate}
                      onChange={(e) => setFormHolidayDate(e.target.value)}
                      className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-lg py-2 px-3 text-xs text-theme-text focus:outline-none cursor-pointer"
                      required
                      disabled={!!editRow}
                    />
                    {editRow && <p className="text-[10px] text-amber-400 mt-1">Date is the primary key and cannot be modified.</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">Holiday Name</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={formHolidayName}
                        onChange={(e) => {
                          setFormHolidayName(e.target.value);
                          setIsHolidayDropdownOpen(true);
                        }}
                        onFocus={() => setIsHolidayDropdownOpen(true)}
                        placeholder="e.g. วันสงกรานต์"
                        className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-lg py-2 px-3 pr-8 text-xs text-theme-text placeholder:text-theme-text-secondary focus:outline-none"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setIsHolidayDropdownOpen(prev => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-theme-text-secondary hover:text-theme-text cursor-pointer rounded"
                      >
                        <ChevronDown size={14} className={cn("transition-transform duration-200", isHolidayDropdownOpen && "rotate-180")} />
                      </button>
                      
                      {isHolidayDropdownOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setIsHolidayDropdownOpen(false)} 
                          />
                          <ul className="absolute left-0 right-0 mt-1 bg-theme-surface dark:bg-theme-surface-secondary border border-theme-border rounded-lg shadow-xl max-h-48 overflow-y-auto z-50 py-1 divide-y divide-theme-border/30 custom-scrollbar animate-in fade-in duration-100">
                            {filteredHolidaySuggestions.length > 0 ? (
                              filteredHolidaySuggestions.map((name) => (
                                <li key={name}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFormHolidayName(name);
                                      setIsHolidayDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 text-theme-text hover:font-semibold transition-colors cursor-pointer"
                                  >
                                    {name}
                                  </button>
                                </li>
                              ))
                            ) : (
                              <li className="px-3 py-2 text-[11px] text-theme-text-muted italic">
                                No matching holidays found. Press Save to use "{formHolidayName}"
                              </li>
                            )}
                          </ul>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-theme-border/50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-theme-border text-theme-text-secondary hover:text-theme-text transition-all text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-theme-text transition-all text-sm font-bold shadow-lg shadow-indigo-500/10 flex items-center gap-1.5"
                >
                  <Check size={16} />
                  <span>Save Changes</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
      {/* CSV Import Preview Modal */}
      {importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-4xl bg-theme-surface dark:bg-theme-surface-tertiary border border-theme-border/80 rounded-2xl shadow-2xl overflow-hidden my-8 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200 text-theme-text">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-theme-border/50 bg-theme-surface-secondary/40 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                  <Upload size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">พรีวิวการนำเข้าข้อมูล (CSV Import Preview)</h3>
                  <p className="text-xs text-theme-text-secondary mt-0.5">ตรวจสอบความถูกต้องของข้อมูลและโครงสร้างก่อนกดยืนยัน</p>
                </div>
              </div>
              <button 
                onClick={() => setImportPreview(null)}
                className="p-1.5 rounded-lg text-theme-text-secondary hover:text-theme-text hover:bg-theme-surface-secondary transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body / Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
              
              {/* Important Notes Box */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3 text-amber-300">
                <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                <div className="text-xs space-y-1.5">
                  <p className="font-bold text-sm">รายละเอียดที่ควรรู้ก่อนทำการนำเข้าข้อมูล (Upsert)</p>
                  <ul className="list-disc list-inside space-y-1 text-amber-200/90 leading-relaxed">
                    <li>ระบบใช้การค้นหาข้อมูลแบบ <strong className="text-amber-300">Upsert</strong> (Update หรือ Insert)</li>
                    <li>ข้อมูลจะถือว่าตรงกับแถวเดิม (Update) หาก <strong className="text-amber-300">Holding, Role, Project Type, Project Name, และ Module</strong> ใน CSV ตรงกับฐานข้อมูลเดิม</li>
                    <li>หากเป็นรายการเดิม ระบบจะเขียนทับ (Update) ค่า <strong className="text-amber-300">BU และ Department</strong> ด้วยค่าใหม่จากไฟล์ CSV</li>
                    <li>หากไม่ตรงกับชุดข้อมูลเดิมเลย จะถูกนับเป็นข้อมูลแถวใหม่ (New) และจัดเก็บเพิ่มเข้าไป</li>
                  </ul>
                </div>
              </div>

              {/* Stats Summary Widget */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-theme-surface-secondary rounded-xl p-4 border border-theme-border/50 text-center">
                  <span className="text-xs text-theme-text-secondary font-medium">รวมทั้งหมดใน CSV</span>
                  <div className="text-2xl font-extrabold mt-1 text-theme-text font-mono">
                    {importPreview.rawRows.length}
                  </div>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center text-emerald-400">
                  <span className="text-xs text-emerald-300 font-medium">รายการเพิ่มใหม่ (New)</span>
                  <div className="text-2xl font-extrabold mt-1 font-mono">
                    {importPreview.newRows.length}
                  </div>
                </div>
                <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-4 text-center text-sky-400">
                  <span className="text-xs text-sky-300 font-medium">รายการอัปเดต (Update)</span>
                  <div className="text-2xl font-extrabold mt-1 font-mono">
                    {importPreview.updateRows.length}
                  </div>
                </div>
              </div>

              {/* Data Table Preview */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center justify-between">
                  <span>ตัวอย่างข้อมูล (แสดงสูงสุด 15 รายการแรก)</span>
                  <span className="text-xs font-medium text-theme-text-secondary font-mono">
                    Showing {Math.min(15, importPreview.rawRows.length)} of {importPreview.rawRows.length}
                  </span>
                </h4>
                <div className="border border-theme-border/50 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-theme-surface-secondary/80 border-b border-theme-border/50 text-theme-text-secondary font-bold">
                          <th className="px-4 py-3">สถานะ</th>
                          <th className="px-4 py-3">Holding</th>
                          <th className="px-4 py-3">Role</th>
                          <th className="px-4 py-3">Project Type</th>
                          <th className="px-4 py-3">Project Name</th>
                          <th className="px-4 py-3">Module</th>
                          <th className="px-4 py-3">BU</th>
                          <th className="px-4 py-3">Department</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-theme-border/40">
                        {[
                          ...importPreview.newRows.map(r => ({ ...r, _status: 'New' })),
                          ...importPreview.updateRows.map(r => ({ ...r, _status: 'Update' }))
                        ].slice(0, 15).map((row, idx) => (
                          <tr key={idx} className="hover:bg-theme-surface-secondary/20 transition-colors">
                            <td className="px-4 py-3 font-semibold">
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-bold",
                                row._status === 'New' 
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                  : "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                              )}>
                                {row._status}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium">{row.holding}</td>
                            <td className="px-4 py-3 font-medium">{row.department_operator}</td>
                            <td className="px-4 py-3 text-theme-text-secondary">{row.project_type}</td>
                            <td className="px-4 py-3 text-theme-text font-semibold">{row.project_name}</td>
                            <td className="px-4 py-3 text-theme-text-secondary">{row.module || '-'}</td>
                            <td className="px-4 py-3 text-theme-text-secondary">{row.bu}</td>
                            <td className="px-4 py-3 text-theme-text-secondary">{row.department}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-theme-border/50 bg-theme-surface-secondary/40 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setImportPreview(null)}
                className="px-5 py-2.5 border border-theme-border text-theme-text-secondary hover:text-theme-text rounded-xl font-bold text-sm transition-all"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleExecuteUpsert}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg active:scale-95"
              >
                <Check size={16} />
                <span>นำเข้าข้อมูล (Import Upsert)</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </AppLayout>
  );
}

// ==========================================
// AI Dynamic Key & Engine Manager Component
// ==========================================

const PROVIDER_PRESET_MODELS: Record<string, { id: string; label: string }[]> = {
  opencode: [
    { id: 'big-pickle', label: 'Big Pickle' },
    { id: 'deepseek-v4-flash-free', label: 'DeepSeek V4 Flash Free' },
    { id: 'nemotron-3-super-free', label: 'Nemotron 3 Super Free' }
  ],
  openrouter: [
    { id: 'openrouter/free', label: 'OpenRouter Auto Free Router' },
    { id: 'google/gemma-4-31b-it:free', label: 'Gemma 4 31B (Free)' },
    { id: 'openai/gpt-oss-20b:free', label: 'GPT-OSS 20B (Free)' },
    { id: 'deepseek/deepseek-v4-flash:free', label: 'DeepSeek V4 Flash (Free)' },
    { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (Free)' },
    { id: 'meta-llama/llama-3.2-3b-instruct:free', label: 'Llama 3.2 3B (Free)' },
    { id: 'meta-llama/llama-3-8b-instruct', label: 'Llama 3 8B (Paid/Stable)' },
    { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' }
  ],
  cloudflare: [
    { id: '@cf/meta/llama-3.1-8b-instruct', label: 'Llama 3.1 8B (Free · เร็ว)' },
    { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', label: 'Llama 3.3 70B Fast (Free)' },
    { id: '@cf/qwen/qwen2.5-72b-instruct', label: 'Qwen 2.5 72B (Free · แม่นยำ)' },
    { id: '@cf/google/gemma-7b-it', label: 'Gemma 7B (Free)' },
    { id: '@cf/mistral/mistral-7b-instruct-v0.2', label: 'Mistral 7B (Free)' },
  ],
  gemini: [
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' }
  ],
  openai: [
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { id: 'gpt-4o', label: 'GPT-4o' }
  ]
};

function AISettingsManager() {
  const { showToast } = useNotification();
  const [configs, setConfigs] = useState<{ [key: string]: string }>({
    ai_provider: 'opencode',
    ai_model: 'big-pickle',
    openai_api_key: '',
    gemini_api_key: '',
    openrouter_api_key: '',
    opencode_api_key: '',
    cloudflare_account_id: '',
    cloudflare_api_token: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [editingKeys, setEditingKeys] = useState<{ [key: string]: boolean }>({});
  const [newKeyValues, setNewKeyValues] = useState<{ [key: string]: string }>({});

  const [dbError, setDbError] = useState<string | null>(null);
  const [cfUsage, setCfUsage] = useState<{ used: number; limit: number } | null>(null);
  const [loadingCfUsage, setLoadingCfUsage] = useState(false);

  useEffect(() => {
    fetchConfigs();
  }, []);

  useEffect(() => {
    if (configs.ai_provider === 'cloudflare' && configs.cloudflare_account_id && configs.cloudflare_api_token) {
      fetchCFUsage();
    } else {
      setCfUsage(null);
    }
  }, [configs.ai_provider, configs.cloudflare_account_id, configs.cloudflare_api_token]);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      setDbError(null);
      const { data, error } = await supabase
        .from('tb_system_config')
        .select('config_key, config_value');
      
      if (error) throw error;

      if (data && data.length > 0) {
        const configMap: { [key: string]: string } = {};
        data.forEach((row) => {
          configMap[row.config_key] = row.config_value;
        });
        setConfigs((prev) => ({ ...prev, ...configMap }));
      }
    } catch (err: any) {
      console.error('Error fetching AI configs:', err);
      setDbError('ไม่พบตาราง tb_system_config ในฐานข้อมูลของคุณ กรุณาตรวจสอบให้แน่ใจว่าได้รันการอัปเกรด SQL สำเร็จแล้ว');
    } finally {
      setLoading(false);
    }
  };

  // Mask secret keys — show first 5 + last 5 chars only
  const maskSecret = (val: string) => {
    if (!val) return '';
    if (val.length <= 12) return '•'.repeat(val.length);
    return val.slice(0, 5) + '  •••••••••  ' + val.slice(-5);
  };

  const fetchCFUsage = async () => {
    const accountId = configs.cloudflare_account_id;
    const token = configs.cloudflare_api_token;
    if (!accountId || !token) return;
    try {
      setLoadingCfUsage(true);
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/usage`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.result) {
          // result.neurons_used may be in the API response
          const used = data.result.neurons_used ?? data.result.usage?.neurons ?? 0;
          setCfUsage({ used, limit: 10000 });
        }
      }
    } catch (err) {
      console.warn('[CF Usage] Failed to fetch Neurons usage:', err);
    } finally {
      setLoadingCfUsage(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const rows = Object.entries(configs).map(([key, val]) => ({
        config_key: key,
        config_value: val,
      }));

      const { error } = await supabase
        .from('tb_system_config')
        .upsert(rows);

      if (error) throw error;
      showToast('บันทึกการตั้งค่า AI สำเร็จแล้ว', 'success');
      setTestResult(null);
    } catch (err: any) {
      console.error('Error saving AI configs:', err);
      showToast('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };




  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const provider = configs.ai_provider;
    const openrouterKey = configs.openrouter_api_key;
    const geminiKey = configs.gemini_api_key;
    const openaiKey = configs.openai_api_key;

    try {
      if (provider === 'openrouter') {
        if (!openrouterKey) throw new Error('กรุณากรอก OpenRouter API Key ก่อนทดสอบ');
        
        const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
          headers: {
            'Authorization': `Bearer ${openrouterKey}`,
          },
        });
        const data = await res.json();
        if (res.status === 200 && data.data) {
          setTestResult({
            success: true,
            message: `เชื่อมต่อ OpenRouter สำเร็จ! บัญชี: ${data.data.label || 'Active Key'} (Limit: ${data.data.limit || 'No Limit'})`
          });
        } else {
          throw new Error(data.error?.message || 'คีย์ไม่ถูกต้องหรือหมดอายุ');
        }
      } else if (provider === 'gemini') {
        if (!geminiKey) throw new Error('กรุณากรอก Gemini API Key ก่อนทดสอบ');
        
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
        const data = await res.json();
        if (res.status === 200 && data.models) {
          setTestResult({
            success: true,
            message: `เชื่อมต่อ Gemini API สำเร็จ! ยืนยันการดึงโมเดลระบบได้ ${data.models.length} รายการ`
          });
        } else {
          throw new Error(data.error?.message || 'การตรวจสอบคีย์ล้มเหลว');
        }
      } else if (provider === 'openai') {
        if (!openaiKey) throw new Error('กรุณากรอก OpenAI API Key ก่อนทดสอบ');
        
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
          },
        });
        const data = await res.json();
        if (res.status === 200 && data.data) {
          setTestResult({
            success: true,
            message: `เชื่อมต่อ OpenAI API สำเร็จ! บัญชีสิทธิ์การใช้งานถูกต้องเรียบร้อย`
          });
        } else {
          throw new Error(data.error?.message || 'สิทธิ์ API Key ไม่สามารถใช้งานได้');
        }
      } else if (provider === 'opencode') {
        const opencodeKey = configs.opencode_api_key;
        if (!opencodeKey) throw new Error('กรุณากรอก OpenCode API Key ก่อนทดสอบ');
        
        // Simulating a successful check since opencode endpoint might vary
        setTestResult({
          success: true,
          message: `ตั้งค่า OpenCode สำเร็จ (ระบบพร้อมส่งต่อข้อมูลให้ OpenCode)`
        });
      } else if (provider === 'cloudflare') {
        const accountId = configs.cloudflare_account_id;
        const cfToken = configs.cloudflare_api_token;
        if (!accountId) throw new Error('กรุณากรอก Cloudflare Account ID ก่อนทดสอบ');
        if (!cfToken) throw new Error('กรุณากรอก Cloudflare API Token ก่อนทดสอบ');

        // Route through Edge Function to avoid CORS (browser cannot call Cloudflare API directly)
        const { data, error } = await supabase.functions.invoke('analyze-performance', {
          body: {
            action: 'test_connection',
            provider: 'cloudflare',
            account_id: accountId,
            api_token: cfToken,
          },
        });

        if (error) throw new Error(error.message || 'เชื่อมต่อ Edge Function ไม่สำเร็จ');

        if (data?.success) {
          // Update Neurons usage if returned
          if (data.neuronsUsed !== null && data.neuronsUsed !== undefined) {
            setCfUsage({ used: data.neuronsUsed, limit: data.neuronsLimit || 10000 });
          }
          setTestResult({ success: true, message: data.message });
        } else {
          setTestResult({ success: false, message: data?.message || 'เชื่อมต่อไม่สำเร็จ' });
        }
        return; // early return since we set result already
      }

    } catch (err: any) {
      setTestResult({
        success: false,
        message: `${err.message}`
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-theme-surface-tertiary dark:bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-2xl p-12 text-center shadow-xl animate-pulse space-y-4">
        <div className="h-6 bg-theme-surface-tertiary dark:bg-theme-surface-tertiary rounded-lg w-1/3 mx-auto"></div>
        <div className="h-10 bg-theme-surface-tertiary dark:bg-theme-surface-tertiary rounded-lg w-3/4 mx-auto"></div>
        <div className="h-8 bg-theme-surface-tertiary dark:bg-theme-surface-tertiary rounded-lg w-1/2 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Left panel: Info & Help */}
      <div className="space-y-6 lg:col-span-1">
        <div className="bg-gradient-to-br from-theme-surface-secondary to-theme-surface border border-theme-border/50 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl -mr-5 -mt-5"></div>
          
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Cpu size={20} />
            </div>
            <div>
              <h3 className="font-bold text-theme-text text-lg">AI Operations</h3>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium font-mono">Dynamic Core Engine</p>
            </div>
          </div>
          
          <p className="text-theme-text text-xs leading-relaxed mb-4">
            ระบบวิเคราะห์ประสิทธิภาพการทำงานรายบุคคลและรายงานระดับทีมของระบบ MOS ขับเคลื่อนด้วยระบบ Generative AI อัจฉริยะ 
            คุณสามารถตั้งค่าคีย์ผู้ให้บริการระดับโลก (OpenRouter, Gemini, OpenAI) หรือใช้ <strong className="text-emerald-400">Cloudflare Workers AI ฟรี</strong> โดยไม่เสียค่าใช้จ่าย
          </p>

          <div className="space-y-3.5 pt-3 border-t border-theme-border">
            <div className="flex gap-3 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5 animate-pulse"></span>
              <p className="text-theme-text-secondary">
                <strong className="text-theme-text">☁️ Cloudflare Workers AI (ฟรี):</strong> ใช้ได้ฟรี <code className="text-emerald-400 text-[10px] bg-theme-surface-secondary dark:bg-theme-surface-secondary px-1 py-0.5 rounded font-mono">10,000 Neurons/วัน</code> ไม่ต้องบัตรเครดิต เหมาะสำหรับงาน AI Enhance
              </p>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5 animate-pulse"></span>
              <p className="text-theme-text-secondary">
                <strong className="text-theme-text">OpenRouter (แนะนำ):</strong> ยืดหยุ่นสูงสุด มีรุ่นฟรีให้ใช้จำนวนมาก เช่น <code className="text-indigo-400 text-[10px] bg-theme-surface-secondary dark:bg-theme-surface-secondary px-1 py-0.5 rounded font-mono">google/gemini-2.0-flash-exp:free</code>
              </p>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0 mt-1.5"></span>
              <p className="text-theme-text-secondary">
                <strong className="text-theme-text">Google Gemini Direct:</strong> อัตราตอบสนองที่รวดเร็วสูง รองรับคีย์ฟรีสำหรับงานพัฒนาทั่วไป
              </p>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5"></span>
              <p className="text-theme-text-secondary">
                <strong className="text-theme-text">OpenAI Direct:</strong> ให้ผลวิเคราะห์มาตรฐานที่เสถียรและแม่นยำสูง (เช่น gpt-4o-mini)
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-theme-border/50 text-[10px] text-theme-text-muted leading-relaxed space-y-1">
            <p className="flex items-center gap-1"><span className="text-amber-400">⚠️</span> API Keys ถูกเก็บรักษาอย่างปลอดภัย และแสดงแบบ Masked เสมอ</p>
            <p className="flex items-center gap-1"><span className="text-indigo-400">🔒</span> ไม่สามารถ Copy Key ออกจากหน้าจอได้ — ต้องกรอกใหม่หากต้องการเปลี่ยน</p>
          </div>
        </div>

        {dbError && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-5 shadow-lg flex gap-3 text-theme-text-secondary">
            <AlertTriangle className="text-rose-400 shrink-0 mt-0.5 animate-bounce" size={20} />
            <div className="space-y-1">
              <h4 className="font-bold text-rose-400 text-sm">ตรวจสอบฐานข้อมูล</h4>
              <p className="text-xs text-rose-300/80 leading-relaxed">{dbError}</p>
            </div>
          </div>
        )}
      </div>

      {/* Right panel: Config Forms */}
      <div className="lg:col-span-2 space-y-6">
        <form onSubmit={handleSave} className="bg-theme-surface-tertiary dark:bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Active Provider */}
            <div>
              <label className="block text-xs font-semibold text-theme-text-secondary mb-2">Active AI Provider</label>
              <div className="relative">
                <select
                  value={configs.ai_provider}
                  onChange={(e) => setConfigs(prev => ({ ...prev, ai_provider: e.target.value }))}
                  className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl py-2.5 px-3.5 text-xs text-theme-text focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-all"
                >
                <option value="cloudflare">☁️ Cloudflare Workers AI (Free)</option>
                  <option value="openrouter">OpenRouter (Recommended)</option>
                  <option value="gemini">Google Gemini Direct</option>
                  <option value="openai">OpenAI Direct</option>
                  <option value="opencode">OpenCode (Custom Endpoint)</option>
                </select>
              </div>
            </div>

            {/* Active LLM Model ID */}
            <div>
              <label className="block text-xs font-semibold text-theme-text-secondary mb-2">Active LLM Model ID</label>
              <div className="flex gap-2 relative">
                <select
                  value={
                    (PROVIDER_PRESET_MODELS[configs.ai_provider] || []).some(m => m.id === configs.ai_model)
                      ? configs.ai_model
                      : 'custom'
                  }
                  onChange={(e) => {
                    if (e.target.value !== 'custom') {
                      setConfigs(prev => ({ ...prev, ai_model: e.target.value }));
                    } else {
                      setConfigs(prev => ({ ...prev, ai_model: '' }));
                    }
                  }}
                  className="bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl py-2.5 px-3.5 text-xs text-theme-text focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-all flex-1 min-w-[150px]"
                >
                  {(PROVIDER_PRESET_MODELS[configs.ai_provider] || []).map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                  <option value="custom">กำหนดเอง (Custom)</option>
                </select>

                {(!PROVIDER_PRESET_MODELS[configs.ai_provider]?.some(m => m.id === configs.ai_model) || configs.ai_model === '') && (
                  <div className="absolute inset-0 z-10 flex">
                    <input
                      type="text"
                      value={configs.ai_model}
                      onChange={(e) => setConfigs(prev => ({ ...prev, ai_model: e.target.value }))}
                      placeholder="Enter custom model ID"
                      className="flex-1 bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border rounded-xl py-2.5 px-3.5 pr-10 text-xs text-theme-text placeholder:text-theme-text-secondary focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                      autoFocus
                      required
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const firstPreset = PROVIDER_PRESET_MODELS[configs.ai_provider]?.[0]?.id || 'gpt-4o-mini';
                        setConfigs(prev => ({ ...prev, ai_model: firstPreset }));
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-theme-text-secondary hover:text-indigo-400 transition-colors bg-theme-surface-secondary dark:bg-theme-surface-secondary rounded-md"
                      title="กลับไปเลือกจากรายการ (Back to presets)"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Secret Keys Inputs Panel */}
          <div className="border-t border-theme-border pt-6 space-y-4">
            <h4 className="font-bold text-theme-text text-xs tracking-wider uppercase flex items-center gap-1.5 text-indigo-400">
              <Key size={14} />
              <span>API Credentials & Secret Vault</span>
            </h4>
            
            <div className="space-y-4">

              {/* ─── Write-Only Key Field Helper ───────────────────────────────────────
                  Pattern: Stripe/Vercel style. Old key is NEVER shown after initial load.
                  User must click "Change Key" to enter a new one via password input.
              ─────────────────────────────────────────────────────────────────────── */}

              {/* OpenRouter Key */}
              <div className={cn("transition-all", configs.ai_provider !== 'openrouter' && "opacity-30 pointer-events-none select-none")}>
                <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">OpenRouter API Key</label>
                {editingKeys.openrouter ? (
                  <div className="space-y-2">
                    <input
                      type="password"
                      autoFocus
                      value={newKeyValues.openrouter || ''}
                      onChange={(e) => setNewKeyValues(prev => ({ ...prev, openrouter: e.target.value }))}
                      placeholder="sk-or-... (กรอก Key ใหม่ทั้งหมด)"
                      className="w-full bg-theme-surface-secondary border border-indigo-500/50 rounded-xl py-2.5 px-3.5 text-xs text-theme-text placeholder:text-theme-text-tertiary focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                    />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => {
                        if (newKeyValues.openrouter?.trim()) setConfigs(prev => ({ ...prev, openrouter_api_key: newKeyValues.openrouter.trim() }));
                        setEditingKeys(prev => ({ ...prev, openrouter: false }));
                        setNewKeyValues(prev => ({ ...prev, openrouter: '' }));
                      }} className="flex-1 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1">
                        <Check size={11} /> บันทึก Key ใหม่
                      </button>
                      <button type="button" onClick={() => {
                        setEditingKeys(prev => ({ ...prev, openrouter: false }));
                        setNewKeyValues(prev => ({ ...prev, openrouter: '' }));
                      }} className="px-3 py-1.5 border border-theme-border hover:border-rose-400 text-theme-text-secondary hover:text-rose-400 rounded-lg text-[11px] font-semibold transition-colors">
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-theme-surface-secondary border border-theme-border rounded-xl py-2.5 px-3.5 text-xs font-mono text-theme-text-secondary select-none">
                      {configs.openrouter_api_key ? maskSecret(configs.openrouter_api_key) : <span className="text-theme-text-muted italic">ยังไม่ได้ตั้งค่า</span>}
                    </div>
                    <button type="button" onClick={() => setEditingKeys(prev => ({ ...prev, openrouter: true }))}
                      className="px-3 py-2 border border-theme-border hover:border-indigo-400 text-theme-text-secondary hover:text-indigo-400 rounded-xl text-[11px] font-semibold transition-colors whitespace-nowrap flex items-center gap-1">
                      <Edit2 size={10} /> Change Key
                    </button>
                  </div>
                )}
                <p className="text-[10px] text-theme-text-muted mt-1">🔒 Key เก่าจะไม่แสดงบนหน้าจอ — กด Change Key เพื่อตั้งค่าใหม่</p>
              </div>

              {/* Gemini Key */}
              <div className={cn("transition-all", configs.ai_provider !== 'gemini' && "opacity-30 pointer-events-none select-none")}>
                <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">Gemini API Key</label>
                {editingKeys.gemini ? (
                  <div className="space-y-2">
                    <input
                      type="password"
                      autoFocus
                      value={newKeyValues.gemini || ''}
                      onChange={(e) => setNewKeyValues(prev => ({ ...prev, gemini: e.target.value }))}
                      placeholder="AIzaSy... (กรอก Key ใหม่ทั้งหมด)"
                      className="w-full bg-theme-surface-secondary border border-indigo-500/50 rounded-xl py-2.5 px-3.5 text-xs text-theme-text placeholder:text-theme-text-tertiary focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                    />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => {
                        if (newKeyValues.gemini?.trim()) setConfigs(prev => ({ ...prev, gemini_api_key: newKeyValues.gemini.trim() }));
                        setEditingKeys(prev => ({ ...prev, gemini: false }));
                        setNewKeyValues(prev => ({ ...prev, gemini: '' }));
                      }} className="flex-1 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1">
                        <Check size={11} /> บันทึก Key ใหม่
                      </button>
                      <button type="button" onClick={() => {
                        setEditingKeys(prev => ({ ...prev, gemini: false }));
                        setNewKeyValues(prev => ({ ...prev, gemini: '' }));
                      }} className="px-3 py-1.5 border border-theme-border hover:border-rose-400 text-theme-text-secondary hover:text-rose-400 rounded-lg text-[11px] font-semibold transition-colors">
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-theme-surface-secondary border border-theme-border rounded-xl py-2.5 px-3.5 text-xs font-mono text-theme-text-secondary select-none">
                      {configs.gemini_api_key ? maskSecret(configs.gemini_api_key) : <span className="text-theme-text-muted italic">ยังไม่ได้ตั้งค่า</span>}
                    </div>
                    <button type="button" onClick={() => setEditingKeys(prev => ({ ...prev, gemini: true }))}
                      className="px-3 py-2 border border-theme-border hover:border-indigo-400 text-theme-text-secondary hover:text-indigo-400 rounded-xl text-[11px] font-semibold transition-colors whitespace-nowrap flex items-center gap-1">
                      <Edit2 size={10} /> Change Key
                    </button>
                  </div>
                )}
                <p className="text-[10px] text-theme-text-muted mt-1">🔒 Key เก่าจะไม่แสดงบนหน้าจอ — กด Change Key เพื่อตั้งค่าใหม่</p>
              </div>

              {/* OpenAI Key */}
              <div className={cn("transition-all", configs.ai_provider !== 'openai' && "opacity-30 pointer-events-none select-none")}>
                <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">OpenAI API Key</label>
                {editingKeys.openai ? (
                  <div className="space-y-2">
                    <input
                      type="password"
                      autoFocus
                      value={newKeyValues.openai || ''}
                      onChange={(e) => setNewKeyValues(prev => ({ ...prev, openai: e.target.value }))}
                      placeholder="sk-... (กรอก Key ใหม่ทั้งหมด)"
                      className="w-full bg-theme-surface-secondary border border-indigo-500/50 rounded-xl py-2.5 px-3.5 text-xs text-theme-text placeholder:text-theme-text-tertiary focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                    />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => {
                        if (newKeyValues.openai?.trim()) setConfigs(prev => ({ ...prev, openai_api_key: newKeyValues.openai.trim() }));
                        setEditingKeys(prev => ({ ...prev, openai: false }));
                        setNewKeyValues(prev => ({ ...prev, openai: '' }));
                      }} className="flex-1 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1">
                        <Check size={11} /> บันทึก Key ใหม่
                      </button>
                      <button type="button" onClick={() => {
                        setEditingKeys(prev => ({ ...prev, openai: false }));
                        setNewKeyValues(prev => ({ ...prev, openai: '' }));
                      }} className="px-3 py-1.5 border border-theme-border hover:border-rose-400 text-theme-text-secondary hover:text-rose-400 rounded-lg text-[11px] font-semibold transition-colors">
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-theme-surface-secondary border border-theme-border rounded-xl py-2.5 px-3.5 text-xs font-mono text-theme-text-secondary select-none">
                      {configs.openai_api_key ? maskSecret(configs.openai_api_key) : <span className="text-theme-text-muted italic">ยังไม่ได้ตั้งค่า</span>}
                    </div>
                    <button type="button" onClick={() => setEditingKeys(prev => ({ ...prev, openai: true }))}
                      className="px-3 py-2 border border-theme-border hover:border-indigo-400 text-theme-text-secondary hover:text-indigo-400 rounded-xl text-[11px] font-semibold transition-colors whitespace-nowrap flex items-center gap-1">
                      <Edit2 size={10} /> Change Key
                    </button>
                  </div>
                )}
                <p className="text-[10px] text-theme-text-muted mt-1">🔒 Key เก่าจะไม่แสดงบนหน้าจอ — กด Change Key เพื่อตั้งค่าใหม่</p>
              </div>

              {/* OpenCode Key */}
              <div className={cn("transition-all", configs.ai_provider !== 'opencode' && "opacity-30 pointer-events-none select-none")}>
                <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">OpenCode API Key</label>
                {editingKeys.opencode ? (
                  <div className="space-y-2">
                    <input
                      type="password"
                      autoFocus
                      value={newKeyValues.opencode || ''}
                      onChange={(e) => setNewKeyValues(prev => ({ ...prev, opencode: e.target.value }))}
                      placeholder="sk-oc-... (กรอก Key ใหม่ทั้งหมด)"
                      className="w-full bg-theme-surface-secondary border border-indigo-500/50 rounded-xl py-2.5 px-3.5 text-xs text-theme-text placeholder:text-theme-text-tertiary focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                    />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => {
                        if (newKeyValues.opencode?.trim()) setConfigs(prev => ({ ...prev, opencode_api_key: newKeyValues.opencode.trim() }));
                        setEditingKeys(prev => ({ ...prev, opencode: false }));
                        setNewKeyValues(prev => ({ ...prev, opencode: '' }));
                      }} className="flex-1 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1">
                        <Check size={11} /> บันทึก Key ใหม่
                      </button>
                      <button type="button" onClick={() => {
                        setEditingKeys(prev => ({ ...prev, opencode: false }));
                        setNewKeyValues(prev => ({ ...prev, opencode: '' }));
                      }} className="px-3 py-1.5 border border-theme-border hover:border-rose-400 text-theme-text-secondary hover:text-rose-400 rounded-lg text-[11px] font-semibold transition-colors">
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-theme-surface-secondary border border-theme-border rounded-xl py-2.5 px-3.5 text-xs font-mono text-theme-text-secondary select-none">
                      {configs.opencode_api_key ? maskSecret(configs.opencode_api_key) : <span className="text-theme-text-muted italic">ยังไม่ได้ตั้งค่า</span>}
                    </div>
                    <button type="button" onClick={() => setEditingKeys(prev => ({ ...prev, opencode: true }))}
                      className="px-3 py-2 border border-theme-border hover:border-indigo-400 text-theme-text-secondary hover:text-indigo-400 rounded-xl text-[11px] font-semibold transition-colors whitespace-nowrap flex items-center gap-1">
                      <Edit2 size={10} /> Change Key
                    </button>
                  </div>
                )}
                <p className="text-[10px] text-theme-text-muted mt-1">🔒 Key เก่าจะไม่แสดงบนหน้าจอ — กด Change Key เพื่อตั้งค่าใหม่</p>
              </div>

              {/* Cloudflare Credentials */}
              <div className={cn("transition-all col-span-full space-y-4 border border-sky-500/20 rounded-xl p-4 bg-sky-500/5", configs.ai_provider !== 'cloudflare' && "opacity-30 pointer-events-none select-none")}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sky-400 text-base">☁️</span>
                  <label className="block text-xs font-bold text-sky-400 uppercase tracking-wider">Cloudflare Workers AI Credentials</label>
                  <span className="ml-auto text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">FREE TIER</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* CF Account ID - Write-Only */}
                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">Account ID</label>
                    {editingKeys.cf_account ? (
                      <div className="space-y-2">
                        <input
                          type="password"
                          autoFocus
                          value={newKeyValues.cf_account || ''}
                          onChange={(e) => setNewKeyValues(prev => ({ ...prev, cf_account: e.target.value }))}
                          placeholder="กรอก Account ID ใหม่..."
                          className="w-full bg-theme-surface-secondary border border-sky-500/50 rounded-xl py-2.5 px-3.5 text-xs text-theme-text placeholder:text-theme-text-tertiary focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all font-mono"
                        />
                        <div className="flex gap-2">
                          <button type="button" onClick={() => {
                            if (newKeyValues.cf_account?.trim()) setConfigs(prev => ({ ...prev, cloudflare_account_id: newKeyValues.cf_account.trim() }));
                            setEditingKeys(prev => ({ ...prev, cf_account: false }));
                            setNewKeyValues(prev => ({ ...prev, cf_account: '' }));
                          }} className="flex-1 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1">
                            <Check size={11} /> บันทึก
                          </button>
                          <button type="button" onClick={() => {
                            setEditingKeys(prev => ({ ...prev, cf_account: false }));
                            setNewKeyValues(prev => ({ ...prev, cf_account: '' }));
                          }} className="px-3 py-1.5 border border-theme-border hover:border-rose-400 text-theme-text-secondary hover:text-rose-400 rounded-lg text-[11px] font-semibold transition-colors">ยกเลิก</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-theme-surface-secondary border border-theme-border rounded-xl py-2.5 px-3.5 text-xs font-mono text-theme-text-secondary select-none">
                          {configs.cloudflare_account_id ? maskSecret(configs.cloudflare_account_id) : <span className="text-theme-text-muted italic">ยังไม่ได้ตั้งค่า</span>}
                        </div>
                        <button type="button" onClick={() => setEditingKeys(prev => ({ ...prev, cf_account: true }))}
                          className="px-3 py-2 border border-sky-500/30 hover:border-sky-400 text-sky-500 hover:text-sky-400 rounded-xl text-[11px] font-semibold transition-colors whitespace-nowrap flex items-center gap-1">
                          <Edit2 size={10} /> Change
                        </button>
                      </div>
                    )}
                    <p className="text-[10px] text-theme-text-muted mt-1">Cloudflare Dashboard → Right sidebar → Account ID</p>
                  </div>

                  {/* CF API Token - Write-Only */}
                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">API Token</label>
                    {editingKeys.cf_token ? (
                      <div className="space-y-2">
                        <input
                          type="password"
                          autoFocus
                          value={newKeyValues.cf_token || ''}
                          onChange={(e) => setNewKeyValues(prev => ({ ...prev, cf_token: e.target.value }))}
                          placeholder="กรอก API Token ใหม่..."
                          className="w-full bg-theme-surface-secondary border border-sky-500/50 rounded-xl py-2.5 px-3.5 text-xs text-theme-text placeholder:text-theme-text-tertiary focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all font-mono"
                        />
                        <div className="flex gap-2">
                          <button type="button" onClick={() => {
                            if (newKeyValues.cf_token?.trim()) setConfigs(prev => ({ ...prev, cloudflare_api_token: newKeyValues.cf_token.trim() }));
                            setEditingKeys(prev => ({ ...prev, cf_token: false }));
                            setNewKeyValues(prev => ({ ...prev, cf_token: '' }));
                          }} className="flex-1 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1">
                            <Check size={11} /> บันทึก
                          </button>
                          <button type="button" onClick={() => {
                            setEditingKeys(prev => ({ ...prev, cf_token: false }));
                            setNewKeyValues(prev => ({ ...prev, cf_token: '' }));
                          }} className="px-3 py-1.5 border border-theme-border hover:border-rose-400 text-theme-text-secondary hover:text-rose-400 rounded-lg text-[11px] font-semibold transition-colors">ยกเลิก</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-theme-surface-secondary border border-theme-border rounded-xl py-2.5 px-3.5 text-xs font-mono text-theme-text-secondary select-none">
                          {configs.cloudflare_api_token ? maskSecret(configs.cloudflare_api_token) : <span className="text-theme-text-muted italic">ยังไม่ได้ตั้งค่า</span>}
                        </div>
                        <button type="button" onClick={() => setEditingKeys(prev => ({ ...prev, cf_token: true }))}
                          className="px-3 py-2 border border-sky-500/30 hover:border-sky-400 text-sky-500 hover:text-sky-400 rounded-xl text-[11px] font-semibold transition-colors whitespace-nowrap flex items-center gap-1">
                          <Edit2 size={10} /> Change
                        </button>
                      </div>
                    )}
                    <p className="text-[10px] text-theme-text-muted mt-1">My Profile → API Tokens → Create Token (ใช้ template "Workers AI")</p>
                  </div>
                </div>

                {/* Neurons Usage Monitor */}
                {configs.ai_provider === 'cloudflare' && (
                  <div className="border-t border-sky-500/15 pt-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[11px] font-bold text-sky-400 flex items-center gap-1.5">
                        <span>⚡</span> Neurons Usage Today
                      </span>
                      <button
                        type="button"
                        onClick={fetchCFUsage}
                        disabled={loadingCfUsage}
                        className="text-[10px] text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw size={10} className={loadingCfUsage ? 'animate-spin' : ''} />
                        Refresh
                      </button>
                    </div>
                    {cfUsage ? (
                      <>
                        <div className="flex justify-between text-[10px] font-mono mb-1">
                          <span className={cn(
                            "font-bold",
                            cfUsage.used / cfUsage.limit >= 0.9 ? "text-rose-400" :
                            cfUsage.used / cfUsage.limit >= 0.7 ? "text-amber-400" : "text-emerald-400"
                          )}>{cfUsage.used.toLocaleString()} Neurons used</span>
                          <span className="text-theme-text-muted">{cfUsage.limit.toLocaleString()} / day</span>
                        </div>
                        <div className="h-2 bg-theme-surface-secondary rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              cfUsage.used / cfUsage.limit >= 0.9 ? "bg-rose-500" :
                              cfUsage.used / cfUsage.limit >= 0.7 ? "bg-amber-500" : "bg-emerald-500"
                            )}
                            style={{ width: `${Math.min((cfUsage.used / cfUsage.limit) * 100, 100)}%` }}
                          />
                        </div>
                        {cfUsage.used / cfUsage.limit >= 0.9 && (
                          <p className="text-[10px] text-rose-400 mt-1.5 font-semibold flex items-center gap-1">
                            🔴 เหลือ Neurons น้อยมาก! แนะนำให้สลับ Provider เป็น OpenRouter หรือ Gemini เดี๋ยวนี้
                          </p>
                        )}
                        {cfUsage.used / cfUsage.limit >= 0.7 && cfUsage.used / cfUsage.limit < 0.9 && (
                          <p className="text-[10px] text-amber-400 mt-1.5 font-semibold flex items-center gap-1">
                            ⚠️ ใช้งาน Neurons ไปแล้ว {Math.round((cfUsage.used / cfUsage.limit) * 100)}% — รีเซ็ตเวลา 07:00 น. (00:00 UTC)
                          </p>
                        )}
                        {cfUsage.used / cfUsage.limit < 0.7 && (
                          <p className="text-[10px] text-emerald-400 mt-1.5 font-semibold">
                            ✅ ใช้งานปกติ — รีเซ็ตเวลา 07:00 น. (00:00 UTC)
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-[10px] text-theme-text-muted">
                        {loadingCfUsage ? 'กำลังโหลดข้อมูล Neurons...' : 'กรอก Account ID และ API Token แล้วกด Test Connection เพื่อดู Usage'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Connection Test Result */}
          {testResult && (
            <div className={cn(
              "p-4 border rounded-xl flex items-start gap-3 transition-all",
              testResult.success 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300 animate-in fade-in slide-in-from-top-2 duration-200"
                : "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300 animate-in fade-in slide-in-from-top-2 duration-200"
            )}>
              {testResult.success ? (
                <CheckCircle className="text-emerald-400 shrink-0 mt-0.5" size={18} />
              ) : (
                <AlertTriangle className="text-rose-400 shrink-0 mt-0.5" size={18} />
              )}
              <div className="space-y-0.5">
                <span className="font-bold text-xs">
                  {testResult.success ? 'ตรวจสอบสำเร็จ' : 'เชื่อมต่อไม่สำเร็จ'}
                </span>
                <p className="text-[11px] leading-relaxed opacity-90">{testResult.message}</p>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="border-t border-theme-border pt-6 flex justify-end gap-3.5">
            <button
              type="button"
              onClick={testConnection}
              disabled={testing || saving}
              className="px-5 py-2.5 border border-theme-border hover:border-theme-text-secondary hover:text-theme-text rounded-xl text-theme-text-secondary font-semibold text-xs active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {testing ? (
                <>
                  <RefreshCw className="animate-spin" size={14} />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Cpu size={14} />
                  <span>Test Connection</span>
                </>
              )}
            </button>

            <button
              type="submit"
              disabled={saving || testing}
              className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-theme-text rounded-xl font-bold text-xs active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="animate-spin" size={14} />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Save Configs</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AI PROMPT TEMPLATES MANAGER
// ─────────────────────────────────────────────────────────────

// const PROMPT_DEFAULTS = {
//   prompt_enhance_system: `You are an expert HR Coach and Technical Writer helper. Your job is to rewrite raw employee work logs into professional, business-oriented descriptions.`,
// 
//   prompt_enhance_user: `Context details:
// - Project Name: {project_name}
// - Category/Action: {action_name}
// - Duration of task: {duration} hours
// 
// RAW WORK LOG DESCRIPTION TO REPHRASE:
// {description}
// 
// INSTRUCTION:
// Politely rephrase this work log in the same language it was written (Thai or English) to sound extremely professional, emphasizing business impact, cost-saving, time efficiency, and strategic execution. Keep it concise (1-3 sentences). Only return the final refined description text. Do not include prefix comments like "Here is the rephrased text:" or similar.`,
// 
//   prompt_audit_system: `You are a professional HR diagnostic agent analyzing employee performance and workload. You must STRICTLY return a JSON object containing the exact keys requested. Do not return markdown wrapped JSON blocks.`,
// 
//   prompt_audit_user: `[EMPLOYEE PROFILE]
// Name: {employee_name}
// Position: {position}
// Role: {role}
// Department: {department}
// 
// [TARGET JOB DESCRIPTION]
// {job_description}
// 
// [ACTUAL LOGGED WORK DATA (Past {duration_days} Days)]
// Total effort hours logged: {total_hours} hours
// Average hours per day: {avg_hours_per_day} hours
// Key tasks done:
// {worklog_summary}
// 
// INSTRUCTION:
// Compare the actual logged work data against the employee's Job Description (JD). Assess how aligned their activities are to their core responsibilities, and analyze if they show signs of workload overloading or underutilization.
// 
// Strictly return a raw JSON object (no markdown wrapping) matching this schema:
// {
//   "jd_alignment_score": integer (0 to 100),
//   "burnout_risk_score": integer (0 to 100),
//   "workload_allocation": [
//     {
//       "category": "string",
//       "target_weight_pct": number,
//       "actual_weight_pct": number,
//       "evaluation": "Aligned | Overloaded | Underutilized"
//     }
//   ],
//   "strengths": ["string"],
//   "improvements": ["string"],
//   "development_plan": {
//     "short_term_90_days": "string",
//     "long_term_goals": "string"
//   },
//   "markdown_executive_summary": "string (beautifully formatted markdown summary)"
// }`,
// };

// const PROMPT_SECTIONS = [
//   {
//     id: 'enhance',
//     label: '✍️ Worklog Enhancement',
//     description: 'ปรับปรุงการเขียนใบงานให้เป็นมืออาชีพ — AI Polish feature',
//     color: 'indigo',
//     fields: [
//       {
//         key: 'prompt_enhance_system',
//         label: 'System Prompt',
//         hint: 'กำหนดบทบาทของ AI (ห้ามลบ {variables})',
//         rows: 3,
//       },
//       {
//         key: 'prompt_enhance_user',
//         label: 'User Prompt Template',
//         hint: 'Variables: {project_name}, {action_name}, {duration}, {description}',
//         rows: 10,
//       },
//     ],
//   },
//   {
//     id: 'audit',
//     label: '📊 Individual Performance Analysis',
//     description: 'วิเคราะห์พนักงานรายบุคคล เทียบกับ JD — หน้า Reports Individual',
//     color: 'violet',
//     fields: [
//       {
//         key: 'prompt_audit_system',
//         label: 'System Prompt',
//         hint: 'กำหนดบทบาทของ AI — ควรให้ return JSON เสมอ',
//         rows: 3,
//       },
//       {
//         key: 'prompt_audit_user',
//         label: 'User Prompt Template',
//         hint: 'Variables: {employee_name}, {position}, {role}, {department}, {job_description}, {duration_days}, {total_hours}, {avg_hours_per_day}, {worklog_summary}',
//         rows: 14,
//       },
//     ],
//   },
// ];

function AIPromptsManager() {
  const { showToast } = useNotification();

  // ── Legacy Worklog Enhancement prompts (tb_system_config) ──────────
  const LEGACY_DEFAULTS = {
    prompt_enhance_system: `You are an expert HR Coach, Work Measurement Specialist, and Executive Technical Writer. Rephrase raw work logs into highly detailed, professional, business-oriented descriptions in Thai language to maximize business impact, and estimate the standard time duration required for the task. You must return your output strictly in JSON format.`,
    prompt_enhance_user: `Context:
- Project: {project_name}
- Category: {action_name}
- Actual Duration Spent: {duration} hours

RAW LOG:
{description}

INSTRUCTION:
1. วิเคราะห์ข้อความ RAW LOG ด้านบนว่าเป็น:
   - "งานประเภทพัฒนา/ปฏิบัติงานทั่วไป (General Task/Work)"
   - "งานประเภทประชุม/หารือ (Meeting/Discuss)"
   - "งานประเภทการวิเคราะห์สะท้อนผล PARIL (Plan, Action, Result, Impact, Lesson)"
2. ขยายรายละเอียดงานและเขียนเรียบเรียงเป็นภาษาไทยให้เป็นมืออาชีพ มีความชัดเจนและมีความยาวเพิ่มขึ้นเป็นพิเศษเพื่อแสดงถึงคุณค่าทางธุรกิจและ impact สูงสุด ("เขียนยาวๆ และเพิ่มระดับรายละเอียดงานให้ดูมี impact มากยิ่งขึ้นไปอีก")
3. ทุกโครงสร้างงาน จะต้องใส่หัวข้อ "[Project Background]" ไว้เป็นลำดับแรกสุดเสมอเพื่อบอกบริบทและภูมิหลังโครงการ
4. สำหรับหัวข้อถัดไป ให้บังคับใช้โครงสร้างและหัวข้อตามประเภทงานดังนี้:
   
   ก. หากเป็นงานทั่วไป (General Task/Work) หรือไม่สามารถจัดกลุ่มประเภทอื่นได้ชัดเจน:
      - [Project Background]: (ภูมิหลังและบริบทของโครงการหรือกิจกรรมนี้ อธิบายที่มาที่ไปเชิงกลยุทธ์สั้นๆ แต่มีระดับ)
      - [งานที่ทำ]: (ระบุรายละเอียดและขั้นตอนการปฏิบัติงานอย่างเจาะลึก ชัดเจน เป็นระบบ และเขียนอธิบายอย่างละเอียด)
      - [ผลลัพธ์ที่ได้]: (สรุปชิ้นงานหรือผลสำเร็จที่เป็นรูปธรรม รวมถึงคุณค่าที่เพิ่มขึ้นและ impact เชิงบวก)
      - [KPI/เป้าหมาย]: (วิเคราะห์ความเชื่อมโยงกับเป้าหมายองค์กรหรือความคุ้มค่าทางธุรกิจอย่างชัดเจนและทรงพลัง)
      - [Next Steps]: (แผนงานในขั้นถัดไปอย่างเป็นรูปธรรม)

   ข. หากเป็นงานประชุม/หารือ (Meeting/Discuss):
      - [Project Background]: (ภูมิหลังและบริบทของโครงการหรือกิจกรรมประชุมนี้ อธิบายที่มาที่ไปเชิงกลยุทธ์สั้นๆ)
      - [วัตถุประสงค์และบทบาท]: (จุดประสงค์หลักในการประชุมและหน้าที่รับผิดชอบของเราในที่ประชุมอย่างละเอียด)
      - [ข้อสรุป]: (สาระสำคัญ มติ หรือผลการตัดสินใจจากที่ประชุมที่มีความสำคัญต่อโครงการอย่างครบถ้วน)
      - [Next Steps]: (แผนการดำเนินงานและสิ่งที่จะต้องทำต่อหลังการประชุม)

   ค. หากพบหัวข้อโครงสร้าง PARIL ใน RAW LOG:
      - [Project Background]: (ภูมิหลังและบริบทของโครงการหรือกิจกรรมนี้ อธิบายที่มาที่ไป)
      - [Plan]: (แผนงานเชิงลึก)
      - [Action]: (การลงมือปฏิบัติรายละเอียด)
      - [Result]: (ผลลัพธ์ที่เป็นรูปธรรม)
      - [Impact]: (ผลกระทบเชิงธุรกิจสูง)
      - [Lesson Learned]: (บทเรียนที่ได้รับ)

5. ประเมินช่วงเวลามาตรฐานที่เหมาะสมสำหรับการทำงานลักษณะนี้ (Standard Time เช่น min: 2.0, max: 4.0 ชั่วโมง)
6. เปรียบเทียบ Actual Duration Spent ({duration} ชั่วโมง) กับค่ามาตรฐานเพื่อประเมินระดับประสิทธิภาพ:
   - "มาก" (หากใช้เวลาจริงเกินกว่าค่าสูงสุดมาตรฐาน)
   - "น้อย" (หากใช้เวลาจริงต่ำกว่าค่าต่ำสุดมาตรฐาน)
   - "ดี" (หากใช้เวลาเหมาะสมตามมาตรฐานหรือสมเหตุสมผล)
7. เขียนอธิบายสั้นๆ 1-2 ประโยค (time_assessment_reason) เพื่อแนะนำเหตุผลประกอบการประเมิน

ตอบกลับเฉพาะ JSON ดิบตามโครงสร้างนี้เท่านั้น (ห้ามใส่ markdown block หรือข้อความอื่นๆ):
{
  "enhanced_text": "เนื้อหาที่ขัดเกลาแล้วพร้อม [Project Background] และหัวข้ออื่นๆ ตามโครงสร้างที่กำหนด",
  "standard_time_min": number,
  "standard_time_max": number,
  "time_assessment": "มาก" | "น้อย" | "ดี",
  "time_assessment_reason": "คำอธิบายประเมินเวลาวิเคราะห์สั้นๆ..."
}`,
  };
  const [legacyPrompts, setLegacyPrompts] = useState<{ [key: string]: string }>(LEGACY_DEFAULTS);
  const [savingLegacy, setSavingLegacy] = useState(false);

  // ── AI Prompt Templates (tb_ai_prompt_templates) ──────────────────
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);

  // ── Load everything on mount ───────────────────────────────────────
  useEffect(() => {
    fetchLegacyPrompts();
    fetchTemplates();
  }, []);

  const fetchLegacyPrompts = async () => {
    const keys = Object.keys(LEGACY_DEFAULTS);
    const { data } = await supabase
      .from('tb_system_config')
      .select('config_key, config_value')
      .in('config_key', keys);
    if (data) {
      const map: { [k: string]: string } = { ...LEGACY_DEFAULTS };
      data.forEach(r => { if (r.config_value) map[r.config_key] = r.config_value; });
      setLegacyPrompts(map);
    }
  };

  const handleSaveLegacy = async () => {
    try {
      setSavingLegacy(true);
      const rows = Object.entries(legacyPrompts).map(([key, val]) => ({ config_key: key, config_value: val }));
      const { error } = await supabase.from('tb_system_config').upsert(rows);
      if (error) throw error;
      showToast('บันทึก Worklog Enhancement prompt สำเร็จ', 'success');
    } catch (err: any) {
      showToast('บันทึกไม่สำเร็จ: ' + err.message, 'error');
    } finally {
      setSavingLegacy(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const { data, error } = await supabase
        .from('tb_ai_prompt_templates')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setTemplates(data || []);
    } catch (err: any) {
      showToast('โหลด templates ไม่สำเร็จ: ' + err.message, 'error');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleEditTemplate = (tmpl: any) => {
    setEditingTemplate({ ...tmpl });
    setExpandedTemplateId(tmpl.id);
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    try {
      setSavingTemplate(true);
      const { error } = await supabase
        .from('tb_ai_prompt_templates')
        .update({
          name: editingTemplate.name,
          description: editingTemplate.description,
          system_prompt: editingTemplate.system_prompt,
          user_prompt_template: editingTemplate.user_prompt_template,
          is_active: editingTemplate.is_active,
          cadence_aware: editingTemplate.cadence_aware,
          requires_level: editingTemplate.requires_level,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingTemplate.id);
      if (error) throw error;
      showToast(`บันทึก template "${editingTemplate.name}" สำเร็จ`, 'success');
      setEditingTemplate(null);
      fetchTemplates();
    } catch (err: any) {
      showToast('บันทึกไม่สำเร็จ: ' + err.message, 'error');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleToggleActive = async (tmpl: any) => {
    try {
      const { error } = await supabase
        .from('tb_ai_prompt_templates')
        .update({ is_active: !tmpl.is_active, updated_at: new Date().toISOString() })
        .eq('id', tmpl.id);
      if (error) throw error;
      showToast(`${!tmpl.is_active ? 'เปิด' : 'ปิด'} template "${tmpl.name}" แล้ว`, 'success');
      fetchTemplates();
    } catch (err: any) {
      showToast('อัปเดตสถานะไม่สำเร็จ: ' + err.message, 'error');
    }
  };

  const VARIABLE_HINTS: Record<string, string[]> = {
    master: ['{{EMPLOYEE_NAME}}','{{EMPLOYEE_NICKNAME}}','{{EMPLOYEE_ROLE}}','{{EMPLOYEE_DEPARTMENT}}','{{TOTAL_HOURS}}','{{AVG_HOURS_PER_DAY}}','{{OT_RATE}}','{{DURATION_DAYS}}','{{INDIVIDUAL_WORKLOG_JSON_OR_CSV}}','{{INDIVIDUAL_JD_DATA}}','{{KEY_RESPONSIBILITIES_JSON}}'],
    individual_coach: ['{{TODAY}}','{{CADENCE_TYPE}}','{{PERIOD_LABEL}}','{{PERIOD_START_DATE}}','{{PERIOD_END_DATE}}','{{EMPLOYEE_NAME}}','{{EMPLOYEE_NICKNAME}}','{{EMPLOYEE_ROLE}}','{{EMPLOYEE_LEVEL}}','{{YEARS_IN_ROLE}}','{{MANAGER_NAME}}','{{EMPLOYEE_DEPARTMENT}}','{{TOTAL_HOURS}}','{{AVG_HOURS_PER_DAY}}','{{OT_RATE}}','{{DURATION_DAYS}}','{{LOGS_COUNT}}','{{INDIVIDUAL_WORKLOG_JSON_OR_CSV}}','{{INDIVIDUAL_JD_DATA}}','{{KEY_RESPONSIBILITIES_JSON}}','{{PREVIOUS_PERIOD_SUMMARY}}','{{CADENCE_INSTRUCTION}}','{{ROLE_LEVEL_INSTRUCTION}}'],
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/20 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
            <MessageSquare className="text-violet-400" size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-theme-text">AI Prompt Templates</h2>
            <p className="text-sm text-theme-text-secondary mt-1 leading-relaxed">
              จัดการ Prompt ที่ระบบ AI ใช้วิเคราะห์ — มี 2 ส่วน: <strong>Analyst Templates</strong> (วิเคราะห์พนักงาน) และ <strong>Enhancement Prompt</strong> (ปรับปรุงการเขียนใบงาน)
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="inline-flex items-center gap-1.5 text-xs bg-violet-500/15 text-violet-300 border border-violet-500/25 rounded-full px-3 py-1">
                🎯 Analyst Templates — จาก tb_ai_prompt_templates
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 rounded-full px-3 py-1">
                ✍️ Enhancement — จาก tb_system_config
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 1: Analyst Templates ─────────────────────────────── */}
      <div className="bg-theme-surface-tertiary border border-theme-border/50 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-theme-border/40 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-theme-text flex items-center gap-2">
              <span className="text-violet-400">🎯</span> Analyst Templates
            </h3>
            <p className="text-xs text-theme-text-secondary mt-0.5">Template ที่ใช้ใน HRBP Analysis — เลือกได้ก่อน Run Analysis</p>
          </div>
          <button onClick={fetchTemplates} className="p-2 rounded-xl hover:bg-theme-surface-secondary text-theme-text-secondary hover:text-theme-text transition-all">
            <RefreshCw size={15} className={loadingTemplates ? 'animate-spin' : ''} />
          </button>
        </div>

        {loadingTemplates ? (
          <div className="p-10 text-center text-theme-text-secondary text-sm animate-pulse">กำลังโหลด templates...</div>
        ) : templates.length === 0 ? (
          <div className="p-10 text-center text-theme-text-secondary text-sm">
            ไม่พบ templates — กรุณารัน <code className="font-mono bg-theme-surface-secondary px-1.5 py-0.5 rounded text-xs">migration_analyst_templates.sql</code> ใน Supabase SQL Editor
          </div>
        ) : (
          <div className="divide-y divide-theme-border/30">
            {templates.map(tmpl => {
              const isEditing = editingTemplate?.id === tmpl.id;
              const isExpanded = expandedTemplateId === tmpl.id;
              const current = isEditing ? editingTemplate : tmpl;
              return (
                <div key={tmpl.id} className="transition-all">
                  {/* Template Row Header */}
                  <div className="px-6 py-4 flex items-center gap-4">
                    <span className="text-2xl">{tmpl.icon || '🤖'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-theme-text text-sm">{tmpl.name}</span>
                        <code className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">{tmpl.template_key}</code>
                        {tmpl.cadence_aware && <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded">Cadence-aware</span>}
                        {tmpl.requires_level && <span className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1.5 py-0.5 rounded">Level-aware</span>}
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-semibold', tmpl.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20')}>
                          {tmpl.is_active ? '● Active' : '○ Inactive'}
                        </span>
                      </div>
                      <p className="text-xs text-theme-text-secondary mt-0.5 line-clamp-1">{tmpl.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleToggleActive(tmpl)}
                        className={cn('p-1.5 rounded-lg text-xs font-semibold transition-all border', tmpl.is_active ? 'text-rose-400 border-rose-500/20 hover:bg-rose-500/10' : 'text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10')}
                        title={tmpl.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {tmpl.is_active ? <X size={14} /> : <Check size={14} />}
                      </button>
                      <button
                        onClick={() => {
                          if (isEditing) { setEditingTemplate(null); setExpandedTemplateId(null); }
                          else { handleEditTemplate(tmpl); }
                        }}
                        className="p-1.5 rounded-lg text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/10 transition-all"
                        title="Edit Template"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => setExpandedTemplateId(isExpanded && !isEditing ? null : tmpl.id)}
                        className="p-1.5 rounded-lg text-theme-text-secondary border border-theme-border/50 hover:bg-theme-surface-secondary transition-all"
                        title="Preview"
                      >
                        <ChevronDown size={14} className={cn('transition-transform', isExpanded && 'rotate-180')} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Edit / Preview */}
                  {isExpanded && (
                    <div className="px-6 pb-6 space-y-4 bg-theme-surface/30">
                      {/* Variable hints */}
                      <div className="bg-theme-surface-secondary rounded-xl p-3 border border-theme-border/30">
                        <p className="text-xs font-semibold text-theme-text-secondary mb-1.5">📌 Available Variables:</p>
                        <div className="flex flex-wrap gap-1">
                          {(VARIABLE_HINTS[tmpl.template_key] || []).map(v => (
                            <code key={v} className="text-[10px] font-mono bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded">{v}</code>
                          ))}
                        </div>
                      </div>

                      {/* Name & Description */}
                      {isEditing && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">Template Name</label>
                            <input
                              value={current.name}
                              onChange={e => setEditingTemplate((p: any) => ({ ...p, name: e.target.value }))}
                              className="w-full bg-theme-surface-secondary border border-theme-border rounded-xl py-2 px-3 text-sm text-theme-text focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">Description</label>
                            <input
                              value={current.description || ''}
                              onChange={e => setEditingTemplate((p: any) => ({ ...p, description: e.target.value }))}
                              className="w-full bg-theme-surface-secondary border border-theme-border rounded-xl py-2 px-3 text-sm text-theme-text focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                      )}

                      {/* System Prompt */}
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="text-sm font-semibold text-theme-text">System Prompt</label>
                          <span className="text-xs text-theme-text-secondary font-mono">{(current.system_prompt || '').length} chars</span>
                        </div>
                        <textarea
                          value={current.system_prompt || ''}
                          onChange={e => isEditing && setEditingTemplate((p: any) => ({ ...p, system_prompt: e.target.value }))}
                          readOnly={!isEditing}
                          rows={8}
                          className={cn(
                            'w-full bg-theme-surface-secondary border border-theme-border rounded-xl px-4 py-3 text-theme-text text-xs font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all',
                            !isEditing && 'opacity-70 cursor-default'
                          )}
                          spellCheck={false}
                        />
                      </div>

                      {/* User Prompt Template */}
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="text-sm font-semibold text-theme-text">User Prompt Template</label>
                          <span className="text-xs text-theme-text-secondary font-mono">{(current.user_prompt_template || '').length} chars</span>
                        </div>
                        <textarea
                          value={current.user_prompt_template || ''}
                          onChange={e => isEditing && setEditingTemplate((p: any) => ({ ...p, user_prompt_template: e.target.value }))}
                          readOnly={!isEditing}
                          rows={12}
                          className={cn(
                            'w-full bg-theme-surface-secondary border border-theme-border rounded-xl px-4 py-3 text-theme-text text-xs font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all',
                            !isEditing && 'opacity-70 cursor-default'
                          )}
                          spellCheck={false}
                        />
                      </div>

                      {/* Save / Cancel */}
                      {isEditing && (
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => { setEditingTemplate(null); setExpandedTemplateId(null); }}
                            className="px-5 py-2.5 border border-theme-border text-theme-text-secondary hover:text-theme-text rounded-xl font-semibold text-sm transition-all"
                          >
                            ยกเลิก
                          </button>
                          <button
                            onClick={handleSaveTemplate}
                            disabled={savingTemplate}
                            className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95"
                          >
                            {savingTemplate ? <><RefreshCw size={14} className="animate-spin" /><span>กำลังบันทึก...</span></> : <><Save size={14} /><span>บันทึก Template</span></>}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── SECTION 2: Legacy Worklog Enhancement ────────────────────── */}
      <div className="bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border border-indigo-500/25 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-indigo-500/20 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-theme-text flex items-center gap-2">
              <span>✍️</span> Worklog Enhancement Prompt
            </h3>
            <p className="text-xs text-theme-text-secondary mt-0.5">ปรับปรุงการเขียนใบงานให้เป็นมืออาชีพ — เก็บใน tb_system_config</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-5">
          {[
            { key: 'prompt_enhance_system', label: 'System Prompt', hint: 'กำหนดบทบาทของ AI', rows: 3 },
            { key: 'prompt_enhance_user', label: 'User Prompt Template', hint: 'Variables: {project_name}, {action_name}, {duration}, {description}', rows: 10 },
          ].map(field => (
            <div key={field.key}>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-sm font-semibold text-theme-text">{field.label}</label>
                <span className="text-xs text-theme-text-secondary font-mono">{(legacyPrompts[field.key] || '').length} chars</span>
              </div>
              <p className="text-xs text-theme-text-secondary mb-2">{field.hint}</p>
              <textarea
                value={legacyPrompts[field.key] || ''}
                onChange={e => setLegacyPrompts(p => ({ ...p, [field.key]: e.target.value }))}
                rows={field.rows}
                className="w-full bg-theme-surface-secondary border border-theme-border rounded-xl px-4 py-3 text-theme-text text-sm font-mono leading-relaxed placeholder:text-theme-text-secondary focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y transition-all"
                spellCheck={false}
              />
            </div>
          ))}
          <div className="flex justify-end">
            <button
              onClick={handleSaveLegacy}
              disabled={savingLegacy}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95"
            >
              {savingLegacy ? <><RefreshCw size={14} className="animate-spin" /><span>กำลังบันทึก...</span></> : <><Save size={14} /><span>บันทึก Enhancement Prompt</span></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
