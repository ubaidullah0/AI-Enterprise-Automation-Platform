import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import {
  Activity, Users, Zap, MessageSquare,
  ArrowRight, Sparkles, TrendingUp,
  CheckCircle2, AlertTriangle, ChevronRight,
  BarChart3, Clock, Shield
} from 'lucide-react';
import { motion } from 'framer-motion';

interface DashboardStats {
  workflows: number;
  activeWorkflows: number;
  conversations: number;
  members: number;
}

interface HealthItem {
  status: boolean;
  note?: string;
}

interface PlatformHealth {
  backend: HealthItem;
  postgres: HealthItem;
  redis: HealthItem;
  minio: HealthItem;
  n8n: HealthItem;
  openai: HealthItem;
  ollama: HealthItem;
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats>({ workflows: 0, activeWorkflows: 0, conversations: 0, members: 0 });
  const [platformHealth, setPlatformHealth] = useState<PlatformHealth | null>(null);
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
      const [wfRes, convRes, orgRes, healthRes] = await Promise.allSettled([
        api.get('/workflows'),
        api.get('/ai/conversations'),
        api.get(`/orgs/${user?.activeOrganizationId}`),
        api.get('/analytics/health')
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

      if (healthRes.status === 'fulfilled' && healthRes.value.data.success) {
        setPlatformHealth(healthRes.value.data.data);
      } else {
        setPlatformHealth({
          backend: { status: true, note: 'Running' },
          postgres: { status: false, note: 'Unknown' },
          redis: { status: false, note: 'Unknown' },
          minio: { status: false, note: 'Unknown' },
          n8n: { status: false, note: 'Unknown' },
          openai: { status: false, note: 'Unknown' },
          ollama: { status: false, note: 'Unknown' },
        });
      }
    } catch {
      // Silently fail — UI shows loading state
    } finally {
      setLoadingStats(false);
    }
  };

  const timeOfDay = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const statCards = [
    {
      label: 'Total Workflows',
      value: stats.workflows,
      subLabel: `${stats.activeWorkflows} active`,
      icon: Zap,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      glow: 'shadow-blue-500/10',
      href: '/workflows'
    },
    {
      label: 'AI Conversations',
      value: stats.conversations,
      subLabel: 'Total sessions',
      icon: MessageSquare,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/20',
      glow: 'shadow-violet-500/10',
      href: '/assistant'
    },
    {
      label: 'Team Members',
      value: stats.members,
      subLabel: 'In this organization',
      icon: Users,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      glow: 'shadow-emerald-500/10',
      href: '/team'
    },
    {
      label: 'Active Automations',
      value: stats.activeWorkflows,
      subLabel: `of ${stats.workflows} workflows`,
      icon: Activity,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      glow: 'shadow-amber-500/10',
      href: '/workflows'
    },
  ];

  const quickActions = [
    {
      label: 'Ask AI Assistant',
      desc: 'Chat with GPT-4o, Gemini, or Ollama — your enterprise AI copilot',
      href: '/assistant',
      icon: Sparkles,
      gradient: 'from-blue-600 to-violet-600',
      iconBg: 'bg-gradient-to-br from-blue-600 to-violet-600',
    },
    {
      label: 'Create Workflow',
      desc: 'Automate with native builder or integrate with n8n',
      href: '/workflows',
      icon: Zap,
      gradient: 'from-emerald-600 to-teal-600',
      iconBg: 'bg-gradient-to-br from-emerald-600 to-teal-600',
    },
    {
      label: 'View Analytics',
      desc: 'Monitor AI usage, costs, and workflow performance',
      href: '/analytics',
      icon: BarChart3,
      gradient: 'from-orange-600 to-amber-600',
      iconBg: 'bg-gradient-to-br from-orange-600 to-amber-600',
    },
    {
      label: 'Team & Security',
      desc: 'Manage members, roles, audit logs, and API keys',
      href: '/settings',
      icon: Shield,
      gradient: 'from-rose-600 to-pink-600',
      iconBg: 'bg-gradient-to-br from-rose-600 to-pink-600',
    },
  ];

  const healthItems = platformHealth ? [
    { label: 'Backend API', status: platformHealth.backend?.status, note: platformHealth.backend?.note },
    { label: 'PostgreSQL', status: platformHealth.postgres?.status, note: platformHealth.postgres?.note },
    { label: 'Redis', status: platformHealth.redis?.status, note: platformHealth.redis?.note },
    { label: 'MinIO Storage', status: platformHealth.minio?.status, note: platformHealth.minio?.note },
    { label: 'n8n Engine', status: platformHealth.n8n?.status, note: platformHealth.n8n?.note },
    { label: 'OpenAI', status: platformHealth.openai?.status, note: platformHealth.openai?.note },
    { label: 'Ollama (Local AI)', status: platformHealth.ollama?.status, note: platformHealth.ollama?.note },
  ] : [];

  const onlineCount = healthItems.filter(i => i.status).length;

  const gettingStarted = [
    { step: '1', text: 'Create your first automation workflow', done: stats.workflows > 0, href: '/workflows', icon: Zap },
    { step: '2', text: 'Start a conversation with AI Assistant', done: stats.conversations > 0, href: '/assistant', icon: Sparkles },
    { step: '3', text: 'Invite a team member to collaborate', done: stats.members > 1, href: '/team', icon: Users },
    { step: '4', text: 'Configure AI provider API keys', done: false, href: '/settings', icon: Shield },
  ];

  return (
    <div className="space-y-7 max-w-7xl mx-auto">

      {/* ── Hero Header ─────────────────────────────────────────────────── */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-gray-900 border border-gray-800"
      >
        {/* Background gradient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-10 -right-10 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-56 h-56 bg-violet-600/8 rounded-full blur-3xl" />
        </div>
        <div className="relative px-8 py-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-blue-400 mb-1 flex items-center gap-1.5">
                <Clock size={13} />
                {timeOfDay()}
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                {user?.firstName ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}` : user?.email?.split('@')[0]} 👋
              </h1>
              <p className="text-gray-400 text-sm leading-relaxed">
                You're working in{' '}
                <span className="text-white font-semibold">{orgName || 'your organization'}</span>.
                {' '}Here's your workspace at a glance.
              </p>
            </div>
            {platformHealth && (
              <div className={`hidden sm:flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border ${
                onlineCount >= 4 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                onlineCount >= 2 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                'bg-red-500/10 border-red-500/20 text-red-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                  onlineCount >= 4 ? 'bg-emerald-400' : onlineCount >= 2 ? 'bg-amber-400' : 'bg-red-400'
                }`} />
                {onlineCount}/{healthItems.length} Services Online
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Stats Grid ──────────────────────────────────────────────────── */}
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        transition={{ staggerChildren: 0.1, delayChildren: 0.2 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.div 
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 * idx }}
            >
              <Link
                to={card.href}
                className={`block group relative bg-gray-900/70 border ${card.border} hover:border-gray-600 rounded-2xl p-5 transition-all duration-200 hover:shadow-lg ${card.glow} overflow-hidden h-full`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${card.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-10 h-10 rounded-xl ${card.bg} border ${card.border} flex items-center justify-center`}>
                      <Icon size={18} className={card.color} />
                    </div>
                    <ChevronRight size={14} className="text-gray-700 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <p className={`text-3xl font-bold mb-1 transition-colors ${loadingStats ? 'text-gray-700' : 'text-white'}`}>
                    {loadingStats ? '—' : card.value.toLocaleString()}
                  </p>
                  <p className="text-gray-400 text-sm font-medium">{card.label}</p>
                  <p className="text-gray-600 text-xs mt-0.5">{card.subLabel}</p>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>

      {/* ── Main Content Row ─────────────────────────────────────────────── */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >

        {/* Quick Actions — 2/3 width */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {quickActions.map(action => {
              const Icon = action.icon;
              return (
                <Link
                  to={action.href}
                  key={action.label}
                  className="group flex items-start gap-4 bg-gray-900/70 border border-gray-800 hover:border-gray-600 rounded-2xl p-5 transition-all duration-200 hover:shadow-lg hover:shadow-black/20"
                >
                  <div className={`w-11 h-11 rounded-xl ${action.iconBg} flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                    <Icon size={20} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-white text-sm group-hover:text-blue-300 transition-colors truncate">{action.label}</h3>
                      <ArrowRight size={14} className="text-gray-700 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{action.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Getting Started Checklist */}
          <div className="bg-gray-900/70 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                <TrendingUp size={15} className="text-blue-400" />
                Getting Started
              </h3>
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                {gettingStarted.filter(i => i.done).length}/{gettingStarted.length} complete
              </span>
            </div>
            <div className="p-2">
              {gettingStarted.map(item => {
                const Icon = item.icon;
                return (
                  <Link
                    to={item.href}
                    key={item.step}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                      item.done ? 'opacity-60' : 'hover:bg-gray-800/60'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      item.done
                        ? 'bg-emerald-500/20 border border-emerald-500/30'
                        : 'bg-gray-800 border border-gray-700'
                    }`}>
                      {item.done
                        ? <CheckCircle2 size={14} className="text-emerald-400" />
                        : <Icon size={13} className="text-gray-500" />
                      }
                    </div>
                    <span className={`text-sm flex-1 ${item.done ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
                      {item.text}
                    </span>
                    {!item.done && (
                      <ChevronRight size={14} className="text-gray-600 shrink-0" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Platform Status — 1/3 width */}
        <div className="bg-gray-900/70 border border-gray-800 rounded-2xl overflow-hidden h-fit">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <Activity size={15} className="text-blue-400" />
              Platform Status
            </h3>
            {platformHealth && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                onlineCount >= 4 ? 'bg-emerald-500/15 text-emerald-400' :
                onlineCount >= 2 ? 'bg-amber-500/15 text-amber-400' :
                'bg-red-500/15 text-red-400'
              }`}>
                {onlineCount >= 4 ? 'Healthy' : onlineCount >= 2 ? 'Degraded' : 'Issues'}
              </span>
            )}
          </div>

          <div className="p-3">
            {platformHealth === null ? (
              <div className="py-8 flex flex-col items-center gap-2 text-gray-600">
                <div className="w-5 h-5 border-2 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-xs">Checking services...</span>
              </div>
            ) : (
              <div className="space-y-1">
                {healthItems.map(item => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        item.status ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-gray-600'
                      }`} />
                      <span className="text-sm text-gray-300">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {item.status
                        ? <CheckCircle2 size={12} className="text-emerald-400" />
                        : <AlertTriangle size={12} className="text-gray-600" />
                      }
                      <span className={`text-xs font-medium ${
                        item.status ? 'text-emerald-400' : 'text-gray-600'
                      }`}>
                        {item.note || (item.status ? 'Online' : 'Offline')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer link */}
          <div className="px-5 py-3 border-t border-gray-800">
            <Link
              to="/settings"
              className="flex items-center justify-between text-xs text-gray-500 hover:text-gray-300 transition-colors group"
            >
              <span>View all settings</span>
              <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
