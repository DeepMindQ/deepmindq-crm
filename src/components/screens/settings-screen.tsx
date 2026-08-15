'use client';

import { useState, useCallback, useEffect } from 'react';
import { tokens, elevation } from '@/components/intelligence-os/design-tokens';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Settings as SettingsIcon,
  Bot,
  Mail,
  Bell,
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  XCircle,
  Save,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { fetchApi } from '@/lib/fetchApi';

// ── Types ──

interface AIProvider {
  name: string;
  apiKey: string;
  maskedKey: string;
  status: 'connected' | 'disconnected' | 'testing';
}

// ── Helpers ──

function maskKey(key: string): string {
  if (!key || key.length < 8) return '••••••••';
  return key.slice(0, 4) + '•'.repeat(Math.min(key.length - 8, 20)) + key.slice(-4);
}

function FormField({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium" style={{ color: tokens.text.primary }}>
        {label}
      </Label>
      {description && (
        <p className="text-xs" style={{ color: tokens.text.muted }}>
          {description}
        </p>
      )}
      {children}
    </div>
  );
}

function StatusDot({ status }: { status: 'connected' | 'disconnected' | 'testing' }) {
  const color =
    status === 'connected'
      ? tokens.confidence.high.value
      : status === 'testing'
        ? '#D97706'
        : tokens.confidence.low.value;
  return <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />;
}

// ── Component ──

export default function Settings() {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── General ──
  const [appName, setAppName] = useState('DeepMindQ Intelligence OS');
  const [timezone, setTimezone] = useState('UTC');
  const [language, setLanguage] = useState('en-US');

  // ── AI Providers ──
  const [aiProviders, setAiProviders] = useState<AIProvider[]>([
    { name: 'NVIDIA', apiKey: '', maskedKey: '', status: 'disconnected' },
    { name: 'Fireworks', apiKey: '', maskedKey: '', status: 'disconnected' },
    { name: 'Groq', apiKey: '', maskedKey: '', status: 'disconnected' },
    { name: 'Gemini', apiKey: '', maskedKey: '', status: 'disconnected' },
  ]);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  // ── Email ──
  const [smtpProvider, setSmtpProvider] = useState('Resend');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [emailFrom, setEmailFrom] = useState('noreply@deepmindq.com');
  const [emailFromName, setEmailFromName] = useState('DeepMindQ Intelligence');
  const [emailConfigured, setEmailConfigured] = useState(false);

  // ── Notifications ──
  const [slackWebhook, setSlackWebhook] = useState('');
  const [teamsWebhook, setTeamsWebhook] = useState('');
  const [pagerDutyKey, setPagerDutyKey] = useState('');
  const [notifySignalAlerts, setNotifySignalAlerts] = useState(true);
  const [notifyPipelineChanges, setNotifyPipelineChanges] = useState(true);
  const [notifyWeeklyDigest, setNotifyWeeklyDigest] = useState(true);
  const [notifySecurityEvents, setNotifySecurityEvents] = useState(true);

  // ── Security ──
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [maxConcurrentSessions, setMaxConcurrentSessions] = useState('5');
  const [ipAllowlist, setIpAllowlist] = useState('');
  const [enforce2FA, setEnforce2FA] = useState(true);
  const [auditLogging, setAuditLogging] = useState(true);

  // ── Load settings from API on mount ──
  useEffect(() => {
    async function loadSettings() {
      const res = await fetchApi<{
        appName: string;
        timezone: string;
        language: string;
        aiProviders: { name: string; status: string }[];
        email: { provider: string; from: string; configured: boolean };
        sessionTimeout: number;
        maxConcurrentSessions: number;
        auditLogging: boolean;
      }>('/api/settings');

      if (res.data) {
        const d = res.data;
        setAppName(d.appName || appName);
        setTimezone(d.timezone || timezone);
        setLanguage(d.language || language);
        setEmailFrom(d.email?.from || emailFrom);
        setEmailConfigured(d.email?.configured || false);
        setSmtpProvider(d.email?.provider || smtpProvider);
        setSessionTimeout(String(d.sessionTimeout || 30));
        setMaxConcurrentSessions(String(d.maxConcurrentSessions || 5));
        setAuditLogging(d.auditLogging !== false);

        if (d.aiProviders) {
          setAiProviders((prev) =>
            prev.map((p) => {
              const serverStatus = d.aiProviders.find((s) => s.name === p.name);
              return {
                ...p,
                status: (serverStatus?.status as AIProvider['status']) || 'disconnected',
                maskedKey: serverStatus ? '••••••••' : '',
              };
            }),
          );
        }
      }
      setLoading(false);
    }

    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bg = tokens.surface.card;
  const border = tokens.border.default;
  const textPrimary = tokens.text.primary;
  const textSecondary = tokens.text.secondary;
  const textMuted = tokens.text.muted;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetchApi('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appName,
          timezone,
          language,
          slackWebhook,
          teamsWebhook,
          pagerDutyKey,
          notifySignalAlerts,
          notifyPipelineChanges,
          notifyWeeklyDigest,
          notifySecurityEvents,
          sessionTimeout: parseInt(sessionTimeout, 10),
          maxConcurrentSessions: parseInt(maxConcurrentSessions, 10),
          ipAllowlist,
          enforce2FA,
          auditLogging,
        }),
      });

      if (res.error) {
        toast.error(`Failed to save: ${res.error}`);
      } else {
        toast.success('Settings saved successfully');
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [
    appName,
    timezone,
    language,
    slackWebhook,
    teamsWebhook,
    pagerDutyKey,
    notifySignalAlerts,
    notifyPipelineChanges,
    notifyWeeklyDigest,
    notifySecurityEvents,
    sessionTimeout,
    maxConcurrentSessions,
    ipAllowlist,
    enforce2FA,
    auditLogging,
  ]);

  const handleTestAIConnection = useCallback(async (providerName: string) => {
    setAiProviders((prev) =>
      prev.map((p) => (p.name === providerName ? { ...p, status: 'testing' as const } : p)),
    );

    // Find the API key for this provider from env (we can't send user-entered keys securely)
    try {
      const res = await fetchApi<{
        provider: string;
        status: string;
        statusCode?: number;
        error?: string;
      }>('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiProviderTest: {
            name: providerName,
            apiKey: 'test', // The server validates from env vars
          },
        }),
      });

      const connected = res.data?.status === 'connected';
      setAiProviders((prev) =>
        prev.map((p) =>
          p.name === providerName
            ? { ...p, status: connected ? ('connected' as const) : ('disconnected' as const) }
            : p,
        ),
      );
      toast[connected ? 'success' : 'error'](
        `${providerName} connection ${connected ? 'successful' : 'failed'}`,
      );
    } catch {
      setAiProviders((prev) =>
        prev.map((p) => (p.name === providerName ? { ...p, status: 'disconnected' as const } : p)),
      );
      toast.error(`${providerName} connection test failed`);
    }
  }, []);

  const handleTestEmail = useCallback(async () => {
    try {
      const res = await fetchApi<{ emailTest: string; configured?: boolean }>('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailTest: true }),
      });

      if (res.data?.emailTest === 'sent') {
        toast.success('Test email sent to your address');
      } else {
        toast.error(
          res.data?.configured === false
            ? 'Email not configured. Set EMAIL_API_KEY.'
            : 'Failed to send test email',
        );
      }
    } catch {
      toast.error('Failed to test email connection');
    }
  }, []);

  const inputStyle: React.CSSProperties = {
    background: 'var(--ios-bg-card)',
    border: `1px solid ${border}`,
    color: textPrimary,
  };

  const TABS = [
    { value: 'general', label: 'General', icon: SettingsIcon },
    { value: 'ai', label: 'AI Providers', icon: Bot },
    { value: 'email', label: 'Email', icon: Mail },
    { value: 'notifications', label: 'Notifications', icon: Bell },
    { value: 'security', label: 'Security', icon: ShieldCheck },
  ];

  return (
    <div
      className="p-6 space-y-6"
      style={{ background: 'var(--ios-bg-primary)', minHeight: '100%' }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: textPrimary }}>
            Settings
          </h1>
          <p className="text-sm mt-1" style={{ color: textSecondary }}>
            Configure your Intelligence OS environment
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          size="sm"
          className="gap-2"
          style={{ background: tokens.accent.primary, color: tokens.flat.white }}
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="general">
        <TabsList
          className="flex flex-wrap gap-1 h-auto p-1 rounded-xl"
          style={{ background: tokens.surface.secondary, border: `1px solid ${border}` }}
        >
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg data-[state=active]:shadow-sm"
              style={{
                color: textSecondary,
              }}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ════════════ General Tab ════════════ */}
        <TabsContent value="general">
          <div
            className="rounded-xl p-6 space-y-6 mt-2"
            style={{ background: bg, border: `1px solid ${border}`, boxShadow: elevation.sm }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                label="Application Name"
                description="The display name shown in the header and browser tab."
              >
                <Input
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="h-9 text-sm"
                  style={inputStyle}
                />
              </FormField>
              <FormField
                label="Default Timezone"
                description="Used for scheduling, timestamps, and report generation."
              >
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full h-9 rounded-md px-3 text-sm"
                  style={inputStyle}
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="Europe/London">London (GMT)</option>
                  <option value="Europe/Berlin">Berlin (CET)</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                </select>
              </FormField>
              <FormField label="Language" description="Interface language for all users.">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full h-9 rounded-md px-3 text-sm"
                  style={inputStyle}
                >
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="de-DE">German</option>
                  <option value="fr-FR">French</option>
                  <option value="ja-JP">Japanese</option>
                </select>
              </FormField>
            </div>
          </div>
        </TabsContent>

        {/* ════════════ AI Providers Tab ════════════ */}
        <TabsContent value="ai">
          <div
            className="rounded-xl p-6 space-y-6 mt-2"
            style={{ background: bg, border: `1px solid ${border}`, boxShadow: elevation.sm }}
          >
            {aiProviders.map((provider, idx) => (
              <div key={provider.name}>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
                  <FormField
                    label={`${provider.name} API Key`}
                    description={`Enter your ${provider.name} API key to enable AI features.`}
                  >
                    <div className="relative">
                      <Input
                        type={showKeys[provider.name] ? 'text' : 'password'}
                        value={
                          showKeys[provider.name]
                            ? provider.apiKey || provider.maskedKey
                            : provider.apiKey
                              ? maskKey(provider.apiKey)
                              : provider.maskedKey || '••••••••'
                        }
                        onChange={(e) =>
                          setAiProviders((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, apiKey: e.target.value } : p)),
                          )
                        }
                        placeholder={`sk-...`}
                        className="h-9 text-sm pr-10"
                        style={inputStyle}
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                        style={{ color: textMuted }}
                        onClick={() =>
                          setShowKeys((prev) => ({
                            ...prev,
                            [provider.name]: !prev[provider.name],
                          }))
                        }
                      >
                        {showKeys[provider.name] ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </FormField>
                  <div className="flex items-center gap-3 h-9">
                    <StatusDot status={provider.status} />
                    <span
                      className="text-xs font-medium capitalize"
                      style={{ color: textSecondary }}
                    >
                      {provider.status === 'testing' ? 'Testing…' : provider.status}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs gap-1.5"
                    style={{ border: `1px solid ${border}`, color: textSecondary }}
                    onClick={() => handleTestAIConnection(provider.name)}
                    disabled={provider.status === 'testing'}
                  >
                    {provider.status === 'testing' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : null}
                    Test Connection
                  </Button>
                </div>
                {idx < aiProviders.length - 1 && (
                  <Separator className="my-5" style={{ background: border }} />
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ════════════ Email Tab ════════════ */}
        <TabsContent value="email">
          <div
            className="rounded-xl p-6 space-y-6 mt-2"
            style={{ background: bg, border: `1px solid ${border}`, boxShadow: elevation.sm }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label="SMTP Provider" description="Your email delivery service.">
                <select
                  value={smtpProvider}
                  onChange={(e) => setSmtpProvider(e.target.value)}
                  className="w-full h-9 rounded-md px-3 text-sm"
                  style={inputStyle}
                >
                  <option>Resend</option>
                  <option>SendGrid</option>
                  <option>Mailgun</option>
                  <option>AWS SES</option>
                  <option>Postmark</option>
                  <option>Custom SMTP</option>
                </select>
              </FormField>
              <FormField label="SMTP Host" description="Hostname of your SMTP server.">
                <Input
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  className="h-9 text-sm"
                  style={inputStyle}
                />
              </FormField>
              <FormField label="SMTP Port" description="Port number (587 for TLS, 465 for SSL).">
                <Input
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  className="h-9 text-sm"
                  style={inputStyle}
                />
              </FormField>
              <FormField label="SMTP Username">
                <Input
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  className="h-9 text-sm"
                  style={inputStyle}
                />
              </FormField>
              <FormField
                label="SMTP Password"
                description="Keep this secure. Stored encrypted at rest."
              >
                <Input
                  type="password"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-9 text-sm"
                  style={inputStyle}
                />
              </FormField>
              <FormField
                label="From Email Address"
                description="Sender email for all outgoing messages."
              >
                <Input
                  type="email"
                  value={emailFrom}
                  onChange={(e) => setEmailFrom(e.target.value)}
                  className="h-9 text-sm"
                  style={inputStyle}
                />
              </FormField>
              <FormField label="From Display Name">
                <Input
                  value={emailFromName}
                  onChange={(e) => setEmailFromName(e.target.value)}
                  className="h-9 text-sm"
                  style={inputStyle}
                />
              </FormField>
            </div>
            <Separator style={{ background: border }} />
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                style={{ border: `1px solid ${border}`, color: textSecondary }}
                onClick={handleTestEmail}
              >
                <Mail className="w-3.5 h-3.5" />
                Send Test Email
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ════════════ Notifications Tab ════════════ */}
        <TabsContent value="notifications">
          <div
            className="rounded-xl p-6 space-y-6 mt-2"
            style={{ background: bg, border: `1px solid ${border}`, boxShadow: elevation.sm }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label="Slack Webhook URL" description="Post alerts to a Slack channel.">
                <Input
                  value={slackWebhook}
                  onChange={(e) => setSlackWebhook(e.target.value)}
                  className="h-9 text-sm"
                  style={inputStyle}
                />
              </FormField>
              <FormField
                label="Microsoft Teams Webhook URL"
                description="Post alerts to a Teams channel."
              >
                <Input
                  value={teamsWebhook}
                  onChange={(e) => setTeamsWebhook(e.target.value)}
                  placeholder="https://..."
                  className="h-9 text-sm"
                  style={inputStyle}
                />
              </FormField>
              <FormField
                label="PagerDuty Integration Key"
                description="Route critical alerts to PagerDuty."
              >
                <Input
                  value={pagerDutyKey}
                  onChange={(e) => setPagerDutyKey(e.target.value)}
                  placeholder="••••••••"
                  type="password"
                  className="h-9 text-sm"
                  style={inputStyle}
                />
              </FormField>
            </div>

            <Separator style={{ background: border }} />

            <h3 className="text-sm font-semibold" style={{ color: textPrimary }}>
              Email Notification Preferences
            </h3>

            <div className="space-y-4">
              {[
                {
                  label: 'Signal Alerts',
                  desc: 'High-priority intelligence signals and trigger alerts',
                  value: notifySignalAlerts,
                  setter: setNotifySignalAlerts,
                },
                {
                  label: 'Pipeline Changes',
                  desc: 'Opportunity stage changes and pipeline movements',
                  value: notifyPipelineChanges,
                  setter: setNotifyPipelineChanges,
                },
                {
                  label: 'Weekly Digest',
                  desc: 'Summary of weekly intelligence and metrics',
                  value: notifyWeeklyDigest,
                  setter: setNotifyWeeklyDigest,
                },
                {
                  label: 'Security Events',
                  desc: 'Login attempts, permission changes, and audit events',
                  value: notifySecurityEvents,
                  setter: setNotifySecurityEvents,
                },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium" style={{ color: textPrimary }}>
                      {item.label}
                    </p>
                    <p className="text-xs" style={{ color: textMuted }}>
                      {item.desc}
                    </p>
                  </div>
                  <Switch checked={item.value} onCheckedChange={item.setter} className="shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ════════════ Security Tab ════════════ */}
        <TabsContent value="security">
          <div
            className="rounded-xl p-6 space-y-6 mt-2"
            style={{ background: bg, border: `1px solid ${border}`, boxShadow: elevation.sm }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                label="Session Timeout (minutes)"
                description="Auto-logout after inactivity."
              >
                <Input
                  type="number"
                  value={sessionTimeout}
                  onChange={(e) => setSessionTimeout(e.target.value)}
                  className="h-9 text-sm"
                  style={inputStyle}
                />
              </FormField>
              <FormField
                label="Max Concurrent Sessions"
                description="Maximum number of active sessions per user."
              >
                <Input
                  type="number"
                  value={maxConcurrentSessions}
                  onChange={(e) => setMaxConcurrentSessions(e.target.value)}
                  className="h-9 text-sm"
                  style={inputStyle}
                />
              </FormField>
              <div className="md:col-span-2">
                <FormField
                  label="IP Allowlist"
                  description="Comma-separated list of allowed IP addresses or CIDR ranges. Leave empty to allow all."
                >
                  <Input
                    value={ipAllowlist}
                    onChange={(e) => setIpAllowlist(e.target.value)}
                    placeholder="e.g. 192.168.1.0/24, 10.0.0.1"
                    className="h-9 text-sm"
                    style={inputStyle}
                  />
                </FormField>
              </div>
            </div>

            <Separator style={{ background: border }} />

            <div className="space-y-4">
              {[
                {
                  label: 'Enforce Two-Factor Authentication',
                  desc: 'Require all users to set up 2FA on login',
                  value: enforce2FA,
                  setter: setEnforce2FA,
                },
                {
                  label: 'Audit Logging',
                  desc: 'Log all user actions for compliance and security review',
                  value: auditLogging,
                  setter: setAuditLogging,
                },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium" style={{ color: textPrimary }}>
                      {item.label}
                    </p>
                    <p className="text-xs" style={{ color: textMuted }}>
                      {item.desc}
                    </p>
                  </div>
                  <Switch checked={item.value} onCheckedChange={item.setter} className="shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
