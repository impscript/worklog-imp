import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Database, RefreshCw, X, Check } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { useNotification } from '../context/NotificationContext';

type TableTab = 'holding' | 'role' | 'project_type' | 'action' | 'map_user' | 'map_project' | 'users';

export default function AdminPage() {
  const { showToast, showConfirm } = useNotification();
  const [activeTab, setActiveTab] = useState<TableTab>('holding');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<any | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const entriesPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery]);

  // Database Data States
  const [holdings, setHoldings] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [projectTypes, setProjectTypes] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [userMappings, setUserMappings] = useState<any[]>([]);
  const [projectStructures, setProjectStructures] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);

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

  // Users Form States
  const [formUserEmpId, setFormUserEmpId] = useState('');
  const [formUserFullName, setFormUserFullName] = useState('');
  const [formUserNickname, setFormUserNickname] = useState('');
  const [formUserEmail, setFormUserEmail] = useState('');
  const [formUserRole, setFormUserRole] = useState('user');
  const [formUserDept, setFormUserDept] = useState('IMP');

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
        resUsers
      ] = await Promise.all([
        supabase.from('tb_master_holding').select('*').order('holding_name'),
        supabase.from('tb_master_role').select('*').order('role_name'),
        supabase.from('tb_master_project_type').select('*').order('type_name'),
        supabase.from('tb_master_action').select('*').order('action_category'),
        supabase.from('tb_map_user_role').select('*').order('name'),
        supabase.from('tb_map_project_structure').select('*').order('project_name'),
        supabase.from('users').select('*').order('nickname')
      ]);

      if (resHoldings.data) setHoldings(resHoldings.data);
      if (resRoles.data) setRoles(resRoles.data);
      if (resTypes.data) setProjectTypes(resTypes.data);
      if (resActions.data) setActions(resActions.data);
      if (resUserMaps.data) setUserMappings(resUserMaps.data);
      if (resProjStructs.data) setProjectStructures(resProjStructs.data);
      if (resUsers.data) setUsersList(resUsers.data);
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
        return projectStructures.filter(p => 
          p.project_name.toLowerCase().includes(q) || 
          p.holding.toLowerCase().includes(q) || 
          p.department_operator.toLowerCase().includes(q) ||
          p.project_type.toLowerCase().includes(q) ||
          (p.module && p.module.toLowerCase().includes(q)) ||
          p.bu.toLowerCase().includes(q) ||
          p.department.toLowerCase().includes(q)
        );
      case 'users':
        return usersList.filter(u => 
          u.full_name.toLowerCase().includes(q) || 
          u.nickname.toLowerCase().includes(q) || 
          u.emp_id.toLowerCase().includes(q) ||
          (u.email && u.email.toLowerCase().includes(q))
        );
      default:
        return [];
    }
  };

  // Open modal for Create/Edit
  const openModal = (row: any = null) => {
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
      } else if (activeTab === 'users') {
        setFormUserEmpId(row.emp_id);
        setFormUserFullName(row.full_name);
        setFormUserNickname(row.nickname || '');
        setFormUserEmail(row.email || '');
        setFormUserRole(row.role || 'user');
        setFormUserDept(row.department || 'IMP');
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
      setFormStructHolding(holdings[0]?.holding_name || '');
      setFormStructRole(roles[0]?.role_name || '');
      setFormStructType(projectTypes[0]?.type_name || '');
      setFormStructProjName('');
      setFormStructModule('');
      setFormStructBU('');
      setFormStructDept('');
      setFormUserEmpId(`EMP-${Math.floor(Math.random() * 90000 + 10000)}`);
      setFormUserFullName('');
      setFormUserNickname('');
      setFormUserEmail('');
      setFormUserRole('user');
      setFormUserDept('IMP');
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
          department: formStructDept
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
        activeTab === 'map_project' ? 'tb_map_project_structure' : 'users'
      );

      let deleteOp;
      if (activeTab === 'holding') deleteOp = query.delete().eq('holding_name', row.holding_name);
      else if (activeTab === 'role') deleteOp = query.delete().eq('role_name', row.role_name);
      else if (activeTab === 'project_type') deleteOp = query.delete().eq('type_name', row.type_name);
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

  const tabs: { key: TableTab; label: string }[] = [
    { key: 'holding', label: 'Holdings' },
    { key: 'role', label: 'Roles' },
    { key: 'project_type', label: 'Project Types' },
    { key: 'action', label: 'Actions' },
    { key: 'map_user', label: 'User Mappings' },
    { key: 'map_project', label: 'Project Structures' },
    { key: 'users', label: 'System Users' }
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
            <h1 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent flex items-center gap-2">
              <Database className="text-indigo-400" />
              <span>Master Data Manager</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Add, edit, or check your Supabase master tables and relationship cascading structures.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={loadAllData}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700/50"
              title="Refresh database entries"
            >
              <RefreshCw size={18} className={cn(isLoading && "animate-spin")} />
            </button>
            <button 
              onClick={() => openModal()}
              className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg active:scale-95 text-sm"
            >
              <Plus size={16} />
              <span>Add Record</span>
            </button>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex overflow-x-auto pb-2 border-b border-slate-700/50 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSearchQuery(''); }}
              className={cn(
                "px-4 py-2 text-sm font-semibold rounded-xl transition-all whitespace-nowrap border shrink-0",
                activeTab === tab.key 
                  ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                  : "text-slate-400 border-transparent hover:text-slate-200"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 shadow-lg flex items-center">
          <div className="relative w-full md:w-1/3">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search in ${tabs.find(t => t.key === activeTab)?.label}...`}
              className="w-full bg-[#0F172A] border border-slate-600 rounded-xl py-2 pl-10 pr-4 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
            />
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          </div>
        </div>

        {/* Table Content Card */}
        <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
          {isLoading ? (
            <div className="p-16 text-center animate-pulse flex flex-col gap-4">
              <div className="h-6 w-full bg-slate-800 rounded"></div>
              <div className="h-6 w-full bg-slate-800 rounded"></div>
              <div className="h-6 w-full bg-slate-800 rounded"></div>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
                <Search size={28} />
              </div>
              <h3 className="text-white font-medium">No records found</h3>
              <p className="text-sm text-slate-400">
                Click "+ Add Record" above to populate this master collection.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-400 bg-[#0F172A]/50 uppercase border-b border-slate-700/50">
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
                      <th className="px-6 py-4 font-semibold">Holding</th>
                      <th className="px-6 py-4 font-semibold">Role</th>
                      <th className="px-6 py-4 font-semibold">Proj Type</th>
                      <th className="px-6 py-4 font-semibold font-bold">Project Name</th>
                      <th className="px-6 py-4 font-semibold">Module</th>
                      <th className="px-6 py-4 font-semibold">BU</th>
                      <th className="px-6 py-4 font-semibold">Department</th>
                      <th className="px-6 py-4 font-semibold text-right">Actions</th>
                    </tr>
                  )}
                  {activeTab === 'users' && (
                    <tr>
                      <th className="px-6 py-4 font-semibold">Emp ID</th>
                      <th className="px-6 py-4 font-semibold">Full Name</th>
                      <th className="px-6 py-4 font-semibold">Nickname</th>
                      <th className="px-6 py-4 font-semibold">Email</th>
                      <th className="px-6 py-4 font-semibold">System Role</th>
                      <th className="px-6 py-4 font-semibold">Dept</th>
                      <th className="px-6 py-4 font-semibold text-right">Actions</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {paginatedData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#0F172A]/30 transition-colors">
                      {activeTab === 'holding' && (
                        <>
                          <td className="px-6 py-4 font-bold text-white">{row.holding_name}</td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <button onClick={() => handleDelete(row)} className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </>
                      )}
                      {activeTab === 'role' && (
                        <>
                          <td className="px-6 py-4 font-bold text-white">{row.role_name}</td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <button onClick={() => handleDelete(row)} className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </>
                      )}
                      {activeTab === 'project_type' && (
                        <>
                          <td className="px-6 py-4 font-bold text-white">{row.type_name}</td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <button onClick={() => handleDelete(row)} className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </>
                      )}
                      {activeTab === 'action' && (
                        <>
                          <td className="px-6 py-4 text-slate-400 font-semibold">{row.action_category}</td>
                          <td className="px-6 py-4 font-bold text-white">{row.action_name}</td>
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
                          <td className="px-6 py-4 font-bold text-white">{row.name}</td>
                          <td className="px-6 py-4 text-slate-300">{row.holding}</td>
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
                          <td className="px-6 py-4 text-slate-400 whitespace-nowrap">{row.holding}</td>
                          <td className="px-6 py-4 text-slate-400 whitespace-nowrap">{row.department_operator}</td>
                          <td className="px-6 py-4 text-slate-300 whitespace-nowrap">{row.project_type}</td>
                          <td className="px-6 py-4 font-bold text-white whitespace-nowrap">{row.project_name}</td>
                          <td className="px-6 py-4 text-slate-300 font-medium whitespace-nowrap">{row.module || '-'}</td>
                          <td className="px-6 py-4 text-slate-400 whitespace-nowrap">{row.bu}</td>
                          <td className="px-6 py-4 text-slate-400 whitespace-nowrap">{row.department}</td>
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
                      {activeTab === 'users' && (
                        <>
                          <td className="px-6 py-4 text-slate-400 font-mono">{row.emp_id}</td>
                          <td className="px-6 py-4 font-bold text-white">{row.full_name}</td>
                          <td className="px-6 py-4 text-slate-300">{row.nickname || '-'}</td>
                          <td className="px-6 py-4 text-slate-400">{row.email || '-'}</td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2 py-0.5 text-xs font-semibold rounded-full border",
                              row.role === 'admin' 
                                ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
                                : "text-slate-400 bg-slate-400/10 border-slate-400/20"
                            )}>
                              {row.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-indigo-400 font-semibold">{row.department}</td>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Bar */}
          {!isLoading && totalPages > 1 && (
            <div className="px-6 py-4 bg-[#0F172A]/40 border-t border-slate-700/50 flex flex-col sm:flex-row justify-between items-center gap-4">
              <span className="text-xs text-slate-400 font-medium font-mono">
                Showing {((currentPage - 1) * entriesPerPage) + 1} - {Math.min(currentPage * entriesPerPage, filteredData.length)} of {filteredData.length} entries
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="px-3 py-1.5 bg-[#1E293B] border border-slate-700/50 hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-xs text-slate-300 font-bold rounded-lg transition-all"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }).map((_, i) => {
                  const page = i + 1;
                  if (totalPages > 6 && Math.abs(page - currentPage) > 1 && page !== 1 && page !== totalPages) {
                    if (page === 2 && currentPage > 3) return <span key={page} className="text-slate-600 text-xs px-1 select-none font-mono">...</span>;
                    if (page === totalPages - 1 && currentPage < totalPages - 2) return <span key={page} className="text-slate-600 text-xs px-1 select-none font-mono">...</span>;
                    return null;
                  }
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={cn(
                        "w-8 h-8 flex items-center justify-center text-xs font-bold rounded-lg transition-all font-mono border",
                        currentPage === page
                          ? "bg-indigo-500 text-white border-transparent shadow-md shadow-indigo-500/10"
                          : "bg-transparent text-slate-400 border-transparent hover:text-white hover:bg-slate-800"
                      )}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className="px-3 py-1.5 bg-[#1E293B] border border-slate-700/50 hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-xs text-slate-300 font-bold rounded-lg transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* CRUD Overlay Modal Drawer */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#1E293B] border border-slate-700/80 rounded-2xl p-6 md:p-8 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 text-slate-200">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold text-white tracking-tight mb-6 flex items-center gap-2">
              <Database size={20} className="text-indigo-400" />
              <span>{editRow ? 'Edit Record' : 'Add New Record'}</span>
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Tab 1: Holding Form */}
              {activeTab === 'holding' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Holding Name</label>
                  <input 
                    type="text" 
                    value={formHoldingName}
                    onChange={(e) => setFormHoldingName(e.target.value)}
                    placeholder="e.g. Double A"
                    className="w-full bg-[#0F172A] border border-slate-600 rounded-xl py-2.5 px-4 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    required
                    disabled={!!editRow}
                  />
                  {editRow && <p className="text-xs text-amber-400 mt-2">Primary key cannot be modified directly.</p>}
                </div>
              )}

              {/* Tab 2: Role Form */}
              {activeTab === 'role' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Role/Department Name</label>
                  <input 
                    type="text" 
                    value={formRoleName}
                    onChange={(e) => setFormRoleName(e.target.value)}
                    placeholder="e.g. IMP"
                    className="w-full bg-[#0F172A] border border-slate-600 rounded-xl py-2.5 px-4 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    required
                    disabled={!!editRow}
                  />
                  {editRow && <p className="text-xs text-amber-400 mt-2">Primary key cannot be modified directly.</p>}
                </div>
              )}

              {/* Tab 3: Project Type Form */}
              {activeTab === 'project_type' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Project Type Name</label>
                  <input 
                    type="text" 
                    value={formTypeName}
                    onChange={(e) => setFormTypeName(e.target.value)}
                    placeholder="e.g. Support Go-Live"
                    className="w-full bg-[#0F172A] border border-slate-600 rounded-xl py-2.5 px-4 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
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
                    <label className="block text-sm font-medium text-slate-300 mb-2">Category</label>
                    <select
                      value={formActionCategory}
                      onChange={(e) => setFormActionCategory(e.target.value)}
                      className="w-full bg-[#0F172A] border border-slate-600 rounded-xl py-2.5 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="Project">Project</option>
                      <option value="Support">Support</option>
                      <option value="Management">Management</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Action Name</label>
                    <input 
                      type="text" 
                      value={formActionName}
                      onChange={(e) => setFormActionName(e.target.value)}
                      placeholder="e.g. User Requirement Gathering"
                      className="w-full bg-[#0F172A] border border-slate-600 rounded-xl py-2.5 px-4 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      required
                    />
                  </div>
                </>
              )}

              {/* Tab 5: User Mapping Form */}
              {activeTab === 'map_user' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Employee/User Name</label>
                    <input 
                      type="text" 
                      value={formMapUserName}
                      onChange={(e) => setFormMapUserName(e.target.value)}
                      placeholder="e.g. Jintana"
                      className="w-full bg-[#0F172A] border border-slate-600 rounded-xl py-2.5 px-4 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Holding</label>
                    <select
                      value={formMapHolding}
                      onChange={(e) => setFormMapHolding(e.target.value)}
                      className="w-full bg-[#0F172A] border border-slate-600 rounded-xl py-2.5 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      required
                    >
                      {holdings.map(h => (
                        <option key={h.holding_name} value={h.holding_name}>{h.holding_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Department Operator (Role)</label>
                    <select
                      value={formMapRole}
                      onChange={(e) => setFormMapRole(e.target.value)}
                      className="w-full bg-[#0F172A] border border-slate-600 rounded-xl py-2.5 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[350px] overflow-y-auto pr-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Holding</label>
                    <select
                      value={formStructHolding}
                      onChange={(e) => setFormStructHolding(e.target.value)}
                      className="w-full bg-[#0F172A] border border-slate-600 rounded-lg py-2 px-3 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      required
                    >
                      {holdings.map(h => (
                        <option key={h.holding_name} value={h.holding_name}>{h.holding_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Role Operator</label>
                    <select
                      value={formStructRole}
                      onChange={(e) => setFormStructRole(e.target.value)}
                      className="w-full bg-[#0F172A] border border-slate-600 rounded-lg py-2 px-3 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      required
                    >
                      {roles.map(r => (
                        <option key={r.role_name} value={r.role_name}>{r.role_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Project Type</label>
                    <select
                      value={formStructType}
                      onChange={(e) => setFormStructType(e.target.value)}
                      className="w-full bg-[#0F172A] border border-slate-600 rounded-lg py-2 px-3 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      required
                    >
                      {projectTypes.map(t => (
                        <option key={t.type_name} value={t.type_name}>{t.type_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Project Name</label>
                    <input 
                      type="text" 
                      value={formStructProjName}
                      onChange={(e) => setFormStructProjName(e.target.value)}
                      placeholder="e.g. ERP - Netsuite"
                      className="w-full bg-[#0F172A] border border-slate-600 rounded-lg py-2 px-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Module (Optional)</label>
                    <input 
                      type="text" 
                      value={formStructModule}
                      onChange={(e) => setFormStructModule(e.target.value)}
                      placeholder="e.g. Item Master"
                      className="w-full bg-[#0F172A] border border-slate-600 rounded-lg py-2 px-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Business Unit (BU)</label>
                    <input 
                      type="text" 
                      value={formStructBU}
                      onChange={(e) => setFormStructBU(e.target.value)}
                      placeholder="e.g. Master Data"
                      className="w-full bg-[#0F172A] border border-slate-600 rounded-lg py-2 px-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Department Name</label>
                    <input 
                      type="text" 
                      value={formStructDept}
                      onChange={(e) => setFormStructDept(e.target.value)}
                      placeholder="e.g. IT"
                      className="w-full bg-[#0F172A] border border-slate-600 rounded-lg py-2 px-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Tab 7: System Users Form */}
              {activeTab === 'users' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[350px] overflow-y-auto pr-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Employee ID</label>
                    <input 
                      type="text" 
                      value={formUserEmpId}
                      onChange={(e) => setFormUserEmpId(e.target.value)}
                      className="w-full bg-[#0F172A] border border-slate-600 rounded-lg py-2 px-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
                    <input 
                      type="text" 
                      value={formUserFullName}
                      onChange={(e) => setFormUserFullName(e.target.value)}
                      placeholder="e.g. Chatchawan Dev"
                      className="w-full bg-[#0F172A] border border-slate-600 rounded-lg py-2 px-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Nickname</label>
                    <input 
                      type="text" 
                      value={formUserNickname}
                      onChange={(e) => setFormUserNickname(e.target.value)}
                      placeholder="e.g. chatchawan"
                      className="w-full bg-[#0F172A] border border-slate-600 rounded-lg py-2 px-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email</label>
                    <input 
                      type="email" 
                      value={formUserEmail}
                      onChange={(e) => setFormUserEmail(e.target.value)}
                      placeholder="e.g. user@doublea1991.com"
                      className="w-full bg-[#0F172A] border border-slate-600 rounded-lg py-2 px-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">System Role</label>
                    <select
                      value={formUserRole}
                      onChange={(e) => setFormUserRole(e.target.value)}
                      className="w-full bg-[#0F172A] border border-slate-600 rounded-lg py-2 px-3 text-xs text-slate-200 focus:outline-none cursor-pointer"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Default Department</label>
                    <input 
                      type="text" 
                      value={formUserDept}
                      onChange={(e) => setFormUserDept(e.target.value)}
                      className="w-full bg-[#0F172A] border border-slate-600 rounded-lg py-2 px-3 text-xs text-slate-200 focus:outline-none"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-700/50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-600 text-slate-400 hover:text-white transition-all text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white transition-all text-sm font-bold shadow-lg shadow-indigo-500/10 flex items-center gap-1.5"
                >
                  <Check size={16} />
                  <span>Save Changes</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
