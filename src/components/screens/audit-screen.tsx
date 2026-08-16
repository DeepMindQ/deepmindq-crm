'use client';

import { useState, useEffect } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { ScreenSkeleton } from '@/components/ui/screen-skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import {
  Shield,
  AlertTriangle,
  XCircle,
  Download,
  Clock,
  User,
  Globe,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  CircleX,
  Eye,
  Loader2,
  Inbox,
} from 'lucide-react';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'border-red-500/40 bg-red-500/15 text-red-400',
  high: 'border-orange-500/40 bg-orange-500/15 text-orange-400',
  medium: 'border-amber-500/40 bg-amber-500/15 text-amber-400',
  low: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400',
};

const SEVERITY_ICONS: Record<string, typeof CircleX> = {
  critical: CircleX,
  high: AlertTriangle,
  medium: CircleAlert,
  low: CheckCircle2,
};

const mockEvents = [
  {
    event: 'Failed login attempt (brute force detected)',
    severity: 'critical',
    user: 'unknown@external.com',
    ip: '192.168.1.45',
    time: '2 min ago',
  },
  {
    event: 'PII field accessed without masking',
    severity: 'high',
    user: 'mark@deepmindq.com',
    ip: '10.0.0.12',
    time: '18 min ago',
  },
  {
    event: 'API key rotated successfully',
    severity: 'low',
    user: 'jane@deepmindq.com',
    ip: '10.0.0.1',
    time: '1h ago',
  },
  {
    event: 'Bulk data export initiated',
    severity: 'medium',
    user: 'mark@deepmindq.com',
    ip: '10.0.0.12',
    time: '2h ago',
  },
  {
    event: 'New user role escalation approved',
    severity: 'medium',
    user: 'jane@deepmindq.com',
    ip: '10.0.0.1',
    time: '3h ago',
  },
  {
    event: 'Suspicious IP blocked by firewall',
    severity: 'high',
    user: 'system',
    ip: '203.0.113.42',
    time: '4h ago',
  },
  {
    event: 'SSL certificate renewal completed',
    severity: 'low',
    user: 'system',
    ip: '10.0.0.1',
    time: '6h ago',
  },
  {
    event: 'Rate limit exceeded on /api/search',
    severity: 'medium',
    user: 'api-service',
    ip: '10.0.0.5',
    time: '8h ago',
  },
  {
    event: 'Privileged session initiated',
    severity: 'low',
    user: 'jane@deepmindq.com',
    ip: '10.0.0.1',
    time: '10h ago',
  },
  {
    event: 'Data retention policy applied',
    severity: 'low',
    user: 'system',
    ip: '10.0.0.1',
    time: '12h ago',
  },
];

const complianceCards = [
  {
    label: 'PII Protection',
    status: 'green' as const,
    detail: 'All fields masked in non-priv contexts',
  },
  { label: 'Encryption', status: 'green' as const, detail: 'AES-256 at rest, TLS 1.3 in transit' },
  { label: 'RBAC Enforcement', status: 'amber' as const, detail: '1 pending permission review' },
  { label: 'Audit Trail', status: 'green' as const, detail: 'Immutable logs, 365-day retention' },
] as const;

function ComplianceStatus({ status }: { status: 'green' | 'amber' | 'red' }) {
  if (status === 'green') return <CheckCircle2 className="size-5 text-emerald-500" />;
  if (status === 'amber') return <CircleAlert className="size-5 text-amber-500" />;
  return <CircleX className="size-5 text-red-500" />;
}

function complianceBorderClass(status: 'green' | 'amber' | 'red'): string {
  const map = {
    green: 'border-emerald-500/30',
    amber: 'border-amber-500/30',
    red: 'border-red-500/30',
  };
  return map[status];
}

export default function Audit() {
  const [isLoading, setIsLoading] = useState(true);
  const { setActiveView } = useAppStore();

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  if (isLoading) return <ScreenSkeleton rows={8} className="p-6" />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: tokens.text.primary }}>
            Audit Overview
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            Security events, compliance status, and activity monitoring
          </p>
        </div>
        <Button variant="outline" onClick={() => setActiveView('audit-logs')} className="gap-2">
          <Eye className="size-3.5" /> Full Audit Logs
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Events Today',
            value: '847',
            icon: Shield,
            color: '#38bdf8',
            bg: 'rgba(56,189,248,0.12)',
          },
          {
            label: 'Security Events',
            value: '23',
            icon: AlertTriangle,
            color: '#f87171',
            bg: 'rgba(248,113,113,0.12)',
          },
          {
            label: 'Failed Auth',
            value: '12',
            icon: XCircle,
            color: '#fb923c',
            bg: 'rgba(251,146,60,0.12)',
          },
          {
            label: 'Data Exports',
            value: '5',
            icon: Download,
            color: '#a78bfa',
            bg: 'rgba(167,139,250,0.12)',
          },
        ].map((s) => (
          <Card key={s.label} className="py-4 gap-4">
            <CardContent className="px-4 flex items-center gap-3">
              <div className="rounded-lg p-2.5" style={{ backgroundColor: s.bg }}>
                <s.icon className="size-5" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: tokens.text.secondary }}>
                  {s.label}
                </p>
                <p className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
                  {s.value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Compliance Status */}
      <div>
        <h2 className="text-lg font-semibold mb-3" style={{ color: tokens.text.primary }}>
          Compliance Status
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {complianceCards.map((card) => (
            <Card
              key={card.label}
              className={`py-0 gap-0 border ${complianceBorderClass(card.status)}`}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <ComplianceStatus status={card.status} />
                <div>
                  <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                    {card.label}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: tokens.text.muted }}>
                    {card.detail}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Security Events Feed */}
      <Card className="py-0 gap-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="size-4" style={{ color: tokens.accent.primary }} />
            Recent Security Events
          </CardTitle>
          <CardDescription>Latest 10 security-relevant events</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="max-h-[480px] overflow-y-auto">
            <div className="space-y-0">
              {mockEvents.map((evt, i) => {
                const SevIcon = SEVERITY_ICONS[evt.severity];
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3 px-6 py-3 border-b last:border-b-0"
                    style={{ borderColor: tokens.borderFaint }}
                  >
                    <SevIcon
                      className={`size-4 mt-0.5 shrink-0 ${
                        evt.severity === 'critical'
                          ? 'text-red-400'
                          : evt.severity === 'high'
                            ? 'text-orange-400'
                            : evt.severity === 'medium'
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" style={{ color: tokens.text.primary }}>
                        {evt.event}
                      </p>
                      <div className="flex items-center gap-4 mt-1">
                        <span
                          className="text-xs flex items-center gap-1"
                          style={{ color: tokens.text.muted }}
                        >
                          <User className="size-3" /> {evt.user}
                        </span>
                        <span
                          className="text-xs flex items-center gap-1"
                          style={{ color: tokens.text.muted }}
                        >
                          <Globe className="size-3" /> {evt.ip}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={SEVERITY_COLORS[evt.severity]}>{evt.severity}</Badge>
                      <span
                        className="text-xs whitespace-nowrap"
                        style={{ color: tokens.text.muted }}
                      >
                        {evt.time}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
