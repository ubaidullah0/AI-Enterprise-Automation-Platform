import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import {
  Activity, Users, Zap, MessageSquare,
  ArrowRight, Sparkles, TrendingUp,
  CheckCircle2, AlertTriangle
} from 'lucide-react';

interface DashboardStats {
  workflows: number;
  activeWorkflows: number;
  conversations: number;
  members: number;
}

interface QuickAction {
  label: string;
  desc: string;
  href: string;
  icon: React.ElementType;
  gradient: string;
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats>({ workflows: 0, activeWorkflows: 0, conversations: 0, members: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const orgName = user?.memberships?.find(m => m.organization.id === user.activeOrganizationId)?.organization.name;

  useEffect(() => {
    if (user?.activeOrganizationId) {
      loadStats();
    } else {
      setLoadingStats(false);
    }
  }, [user?.activeOrganizationId]);

  const loadStats = async () => {
    try {
      setLoadingStats(true);
      const [wfRes, convRes, orgRes] = await Promise.allSettled([
        api.get('/workflows'),
        api.get('/ai/conversations'),
        api.get(`/orgs/${user?.activeOrganizationId}`),
      ]);

      const wfData = wfRes.status === 'fulfilled' && wfRes.value.data.success ? wfRes.value.data.data : [];
      const convData = convRes.status === 'fulfilled' && convRes.value.data.success ? convRes.value.data.data : [];
      const orgData = orgRes.status === 'fulfilled' && orgRes.value.data.success ? orgRes.value.data.data : null;

      setStats({
        workflows: wfData.length,
        activeWorkflows: wfData.filter((w: any) => w.isActive).length,
        conversations: convData.length,
        members: orgData?.members?.length || 0,
      });
    } catch {
    } finally {
      setLoadingStats(false);
    }
  };

  const statCards = [
    { label: 'Workflows', value: stats.workflows, icon: Zap, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', href: '/workflows' },
    { label: 'Active Automations', value: stats.activeWorkflows, icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', href: '/workflows' },
    { label: 'AI Conversations', value: stats.conversations, icon: MessageSquare, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', href: '/assistant' },
    { label: 'Team Members', value: stats.members, icon: Users, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', href: '/team' },
  ];

  const quickActions: QuickAction[] = [
    { label: 'Ask AI Assistant', desc: 'Get help with workflows, code, and business processes', href: '/assistant', icon: Sparkles, gradient: 'from-blue-600 to-violet-600' },
    { label: 'Create Workflow', desc: 'Automate repetitive tasks with n8n integration', href: '/workflows', icon: Zap, gradient: 'from-emerald-600 to-teal-600' },
    { label: 'Invite Team Member', desc: 'Grow your team and assign roles', href: '/team', icon: Users, gradient: 'from-amber-600 to-orange-600' },
    { label: 'View Settings', desc: 'Audit logs, AI usage, and security', href: '/settings', icon: Activity, gradient: 'from-rose-600 to-pink-600' },
  ];

  const timeOfDay = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">

      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-blue-600/10 via-violet-600/5 to-transparent border border-gray-800 rounded-2xl p-8 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <p className="text-blue-400 text-sm font-medium mb-1">{timeOfDay()},</p>
          <h1 className="text-3xl font-bold text-white mb-2">{user?.firstName || user?.email?.split('@')[0]} 👋</h1>
          <p className="text-gray-400">
            You're working in <span className="text-white font-medium">{orgName || 'your organization'}</span>.
            {' '}Here's what's happening today.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => {
          const Icon = card.icon;
          return (
            <Link
              to={card.href}
              key={card.label}
              className="group bg-gray-900/60 border border-gray-800 hover:border-gray-600 rounded-xl p-5 transition-all hover:shadow-lg hover:shadow-blue-500/5"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl ${card.bg} border ${card.border} flex items-center justify-center`}>
                  <Icon size={18} className={card.color} />
                </div>
                <ArrowRight size={14} className="text-gray-700 group-hover:text-gray-400 transition-colors" />
              </div>
              <p className={`text-3xl font-bold ${loadingStats ? 'text-gray-700' : 'text-white'}`}>
                {loadingStats ? '—' : card.value}
              </p>
              <p className="text-gray-400 text-sm mt-1">{card.label}</p>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {quickActions.map(action => {
            const Icon = action.icon;
            return (
              <Link
                to={action.href}
                key={action.label}
                className="group flex items-start gap-4 bg-gray-900/60 border border-gray-800 hover:border-gray-600 rounded-xl p-5 transition-all"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center shrink-0 shadow-lg`}>
                  <Icon size={22} className="text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-white group-hover:text-blue-300 transition-colors">{action.label}</h3>
                    <ArrowRight size={16} className="text-gray-700 group-hover:text-blue-400 transition-colors" />
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5">{action.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Status Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Platform Status */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-400" /> Platform Status
          </h3>
          <div className="space-y-3">
            {[
              { label: 'Backend API', status: true },
              { label: 'Database', status: true },
              { label: 'AI Service (Gemini)', status: true },
              { label: 'n8n Integration', status: false, note: 'Requires n8n running on :5678' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-gray-800/60 last:border-0">
                <span className="text-sm text-gray-300">{item.label}</span>
                <div className="flex items-center gap-1.5">
                  {item.status
                    ? <CheckCircle2 size={14} className="text-emerald-400" />
                    : <AlertTriangle size={14} className="text-amber-400" />
                  }
                  <span className={`text-xs font-medium ${item.status ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {item.status ? 'Operational' : item.note || 'Offline'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Getting Started */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Sparkles size={16} className="text-blue-400" /> Getting Started
          </h3>
          <div className="space-y-3">
            {[
              { step: '1', text: 'Create your first organization workflow', done: stats.workflows > 0, href: '/workflows' },
              { step: '2', text: 'Chat with the AI assistant', done: stats.conversations > 0, href: '/assistant' },
              { step: '3', text: 'Invite a team member', done: stats.members > 1, href: '/team' },
              { step: '4', text: 'Review your security settings', done: false, href: '/settings' },
            ].map(item => (
              <Link to={item.href} key={item.step} className="flex items-center gap-3 hover:bg-gray-800/40 p-2 rounded-lg transition-colors">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  item.done ? 'bg-emerald-500 text-white' : 'bg-gray-800 text-gray-500'
                }`}>
                  {item.done ? '✓' : item.step}
                </div>
                <span className={`text-sm ${item.done ? 'text-gray-500 line-through' : 'text-gray-300'}`}>{item.text}</span>
                {!item.done && <ArrowRight size={12} className="ml-auto text-gray-600" />}
              </Link>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
