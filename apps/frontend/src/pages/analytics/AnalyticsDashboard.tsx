import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Download, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export default function AnalyticsDashboard() {
  const { user } = useAuthStore();
  const activeOrg = user?.memberships?.find((m: any) => m.organization.id === user.activeOrganizationId);
  const isPrivileged = activeOrg && ['OWNER', 'ADMIN', 'MANAGER'].includes(activeOrg.role.name);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  const [overview, setOverview] = useState<any>(null);
  const [usageSeries, setUsageSeries] = useState<any[]>([]);
  const [workflowStats, setWorkflowStats] = useState<any>(null);
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [providerBreakdown, setProviderBreakdown] = useState<any[]>([]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ovRes, usRes, wfRes, pbRes] = await Promise.all([
        api.get('/analytics/overview'),
        api.get(`/analytics/ai-usage?days=${days}`),
        api.get('/analytics/workflow-stats'),
        api.get('/analytics/provider-breakdown')
      ]);

      setOverview(ovRes.data.data);
      setUsageSeries(usRes.data.data);
      setWorkflowStats(wfRes.data.data);
      setProviderBreakdown(pbRes.data.data);

      if (isPrivileged) {
        const topRes = await api.get('/analytics/top-users?limit=5');
        setTopUsers(topRes.data.data);
      }
    } catch (err: any) {
      console.error('Analytics Error:', err);
      const errMsg = err.response?.data?.message || err.message || JSON.stringify(err);
      setError(`Error: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.activeOrganizationId) {
      fetchAnalytics();
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, user?.activeOrganizationId]); // re-fetch if active org changes

  const handleExport = async () => {
    try {
      const response = await api.get(`/analytics/export.csv?days=${days}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit_export_${days}_days.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch {
      alert('Failed to export CSV. You must be an OWNER or ADMIN.');
    }
  };

  if (loading && !overview) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-blue-500 w-8 h-8" />
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-xl font-bold text-gray-200">Error Loading Analytics</h3>
        <p className="text-gray-400 mt-2">{error}</p>
        <button onClick={fetchAnalytics} className="mt-4 px-4 py-2 bg-blue-600 rounded-lg flex items-center gap-2 hover:bg-blue-500 transition">
          <RefreshCw size={16} /> Retry
        </button>
      </div>
    );
  }

  const wfData = workflowStats ? [
    { name: 'Completed', value: workflowStats.byStatus.COMPLETED || 0 },
    { name: 'Failed', value: workflowStats.byStatus.FAILED || 0 },
    { name: 'Running', value: workflowStats.byStatus.RUNNING || 0 },
    { name: 'Pending', value: workflowStats.byStatus.PENDING || 0 }
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Analytics Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Overview of AI usage, workflow performance, and costs.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <select 
            value={days} 
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block px-3 py-2"
          >
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>
          <button
            onClick={fetchAnalytics}
            className="p-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          {['OWNER', 'ADMIN'].includes(activeOrg?.role.name || '') && (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition text-sm font-medium border border-gray-700"
            >
              <Download size={16} />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          title="Total Conversations" 
          value={overview.conversations.total.toLocaleString()} 
          subtitle={`${overview.conversations.thisMonth.toLocaleString()} this month`}
        />
        <KPICard 
          title="AI Messages" 
          value={overview.messages.total.toLocaleString()} 
          subtitle={`${overview.messages.thisMonth.toLocaleString()} this month`}
        />
        <KPICard 
          title="Active Workflows" 
          value={overview.workflows.active.toLocaleString()} 
          subtitle={`${overview.workflows.total.toLocaleString()} total created`}
        />
        <KPICard 
          title="Estimated AI Cost" 
          value={`$${overview.estimatedCostUsd.allTime.toFixed(2)}`} 
          subtitle={`$${overview.estimatedCostUsd.thisMonth.toFixed(2)} this month (approx)`}
          highlight
        />
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-gray-200 font-semibold mb-4">AI Message Volume (Last {days} Days)</h3>
          {usageSeries.length === 0 || usageSeries.every(s => s.messages === 0) ? (
            <div className="h-64 flex items-center justify-center text-gray-500">No activity in this period.</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={usageSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickFormatter={(val) => val.split('-').slice(1).join('/')} />
                  <YAxis stroke="#9ca3af" fontSize={12} allowDecimals={false} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#f3f4f6' }}
                    labelStyle={{ color: '#9ca3af' }}
                  />
                  <Line type="monotone" dataKey="messages" name="Messages" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-gray-200 font-semibold mb-4">Workflow Run Status</h3>
          {workflowStats.runsTotal === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-500">No workflow runs yet.</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={wfData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {wfData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#f3f4f6' }} />
                  <Legend wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Details Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Provider Breakdown */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-gray-200 font-semibold mb-4">Provider Breakdown</h3>
          {providerBreakdown.length === 0 ? (
            <div className="text-gray-500 text-sm p-4 text-center">No provider data available.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-400 uppercase bg-gray-800/50 border-b border-gray-700">
                  <tr>
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-4 py-3">Conversations</th>
                    <th className="px-4 py-3">Messages</th>
                    <th className="px-4 py-3">Est. Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {providerBreakdown.map((p) => (
                    <tr key={p.provider} className="hover:bg-gray-800/30">
                      <td className="px-4 py-3 font-medium text-gray-200 capitalize">{p.provider}</td>
                      <td className="px-4 py-3 text-gray-400">{p.conversationCount}</td>
                      <td className="px-4 py-3 text-gray-400">{p.messageCount}</td>
                      <td className="px-4 py-3 text-gray-400">${p.estimatedCostUsd.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top Users - Only visible to privileged roles */}
        {isPrivileged ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-gray-200 font-semibold mb-4">Top Users (By Activity)</h3>
            {topUsers.length === 0 ? (
              <div className="text-gray-500 text-sm p-4 text-center">No user activity yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-400 uppercase bg-gray-800/50 border-b border-gray-700">
                    <tr>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Messages</th>
                      <th className="px-4 py-3">Tokens</th>
                      <th className="px-4 py-3">Last Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {topUsers.map((u) => (
                      <tr key={u.userId} className="hover:bg-gray-800/30">
                        <td className="px-4 py-3">
                          <div className="text-gray-200 font-medium">
                            {u.firstName ? `${u.firstName} ${u.lastName || ''}` : 'User'}
                          </div>
                          <div className="text-gray-500 text-xs">{u.email}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-400">{u.messageCount}</td>
                        <td className="px-4 py-3 text-gray-400">
                          {u.tokenCount > 1000 ? `${(u.tokenCount / 1000).toFixed(1)}k` : u.tokenCount}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleDateString() : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col items-center justify-center text-center">
            <AlertCircle className="w-8 h-8 text-gray-600 mb-2" />
            <h3 className="text-gray-400 font-medium">Detailed User Analytics Restricted</h3>
            <p className="text-gray-500 text-sm mt-1">You must be an Owner, Admin, or Manager to view top user activity.</p>
          </div>
        )}
      </div>

    </div>
  );
}

function KPICard({ title, value, subtitle, highlight = false }: { title: string, value: string | number, subtitle: string, highlight?: boolean }) {
  return (
    <div className={`bg-gray-900 border ${highlight ? 'border-blue-500/30' : 'border-gray-800'} rounded-xl p-5`}>
      <h3 className="text-gray-400 text-sm font-medium">{title}</h3>
      <p className={`text-3xl font-bold mt-2 ${highlight ? 'text-blue-400' : 'text-gray-100'}`}>{value}</p>
      <p className="text-gray-500 text-xs mt-1">{subtitle}</p>
    </div>
  );
}
