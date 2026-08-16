'use client';

import { useState, useEffect } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  Database,
  GitBranch,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
} from 'lucide-react';

const SUBSYSTEMS = [
  {
    name: 'Knowledge Graph',
    icon: GitBranch,
    status: 'healthy',
    metrics: { label1: 'Nodes', value1: '24,891', label2: 'Edges', value2: '187,342' },
  },
  {
    name: 'Signal Engine',
    icon: Activity,
    status: 'healthy',
    metrics: {
      label1: 'Active Signals',
      value1: '342',
      label2: 'Total Processed',
      value2: '12,456',
    },
  },
  {
    name: 'Reasoning Engine',
    icon: Database,
    status: 'degraded',
    metrics: { label1: 'Runs (24h)', value1: '847', label2: 'Errors', value2: '3' },
  },
  {
    name: 'Persistence Layer',
    icon: Database,
    status: 'healthy',
    metrics: { label1: 'Store Status', value1: 'Connected', label2: 'Uptime', value2: '99.97%' },
  },
];

const HEALTH_EVENTS = [
  {
    id: '1',
    time: '14:32',
    event: 'Reasoning Engine recovered from timeout spike',
    type: 'recovery' as const,
    detail: 'Auto-scaled after 3 consecutive timeouts. Latency back to normal.',
  },
  {
    id: '2',
    time: '13:15',
    event: 'Knowledge Graph index rebuild completed',
    type: 'success' as const,
    detail: 'Reindexed 24,891 nodes. Query performance improved by 23%.',
  },
  {
    id: '3',
    time: '12:47',
    event: 'Signal Engine: new source connector added',
    type: 'info' as const,
    detail: 'LinkedIn Sales Navigator connector now active. 1,200 new signals ingested.',
  },
  {
    id: '4',
    time: '11:20',
    event: 'Reasoning Engine timeout threshold exceeded',
    type: 'warning' as const,
    detail: '3 queries exceeded 30s timeout in 10-minute window.',
  },
  {
    id: '5',
    time: '10:05',
    event: 'Persistence Layer: daily backup completed',
    type: 'success' as const,
    detail: 'Full backup: 2.4GB compressed. Replicated to secondary region.',
  },
  {
    id: '6',
    time: '09:30',
    event: 'System health check passed',
    type: 'success' as const,
    detail: 'All subsystems operational. Health score: 94/100.',
  },
  {
    id: '7',
    time: '08:00',
    event: 'Scheduled maintenance window started',
    type: 'info' as const,
    detail: 'Index optimization running in background. No service interruption.',
  },
  {
    id: '8',
    time: '07:15',
    event: 'Signal Engine: source sync delay detected',
    type: 'warning' as const,
    detail: 'Salesforce sync lagging 12 minutes. Auto-retry initiated.',
  },
];

function getHealthColor(score: number) {
  if (score >= 85) return tokens.confidence.high.value;
  if (score >= 60) return tokens.confidence.medium.value;
  return tokens.confidence.low.value;
}

function getHealthBg(score: number) {
  if (score >= 85) return tokens.confidence.high.bg;
  if (score >= 60) return tokens.confidence.medium.bg;
  return tokens.confidence.low.bg;
}

function getStatusBadge(status: string) {
  if (status === 'healthy')
    return (
      <Badge
        style={{
          backgroundColor: tokens.confidence.high.bg,
          color: tokens.confidence.high.value,
          borderWidth: 1,
          borderColor: tokens.confidence.high.border,
        }}
      >
        Healthy
      </Badge>
    );
  if (status === 'degraded')
    return (
      <Badge
        style={{
          backgroundColor: tokens.confidence.medium.bg,
          color: tokens.confidence.medium.value,
          borderWidth: 1,
          borderColor: tokens.confidence.medium.border,
        }}
      >
        Degraded
      </Badge>
    );
  return <Badge variant="destructive">Down</Badge>;
}

function getEventIcon(type: string) {
  switch (type) {
    case 'success':
      return <CheckCircle2 className="size-4" style={{ color: tokens.confidence.high.value }} />;
    case 'warning':
      return <AlertTriangle className="size-4" style={{ color: tokens.confidence.medium.value }} />;
    case 'recovery':
      return <RefreshCw className="size-4" style={{ color: tokens.domain.value }} />;
    default:
      return <Activity className="size-4" style={{ color: tokens.accent.primary }} />;
  }
}

function CircularProgress({
  value,
  size = 180,
  strokeWidth = 12,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (value / 100) * circumference;
  const color = getHealthColor(value);

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={tokens.neutral['100']}
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference - progress}
        className="transition-all duration-1000 ease-out"
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="transform rotate-90 origin-center"
        fill={tokens.text.primary}
        fontSize="42"
        fontWeight="bold"
      >
        {value}
      </text>
      <text
        x="50%"
        y="68%"
        textAnchor="middle"
        dominantBaseline="central"
        className="transform rotate-90 origin-center"
        fill={tokens.text.muted}
        fontSize="13"
      >
        out of 100
      </text>
    </svg>
  );
}

export default function IntelligenceHealth() {
  const [healthScore, setHealthScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const TARGET_SCORE = 94;

  useEffect(() => {
    const timer = setTimeout(() => {
      setHealthScore(TARGET_SCORE);
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
          Intelligence System Health
        </h1>
        <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
          Real-time monitoring of all intelligence subsystems
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health Score */}
        <Card className="gap-4 py-4 flex items-center justify-center">
          <CardContent className="flex flex-col items-center gap-4">
            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="size-12 animate-spin" style={{ color: tokens.text.muted }} />
                <span className="text-sm" style={{ color: tokens.text.muted }}>
                  Calculating health score...
                </span>
              </div>
            ) : (
              <>
                <CircularProgress value={healthScore} />
                <div className="text-center">
                  <p
                    className="text-sm font-semibold"
                    style={{ color: getHealthColor(healthScore) }}
                  >
                    {healthScore >= 85 ? 'Excellent' : healthScore >= 60 ? 'Fair' : 'Critical'}
                  </p>
                  <p className="text-xs" style={{ color: tokens.text.muted }}>
                    Overall System Health
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Subsystem Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SUBSYSTEMS.map((sub) => (
            <Card key={sub.name} className="gap-4 py-4">
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="size-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: tokens.domain.bg }}
                    >
                      <sub.icon className="size-4" style={{ color: tokens.domain.value }} />
                    </div>
                    <span className="text-sm font-semibold" style={{ color: tokens.text.primary }}>
                      {sub.name}
                    </span>
                  </div>
                  {getStatusBadge(sub.status)}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    className="rounded-lg p-3"
                    style={{ backgroundColor: tokens.surface.secondary }}
                  >
                    <p className="text-xs" style={{ color: tokens.text.muted }}>
                      {sub.metrics.label1}
                    </p>
                    <p className="text-lg font-bold" style={{ color: tokens.text.primary }}>
                      {sub.metrics.value1}
                    </p>
                  </div>
                  <div
                    className="rounded-lg p-3"
                    style={{ backgroundColor: tokens.surface.secondary }}
                  >
                    <p className="text-xs" style={{ color: tokens.text.muted }}>
                      {sub.metrics.label2}
                    </p>
                    <p className="text-lg font-bold" style={{ color: tokens.text.primary }}>
                      {sub.metrics.value2}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Health Events Timeline */}
      <Card className="gap-4 py-4">
        <CardHeader className="pb-0 pt-0 px-6">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="size-4" style={{ color: tokens.text.muted }} />
            Recent Health Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-0 max-h-80 overflow-y-auto">
            {HEALTH_EVENTS.map((evt, idx) => (
              <div key={evt.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className="size-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: tokens.surface.secondary }}
                  >
                    {getEventIcon(evt.type)}
                  </div>
                  {idx < HEALTH_EVENTS.length - 1 && (
                    <div
                      className="w-px flex-1 mt-1"
                      style={{ backgroundColor: tokens.border.default }}
                    />
                  )}
                </div>
                <div className="pb-6 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono" style={{ color: tokens.text.muted }}>
                      Today {evt.time}
                    </span>
                  </div>
                  <p className="text-sm font-medium mt-0.5" style={{ color: tokens.text.primary }}>
                    {evt.event}
                  </p>
                  <p className="text-xs mt-1" style={{ color: tokens.text.secondary }}>
                    {evt.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
