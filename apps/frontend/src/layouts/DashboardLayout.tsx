import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  LayoutDashboard, Users, Settings, LogOut, Menu, Zap, Sparkles,
  ChevronDown, Plus, Building2, Check, BarChart2, ShieldCheck, Folder, X,
  Sun, Moon
} from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../lib/api';
import NotificationBell from '../components/NotificationBell';

export default function DashboardLayout() {
  const { isAuthenticated, user, setAuth, logout, accessToken } = useAuthStore();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') !== 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.remove('light-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.add('light-mode');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Refresh user data on mount (fixes legacy accounts with no org)
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      api.get('/auth/me').then((res) => {
        if (res.data.success) {
          setAuth(res.data.data.user, accessToken);
        }
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchOrganization = async (orgId: string) => {
    try {
      await api.put('/auth/active-org', { organizationId: orgId });
      const res = await api.get('/auth/me');
      if (res.data.success && accessToken) {
        setAuth(res.data.data.user, accessToken);
        setOrgDropdownOpen(false);
      }
    } catch (error) {
      console.error('Failed to switch organization', error);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    try {
      setCreatingOrg(true);
      await api.post('/orgs', { name: newOrgName.trim() });
      const res = await api.get('/auth/me');
      if (res.data.success && accessToken) {
        setAuth(res.data.data.user, accessToken);
      }
      setNewOrgName('');
      setShowCreateOrg(false);
      setOrgDropdownOpen(false);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to create organization');
    } finally {
      setCreatingOrg(false);
    }
  };

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const activeOrg = user?.memberships?.find(m => m.organization.id === user.activeOrganizationId);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'AI Assistant', href: '/assistant', icon: Sparkles },
    { name: 'Workflows', href: '/workflows', icon: Zap },
    { name: 'Analytics', href: '/analytics', icon: BarChart2 },
    { name: 'Storage', href: '/documents', icon: Folder },
    { name: 'Team', href: '/team', icon: Users },
    { name: 'Compliance', href: '/audit', icon: ShieldCheck },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex overflow-hidden">

      {/* ── Mobile Sidebar Overlay ────────────────────────────────────────── */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className={`fixed lg:relative inset-y-0 left-0 bg-gray-900 border-r border-gray-800/80 transition-all duration-300 ease-in-out z-30 flex flex-col shrink-0 ${
        sidebarOpen ? 'w-[220px] translate-x-0' : 'w-[64px] -translate-x-full lg:translate-x-0'
      }`}>

        {/* Logo / Brand */}
        <div className="h-14 flex items-center justify-between px-3 border-b border-gray-800/80 shrink-0">
          <div className={`flex items-center gap-2.5 overflow-hidden ${!sidebarOpen && 'lg:hidden'}`}>
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
              <Zap size={14} className="text-white" />
            </div>
            <span className={`text-sm font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent truncate ${!sidebarOpen && 'hidden'}`}>
              AI Platform
            </span>
          </div>
          {/* Mobile close button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors ml-auto"
            title="Close sidebar"
          >
            <X size={17} />
          </button>
          {/* Desktop toggle button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:flex p-1.5 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-gray-300 transition-colors shrink-0 ml-auto"
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <Menu size={17} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navigation.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => { if (window.innerWidth < 1024) setSidebarOpen(false); }}
                title={!sidebarOpen ? item.name : undefined}
                className={`flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-all duration-150 group relative ${
                  active
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20 shadow-sm'
                    : 'text-gray-500 hover:bg-gray-800/70 hover:text-gray-200 border border-transparent'
                }`}
              >
                <Icon
                  size={17}
                  className={`shrink-0 transition-colors ${active ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300'}`}
                />
                <span className={`text-sm font-medium truncate ${sidebarOpen ? 'block' : 'hidden'} lg:${sidebarOpen ? 'block' : 'hidden'} ${active ? 'text-blue-300' : ''}`}>
                  {item.name}
                </span>
                {active && sidebarOpen && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User / Sign-out */}
        <div className="p-2 border-t border-gray-800/80 space-y-1 shrink-0 bg-gray-900">
          <div className={`px-2.5 py-2 mb-1 ${!sidebarOpen && 'hidden'}`}>
            <p className="text-xs font-medium text-gray-300 truncate">
              {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email}
            </p>
            <p className="text-xs text-gray-600 truncate">{user?.email}</p>
          </div>
          <button
            onClick={() => logout()}
            title={!sidebarOpen ? 'Sign Out' : undefined}
            className="flex items-center gap-3 px-2.5 py-2.5 w-full rounded-xl text-gray-500 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 border border-transparent transition-all duration-150"
          >
            <LogOut size={17} className="shrink-0" />
            <span className={`text-sm font-medium ${!sidebarOpen && 'hidden'}`}>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden min-w-0 bg-gray-950">

        {/* Top Header */}
        <header className="h-14 bg-gray-900/80 backdrop-blur-md border-b border-gray-800/80 flex items-center justify-between px-3 sm:px-5 shrink-0 z-10 sticky top-0">
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-gray-200 transition-colors"
            >
              <Menu size={18} />
            </button>

          {/* Org Switcher */}
          <div className="relative">
            <button
              onClick={() => { setOrgDropdownOpen(!orgDropdownOpen); setShowCreateOrg(false); }}
              className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-xl transition-all border ${
                activeOrg
                  ? 'bg-gray-800/80 hover:bg-gray-800 border-gray-700/50 text-gray-200'
                  : 'bg-amber-500/10 hover:bg-amber-500/15 border-amber-500/30 text-amber-400'
              }`}
            >
              <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                activeOrg ? 'bg-gradient-to-br from-blue-500 to-violet-500' : 'bg-amber-500'
              }`}>
                {activeOrg?.organization.name?.[0]?.toUpperCase() || '?'}
              </div>
              <span className="font-medium max-w-[130px] truncate">
                {activeOrg?.organization.name || 'Select Org'}
              </span>
              <ChevronDown size={13} className={`text-gray-400 shrink-0 transition-transform ${orgDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {orgDropdownOpen && (
              <>
                {/* Backdrop */}
                <div className="fixed inset-0 z-40" onClick={() => setOrgDropdownOpen(false)} />
                <div className="absolute top-full left-0 mt-2 w-64 bg-gray-900 border border-gray-700/80 rounded-2xl shadow-2xl z-50 overflow-hidden">
                  {user?.memberships && user.memberships.length > 0 ? (
                    <>
                      <div className="px-4 py-2.5 border-b border-gray-800 flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Organizations</span>
                        <button onClick={() => setOrgDropdownOpen(false)} className="text-gray-600 hover:text-gray-400">
                          <X size={13} />
                        </button>
                      </div>
                      <div className="max-h-52 overflow-y-auto py-1">
                        {user.memberships.map((membership) => (
                          <button
                            key={membership.organization.id}
                            onClick={() => switchOrganization(membership.organization.id)}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between gap-2 ${
                              membership.organization.id === user.activeOrganizationId
                                ? 'bg-blue-600/10 text-blue-300'
                                : 'text-gray-300 hover:bg-gray-800'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                                {membership.organization.name[0]?.toUpperCase()}
                              </div>
                              <span className="truncate">{membership.organization.name}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">{membership.role.name}</span>
                              {membership.organization.id === user.activeOrganizationId && (
                                <Check size={13} className="text-blue-400" />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="px-4 py-6 text-center text-sm text-gray-500">
                      No organizations yet
                    </div>
                  )}

                  {/* Create new org */}
                  <div className="border-t border-gray-800">
                    {!showCreateOrg ? (
                      <button
                        onClick={() => setShowCreateOrg(true)}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-blue-400 hover:bg-gray-800/60 transition-colors"
                      >
                        <Plus size={14} />
                        Create Organization
                      </button>
                    ) : (
                      <form onSubmit={handleCreateOrg} className="p-3 space-y-2">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Organization name"
                          value={newOrgName}
                          onChange={e => setNewOrgName(e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={creatingOrg || !newOrgName.trim()}
                            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
                          >
                            {creatingOrg ? 'Creating...' : 'Create'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShowCreateOrg(false); setNewOrgName(''); }}
                            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs py-2 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Day / Night toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110 border border-gray-700 hover:border-gray-500"
              style={{
                background: isDarkMode
                  ? 'linear-gradient(135deg, #1e1b4b, #312e81)'
                  : 'linear-gradient(135deg, #fef3c7, #fde68a)',
                color: isDarkMode ? '#a5b4fc' : '#d97706',
                boxShadow: isDarkMode ? '0 0 12px rgba(165,180,252,0.2)' : '0 0 12px rgba(251,191,36,0.4)'
              }}
            >
              {isDarkMode
                ? <Moon size={16} />
                : <Sun size={16} />}
            </button>
            <NotificationBell />
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-violet-600 flex items-center justify-center text-xs font-bold shadow-lg shadow-violet-500/20">
                {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="text-sm hidden sm:block leading-tight">
                <p className="font-semibold text-white">{user?.firstName || 'User'}</p>
                <p className="text-gray-500 text-xs">
                  {activeOrg?.role.name || user?.systemRole?.name || 'Member'}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-gray-950">
          {/* Banner when no org is selected */}
          {!user?.activeOrganizationId && (
            <div className="mx-3 sm:mx-6 mt-3 sm:mt-5 bg-amber-500/8 border border-amber-500/25 rounded-xl px-4 sm:px-5 py-3 sm:py-4 flex items-center gap-3">
              <Building2 size={18} className="text-amber-400 shrink-0" />
              <div>
                <p className="text-amber-300 font-semibold text-sm">No organization selected</p>
                <p className="text-gray-400 text-xs mt-0.5">Click the organization button in the header to create or switch to an organization.</p>
              </div>
            </div>
          )}
          <div className="p-3 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
