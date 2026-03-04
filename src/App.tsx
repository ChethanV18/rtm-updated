import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Download, 
  Upload, 
  Trash2, 
  Check, 
  X, 
  Clock, 
  ChevronDown,
  Search,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { Requirement, PhaseStatus, RequirementStatus } from './types';
import { cn } from './lib/utils';

const PHASE_OPTIONS: { value: PhaseStatus; label: string; icon: React.ReactNode; color: string; triggerColor: string }[] = [
  { 
    value: 'pending', 
    label: 'Pending', 
    icon: null, 
    color: 'bg-blue-600 text-white', 
    triggerColor: 'text-amber-400' 
  },
  { 
    value: 'completed', 
    label: 'Completed', 
    icon: <Check className="w-6 h-6 text-purple-500" strokeWidth={3} />, 
    color: 'hover:bg-slate-800', 
    triggerColor: 'text-purple-500' 
  },
  { 
    value: 'failed', 
    label: 'Failed', 
    icon: <X className="w-6 h-6 text-rose-500" strokeWidth={3} />, 
    color: 'hover:bg-slate-800', 
    triggerColor: 'text-rose-500' 
  },
];

const STATUS_OPTIONS: RequirementStatus[] = ['Not Started', 'In Progress', 'Complete'];

export default function App() {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchRequirements();
  }, []);

  const fetchRequirements = async () => {
    try {
      const res = await fetch('/api/requirements');
      const data = await res.json();
      setRequirements(data);
    } catch (error) {
      console.error('Failed to fetch:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveRequirement = async (req: Requirement) => {
    try {
      const res = await fetch('/api/requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (!res.ok) {
        const errorData = await res.json();
        console.error('Failed to save requirement:', errorData.error);
        // If it's a uniqueness error or similar, we might want to alert the user
        if (res.status === 500 && errorData.error?.includes('UNIQUE constraint failed')) {
          alert('Requirement ID must be unique. Please use a different ID.');
          fetchRequirements(); // Revert to last known good state
        }
      }
    } catch (error) {
      console.error('Failed to save:', error);
    }
  };

  const addRequirement = () => {
    const newReq: Requirement = {
      uid: Math.random().toString(36).substr(2, 9),
      requirement_id: `REQ-${Date.now()}`,
      description: 'New Requirement',
      dev: 'pending',
      test: 'pending',
      report: 'pending',
      deploy: 'pending',
      usage: 'pending',
      remarks: '',
      status: 'Not Started',
    };
    setRequirements([newReq, ...requirements]);
    saveRequirement(newReq);
  };

  const updateRequirement = (uid: string, updates: Partial<Requirement>) => {
    const updated = requirements.map(req => {
      if (req.uid === uid) {
        const newReq = { ...req, ...updates };
        saveRequirement(newReq);
        return newReq;
      }
      return req;
    });
    setRequirements(updated);
  };

  const deleteRequirement = async (uid: string) => {
    if (!confirm('Are you sure you want to delete this requirement?')) return;
    try {
      await fetch(`/api/requirements/${uid}`, { method: 'DELETE' });
      setRequirements(requirements.filter(req => req.uid !== uid));
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const exportToExcel = () => {
    const exportData = requirements.map(req => ({
      'ID': req.requirement_id,
      'Description': req.description,
      'Dev': req.dev,
      'Test': req.test,
      'Report': req.report,
      'Deploy': req.deploy,
      'Usage': req.usage,
      'Remarks': req.remarks,
      'Status': req.status
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Requirements");
    XLSX.writeFile(workbook, "RTM_Export.xlsx");
  };

  const importFromExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];
      
      const formattedData: Requirement[] = data.map(row => ({
        uid: String(row.uid || Math.random().toString(36).substr(2, 9)),
        requirement_id: String(row.requirement_id || row.id || ''),
        description: String(row.description || ''),
        dev: (row.dev as PhaseStatus) || 'pending',
        test: (row.test as PhaseStatus) || 'pending',
        report: (row.report as PhaseStatus) || 'pending',
        deploy: (row.deploy as PhaseStatus) || 'pending',
        usage: (row.usage as PhaseStatus) || 'pending',
        remarks: String(row.remarks || ''),
        status: (row.status as RequirementStatus) || 'Not Started',
      }));

      try {
        await fetch('/api/requirements/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formattedData),
        });
        fetchRequirements();
      } catch (error) {
        console.error('Import failed:', error);
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredRequirements = requirements.filter(req => 
    (req.requirement_id?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (req.description?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen p-6 lg:p-10 max-w-[1600px] mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Requirements Traceability</h1>
          <p className="text-slate-400">Manage and track project requirements across all phases.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-brand-accent transition-colors" />
            <input 
              type="text" 
              placeholder="Search requirements..." 
              className="pl-10 pr-4 py-2 bg-brand-card border border-brand-border rounded-lg focus:outline-none focus:border-brand-accent transition-all w-full md:w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-brand-card border border-brand-border rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium"
          >
            <Upload className="w-4 h-4" />
            Import
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={importFromExcel} 
            className="hidden" 
            accept=".xlsx, .xls" 
          />
          
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-brand-card border border-brand-border rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          
          <button 
            onClick={addRequirement}
            className="flex items-center gap-2 px-5 py-2 bg-brand-accent hover:bg-blue-600 text-white rounded-lg transition-all shadow-lg shadow-blue-500/20 text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            Add Requirement
          </button>
        </div>
      </header>

      {/* Main Table */}
      <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-slate-800/50 border-bottom border-brand-border">
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">ID</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400 min-w-[350px]">Description</th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400 text-center">Dev</th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400 text-center">Test</th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400 text-center">Report</th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400 text-center">Deploy</th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400 text-center">Usage</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Remarks</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              <AnimatePresence mode="popLayout">
                {filteredRequirements.map((req) => (
                  <motion.tr 
                    key={req.uid}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="hover:bg-slate-800/30 transition-colors group"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input 
                        type="text" 
                        value={req.requirement_id || ''}
                        onChange={(e) => updateRequirement(req.uid, { requirement_id: e.target.value })}
                        className="bg-transparent border-none focus:ring-1 focus:ring-brand-accent rounded px-2 py-1 text-sm font-mono text-slate-400 w-32"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <textarea 
                        value={req.description || ''}
                        onChange={(e) => updateRequirement(req.uid, { description: e.target.value })}
                        rows={2}
                        className="w-full bg-transparent border-none focus:ring-1 focus:ring-brand-accent rounded px-2 py-1 text-sm text-slate-200 resize-y custom-scrollbar"
                      />
                    </td>
                    
                    {/* Phase Status Selectors */}
                    {['dev', 'test', 'report', 'deploy', 'usage'].map((phase) => (
                      <td key={phase} className="px-4 py-4 text-center">
                        <PhaseDropdown 
                          value={req[phase as keyof Requirement] as PhaseStatus} 
                          onChange={(val) => updateRequirement(req.uid, { [phase]: val })}
                        />
                      </td>
                    ))}

                    <td className="px-6 py-4 min-w-[250px]">
                      <textarea 
                        placeholder="Add remarks..."
                        value={req.remarks || ''}
                        onChange={(e) => updateRequirement(req.uid, { remarks: e.target.value })}
                        rows={2}
                        className="w-full bg-slate-900/50 border border-brand-border focus:border-brand-accent rounded px-3 py-1.5 text-sm text-slate-300 placeholder:text-slate-600 transition-all resize-y custom-scrollbar"
                      />
                    </td>
                    
                    <td className="px-6 py-4">
                      <select 
                        value={req.status}
                        onChange={(e) => updateRequirement(req.uid, { status: e.target.value as RequirementStatus })}
                        className={cn(
                          "bg-slate-900/50 border border-brand-border rounded px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-brand-accent transition-all",
                          req.status === 'Complete' ? 'text-emerald-400' : req.status === 'In Progress' ? 'text-blue-400' : 'text-slate-400'
                        )}
                      >
                        {STATUS_OPTIONS.map(opt => (
                          <option key={opt} value={opt} className="bg-brand-card">{opt}</option>
                        ))}
                      </select>
                    </td>
                    
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => deleteRequirement(req.uid)}
                        className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          
          {filteredRequirements.length === 0 && !loading && (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500">
              <FileSpreadsheet className="w-12 h-12 mb-4 opacity-20" />
              <p>No requirements found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PhaseDropdown({ value, onChange }: { value: PhaseStatus; onChange: (val: PhaseStatus) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentOption = PHASE_OPTIONS.find(opt => opt.value === value) || PHASE_OPTIONS[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg transition-all border border-slate-700/50 min-w-[100px] bg-slate-900/40",
          isOpen && "border-brand-accent ring-1 ring-brand-accent",
          currentOption.triggerColor
        )}
      >
        {currentOption.icon && <span className="mr-1">{currentOption.icon}</span>}
        <span className="text-sm font-medium">{currentOption.label}</span>
        <ChevronDown className={cn("w-4 h-4 text-slate-500 transition-transform ml-1", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            className="absolute z-50 top-full mt-1 left-1/2 -translate-x-1/2 bg-[#111827] border border-slate-700 rounded-md shadow-2xl overflow-hidden min-w-[120px]"
          >
            <div className="flex flex-col">
              {/* Completed Option (Purple Check) */}
              <button
                onClick={() => { onChange('completed'); setIsOpen(false); }}
                className="w-full flex items-center justify-center py-3 hover:bg-slate-800 transition-colors border-b border-slate-800"
              >
                <Check className="w-6 h-6 text-purple-500" strokeWidth={3} />
              </button>

              {/* Failed Option (Red X) */}
              <button
                onClick={() => { onChange('failed'); setIsOpen(false); }}
                className="w-full flex items-center justify-center py-3 hover:bg-slate-800 transition-colors border-b border-slate-800"
              >
                <X className="w-6 h-6 text-rose-500" strokeWidth={3} />
              </button>

              {/* Pending Option (Blue Bar) */}
              <button
                onClick={() => { onChange('pending'); setIsOpen(false); }}
                className="w-full flex items-center justify-center py-3 bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <span className="text-sm font-bold">Pending</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

