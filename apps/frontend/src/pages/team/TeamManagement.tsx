import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';
import { Users, UserPlus, Trash2, ShieldCheck } from 'lucide-react';

interface Member {
  id: string;
  userId: string;
  organizationId: string;
  role: { id: string; name: string };
  user: { id: string; email: string; firstName: string; lastName: string };
}

interface Organization {
  id: string;
  name: string;
  members: Member[];
}

export default function TeamManagement() {
  const { user } = useAuthStore();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviting, setInviting] = useState(false);

  const activeOrgId = user?.activeOrganizationId;

  useEffect(() => {
    if (activeOrgId) {
      fetchOrg();
    } else {
      setLoading(false);
    }
  }, [activeOrgId]);

  const fetchOrg = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/orgs/${activeOrgId}`);
      if (res.data.success) setOrganization(res.data.data);
    } catch (error) {
      console.error('Failed to fetch org', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrgId) return;
    try {
      setInviting(true);
      await api.post(`/orgs/${activeOrgId}/invite`, { email: inviteEmail, role: inviteRole });
      alert(`Invitation sent to ${inviteEmail} successfully!`);
      setInviteEmail('');
      fetchOrg();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    if (!activeOrgId) return;
    try {
      await api.put(`/orgs/${activeOrgId}/members/${memberId}/role`, { role: newRole });
      fetchOrg();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to change role');
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!activeOrgId) return;
    if (!confirm('Are you sure you want to remove this member?')) return;
    try {
      await api.delete(`/orgs/${activeOrgId}/members/${memberId}`);
      fetchOrg();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to remove member');
    }
  };

  const getRoleBadgeClass = (roleName: string) => {
    switch (roleName) {
      case 'OWNER': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'ADMIN': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'MANAGER': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3 text-gray-400">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        Loading team data...
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-4">Team Management</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <Users size={48} className="mx-auto text-gray-700 mb-4" />
          <p className="text-gray-400">You are not currently part of an active organization.</p>
          <p className="text-gray-500 text-sm mt-2">Switch your active organization from the header dropdown.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-5xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold mb-1">Team Management</h2>
        <p className="text-gray-400">
          Managing <span className="text-white font-medium">{organization.name}</span> — {organization.members.length} member{organization.members.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Invite Form */}
      <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <UserPlus size={20} className="text-blue-400" />
          Invite Member
        </h3>
        <form onSubmit={handleInvite} className="flex gap-4 items-end flex-wrap">
          <div className="flex-1 min-w-48">
            <label className="block text-sm font-medium mb-1.5 text-gray-300">Email Address</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="colleague@company.com"
            />
          </div>
          <div className="w-44">
            <label className="block text-sm font-medium mb-1.5 text-gray-300">Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            >
              <option value="MEMBER">Member</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={inviting}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
          >
            {inviting ? 'Sending...' : 'Send Invite'}
          </button>
        </form>
      </div>

      {/* Members Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-gray-800 flex items-center gap-2">
          <ShieldCheck size={20} className="text-blue-400" />
          <h3 className="text-lg font-semibold">Active Members</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-800/50 text-gray-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 font-medium">Member</th>
                <th className="px-6 py-3 font-medium">Email</th>
                <th className="px-6 py-3 font-medium">Role</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {organization.members.map((member) => (
                <tr key={member.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
                        {member.user.firstName?.[0] || member.user.email[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-white">
                        {member.user.firstName} {member.user.lastName}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm">
                    {member.user.email}
                  </td>
                  <td className="px-6 py-4">
                    {member.role.name === 'OWNER' ? (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getRoleBadgeClass(member.role.name)}`}>
                        Owner
                      </span>
                    ) : (
                      <select
                        value={member.role.name}
                        onChange={(e) => handleChangeRole(member.user.id, e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                        disabled={user?.id === member.user.id}
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="MANAGER">Manager</option>
                        <option value="MEMBER">Member</option>
                      </select>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {member.role.name !== 'OWNER' && user?.id !== member.user.id && (
                      <button
                        onClick={() => handleRemove(member.user.id)}
                        className="inline-flex items-center gap-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 px-3 py-1.5 rounded-lg text-sm transition-colors"
                      >
                        <Trash2 size={14} />
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
