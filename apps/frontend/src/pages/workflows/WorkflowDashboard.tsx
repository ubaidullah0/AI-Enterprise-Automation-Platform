import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';
import {
  Play, Pause, Trash2, ExternalLink, Plus, Activity,
  Search, Zap, CheckCircle2, Sparkles
} from 'lucide-react';
import AiWorkflowWizard from './components/AiWorkflowWizard';

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  n8nWorkflowId: string | null;
  engine: string;
  isActive: boolean;
  triggerType: string | null;
  createdBy: string | null;
  updatedAt: string;
  createdAt: string;
}

const TEMPLATES = [
  {
    id: 'lead-nurture',
    name: 'Lead Nurturing',
    description: 'Automatically follow up with leads via email over 7 days.',
    icon: '📧',
    tags: ['Sales', 'Email'],
  },
  {
    id: 'slack-alert',
    name: 'Slack Error Alerts',
    description: 'Send Slack notifications when an API error rate exceeds threshold.',
    icon: '🔔',
    tags: ['DevOps', 'Monitoring'],
  },
  {
    id: 'crm-sync',
    name: 'CRM Data Sync',
    description: 'Sync customer data between your CRM and internal database nightly.',
    icon: '🔄',
    tags: ['Data', 'Integration'],
  },
  {
    id: 'onboarding',
    name: 'User Onboarding',
    description: 'Welcome new users with a personalized onboarding email sequence.',
    icon: '👋',
    tags: ['Marketing', 'Email'],
  },
  {
    id: 'report-gen',
    name: 'Weekly Reports',
    description: 'Generate and send weekly analytics reports to stakeholders.',
    icon: '📊',
    tags: ['Analytics', 'Schedule'],
  },
  {
    id: 'invoice',
    name: 'Invoice Automation',
    description: 'Automatically generate and send invoices when a deal is closed.',
    icon: '💰',
    tags: ['Finance', 'Sales'],
  },
];

export default function WorkflowDashboard() {
  const { user } = useAuthStore();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAiWizard, setShowAiWizard] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowEngine, setNewWorkflowEngine] = useState('native');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const res = await api.get('/workflows');
      if (res.data.success) setWorkflows(res.data.data);
    } catch (error) {
      console.error('Failed to fetch workflows', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.activeOrganizationId) {
      fetchWorkflows();
    } else {
      setLoading(false);
    }
  }, [user?.activeOrganizationId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkflowName.trim()) return;
    try {
      await api.post('/workflows', { name: newWorkflowName, engine: newWorkflowEngine });
      setShowCreateModal(false);
      setNewWorkflowName('');
      setNewWorkflowEngine('native');
      fetchWorkflows();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to create workflow';
      alert(msg);
    }
  };

  const handleCreateFromTemplate = async (templateName: string) => {
    try {
      await api.post('/workflows', { name: templateName });
      setShowTemplates(false);
      fetchWorkflows();
    } catch {
      alert('Failed to create workflow from template');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    try {
      await api.delete(`/workflows/${id}`);
      fetchWorkflows();
    } catch {
      alert('Failed to delete workflow');
    }
  };

  const openInN8n = (wf: any) => {
    // Use env var if set, otherwise default to port 5680 (from project config)
    const n8nBase = import.meta.env.VITE_N8N_URL || 'http://localhost:5680';
    
    if (wf.n8nWorkflowId) {
      // Open the specific workflow directly in n8n
      window.open(`${n8nBase}/workflow/${wf.n8nWorkflowId}`, '_blank');
    } else {
      // Workflow wasn't synced — open n8n's workflow list so user can create there
      window.open(`${n8nBase}/workflows`, '_blank');
    }
  };

  const filteredWorkflows = workflows
    .filter(wf => wf.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(wf => filterStatus === 'all' ? true : filterStatus === 'active' ? wf.isActive : !wf.isActive);

  // Stats
  const totalWorkflows = workflows.length;
  const activeWorkflows = workflows.filter(w => w.isActive).length;
  const inactiveWorkflows = workflows.filter(w => !w.isActive).length;

  const stats = [
    { label: 'Total Workflows', value: totalWorkflows, icon: Zap, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Active', value: activeWorkflows, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Inactive', value: inactiveWorkflows, icon: Pause, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Executions Today', value: '—', icon: Activity, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ];

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3 text-gray-400">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        Loading workflows...
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-1">Automations</h2>
          <p className="text-gray-400 text-xs sm:text-sm">Manage your organization's automation workflows.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={() => setShowTemplates(true)}
            className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-semibold px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl transition-colors flex items-center gap-2 text-xs sm:text-sm flex-1 sm:flex-initial justify-center"
          >
            <Zap size={15} className="text-amber-400" />
            Templates
          </button>
          <button
            onClick={() => setShowAiWizard(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl transition-all shadow-lg flex items-center gap-2 text-xs sm:text-sm flex-1 sm:flex-initial justify-center"
          >
            <Sparkles size={15} />
            Generate with AI
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-semibold px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl transition-all shadow-lg flex items-center gap-2 text-xs sm:text-sm w-full sm:w-auto justify-center"
          >
            <Plus size={16} />
            New Workflow
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 sm:p-5 hover:border-gray-700 transition-colors">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <span className="text-xs sm:text-sm text-gray-400">{stat.label}</span>
                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <Icon size={16} className={stat.color} />
                </div>
              </div>
              <span className="text-2xl sm:text-3xl font-bold">{stat.value}</span>
            </div>
          );
        })}
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search workflows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-1 sm:gap-2 bg-gray-900 border border-gray-800 rounded-xl p-1 sm:p-1.5 self-start sm:self-auto">
          {(['all', 'active', 'inactive'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium capitalize transition-colors ${
                filterStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Workflow List */}
      {filteredWorkflows.length === 0 ? (
        <div className="bg-gray-900/40 border border-gray-800 border-dashed rounded-2xl p-8 sm:p-16 text-center">
          <Zap size={40} className="mx-auto text-gray-700 mb-4 sm:w-12 sm:h-12" />
          <h3 className="text-lg sm:text-xl font-semibold mb-2">
            {searchQuery ? 'No workflows match your search' : 'No workflows yet'}
          </h3>
          <p className="text-gray-400 mb-6 text-xs sm:text-sm">
            {searchQuery ? 'Try a different search term.' : 'Create your first automation to get started.'}
          </p>
          {!searchQuery && (
            <button onClick={() => setShowTemplates(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-5 sm:px-6 py-2 sm:py-2.5 rounded-xl text-sm font-medium transition-colors">
              Browse Templates
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredWorkflows.map(wf => (
            <div key={wf.id} className="group bg-gray-900/60 border border-gray-800 hover:border-gray-600 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  wf.isActive
                    ? 'bg-emerald-500/10 border border-emerald-500/20'
                    : 'bg-gray-800 border border-gray-700'
                }`}>
                  {wf.isActive
                    ? <Play size={17} className="text-emerald-400" />
                    : <Pause size={17} className="text-gray-500" />
                  }
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-white text-sm sm:text-base truncate">{wf.name}</h4>
                    <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full border font-medium ${
                      wf.isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-gray-700 text-gray-400 border-gray-600'
                    }`}>
                      {wf.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">
                    Updated {new Date(wf.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {wf.engine === 'native' ? (
                      <span className="ml-2 text-emerald-500/70">· Native</span>
                    ) : (
                      wf.n8nWorkflowId && <span className="ml-2 text-blue-500/70">· Synced with n8n</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                  onClick={() => openInN8n(wf)}
                  className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-sm px-3.5 py-2 rounded-lg transition-colors border border-gray-700 text-gray-300"
                  title="Open and edit in n8n web interface"
                >
                  <ExternalLink size={13} />
                  Edit in n8n
                </button>
                <button
                  onClick={() => handleDelete(wf.id)}
                  className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 p-7 rounded-2xl w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-5">Create New Workflow</h3>
            <form onSubmit={handleCreate}>
              <div className="mb-5">
                <label className="block text-sm font-medium mb-2 text-gray-300">Workflow Name</label>
                <input
                  type="text"
                  value={newWorkflowName}
                  onChange={(e) => setNewWorkflowName(e.target.value)}
                  required
                  autoFocus
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder="e.g. Lead Onboarding Automation"
                />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-medium mb-2 text-gray-300">Workflow Engine</label>
                <select
                  value={newWorkflowEngine}
                  onChange={(e) => setNewWorkflowEngine(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                >
                  <option value="native">Native Builder (Recommended)</option>
                  <option value="n8n">n8n Engine (requires self-hosted n8n)</option>
                </select>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 text-gray-400 hover:text-white rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-medium transition-colors">
                  Create Workflow
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Templates Modal */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 p-7 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-5 shrink-0">
              <h3 className="text-xl font-bold">Workflow Templates</h3>
              <button onClick={() => setShowTemplates(false)} className="text-gray-500 hover:text-white transition-colors">✕</button>
            </div>
            <div className="overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
              {TEMPLATES.map(tmpl => (
                <button
                  key={tmpl.id}
                  onClick={() => handleCreateFromTemplate(tmpl.name)}
                  className="text-left bg-gray-950 hover:bg-gray-800 border border-gray-800 hover:border-gray-600 rounded-xl p-4 transition-all"
                >
                  <div className="text-2xl mb-2">{tmpl.icon}</div>
                  <h4 className="font-semibold text-white mb-1">{tmpl.name}</h4>
                  <p className="text-xs text-gray-400 mb-3">{tmpl.description}</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {tmpl.tags.map(tag => (
                      <span key={tag} className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <AiWorkflowWizard 
        isOpen={showAiWizard} 
        onClose={() => setShowAiWizard(false)} 
        onSuccess={fetchWorkflows} 
      />
    </div>
  );
}
