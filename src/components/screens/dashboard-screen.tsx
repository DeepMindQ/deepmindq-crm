'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Building2, Users, ShieldCheck, ShieldAlert, TrendingUp, Sparkles,
  ArrowRight, Clock, CheckCircle2, Loader2, Mail, BarChart3, Settings,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import {
  EmptyState,
  TrendIndicator,
  Sparkline,
  getActivityIcon,
  SkeletonGrid,
  StatusDot,
} from '@/components/shared/design-system'

/* ═══════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════ */

interface PipelineStage {
  label: string
  count: number
}

interface DashboardTask {
  id: string
  title: string | null
  company: string
  contact: string | null
  status: string
  opportunityId: string
}

interface DashboardData {
  totalCompanies: number
  totalContacts: number
  healthyEmails: number
  riskyEmails: number
  invalidEmails: number
  archivedContacts: number
  newThisWeek: number
  draftsGenerated: number
  recentActivity: Array<{
    id: string
    action: string
    details: string | null
    createdAt: string
    companyId?: string | null
    contactId?: string | null
    company?: { id: string; name: string } | null
    contact?: { id: string; name: string } | null
  }>
  pipeline: PipelineStage[]
  sparklines: {
    companies: number[]
    contacts: number[]
    healthy: number[]
    invalid: number[]
  }
  trends: {
    companies: number
    contacts: number
    healthy: number
    invalid: number
    newThisWeek: number
    drafts: number
  }
  tasks: DashboardTask[]
}

/* ═══════════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════════ */

const pipelineColors: Record<string, { color: string; bg: string }> = {
  New:          { color: '#6B7280', bg: '#F3F4F6' },
  Researching:  { color: '#D97706', bg: '#FFFBEB' },
  Contacted:    { color: '#2563EB', bg: '#EFF6FF' },
  Qualified:    { color: '#7C3AED', bg: '#F5F3FF' },
  Ready:        { color: '#059669', bg: '#ECFDF5' },
  Won:          { color: '#16A34A', bg: '#F0FDF4' },
  Lost:         { color: '#DC2626', bg: '#FEF2F2' },
}

const statusBadgeStyle: Record<string, string> = {
  researching: 'bg-amber-50 text-amber-700 border-amber-200',
  contacted:   'bg-blue-50 text-blue-700 border-blue-200',
  qualified:   'bg-violet-50 text-violet-700 border-violet-200',
  ready:       'bg-emerald-50 text-emerald-700 border-emerald-200',
  new:         'bg-gray-50 text-gray-600 border-gray-200',
}

const taskStatusMap: Record<string, 'fresh' | 'stale' | 'old' | 'unknown'> = {
  researching: 'stale',
  contacted:   'fresh',
  qualified:   'fresh',
  ready:       'fresh',
  new:         'unknown',
}

/* ═══════════════════════════════════════════════════════════════════════
   AI Status Banner
   ═══════════════════════════════════════════════════════════════════════ */

function AiStatusBanner({ setActiveView }: { setActiveView: (v: 'settings') => void }) {
  return (
    <div className="slide-up rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 px-4 py-3 flex items-center gap-3 group cursor-pointer card-interactive"
      onClick={() => setActiveView('settings')}
    >
      <div className="shrink-0 flex size-8 items-center justify-center rounded-lg bg-amber-100 group-hover:bg-amber-200 transition-colors">
        <AlertCircle className="size-4 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-800 tracking-tight">
          Configure AI in Settings for enhanced insights
        </p>
        <p className="text-xs text-amber-600/80 mt-0.5">
          Connect your API key to unlock AI-powered research, email generation, and scoring.
        </p>
      </div>
      <ArrowRight className="size-4 text-amber-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   KPI Card
   ═══════════════════════════════════════════════════════════════════════ */

interface KpiCardProps {
  label: string
  value: number
  icon: React.ElementType
  iconBg: string
  iconColor: string
  trend: number
  sparkData: number[] | undefined
  sparkColor: string
  delay: number
  onClick: () => void
}

function KpiCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  trend,
  sparkData,
  sparkColor,
  delay,
  onClick,
}: KpiCardProps) {
  return (
    <div
      className="card-interactive rounded-xl bg-white p-5 group slide-up"
      style={{ animationDelay: `${delay}ms` }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
        <div
          className={`rounded-xl p-2 transition-transform duration-200 group-hover:scale-110 ${iconBg}`}
        >
          <Icon className={`size-4 ${iconColor}`} />
        </div>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[26px] font-bold text-gray-900 tracking-tight tabular-nums leading-none">
            {value.toLocaleString()}
          </p>
          <TrendIndicator value={trend} className="mt-2" />
        </div>
        {sparkData && (
          <Sparkline data={sparkData} color={sparkColor} className="opacity-70 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Dashboard Screen
   ═══════════════════════════════════════════════════════════════════════ */

export function DashboardScreen() {
  const {
    setActiveView,
    setCompanyStatusFilter,
    setSelectedCompanyId,
    setSelectedContactId,
  } = useAppStore()
  const qc = useQueryClient()

  /* ── Data fetch ── */
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => fetch('/api/dashboard').then((r) => r.json()),
  })

  /* ── AI key check ── */
  const { data: prefs } = useQuery<{
    aiApiKey: string | null
  }>({
    queryKey: ['preferences', 'dash-ai-check'],
    queryFn: () => fetch('/api/preferences').then((r) => r.json()),
    staleTime: 60_000,
  })
  const hasAiKey = Boolean(prefs?.aiApiKey)

  /* ── Task completion ── */
  const completeMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/opportunities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'won' }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Opportunity marked as won')
    },
    onError: () => toast.error('Failed to update opportunity'),
  })

  /* ── Loading ── */
  if (isLoading) return <SkeletonGrid cols={4} panels={3} />

  /* ── Empty state ── */
  const isEmpty = !data || (data.totalCompanies === 0 && data.totalContacts === 0)
  if (isEmpty) {
    return (
      <div className="space-y-8 max-w-lg mx-auto">
        <div className="text-center pt-8">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
            Welcome to DeepMindQ
          </h2>
          <p className="text-gray-500 mt-2 text-sm leading-relaxed">
            Your AI-powered sales intelligence workspace. Start by importing your first
            list of companies and contacts.
          </p>
        </div>
        <EmptyState
          icon={Building2}
          title="No companies yet"
          description="Import a CSV with your target accounts, or add companies manually to get started with AI-powered research and outreach."
          actionLabel="Import CSV"
          onAction={() => setActiveView('import')}
          secondaryActionLabel="Add Company"
          onSecondaryAction={() => setActiveView('companies')}
        />
      </div>
    )
  }

  /* ── Derived values ── */
  const total =
    (data.healthyEmails || 0) + (data.riskyEmails || 0) + (data.invalidEmails || 0) || 1
  const validPct = Math.round(((data.healthyEmails || 0) / total) * 100)
  const riskyPct = Math.round(((data.riskyEmails || 0) / total) * 100)
  const invalidPct = 100 - validPct - riskyPct

  const pipelineStages = data.pipeline || []
  const maxPipeline = Math.max(...pipelineStages.map((s) => s.count), 1)

  const tasks = data.tasks || []

  /* ── Relative time helper ── */
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  }

  /* ═══════════════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6">
      {/* ── AI Status Banner ── */}
      {!hasAiKey && <AiStatusBanner setActiveView={setActiveView} />}

      {/* ── Quick Actions Bar ── */}
      <div
        className="flex items-center gap-2.5 flex-wrap slide-up"
        style={{ animationDelay: '0ms' }}
      >
        <Button
          variant="outline"
          className="border-gray-200 text-gray-600 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 rounded-lg text-xs gap-2 transition-all duration-200"
          onClick={() => setActiveView('companies')}
        >
          <Building2 className="size-3.5" />
          Browse Companies
        </Button>
        <Button
          variant="outline"
          className="border-gray-200 text-gray-600 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 rounded-lg text-xs gap-2 transition-all duration-200"
          onClick={() => setActiveView('contacts')}
        >
          <Users className="size-3.5" />
          View Contacts
        </Button>
        <Button
          variant="outline"
          className="border-gray-200 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 rounded-lg text-xs gap-2 transition-all duration-200"
          onClick={() => setActiveView('email-generation')}
        >
          <Mail className="size-3.5" />
          Generate AI Email
        </Button>
        <Button
          variant="outline"
          className="border-gray-200 text-gray-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 rounded-lg text-xs gap-2 transition-all duration-200"
          onClick={() => setActiveView('import')}
        >
          <ArrowRight className="size-3.5" />
          Import Data
        </Button>
      </div>

      {/* ── Primary KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Companies"
          value={data.totalCompanies}
          icon={Building2}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          trend={data.trends?.companies ?? 0}
          sparkData={data.sparklines?.companies}
          sparkColor="#2563EB"
          delay={0}
          onClick={() => {
            setCompanyStatusFilter('all')
            setActiveView('companies')
          }}
        />
        <KpiCard
          label="Contacts"
          value={data.totalContacts}
          icon={Users}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
          trend={data.trends?.contacts ?? 0}
          sparkData={data.sparklines?.contacts}
          sparkColor="#7C3AED"
          delay={60}
          onClick={() => setActiveView('contacts')}
        />
        <KpiCard
          label="Healthy Emails"
          value={data.healthyEmails}
          icon={ShieldCheck}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          trend={data.trends?.healthy ?? 0}
          sparkData={data.sparklines?.healthy}
          sparkColor="#059669"
          delay={120}
          onClick={() => setActiveView('contacts')}
        />
        <KpiCard
          label="Invalid Emails"
          value={data.invalidEmails}
          icon={ShieldAlert}
          iconBg="bg-red-50"
          iconColor="text-red-500"
          trend={data.trends?.invalid ?? 0}
          sparkData={data.sparklines?.invalid}
          sparkColor="#EF4444"
          delay={180}
          onClick={() => setActiveView('contacts')}
        />
      </div>

      {/* ── Secondary KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          className="card-interactive rounded-xl bg-white p-5 group slide-up"
          style={{ animationDelay: '240ms' }}
          onClick={() => setActiveView('companies')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setActiveView('companies')}
        >
          <div className="flex items-start justify-between mb-3">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              New This Week
            </p>
            <div className="rounded-xl p-2 bg-amber-50 transition-transform duration-200 group-hover:scale-110">
              <TrendingUp className="size-4 text-amber-600" />
            </div>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[26px] font-bold text-gray-900 tracking-tight tabular-nums leading-none">
                {data.newThisWeek.toLocaleString()}
              </p>
              <TrendIndicator value={data.trends?.newThisWeek ?? 0} className="mt-2" />
            </div>
            {data.sparklines?.companies && (
              <Sparkline data={data.sparklines.companies} color="#D97706" className="opacity-60" />
            )}
          </div>
        </div>

        <div
          className="card-interactive rounded-xl bg-white p-5 group slide-up"
          style={{ animationDelay: '300ms' }}
          onClick={() => setActiveView('email-generation')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setActiveView('email-generation')}
        >
          <div className="flex items-start justify-between mb-3">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              AI Drafts
            </p>
            <div className="rounded-xl p-2 bg-indigo-50 transition-transform duration-200 group-hover:scale-110">
              <Sparkles className="size-4 text-indigo-600" />
            </div>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[26px] font-bold text-gray-900 tracking-tight tabular-nums leading-none">
                {data.draftsGenerated.toLocaleString()}
              </p>
              <TrendIndicator value={data.trends?.drafts ?? 0} className="mt-2" />
            </div>
            {data.sparklines?.contacts && (
              <Sparkline data={data.sparklines.contacts} color="#6366F1" className="opacity-60" />
            )}
          </div>
        </div>

        {/* Archived Contacts — non-clickable info card */}
        <div
          className="card-rest rounded-xl bg-white p-5 slide-up"
          style={{ animationDelay: '360ms' }}
        >
          <div className="flex items-start justify-between mb-3">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Archived
            </p>
            <div className="rounded-xl p-2 bg-gray-50">
              <Clock className="size-4 text-gray-400" />
            </div>
          </div>
          <p className="text-[26px] font-bold text-gray-900 tracking-tight tabular-nums leading-none">
            {data.archivedContacts.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-2">Contacts archived</p>
        </div>

        {/* Risky Emails — navigates to contacts */}
        <div
          className="card-interactive rounded-xl bg-white p-5 group slide-up"
          style={{ animationDelay: '420ms' }}
          onClick={() => setActiveView('contacts')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setActiveView('contacts')}
        >
          <div className="flex items-start justify-between mb-3">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Risky Emails
            </p>
            <div className="rounded-xl p-2 bg-amber-50 transition-transform duration-200 group-hover:scale-110">
              <ShieldAlert className="size-4 text-amber-500" />
            </div>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[26px] font-bold text-gray-900 tracking-tight tabular-nums leading-none">
                {data.riskyEmails.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-2">Need review</p>
            </div>
            {data.sparklines?.invalid && (
              <Sparkline data={data.sparklines.invalid} color="#F59E0B" className="opacity-60" />
            )}
          </div>
        </div>
      </div>

      {/* ── Main Panels: Email Health | Pipeline | Next Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Email Health Donut ── */}
        <div
          className="rounded-xl bg-white p-5 card-rest slide-up"
          style={{ animationDelay: '480ms' }}
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-gray-900 tracking-tight">
              Email Health
            </h3>
            <div className="flex items-center gap-1.5">
              <StatusDot status="fresh" pulse={validPct >= 80} />
              <span className="text-[11px] text-gray-400 tabular-nums">
                {validPct}% deliverable
              </span>
            </div>
          </div>

          <div className="flex items-center gap-5">
            {/* SVG Donut */}
            <div className="relative w-28 h-28 shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                {/* Background ring */}
                <circle
                  cx="18" cy="18" r="15.9"
                  fill="none" stroke="#F3F4F6" strokeWidth="2.5"
                />
                {/* Healthy segment */}
                <circle
                  cx="18" cy="18" r="15.9"
                  fill="none" stroke="#059669" strokeWidth="2.5"
                  strokeDasharray={`${validPct} ${100 - validPct}`}
                  strokeDashoffset="0"
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
                {/* Risky segment */}
                <circle
                  cx="18" cy="18" r="15.9"
                  fill="none" stroke="#D97706" strokeWidth="2.5"
                  strokeDasharray={`${riskyPct} ${100 - riskyPct}`}
                  strokeDashoffset={`-${validPct}`}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
                {/* Invalid segment */}
                <circle
                  cx="18" cy="18" r="15.9"
                  fill="none" stroke="#EF4444" strokeWidth="2.5"
                  strokeDasharray={`${invalidPct} ${100 - invalidPct}`}
                  strokeDashoffset={`-${validPct + riskyPct}`}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-gray-900 tabular-nums leading-none">
                  {total}
                </span>
                <span className="text-[10px] text-gray-400 mt-0.5">Total</span>
              </div>
            </div>

            {/* Legend breakdown */}
            <div className="flex-1 space-y-3.5">
              {[
                { label: 'Valid', count: data.healthyEmails, pct: validPct, color: '#059669' },
                { label: 'Risky', count: data.riskyEmails, pct: riskyPct, color: '#D97706' },
                { label: 'Invalid', count: data.invalidEmails, pct: invalidPct, color: '#EF4444' },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-xs text-gray-600 font-medium">{s.label}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-14 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${Math.max(s.pct, 2)}%`,
                          backgroundColor: s.color,
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-900 tabular-nums w-6 text-right">
                      {s.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Pipeline Funnel ── */}
        <div
          className="rounded-xl bg-white p-5 card-rest slide-up"
          style={{ animationDelay: '540ms' }}
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900 tracking-tight">
                Pipeline
              </h3>
              <BarChart3 className="size-3.5 text-gray-300" />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-[11px] text-gray-400 hover:text-gray-900 -mr-2 h-7 gap-1"
              onClick={() => {
                setCompanyStatusFilter('all')
                setActiveView('companies')
              }}
            >
              View all
              <ArrowRight className="size-3" />
            </Button>
          </div>

          <div className="space-y-3">
            {pipelineStages.map((stage) => {
              const colors =
                pipelineColors[stage.label] || { color: '#6B7280', bg: '#F3F4F6' }
              const pct = (stage.count / maxPipeline) * 100
              return (
                <div
                  key={stage.label}
                  className="group cursor-pointer rounded-lg p-2 -mx-2 transition-colors hover:bg-gray-50/80"
                  onClick={() => {
                    setCompanyStatusFilter(stage.label.toLowerCase())
                    setActiveView('companies')
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="size-2 rounded-full transition-transform group-hover:scale-125"
                        style={{ backgroundColor: colors.color }}
                      />
                      <span className="text-xs font-medium text-gray-600 group-hover:text-gray-900 transition-colors">
                        {stage.label}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-gray-900 tabular-nums">
                      {stage.count}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100/80 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out group-hover:opacity-80"
                      style={{
                        width: `${Math.max(pct, 2)}%`,
                        backgroundColor: colors.color,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-400">Total companies</span>
            <span className="font-semibold text-gray-900 tabular-nums">
              {data.totalCompanies}
            </span>
          </div>
        </div>

        {/* ── Next Actions ── */}
        <div
          className="rounded-xl bg-white p-5 card-rest slide-up"
          style={{ animationDelay: '600ms' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900 tracking-tight">
                Next Actions
              </h3>
              <span className="inline-flex items-center justify-center size-5 rounded-full bg-amber-100 text-[10px] font-bold text-amber-700 tabular-nums">
                {tasks.length}
              </span>
            </div>
            <Clock className="size-4 text-gray-300" />
          </div>

          {tasks.length > 0 ? (
            <ScrollArea className="max-h-72">
              <div className="space-y-1 pr-2">
                {tasks.map((task) => {
                  const isCompleting =
                    completeMutation.isPending &&
                    completeMutation.variables === task.opportunityId
                  return (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
                    >
                      <button
                        onClick={() => completeMutation.mutate(task.opportunityId)}
                        disabled={isCompleting}
                        className="mt-0.5 size-4 rounded border-2 border-gray-200 shrink-0 group-hover:border-amber-400 transition-colors flex items-center justify-center hover:bg-amber-50 disabled:opacity-50"
                        aria-label="Mark as won"
                      >
                        {isCompleting ? (
                          <Loader2 className="size-2.5 text-amber-600 animate-spin" />
                        ) : null}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-gray-700 leading-snug font-medium">
                          {task.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <StatusDot
                            status={taskStatusMap[task.status] || 'unknown'}
                            className="mt-0.5"
                          />
                          <span className="text-[11px] text-gray-400">
                            {task.company}
                          </span>
                          {task.contact && (
                            <>
                              <span className="text-[11px] text-gray-300">&middot;</span>
                              <span className="text-[11px] text-gray-400">
                                {task.contact}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${statusBadgeStyle[task.status] || statusBadgeStyle.new}`}
                      >
                        {task.status}
                      </span>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 mb-3">
                <CheckCircle2 className="size-5 text-emerald-400" />
              </div>
              <p className="text-sm font-medium text-gray-500">All clear</p>
              <p className="text-xs text-gray-400 mt-0.5 max-w-[200px]">
                Create opportunities with next actions to see them here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Activity ── */}
      <div
        className="rounded-xl bg-white p-5 card-rest slide-up"
        style={{ animationDelay: '660ms' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 tracking-tight">
              Recent Activity
            </h3>
            <span className="inline-flex items-center justify-center size-5 rounded-full bg-gray-100 text-[10px] font-bold text-gray-500 tabular-nums">
              {data?.recentActivity?.length || 0}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <StatusDot status="fresh" pulse />
            <span className="text-[11px] text-gray-400">Live</span>
          </div>
        </div>

        <ScrollArea className="h-80">
          {data?.recentActivity && data.recentActivity.length > 0 ? (
            <div className="space-y-0.5 pr-2">
              {data.recentActivity.slice(0, 15).map((item, idx) => {
                const iconData = getActivityIcon(item.action)
                const Icon = iconData.icon
                const hasNav = item.companyId || item.contactId

                return (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 p-3 rounded-lg transition-colors slide-up ${
                      hasNav
                        ? 'cursor-pointer hover:bg-gray-50 group'
                        : 'opacity-80'
                    }`}
                    style={{ animationDelay: `${700 + idx * 35}ms` }}
                    onClick={() => {
                      if (item.companyId) {
                        setSelectedCompanyId(item.companyId)
                        setActiveView('company-profile')
                      } else if (item.contactId) {
                        setSelectedContactId(item.contactId)
                        setActiveView('contact-profile')
                      }
                    }}
                    role={hasNav ? 'button' : undefined}
                    tabIndex={hasNav ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (hasNav && e.key === 'Enter') {
                        if (item.companyId) {
                          setSelectedCompanyId(item.companyId)
                          setActiveView('company-profile')
                        } else if (item.contactId) {
                          setSelectedContactId(item.contactId)
                          setActiveView('contact-profile')
                        }
                      }
                    }}
                  >
                    <div
                      className={`shrink-0 mt-0.5 rounded-lg p-1.5 ${iconData.bg}`}
                    >
                      <Icon className={`size-3.5 ${iconData.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-gray-900 leading-snug truncate">
                            {item.action}
                          </p>
                          {item.details && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">
                              {item.details}
                            </p>
                          )}
                          {(item.company?.name || item.contact?.name) && (
                            <div className="flex items-center gap-1.5 mt-1">
                              {item.company?.name && (
                                <span className="text-[11px] text-gray-400">
                                  {item.company.name}
                                </span>
                              )}
                              {item.company?.name && item.contact?.name && (
                                <span className="text-[11px] text-gray-300">
                                  &middot;
                                </span>
                              )}
                              {item.contact?.name && (
                                <span className="text-[11px] text-gray-400 font-medium">
                                  {item.contact.name}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[11px] text-gray-400 tabular-nums whitespace-nowrap">
                            {timeAgo(item.createdAt)}
                          </span>
                          {hasNav && (
                            <ArrowRight className="size-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState
              icon={Clock}
              title="No activity yet"
              description="Activity will appear here as you add companies, contacts, and generate AI content."
              className="py-10"
            />
          )}
        </ScrollArea>
      </div>
    </div>
  )
}