'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Shield,
  UserCheck,
  UserX,
  Users,
  ChevronDown,
  Mail,
  Building,
  Clock,
} from 'lucide-react';
import { EnterpriseLoading, EnterpriseEmptyState } from '@/components/enterprise';

/* ═══════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════ */

interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  company: string | null;
  designation: string | null;
  role: string;
  isActive: boolean;
  hasPassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const ROLE_OPTIONS = ['admin', 'operator', 'user', 'viewer'] as const;

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  operator: 'Operator',
  user: 'Standard User',
  viewer: 'Viewer',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-500/15 text-red-400 border-red-500/30',
  operator: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  user: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  viewer: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
};

/* ═══════════════════════════════════════════════════════════════════════
   Users Screen Component
   ═══════════════════════════════════════════════════════════════════════ */

export default function UsersScreen() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error(`Failed to fetch users (${res.status})`);
      const json = await res.json();
      setUsers(json.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdating(userId);
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, role: newRole }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update role');
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setUpdating(null);
    }
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    setUpdating(userId);
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, isActive: !isActive }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update status');
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isActive: !isActive } : u))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setUpdating(null);
    }
  };

  /* ── Render ── */

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-[oklch(0.22_0.005_260)] px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2.5">
              <Users className="w-5 h-5 text-primary" />
              User Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage user roles and activation status
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            {users.length} user{users.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading && !users.length && (
          <EnterpriseLoading message="Loading users..." size="sm" />
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        {!loading && users.length === 0 && (
          <EnterpriseEmptyState
            icon={Users}
            title="No users found"
            description="No user accounts have been created yet. Users will appear here once they are invited."
          />
        )}

        {users.length > 0 && (
          <div className="space-y-2">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_120px_120px_140px_80px] gap-3 px-4 py-2 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
              <span>User</span>
              <span>Role</span>
              <span>Status</span>
              <span>Last Login</span>
              <span className="text-right">Actions</span>
            </div>

            {/* User Rows */}
            {users.map((user) => (
              <div
                key={user.id}
                className={`grid grid-cols-[1fr_120px_120px_140px_80px] gap-3 items-center px-4 py-3 rounded-lg border transition-colors ${
                  user.isActive
                    ? 'bg-[oklch(0.14_0.005_260)] border-[oklch(0.22_0.005_260)]'
                    : 'bg-[oklch(0.12_0.005_260)] border-[oklch(0.18_0.005_260)] opacity-60'
                }`}
              >
                {/* User Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-primary">
                      {user.email.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {user.name || user.email}
                    </div>
                    <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {user.email}
                    </div>
                    {user.company && (
                      <div className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                        <Building className="w-3 h-3" />
                        {user.company}
                      </div>
                    )}
                  </div>
                </div>

                {/* Role Selector */}
                <div className="relative">
                  {updating === user.id ? (
                    <div className="text-xs text-muted-foreground animate-pulse">Updating...</div>
                  ) : (
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className="w-full text-xs px-2 py-2.5 rounded-md border border-[oklch(0.22_0.005_260)] bg-[oklch(0.11_0.01_260)] text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Status Badge */}
                <div>
                  <span
                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${
                      user.isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}
                  >
                    {user.isActive ? (
                      <UserCheck className="w-3 h-3" />
                    ) : (
                      <UserX className="w-3 h-3" />
                    )}
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Last Login */}
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleDateString()
                    : 'Never'}
                </div>

                {/* Toggle Active */}
                <div className="flex justify-end">
                  {updating === user.id ? null : (
                    <button
                      onClick={() => handleToggleActive(user.id, user.isActive)}
                      className={`text-xs px-2 py-2.5 rounded-md border transition-colors ${
                        user.isActive
                          ? 'border-red-500/20 text-red-400 hover:bg-red-500/10'
                          : 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10'
                      }`}
                    >
                      {user.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
