'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Eye, EyeOff, Download, Stethoscope, Save, Loader2, Mail,
  Cpu, Database, Trash2, AlertTriangle, Settings, Sparkles,
  ExternalLink, CheckCircle2, XCircle, Palette, Shield,
  ChevronRight, ArrowRight, LayoutGrid, ClipboardList,
} from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { fetchApi } from '@/lib/fetchApi'
import { relativeDate } from '@/lib/date'
import { useTheme } from 'next-themes'
import type { AuditLogEntry } from '@/lib/types'

/* ═══════════════════════════════════════════════════════════════
   Constants & Defaults
   ═══════════════════════════════════════════════════════════════ */

const DEFAULTS = {
  tone: 'professional-casual',
  emailLength: 'medium',
  openerStyle: 'Hi [First Name]',
  signOff: 'Best regards',
  avoidPhrases: '',
  ctaStyle: 'soft',
  aiProvider: 'openai',
  aiModel: 'gpt-4o-mini',
  aiApiKey: '',
}

const TOGGLE_ACTIVE = 'bg-amber-600 text-white shadow-xs'
const TOGGLE_INACTIVE = 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'

/* ═══════════════════════════════════════════════════════════════
   Live Email Preview Generator
   ═══════════════════════════════════════════════════════════════ */

function generateLivePreview(tone: string, length: string, cta: string, opener: string, signOff: string) {
  const firstName = 'John'
  const companyName = 'Acme Corp'
  const jobTitle = 'VP of Operations'

  const bodies: Record<string, Record<string, string>> = {
    'professional-casual': {
      short: `Hi ${firstName},\n\nI came across ${companyName} and was impressed by your work in the ${jobTitle} space. I'd love to explore how we might be able to add value.\n\nWould a quick 10-minute chat work this week?\n\n${signOff}`,
      medium: `Hi ${firstName},\n\nI've been following ${companyName}'s recent momentum in the ${jobTitle} domain, and it caught my attention. Our team has helped similar organizations streamline their operations with measurable results — think 30-40% efficiency gains in the first quarter.\n\n${cta === 'direct' ? 'Could we schedule a 15-minute call this Thursday at 2 PM to discuss a potential fit?' : "Would you be open to a brief conversation this week to explore if there's alignment?"}\n\n${signOff}`,
      detailed: `Hi ${firstName},\n\nI hope this message finds you well. I've been researching ${companyName} and I'm genuinely impressed by the direction you're taking in the ${jobTitle} area. The market signals suggest this is a particularly exciting time for your team.\n\nAt DeepMindQ, we've been working with organizations facing similar challenges to what I imagine ${companyName} is navigating. Our approach combines AI-driven intelligence with hands-on strategic consulting, and the results have been compelling — our clients typically see significant improvements in their key metrics within the first quarter of engagement.\n\n${cta === 'direct' ? `I'd love to show you a brief 15-minute demo of what this could look like for ${companyName}. Could we schedule a call this Thursday?` : "Would you be open to exploring this further? I'd be happy to share some relevant case studies."}\n\n${signOff}`,
    },
    formal: {
      short: `Dear ${firstName},\n\nI am writing to introduce DeepMindQ and explore a potential collaboration with ${companyName}.\n\n${cta === 'direct' ? 'May I request a brief meeting at your earliest convenience?' : `I would welcome the opportunity to discuss how our services might align with ${companyName}'s objectives.`}\n\n${signOff}`,
      medium: `Dear ${firstName},\n\nI am writing to introduce DeepMindQ's enterprise intelligence platform. We specialize in helping organizations in the ${jobTitle} space streamline their operations. Our recent work with similar companies has demonstrated measurable improvements in operational efficiency.\n\n${cta === 'direct' ? 'May I request a brief meeting at your earliest convenience?' : `I would welcome the opportunity to discuss how our services might align with ${companyName}'s strategic objectives.`}\n\n${signOff}`,
      detailed: `Dear ${firstName},\n\nI am writing to introduce DeepMindQ and explore a potential collaboration with ${companyName}.\n\nOur firm specializes in AI-powered sales intelligence and strategic consulting. We have observed ${companyName}'s growth trajectory and believe there may be compelling synergies worth discussing.\n\nAt DeepMindQ, we have developed a comprehensive approach to helping organizations like yours achieve operational excellence. Our methodology is grounded in data-driven insights and has been validated across multiple industry verticals.\n\n${cta === 'direct' ? 'May I request a brief meeting at your earliest convenience to discuss this in more detail?' : `I would welcome the opportunity to schedule an introductory conversation at your convenience.`}\n\n${signOff}`,
    },
    direct: {
      short: `${firstName},\n\n${companyName} looks like it's doing great things. Quick question: have you considered optimizing your ${jobTitle} workflow? We've helped teams like yours 3x their output.\n\n${cta === 'direct' ? "Let's talk Thursday 2 PM — 15 minutes max." : "Open to a chat if you're curious?"}\n\n${signOff}`,
      medium: `${firstName},\n\nI notice ${companyName} is growing fast in the ${jobTitle} space. That usually means process bottlenecks — the kind we solve.\n\nWe've helped similar companies cut lead times by 34%. ${companyName} could benefit from the same approach.\n\n${cta === 'direct' ? "Let's cut to it — 15 min call this Thursday?" : "Worth 15 minutes of your time this week to explore if there's a fit."}\n\n${signOff}`,
      detailed: `${firstName},\n\nI notice ${companyName} is growing fast in the ${jobTitle} space. That usually means process bottlenecks — the kind we solve.\n\nWe've helped three companies in your space this quarter alone. Average result: 34% reduction in lead times, 28% cost savings on procurement.\n\n${cta === 'direct' ? 'Thursday 2 PM — can you make 15 minutes?' : `If you're curious, I have a short demo showing exactly how this works for companies like ${companyName}.`}\n\n${signOff}`,
    },
  }

  const toneBodies = bodies[tone] || bodies['professional-casual']
  const body = toneBodies[length || 'medium'] || toneBodies['medium']
  const ctas: Record<string, string> = {
    soft: `Soft Ask — "Would you be open to a brief conversation this week?"`,
    direct: `Direct Ask — "Can we schedule a 15-minute call this Thursday?"`,
  }
  const subject = `${cta === 'direct' ? 'Direct' : 'Quick'} question about ${companyName}'s ${jobTitle} strategy`

  return { subject, body, ctaDescription: ctas[cta] || ctas.soft }
}

/* ═══════════════════════════════════════════════════════════════
   Toggle Button Group (reusable)
   ═══════════════════════════════════════════════════════════════ */

function SettingsToggleGroup<T extends string>({
  label,
  description,
  options,
  value,
  onChange,
}: {
  label: string
  description?: string
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-700 block mb-1.5">{label}</label>
      {description && <p className="text-[11px] text-gray-400 mb-2">{description}</p>}
      <div className="flex items-center gap-2 flex-wrap">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
              value === opt.value ? TOGGLE_ACTIVE : TOGGLE_INACTIVE,
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Audit Logs Tab (compact view for Settings)
   ═══════════════════════════════════════════════════════════════ */

const ACTION_STYLES: Record<string, string> = {
  create: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  update: 'bg-blue-50 text-blue-700 border-blue-200',
  delete: 'bg-red-50 text-red-700 border-red-200',
  login: 'bg-violet-50 text-violet-700 border-violet-200',
  logout: 'bg-violet-50 text-violet-600 border-violet-200',
  export: 'bg-amber-50 text-amber-700 border-amber-200',
  import: 'bg-sky-50 text-sky-700 border-sky-200',
}

function AuditLogsTab() {
  const { setActiveView } = useAppStore()

  const { data: recentData } = useQuery({
    queryKey: ['audit-logs-recent'],
    queryFn: () => fetchApi<{ data: AuditLogEntry[]; total: number }>('/api/audit-logs', {
      params: { limit: 5, offset: 0 },
    }),
    select: (res) => res.data,
  })

  const { data: statsData } = useQuery({
    queryKey: ['audit-logs-stats'],
    queryFn: () => fetchApi<{ data: AuditLogEntry[]; total: number }>('/api/audit-logs', {
      params: { limit: 0, offset: 0 },
    }),
    select: (res) => res.data,
  })

  const recentLogs = recentData?.data ?? []
  const totalCount = statsData?.total ?? 0

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white card-rest p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <LayoutGrid className="size-4.5 text-amber-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{totalCount}</p>
            <p className="text-[11px] text-gray-500">Total log entries</p>
          </div>
        </div>
        <div className="rounded-xl bg-white card-rest p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
            <Shield className="size-4.5 text-emerald-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{recentLogs.length}</p>
            <p className="text-[11px] text-gray-500">Recent entries shown</p>
          </div>
        </div>
      </div>

      {/* View Full Audit Logs CTA */}
      <div className="rounded-xl bg-white card-rest p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Full Audit Log Viewer</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              View all audit logs with advanced filtering, search, and CSV export capabilities.
            </p>
          </div>
          <Button
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm press-scale shrink-0"
            onClick={() => setActiveView('audit-logs')}
          >
            <ArrowRight className="size-3.5 mr-1.5" />
            View Full Audit Logs
          </Button>
        </div>
      </div>

      {/* Recent 5 Entries */}
      <div className="rounded-xl bg-white card-rest p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Shield className="size-4 text-gray-400" />
          Recent Activity
        </h3>

        {recentLogs.length === 0 ? (
          <div className="text-center py-8">
            <ClipboardList className="size-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-500">No audit logs recorded yet.</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Activity will appear here as you use the platform.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] font-medium px-2 py-0.5 rounded-md border capitalize shrink-0',
                    ACTION_STYLES[log.action] || 'bg-gray-50 text-gray-600 border-gray-200',
                  )}
                >
                  {log.action}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 truncate">
                    <span className="font-medium">{log.user?.name ?? 'System'}</span>
                    <span className="text-gray-400 mx-1">·</span>
                    {log.entity}{log.entityId ? ` #${log.entityId.slice(0, 8)}` : ''}
                    {log.details && (
                      <>
                        <span className="text-gray-400 mx-1">·</span>
                        <span className="text-gray-500">{log.details.length > 50 ? log.details.slice(0, 50) + '…' : log.details}</span>
                      </>
                    )}
                  </p>
                </div>
                <span className="text-[11px] text-gray-400 shrink-0">{relativeDate(log.createdAt)}</span>
                <ChevronRight className="size-3.5 text-gray-300 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Main Settings Screen
   ═══════════════════════════════════════════════════════════════ */

export function SettingsScreen() {
  const qc = useQueryClient()
  const { setActiveView } = useAppStore()
  const [draft, setDraft] = useState<Record<string, string> | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [dangerOpen, setDangerOpen] = useState(false)
  const [healthCheckOpen, setHealthCheckOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('email')
  const [aiTestResult, setAiTestResult] = useState<{
    success: boolean
    email?: { subject: string; body: string }
    score?: number
    error?: string
  } | null>(null)
  const [justSavedAi, setJustSavedAi] = useState(false)
  // ── Appearance state (synced with next-themes) ──
  const { theme: nextTheme, setTheme: setNextTheme } = useTheme()
  const [appearanceTheme, setAppearanceTheme] = useState('system')
  const [appearanceDensity, setAppearanceDensity] = useState('comfortable')
  const [appearanceSidebar, setAppearanceSidebar] = useState('expanded')

  // Sync next-themes with local appearance state
  const handleThemeChange = useCallback((value: string) => {
    setAppearanceTheme(value)
    setNextTheme(value)
  }, [setNextTheme])

  // Keep local appearanceTheme in sync with actual resolved theme
  useEffect(() => {
    if (nextTheme) setAppearanceTheme(nextTheme)
  }, [nextTheme])

  // ── Preferences ──
  const { data: prefs, isLoading, error: prefsError } = useQuery({
    queryKey: ['preferences'],
    queryFn: () => fetch('/api/preferences').then(r => r.json()),
  })

  const form = { ...DEFAULTS, ...prefs, ...draft }
  const savedValues = useMemo(() => ({ ...DEFAULTS, ...prefs }), [prefs])
  const currentValues = useMemo(() => ({ ...DEFAULTS, ...prefs, ...draft }), [prefs, draft])

  // ── Unsaved changes tracking ──
  const hasChanges = useMemo(() => {
    if (!draft) return false
    return Object.keys(draft).some(k => (draft as any)[k] !== (savedValues as any)[k])
  }, [draft, savedValues])

  const handleDiscard = useCallback(() => { setDraft(null) }, [])

  useEffect(() => {
    window.onbeforeunload = hasChanges ? () => '' : null
    return () => { window.onbeforeunload = null }
  }, [hasChanges])

  // ── API Key validation ──
  const apiKeyValidation = useMemo(() => {
    const key = form.aiApiKey
    if (!key) return null
    if (form.aiProvider === 'openai' && !key.startsWith('sk-')) {
      return 'OpenAI keys typically start with "sk-"'
    }
    if (form.aiProvider === 'gemini' && !key.startsWith('AIza')) {
      return 'Gemini keys typically start with "AIza"'
    }
    if (form.aiProvider === 'groq' && !key.startsWith('gsk_')) {
      return 'Groq keys typically start with "gsk_"'
    }
    if (key.length < 10) {
      return 'API key seems too short'
    }
    return null
  }, [form.aiApiKey, form.aiProvider])

  // ── Save preferences ──
  const savePrefs = useMutation({
    mutationFn: (data: Record<string, string>) =>
      fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      toast.success('Preferences saved')
      setDraft(null)
      qc.invalidateQueries({ queryKey: ['preferences'] })
    },
    onError: () => toast.error('Failed to save preferences'),
  })

  // ── Test AI Connection ──
  const testAiMutation = useMutation({
    mutationFn: async () => {
      const contactsRes = await fetch('/api/contacts?pageSize=1')
      const contactsData = await contactsRes.json()
      if (!contactsData.contacts?.length) throw new Error('No contacts in database to test with. Add a contact first.')

      const contactId = contactsData.contacts[0].id
      const res = await fetch(`/api/contacts/${contactId}/generate-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tone: form.tone, emailLength: 'short', ctaStyle: 'soft' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Test failed' }))
        throw new Error(err.error || 'Test failed')
      }
      return res.json()
    },
    onSuccess: (data) => {
      setAiTestResult({
        success: true,
        email: { subject: data.subject, body: data.body },
        score: data.matchScore,
      })
      toast.success(`AI connection successful! Generated test email with ${data.matchScore}% match score`)
    },
    onError: (e: Error) => {
      setAiTestResult({ success: false, error: e.message })
      toast.error(`AI test failed: ${e.message}`)
    },
  })

  // ── Export CSV ──
  const handleExport = useMutation({
    mutationFn: async () => {
      const compRes = await fetch('/api/export?type=companies')
      const compBlob = await compRes.blob()
      const compUrl = URL.createObjectURL(compBlob)
      const a = document.createElement('a')
      a.href = compUrl
      a.download = 'deepmindq-companies.csv'
      a.click()
      URL.revokeObjectURL(compUrl)

      const contRes = await fetch('/api/export?type=contacts')
      const contBlob = await contRes.blob()
      const contUrl = URL.createObjectURL(contBlob)
      const b = document.createElement('a')
      b.href = contUrl
      b.download = 'deepmindq-contacts.csv'
      b.click()
      URL.revokeObjectURL(contUrl)
    },
    onSuccess: () => toast.success('Companies and contacts exported as CSV successfully'),
    onError: () => toast.error('Export failed — please try again'),
  })

  // ── Health Check ──
  const handleHealthCheck = useMutation({
    mutationFn: () =>
      fetch('/api/health-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkAll: true }),
      }).then(r => r.json()),
    onSuccess: (d) => {
      setHealthCheckOpen(false)
      toast.success(`Health check complete: ${d.valid} valid, ${d.invalid} invalid out of ${d.checked} emails`)
    },
    onError: () => {
      setHealthCheckOpen(false)
      toast.error('Health check failed')
    },
  })

  // ── Delete All Data ──
  const handleDeleteAll = useMutation({
    mutationFn: () => fetch('/api/reset', { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => {
      toast.success('All data deleted successfully')
      setDangerOpen(false)
      qc.invalidateQueries({ queryKey: ['companies'] })
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: () => toast.error('Failed to delete data'),
  })

  const set = (k: string, v: string) => {
    setDraft(p => ({ ...(p || {}), [k]: v }))
    setJustSavedAi(false)
  }

  const handleSaveAiConfig = () => {
    savePrefs.mutate({ aiProvider: form.aiProvider, aiModel: form.aiModel, aiApiKey: form.aiApiKey })
    setJustSavedAi(true)
    setAiTestResult(null)
  }

  const handleSaveEmailStyle = () => {
    savePrefs.mutate({
      tone: form.tone,
      emailLength: form.emailLength,
      openerStyle: form.openerStyle,
      signOff: form.signOff,
      avoidPhrases: form.avoidPhrases,
      ctaStyle: form.ctaStyle,
    })
  }

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="max-w-3xl space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-56 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    )
  }

  // ── Error state ──
  if (prefsError) {
    return (
      <div className="max-w-3xl">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 flex items-start gap-3">
          <AlertTriangle className="size-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700">Failed to load settings</p>
            <p className="text-xs text-red-500 mt-1">Please try refreshing the page.</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Live preview data ──
  const preview = generateLivePreview(form.tone, form.emailLength, form.ctaStyle, form.openerStyle, form.signOff)

  return (
    <div className="max-w-3xl">
      {/* ═══════════════════════════════════════════════════════
          Unsaved Changes Warning Bar
         ═══════════════════════════════════════════════════════ */}
      {hasChanges && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 animate-in slide-in-from-top-2 duration-200">
          <p className="text-sm text-amber-800 font-medium">You have unsaved changes</p>
          <div className="flex items-center gap-2 self-end">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100 rounded-lg"
              onClick={handleDiscard}
            >
              Discard
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale"
              onClick={() => savePrefs.mutate(currentValues)}
              disabled={savePrefs.isPending}
            >
              {savePrefs.isPending && <Loader2 className="size-3 mr-1 animate-spin" />}
              Save All
            </Button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          Header
         ═══════════════════════════════════════════════════════ */}
      <div className="mb-6">
        <h1 className="text-lg font-bold text-gray-900 tracking-tight">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure your workspace, AI preferences, and data management.</p>
      </div>

      {/* ═══════════════════════════════════════════════════════
          Tabs
         ═══════════════════════════════════════════════════════ */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100 rounded-lg p-1 h-auto gap-0.5 mb-6 overflow-x-auto">
          {[
            { value: 'email', label: 'Email Style', icon: Mail },
            { value: 'ai', label: 'AI Config', icon: Cpu },
            { value: 'appearance', label: 'Appearance', icon: Palette },
            { value: 'data', label: 'Data', icon: Database },
            { value: 'audit', label: 'Audit Logs', icon: Shield },
            { value: 'danger', label: 'Advanced', icon: AlertTriangle },
          ].map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-md text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 data-[state=active]:font-medium text-gray-500 hover:text-gray-700 transition-colors px-2 sm:px-3 py-2 flex items-center gap-1.5 whitespace-nowrap"
            >
              <tab.icon className="size-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ═══════════════════════════════════════════════════════
            Tab: Email Style
           ═══════════════════════════════════════════════════════ */}
        <TabsContent value="email" className="space-y-6">
          <div className="rounded-xl bg-white card-rest p-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Email Generation Preferences</h3>
              <p className="text-xs text-gray-500 mt-0.5">These settings control how AI generates outreach emails for your contacts.</p>
            </div>

            {/* Toggle Selectors */}
            <SettingsToggleGroup
              label="Tone"
              description="The voice and personality of your emails"
              options={[
                { value: 'formal', label: 'Formal' },
                { value: 'professional-casual', label: 'Professional-Casual' },
                { value: 'direct', label: 'Direct' },
              ]}
              value={form.tone}
              onChange={v => set('tone', v)}
            />

            <SettingsToggleGroup
              label="Length"
              description="How long the generated emails should be"
              options={[
                { value: 'short', label: 'Short' },
                { value: 'medium', label: 'Medium' },
                { value: 'detailed', label: 'Detailed' },
              ]}
              value={form.emailLength}
              onChange={v => set('emailLength', v)}
            />

            <SettingsToggleGroup
              label="CTA Style"
              description="How the call-to-action is framed"
              options={[
                { value: 'soft', label: 'Soft Ask' },
                { value: 'direct', label: 'Direct Ask' },
              ]}
              value={form.ctaStyle}
              onChange={v => set('ctaStyle', v)}
            />

            <Separator className="bg-gray-100" />

            {/* Text Inputs */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1.5">Opener Style</label>
              <Input
                value={form.openerStyle}
                onChange={e => set('openerStyle', e.target.value)}
                className="h-9 border-gray-200 rounded-lg text-sm"
                placeholder="Hi [First Name]"
              />
              <p className="text-[11px] text-gray-400 mt-1">How each email begins. Use [First Name] as a placeholder.</p>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1.5">Sign-off</label>
              <Input
                value={form.signOff}
                onChange={e => set('signOff', e.target.value)}
                className="h-9 border-gray-200 rounded-lg text-sm"
                placeholder="Best regards"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1.5">Avoid Phrases</label>
              <Textarea
                value={form.avoidPhrases}
                onChange={e => set('avoidPhrases', e.target.value)}
                rows={3}
                className="border-gray-200 rounded-lg resize-none text-sm"
                placeholder="One phrase per line. These will be excluded from generated emails."
              />
              <p className="text-[11px] text-gray-400 mt-1">Phrases the AI should avoid using in generated emails.</p>
            </div>

            <div className="flex justify-end">
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm press-scale"
                onClick={handleSaveEmailStyle}
                disabled={savePrefs.isPending}
              >
                {savePrefs.isPending ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Save className="size-3.5 mr-1.5" />}
                Save Preferences
              </Button>
            </div>
          </div>

          {/* Live Preview */}
          <div className="rounded-xl bg-white card-rest p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Mail className="size-4 text-gray-400" />
                Live Email Preview
              </h3>
              <Badge className="bg-gray-100 text-gray-500 border border-gray-200 text-[10px]">
                Sample · John at Acme Corp
              </Badge>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-5 space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Subject</p>
                <p className="text-sm font-semibold text-gray-900">{preview.subject}</p>
              </div>
              <Separator className="bg-gray-200/60" />
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                {preview.body}
              </pre>
            </div>
            <p className="text-[11px] text-gray-400">
              This is a sample preview. Actual emails will be personalized per contact using AI and research data.
            </p>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            Tab: AI Configuration
           ═══════════════════════════════════════════════════════ */}
        <TabsContent value="ai" className="space-y-6">
          <div className="rounded-xl bg-white card-rest p-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">AI Provider Configuration</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Configure your AI provider and API key for intelligent, personalized email generation.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1.5">AI Provider</label>
                <Select value={form.aiProvider} onValueChange={v => set('aiProvider', v)}>
                  <SelectTrigger className="h-9 border-gray-200 rounded-lg text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="gemini">Google Gemini</SelectItem>
                    <SelectItem value="groq">Groq</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1.5">Model</label>
                <Input
                  value={form.aiModel}
                  onChange={e => set('aiModel', e.target.value)}
                  className="h-9 border-gray-200 rounded-lg text-sm"
                  placeholder="gpt-4o-mini"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  {form.aiProvider === 'openai' && 'e.g. gpt-4o-mini, gpt-4o, gpt-3.5-turbo'}
                  {form.aiProvider === 'gemini' && 'e.g. gemini-2.0-flash, gemini-1.5-pro'}
                  {form.aiProvider === 'groq' && 'e.g. llama-3.3-70b-versatile, mixtral-8x7b-32768'}
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1.5">API Key</label>
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={form.aiApiKey}
                  onChange={e => set('aiApiKey', e.target.value)}
                  className={cn(
                    'h-9 pr-10 border-gray-200 rounded-lg text-sm font-mono',
                    apiKeyValidation && 'border-amber-300 focus:border-amber-400 focus:ring-amber-100'
                  )}
                  placeholder="sk-..."
                />
                <button
                  type="button"
                  className="absolute right-0 top-0 h-9 px-3 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                  onClick={() => setShowKey(p => !p)}
                >
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {apiKeyValidation && (
                <p className="text-[11px] text-amber-600 mt-1.5 flex items-center gap-1">
                  <AlertTriangle className="size-3 shrink-0" />
                  {apiKeyValidation}
                </p>
              )}
              <p className="text-[11px] text-gray-400 mt-1.5">
                Your API key is encrypted and stored securely. It is never shared or transmitted to third parties.
              </p>
            </div>

            <Separator className="bg-gray-100" />

            {/* Test Connection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Test AI Connection</h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Sends a test email generation request using your first contact to verify the API key works.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gray-200 text-gray-600 rounded-lg text-xs shrink-0"
                  onClick={() => { setAiTestResult(null); testAiMutation.mutate() }}
                  disabled={testAiMutation.isPending || !form.aiApiKey}
                >
                  {testAiMutation.isPending ? (
                    <><Loader2 className="size-3 mr-1.5 animate-spin" /> Testing...</>
                  ) : (
                    <><Stethoscope className="size-3 mr-1.5" /> Test Connection</>
                  )}
                </Button>
              </div>

              {/* Test Result */}
              {aiTestResult && (
                <div className={cn(
                  'rounded-xl border p-4 space-y-3 animate-in fade-in-0 slide-in-from-bottom-1 duration-200',
                  aiTestResult.success
                    ? 'bg-emerald-50/50 border-emerald-200'
                    : 'bg-red-50/50 border-red-200'
                )}>
                  <div className="flex items-center gap-2">
                    {aiTestResult.success ? (
                      <>
                        <CheckCircle2 className="size-4 text-emerald-600" />
                        <span className="text-sm font-semibold text-emerald-800">Connection Successful</span>
                        {aiTestResult.score != null && (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                            {aiTestResult.score}% match
                          </Badge>
                        )}
                      </>
                    ) : (
                      <>
                        <XCircle className="size-4 text-red-600" />
                        <span className="text-sm font-semibold text-red-800">Connection Failed</span>
                      </>
                    )}
                  </div>

                  {aiTestResult.success && aiTestResult.email && (
                    <div className="rounded-lg bg-white border border-emerald-100 p-4 space-y-2">
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Generated Preview</p>
                      <p className="text-sm font-semibold text-gray-900">{aiTestResult.email.subject}</p>
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed max-h-32 overflow-y-auto">
                        {aiTestResult.email.body}
                      </pre>
                      <button
                        onClick={() => { setActiveView('email-generation') }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-800 transition-colors mt-1"
                      >
                        <ExternalLink className="size-3" />
                        View generated email in AI Emails
                      </button>
                    </div>
                  )}

                  {!aiTestResult.success && aiTestResult.error && (
                    <p className="text-xs text-red-700 bg-white/60 rounded-lg p-3 border border-red-100">
                      {aiTestResult.error}
                    </p>
                  )}
                </div>
              )}

              {/* Post-save suggestion */}
              {justSavedAi && !aiTestResult && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 animate-in fade-in-0 duration-200">
                  <Sparkles className="size-3.5 text-blue-600 shrink-0" />
                  <p className="text-xs text-blue-800">
                    AI config saved.{' '}
                    <button
                      onClick={() => testAiMutation.mutate()}
                      className="font-medium underline underline-offset-2 hover:text-blue-900"
                    >
                      Test the connection now
                    </button>
                    {' '}to make sure everything works.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm press-scale"
                onClick={handleSaveAiConfig}
                disabled={savePrefs.isPending}
              >
                {savePrefs.isPending ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Save className="size-3.5 mr-1.5" />}
                Save AI Config
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            Tab: Appearance
           ═══════════════════════════════════════════════════════ */}
        <TabsContent value="appearance" className="space-y-6">
          <div className="rounded-xl bg-white card-rest p-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Appearance</h3>
              <p className="text-xs text-gray-500 mt-0.5">Customize how DeepMindQ looks and feels.</p>
            </div>

            {/* Theme */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1.5">Theme</label>
              <p className="text-[11px] text-gray-400 mb-3">Choose your preferred color scheme.</p>
              <div className="grid grid-cols-3 gap-3 max-w-md">
                {([
                  { value: 'light', label: 'Light', bg: 'bg-white border-gray-200', preview: 'bg-gray-100' },
                  { value: 'dark', label: 'Dark', bg: 'bg-gray-900 border-gray-700', preview: 'bg-gray-800' },
                  { value: 'system', label: 'System', bg: 'bg-gradient-to-br from-white to-gray-900 border-gray-300', preview: 'bg-gray-50' },
                ] as const).map(theme => (
                  <button
                    key={theme.value}
                    onClick={() => handleThemeChange(theme.value)}
                    className={cn(
                      'relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-150 hover:shadow-sm',
                      theme.bg,
                      appearanceTheme === theme.value ? 'ring-2 ring-amber-500 shadow-xs' : 'hover:border-gray-300',
                    )}
                  >
                    {/* Mini preview card */}
                    <div className={cn('w-full h-10 rounded-lg', theme.preview)}>
                      <div className={cn('h-2 rounded-t-lg',
                        theme.value === 'dark' ? 'bg-gray-700' : 'bg-gray-200',
                      )} />
                      <div className="p-1.5 space-y-1">
                        <div className={cn('h-1 w-3/4 rounded-full',
                          theme.value === 'dark' ? 'bg-gray-600' : 'bg-gray-300',
                        )} />
                        <div className={cn('h-1 w-1/2 rounded-full',
                          theme.value === 'dark' ? 'bg-gray-600' : 'bg-gray-300',
                        )} />
                      </div>
                    </div>
                    <span className={cn('text-[11px] font-medium',
                      theme.value === 'dark' ? 'text-gray-300' : 'text-gray-700',
                    )}>
                      {theme.label}
                    </span>
                    {appearanceTheme === theme.value && (
                      <div className="absolute -top-1 -right-1 size-4 bg-amber-600 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="size-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <Separator className="bg-gray-100" />

            {/* Sidebar Default */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1.5">Sidebar Default</label>
              <p className="text-[11px] text-gray-400 mb-2">Choose whether the sidebar starts expanded or collapsed.</p>
              <SettingsToggleGroup
                label=""
                options={[
                  { value: 'expanded', label: 'Expanded' },
                  { value: 'collapsed', label: 'Collapsed' },
                ]}
                value={appearanceSidebar}
                onChange={v => setAppearanceSidebar(v)}
              />
            </div>

            <Separator className="bg-gray-100" />

            {/* Density */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1.5">Density</label>
              <p className="text-[11px] text-gray-400 mb-2">Control the spacing and compactness of the interface.</p>
              <SettingsToggleGroup
                label=""
                options={[
                  { value: 'compact', label: 'Compact' },
                  { value: 'comfortable', label: 'Comfortable' },
                  { value: 'sparse', label: 'Sparse' },
                ]}
                value={appearanceDensity}
                onChange={v => setAppearanceDensity(v)}
              />
            </div>

            <div className="flex justify-end">
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm press-scale"
                onClick={() => {
                  savePrefs.mutate({
                    theme: appearanceTheme,
                    density: appearanceDensity,
                    sidebarDefault: appearanceSidebar,
                  })
                }}
                disabled={savePrefs.isPending}
              >
                {savePrefs.isPending ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Save className="size-3.5 mr-1.5" />}
                Save Appearance
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            Tab: Audit Logs
           ═══════════════════════════════════════════════════════ */}
        <TabsContent value="audit" className="space-y-6">
          <AuditLogsTab />
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            Tab: Data Management
           ═══════════════════════════════════════════════════════ */}
        <TabsContent value="data" className="space-y-6">
          <div className="rounded-xl bg-white card-rest p-6 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Data Management</h3>
              <p className="text-xs text-gray-500 mt-0.5">Export your data or run maintenance tasks on your database.</p>
            </div>

            <div className="grid gap-4">
              {/* Export CSV */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-gray-200 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <Download className="size-4.5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Export All Data as CSV</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      Downloads two CSV files — one for all companies and one for all contacts. Includes all fields, scores, and metadata.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-gray-200 text-gray-600 rounded-lg shrink-0 self-end sm:self-auto"
                  onClick={() => handleExport.mutate()}
                  disabled={handleExport.isPending}
                >
                  {handleExport.isPending ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Download className="size-3.5 mr-1.5" />}
                  Export
                </Button>
              </div>

              {/* Health Check */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-gray-200 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                    <Stethoscope className="size-4.5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Run Email Health Check</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      Validates all email addresses in your database. Checks syntax, domain, MX records, and disposable email detection. Updates health scores.
                    </p>
                  </div>
                </div>
                <AlertDialog open={healthCheckOpen} onOpenChange={setHealthCheckOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs border-gray-200 text-gray-600 rounded-lg shrink-0 self-end sm:self-auto"
                      disabled={handleHealthCheck.isPending}
                    >
                      {handleHealthCheck.isPending ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Stethoscope className="size-3.5 mr-1.5" />}
                      Run Check
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Run Email Health Check?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will validate all email addresses in your database by checking syntax, domain, MX records, and disposable email detection.
                        This may take a moment depending on the number of contacts.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleHealthCheck.mutate()}
                        disabled={handleHealthCheck.isPending}
                      >
                        {handleHealthCheck.isPending ? (
                          <><Loader2 className="size-3.5 mr-1.5 animate-spin" /> Checking...</>
                        ) : (
                          'Run Check'
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            Tab: Advanced / Danger Zone
           ═══════════════════════════════════════════════════════ */}
        <TabsContent value="danger" className="space-y-6">
          <div className="rounded-xl border border-red-200 bg-white p-6 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-red-700 flex items-center gap-2">
                <AlertTriangle className="size-4" />
                Danger Zone
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Irreversible and destructive actions. Proceed with extreme caution.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-red-200 bg-red-50/30">
              <div>
                <p className="text-sm font-semibold text-gray-900">Delete All Data</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  Permanently remove all companies, contacts, notes, research cards, drafts, and opportunities.
                  This action cannot be undone. Consider exporting your data first.
                </p>
              </div>
              <AlertDialog open={dangerOpen} onOpenChange={setDangerOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs border-red-300 text-red-600 hover:bg-red-50 rounded-lg shrink-0 self-end sm:self-auto"
                  >
                    <Trash2 className="size-3.5 mr-1" />
                    Delete All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-red-700 flex items-center gap-2">
                      <AlertTriangle className="size-5" />
                      Delete All Data?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="leading-relaxed">
                      This will permanently delete all companies, contacts, notes, research cards, drafts, and opportunities from your database.
                      This action <span className="font-semibold text-red-600">cannot be undone</span>. Consider exporting your data first.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-2 pt-2">
                    <AlertDialogCancel className="border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDeleteAll.mutate()}
                      disabled={handleDeleteAll.isPending}
                      className="bg-red-600 hover:bg-red-700 text-white rounded-lg"
                    >
                      {handleDeleteAll.isPending ? (
                        <><Loader2 className="size-3.5 mr-1 animate-spin" /> Deleting...</>
                      ) : (
                        <><Trash2 className="size-3.5 mr-1" /> Yes, Delete Everything</>
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Separator className="bg-gray-100 my-8" />
      <p className="text-center text-xs text-gray-400 pb-4">DeepMindQ v1.0 — AI-Powered Sales Intelligence</p>
    </div>
  )
}