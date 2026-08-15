import { useState, useEffect } from 'react';
import { Search, Download, Calendar, Filter, Eye, X, ShieldCheck } from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

interface AuditLog {
  id: string;
  resource: string;
  action: string;
  oldData: any;
  newData: any;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

export default function AuditComplianceDashboard() {
  const { user } = useAuthStore();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  // Filters
  const [resource, setResource] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const activeMembership = user?.memberships?.find(m => m.organization.id === user.activeOrganizationId);
  const roleName = activeMembership?.role.name;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (resource) query.append('resource', resource);
      if (actionFilter) query.append('action', actionFilter);
      if (dateRange.start) query.append('startDate', new Date(dateRange.start).toISOString());
      if (dateRange.end) {
        const end = new Date(dateRange.end);
        end.setHours(23, 59, 59, 999);
        query.append('endDate', end.toISOString());
      }
      
      const res = await api.get(`/audit-logs?${query.toString()}`);
      setLogs(res.data.data.logs);
      setTotal(res.data.data.pagination.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (roleName === 'ADMIN' || roleName === 'OWNER') {
      fetchLogs();
    }
  }, [page, resource, actionFilter, dateRange, roleName]);

  // If not ADMIN/OWNER, deny access
  if (roleName !== 'ADMIN' && roleName !== 'OWNER') {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
          <ShieldCheck size={24} />
          <div>
            <h3 className="font-bold">Access Denied</h3>
            <p className="text-sm opacity-80">Only Organization Owners and Admins can access the Audit & Compliance Center.</p>
          </div>
        </div>
      </div>
    );
  }

  const handleExport = async () => {
    try {
      const query = new URLSearchParams();
      if (resource) query.append('resource', resource);
      if (actionFilter) query.append('action', actionFilter);
      if (dateRange.start) query.append('startDate', new Date(dateRange.start).toISOString());
      if (dateRange.end) {
        const end = new Date(dateRange.end);
        end.setHours(23, 59, 59, 999);
        query.append('endDate', end.toISOString());
      }
      
      const res = await api.get(`/audit-logs/export?${query.toString()}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'audit_logs.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to export', error);
      alert('Failed to export CSV.');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-[calc(100vh-4rem)] overflow-y-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <ShieldCheck className="text-blue-500" size={32} />
            Audit & Compliance Center
          </h1>
          <p className="text-gray-400 mt-1">Immutable record of critical organization events.</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl transition-colors text-sm font-medium shadow-lg shadow-blue-500/20"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-400 mb-1">Resource</label>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input 
              type="text" 
              placeholder="e.g. WORKFLOW, API_KEY" 
              value={resource}
              onChange={e => setResource(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
          </div>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-400 mb-1">Action</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input 
              type="text" 
              placeholder="e.g. CREATE, DELETE" 
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
          </div>
        </div>
        <div className="flex-1 min-w-[250px] flex gap-2">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-400 mb-1">Start Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input 
                type="date" 
                value={dateRange.start}
                onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-400 mb-1">End Date</label>
            <input 
              type="date" 
              value={dateRange.end}
              onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-950/50 border-b border-gray-800 text-xs uppercase tracking-wider text-gray-400">
                <th className="px-6 py-4 font-semibold">Timestamp</th>
                <th className="px-6 py-4 font-semibold">User</th>
                <th className="px-6 py-4 font-semibold">Resource</th>
                <th className="px-6 py-4 font-semibold">Action</th>
                <th className="px-6 py-4 font-semibold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading records...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <ShieldCheck className="mx-auto h-12 w-12 text-gray-700 mb-3" />
                    <p className="text-lg font-medium text-gray-300">No audit logs found</p>
                    <p className="mt-1">Try adjusting your filters.</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-800/30 transition-colors group">
                    <td className="px-6 py-4 text-gray-400 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      {log.user ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white">
                            {log.user.email.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-gray-300 font-medium">{log.user.email}</span>
                        </div>
                      ) : (
                        <span className="text-gray-500 italic">System</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-md bg-gray-800/50 text-gray-300 border border-gray-700/50 text-xs font-mono">
                        {log.resource}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                        log.action === 'CREATE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        log.action === 'DELETE' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedLog(log)}
                        className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 p-2 rounded-lg transition-colors inline-flex opacity-50 group-hover:opacity-100"
                        title="View payload"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {total > 0 && (
          <div className="px-6 py-4 border-t border-gray-800 bg-gray-950/50 flex items-center justify-between text-sm">
            <span className="text-gray-400">
              Showing <span className="font-medium text-white">{(page - 1) * limit + 1}</span> to <span className="font-medium text-white">{Math.min(page * limit, total)}</span> of <span className="font-medium text-white">{total}</span> results
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-900 text-gray-300 disabled:opacity-50 hover:bg-gray-800 transition-colors"
              >
                Previous
              </button>
              <button 
                onClick={() => setPage(p => p + 1)}
                disabled={page * limit >= total}
                className="px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-900 text-gray-300 disabled:opacity-50 hover:bg-gray-800 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Viewer */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-gray-800 flex items-center justify-between bg-gray-950">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Log Details <span className="text-gray-500 text-sm font-normal">#{selectedLog.id}</span>
              </h3>
              <button onClick={() => setSelectedLog(null)} className="text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 flex flex-col md:flex-row gap-6">
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Old Data</h4>
                <div className="bg-gray-950 border border-gray-800 p-4 rounded-xl font-mono text-xs text-gray-300 whitespace-pre-wrap overflow-x-auto max-h-[500px]">
                  {selectedLog.oldData && Object.keys(selectedLog.oldData).length > 0 
                    ? JSON.stringify(selectedLog.oldData, null, 2) 
                    : <span className="opacity-50 italic">null</span>}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">New Data</h4>
                <div className="bg-gray-950 border border-gray-800 p-4 rounded-xl font-mono text-xs text-emerald-400 whitespace-pre-wrap overflow-x-auto max-h-[500px]">
                  {selectedLog.newData && Object.keys(selectedLog.newData).length > 0
                    ? JSON.stringify(selectedLog.newData, null, 2) 
                    : <span className="opacity-50 italic">null</span>}
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-800 bg-gray-950 flex justify-end">
              <button onClick={() => setSelectedLog(null)} className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm font-medium">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
