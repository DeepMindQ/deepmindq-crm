'use client';

import { useState } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Activity, Users, Settings, ScrollText, Server, Database, Cpu, Wifi, WifiOff,
  Shield, Globe, Bell, Loader2, ArrowRight, CircleDot, CircleCheck, CircleX, CircleAlert,
} from 'lucide-react';

const systemStats = [
  { label: 'Uptime', value: '99.97%', icon: Server, status: 'healthy' as const },
  { label: 'Active Users', value: '24', icon: Users, status: 'healthy' as const },
  { label: 'API Requests / hr', value: '14.2K', icon: Activity, status: 'healthy' as const },
  { label: 'DB Size', value: '2.4 GB', icon: Database, status: 'healthy' as const },
];

const services = [
  { name: 'AI Inference Engine', status: 'running' as const, latency: '120ms' },
  { name: 'Signal Pipeline', status: 'running' as const, latency: '45ms' },
  { name: 'Knowledge Graph', status: 'running' as const, latency: '80ms' },
  { name: 'Email Service', status: 'degraded' as const, latency: '320ms' },
  { name: 'Data Ingestion', status: 'running' as const, latency: '200ms' },
  { name: 'Cache Layer', status: 'running' as const, latency: '5ms' },
  { name: 'Search Index', status: 'stopped' as const, latency: '—' },
];

const configSettings = [
  { key: 'ai_model_primary', label: 'Primary AI Model', value: 'gpt-4o', type: 'text' },
  { key: 'ai_model_fallback', label: 'Fallback AI Model', value: 'claude-3-haiku', type: 'text' },
  { key: 'max_concurrent_tasks', label: 'Max Concurrent Tasks', value: '10', type: 'text' },
  { key: 'signal_refresh_interval', label: 'Signal Refresh Interval', value: '5 min', type: 'text' },
  { key: 'enable_real_time', label: 'Real-time Updates', value: 'true', type: 'toggle' },
  { key: 'data_retention_days', label: 'Data Retention (days)', value: '365', type: 'text' },
  { key: 'audit_log_level', label: 'Audit Log Level', value: 'verbose', type: 'text' },
  { key: 'pii_detection', label: 'PII Auto-Detection', value: 'true', type: 'toggle' },
];

function StatusIcon({ status }: { status: 'running' | 'degraded' | 'stopped' }) {
  if (status === 'running') return <CircleCheck className="size-4 text-emerald-500" />;
  if (status === 'degraded') return <CircleAlert className="size-4 text-amber-500" />;
  return <CircleX className="size-4 text-red-500" />;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    running: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400',
    degraded: 'border-amber-500/40 bg-amber-500/15 text-amber-400',
    stopped: 'border-red-500/40 bg-red-500/15 text-red-400',
  };
  return <Badge className={styles[status] || ''}>{status}</Badge>;
}

export function AdminSettingsPanel() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const { setActiveView } = useAppStore();

  const [toggles, setToggles] = useState<Record<string, boolean>>({
    enable_real_time: true,
    pii_detection: true,
  });

  const handleToggle = (key: string) => {
    setToggles(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: tokens.text.primary }}>
          Admin Settings
        </h1>
        <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
          System administration, configuration, and monitoring
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <Activity className="size-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="size-3.5" /> Users
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-1.5">
            <Settings className="size-3.5" /> Configuration
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5">
            <ScrollText className="size-3.5" /> Logs
          </TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {systemStats.map((stat) => (
              <Card key={stat.label} className="py-4 gap-4">
                <CardContent className="px-4 flex items-center gap-3">
                  <div className="rounded-lg p-2.5" style={{ backgroundColor: tokens.accent.subtle }}>
                    <stat.icon className="size-5" style={{ color: tokens.accent.primary }} />
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: tokens.text.secondary }}>{stat.label}</p>
                    <p className="text-2xl font-bold" style={{ color: tokens.text.primary }}>{stat.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="py-0 gap-0">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Cpu className="size-4" style={{ color: tokens.accent.primary }} />
                Service Status
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-4">
              <div className="px-6 space-y-3">
                {services.map((svc) => (
                  <div key={svc.name} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: tokens.border.default }}>
                    <div className="flex items-center gap-3">
                      <StatusIcon status={svc.status} />
                      <span className="text-sm font-medium" style={{ color: tokens.text.primary }}>{svc.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono" style={{ color: tokens.text.muted }}>{svc.latency}</span>
                      <StatusBadge status={svc.status} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Users ── */}
        <TabsContent value="users" className="mt-4">
          <Card className="py-0 gap-0">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="size-4" style={{ color: tokens.accent.primary }} />
                User Management
              </CardTitle>
              <CardDescription>Manage users, roles, and permissions</CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-4">
              <div className="rounded-lg border p-4 space-y-3" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.secondary }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: tokens.accent.subtle, color: tokens.accent.primary }}>
                      JD
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>Jane Doe</p>
                      <p className="text-xs" style={{ color: tokens.text.muted }}>jane@deepmindq.com</p>
                    </div>
                  </div>
                  <Badge className="border-emerald-500/40 bg-emerald-500/15 text-emerald-400">Admin</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: tokens.gold.bgMedium, color: tokens.gold.dark }}>
                      MS
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>Mark Smith</p>
                      <p className="text-xs" style={{ color: tokens.text.muted }}>mark@deepmindq.com</p>
                    </div>
                  </div>
                  <Badge className="border-sky-500/40 bg-sky-500/15 text-sky-400">Editor</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>
                      AL
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>Alice Lee</p>
                      <p className="text-xs" style={{ color: tokens.text.muted }}>alice@deepmindq.com</p>
                    </div>
                  </div>
                  <Badge className="border-slate-400/40 bg-slate-400/15 text-slate-300">Viewer</Badge>
                </div>
              </div>
              <Button variant="outline" onClick={() => setActiveView('users')} className="gap-2">
                Manage All Users <ArrowRight className="size-3.5" />
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Configuration ── */}
        <TabsContent value="config" className="mt-4 space-y-4">
          <Card className="py-0 gap-0">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="size-4" style={{ color: tokens.accent.primary }} />
                System Configuration
              </CardTitle>
              <CardDescription>Key platform settings</CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-4">
              {configSettings.map((setting) => (
                <div key={setting.key} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: tokens.borderFaint }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>{setting.label}</p>
                    <p className="text-xs" style={{ color: tokens.text.muted }}>{setting.key}</p>
                  </div>
                  {setting.type === 'toggle' ? (
                    <Switch
                      checked={toggles[setting.key] ?? false}
                      onCheckedChange={() => handleToggle(setting.key)}
                    />
                  ) : (
                    <span className="text-sm font-mono px-3 py-1 rounded-md border" style={{ color: tokens.text.secondary, borderColor: tokens.border.default, backgroundColor: tokens.surface.secondary }}>
                      {setting.value}
                    </span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Logs ── */}
        <TabsContent value="logs" className="mt-4">
          <Card className="py-0 gap-0">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <ScrollText className="size-4" style={{ color: tokens.accent.primary }} />
                Audit & Logs
              </CardTitle>
              <CardDescription>System audit trail and activity logs</CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border p-4" style={{ borderColor: tokens.border.default }}>
                  <p className="text-xs" style={{ color: tokens.text.muted }}>Events Today</p>
                  <p className="text-xl font-bold mt-1" style={{ color: tokens.text.primary }}>847</p>
                </div>
                <div className="rounded-lg border p-4" style={{ borderColor: tokens.border.default }}>
                  <p className="text-xs" style={{ color: tokens.text.muted }}>Errors</p>
                  <p className="text-xl font-bold mt-1 text-red-400">12</p>
                </div>
                <div className="rounded-lg border p-4" style={{ borderColor: tokens.border.default }}>
                  <p className="text-xs" style={{ color: tokens.text.muted }}>Security Events</p>
                  <p className="text-xl font-bold mt-1 text-amber-400">3</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => setActiveView('audit-logs')} className="gap-2">
                View Full Audit Logs <ArrowRight className="size-3.5" />
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AdminSettingsPanel;
