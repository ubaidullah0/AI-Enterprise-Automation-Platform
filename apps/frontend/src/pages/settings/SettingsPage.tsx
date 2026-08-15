import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';
import {
  Shield, Zap, FileText, Settings2, Activity,
  CheckCircle2, AlertTriangle, Info, ChevronRight, Building2, Key
} from 'lucide-react';
import ApiKeyManager from './components/ApiKeyManager';
import JobQueueManager from './components/JobQueueManager';

interface UsageData {
  usage: {
    today: { requests: number; limit: number };
    month: { requests: number; limit: number };
    totalConversations: number;
  };
  percentages: { daily: number; monthly: number };
}

interface AuditLog {
  id: string;
  resource: string;
  action: string;
  newData: any;
  oldData: any;
  createdAt: string;
  user: { email: string; firstName: string; lastName: string } | null;
}

const UsageBar = ({ value, max, label, pct }: { value: number; max: number; label: string; pct: number }) => (
  <div className="mb-5">
    <div className="flex justify-between text-sm mb-1.5">
      <span className="text-gray-300">{label}</span>
      <span className={pct >= 90 ? 'text-red-400' : pct >= 70 ? 'text-amber-400' : 'text-gray-400'}>
        {value.toLocaleString()} / {max.toLocaleString()}
      </span>
    </div>
    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${
          pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-blue-500'
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
    <p className="text-xs text-gray-600 mt-1">{pct}% used</p>
  </div>
);

const TAB_ICONS: Record<string, React.ElementType> = {
  organization: Building2,
  'api-keys': Key,
  jobs: Activity,
  usage: Zap,
  audit: Shield,
  security: Settings2,
};

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('organization');
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const activeOrg = user?.memberships?.find(m => m.organization.id === user.activeOrganizationId);

  useEffect(() => {
    if (activeTab === 'usage' && !usageData) fetchUsage();
    if (activeTab === 'audit' && auditLogs.length === 0) fetchAuditLogs();
  }, [activeTab]);

  const fetchUsage = async () => {
    try {
      setLoadingUsage(true);
      const res = await api.get('/ai/usage');
      if (res.data.success) setUsageData(res.data.data);
    } catch {} finally { setLoadingUsage(false); }
  };

  const fetchAuditLogs = async () => {
    try {
      setLoadingAudit(true);
      const res = await api.get('/audit-logs?limit=15');
      if (res.data.success) setAuditLogs(res.data.data.logs);
    } catch {} finally { setLoadingAudit(false); }
  };

  const tabs = [
    { id: 'organization', label: 'Organization' },
    { id: 'api-keys', label: 'API Keys' },
    { id: 'jobs', label: 'Background Jobs' },
    { id: 'usage', label: 'AI Usage' },
    { id: 'audit', label: 'Audit Logs' },
    { id: 'security', label: 'Security' },
  ];

  const actionBadge = (action: string) => {
    const map: Record<string, string> = {
      CREATE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      DELETE: 'bg-red-500/10 text-red-400 border-red-500/20',
      UPDATE_ROLE: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      UPDATE: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    };
    return map[action] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-1">Settings</h2>
        <p className="text-gray-400">Manage your organization preferences and security settings.</p>
      </div>

      <div className="flex gap-8">
        {/* Sidebar Tabs */}
        <div className="w-52 shrink-0">
          <nav className="space-y-1">
            {tabs.map(tab => {
              const Icon = TAB_ICONS[tab.id] || Settings2;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/60 border border-transparent'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                  {activeTab === tab.id && <ChevronRight size={14} className="ml-auto" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-w-0">

          {/* ── Organization Tab ─────────────────────────────────────── */}
          {activeTab === 'organization' && (
            <div className="space-y-6">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-5 flex items-center gap-2">
                  <Building2 size={18} className="text-blue-400" />
                  Organization Details
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</label>
                    <p className="text-white mt-1 font-medium">{activeOrg?.organization.name || '—'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Your Role</label>
                    <p className="text-white mt-1 font-medium">{activeOrg?.role.name || '—'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Organization ID</label>
                    <p className="text-gray-400 font-mono text-sm mt-1">{activeOrg?.organization.id || '—'}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Settings2 size={18} className="text-blue-400" />
                  Account Details
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</label>
                    <p className="text-white mt-1">{user?.email}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</label>
                    <p className="text-white mt-1">{user?.firstName} {user?.lastName}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">System Role</label>
                    <p className="text-white mt-1">{user?.systemRole?.name}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── API Keys Tab ────────────────────────────────────────── */}
          {activeTab === 'api-keys' && <ApiKeyManager />}

          {/* BACKGROUND JOBS TAB */}
          {activeTab === 'jobs' && (
            <JobQueueManager />
          )}

          {/* ── AI Usage Tab ─────────────────────────────────────────── */}
          {activeTab === 'usage' && (
            <div className="space-y-6">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <Zap size={18} className="text-blue-400" />
                  AI Usage & Limits
                </h3>

                {loadingUsage ? (
                  <div className="flex items-center gap-3 text-gray-400">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    Loading usage data...
                  </div>
                ) : usageData ? (
                  <>
                    <UsageBar
                      label="Today's Requests"
                      value={usageData.usage.today.requests}
                      max={usageData.usage.today.limit}
                      pct={usageData.percentages.daily}
                    />
                    <UsageBar
                      label="This Month's Requests"
                      value={usageData.usage.month.requests}
                      max={usageData.usage.month.limit}
                      pct={usageData.percentages.monthly}
                    />
                    <div className="mt-6 pt-5 border-t border-gray-800 grid grid-cols-2 gap-4">
                      <div className="bg-gray-950 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold text-white">{usageData.usage.totalConversations}</p>
                        <p className="text-sm text-gray-400 mt-1">Total Conversations</p>
                      </div>
                      <div className="bg-gray-950 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold text-white">{usageData.usage.month.requests}</p>
                        <p className="text-sm text-gray-400 mt-1">Messages This Month</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Activity size={40} className="mx-auto mb-3 text-gray-700" />
                    <p>No usage data available.</p>
                    <p className="text-sm mt-1">Make sure you have an active organization selected.</p>
                  </div>
                )}
              </div>

              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 flex gap-3">
                <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-300">Usage Limits</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Daily limit: <strong className="text-white">200 requests</strong> per organization.
                    Monthly limit: <strong className="text-white">3,000 requests</strong> per organization.
                    Limits reset automatically.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Audit Logs Tab ───────────────────────────────────────── */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Shield size={18} className="text-blue-400" />
                    Audit Log
                  </h3>
                  <span className="text-xs text-gray-500">Last 15 entries</span>
                </div>

                {loadingAudit ? (
                  <div className="p-8 flex items-center gap-3 text-gray-400">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    Loading audit logs...
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="p-10 text-center">
                    <FileText size={40} className="mx-auto text-gray-700 mb-3" />
                    <p className="text-gray-400">No audit logs yet.</p>
                    <p className="text-sm text-gray-600 mt-1">Actions like creating workflows or inviting members will appear here.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-800/50">
                    {auditLogs.map(log => (
                      <div key={log.id} className="px-6 py-4 hover:bg-gray-800/30 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs px-2 py-0.5 rounded border font-medium ${actionBadge(log.action)}`}>
                                {log.action}
                              </span>
                              <span className="text-sm font-medium text-white">{log.resource}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              By <span className="text-gray-400">{log.user ? `${log.user.firstName} ${log.user.lastName} (${log.user.email})` : 'System'}</span>
                            </p>
                          </div>
                          <span className="text-xs text-gray-600 whitespace-nowrap shrink-0">
                            {new Date(log.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Security Tab ─────────────────────────────────────────── */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-5 flex items-center gap-2">
                  <Shield size={18} className="text-blue-400" />
                  Security Status
                </h3>
                <div className="space-y-4">
                  {[
                    { label: 'JWT Authentication', status: true, note: 'Access tokens expire in 15 minutes' },
                    { label: 'Refresh Token Rotation', status: true, note: '7-day expiry with secure handling' },
                    { label: 'Organization Isolation', status: true, note: 'All resources scoped per tenant' },
                    { label: 'Role-Based Access Control', status: true, note: 'OWNER / ADMIN / MANAGER / MEMBER' },
                    { label: 'AI Rate Limiting', status: true, note: '200 requests/day per organization' },
                    { label: 'Audit Logging', status: true, note: 'All create/update/delete actions logged' },
                    { label: 'HTTPS / TLS', status: false, note: 'Configure in production via reverse proxy' },
                    { label: 'Email Verification', status: false, note: 'SMTP not yet configured' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between p-4 bg-gray-950 rounded-xl border border-gray-800/50">
                      <div>
                        <p className="font-medium text-white text-sm">{item.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{item.note}</p>
                      </div>
                      <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
                        item.status
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-gray-700/50 text-gray-500 border-gray-700'
                      }`}>
                        {item.status
                          ? <><CheckCircle2 size={12} /> Enabled</>
                          : <><Info size={12} /> Not Configured</>
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-5 flex gap-3">
                <Info size={18} className="text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-300">Production Security Checklist</p>
                  <p className="text-sm text-gray-400 mt-1">
                    For production: configure HTTPS via Nginx/Caddy, set up SMTP for email verification,
                    rotate your JWT secrets, and enable database SSL.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
