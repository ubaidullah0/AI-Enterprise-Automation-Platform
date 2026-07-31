import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { LayoutDashboard, Users, Settings, LogOut, Menu, Zap, Sparkles, ChevronDown, Plus, Building2, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../lib/api';
import NotificationBell from '../components/NotificationBell';

export default function DashboardLayout() {
  const { isAuthenticated, user, setAuth, logout, accessToken } = useAuthStore();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);

  // ── Refresh user data on mount (fixes legacy accounts with no org) ──────────
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
      // Refresh user data so new org appears and is set active
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
    { name: 'Team', href: '/team', icon: Users },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex">
      {/* Sidebar */}
      <aside className={`bg-gray-900 border-r border-gray-800 transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'} flex flex-col shrink-0`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-800">
          {sidebarOpen && (
            <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
              AI Platform
            </span>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400">
            <Menu size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-colors ${
                  isActive
                    ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200 border border-transparent'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-blue-400' : 'text-gray-400'} />
                {sidebarOpen && <span className="font-medium">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button
            onClick={() => logout()}
            className="flex items-center space-x-3 px-3 py-2.5 w-full rounded-xl text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors border border-transparent"
          >
            <LogOut size={20} />
            {sidebarOpen && <span className="font-medium">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-gray-900/50 backdrop-blur-md border-b border-gray-800 flex items-center justify-between px-6 shrink-0">

          {/* Org Switcher */}
          <div className="relative">
            <button
              onClick={() => { setOrgDropdownOpen(!orgDropdownOpen); setShowCreateOrg(false); }}
              className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl transition-colors border ${
                activeOrg
                  ? 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-200'
                  : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-400'
              }`}
            >
              <Building2 size={14} />
              <span className="font-medium max-w-[160px] truncate">
                {activeOrg?.organization.name || 'Select Organization'}
              </span>
              <ChevronDown size={14} className="text-gray-400 shrink-0" />
            </button>

            {orgDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                {/* Existing orgs */}
                {user?.memberships && user.memberships.length > 0 ? (
                  <>
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-800">
                      Your Organizations
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {user.memberships.map((membership) => (
                        <button
                          key={membership.organization.id}
                          onClick={() => switchOrganization(membership.organization.id)}
                          className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center justify-between gap-2 ${
                            membership.organization.id === user.activeOrganizationId
                              ? 'bg-blue-600/10 text-blue-400'
                              : 'text-gray-300 hover:bg-gray-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                              {membership.organization.name[0]?.toUpperCase()}
                            </div>
                            <span className="truncate">{membership.organization.name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-gray-500">{membership.role.name}</span>
                            {membership.organization.id === user.activeOrganizationId && (
                              <Check size={12} className="text-blue-400" />
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
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm text-blue-400 hover:bg-gray-800 transition-colors"
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
                          className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium py-2 rounded-lg transition-colors"
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
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-3">
            <NotificationBell />
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-sm font-bold">
                {user?.firstName?.[0] || user?.email[0]?.toUpperCase()}
              </div>
              <div className="text-sm hidden sm:block">
                <p className="font-medium leading-tight">{user?.firstName || 'User'}</p>
                <p className="text-gray-400 text-xs">
                  {activeOrg?.role.name || user?.systemRole?.name || 'Member'}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-8 bg-gray-950">
          {/* Banner when no org is selected */}
          {!user?.activeOrganizationId && (
            <div className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Building2 size={18} className="text-amber-400 shrink-0" />
                <div>
                  <p className="text-amber-300 font-medium text-sm">No organization selected</p>
                  <p className="text-gray-400 text-xs mt-0.5">Click "Select Organization" in the header to create or switch to an organization.</p>
                </div>
              </div>
            </div>
          )}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
