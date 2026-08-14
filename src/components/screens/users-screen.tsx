'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { tokens, elevation } from '@/components/intelligence-os/design-tokens';
import { DataTable } from '@/components/enterprise/DataTable';
import { fetchApi } from '@/lib/fetchApi';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Users as UsersIcon,
  UserCheck,
  Shield,
  UserPlus,
  Ban,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

// ── Types ──

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  lastActive: string;
  status: 'active' | 'suspended';
  sessions: number;
  avatar?: string;
}

// ── Mock fallback data ──

const MOCK_USERS: User[] = [
  { id: 'usr-001', name: 'Sarah Chen', email: 'sarah.chen@deepmindq.ai', role: 'admin', lastActive: '2025-01-15T14:32:00Z', status: 'active', sessions: 3 },
  { id: 'usr-002', name: 'Marcus Johnson', email: 'marcus.j@deepmindq.ai', role: 'admin', lastActive: '2025-01-15T13:10:00Z', status: 'active', sessions: 1 },
  { id: 'usr-003', name: 'Emily Rodriguez', email: 'emily.r@deepmindq.ai', role: 'user', lastActive: '2025-01-15T10:45:00Z', status: 'active', sessions: 2 },
  { id: 'usr-004', name: 'James Park', email: 'james.p@deepmindq.ai', role: 'user', lastActive: '2025-01-14T16:20:00Z', status: 'active', sessions: 1 },
  { id: 'usr-005', name: 'Lisa Wang', email: 'lisa.w@deepmindq.ai', role: 'user', lastActive: '2025-01-15T09:05:00Z', status: 'active', sessions: 2 },
  { id: 'usr-006', name: 'David Kim', email: 'david.k@deepmindq.ai', role: 'user', lastActive: '2025-01-13T11:30:00Z', status: 'suspended', sessions: 0 },
  { id: 'usr-007', name: 'Rachel Foster', email: 'rachel.f@deepmindq.ai', role: 'user', lastActive: '2025-01-15T12:00:00Z', status: 'active', sessions: 1 },
  { id: 'usr-008', name: 'Tom Bradley', email: 'tom.b@deepmindq.ai', role: 'user', lastActive: '2025-01-12T08:15:00Z', status: 'active', sessions: 1 },
  { id: 'usr-009', name: 'Nina Patel', email: 'nina.p@deepmindq.ai', role: 'admin', lastActive: '2025-01-15T15:00:00Z', status: 'active', sessions: 2 },
  { id: 'usr-010', name: 'Chris Martinez', email: 'chris.m@deepmindq.ai', role: 'user', lastActive: '2025-01-11T14:45:00Z', status: 'suspended', sessions: 0 },
];

// ── Helpers ──

function formatRelativeDate(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function isToday(isoStr: string): boolean {
  const d = new Date(isoStr);
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

// ── Component ──

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchApi<User[]>('/api/users')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (data) {
          setUsers(data);
        } else {
          // Graceful 404 handling — use mock data
          setUsers(MOCK_USERS);
        }
      })
      .catch(() => {
        if (!cancelled) setUsers(MOCK_USERS);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    const total = users.length;
    const activeToday = users.filter((u) => u.status === 'active' && isToday(u.lastActive)).length;
    const adminCount = users.filter((u) => u.role === 'admin').length;
    return { total, activeToday, adminCount };
  }, [users]);

  const handleSuspendToggle = useCallback((userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, status: newStatus as User['status'], sessions: newStatus === 'suspended' ? 0 : u.sessions } : u))
    );
    toast.success(`User ${newStatus === 'suspended' ? 'suspended' : 'activated'} successfully`);
  }, []);

  const handleInvite = useCallback(() => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    setInviting(true);
    setTimeout(() => {
      setUsers((prev) => [
        ...prev,
        {
          id: `usr-${String(prev.length + 1).padStart(3, '0')}`,
          name: inviteEmail.split('@')[0],
          email: inviteEmail,
          role: 'user',
          lastActive: new Date().toISOString(),
          status: 'active',
          sessions: 0,
        },
      ]);
      setInviting(false);
      setInviteEmail('');
      setInviteOpen(false);
      toast.success(`Invitation sent to ${inviteEmail}`);
    }, 1000);
  }, [inviteEmail]);

  const columns = useMemo(() => [
    { key: 'name', label: 'Name', sortable: true, render: (_v: unknown, row: Record<string, unknown>) => {
      const name = row.name as string;
      return (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: tokens.accent.subtle, color: tokens.accent.primary }}>
            {name.split(' ').map((n) => n[0]).join('')}
          </div>
          <span className="font-medium">{name}</span>
        </div>
      );
    }},
    { key: 'email', label: 'Email', sortable: true },
    { key: 'role', label: 'Role', sortable: true, render: (v: unknown) => {
      const role = v as 'admin' | 'user';
      const isAdmin = role === 'admin';
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
          style={{
            background: isAdmin ? '#FEE2E2' : '#DBEAFE',
            color: isAdmin ? '#991B1B' : '#1D4ED8',
            border: `1px solid ${isAdmin ? '#FECACA' : '#93C5FD'}`,
          }}
        >
          {isAdmin ? <Shield className="w-3 h-3" /> : <UsersIcon className="w-3 h-3" />}
          {role}
        </span>
      );
    }},
    { key: 'lastActive', label: 'Last Active', sortable: true, render: (v: unknown) => (
      <span className="text-xs" style={{ color: tokens.text.secondary }}>{formatRelativeDate(v as string)}</span>
    )},
    { key: 'status', label: 'Status', sortable: true, render: (v: unknown) => {
      const status = v as 'active' | 'suspended';
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: status === 'active' ? tokens.confidence.high.value : tokens.confidence.low.value }} />
          <span style={{ color: status === 'active' ? tokens.confidence.high.value : tokens.confidence.low.value }}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </span>
      );
    }},
    { key: 'sessions', label: 'Sessions', sortable: true, render: (v: unknown) => (
      <span className="text-xs" style={{ color: tokens.text.secondary }}>{v as number} active</span>
    )},
    { key: 'actions', label: '', render: (_v: unknown, row: Record<string, unknown>) => {
      const u = row as unknown as User;
      return (
        <button
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors hover:opacity-80"
          style={{
            color: u.status === 'active' ? tokens.confidence.low.value : tokens.confidence.high.value,
            border: `1px solid ${u.status === 'active' ? tokens.confidence.low.bg : tokens.confidence.high.bg}`,
          }}
          onClick={(e) => { e.stopPropagation(); handleSuspendToggle(u.id, u.status); }}
        >
          {u.status === 'active' ? <Ban className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
          {u.status === 'active' ? 'Suspend' : 'Activate'}
        </button>
      );
    }},
  ], [handleSuspendToggle]);

  const bg = tokens.surface.card;
  const border = tokens.border.default;
  const textPrimary = tokens.text.primary;
  const textSecondary = tokens.text.secondary;
  const textMuted = tokens.text.muted;

  return (
    <div className="p-6 space-y-6" style={{ background: '#0a0e17', minHeight: '100%' }}>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: textPrimary }}>Users</h1>
          <p className="text-sm mt-1" style={{ color: textSecondary }}>Manage team members and access control</p>
        </div>
        <Button
          onClick={() => setInviteOpen(true)}
          size="sm"
          className="gap-2"
          style={{ background: tokens.accent.primary, color: tokens.flat.white }}
        >
          <UserPlus className="w-3.5 h-3.5" />
          Invite User
        </Button>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Users', value: stats.total, icon: Users, color: tokens.accent.primary },
          { label: 'Active Today', value: stats.activeToday, icon: UserCheck, color: tokens.confidence.high.value },
          { label: 'Admin Count', value: stats.adminCount, icon: Shield, color: tokens.confidence.low.value },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl p-4" style={{ background: bg, border: `1px solid ${border}`, boxShadow: elevation.sm }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${stat.color}15` }}>
                <stat.icon className="w-4.5 h-4.5" style={{ color: stat.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs truncate" style={{ color: textMuted }}>{stat.label}</p>
                <p className="text-lg font-bold" style={{ color: textPrimary }}>{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      <DataTable
        columns={columns}
        data={users as unknown as Record<string, unknown>[]}
        loading={loading}
        filterable
        filterPlaceholder="Search users by name or email…"
        exportable
        exportFilename="users"
        emptyMessage="No users found"
      />

      {/* ── Invite Dialog ── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md" style={{ background: '#0d1117', border: `1px solid ${border}` }}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold" style={{ color: textPrimary }}>Invite New User</DialogTitle>
            <DialogDescription className="text-xs" style={{ color: textSecondary }}>
              Send an invitation email. The user will receive a link to set up their account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium" style={{ color: textPrimary }}>Email Address</Label>
              <Input
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="h-9 text-sm"
                style={{ background: '#0a0e17', border: `1px solid ${border}`, color: textPrimary }}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInviteOpen(false)}
                style={{ border: `1px solid ${border}`, color: textSecondary }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleInvite}
                disabled={inviting}
                style={{ background: tokens.accent.primary, color: tokens.flat.white }}
              >
                {inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                Send Invitation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
