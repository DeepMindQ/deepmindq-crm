'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Building2, Users, ShieldCheck, Sparkles, ArrowRight, Clock, Target,
  Upload, Mail, BarChart3, Activity, Loader2, ChevronRight, FileSearch, ShieldAlert,
  AlertTriangle, RefreshCw,
  TrendingUp, ShieldX, Zap, FileText, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStore } from '@/lib/store'
import { getActivityIcon, SkeletonGrid } from '@/components/shared/design-system'
import { formatDistanceToNow } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

/* ═══════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════ */

interface PipelineStage {
  label: string
  count: number
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
  trends: {
    companies: number
    contacts: number
    healthy: number
    invalid: number
    newThisWeek: number
    drafts: number
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════════ */

const PIPELINE_COLORS: Record<string, string> = {
  New: '#6B7280',
  Researching: '#D97706',
  Qualified: '#7C3AED',
  Ready: '#059669',
  Contacted: '#2563EB',
  Won: '#16A34A',
  Lost: '#DC2626',
}

const EMAIL_HEALTH_COLORS = ['#059669', '#D97706', '#DC2626']

interface KpiCardDef {
  label: string
  icon: typeof Building2
  value: (d: DashboardData) => string
  sub: (d: DashboardData) => string
  iconBg: string
  iconColor: string
  view: 'companies' | 'contacts' | 'email-generation'
}

const KPI_CARDS: KpiCardDef[] = [
  {
    label: 'Total Companies',
    icon: Building2,
    value: (d) => String(d.totalCompanies),
    sub: () => 'accounts tracked',
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
    view: 'companies',
  },
  {
    label: 'Total Contacts',
    icon: Users,
    value: (d) => String(d.totalContacts),
    sub: () => 'people in pipeline',
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    view: 'contacts',
  },
  {
    label: 'Email Health',
    icon: ShieldCheck,
    value: (d) => `${d.healthyEmails}/${d.totalContacts}`,
    sub: () => 'healthy',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    view: 'contacts',
  },
  {
    label: 'AI Drafts',
    icon: Sparkles,
    value: (d) => String(d.draftsGenerated),
    sub: () => 'generated',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    view: 'email-generation',
  },
]

/* ═══════════════════════════════════════════════════════════════════════
   Custom Tooltip — Pipeline Bar Chart
   ═══════════════════════════════════════════════════════════════════════ */

function PipelineTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: PipelineStage }> }) {
  if (!active || !payload || !payload.length) return null
  const stage = payload[0].payload
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-100 px-3 py-2 text-sm">
      <p className="font-semibold text-gray-900">{stage.label}</p>
      <p className="text-gray-500 tabular-nums">{stage.count} {stage.count === 1 ? 'company' : 'companies'}</p>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Custom Tooltip — Email Health Pie Chart
   ═══════════════════════════════════════════════════════════════════════ */

interface EmailHealthSlice {
  name: string
  value: number
  color: string
}

function EmailHealthTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: EmailHealthSlice }> }) {
  if (!active || !payload || !payload.length) return null
  const slice = payload[0].payload
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-100 px-3 py-2 text-sm">
      <div className="flex items-center gap-2 mb-0.5">
        <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
        <p className="font-medium text-gray-900">{slice.name}</p>
      </div>
      <p className="text-gray-500 tabular-nums">{slice.value} {slice.value === 1 ? 'email' : 'emails'}</p>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Custom Label — Pipeline bars
   ═══════════════════════════════════════════════════════════════════════ */

function BarLabel({ x, y, width, value }: { x: number; y: number; width: number; value: number }) {
  if (value === 0) return null
  return (
    <text
      x={x + width + 8}
      y={y + 16}
      fill="#6B7280"
      fontSize={12}
      fontWeight={600}
      className="tabular-nums"
    >
      {value}
    </text>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   AI Insights Types & Config
   ═══════════════════════════════════════════════════════════════════════ */

interface AiInsight {
  type: 'positive' | 'negative' | 'neutral' | 'action'
  icon: string
  title: string
  description: string
}

interface AiPrediction {
  metric: string
  current: number
  predicted: number
  trend: 'up' | 'down' | 'stable'
  confidence: number
}

interface AiInsightsData {
  summary: string
  keyInsights: AiInsight[]
  predictions: AiPrediction[]
}

const INSIGHT_STYLES: Record<string, { bg: string; iconColor: string; border: string }> = {
  positive: { bg: 'bg-emerald-50', iconColor: 'text-emerald-600', border: 'border-emerald-200' },
  negative: { bg: 'bg-red-50', iconColor: 'text-red-600', border: 'border-red-200' },
  action: { bg: 'bg-amber-50', iconColor: 'text-amber-600', border: 'border-amber-200' },
  neutral: { bg: 'bg-sky-50', iconColor: 'text-sky-600', border: 'border-sky-200' },
}

const ICON_MAP: Record<string, typeof Building2> = {
  TrendingUp, ShieldCheck, Sparkles, AlertTriangle, ShieldAlert, FileSearch,
  Mail, Target, Users, Building2, Clock, Zap, FileText, ShieldX,
}

/* ═══════════════════════════════════════════════════════════════════════
   Dashboard Screen
   ═══════════════════════════════════════════════════════════════════════ */

export function DashboardScreen() {
  const { setActiveView, setSelectedCompanyId, setSelectedContactId, setCompanyStatusFilter } = useAppStore()

  /* ── Data fetch ── */
  const { data, isLoading, error, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () =>
      fetch('/api/dashboard').then(r => {
        if (!r.ok) throw new Error('Failed to load dashboard data')
        return r.json()
      }),
    refetchInterval: 30_000,
  })

  /* ── AI Insights fetch ── */
  const { data: insightsData, isLoading: insightsLoading } = useQuery<AiInsightsData>({
    queryKey: ['ai-insights'],
    queryFn: () =>
      fetch('/api/ai/insights').then(r => {
        if (!r.ok) throw new Error('Failed to load AI insights')
        return r.json()
      }),
    refetchInterval: 5 * 60_000,
    retry: 1,
  })

  /* ── Loading state ── */
  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Sales intelligence overview</p>
        </div>
        <SkeletonGrid cols={4} panels={4} />
      </div>
    )
  }

  /* ── Error state ── */
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Sales intelligence overview</p>
        </div>
        <div className="rounded-xl bg-red-50 border border-red-200 p-6 flex items-start gap-4">
          <AlertTriangle className="size-6 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-900">Failed to load dashboard</p>
            <p className="text-sm text-red-700 mt-0.5">{error.message}</p>
          </div>
          <Button
            variant="outline"
            className="border-red-200 text-red-700 hover:bg-red-50 shrink-0"
            onClick={() => refetch()}
          >
            <RefreshCw className="size-3.5 mr-1.5" /> Retry
          </Button>
        </div>
      </div>
    )
  }

  /* ── Derived data ── */
  const emailHealthData: EmailHealthSlice[] = [
    { name: 'Valid', value: data.healthyEmails, color: EMAIL_HEALTH_COLORS[0] },
    { name: 'Risky', value: data.riskyEmails, color: EMAIL_HEALTH_COLORS[1] },
    { name: 'Invalid', value: data.invalidEmails, color: EMAIL_HEALTH_COLORS[2] },
  ].filter((s) => s.value > 0)

  const totalEmails = data.healthyEmails + data.riskyEmails + data.invalidEmails
  const activityItems = data.recentActivity.slice(0, 8)

  /* ── Helpers ── */
  function handleKpiDrillDown(view: 'companies' | 'contacts' | 'email-generation', label: string) {
    if (view === 'companies') {
      setCompanyStatusFilter('all')
    }
    setActiveView(view)
  }

  function handleActivityClick(item: (typeof activityItems)[number]) {
    if (item.companyId) {
      setSelectedCompanyId(item.companyId)
      setActiveView('company-profile')
    } else if (item.contactId) {
      setSelectedContactId(item.contactId)
      setActiveView('contact-profile')
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════════════ */

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div>
        <h1 className="text-lg font-bold text-gray-900 tracking-tight">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Sales intelligence overview</p>
      </div>

      {/* ── Row 1: KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_CARDS.map((card, idx) => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className="rounded-xl bg-white card-rest p-5 slide-up"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-900 tracking-tight tabular-nums leading-tight">
                    {card.value(data)}
                  </p>
                  <p className="text-xs text-gray-400">{card.sub(data)}</p>
                </div>
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}>
                  <Icon className={`size-5 ${card.iconColor}`} />
                </div>
              </div>
              <button
                onClick={() => handleKpiDrillDown(card.view, card.label)}
                className="mt-3 flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors group cursor-pointer"
              >
                View all
                <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          )
        })}
      </div>

      {/* ── Row 1.5: AI Insights Panel ── */}
      <div className="rounded-xl bg-white card-rest slide-up overflow-hidden" style={{ animationDelay: '200ms' }}>
        {/* Gradient top border */}
        <div className="h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-orange-400" />
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-amber-50">
                <Sparkles className="size-3.5 text-amber-600" />
              </div>
              <h2 className="text-sm font-semibold text-gray-900 tracking-tight">AI Insights</h2>
            </div>
            {!insightsLoading && insightsData && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 h-7 px-2"
                onClick={() => setActiveView('tasks')}
              >
                View Recommendations
                <ArrowRight className="size-3 ml-1" />
              </Button>
            )}
          </div>

          {insightsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            </div>
          ) : insightsData ? (
            <>
              <p className="text-sm text-gray-600 leading-relaxed">{insightsData.summary}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                {insightsData.keyInsights.map((insight, idx) => {
                  const style = INSIGHT_STYLES[insight.type] ?? INSIGHT_STYLES.neutral
                  const IconComp = ICON_MAP[insight.icon] ?? FileText
                  return (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 rounded-lg border p-3 ${style.bg} ${style.border}`}
                    >
                      <IconComp className={`size-4 mt-0.5 shrink-0 ${style.iconColor}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-900 leading-tight">{insight.title}</p>
                        <p className="text-xs text-gray-600 mt-0.5 leading-snug line-clamp-2">{insight.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Predictions row */}
              {insightsData.predictions.length > 0 && (
                <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-gray-100">
                  {insightsData.predictions.map((pred, idx) => {
                    const TrendIcon = pred.trend === 'up' ? ArrowUpRight : pred.trend === 'down' ? ArrowDownRight : Minus
                    const trendColor = pred.trend === 'up' ? 'text-emerald-600' : pred.trend === 'down' ? 'text-red-600' : 'text-gray-400'
                    return (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500">{pred.metric}</span>
                        <span className="font-semibold text-gray-900 tabular-nums">{pred.current}</span>
                        <TrendIcon className={`size-3 ${trendColor}`} />
                        <span className={`font-medium tabular-nums ${trendColor}`}>{pred.predicted}</span>
                        <span className="text-gray-400">({pred.confidence}%)</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* ── Row 2: Pipeline Chart + Email Health Donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pipeline Chart */}
        <div className="lg:col-span-2 rounded-xl bg-white card-rest p-5 slide-up" style={{ animationDelay: '340ms' }}>
          <div className="flex items-center gap-2 mb-5">
            <Target className="size-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900 tracking-tight">Sales Pipeline</h2>
          </div>
          <div className="w-full" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.pipeline}
                layout="vertical"
                margin={{ top: 0, right: 36, bottom: 0, left: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={85}
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<PipelineTooltip />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                <Bar
                  dataKey="count"
                  radius={[0, 6, 6, 0]}
                  maxBarSize={24}
                  animationDuration={700}
                  animationEasing="ease-out"
                >
                  {data.pipeline.map((stage) => (
                    <Cell
                      key={stage.label}
                      fill={PIPELINE_COLORS[stage.label] ?? '#9CA3AF'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Email Health Donut */}
        <div className="rounded-xl bg-white card-rest p-5 slide-up" style={{ animationDelay: '400ms' }}>
          <div className="flex items-center gap-2 mb-5">
            <ShieldCheck className="size-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900 tracking-tight">Email Health</h2>
          </div>
          <div className="relative flex items-center justify-center" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={emailHealthData.length > 0 ? emailHealthData : [{ name: 'No data', value: 1, color: '#F3F4F6' }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={82}
                  paddingAngle={emailHealthData.length > 1 ? 3 : 0}
                  dataKey="value"
                  strokeWidth={0}
                  animationDuration={700}
                  animationEasing="ease-out"
                >
                  {emailHealthData.length > 0
                    ? emailHealthData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))
                    : <Cell fill="#F3F4F6" />
                  }
                </Pie>
                <Tooltip content={<EmailHealthTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-gray-900 tabular-nums leading-none">{totalEmails}</span>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mt-1">total</span>
            </div>
          </div>
          {/* Legend */}
          <div className="mt-4 space-y-2">
            {emailHealthData.length > 0 ? (
              emailHealthData.map((slice) => (
                <div key={slice.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                    <span className="text-gray-600">{slice.name}</span>
                  </div>
                  <span className="font-semibold text-gray-900 tabular-nums">{slice.value}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-400 text-center py-2">No email data yet</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 3: Activity Feed + Quick Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Activity */}
        <div className="lg:col-span-2 rounded-xl bg-white card-rest p-5 slide-up" style={{ animationDelay: '460ms' }}>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="size-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900 tracking-tight">Recent Activity</h2>
          </div>
          <div className="space-y-0 divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {activityItems.length > 0 ? (
              activityItems.map((item) => {
                const { icon: ActivityIcon, color, bg } = getActivityIcon(item.action)
                const isClickable = !!item.companyId || !!item.contactId
                return (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 py-3 first:pt-0 last:pb-0 ${
                      isClickable ? 'cursor-pointer group' : ''
                    }`}
                    onClick={() => isClickable && handleActivityClick(item)}
                  >
                    <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${bg} mt-0.5`}>
                      <ActivityIcon className={`size-4 ${color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-700 leading-snug">
                        {item.company?.name && (
                          <span className="font-medium text-gray-900 group-hover:text-amber-600 transition-colors">
                            {item.company.name}
                          </span>
                        )}
                        {item.contact?.name && !item.company?.name && (
                          <span className="font-medium text-gray-900 group-hover:text-amber-600 transition-colors">
                            {item.contact.name}
                          </span>
                        )}
                        {(item.company?.name || item.contact?.name) && item.details ? ' — ' : ''}
                        {item.details || item.action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    {isClickable && (
                      <ChevronRight className="size-4 text-gray-300 group-hover:text-amber-400 shrink-0 mt-1 transition-colors" />
                    )}
                  </div>
                )
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-10">
                <Activity className="size-8 text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">No recent activity</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl bg-white card-rest p-5 slide-up" style={{ animationDelay: '520ms' }}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="size-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900 tracking-tight">Quick Actions</h2>
          </div>
          <div className="space-y-3">
            {[
              {
                icon: Upload,
                title: 'Import Data',
                description: 'Upload CSV or connect a data source',
                view: 'import' as const,
              },
              {
                icon: FileSearch,
                title: 'Generate Research',
                description: 'View companies to run AI research',
                view: 'companies' as const,
              },
              {
                icon: Mail,
                title: 'Validate Emails',
                description: 'Check and verify contact emails',
                view: 'contacts' as const,
              },
              {
                icon: ShieldAlert,
                title: 'Upload Knowledge',
                description: 'Add capability docs for better drafts',
                view: 'knowledge-library' as const,
              },
            ].map((action) => {
              const ActionIcon = action.icon
              return (
                <button
                  key={action.title}
                  onClick={() => setActiveView(action.view)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-amber-50 hover:border-amber-200/60 transition-all duration-150 group cursor-pointer text-left"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 group-hover:bg-amber-100 transition-colors">
                    <ActionIcon className="size-4 text-amber-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 group-hover:text-amber-700 transition-colors leading-tight">
                      {action.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 leading-snug">{action.description}</p>
                  </div>
                  <ArrowRight className="size-4 text-gray-300 group-hover:text-amber-500 shrink-0 transition-colors" />
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}