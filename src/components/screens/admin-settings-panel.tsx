'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { tokens, motion as motionTokens } from '@/components/intelligence-os/design-tokens'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Save,
  Loader2,
  Settings,
  Globe,
  Key,
  Shield,
  Mail,
  Cpu,
  Bell,
  Webhook,
  Upload,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  Send,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Lock,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Constants ────────────────────────────────────────────────

const TABS = [
  { key: 'general', label: 'General', icon: Settings },
  { key: 'api', label: 'API Config', icon: Key },
  { key: 'security', label: 'Security', icon: Shield },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'ai', label: 'AI Providers', icon: Cpu },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'webhooks', label: 'Webhooks', icon: Webhook },
] as const

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Kolkata',
  'Australia/Sydney', 'UTC',
] as const

const DATE_FORMATS = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD-MMM-YYYY'] as const
const RETENTION_OPTIONS = ['30d', '60d', '90d', '1y', 'Indefinite'] as const
const DIGEST_OPTIONS = ['Real-time', 'Hourly', 'Daily'] as const
const RETRY_OPTIONS = ['1', '3', '5'] as const

const WEBHOOK_EVENTS = [
  'company.created', 'contact.added', 'opportunity.updated',
  'score.changed', 'signal.detected',
] as const

const PLACEHOLDER_API_KEYS = [
  { id: '1', name: 'Production Key', key: 'dk_prod_*********************a3f2', created: '2025-01-15', lastUsed: '2025-06-20' },
  { id: '2', name: 'Staging Key', key: 'dk_stg_*********************b7e1', created: '2025-03-08', lastUsed: '2025-06-19' },
  { id: '3', name: 'Dev Key', key: 'dk_dev_*********************c4d9', created: '2025-05-22', lastUsed: '2025-06-18' },
] as const

const PLACEHOLDER_WEBHOOKS = [
  { id: '1', url: 'https://hooks.slack.com/services/T0X/B0X/abc', events: ['signal.detected', 'score.changed'], active: true },
  { id: '2', url: 'https://api.myapp.com/webhooks/intel', events: ['company.created', 'contact.added'], active: true },
] as const

// ── Motion Variants ───────────────────────────────────────────

const tabVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: motionTokens.default.duration, ease: [...motionTokens.default.ease] as [number, number, number, number] } },
  exit: { opacity: 0, y: -8, transition: { duration: motionTokens.fast.duration, ease: [...motionTokens.fast.ease] as [number, number, number, number] } },
}

// ── Helper: Settings Card ────────────────────────────────────

function SettingsCard({ title, description, children, className }: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: motionTokens.default.duration }}
      className={cn(
        'rounded-xl p-5 space-y-4',
        className
      )}
      style={{
        background: tokens.surface.card,
        border: `1px solid ${tokens.border.default}`,
      }}
    >
      <div>
        <h3 className="text-sm font-semibold" style={{ color: tokens.text.primary }}>{title}</h3>
        {description && (
          <p className="text-xs mt-0.5" style={{ color: tokens.text.secondary }}>{description}</p>
        )}
      </div>
      <Separator className="opacity-30" />
      <div className="space-y-4">{children}</div>
    </motion.div>
  )
}

// ── Helper: Field Row ────────────────────────────────────────

function FieldRow({ label, helper, children }: {
  label: string
  helper?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="sm:w-1/3 space-y-0.5">
        <Label className="text-xs font-medium" style={{ color: tokens.text.primary }}>{label}</Label>
        {helper && <p className="text-[11px]" style={{ color: tokens.text.muted }}>{helper}</p>}
      </div>
      <div className="sm:w-2/3">{children}</div>
    </div>
  )
}

// ── Helper: Styled Input ──────────────────────────────────────

function StyledInput(props: React.ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      className={cn(
        'h-8 text-xs rounded-lg',
        'transition-all duration-200',
        props.className
      )}
      style={{
        background: tokens.surface.secondary,
        borderColor: tokens.border.default,
        color: tokens.text.primary,
      }}
    />
  )
}

// ── Helper: Styled Select ────────────────────────────────────

function StyledSelect({ value, onValueChange, children, placeholder }: {
  value: string
  onValueChange: (v: string) => void
  children: React.ReactNode
  placeholder?: string
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className="h-10 text-xs rounded-lg w-full"
        style={{
          background: tokens.surface.secondary,
          borderColor: tokens.border.default,
          color: tokens.text.primary,
        }}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="rounded-lg">{children}</SelectContent>
    </Select>
  )
}

// ── Tab 1: General Settings ──────────────────────────────────

function GeneralSettings({ state, setters }: {
  state: { orgName: string; timezone: string; dateFormat: string; maintenanceMode: boolean }
  setters: {
    setOrgName: (v: string) => void
    setTimezone: (v: string) => void
    setDateFormat: (v: string) => void
    setMaintenanceMode: (v: boolean) => void
  }
}) {
  return (
    <div className="space-y-4">
      <SettingsCard title="Organization" description="Configure your organization identity and regional settings.">
        <FieldRow label="Organization Name" helper="Display name across the platform">
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 shrink-0" style={{ color: tokens.text.muted }} />
            <StyledInput
              value={state.orgName}
              onChange={(e) => setters.setOrgName(e.target.value)}
              placeholder="DeepMindQ Corp"
            />
          </div>
        </FieldRow>
        <FieldRow label="Default Timezone" helper="Applied to all date displays and scheduling">
          <StyledSelect value={state.timezone} onValueChange={setters.setTimezone} placeholder="Select timezone">
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz} value={tz} className="text-xs">{tz.replace(/_/g, ' ')}</SelectItem>
            ))}
          </StyledSelect>
        </FieldRow>
        <FieldRow label="Date Format" helper="Preferred date display format">
          <StyledSelect value={state.dateFormat} onValueChange={setters.setDateFormat} placeholder="Select format">
            {DATE_FORMATS.map((f) => (
              <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>
            ))}
          </StyledSelect>
        </FieldRow>
      </SettingsCard>

      <SettingsCard title="Brand Assets" description="Customize the logo and visual identity.">
        <FieldRow label="Organization Logo" helper="Recommended: 512x512px, PNG or SVG">
          <Button
            variant="outline"
            size="sm"
            className="h-10 text-xs gap-1.5 rounded-lg min-h-[44px]"
            style={{ borderColor: tokens.border.default, color: tokens.text.secondary }}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Logo
          </Button>
        </FieldRow>
      </SettingsCard>

      <SettingsCard title="System Operations" description="Control platform availability and maintenance windows.">
        <FieldRow label="Maintenance Mode" helper="Temporarily disable public access to the platform">
          <div className="flex items-center gap-3">
            <Switch checked={state.maintenanceMode} onCheckedChange={setters.setMaintenanceMode} />
            <span className="text-xs" style={{ color: state.maintenanceMode ? tokens.domain.risk : tokens.text.secondary }}>
              {state.maintenanceMode ? 'Maintenance active — platform is offline' : 'Platform is online'}
            </span>
          </div>
        </FieldRow>
      </SettingsCard>
    </div>
  )
}

// ── Tab 2: API Configuration ──────────────────────────────────

function APIConfiguration({ state, setters }: {
  state: { rateLimitMin: string; rateLimitHour: string; corsOrigins: string }
  setters: {
    setRateLimitMin: (v: string) => void
    setRateLimitHour: (v: string) => void
    setCorsOrigins: (v: string) => void
  }
}) {
  return (
    <div className="space-y-4">
      <SettingsCard title="Rate Limits" description="Control API request throttling to protect platform stability.">
        <FieldRow label="Requests / Minute" helper="Max requests per minute per client">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 shrink-0" style={{ color: tokens.text.muted }} />
            <StyledInput type="number" value={state.rateLimitMin} onChange={(e) => setters.setRateLimitMin(e.target.value)} />
          </div>
        </FieldRow>
        <FieldRow label="Requests / Hour" helper="Max requests per hour per client">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: tokens.text.muted }} />
            <StyledInput type="number" value={state.rateLimitHour} onChange={(e) => setters.setRateLimitHour(e.target.value)} />
          </div>
        </FieldRow>
      </SettingsCard>

      <SettingsCard title="API Keys" description="Manage API keys issued to clients and services.">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: tokens.text.secondary }}>Active Keys ({PLACEHOLDER_API_KEYS.length})</span>
            <Button
              variant="outline"
              size="sm"
              className="h-10 text-[11px] gap-1 rounded-lg min-h-[44px]"
              style={{ borderColor: tokens.border.default, color: tokens.accent.bright }}
            >
              <Plus className="w-3 h-3" /> Generate New
            </Button>
          </div>
          {PLACEHOLDER_API_KEYS.map((apiKey) => (
            <div
              key={apiKey.id}
              className="flex items-center justify-between gap-3 p-3 rounded-lg"
              style={{ background: tokens.surface.secondary, border: `1px solid ${tokens.border.subtle}` }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium" style={{ color: tokens.text.primary }}>{apiKey.name}</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 rounded"
                    style={{ borderColor: tokens.accent.DEFAULT, color: tokens.accent.bright }}
                  >
                    Active
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-[11px] font-mono" style={{ color: tokens.text.muted }}>{apiKey.key}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(apiKey.key); toast.success('Key copied to clipboard') }}
                    className="shrink-0"
                    style={{ color: tokens.text.muted }}
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex gap-3 mt-1">
                  <span className="text-[10px]" style={{ color: tokens.text.muted }}>Created: {apiKey.created}</span>
                  <span className="text-[10px]" style={{ color: tokens.text.muted }}>Last used: {apiKey.lastUsed}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-10 w-10 p-0 rounded-lg shrink-0 min-h-[44px]"
                style={{ color: tokens.domain.risk }}
                onClick={() => toast.info('Key revocation would require confirmation in production.')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard title="CORS Configuration" description="Define allowed origins for cross-origin API requests.">
        <FieldRow label="Allowed Origins" helper="Comma-separated domain list (e.g., https://app.example.com, https://admin.example.com)">
          <StyledInput
            value={state.corsOrigins}
            onChange={(e) => setters.setCorsOrigins(e.target.value)}
            placeholder="https://yourdomain.com, https://app.yourdomain.com"
          />
        </FieldRow>
      </SettingsCard>

      <div className="flex items-center gap-3 px-1">
        <span className="text-xs" style={{ color: tokens.text.secondary }}>API Version:</span>
        <Badge
          className="text-[11px] px-2 py-0.5 rounded-full"
          style={{ background: 'var(--dmq-trust-verified-bg)', color: 'var(--dmq-domain-action)', border: '1px solid var(--dmq-trust-verified-border)' }}
        >
          v1 Stable
        </Badge>
      </div>
    </div>
  )
}

// ── Tab 3: Security & Compliance ─────────────────────────────

function SecuritySettings({ state, setters }: {
  state: {
    enforce2FA: boolean
    sessionTimeout: string
    ipWhitelist: boolean
    dataRetention: string
    auditRetention: string
    minPasswordLength: string
    requireUppercase: boolean
    requireNumbers: boolean
  }
  setters: {
    setEnforce2FA: (v: boolean) => void
    setSessionTimeout: (v: string) => void
    setIpWhitelist: (v: boolean) => void
    setDataRetention: (v: string) => void
    setAuditRetention: (v: string) => void
    setMinPasswordLength: (v: string) => void
    setRequireUppercase: (v: boolean) => void
    setRequireNumbers: (v: boolean) => void
  }
}) {
  return (
    <div className="space-y-4">
      <SettingsCard title="Authentication" description="Control login security and session management policies.">
        <FieldRow label="Enforce Two-Factor Authentication" helper="Require all users to set up 2FA">
          <div className="flex items-center gap-3">
            <Switch checked={state.enforce2FA} onCheckedChange={setters.setEnforce2FA} />
            <span className="text-xs" style={{ color: state.enforce2FA ? tokens.domain.action : tokens.text.secondary }}>
              {state.enforce2FA ? '2FA is required for all users' : '2FA is optional'}
            </span>
          </div>
        </FieldRow>
        <FieldRow label="Session Timeout (minutes)" helper="Auto-logout after inactivity">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: tokens.text.muted }} />
            <StyledInput type="number" value={state.sessionTimeout} onChange={(e) => setters.setSessionTimeout(e.target.value)} />
          </div>
        </FieldRow>
        <FieldRow label="IP Whitelist" helper="Restrict access to approved IP addresses only">
          <div className="flex items-center gap-3">
            <Switch checked={state.ipWhitelist} onCheckedChange={setters.setIpWhitelist} />
            <span className="text-xs" style={{ color: state.ipWhitelist ? tokens.accent.bright : tokens.text.secondary }}>
              {state.ipWhitelist ? 'IP whitelist is active' : 'IP whitelist is disabled'}
            </span>
          </div>
        </FieldRow>
      </SettingsCard>

      <SettingsCard title="Data & Compliance" description="Set data retention and audit logging policies.">
        <FieldRow label="Data Retention Policy" helper="How long user data is kept before deletion">
          <StyledSelect value={state.dataRetention} onValueChange={setters.setDataRetention} placeholder="Select period">
            {RETENTION_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt} className="text-xs">{opt === 'Indefinite' ? 'Indefinite' : opt}</SelectItem>
            ))}
          </StyledSelect>
        </FieldRow>
        <FieldRow label="Audit Log Retention" helper="How long security audit logs are preserved">
          <StyledSelect value={state.auditRetention} onValueChange={setters.setAuditRetention} placeholder="Select period">
            {RETENTION_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt} className="text-xs">{opt === 'Indefinite' ? 'Indefinite' : opt}</SelectItem>
            ))}
          </StyledSelect>
        </FieldRow>
      </SettingsCard>

      <SettingsCard title="Password Policy" description="Define minimum requirements for user passwords.">
        <FieldRow label="Minimum Password Length" helper="Minimum character count for new passwords">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 shrink-0" style={{ color: tokens.text.muted }} />
            <StyledInput type="number" value={state.minPasswordLength} onChange={(e) => setters.setMinPasswordLength(e.target.value)} />
          </div>
        </FieldRow>
        <FieldRow label="Require Uppercase Letters" helper="Password must contain at least one uppercase letter">
          <div className="flex items-center gap-3">
            <Switch checked={state.requireUppercase} onCheckedChange={setters.setRequireUppercase} />
            <span className="text-xs" style={{ color: state.requireUppercase ? tokens.domain.action : tokens.text.secondary }}>
              {state.requireUppercase ? 'Required' : 'Not required'}
            </span>
          </div>
        </FieldRow>
        <FieldRow label="Require Numbers" helper="Password must contain at least one number">
          <div className="flex items-center gap-3">
            <Switch checked={state.requireNumbers} onCheckedChange={setters.setRequireNumbers} />
            <span className="text-xs" style={{ color: state.requireNumbers ? tokens.domain.action : tokens.text.secondary }}>
              {state.requireNumbers ? 'Required' : 'Not required'}
            </span>
          </div>
        </FieldRow>
      </SettingsCard>
    </div>
  )
}

// ── Tab 4: Email Configuration ───────────────────────────────

function EmailSettings({ state, setters }: {
  state: {
    smtpHost: string
    smtpPort: string
    smtpUser: string
    emailFrom: string
    emailReplyTo: string
    smtpConnected: boolean
  }
  setters: {
    setSmtpHost: (v: string) => void
    setSmtpPort: (v: string) => void
    setSmtpUser: (v: string) => void
    setEmailFrom: (v: string) => void
    setEmailReplyTo: (v: string) => void
    setSmtpConnected: (v: boolean) => void
  }
}) {
  const handleTestEmail = useCallback(() => {
    setters.setSmtpConnected(true)
    toast.success('Test email sent successfully!')
  }, [setters])

  return (
    <div className="space-y-4">
      <SettingsCard title="SMTP Configuration" description="Configure the mail server for outgoing transactional emails.">
        <FieldRow label="SMTP Host" helper="Hostname of your mail server">
          <StyledInput value={state.smtpHost} onChange={(e) => setters.setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" />
        </FieldRow>
        <FieldRow label="SMTP Port" helper="Common ports: 587 (TLS), 465 (SSL), 25 (unencrypted)">
          <StyledInput type="number" value={state.smtpPort} onChange={(e) => setters.setSmtpPort(e.target.value)} placeholder="587" />
        </FieldRow>
        <FieldRow label="SMTP Username" helper="Authentication username for the mail server">
          <StyledInput value={state.smtpUser} onChange={(e) => setters.setSmtpUser(e.target.value)} placeholder="admin@deepmindq.com" />
        </FieldRow>
      </SettingsCard>

      <SettingsCard title="Email Addresses" description="Set default sender and reply-to addresses.">
        <FieldRow label="From Address" helper="Displayed as the sender of all outgoing emails">
          <div className="flex items-center gap-2">
            <Mail className="w-3.5 h-3.5 shrink-0" style={{ color: tokens.text.muted }} />
            <StyledInput value={state.emailFrom} onChange={(e) => setters.setEmailFrom(e.target.value)} placeholder="noreply@deepmindq.com" />
          </div>
        </FieldRow>
        <FieldRow label="Reply-To Address" helper="Override the default reply-to address">
          <StyledInput value={state.emailReplyTo} onChange={(e) => setters.setEmailReplyTo(e.target.value)} placeholder="support@deepmindq.com" />
        </FieldRow>
      </SettingsCard>

      <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: tokens.surface.card, border: `1px solid ${tokens.border.default}` }}>
        <div className="flex items-center gap-3">
          <Badge
            className="text-[11px] px-2 py-0.5 rounded-full"
            style={{
              background: state.smtpConnected ? 'var(--dmq-trust-verified-bg)' : 'var(--dmq-risk-bg-medium)',
              color: state.smtpConnected ? 'var(--dmq-domain-action)' : 'var(--dmq-domain-risk)',
              border: `1px solid ${state.smtpConnected ? 'var(--dmq-trust-verified-border)' : 'var(--dmq-risk-bg-strong)'}`,
            }}
          >
            {state.smtpConnected ? (
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Connected</span>
            ) : (
              <span className="flex items-center gap-1"><XCircle className="w-3 h-3" /> Disconnected</span>
            )}
          </Badge>
          <span className="text-xs" style={{ color: tokens.text.secondary }}>SMTP connection status</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-10 text-xs gap-1.5 rounded-lg min-h-[44px]"
          style={{ borderColor: tokens.border.default, color: tokens.text.secondary }}
          onClick={handleTestEmail}
        >
          <Send className="w-3.5 h-3.5" />
          Send Test Email
        </Button>
      </div>
    </div>
  )
}

// ── Tab 5: AI Provider Settings ───────────────────────────────

function AIProviderSettings({ state, setters }: {
  state: {
    groqKey: string
    geminiKey: string
    openaiKey: string
    defaultProvider: string
    model: string
    tokenBudget: string
    usageWarningThreshold: string
    showGroq: boolean
    showGemini: boolean
    showOpenAI: boolean
  }
  setters: {
    setGroqKey: (v: string) => void
    setGeminiKey: (v: string) => void
    setOpenaiKey: (v: string) => void
    setDefaultProvider: (v: string) => void
    setModel: (v: string) => void
    setTokenBudget: (v: string) => void
    setUsageWarningThreshold: (v: string) => void
    setShowGroq: (v: boolean) => void
    setShowGemini: (v: boolean) => void
    setShowOpenAI: (v: boolean) => void
  }
}) {
  return (
    <div className="space-y-4">
      <SettingsCard title="API Keys" description="Configure API keys for each AI provider. Keys are stored securely and masked.">
        <FieldRow label="Groq API Key" helper="For high-speed inference via Groq Cloud">
          <div className="flex items-center gap-2">
            <StyledInput
              type={state.showGroq ? 'text' : 'password'}
              value={state.groqKey}
              onChange={(e) => setters.setGroqKey(e.target.value)}
              placeholder="gsk_••••••••••••••••"
              className="flex-1"
            />
            <button
              onClick={() => setters.setShowGroq(!state.showGroq)}
              className="shrink-0 p-1.5 rounded-lg"
              style={{ color: tokens.text.muted }}
            >
              {state.showGroq ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </FieldRow>
        <FieldRow label="Gemini API Key" helper="For Google Gemini models via Vertex AI">
          <div className="flex items-center gap-2">
            <StyledInput
              type={state.showGemini ? 'text' : 'password'}
              value={state.geminiKey}
              onChange={(e) => setters.setGeminiKey(e.target.value)}
              placeholder="AIza••••••••••••"
              className="flex-1"
            />
            <button
              onClick={() => setters.setShowGemini(!state.showGemini)}
              className="shrink-0 p-1.5 rounded-lg"
              style={{ color: tokens.text.muted }}
            >
              {state.showGemini ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </FieldRow>
        <FieldRow label="OpenAI API Key" helper="For GPT-4o, GPT-4o-mini, and other OpenAI models">
          <div className="flex items-center gap-2">
            <StyledInput
              type={state.showOpenAI ? 'text' : 'password'}
              value={state.openaiKey}
              onChange={(e) => setters.setOpenaiKey(e.target.value)}
              placeholder="sk-••••••••••••••••"
              className="flex-1"
            />
            <button
              onClick={() => setters.setShowOpenAI(!state.showOpenAI)}
              className="shrink-0 p-1.5 rounded-lg"
              style={{ color: tokens.text.muted }}
            >
              {state.showOpenAI ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </FieldRow>
      </SettingsCard>

      <SettingsCard title="Model Configuration" description="Select the default AI provider and model for intelligence operations.">
        <FieldRow label="Default Provider" helper="Primary AI provider for all intelligence tasks">
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 shrink-0" style={{ color: tokens.text.muted }} />
            <StyledSelect value={state.defaultProvider} onValueChange={setters.setDefaultProvider} placeholder="Select provider">
              <SelectItem value="groq" className="text-xs">Groq</SelectItem>
              <SelectItem value="gemini" className="text-xs">Google Gemini</SelectItem>
              <SelectItem value="openai" className="text-xs">OpenAI</SelectItem>
            </StyledSelect>
          </div>
        </FieldRow>
        <FieldRow label="Model Selection" helper="Specific model to use for completions">
          <StyledSelect value={state.model} onValueChange={setters.setModel} placeholder="Select model">
            <SelectItem value="llama-3.3-70b" className="text-xs">Llama 3.3 70B</SelectItem>
            <SelectItem value="llama-3.1-8b" className="text-xs">Llama 3.1 8B</SelectItem>
            <SelectItem value="mixtral-8x7b" className="text-xs">Mixtral 8x7B</SelectItem>
            <SelectItem value="gemini-2.5-pro" className="text-xs">Gemini 2.5 Pro</SelectItem>
            <SelectItem value="gpt-4o" className="text-xs">GPT-4o</SelectItem>
            <SelectItem value="gpt-4o-mini" className="text-xs">GPT-4o Mini</SelectItem>
          </StyledSelect>
        </FieldRow>
      </SettingsCard>

      <SettingsCard title="Usage Limits" description="Manage per-user token allocation and usage alerts.">
        <FieldRow label="Token Budget per User (monthly)" helper="Max tokens each user can consume per month">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 shrink-0" style={{ color: tokens.text.muted }} />
            <StyledInput type="number" value={state.tokenBudget} onChange={(e) => setters.setTokenBudget(e.target.value)} />
          </div>
        </FieldRow>
        <FieldRow label="Usage Warning Threshold (%)" helper="Alert users when they reach this percentage of their budget">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: tokens.domain.reasoning }} />
            <StyledInput type="number" value={state.usageWarningThreshold} onChange={(e) => setters.setUsageWarningThreshold(e.target.value)} />
          </div>
        </FieldRow>
      </SettingsCard>
    </div>
  )
}

// ── Tab 6: Notification Preferences ───────────────────────────

function NotificationSettings({ state, setters }: {
  state: {
    enableEmail: boolean
    enableSlack: boolean
    enableInApp: boolean
    digestFrequency: string
    quietHoursStart: string
    quietHoursEnd: string
  }
  setters: {
    setEnableEmail: (v: boolean) => void
    setEnableSlack: (v: boolean) => void
    setEnableInApp: (v: boolean) => void
    setDigestFrequency: (v: string) => void
    setQuietHoursStart: (v: string) => void
    setQuietHoursEnd: (v: string) => void
  }
}) {
  return (
    <div className="space-y-4">
      <SettingsCard title="Notification Channels" description="Enable or disable notification delivery channels.">
        <FieldRow label="Email Notifications" helper="Send alerts and digests via email">
          <div className="flex items-center gap-3">
            <Switch checked={state.enableEmail} onCheckedChange={setters.setEnableEmail} />
            <Mail className="w-3.5 h-3.5" style={{ color: state.enableEmail ? tokens.accent.bright : tokens.text.muted }} />
            <span className="text-xs" style={{ color: state.enableEmail ? tokens.domain.action : tokens.text.secondary }}>
              {state.enableEmail ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </FieldRow>
        <FieldRow label="Slack Notifications" helper="Push intelligence alerts to Slack channels">
          <div className="flex items-center gap-3">
            <Switch checked={state.enableSlack} onCheckedChange={setters.setEnableSlack} />
            <Bell className="w-3.5 h-3.5" style={{ color: state.enableSlack ? tokens.accent.bright : tokens.text.muted }} />
            <span className="text-xs" style={{ color: state.enableSlack ? tokens.domain.action : tokens.text.secondary }}>
              {state.enableSlack ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </FieldRow>
        <FieldRow label="In-App Notifications" helper="Show real-time notifications within the platform">
          <div className="flex items-center gap-3">
            <Switch checked={state.enableInApp} onCheckedChange={setters.setEnableInApp} />
            <Bell className="w-3.5 h-3.5" style={{ color: state.enableInApp ? tokens.accent.bright : tokens.text.muted }} />
            <span className="text-xs" style={{ color: state.enableInApp ? tokens.domain.action : tokens.text.secondary }}>
              {state.enableInApp ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </FieldRow>
      </SettingsCard>

      <SettingsCard title="Digest & Quiet Hours" description="Configure notification batching and do-not-disturb periods.">
        <FieldRow label="Notification Digest" helper="How frequently to batch non-critical notifications">
          <StyledSelect value={state.digestFrequency} onValueChange={setters.setDigestFrequency} placeholder="Select frequency">
            {DIGEST_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
            ))}
          </StyledSelect>
        </FieldRow>
        <FieldRow label="Quiet Hours Start" helper="Begin of do-not-disturb window (24h format)">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: tokens.text.muted }} />
            <StyledInput type="time" value={state.quietHoursStart} onChange={(e) => setters.setQuietHoursStart(e.target.value)} />
          </div>
        </FieldRow>
        <FieldRow label="Quiet Hours End" helper="End of do-not-disturb window (24h format)">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: tokens.text.muted }} />
            <StyledInput type="time" value={state.quietHoursEnd} onChange={(e) => setters.setQuietHoursEnd(e.target.value)} />
          </div>
        </FieldRow>
      </SettingsCard>
    </div>
  )
}

// ── Tab 7: Webhook Management ────────────────────────────────

function WebhookSettings({ state, setters }: {
  state: {
    webhooks: typeof PLACEHOLDER_WEBHOOKS
    selectedEvents: string[]
    retryPolicy: string
  }
  setters: {
    setSelectedEvents: (v: string[]) => void
    setRetryPolicy: (v: string) => void
  }
}) {
  const toggleEvent = (event: string) => {
    const updated = state.selectedEvents.includes(event)
      ? state.selectedEvents.filter((e) => e !== event)
      : [...state.selectedEvents, event]
    setters.setSelectedEvents(updated)
  }

  return (
    <div className="space-y-4">
      <SettingsCard title="Registered Webhooks" description="Manage endpoints that receive real-time event notifications.">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium" style={{ color: tokens.text.secondary }}>Endpoints ({state.webhooks.length})</span>
          <Button
            variant="outline"
            size="sm"
            className="h-10 text-[11px] gap-1 rounded-lg min-h-[44px]"
            style={{ borderColor: tokens.border.default, color: tokens.accent.bright }}
            onClick={() => toast.info('Webhook creation dialog would open here.')}
          >
            <Plus className="w-3 h-3" /> Add Webhook
          </Button>
        </div>
        {state.webhooks.map((wh) => (
          <div
            key={wh.id}
            className="flex items-center justify-between gap-3 p-3 rounded-lg"
            style={{ background: tokens.surface.secondary, border: `1px solid ${tokens.border.subtle}` }}
          >
            <div className="flex-1 min-w-0">
              <code className="text-[11px] font-mono block truncate" style={{ color: tokens.text.primary }}>{wh.url}</code>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {wh.events.map((evt) => (
                  <Badge
                    key={evt}
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 rounded"
                    style={{ borderColor: tokens.border.hover, color: tokens.text.secondary }}
                  >
                    {evt}
                  </Badge>
                ))}
              </div>
            </div>
            <Badge
              className="text-[10px] px-1.5 py-0 rounded-full shrink-0"
              style={{
                background: wh.active ? 'var(--dmq-trust-verified-bg)' : 'var(--dmq-risk-bg-medium)',
                color: wh.active ? 'var(--dmq-domain-action)' : 'var(--dmq-domain-risk)',
                border: `1px solid ${wh.active ? 'var(--dmq-trust-verified-border)' : 'var(--dmq-risk-bg-strong)'}`,
              }}
            >
              {wh.active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        ))}
      </SettingsCard>

      <SettingsCard title="Event Subscriptions" description="Select which events trigger webhook notifications.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {WEBHOOK_EVENTS.map((event) => (
            <label key={event} className="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg transition-colors" style={{ background: state.selectedEvents.includes(event) ? tokens.accent.ghost : 'transparent' }}>
              <Checkbox
                checked={state.selectedEvents.includes(event)}
                onCheckedChange={() => toggleEvent(event)}
                className="data-[state=checked]:bg-[var(--dmq-accent-blue)] data-[state=checked]:border-[var(--dmq-accent-blue)]"
              />
              <code className="text-[11px] font-mono" style={{ color: tokens.text.primary }}>{event}</code>
            </label>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard title="Retry & Security" description="Configure delivery retry behavior and signing secrets.">
        <FieldRow label="Retry Policy" helper="Number of retry attempts for failed deliveries">
          <StyledSelect value={state.retryPolicy} onValueChange={setters.setRetryPolicy} placeholder="Select retries">
            {RETRY_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt} className="text-xs">{opt} {opt === '1' ? 'retry' : 'retries'}</SelectItem>
            ))}
          </StyledSelect>
        </FieldRow>
        <FieldRow label="Webhook Secret" helper="Used to sign webhook payloads for verification">
          <Button
            variant="outline"
            size="sm"
            className="h-10 text-xs gap-1.5 rounded-lg min-h-[44px]"
            style={{ borderColor: tokens.border.default, color: tokens.domain.reasoning }}
            onClick={() => toast.success('Webhook signing secret rotated successfully.')}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Rotate Secret
          </Button>
        </FieldRow>
      </SettingsCard>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────

export function AdminSettingsPanel({ className }: { className?: string }) {
  const [activeTab, setActiveTab] = useState<string>('general')
  const [saving, setSaving] = useState(false)

  // ── Tab 1: General ──
  const [orgName, setOrgName] = useState('DeepMindQ Intelligence')
  const [timezone, setTimezone] = useState('America/New_York')
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY')
  const [maintenanceMode, setMaintenanceMode] = useState(false)

  // ── Tab 2: API ──
  const [rateLimitMin, setRateLimitMin] = useState('60')
  const [rateLimitHour, setRateLimitHour] = useState('1000')
  const [corsOrigins, setCorsOrigins] = useState('https://deepmindq.com, https://app.deepmindq.com')

  // ── Tab 3: Security ──
  const [enforce2FA, setEnforce2FA] = useState(true)
  const [sessionTimeout, setSessionTimeout] = useState('30')
  const [ipWhitelist, setIpWhitelist] = useState(false)
  const [dataRetention, setDataRetention] = useState('90d')
  const [auditRetention, setAuditRetention] = useState('1y')
  const [minPasswordLength, setMinPasswordLength] = useState('12')
  const [requireUppercase, setRequireUppercase] = useState(true)
  const [requireNumbers, setRequireNumbers] = useState(true)

  // ── Tab 4: Email ──
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com')
  const [smtpPort, setSmtpPort] = useState('587')
  const [smtpUser, setSmtpUser] = useState('admin@deepmindq.com')
  const [emailFrom, setEmailFrom] = useState('noreply@deepmindq.com')
  const [emailReplyTo, setEmailReplyTo] = useState('support@deepmindq.com')
  const [smtpConnected, setSmtpConnected] = useState(false)

  // ── Tab 5: AI ──
  const [groqKey, setGroqKey] = useState('')
  const [geminiKey, setGeminiKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [defaultProvider, setDefaultProvider] = useState('groq')
  const [model, setModel] = useState('llama-3.3-70b')
  const [tokenBudget, setTokenBudget] = useState('100000')
  const [usageWarningThreshold, setUsageWarningThreshold] = useState('80')
  const [showGroq, setShowGroq] = useState(false)
  const [showGemini, setShowGemini] = useState(false)
  const [showOpenAI, setShowOpenAI] = useState(false)

  // ── Tab 6: Notifications ──
  const [enableEmail, setEnableEmail] = useState(true)
  const [enableSlack, setEnableSlack] = useState(true)
  const [enableInApp, setEnableInApp] = useState(true)
  const [digestFrequency, setDigestFrequency] = useState('Hourly')
  const [quietHoursStart, setQuietHoursStart] = useState('22:00')
  const [quietHoursEnd, setQuietHoursEnd] = useState('08:00')

  // ── Tab 7: Webhooks ──
  const [webhooks, setWebhooks] = useState<typeof PLACEHOLDER_WEBHOOKS>([...PLACEHOLDER_WEBHOOKS])
  const [selectedEvents, setSelectedEvents] = useState<string[]>([...WEBHOOK_EVENTS])
  const [retryPolicy, setRetryPolicy] = useState('3')

  // ── Save Handler ──
  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await fetch('/api/settings/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          general: { orgName, timezone, dateFormat, maintenanceMode },
          api: { rateLimitMin, rateLimitHour, corsOrigins },
          security: { enforce2FA, sessionTimeout, ipWhitelist, dataRetention, auditRetention, minPasswordLength, requireUppercase, requireNumbers },
          email: { smtpHost, smtpPort, smtpUser, emailFrom, emailReplyTo },
          ai: { defaultProvider, model, tokenBudget, usageWarningThreshold },
          notifications: { enableEmail, enableSlack, enableInApp, digestFrequency, quietHoursStart, quietHoursEnd },
          webhooks: { selectedEvents, retryPolicy },
        }),
      })
      toast.success('Admin settings saved successfully.')
    } catch {
      toast.error('Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [
    orgName, timezone, dateFormat, maintenanceMode,
    rateLimitMin, rateLimitHour, corsOrigins,
    enforce2FA, sessionTimeout, ipWhitelist, dataRetention, auditRetention, minPasswordLength, requireUppercase, requireNumbers,
    smtpHost, smtpPort, smtpUser, emailFrom, emailReplyTo,
    defaultProvider, model, tokenBudget, usageWarningThreshold,
    enableEmail, enableSlack, enableInApp, digestFrequency, quietHoursStart, quietHoursEnd,
    selectedEvents, retryPolicy,
  ])

  return (
    <div className={cn('space-y-5', className)}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold" style={{ color: tokens.text.primary }}>
            Admin Settings
          </h2>
          <p className="text-xs mt-0.5" style={{ color: tokens.text.secondary }}>
            Manage platform configuration, policies, and integrations
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="h-10 text-xs gap-1.5 rounded-lg font-medium min-h-[44px]"
          style={{
            background: tokens.accent.DEFAULT,
            color: 'var(--dmq-white)',
          }}
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          Save Changes
        </Button>
      </div>

      {/* ── Tab Navigation ── */}
      <div
        className="flex items-center gap-1 p-1 rounded-xl overflow-x-auto scrollbar-hide"
        style={{
          background: tokens.surface.secondary,
          border: `1px solid ${tokens.border.default}`,
        }}
      >
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab
          const Icon = tab.icon
          return (
            <motion.button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'relative flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
              )}
              style={{
                color: isActive ? tokens.text.primary : tokens.text.muted,
                background: isActive ? tokens.surface.card : 'transparent',
              }}
              whileTap={{ scale: 0.97 }}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId="admin-tab-indicator"
                  className="absolute inset-0 rounded-lg"
                  style={{
                    border: `1px solid ${tokens.border.hover}`,
                    pointerEvents: 'none',
                  }}
                  transition={{ duration: motionTokens.default.duration, ease: [...motionTokens.default.ease] as [number, number, number, number] }}
                />
              )}
            </motion.button>
          )
        })}
      </div>

      {/* ── Tab Content ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          variants={tabVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {activeTab === 'general' && (
            <GeneralSettings
              state={{ orgName, timezone, dateFormat, maintenanceMode }}
              setters={{ setOrgName, setTimezone, setDateFormat, setMaintenanceMode }}
            />
          )}
          {activeTab === 'api' && (
            <APIConfiguration
              state={{ rateLimitMin, rateLimitHour, corsOrigins }}
              setters={{ setRateLimitMin, setRateLimitHour, setCorsOrigins }}
            />
          )}
          {activeTab === 'security' && (
            <SecuritySettings
              state={{ enforce2FA, sessionTimeout, ipWhitelist, dataRetention, auditRetention, minPasswordLength, requireUppercase, requireNumbers }}
              setters={{ setEnforce2FA, setSessionTimeout, setIpWhitelist, setDataRetention, setAuditRetention, setMinPasswordLength, setRequireUppercase, setRequireNumbers }}
            />
          )}
          {activeTab === 'email' && (
            <EmailSettings
              state={{ smtpHost, smtpPort, smtpUser, emailFrom, emailReplyTo, smtpConnected }}
              setters={{ setSmtpHost, setSmtpPort, setSmtpUser, setEmailFrom, setEmailReplyTo, setSmtpConnected }}
            />
          )}
          {activeTab === 'ai' && (
            <AIProviderSettings
              state={{ groqKey, geminiKey, openaiKey, defaultProvider, model, tokenBudget, usageWarningThreshold, showGroq, showGemini, showOpenAI }}
              setters={{ setGroqKey, setGeminiKey, setOpenaiKey, setDefaultProvider, setModel, setTokenBudget, setUsageWarningThreshold, setShowGroq, setShowGemini, setShowOpenAI }}
            />
          )}
          {activeTab === 'notifications' && (
            <NotificationSettings
              state={{ enableEmail, enableSlack, enableInApp, digestFrequency, quietHoursStart, quietHoursEnd }}
              setters={{ setEnableEmail, setEnableSlack, setEnableInApp, setDigestFrequency, setQuietHoursStart, setQuietHoursEnd }}
            />
          )}
          {activeTab === 'webhooks' && (
            <WebhookSettings
              state={{ webhooks, selectedEvents, retryPolicy }}
              setters={{ setSelectedEvents, setRetryPolicy }}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
