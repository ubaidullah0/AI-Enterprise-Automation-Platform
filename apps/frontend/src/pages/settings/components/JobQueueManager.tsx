import React, { useState, useEffect } from 'react';
import api from '../../../lib/api';
import { Play, RotateCcw, AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';

interface Job {
  id: string;
  type: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  attempts: number;
  maxAttempts: number;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export default function JobQueueManager() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/jobs');
      if (res.data.success) {
        setJobs(res.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch jobs', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 10000); // Auto refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const handleRetry = async (id: string) => {
    try {
      const res = await api.post(`/jobs/${id}/retry`);
      if (res.data.success) {
        fetchJobs();
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to retry job');
    }
  };

  const handleTriggerTest = async () => {
    try {
      await api.post('/jobs/test');
      fetchJobs();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to trigger test job');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle2 size={16} className="text-emerald-400" />;
      case 'FAILED': return <XCircle size={16} className="text-red-400" />;
      case 'RUNNING': return <Play size={16} className="text-blue-400" />;
      default: return <Clock size={16} className="text-gray-400" />;
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      case 'FAILED': return 'bg-red-500/10 border-red-500/20 text-red-400';
      case 'RUNNING': return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      default: return 'bg-gray-800 border-gray-700 text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold mb-1">Background Jobs</h3>
          <p className="text-gray-400 text-sm">Monitor and manage asynchronous tasks.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchJobs}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={handleTriggerTest}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Play size={14} />
            Test Job
          </button>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading && jobs.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Loading jobs...</div>
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-3">
              <Clock size={20} className="text-gray-400" />
            </div>
            <h4 className="text-lg font-medium text-white mb-1">No Jobs Found</h4>
            <p className="text-gray-400 text-sm">Background jobs will appear here once enqueued.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-800/50 border-b border-gray-800 text-sm text-gray-400">
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Attempts</th>
                <th className="px-6 py-4 font-medium">Started At</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-800/60">
              {jobs.map((job) => (
                <React.Fragment key={job.id}>
                  <tr className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-200">{job.type}</div>
                      <div className="text-xs text-gray-500 font-mono mt-0.5">{job.id.slice(0, 8)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusBg(job.status)}`}>
                        {getStatusIcon(job.status)}
                        {job.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-300">
                      {job.attempts} / {job.maxAttempts}
                    </td>
                    <td className="px-6 py-4 text-gray-400">
                      {job.startedAt ? new Date(job.startedAt).toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {job.status === 'FAILED' && (
                        <button
                          onClick={() => handleRetry(job.id)}
                          className="p-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                          title="Retry Job"
                        >
                          <RotateCcw size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                  {job.error && (
                    <tr className="bg-red-500/5 border-t-0">
                      <td colSpan={5} className="px-6 py-3">
                        <div className="flex items-start gap-2 text-red-400 text-xs font-mono">
                          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                          <span className="whitespace-pre-wrap">{job.error}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
